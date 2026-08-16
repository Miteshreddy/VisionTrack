"""
VisionTrack — WebSocket Streaming Routes

Handles the real-time bidirectional communication between the backend
processing loop and the browser frontend.

/ws/stream  — Streams annotated frames + analytics JSON as WebSocket messages.
              The backend sends a message every processed frame.
              The client can send JSON to update settings mid-stream.

Message format (server → client):
{
  "type": "frame",
  "frame": "data:image/jpeg;base64,...",
  "frame_id": 42,
  "detections": [...],
  "analytics": {...},
  "zone_counts": {...}
}

Control messages (client → server):
{
  "type": "settings",
  "conf_thres": 0.5,
  "classes": [0, 2],
  ...
}
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from visiontrack.session import get_session

logger = logging.getLogger("visiontrack.routes.stream")

router = APIRouter(prefix="/ws", tags=["WebSocket"])

# Connected WebSocket clients
_clients: Set[WebSocket] = set()
_broadcast_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.add(ws)
        logger.info(f"WebSocket connected. Total clients: {len(self.active)}")

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)
        logger.info(f"WebSocket disconnected. Total clients: {len(self.active)}")

    async def send(self, ws: WebSocket, data: dict) -> None:
        try:
            await ws.send_json(data)
        except Exception:
            self.disconnect(ws)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/stream")
async def websocket_stream(ws: WebSocket):
    """
    Primary streaming WebSocket endpoint.

    1. Client connects → backend registers a callback.
    2. Each processed frame is sent as a JSON message.
    3. Client can send settings updates to adjust inference parameters.
    4. Disconnect cleans up the callback.
    """
    await manager.connect(ws)
    session = get_session()

    # Queue for thread-safe frame delivery from background thread → async WS
    frame_queue: asyncio.Queue = asyncio.Queue(maxsize=4)
    loop = asyncio.get_event_loop()

    def on_frame(payload: dict) -> None:
        """Called from the background processing thread on each frame."""
        try:
            # Put frame on queue; if full, drop (don't block the processing thread)
            loop.call_soon_threadsafe(
                lambda: frame_queue.put_nowait(payload) if not frame_queue.full() else None
            )
        except Exception as e:
            logger.debug(f"Frame queue error: {e}")

    session.subscribe(on_frame)

    try:
        # Send initial status immediately
        status = session.get_status()
        await ws.send_json({"type": "status", **status})

        # Two concurrent tasks: send frames + receive control messages
        send_task = asyncio.create_task(_send_frames(ws, frame_queue))
        recv_task = asyncio.create_task(_receive_controls(ws, session))

        done, pending = await asyncio.wait(
            [send_task, recv_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        session.unsubscribe(on_frame)
        manager.disconnect(ws)


async def _send_frames(ws: WebSocket, queue: asyncio.Queue) -> None:
    """Continuously pull frames from the queue and send them to the client."""
    while True:
        try:
            payload = await asyncio.wait_for(queue.get(), timeout=2.0)
            payload["type"] = "frame"
            await ws.send_json(payload)
        except asyncio.TimeoutError:
            # No frame for 2s — send a heartbeat ping
            try:
                await ws.send_json({"type": "ping"})
            except Exception:
                break
        except WebSocketDisconnect:
            break
        except Exception as e:
            logger.debug(f"Send frame error: {e}")
            break


async def _receive_controls(ws: WebSocket, session) -> None:
    """Receive control messages from the client and apply them to the session."""
    while True:
        try:
            data = await ws.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "settings":
                # Update session settings on the fly
                update = {k: v for k, v in data.items() if k != "type"}
                session.settings.update(**update)
                logger.debug(f"Settings updated: {update}")

            elif msg_type == "pause":
                session.pause()
                await ws.send_json({"type": "status", "state": "paused"})

            elif msg_type == "resume":
                session.resume()
                await ws.send_json({"type": "status", "state": "running"})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

        except WebSocketDisconnect:
            break
        except Exception as e:
            logger.debug(f"Receive control error: {e}")
            break

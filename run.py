"""
VisionTrack — Application Startup Script

Usage:
    python run.py                          # Default: yolov8n.pt, port 8000
    python run.py --model yolov8s.pt       # Choose model
    python run.py --port 8080              # Different port
    python run.py --no-browser             # Don't auto-open browser

This script starts the FastAPI/uvicorn server and optionally opens the
browser automatically.
"""

import argparse
import sys
import threading
import time
import webbrowser
from pathlib import Path

# Ensure the project root is on sys.path
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def parse_args():
    parser = argparse.ArgumentParser(
        description="VisionTrack — Real-Time Object Detection & Tracking Analytics"
    )
    parser.add_argument(
        "--host", default="0.0.0.0",
        help="Host to bind (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=8000,
        help="Port to listen on (default: 8000)"
    )
    parser.add_argument(
        "--model", default="yolov8n.pt",
        help="YOLO model weights to preload (default: yolov8n.pt)"
    )
    parser.add_argument(
        "--no-browser", action="store_true",
        help="Do not open browser automatically"
    )
    parser.add_argument(
        "--reload", action="store_true",
        help="Enable uvicorn hot-reload (development only)"
    )
    parser.add_argument(
        "--log-level", default="info",
        choices=["debug", "info", "warning", "error"],
        help="Logging level"
    )
    return parser.parse_args()


def open_browser(url: str, delay: float = 2.0):
    """Open the browser after a short delay to allow the server to start."""
    def _open():
        time.sleep(delay)
        print(f"\n  Opening browser: {url}\n")
        webbrowser.open(url)
    threading.Thread(target=_open, daemon=True).start()


def main():
    args = parse_args()
    url  = f"http://localhost:{args.port}"

    print("\n" + "=" * 60)
    print("  VisionTrack")
    print("  Real-Time Object Detection & Tracking Analytics")
    print("=" * 60)
    print(f"\n  Server:   http://{args.host}:{args.port}")
    print(f"  Frontend: {url}")
    print(f"  API Docs: {url}/api/docs")
    print(f"  Model:    {args.model}")
    print("\n  Press Ctrl+C to stop.\n")
    print("=" * 60 + "\n")

    # Auto-open browser
    if not args.no_browser:
        open_browser(url, delay=2.5)

    # Start uvicorn
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level,
        access_log=False,       # reduce noise; important events logged by app
    )


if __name__ == "__main__":
    main()

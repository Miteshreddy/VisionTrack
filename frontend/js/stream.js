/**
 * VisionTrack — Stream Module
 *
 * Manages the WebSocket connection to the backend and handles:
 * - Connecting / reconnecting to ws://localhost:8000/ws/stream
 * - Receiving annotated frame payloads (base64 JPEG + JSON analytics)
 * - Displaying frames in the <img> element
 * - Notifying other modules of new detections and analytics
 * - Sending control messages (settings, pause, resume)
 *
 * The stream module is the single source of truth for real-time data.
 * It emits events that analytics.js and controls.js listen to.
 */

const WS_URL = `ws://${window.location.host}/ws/stream`;
const RECONNECT_DELAY = 2000;  // ms before reconnect attempt
const MAX_RECONNECT   = 8;

class StreamClient {
  constructor() {
    this._ws        = null;
    this._listeners = {};       // event → [callback, ...]
    this._reconnect_count = 0;
    this._intentional_close = false;
    this._frame_el  = null;
  }

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------

  init(frameEl) {
    this._frame_el = frameEl;
  }

  // -----------------------------------------------------------------------
  // Connection management
  // -----------------------------------------------------------------------

  connect() {
    this._intentional_close = false;
    this._reconnect_count = 0;
    this._doConnect();
  }

  _doConnect() {
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
    }

    console.log('[Stream] Connecting to', WS_URL);
    this._ws = new WebSocket(WS_URL);

    this._ws.onopen = () => {
      console.log('[Stream] Connected');
      this._reconnect_count = 0;
      this._emit('connected');
    };

    this._ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this._handleMessage(msg);
      } catch (e) {
        console.warn('[Stream] Failed to parse message:', e);
      }
    };

    this._ws.onerror = (ev) => {
      console.warn('[Stream] WebSocket error', ev);
    };

    this._ws.onclose = () => {
      if (this._intentional_close) return;
      console.log('[Stream] Disconnected. Reconnecting…');
      this._emit('disconnected');

      if (this._reconnect_count < MAX_RECONNECT) {
        this._reconnect_count++;
        setTimeout(() => this._doConnect(), RECONNECT_DELAY);
      } else {
        this._emit('error', 'Could not connect to VisionTrack server.');
      }
    };
  }

  disconnect() {
    this._intentional_close = true;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }

  // -----------------------------------------------------------------------
  // Sending control messages
  // -----------------------------------------------------------------------

  sendSettings(settings) {
    this._send({ type: 'settings', ...settings });
  }

  sendPause() {
    this._send({ type: 'pause' });
  }

  sendResume() {
    this._send({ type: 'resume' });
  }

  _send(obj) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }

  // -----------------------------------------------------------------------
  // Message handling
  // -----------------------------------------------------------------------

  _handleMessage(msg) {
    switch (msg.type) {
      case 'frame':
        this._displayFrame(msg.frame);
        this._emit('frame', msg);
        break;

      case 'status':
        this._emit('status', msg);
        break;

      case 'ping':
        this._send({ type: 'ping' });
        break;

      default:
        // pass
    }
  }

  _displayFrame(b64) {
    if (this._frame_el && b64) {
      this._frame_el.src = b64;
    }
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error('[Stream] Listener error:', e); }
    });
  }

  get isConnected() {
    return this._ws && this._ws.readyState === WebSocket.OPEN;
  }
}

// Module-level singleton
export const stream = new StreamClient();
export default stream;

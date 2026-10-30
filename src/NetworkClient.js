export default class NetworkClient {
  constructor({ onMessage, onStatus, location = globalThis.location, WebSocketImpl = globalThis.WebSocket, retryDelay = 1500 } = {}) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.WebSocketImpl = WebSocketImpl;
    this.url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    this.retryDelay = retryDelay;
    this.closed = true;
    this.sequence = 0;
  }

  connect() {
    if (!this.closed && this.socket && this.socket.readyState < 2) return;
    this.closed = false;
    clearTimeout(this.timer);
    this.onStatus?.('connecting');
    let socket;
    try {
      socket = new this.WebSocketImpl(this.url);
    } catch {
      this.onStatus?.('error');
      this.timer = setTimeout(() => { this.socket = null; this.connect(); }, this.retryDelay);
      return;
    }
    this.socket = socket;
    socket.onopen = () => { if (this.socket === socket && !this.closed) this.onStatus?.('connected'); };
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.closed) return;
      try { this.onMessage?.(JSON.parse(event.data)); } catch { /* Ignore malformed messages. */ }
    };
    socket.onerror = () => this.onStatus?.('error', 'Nie udalo sie polaczyc z serwerem');
    socket.onclose = (event = {}) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.onStatus?.('disconnected', event.reason || 'Polaczenie zostalo przerwane');
      if (!this.closed) this.timer = setTimeout(() => this.connect(), this.retryDelay);
    };
  }

  send(message) {
    if (this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify({ ...message, messageId: ++this.sequence }));
    return true;
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type MessageHandler = (data: any) => void;

class RealtimeSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimeout: any = null;
  private shouldReconnect = true;
  private currentContext: {
    type: 'board' | 'remote';
    payload: any;
  } | null = null;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.emitLocal('connection:open', {});
        // Re-authenticate or re-join room if context exists
        if (this.currentContext) {
          if (this.currentContext.type === 'board') {
            this.send({ type: 'board:join', ...this.currentContext.payload });
          } else if (this.currentContext.type === 'remote') {
            this.send({ type: 'remote:bind', ...this.currentContext.payload });
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.emitLocal(data.type, data);
          }
          // Global message hook
          this.emitLocal('*', data);
        } catch (e) {
          console.error('Socket message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.emitLocal('connection:close', {});
        if (this.shouldReconnect) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => this.connect(), 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
      };
    } catch (e) {
      console.error('Failed to construct WebSocket:', e);
    }
  }

  joinBoard(boardId: string, user: { name: string; color: string }) {
    this.currentContext = {
      type: 'board',
      payload: { boardId, userName: user.name, color: user.color },
    };
    this.connect();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'board:join',
        boardId,
        userName: user.name,
        color: user.color,
      });
    }
  }

  bindRemote(sessionId: string, role: 'controller' | 'display', passcode?: string, deviceInfo?: string) {
    this.currentContext = {
      type: 'remote',
      payload: { sessionId, role, passcode, deviceInfo },
    };
    this.connect();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'remote:bind',
        sessionId,
        role,
        passcode,
        deviceInfo,
      });
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event: string, handler: MessageHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: MessageHandler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emitLocal(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentContext = null;
  }
}

export const socket = new RealtimeSocketClient();

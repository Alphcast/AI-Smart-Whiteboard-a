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

  // HTTP polling fallback for serverless environments (e.g. Vercel)
  private pollingInterval: any = null;
  private lastPolledTimestamp = 0;
  private isFallbackMode = false;
  private activeRemoteSessionId: string | null = null;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isFallbackMode = false;
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
        this.enableFallbackPolling();

        if (this.shouldReconnect) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => this.connect(), 4000);
        }
      };

      this.ws.onerror = () => {
        // In serverless hosts like Vercel, native WebSockets to server.ts are not available
        this.enableFallbackPolling();
      };
    } catch {
      this.enableFallbackPolling();
    }
  }

  private enableFallbackPolling() {
    if (this.isFallbackMode) return;
    this.isFallbackMode = true;

    // Start background HTTP event polling for the active remote session if one is bound
    if (this.activeRemoteSessionId && !this.pollingInterval) {
      this.startPolling();
    }
  }

  private startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.lastPolledTimestamp = Date.now() - 5000;

    this.pollingInterval = setInterval(async () => {
      if (!this.activeRemoteSessionId) return;

      try {
        const res = await fetch(
          `/api/remote/sessions/${this.activeRemoteSessionId}/events?since=${this.lastPolledTimestamp}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          if (json.serverTime) {
            this.lastPolledTimestamp = json.serverTime;
          }
          for (const ev of json.data) {
            const payload = ev.payload || {};
            const type = ev.type || payload.type;
            if (type) {
              this.emitLocal(type, { type, ...payload });
            }
          }
        }
      } catch {
        // Serverless polling retry
      }
    }, 250); // fast 250ms polling loop provides instant, fluid touchpad response
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
    this.activeRemoteSessionId = sessionId;
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

    // Always start fallback polling alongside socket so connection never drops on Vercel
    this.startPolling();
  }

  send(data: any) {
    // 1. Send via WebSocket if alive
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }

    // 2. Also send via HTTP event buffer when in remote session to guarantee delivery on serverless
    if (this.activeRemoteSessionId && data.type) {
      fetch(`/api/remote/sessions/${this.activeRemoteSessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: data.type, payload: data }),
      }).catch(() => {});
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

  emitLocal(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.reconnectTimeout);
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentContext = null;
    this.activeRemoteSessionId = null;
    this.isFallbackMode = false;
  }
}

export const socket = new RealtimeSocketClient();

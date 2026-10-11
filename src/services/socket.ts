/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { io, Socket } from 'socket.io-client';

type MessageHandler = (data: any) => void;

class RealtimeSocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private isConnectedState = false;
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

  private currentContext: {
    type: 'board' | 'remote';
    payload: any;
  } | null = null;

  // HTTP polling fallback for maximum resilience
  private pollingInterval: any = null;
  private lastPolledTimestamp = 0;
  private activeRemoteSessionId: string | null = null;

  connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      return this.socket;
    }

    this.connectionStatus = 'connecting';
    this.emitLocal('connection:status', { status: 'connecting' });

    // Determine target URL for socket.io
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    this.socket = io(origin, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnectedState = true;
      this.connectionStatus = 'connected';
      this.emitLocal('connection:open', {});
      this.emitLocal('connection:status', { status: 'connected' });

      // Re-send context if any (rejoining board or remote session)
      if (this.currentContext) {
        if (this.currentContext.type === 'board') {
          this.socket?.emit('board:join', this.currentContext.payload);
        } else if (this.currentContext.type === 'remote') {
          this.socket?.emit('remote:bind', this.currentContext.payload);
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnectedState = false;
      this.connectionStatus = 'disconnected';
      this.emitLocal('connection:close', { reason });
      this.emitLocal('connection:status', { status: 'disconnected', reason });

      // If remote session is active, enable polling fallback during socket reconnection
      if (this.activeRemoteSessionId && !this.pollingInterval) {
        this.startPolling();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.isConnectedState = false;
      this.connectionStatus = 'disconnected';
      this.emitLocal('connection:error', { error });
      this.emitLocal('connection:status', { status: 'disconnected', error });

      if (this.activeRemoteSessionId && !this.pollingInterval) {
        this.startPolling();
      }
    });

    // Forward any wildcard/known events to registered local listeners
    const knownEvents = [
      'board:joined',
      'collaborator:joined',
      'collaborator:left',
      'board:cursor',
      'board:object_create',
      'board:object_update',
      'board:object_delete',
      'board:page_change',
      'remote:connected',
      'remote:phone_paired',
      'remote:phone_disconnected',
      'remote:status',
      'remote:error',
      'remote:stroke_start',
      'remote:stroke_point',
      'remote:stroke_end',
      'remote:pointer',
      'remote:action',
      'remote:equation_solve',
      'remote:tool_change',
    ];

    knownEvents.forEach((ev) => {
      this.socket?.on(ev, (data) => {
        this.emitLocal(ev, data);
        this.emitLocal('*', { type: ev, ...data });
      });
    });

    return this.socket;
  }

  joinBoard(boardId: string, user: { name: string; color: string }) {
    this.currentContext = {
      type: 'board',
      payload: { boardId, userName: user.name, color: user.color },
    };
    const s = this.connect();
    if (s.connected) {
      s.emit('board:join', this.currentContext.payload);
    }
  }

  bindRemote(sessionId: string, role: 'controller' | 'display', passcode?: string, deviceInfo?: string) {
    this.activeRemoteSessionId = sessionId;
    this.currentContext = {
      type: 'remote',
      payload: { sessionId, role, passcode, deviceInfo },
    };

    const s = this.connect();
    if (s.connected) {
      s.emit('remote:bind', this.currentContext.payload);
    }

    // Secondary HTTP fallback polling
    this.startPolling();
  }

  emit(event: string, data: any) {
    const s = this.connect();
    s.emit(event, data);

    // Also send via HTTP event buffer when in remote session to guarantee delivery
    if (this.activeRemoteSessionId && event.startsWith('remote:')) {
      fetch(`/api/remote/sessions/${this.activeRemoteSessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: event, payload: data }),
      }).catch(() => {});
    }
  }

  send(data: any) {
    const eventType = data?.type || 'message';
    this.emit(eventType, data);
  }

  on(event: string, handler: MessageHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // If socket is already initialized and it's a custom event not in knownEvents, attach directly too
    if (this.socket) {
      this.socket.on(event, handler);
    }

    return () => this.off(event, handler);
  }

  off(event: string, handler: MessageHandler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  emitLocal(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || this.isConnectedState;
  }

  getStatus(): 'connected' | 'connecting' | 'disconnected' {
    return this.connectionStatus;
  }

  private startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.lastPolledTimestamp = Date.now() - 3000;

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
        // Silent fallback
      }
    }, 300);
  }

  disconnect() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnectedState = false;
    this.connectionStatus = 'disconnected';
    this.currentContext = null;
    this.activeRemoteSessionId = null;
  }
}

export const socket = new RealtimeSocketClient();

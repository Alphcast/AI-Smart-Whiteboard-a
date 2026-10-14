/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { io, Socket } from 'socket.io-client';
import Peer, { DataConnection } from 'peerjs';

export type MessageHandler = (data: any) => void;

export interface DiagnosticEventItem {
  id: string;
  timestamp: number;
  timeStr: string;
  source: 'webrtc' | 'socketio' | 'broadcast' | 'http' | 'system';
  type: string;
  data: any;
  direction: 'in' | 'out';
}

// Resilient ICE servers combining Google STUN and OpenRelay TURN for carrier/cellular NAT penetration
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelay',
    credential: 'openrelay',
  },
];

class RealtimeSocketClient {
  private socket: Socket | null = null;
  private peer: Peer | null = null;
  private p2pConnection: DataConnection | null = null;
  private p2pConnections: Set<DataConnection> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private diagnosticListeners: Set<(event: DiagnosticEventItem) => void> = new Set();

  private isConnectedState = false;
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private lastHeartbeatTime = Date.now();
  private lastPingSent = 0;
  private pingLatencyMs: number | null = null;

  // Diagnostic metrics
  private totalPacketsSent = 0;
  private totalPacketsReceived = 0;
  private eventHistory: DiagnosticEventItem[] = [];
  private maxHistoryLength = 150;

  private currentContext: {
    type: 'board' | 'remote' | 'lesson';
    payload: any;
  } | null = null;

  // Reconnection and retry timers
  private clientRetryTimeout: any = null;
  private clientRetryCount = 0;
  private hostRetryTimeout: any = null;

  // HTTP polling fallback for serverless Vercel
  private pollingInterval: any = null;
  private lastPolledTimestamp = 0;
  private activeRemoteSessionId: string | null = null;
  private activePasscode: string | null = null;
  private activeRole: 'controller' | 'display' | null = null;

  // ----------------------- DIAGNOSTIC LOGGING LAYER -----------------------
  public recordDiagnostic(
    source: 'webrtc' | 'socketio' | 'broadcast' | 'http' | 'system',
    type: string,
    data: any,
    direction: 'in' | 'out' = 'in'
  ) {
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString() + '.' + String(now % 1000).padStart(3, '0');
    const item: DiagnosticEventItem = {
      id: `diag-${now}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      timeStr,
      source,
      type,
      data,
      direction,
    };

    if (direction === 'in') {
      this.totalPacketsReceived += 1;
    } else {
      this.totalPacketsSent += 1;
    }

    this.eventHistory.push(item);
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.shift();
    }

    this.diagnosticListeners.forEach((listener) => {
      try {
        listener(item);
      } catch {
        // ignore
      }
    });
  }

  public onDiagnosticEvent(listener: (event: DiagnosticEventItem) => void) {
    this.diagnosticListeners.add(listener);
    return () => {
      this.diagnosticListeners.delete(listener);
    };
  }

  public getDiagnosticHistory(): DiagnosticEventItem[] {
    return [...this.eventHistory];
  }

  public clearDiagnosticHistory() {
    this.eventHistory = [];
  }

  // ----------------------- SOCKET.IO CONNECTION -----------------------
  connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      return this.socket;
    }

    this.connectionStatus = 'connecting';
    this.emitLocal('connection:status', { status: 'connecting' });
    this.recordDiagnostic('socketio', 'socket:connecting', { url: window.location.origin });

    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    try {
      this.socket = io(origin, {
        path: '/socket.io/',
        // Explicit support for HTTP long-polling fallback to guarantee stability on restrictive networks like Vercel serverless
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 15000,
      });

      this.socket.on('connect', () => {
        this.isConnectedState = true;
        this.connectionStatus = 'connected';
        this.lastHeartbeatTime = Date.now();
        const transport = this.socket?.io?.engine?.transport?.name || 'unknown';

        this.recordDiagnostic('socketio', 'socket:connect', {
          socketId: this.socket?.id,
          transport,
        });

        this.emitLocal('socket:connect', {
          socketId: this.socket?.id,
          transport,
          timestamp: Date.now(),
        });
        this.emitLocal('connection:open', {});
        this.emitLocal('connection:status', { status: 'connected', transport });

        if (this.currentContext) {
          if (this.currentContext.type === 'board') {
            this.socket?.emit('board:join', this.currentContext.payload);
          } else if (this.currentContext.type === 'remote') {
            this.socket?.emit('remote:bind', this.currentContext.payload);
          } else if (this.currentContext.type === 'lesson') {
            this.socket?.emit('lesson:join', this.currentContext.payload);
          }
        }
      });

      // Track Engine.IO transport upgrades and packet heartbeats
      this.socket.io.engine?.on('upgrade', (transport: any) => {
        this.recordDiagnostic('socketio', 'socket:transport_upgrade', { transport: transport?.name });
        this.emitLocal('socket:transport_upgrade', {
          transport: transport?.name,
          timestamp: Date.now(),
        });
      });

      this.socket.io.engine?.on('packet', (packet: any) => {
        if (packet.type === 'ping' || packet.type === 'pong') {
          this.lastHeartbeatTime = Date.now();
          if (packet.type === 'pong' && this.lastPingSent > 0) {
            this.pingLatencyMs = Date.now() - this.lastPingSent;
          }
          this.recordDiagnostic('socketio', `socket:heartbeat_${packet.type}`, {
            type: packet.type,
            latencyMs: this.pingLatencyMs,
          });
          this.emitLocal('socket:heartbeat', {
            type: packet.type,
            timestamp: Date.now(),
            latencyMs: this.pingLatencyMs,
            transport: this.socket?.io?.engine?.transport?.name || 'unknown',
          });
        }
      });

      this.socket.io.on('ping', () => {
        this.lastPingSent = Date.now();
        this.lastHeartbeatTime = Date.now();
        this.emitLocal('socket:heartbeat', {
          type: 'ping',
          timestamp: Date.now(),
        });
      });

      this.socket.io.on('reconnect_attempt', (attempt: number) => {
        this.recordDiagnostic('socketio', 'socket:reconnect_attempt', { attempt });
        this.emitLocal('socket:reconnect_attempt', {
          attempt,
          timestamp: Date.now(),
        });
      });

      this.socket.io.on('reconnect_error', (error: any) => {
        this.recordDiagnostic('socketio', 'socket:reconnect_error', { error: error?.message || error });
        this.emitLocal('socket:reconnect_error', {
          error: error?.message || error,
          timestamp: Date.now(),
        });
      });

      this.socket.on('disconnect', (reason) => {
        this.recordDiagnostic('socketio', 'socket:disconnect', { reason });
        this.emitLocal('socket:disconnect', {
          reason,
          timestamp: Date.now(),
        });

        if (this.p2pConnections.size === 0 && !this.p2pConnection?.open) {
          this.isConnectedState = false;
          this.connectionStatus = 'disconnected';
          this.emitLocal('connection:close', { reason });
          this.emitLocal('connection:status', { status: 'disconnected', reason });
        }

        if (this.activeRemoteSessionId && !this.pollingInterval) {
          this.startPolling();
        }
      });

      this.socket.on('connect_error', (error) => {
        // Explicitly enforce polling transport fallback when connecting fails or websocket is blocked
        if (this.socket && (this.socket as any).io?.opts) {
          (this.socket as any).io.opts.transports = ['polling', 'websocket'];
        }
        this.recordDiagnostic('socketio', 'socket:error', { error: error?.message || error });
        this.emitLocal('socket:error', {
          error: error?.message || error,
          timestamp: Date.now(),
        });

        if (this.p2pConnections.size === 0 && !this.p2pConnection?.open) {
          this.emitLocal('connection:status', { status: 'connecting', error });
        }

        if (this.activeRemoteSessionId && !this.pollingInterval) {
          this.startPolling();
        }
      });

      const knownEvents = [
        'board:joined',
        'collaborator:joined',
        'collaborator:left',
        'board:cursor',
        'board:object_create',
        'board:object_update',
        'board:object_delete',
        'board:clear',
        'board:page_change',
        'lesson:joined',
        'lesson:participants_updated',
        'lesson:permissions_updated',
        'lesson:cursor',
        'lesson:summary_ready',
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
          this.recordDiagnostic('socketio', ev, data, 'in');
          this.emitLocal(ev, data);
          this.emitLocal('*', { type: ev, ...data });
        });
      });
    } catch (err: any) {
      this.recordDiagnostic('socketio', 'socket:init_exception', { error: err?.message || err });
    }

    return this.socket!;
  }

  joinBoard(boardId: string, user: { name: string; color: string }) {
    this.currentContext = {
      type: 'board',
      payload: { boardId, userName: user.name, color: user.color },
    };
    const s = this.connect();
    if (s?.connected) {
      s.emit('board:join', this.currentContext.payload);
    }
  }

  joinLesson(lessonId: string, user: { userId?: string; userName: string; role: 'teacher' | 'student'; color: string }) {
    this.currentContext = {
      type: 'lesson',
      payload: {
        lessonId,
        userId: user.userId,
        userName: user.userName,
        role: user.role,
        color: user.color,
      },
    };
    const s = this.connect();
    if (s?.connected) {
      s.emit('lesson:join', this.currentContext.payload);
    }
  }

  sendLessonCursor(lessonId: string, x: number, y: number) {
    const s = this.connect();
    if (s?.connected) {
      s.emit('board:cursor', { x, y });
    }
  }

  updateLessonPermissions(lessonId: string, collaborationMode: string, studentPermissions?: Record<string, boolean>) {
    const s = this.connect();
    if (s?.connected) {
      s.emit('lesson:update_permissions', { lessonId, collaborationMode, studentPermissions });
    }
  }

  clearBoard(pageId: string) {
    const s = this.connect();
    if (s?.connected) {
      s.emit('board:clear', { pageId });
    }
  }

  // Bind remote session with WebRTC P2P (PeerJS) + BroadcastChannel + Socket.IO + HTTP Polling
  bindRemote(sessionId: string, role: 'controller' | 'display', passcode?: string, deviceInfo?: string) {
    this.activeRemoteSessionId = sessionId;
    this.activePasscode = passcode || null;
    this.activeRole = role;

    this.currentContext = {
      type: 'remote',
      payload: { sessionId, role, passcode, deviceInfo },
    };

    this.recordDiagnostic('system', 'remote:bind', { sessionId, role, passcode });

    // 1. Socket.IO connection
    const s = this.connect();
    if (s?.connected) {
      s.emit('remote:bind', this.currentContext.payload);
    }

    // 2. BroadcastChannel for instant local / multi-tab / same-origin communication
    if (passcode) {
      this.initBroadcastChannel(passcode, role);
    }

    // 3. Initialize WebRTC P2P DataChannel via PeerJS for 100% serverless/Vercel support
    if (passcode) {
      if (role === 'display') {
        this.initDisplayPeer(passcode);
      } else if (role === 'controller') {
        this.initControllerPeer(passcode, deviceInfo);
      }
    }

    // 4. Secondary HTTP fallback polling
    this.startPolling();
  }

  // ----------------------- BROADCAST CHANNEL (LOCAL/TAB SYNC) -----------------------
  private initBroadcastChannel(passcode: string, role: 'controller' | 'display') {
    try {
      if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
      if (this.broadcastChannel) {
        this.broadcastChannel.close();
      }

      const cleanCode = passcode.trim().toLowerCase();
      this.broadcastChannel = new BroadcastChannel(`wb-bc-${cleanCode}`);

      this.broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        // Controller sends to display, display sends to controller
        if (data._senderRole === role) return;

        this.recordDiagnostic('broadcast', data.type || 'broadcast:msg', data, 'in');

        if (data.type === 'remote:handshake' && role === 'display') {
          this.isConnectedState = true;
          this.connectionStatus = 'connected';
          this.emitLocal('remote:phone_paired', {
            sessionId: this.activeRemoteSessionId,
            transport: 'broadcast-channel',
            deviceInfo: data.deviceInfo || 'Local Browser Tab',
          });
          this.emitLocal('remote:status', { isPaired: true, connectedControllers: 1 });
          this.emitLocal('connection:status', { status: 'connected' });
          return;
        }

        const type = data.type || (data.payload && data.payload.type);
        if (type) {
          this.emitLocal(type, data);
          this.emitLocal('*', data);
        }
      };

      if (role === 'controller') {
        // Send initial broadcast handshake
        setTimeout(() => {
          this.broadcastChannel?.postMessage({
            type: 'remote:handshake',
            _senderRole: 'controller',
            deviceInfo: navigator.userAgent,
          });
        }, 100);
      }
    } catch {
      // ignore
    }
  }

  // ----------------------- WEBRTC HOST PEER (WHITEBOARD DISPLAY) -----------------------
  private initDisplayPeer(passcode: string) {
    try {
      const cleanCode = passcode.trim().toLowerCase();
      const peerId = `wb-smart-${cleanCode}`;

      // If peer already exists, is open, and has the matching ID, keep it!
      if (this.peer && !this.peer.destroyed && this.peer.id === peerId) {
        this.recordDiagnostic('webrtc', 'p2p:host_reused', { peerId });
        return;
      }

      if (this.peer) {
        try {
          this.peer.destroy();
        } catch {
          // ignore
        }
        this.peer = null;
      }

      this.recordDiagnostic('webrtc', 'p2p:init_host', { peerId, role: 'display' });
      this.emitLocal('p2p:init_host', { peerId, role: 'display' });

      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
        },
      });

      this.peer.on('open', (id) => {
        this.recordDiagnostic('webrtc', 'p2p:host_ready', { peerId: id });
        this.emitLocal('p2p:host_ready', { peerId: id, timestamp: Date.now() });
      });

      this.peer.on('connection', (conn) => {
        this.recordDiagnostic('webrtc', 'p2p:incoming_connection', { peerId: conn.peer });
        this.emitLocal('p2p:incoming_connection', { peerId: conn.peer, timestamp: Date.now() });
        this.p2pConnections.add(conn);

        conn.on('open', () => {
          this.isConnectedState = true;
          this.connectionStatus = 'connected';
          this.recordDiagnostic('webrtc', 'p2p:handshake_success', {
            peerId: conn.peer,
            role: 'display',
          });
          this.emitLocal('p2p:handshake_success', {
            peerId: conn.peer,
            role: 'display',
            timestamp: Date.now(),
          });
          this.emitLocal('remote:phone_paired', {
            sessionId: this.activeRemoteSessionId,
            peerId: conn.peer,
            deviceInfo: 'Smartphone (WebRTC P2P Direct)',
          });
          this.emitLocal('remote:status', { isPaired: true, connectedControllers: this.p2pConnections.size });
          this.emitLocal('connection:status', { status: 'connected' });
        });

        conn.on('data', (data: any) => {
          this.recordDiagnostic('webrtc', data?.type || 'p2p:data', data, 'in');
          this.handleIncomingP2P(data);
        });

        conn.on('close', () => {
          this.p2pConnections.delete(conn);
          this.recordDiagnostic('webrtc', 'p2p:connection_closed', { peerId: conn.peer });
          this.emitLocal('p2p:connection_closed', { peerId: conn.peer, timestamp: Date.now() });
          if (this.p2pConnections.size === 0) {
            this.emitLocal('remote:phone_disconnected', {});
            this.emitLocal('remote:status', { isPaired: false, connectedControllers: 0 });
          }
        });

        conn.on('error', (err: any) => {
          this.p2pConnections.delete(conn);
          this.recordDiagnostic('webrtc', 'p2p:connection_error', { peerId: conn.peer, error: err?.message || err });
          this.emitLocal('p2p:connection_error', { peerId: conn.peer, error: err?.message || err });
        });
      });

      this.peer.on('error', (err: any) => {
        this.recordDiagnostic('webrtc', 'p2p:host_error', {
          type: err?.type,
          error: err?.message || err,
        });
        this.emitLocal('p2p:host_error', {
          type: err?.type,
          error: err?.message || err,
          timestamp: Date.now(),
        });

        if (err.type === 'unavailable-id') {
          if (this.hostRetryTimeout) clearTimeout(this.hostRetryTimeout);
          this.hostRetryTimeout = setTimeout(() => {
            if (this.activeRole === 'display' && this.activePasscode) {
              this.initDisplayPeer(this.activePasscode);
            }
          }, 3500);
        }
      });
    } catch (e: any) {
      this.recordDiagnostic('webrtc', 'p2p:host_exception', { error: e?.message || e });
      this.emitLocal('p2p:host_error', { error: e?.message || e });
    }
  }

  // ----------------------- WEBRTC CLIENT PEER (SMARTPHONE CONTROLLER) -----------------------
  private initControllerPeer(passcode: string, deviceInfo?: string) {
    try {
      if (this.clientRetryTimeout) {
        clearTimeout(this.clientRetryTimeout);
        this.clientRetryTimeout = null;
      }

      if (this.peer && !this.peer.destroyed) {
        try {
          this.peer.destroy();
        } catch {
          // ignore
        }
        this.peer = null;
      }

      const cleanCode = passcode.trim().toLowerCase();
      const targetHostPeerId = `wb-smart-${cleanCode}`;

      this.recordDiagnostic('webrtc', 'p2p:init_client', { targetHost: targetHostPeerId, role: 'controller' });
      this.emitLocal('p2p:init_client', { targetHost: targetHostPeerId, role: 'controller' });

      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
        },
      });

      this.peer.on('open', (clientId) => {
        this.recordDiagnostic('webrtc', 'p2p:client_ready', { clientId, targetHost: targetHostPeerId });
        this.emitLocal('p2p:client_ready', { clientId, targetHost: targetHostPeerId });

        const connectToHost = () => {
          if (!this.peer || this.peer.destroyed) return;
          this.clientRetryCount += 1;

          this.recordDiagnostic('webrtc', 'p2p:handshake_started', {
            targetHost: targetHostPeerId,
            attempt: this.clientRetryCount,
          });
          this.emitLocal('p2p:handshake_started', {
            targetHost: targetHostPeerId,
            attempt: this.clientRetryCount,
          });

          const conn = this.peer.connect(targetHostPeerId, {
            reliable: true,
          });

          this.p2pConnection = conn;

          conn.on('open', () => {
            this.clientRetryCount = 0;
            this.isConnectedState = true;
            this.connectionStatus = 'connected';
            this.recordDiagnostic('webrtc', 'p2p:handshake_success', {
              targetHost: targetHostPeerId,
              role: 'controller',
            });
            this.emitLocal('p2p:handshake_success', {
              targetHost: targetHostPeerId,
              role: 'controller',
              transport: 'webrtc-p2p',
              timestamp: Date.now(),
            });
            this.emitLocal('remote:connected', {
              sessionId: this.activeRemoteSessionId,
              role: 'controller',
              transport: 'webrtc-p2p',
            });
            this.emitLocal('remote:status', { isPaired: true });
            this.emitLocal('connection:status', { status: 'connected' });

            conn.send({
              type: 'remote:handshake',
              deviceInfo: deviceInfo || navigator.userAgent,
            });
          });

          conn.on('data', (data: any) => {
            this.recordDiagnostic('webrtc', data?.type || 'p2p:data', data, 'in');
            this.handleIncomingP2P(data);
          });

          conn.on('close', () => {
            this.recordDiagnostic('webrtc', 'p2p:connection_closed', { targetHost: targetHostPeerId });
            this.emitLocal('p2p:connection_closed', { targetHost: targetHostPeerId });
            this.p2pConnection = null;
            if (this.clientRetryCount < 20) {
              this.clientRetryTimeout = setTimeout(connectToHost, 2000);
            }
          });

          conn.on('error', (err: any) => {
            this.recordDiagnostic('webrtc', 'p2p:connection_error', {
              targetHost: targetHostPeerId,
              error: err?.message || err,
            });
            this.emitLocal('p2p:connection_error', {
              targetHost: targetHostPeerId,
              error: err?.message || err,
            });
            this.p2pConnection = null;
            if (this.clientRetryCount < 20) {
              this.clientRetryTimeout = setTimeout(connectToHost, 2500);
            }
          });
        };

        connectToHost();
      });

      this.peer.on('error', (err: any) => {
        this.recordDiagnostic('webrtc', 'p2p:client_error', {
          type: err?.type,
          error: err?.message || err,
        });
        this.emitLocal('p2p:client_error', {
          type: err?.type,
          error: err?.message || err,
          timestamp: Date.now(),
        });

        // If target host isn't online yet (user scanned QR before laptop connected to signaling server),
        // automatically retry with backoff so it pairs seamlessly as soon as host is registered!
        if (err.type === 'peer-unavailable') {
          if (this.clientRetryTimeout) clearTimeout(this.clientRetryTimeout);
          this.clientRetryTimeout = setTimeout(() => {
            if (this.peer && !this.peer.destroyed) {
              this.recordDiagnostic('webrtc', 'p2p:retrying_peer_unavailable', { targetHost: targetHostPeerId });
              const conn = this.peer.connect(targetHostPeerId, { reliable: true });
              this.p2pConnection = conn;
            }
          }, 2500);
        }
      });
    } catch (e: any) {
      this.recordDiagnostic('webrtc', 'p2p:client_exception', { error: e?.message || e });
      this.emitLocal('p2p:client_error', { error: e?.message || e });
    }
  }

  private handleIncomingP2P(data: any) {
    if (!data) return;
    const type = data.type || (data.payload && data.payload.type);
    if (type) {
      this.emitLocal(type, data);
      this.emitLocal('*', data);
    }
  }

  // ----------------------- SEND / EMIT API -----------------------
  emit(event: string, data: any) {
    const payload = { type: event, ...data };
    let sentVia = false;

    // 1. Send via WebRTC P2P DataChannel (instant < 5ms direct browser-to-browser)
    if (this.p2pConnection && this.p2pConnection.open) {
      try {
        this.p2pConnection.send(payload);
        this.recordDiagnostic('webrtc', event, data, 'out');
        sentVia = true;
      } catch {
        // fallback
      }
    }

    if (this.p2pConnections.size > 0) {
      this.p2pConnections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(payload);
            this.recordDiagnostic('webrtc', event, data, 'out');
            sentVia = true;
          } catch {
            // fallback
          }
        }
      });
    }

    // 2. Send via BroadcastChannel (local / tab sync)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          ...payload,
          _senderRole: this.activeRole,
        });
        if (!sentVia) {
          this.recordDiagnostic('broadcast', event, data, 'out');
          sentVia = true;
        }
      } catch {
        // ignore
      }
    }

    // 3. Send via Socket.IO
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      if (!sentVia) {
        this.recordDiagnostic('socketio', event, data, 'out');
        sentVia = true;
      }
    }

    // 4. Send via HTTP event buffer when in remote session
    if (this.activeRemoteSessionId && event.startsWith('remote:')) {
      fetch(`/api/remote/sessions/${this.activeRemoteSessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: event, payload: data }),
      })
        .then(() => {
          if (!sentVia) {
            this.recordDiagnostic('http', event, data, 'out');
          }
        })
        .catch(() => {});
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
    const isP2P = (this.p2pConnection && this.p2pConnection.open) || this.p2pConnections.size > 0;
    const isSocket = this.socket?.connected || false;
    return Boolean(isP2P || isSocket || this.isConnectedState);
  }

  getStatus(): 'connected' | 'connecting' | 'disconnected' {
    return this.connectionStatus;
  }

  // Send a diagnostic test ping to verify round-trip
  sendTestPing() {
    const now = Date.now();
    this.emit('remote:ping_test', { clientTime: now });
    this.recordDiagnostic('system', 'remote:ping_test_sent', { clientTime: now }, 'out');
  }

  // Force reconnect WebRTC P2P
  reconnectWebRTC() {
    this.recordDiagnostic('system', 'p2p:force_reconnect', { role: this.activeRole });
    if (this.activePasscode && this.activeRole) {
      if (this.activeRole === 'display') {
        this.initDisplayPeer(this.activePasscode);
      } else if (this.activeRole === 'controller') {
        this.initControllerPeer(this.activePasscode);
      }
    }
  }

  getDiagnostics() {
    const isP2POpen = Boolean(
      (this.p2pConnection && this.p2pConnection.open) || this.p2pConnections.size > 0
    );

    let primaryTransport = 'none';
    if (isP2POpen) primaryTransport = 'webrtc-p2p';
    else if (this.socket?.connected)
      primaryTransport = `socket.io (${this.socket?.io?.engine?.transport?.name || 'unknown'})`;
    else if (this.pollingInterval) primaryTransport = 'http-polling';

    return {
      isVercel: typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'),
      hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      connectionStatus: this.connectionStatus,
      lastHeartbeatTime: this.lastHeartbeatTime,
      primaryTransport,
      socketIO: {
        connected: this.socket?.connected || false,
        socketId: this.socket?.id || null,
        transport: this.socket?.io?.engine?.transport?.name || 'none',
        pingLatencyMs: this.pingLatencyMs,
      },
      webRTC: {
        peerId: this.peer?.id || null,
        isDestroyed: this.peer?.destroyed || false,
        role: this.activeRole,
        activeDataConnections:
          this.activeRole === 'display'
            ? this.p2pConnections.size
            : this.p2pConnection?.open
            ? 1
            : 0,
        isP2POpen,
      },
      broadcastChannel: {
        active: Boolean(this.broadcastChannel),
      },
      session: {
        sessionId: this.activeRemoteSessionId,
        passcode: this.activePasscode,
      },
      metrics: {
        totalPacketsSent: this.totalPacketsSent,
        totalPacketsReceived: this.totalPacketsReceived,
        lastHeartbeatTime: this.lastHeartbeatTime,
        historyCount: this.eventHistory.length,
      },
    };
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
              this.recordDiagnostic('http', type, payload, 'in');
              this.emitLocal(type, { type, ...payload });
            }
          }
        }
      } catch {
        // Silent fallback
      }
    }, 250);
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
    if (this.p2pConnection) {
      this.p2pConnection.close();
      this.p2pConnection = null;
    }
    this.p2pConnections.forEach((c) => c.close());
    this.p2pConnections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.isConnectedState = false;
    this.connectionStatus = 'disconnected';
    this.currentContext = null;
    this.activeRemoteSessionId = null;
    this.activePasscode = null;
    this.activeRole = null;
  }
}

export const socket = new RealtimeSocketClient();

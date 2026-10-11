/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Pen,
  Eraser,
  MousePointer,
  Sparkles,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Radio,
  CheckCircle2,
  RotateCcw,
  Plus,
  Sigma,
  Loader2,
  KeyRound,
  Wifi,
  WifiOff,
  Crosshair,
  ArrowUpLeft,
  Sliders,
  Gauge,
  HelpCircle,
} from 'lucide-react';
import { socket } from '../../services/socket';
import { api } from '../../services/api';

interface PhoneRemoteControllerProps {
  sessionId?: string;
  passcode?: string;
  onExit?: () => void;
}

export const PhoneRemoteController: React.FC<PhoneRemoteControllerProps> = ({
  sessionId: initialSessionId,
  passcode: initialPasscode,
  onExit,
}) => {
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSessionId || '');
  const [activePasscode, setActivePasscode] = useState<string>(initialPasscode || '');
  const [inputCode, setInputCode] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showPhoneDiag, setShowPhoneDiag] = useState(false);

  // Controller Mode: 'touchpad' (trackpad writing & cursor) vs 'draw' (full handwriting screen)
  const [controlMode, setControlMode] = useState<'touchpad' | 'draw'>('touchpad');

  // Touchpad Action: 'draw' (drag on touchpad to draw on whiteboard!) vs 'cursor' (pointer) vs 'laser' (laser beam)
  const [touchpadAction, setTouchpadAction] = useState<'draw' | 'cursor' | 'laser'>('draw');

  // Drawing settings
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#2563eb');
  const [strokeSize, setStrokeSize] = useState<number>(5);

  // Touch Pressure & Sensitivity settings
  const [pressureEnabled, setPressureEnabled] = useState<boolean>(true);
  const [pressureSensitivity, setPressureSensitivity] = useState<number>(1.2); // 0.4 (subtle) to 2.5 (extreme)
  const [minStrokeScale, setMinStrokeScale] = useState<number>(0.3); // minimum stroke fraction
  const [maxStrokeScale, setMaxStrokeScale] = useState<number>(2.4); // maximum stroke multiplier
  const [pressureCurve, setPressureCurve] = useState<'linear' | 'ease-in' | 'expressive'>('expressive');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [liveTouchPressure, setLiveTouchPressure] = useState<number>(0);
  const lastTouchTime = useRef<number>(0);
  const smoothedPressure = useRef<number>(1.0);

  // Real-time Transmission Activity
  const [isTransmitting, setIsTransmitting] = useState(false);
  const transmitTimeoutRef = useRef<any>(null);
  const [txPacketsCount, setTxPacketsCount] = useState(0);

  // Quick Math Equation Tool on Phone
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [equationText, setEquationText] = useState('2x + 5 = 15');
  const [equationSolution, setEquationSolution] = useState<any>(null);
  const [isSolving, setIsSolving] = useState(false);

  // Canvas refs for phone handwriting surface
  const phoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPhonePointerDown = useRef(false);
  const currentPhoneStroke = useRef<{ x: number; y: number }[]>([]);

  // Trackpad refs
  const trackpadCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const isTouchpadDown = useRef(false);
  const virtualCursor = useRef<{ x: number; y: number }>({ x: 700, y: 400 });
  const touchTrail = useRef<{ x: number; y: number; age: number }[]>([]);

  // Whiteboard origin for handwriting surface
  const writeOrigin = useRef<{ x: number; y: number }>({ x: 200, y: 150 });

  const triggerHaptic = useCallback((ms = 15) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore
    }
  }, []);

  const pulseTransmitting = useCallback(() => {
    setIsTransmitting(true);
    setTxPacketsCount((c) => c + 1);
    if (transmitTimeoutRef.current) clearTimeout(transmitTimeoutRef.current);
    transmitTimeoutRef.current = setTimeout(() => {
      setIsTransmitting(false);
    }, 250);
  }, []);

  // Calculate normalized stroke pressure multiplier based on touch pressure, contact radius, and sensitivity curves
  const computeNormalizedPressure = useCallback(
    (touch: React.Touch, dx = 0, dy = 0, dt = 16): number => {
      if (!pressureEnabled) return 1.0;

      let rawPressure = 0.5;

      const extendedTouch = touch as any;

      // 1. Hardware Force / Pressure API (Supported by iOS 3D Touch, Apple Pencil, modern Android styluses & screens)
      if (typeof extendedTouch.force === 'number' && extendedTouch.force > 0) {
        rawPressure = extendedTouch.force; // 0.0 to 1.0
      } else {
        // 2. Touch Contact Area estimation (radiusX & radiusY)
        const rx = (extendedTouch.radiusX as number) || 10;
        const ry = (extendedTouch.radiusY as number) || 10;
        const avgRadius = (rx + ry) / 2;
        // Standard finger contact typically ranges from ~8px (light tap) to ~28px (firm press)
        const estimatedFromArea = Math.min(1.0, Math.max(0.1, (avgRadius - 7) / 20));

        // 3. Velocity estimation: Faster strokes are naturally lighter, slower deliberate strokes are firmer
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = dt > 0 ? dist / dt : 0; // px/ms
        const speedFactor = Math.max(0.5, Math.min(1.5, 1.2 - speed * 0.35));

        rawPressure = estimatedFromArea * 0.7 + (1.0 - Math.min(1.0, speed * 0.5)) * 0.3;
      }

      // Smooth pressure with exponential moving average to avoid jittery step-changes
      smoothedPressure.current = smoothedPressure.current * 0.4 + rawPressure * 0.6;
      let p = smoothedPressure.current;

      // Apply pressure curve transformation
      if (pressureCurve === 'ease-in') {
        p = Math.pow(p, 1.6);
      } else if (pressureCurve === 'expressive') {
        // S-curve for rich calligraphic variation between soft strokes and bold accents
        p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      }

      // Scale by user sensitivity preference (0.4x to 2.5x)
      const adjusted = p * pressureSensitivity;

      // Clamp between min and max stroke scale
      const finalScale = Math.max(minStrokeScale, Math.min(maxStrokeScale, adjusted));
      setLiveTouchPressure(finalScale);
      return finalScale;
    },
    [pressureEnabled, pressureSensitivity, minStrokeScale, maxStrokeScale, pressureCurve]
  );
  const logPhone = useCallback((level: 'info' | 'warn' | 'error' | 'debug', msg: string, data?: any) => {
    const time = new Date().toLocaleTimeString();
    const prefix = `[PhoneRemote @ ${time}]`;
    if (level === 'error') {
      console.error(`${prefix} ${msg}`, data !== undefined ? data : '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${msg}`, data !== undefined ? data : '');
    } else if (level === 'debug') {
      console.debug(`${prefix} ${msg}`, data !== undefined ? data : '');
    } else {
      console.info(`${prefix} ${msg}`, data !== undefined ? data : '');
    }
  }, []);

  // Connect to session with immediate WebRTC P2P + Socket binding
  const connectToSession = useCallback(
    async (sessId: string, pass?: string) => {
      setIsConnecting(true);
      setConnectionError(null);

      const effectivePass = (pass || '').trim().toUpperCase();
      const effectiveSess = sessId || `sess-${effectivePass.toLowerCase()}`;

      setActiveSessionId(effectiveSess);
      if (effectivePass) setActivePasscode(effectivePass);

      logPhone('info', '🚀 Initiating phone remote pairing...', {
        sessionId: effectiveSess,
        passcode: effectivePass,
        targetP2PHost: `wb-smart-${effectivePass.toLowerCase()}`,
        isVercel: typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'),
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      });

      // Bind via WebRTC P2P and Socket.IO immediately
      socket.bindRemote(effectiveSess, 'controller', effectivePass || undefined, navigator.userAgent);
      setIsConnected(true);
      triggerHaptic(30);

      try {
        logPhone('debug', 'Fetching session verification metadata from server...');
        const sessionInfo = await api.getRemoteSession(effectiveSess);
        if (sessionInfo?.passcode) {
          setActivePasscode(sessionInfo.passcode);
          logPhone('info', '✅ Session verified with server API:', sessionInfo);
        }
      } catch (apiErr: any) {
        logPhone('warn', '⚠️ API session query unavailable on serverless container (normal on Vercel) - WebRTC P2P direct channel will operate independently:', apiErr?.message || apiErr);
      } finally {
        setIsConnecting(false);
      }
    },
    [triggerHaptic, logPhone]
  );

  // Auto-connect if initialSessionId or passcode provided
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const codeParam = searchParams.get('code') || initialPasscode;
    const sessionParam = searchParams.get('session') || initialSessionId;

    if (sessionParam || codeParam) {
      logPhone('info', 'Auto-connecting from URL parameters:', { session: sessionParam, code: codeParam });
      connectToSession(sessionParam || `sess-${(codeParam || '').toLowerCase()}`, codeParam || undefined);
    }
  }, [initialSessionId, initialPasscode, connectToSession, logPhone]);

  // Handle socket, WebRTC P2P, and heartbeat events with console diagnostic logging
  useEffect(() => {
    logPhone('info', 'Setting up connection event listeners & heartbeat monitors...');

    const unsubConnected = socket.on('remote:connected', (data) => {
      setIsConnected(true);
      setConnectionError(null);
      logPhone('info', '🎉 Connected to whiteboard remote session!', data);
    });

    const unsubStatus = socket.on('remote:status', (data) => {
      logPhone('debug', 'Remote session status update received:', data);
      if (data?.isPaired !== undefined) {
        setIsConnected(data.isPaired);
      } else {
        setIsConnected(true);
      }
    });

    // WebRTC P2P Handshake Tracking
    const unsubP2PStarted = socket.on('p2p:handshake_started', (data) => {
      logPhone('info', '🤝 WebRTC P2P handshake started with target host:', data);
    });

    const unsubP2PSuccess = socket.on('p2p:handshake_success', (data) => {
      logPhone('info', '🟢 WebRTC P2P DataChannel OPEN! Direct low-latency peer-to-peer connection active.', data);
      setIsConnected(true);
      setConnectionError(null);
    });

    const unsubP2PClosed = socket.on('p2p:connection_closed', (data) => {
      logPhone('warn', '⚠️ WebRTC P2P DataChannel closed:', data);
    });

    const unsubP2PError = socket.on('p2p:connection_error', (data) => {
      logPhone('error', '❌ WebRTC P2P connection error:', data);
    });

    const unsubP2PClientError = socket.on('p2p:client_error', (data) => {
      logPhone('error', '❌ WebRTC PeerJS client error:', data);
    });

    // Socket.IO Connection & Heartbeat Tracking
    const unsubSocketConnect = socket.on('socket:connect', (data) => {
      logPhone('info', '🟢 Socket.IO connected to server:', data);
    });

    const unsubSocketHeartbeat = socket.on('socket:heartbeat', (data) => {
      logPhone('debug', '💓 Socket.IO Heartbeat packet:', data);
    });

    const unsubSocketUpgrade = socket.on('socket:transport_upgrade', (data) => {
      logPhone('info', '🚀 Socket.IO transport upgraded:', data);
    });

    const unsubSocketError = socket.on('socket:error', (data) => {
      logPhone('warn', '⚠️ Socket.IO connection error (if on Vercel, serverless function may not support persistent WebSockets; WebRTC P2P will handle data):', data);
    });

    const unsubSocketReconnect = socket.on('socket:reconnect_attempt', (data) => {
      logPhone('debug', '🔄 Socket.IO attempting reconnection...', data);
    });

    const unsubDisconnect = socket.on('remote:disconnect', () => {
      logPhone('warn', 'Remote session disconnect notification received');
      if (!socket.isConnected()) {
        setIsConnected(false);
      }
    });

    const unsubConnClose = socket.on('connection:close', (data) => {
      logPhone('warn', 'Connection closed:', data);
      if (!socket.isConnected()) {
        setIsConnected(false);
      }
    });

    const unsubConnOpen = socket.on('connection:open', () => {
      logPhone('info', 'Underlying connection opened');
      if (activeSessionId) {
        socket.bindRemote(activeSessionId, 'controller', activePasscode || undefined);
        setIsConnected(true);
      }
    });

    const unsubError = socket.on('remote:error', (data) => {
      logPhone('error', '❌ Remote session error event:', data);
      if (!socket.isConnected()) {
        setConnectionError(data.message || 'Remote session error');
        setIsConnected(false);
      }
    });

    // Periodic Heartbeat Status Logger (every 15s) to console
    const heartbeatInterval = setInterval(() => {
      const diag = socket.getDiagnostics();
      logPhone('info', '💓 Socket & P2P Heartbeat Status Check:', {
        status: diag.connectionStatus,
        socketIO: diag.socketIO,
        webRTC: diag.webRTC,
        isVercel: diag.isVercel,
        timeSinceLastHeartbeatMs: Date.now() - diag.lastHeartbeatTime,
      });
    }, 15000);

    return () => {
      clearInterval(heartbeatInterval);
      unsubConnected();
      unsubStatus();
      unsubP2PStarted();
      unsubP2PSuccess();
      unsubP2PClosed();
      unsubP2PError();
      unsubP2PClientError();
      unsubSocketConnect();
      unsubSocketHeartbeat();
      unsubSocketUpgrade();
      unsubSocketError();
      unsubSocketReconnect();
      unsubDisconnect();
      unsubConnClose();
      unsubConnOpen();
      unsubError();
    };
  }, [activeSessionId, activePasscode, logPhone]);

  // Send event via WebRTC DataChannel, Socket.IO, and HTTP fallback
  const sendEvent = useCallback(
    (type: string, payload: any = {}) => {
      pulseTransmitting();
      socket.emit(type, payload);
    },
    [pulseTransmitting]
  );

  // Manual code entry submission
  const handleLookupAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean.length < 4) return;
    setIsConnecting(true);
    setConnectionError(null);

    const fallbackSession = `sess-${clean.toLowerCase()}`;
    await connectToSession(fallbackSession, clean);

    api.lookupSessionByCode(clean).then((found) => {
      if (found?.sessionId) {
        setActiveSessionId(found.sessionId);
      }
    }).catch(() => {
      // Serverless fallback
    });
  };

  // Resize phone drawing canvas
  useEffect(() => {
    if (controlMode !== 'draw') return;

    const canvas = phoneCanvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, [controlMode]);

  // Touch drawing handlers on phone canvas (Mode: Draw)
  const handleDrawStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = phoneCanvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;

    lastTouchTime.current = Date.now();
    isPhonePointerDown.current = true;
    currentPhoneStroke.current = [{ x: px, y: py }];

    const pressure = computeNormalizedPressure(touch, 0, 0, 16);
    const effectiveStrokeWidth = Math.max(1, strokeSize * pressure);

    // Draw locally on phone
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(px, py, effectiveStrokeWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = activeTool === 'eraser' ? '#0f172a' : selectedColor;
      ctx.fill();
    }

    // Map to whiteboard coordinates
    const wbX = writeOrigin.current.x + px * 1.5;
    const wbY = writeOrigin.current.y + py * 1.5;

    triggerHaptic(10);
    sendEvent('remote:stroke_start', {
      x: wbX,
      y: wbY,
      color: activeTool === 'eraser' ? '#ffffff' : selectedColor,
      size: strokeSize * 1.5,
      tool: activeTool,
      pressure,
    });
  };

  const handleDrawMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isPhonePointerDown.current) return;

    const canvas = phoneCanvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;

    const now = Date.now();
    const dt = Math.max(1, now - (lastTouchTime.current || now));
    lastTouchTime.current = now;

    const pts = currentPhoneStroke.current;
    let dx = 0;
    let dy = 0;
    if (pts.length > 0) {
      const prev = pts[pts.length - 1];
      dx = px - prev.x;
      dy = py - prev.y;
    }

    const pressure = computeNormalizedPressure(touch, dx, dy, dt);
    const effectiveStrokeWidth = Math.max(1, strokeSize * pressure);

    if (pts.length > 0) {
      const prev = pts[pts.length - 1];
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = activeTool === 'eraser' ? '#0f172a' : selectedColor;
        ctx.lineWidth = effectiveStrokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }

    pts.push({ x: px, y: py });

    const wbX = writeOrigin.current.x + px * 1.5;
    const wbY = writeOrigin.current.y + py * 1.5;

    sendEvent('remote:stroke_point', {
      x: wbX,
      y: wbY,
      pressure,
    });
  };

  const handleDrawEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isPhonePointerDown.current) return;
    isPhonePointerDown.current = false;

    sendEvent('remote:stroke_end', {});
  };

  // Clear phone writing pad
  const handleClearPhoneCanvas = () => {
    const canvas = phoneCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    triggerHaptic(20);
  };

  // Trackpad Animation & Rendering
  useEffect(() => {
    if (controlMode !== 'touchpad') return;

    let animId: number;
    const renderTrackpadTrail = () => {
      const canvas = trackpadCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw fading touch trails
          for (let i = 0; i < touchTrail.current.length; i++) {
            const p = touchTrail.current[i];
            p.age += 1;
            const alpha = Math.max(0, 1 - p.age / 24);
            ctx.fillStyle =
              touchpadAction === 'laser'
                ? `rgba(239, 68, 68, ${alpha * 0.7})`
                : touchpadAction === 'draw'
                ? `rgba(59, 130, 246, ${alpha * 0.7})`
                : `rgba(148, 163, 184, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, (strokeSize + 4) * (1 - p.age / 32), 0, Math.PI * 2);
            ctx.fill();
          }
          touchTrail.current = touchTrail.current.filter((p) => p.age < 24);
        }
      }
      animId = requestAnimationFrame(renderTrackpadTrail);
    };

    animId = requestAnimationFrame(renderTrackpadTrail);
    return () => cancelAnimationFrame(animId);
  }, [controlMode, touchpadAction, strokeSize]);

  // Touchpad touch handlers (Mode: Touchpad)
  const handleTouchpadStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    lastTouch.current = { x: touch.clientX, y: touch.clientY };
    lastTouchTime.current = Date.now();
    isTouchpadDown.current = true;

    const trackpadRect = e.currentTarget.getBoundingClientRect();
    const localX = touch.clientX - trackpadRect.left;
    const localY = touch.clientY - trackpadRect.top;
    touchTrail.current.push({ x: localX, y: localY, age: 0 });

    const pressure = computeNormalizedPressure(touch, 0, 0, 16);

    triggerHaptic(10);

    if (touchpadAction === 'draw') {
      // START DRAWING ON WHITEBOARD VIA TOUCHPAD!
      sendEvent('remote:stroke_start', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        color: activeTool === 'eraser' ? '#ffffff' : selectedColor,
        size: strokeSize * 1.5,
        tool: activeTool,
        pressure,
      });

      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: 'draw',
        pressure,
      });
    } else {
      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: touchpadAction === 'laser' ? 'laser' : 'move',
        pressure,
      });
    }
  };

  const handleTouchpadMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!lastTouch.current || !isTouchpadDown.current) return;

    const touch = e.touches[0];
    const dx = (touch.clientX - lastTouch.current.x) * 2.3;
    const dy = (touch.clientY - lastTouch.current.y) * 2.3;

    const now = Date.now();
    const dt = Math.max(1, now - (lastTouchTime.current || now));
    lastTouchTime.current = now;

    const pressure = computeNormalizedPressure(touch, dx, dy, dt);

    lastTouch.current = { x: touch.clientX, y: touch.clientY };

    // Update virtual cursor position on whiteboard
    virtualCursor.current.x = Math.max(30, Math.min(2200, virtualCursor.current.x + dx));
    virtualCursor.current.y = Math.max(30, Math.min(1400, virtualCursor.current.y + dy));

    const trackpadRect = e.currentTarget.getBoundingClientRect();
    const localX = touch.clientX - trackpadRect.left;
    const localY = touch.clientY - trackpadRect.top;
    touchTrail.current.push({ x: localX, y: localY, age: 0 });

    if (touchpadAction === 'draw') {
      // EMIT STROKE POINT IN REAL-TIME TO WHITEBOARD!
      sendEvent('remote:stroke_point', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        pressure,
      });

      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: 'draw',
        pressure,
      });
    } else {
      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: touchpadAction === 'laser' ? 'laser' : 'move',
        pressure,
      });
    }
  };

  const handleTouchpadEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    isTouchpadDown.current = false;
    lastTouch.current = null;

    if (touchpadAction === 'draw') {
      // FINISH STROKE ON WHITEBOARD!
      sendEvent('remote:stroke_end', {});

      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: false,
        mode: 'draw',
      });
    } else {
      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: false,
        mode: touchpadAction === 'laser' ? 'laser' : 'move',
      });
    }
  };

  // Reset virtual cursor to center
  const handleResetCursor = () => {
    virtualCursor.current = { x: 700, y: 400 };
    sendEvent('remote:pointer', {
      x: 700,
      y: 400,
      isDown: false,
      mode: 'move',
    });
    triggerHaptic(20);
  };

  // Action shortcuts
  const handleAction = (action: string) => {
    triggerHaptic(15);
    sendEvent('remote:action', { action });
  };

  // Quick Solve Math from Phone
  const handleSolveMath = async () => {
    if (!equationText.trim()) return;
    setIsSolving(true);
    try {
      const sol = await api.solveEquation(equationText.trim());
      setEquationSolution(sol);
      triggerHaptic(30);

      // Tell laptop to insert equation on board
      sendEvent('remote:equation_solve', {
        rawExpression: equationText.trim(),
        solution: sol,
      });
    } catch (e) {
      console.error('Solve error:', e);
    } finally {
      setIsSolving(false);
    }
  };

  // If NOT connected, show clean Passcode Entry screen
  if (!isConnected && !initialSessionId) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-center items-center p-6 select-none font-sans">
        <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Connect Phone Remote</h1>
            <p className="text-xs text-slate-400 mt-1">
              Control your laptop whiteboard wirelessly. Real-time touchpad writing, equations, and slides.
            </p>
          </div>

          <form onSubmit={handleLookupAndConnect} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Enter 6-Character Passcode
              </label>
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="e.g. 8F92KD"
                className="w-full text-center text-2xl font-mono tracking-widest font-bold py-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500 transition-colors uppercase"
              />
            </div>

            {connectionError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-lg">
                {connectionError}
              </p>
            )}

            <button
              type="submit"
              disabled={isConnecting || inputCode.length < 4}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-900/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Connect to Whiteboard</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-500">
            Find this code by clicking <strong>Connect Phone</strong> on your laptop whiteboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-between select-none touch-none overflow-hidden font-sans">
      {/* Top Mobile Header & Connection Status Banner */}
      <header className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
        {/* Real-time Connection Status Indicator */}
        <div
          onClick={() => setShowPhoneDiag(true)}
          className="flex items-center gap-2.5 cursor-pointer active:opacity-75 transition-opacity"
          title="Click to view mobile connection diagnostics"
        >
          <div className="relative flex h-3 w-3 items-center justify-center">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse"></span>
            )}
          </div>

          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>{isConnected ? 'Paired & Ready' : 'Connecting...'}</span>
              {activePasscode && (
                <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-400 border border-slate-700">
                  {activePasscode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              {isTransmitting ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Transmitting Touch ({txPacketsCount})
                </span>
              ) : isConnected ? (
                <span className="text-emerald-400">P2P Channel Active • Tap for info</span>
              ) : (
                <span className="text-amber-400">Connecting... • Tap for info</span>
              )}
            </div>
          </div>
        </div>

        {/* Primary View Switcher: Touchpad vs Full Draw Canvas */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => {
              setControlMode('touchpad');
              triggerHaptic();
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              controlMode === 'touchpad'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Touchpad
          </button>
          <button
            onClick={() => {
              setControlMode('draw');
              triggerHaptic();
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              controlMode === 'draw'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Full Canvas
          </button>
        </div>
      </header>

      {/* Main Touch Interaction Surface */}
      <main className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
        {/* MODE A: Wireless Touchpad with Live Writing Support */}
        {controlMode === 'touchpad' ? (
          <div className="flex-1 relative flex flex-col bg-slate-900/60 overflow-hidden">
            {/* Touchpad Sub-toolbar */}
            <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
              {/* Touchpad Action Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => {
                    setTouchpadAction('draw');
                    triggerHaptic();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    touchpadAction === 'draw'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Drag on touchpad to draw on whiteboard"
                >
                  <Pen className="w-3.5 h-3.5" />
                  <span>Write / Draw</span>
                </button>

                <button
                  onClick={() => {
                    setTouchpadAction('cursor');
                    triggerHaptic();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    touchpadAction === 'cursor'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Move mouse cursor"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>Pointer</span>
                </button>

                <button
                  onClick={() => {
                    setTouchpadAction('laser');
                    triggerHaptic();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    touchpadAction === 'laser'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Laser pointer for presentation"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Laser</span>
                </button>
              </div>

              {/* Ink & Color Controls when in Draw mode */}
              {touchpadAction === 'draw' && (
                <div className="flex items-center gap-1.5">
                  {/* Tool toggle */}
                  <div className="flex items-center bg-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => {
                        setActiveTool('pen');
                        triggerHaptic();
                      }}
                      className={`p-1.5 rounded-md ${
                        activeTool === 'pen' ? 'bg-blue-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      <Pen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveTool('eraser');
                        triggerHaptic();
                      }}
                      className={`p-1.5 rounded-md ${
                        activeTool === 'eraser' ? 'bg-blue-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Colors */}
                  <div className="flex items-center gap-1">
                    {['#2563eb', '#dc2626', '#16a34a', '#ffffff'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setSelectedColor(c);
                          setActiveTool('pen');
                          triggerHaptic();
                        }}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border border-slate-600 transition-transform ${
                          selectedColor === c && activeTool === 'pen'
                            ? 'scale-110 ring-2 ring-blue-400'
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Reset Cursor, Pressure Settings & Solve Math buttons */}
              <div className="flex items-center gap-1">
                {/* Touch Pressure Sensitivity Setting Button */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    pressureEnabled
                      ? 'bg-blue-950/80 border-blue-500/40 text-blue-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Configure Touch Pressure & Sensitivity"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sensitivity</span>
                </button>

                <button
                  onClick={handleResetCursor}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                  title="Recenter Cursor on Whiteboard"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMathModalOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-[11px] shadow-sm cursor-pointer"
                >
                  <Sigma className="w-3 h-3" />
                  <span>Math</span>
                </button>
              </div>
            </div>

            {/* Interactive Touchpad Surface */}
            <div
              onTouchStart={handleTouchpadStart}
              onTouchMove={handleTouchpadMove}
              onTouchEnd={handleTouchpadEnd}
              className="flex-1 relative bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 cursor-crosshair overflow-hidden touch-none"
            >
              {/* Canvas for immediate visual trail */}
              <canvas
                ref={trackpadCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                width={600}
                height={800}
              />

              {/* Touchpad Guide & Status Watermark */}
              <div className="flex flex-col items-center text-center pointer-events-none select-none z-10 space-y-2 opacity-80">
                <div
                  className={`w-16 h-16 rounded-full border flex items-center justify-center transition-colors ${
                    isTransmitting
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : touchpadAction === 'draw'
                      ? 'border-blue-500/40 bg-blue-500/5 text-blue-400'
                      : touchpadAction === 'laser'
                      ? 'border-red-500/40 bg-red-500/5 text-red-400'
                      : 'border-slate-700 bg-slate-800/20 text-slate-400'
                  }`}
                >
                  {touchpadAction === 'draw' ? (
                    <Pen className="w-7 h-7" />
                  ) : touchpadAction === 'laser' ? (
                    <Radio className="w-7 h-7 animate-pulse text-red-400" />
                  ) : (
                    <MousePointer className="w-7 h-7" />
                  )}
                </div>

                <p className="text-sm font-bold text-slate-200">
                  {touchpadAction === 'draw'
                    ? 'Touchpad Writing Active'
                    : touchpadAction === 'laser'
                    ? 'Laser Pointer Active'
                    : 'Mouse Trackpad Active'}
                </p>

                <p className="text-xs text-slate-400 max-w-[260px]">
                  {touchpadAction === 'draw'
                    ? 'Drag finger here to write or draw directly on the whiteboard'
                    : touchpadAction === 'laser'
                    ? 'Move finger to guide the presentation laser pointer'
                    : 'Slide finger to move mouse cursor across the canvas'}
                </p>

                {isTransmitting && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-semibold animate-pulse">
                    📡 Transmitting live ({txPacketsCount} pts)
                  </span>
                )}
              </div>

              {/* Bottom Instructions Badge */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-slate-500 pointer-events-none text-center bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 whitespace-nowrap">
                Live paired with whiteboard • Instant transmission
              </div>
            </div>
          </div>
        ) : (
          /* MODE B: Full Screen Handwriting Canvas */
          <div className="flex-1 relative flex flex-col bg-slate-900 border-y border-slate-800 overflow-hidden">
            {/* Draw mode toolbar */}
            <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setActiveTool('pen');
                    triggerHaptic();
                  }}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'pen' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                  title="Pen"
                >
                  <Pen className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setActiveTool('eraser');
                    triggerHaptic();
                  }}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                  title="Eraser"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>

              {/* Colors */}
              <div className="flex items-center gap-1.5">
                {['#2563eb', '#dc2626', '#16a34a', '#ffffff', '#eab308'].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedColor(c);
                      setActiveTool('pen');
                      triggerHaptic();
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border border-slate-600 transition-transform cursor-pointer ${
                      selectedColor === c && activeTool === 'pen'
                        ? 'scale-110 ring-2 ring-blue-400'
                        : ''
                    }`}
                  />
                ))}
              </div>

              {/* Sensitivity, Clear & Solve Math shortcuts */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    pressureEnabled
                      ? 'bg-blue-950/80 border-blue-500/40 text-blue-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Configure Touch Pressure & Sensitivity"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pressure</span>
                </button>
                <button
                  onClick={handleClearPhoneCanvas}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                  title="Clear Writing Surface"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMathModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-xs shadow-sm cursor-pointer"
                >
                  <Sigma className="w-3.5 h-3.5" />
                  <span>Solve Math</span>
                </button>
              </div>
            </div>

            {/* Interactive Phone Ink Canvas */}
            <div className="flex-1 relative w-full h-full cursor-crosshair">
              <canvas
                ref={phoneCanvasRef}
                onTouchStart={handleDrawStart}
                onTouchMove={handleDrawMove}
                onTouchEnd={handleDrawEnd}
                className="w-full h-full block touch-none"
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-slate-500 pointer-events-none text-center bg-slate-950/70 px-3 py-1 rounded-full border border-slate-800">
                Write equation or sketch with finger • Reflects live on laptop
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Remote Control Action Deck */}
      <footer className="p-3 bg-slate-900 border-t border-slate-800 space-y-2 shrink-0 z-20">
        <div className="flex items-center justify-between gap-1.5 text-xs">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('undo')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('redo')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('zoom_out')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('zoom_reset')}
              className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-mono cursor-pointer"
              title="Reset 100%"
            >
              100%
            </button>
            <button
              onClick={() => handleAction('zoom_in')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Page Slide Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('prev_page')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('next_page')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('add_page')}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer"
              title="Add New Page"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* Quick Solve Equation Modal from Phone */}
      {mathModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sigma className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Solve Math Equation</h3>
              </div>
              <button
                onClick={() => setMathModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
              >
                Close
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Equation Expression</label>
              <input
                type="text"
                value={equationText}
                onChange={(e) => setEquationText(e.target.value)}
                placeholder="e.g. 2x + 5 = 15 or x² - 5x + 6 = 0"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Quick Math Character Keys */}
            <div className="grid grid-cols-6 gap-1 text-center text-xs font-mono">
              {['x', 'y', '²', '√', '+', '-', '=', '(', ')', '÷', '*', 'π'].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setEquationText((prev) => prev + sym)}
                  className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-bold cursor-pointer"
                >
                  {sym}
                </button>
              ))}
            </div>

            {equationSolution && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="font-semibold text-emerald-400 flex justify-between">
                  <span>Answer:</span>
                  <span>{equationSolution.solution}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {equationSolution.steps?.[0]?.explanation}
                </div>
              </div>
            )}

            <button
              onClick={handleSolveMath}
              disabled={isSolving || !equationText.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              {isSolving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Solving with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Solve & Reflect on Laptop</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Diagnostic Popup Modal */}
      {showPhoneDiag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-4 text-xs text-slate-300 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span>Phone Connection Diagnostics</span>
              </div>
              <button
                onClick={() => setShowPhoneDiag(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Status:</span>
                <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {isConnected ? 'Paired & Linked' : 'Connecting'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Passcode:</span>
                <span className="text-amber-400 font-bold">{activePasscode || '---'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Target Host Peer:</span>
                <span className="text-slate-300 truncate max-w-[170px]">
                  {activePasscode ? `wb-smart-${activePasscode.toLowerCase()}` : '---'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Touch Packets Sent:</span>
                <span className="text-blue-400 font-bold">{txPacketsCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Console Logging:</span>
                <span className="text-emerald-400 font-bold">Active in DevTools</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  socket.sendTestPing();
                  pulseTransmitting();
                  triggerHaptic(20);
                }}
                className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-center"
              >
                Send Test Ping
              </button>
              <button
                onClick={() => {
                  socket.reconnectWebRTC();
                  triggerHaptic(20);
                }}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-center border border-slate-700"
              >
                Reconnect P2P
              </button>
            </div>

            <button
              onClick={() => setShowPhoneDiag(false)}
              className="w-full py-1.5 text-center text-slate-400 hover:text-slate-200 text-[11px]"
            >
              Close Diagnostics
            </button>
          </div>
        </div>
      )}

      {/* Touch Pressure & Sensitivity Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 text-xs text-slate-300 shadow-2xl space-y-4 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Pressure & Sensitivity</h3>
                  <p className="text-[10px] text-slate-400">Control stroke rendering based on touch force</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <div className="font-bold text-slate-200 text-xs">Dynamic Pressure Dynamics</div>
                <div className="text-[10px] text-slate-400">Vary stroke thickness with contact pressure</div>
              </div>
              <button
                onClick={() => {
                  setPressureEnabled(!pressureEnabled);
                  triggerHaptic(15);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  pressureEnabled ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    pressureEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Live Pressure Test Pad & Visualizer */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Live Touch Pressure Gauge</span>
                <span className="font-mono font-bold text-blue-400">
                  {pressureEnabled ? `${Math.round(liveTouchPressure * 100)}% (${liveTouchPressure.toFixed(2)}x)` : 'Disabled (1.0x)'}
                </span>
              </div>

              {/* Intensity Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-pink-500 rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.min(100, (liveTouchPressure / maxStrokeScale) * 100)}%`,
                  }}
                />
              </div>

              {/* Interactive Test Pad */}
              <div
                onTouchStart={(e) => {
                  e.preventDefault();
                  computeNormalizedPressure(e.touches[0]);
                  triggerHaptic(10);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  computeNormalizedPressure(e.touches[0]);
                }}
                className="mt-2 py-3 px-3 bg-slate-900 border border-slate-800 rounded-lg text-center cursor-pointer select-none active:bg-slate-800/80 transition-colors"
              >
                <span className="text-[11px] text-slate-300 font-medium flex items-center justify-center gap-1.5">
                  <span>👆 Press or glide finger here to calibrate</span>
                </span>
              </div>
            </div>

            {/* Sensitivity Multiplier Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <label className="text-slate-300 font-medium">Sensitivity Intensity</label>
                <span className="font-mono text-blue-400 font-bold bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                  {pressureSensitivity.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.5"
                step="0.1"
                value={pressureSensitivity}
                disabled={!pressureEnabled}
                onChange={(e) => setPressureSensitivity(parseFloat(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer disabled:opacity-40"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Subtle (0.4x)</span>
                <span>Balanced (1.2x)</span>
                <span>Hyper (2.5x)</span>
              </div>
            </div>

            {/* Pressure Curve Presets */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium text-[11px]">Response Curve</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'linear', label: 'Linear', desc: 'Direct proportional' },
                  { id: 'ease-in', label: 'Ease-In', desc: 'Soft start' },
                  { id: 'expressive', label: 'Expressive', desc: 'Calligraphic S-curve' },
                ].map((curve) => (
                  <button
                    key={curve.id}
                    onClick={() => {
                      setPressureCurve(curve.id as any);
                      triggerHaptic(10);
                    }}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      pressureCurve === curve.id
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="font-bold text-[11px]">{curve.label}</div>
                    <div className="text-[9px] opacity-75 truncate">{curve.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Min / Max Stroke Scale Limits */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800 text-[11px]">
              <div>
                <label className="text-slate-400 block mb-1">Min Stroke Width</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.1"
                    value={minStrokeScale}
                    disabled={!pressureEnabled}
                    onChange={(e) => setMinStrokeScale(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <span className="font-mono text-slate-300 text-[10px] w-8 shrink-0">
                    {minStrokeScale.toFixed(1)}x
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Max Stroke Width</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min="1.2"
                    max="3.5"
                    step="0.1"
                    value={maxStrokeScale}
                    disabled={!pressureEnabled}
                    onChange={(e) => setMaxStrokeScale(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <span className="font-mono text-slate-300 text-[10px] w-8 shrink-0">
                    {maxStrokeScale.toFixed(1)}x
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="text-[10px] text-slate-400">Presets:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setPressureSensitivity(0.8);
                    setPressureCurve('linear');
                    setMinStrokeScale(0.5);
                    setMaxStrokeScale(1.8);
                    triggerHaptic(10);
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                >
                  Subtle Note
                </button>
                <button
                  onClick={() => {
                    setPressureSensitivity(1.2);
                    setPressureCurve('expressive');
                    setMinStrokeScale(0.3);
                    setMaxStrokeScale(2.4);
                    triggerHaptic(10);
                  }}
                  className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800/80 border border-blue-700 text-blue-200 rounded text-[10px] cursor-pointer"
                >
                  Calligraphy
                </button>
                <button
                  onClick={() => {
                    setPressureSensitivity(2.0);
                    setPressureCurve('ease-in');
                    setMinStrokeScale(0.2);
                    setMaxStrokeScale(3.0);
                    triggerHaptic(10);
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                >
                  Heavy Brush
                </button>
              </div>
            </div>

            {/* Done button */}
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Apply Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

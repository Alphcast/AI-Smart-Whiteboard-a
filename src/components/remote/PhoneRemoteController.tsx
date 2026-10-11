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

  // Controller Mode: 'touchpad' (trackpad writing & cursor) vs 'draw' (full handwriting screen)
  const [controlMode, setControlMode] = useState<'touchpad' | 'draw'>('touchpad');

  // Touchpad Action: 'draw' (drag on touchpad to draw on whiteboard!) vs 'cursor' (pointer) vs 'laser' (laser beam)
  const [touchpadAction, setTouchpadAction] = useState<'draw' | 'cursor' | 'laser'>('draw');

  // Drawing settings
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#2563eb');
  const [strokeSize, setStrokeSize] = useState<number>(5);

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

  // Connect to session
  const connectToSession = useCallback(
    async (sessId: string, pass?: string) => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        // Verify session exists via API
        const sessionInfo = await api.getRemoteSession(sessId);
        setActiveSessionId(sessId);
        setActivePasscode(pass || sessionInfo.passcode);

        // Bind via Socket.IO
        socket.bindRemote(sessId, 'controller', pass || sessionInfo.passcode, navigator.userAgent);
        setIsConnected(true);
        triggerHaptic(30);
      } catch (err: any) {
        console.warn('Connection attempt failed:', err);
        setConnectionError('Could not connect to session. Check code or refresh laptop.');
        setIsConnected(false);
      } finally {
        setIsConnecting(false);
      }
    },
    [triggerHaptic]
  );

  // Auto-connect if initialSessionId provided
  useEffect(() => {
    if (initialSessionId) {
      connectToSession(initialSessionId, initialPasscode);
    }
  }, [initialSessionId, initialPasscode, connectToSession]);

  // Handle socket events
  useEffect(() => {
    const unsubConnected = socket.on('remote:connected', () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    const unsubStatus = socket.on('remote:status', () => {
      setIsConnected(true);
    });

    const unsubDisconnect = socket.on('remote:disconnect', () => {
      setIsConnected(false);
    });

    const unsubConnClose = socket.on('connection:close', () => {
      setIsConnected(false);
    });

    const unsubConnOpen = socket.on('connection:open', () => {
      if (activeSessionId) {
        socket.bindRemote(activeSessionId, 'controller', activePasscode);
        setIsConnected(true);
      }
    });

    const unsubError = socket.on('remote:error', (data) => {
      setConnectionError(data.message || 'Remote session error');
      setIsConnected(false);
    });

    return () => {
      unsubConnected();
      unsubStatus();
      unsubDisconnect();
      unsubConnClose();
      unsubConnOpen();
      unsubError();
    };
  }, [activeSessionId, activePasscode]);

  // Send event via Socket.IO
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
    if (!inputCode.trim()) return;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const found = await api.lookupSessionByCode(inputCode.trim());
      await connectToSession(found.sessionId, found.passcode);
    } catch {
      setConnectionError('Invalid code. Please enter the 6-character code from your laptop.');
      setIsConnecting(false);
    }
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

    isPhonePointerDown.current = true;
    currentPhoneStroke.current = [{ x: px, y: py }];

    // Draw locally on phone
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(px, py, strokeSize / 2, 0, Math.PI * 2);
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

    const pts = currentPhoneStroke.current;
    if (pts.length > 0) {
      const prev = pts[pts.length - 1];
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = activeTool === 'eraser' ? '#0f172a' : selectedColor;
        ctx.lineWidth = strokeSize;
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
    isTouchpadDown.current = true;

    const trackpadRect = e.currentTarget.getBoundingClientRect();
    const localX = touch.clientX - trackpadRect.left;
    const localY = touch.clientY - trackpadRect.top;
    touchTrail.current.push({ x: localX, y: localY, age: 0 });

    triggerHaptic(10);

    if (touchpadAction === 'draw') {
      // START DRAWING ON WHITEBOARD VIA TOUCHPAD!
      sendEvent('remote:stroke_start', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        color: activeTool === 'eraser' ? '#ffffff' : selectedColor,
        size: strokeSize * 1.5,
        tool: activeTool,
      });

      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: 'draw',
      });
    } else {
      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: touchpadAction === 'laser' ? 'laser' : 'move',
      });
    }
  };

  const handleTouchpadMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!lastTouch.current || !isTouchpadDown.current) return;

    const touch = e.touches[0];
    const dx = (touch.clientX - lastTouch.current.x) * 2.3;
    const dy = (touch.clientY - lastTouch.current.y) * 2.3;

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
      });

      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: 'draw',
      });
    } else {
      sendEvent('remote:pointer', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDown: true,
        mode: touchpadAction === 'laser' ? 'laser' : 'move',
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
        <div className="flex items-center gap-2.5">
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
                  Transmitting Touch live
                </span>
              ) : isConnected ? (
                <span>WebSocket Link Active</span>
              ) : (
                <span>Reconnecting...</span>
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

              {/* Reset Cursor & Solve Math buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetCursor}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
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

              {/* Clear & Solve Math shortcuts */}
              <div className="flex items-center gap-1.5">
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
    </div>
  );
};

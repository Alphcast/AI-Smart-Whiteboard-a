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
  Trash2,
  HelpCircle,
  Sigma,
  Send,
  Loader2,
  KeyRound,
} from 'lucide-react';
import { socket } from '../../services/socket';
import { api } from '../../services/api';
import { LatexRenderer } from '../math/LatexRenderer';

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

  // Controller Mode: 'draw' (direct handwriting/math) vs 'touchpad' (trackpad cursor)
  const [controlMode, setControlMode] = useState<'draw' | 'touchpad'>('draw');

  // Drawing settings
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'laser'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#2563eb');
  const [strokeSize, setStrokeSize] = useState<number>(5);

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
  const trackpadRef = useRef<HTMLDivElement>(null);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const virtualCursor = useRef<{ x: number; y: number }>({ x: 600, y: 400 });

  // Offset origin on whiteboard where phone writes
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

        // Bind via WebSocket
        socket.bindRemote(sessId, 'controller', pass || sessionInfo.passcode, navigator.userAgent);
        setIsConnected(true);
        triggerHaptic(30);
      } catch (err: any) {
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

    const unsubDisconnect = socket.on('remote:disconnect', () => {
      setIsConnected(false);
    });

    const unsubError = socket.on('remote:error', (data) => {
      setConnectionError(data.message || 'Remote session error');
      setIsConnected(false);
    });

    return () => {
      unsubConnected();
      unsubDisconnect();
      unsubError();
    };
  }, []);

  // Send event via WebSocket and HTTP fallback
  const sendEvent = useCallback(
    (type: string, payload: any = {}) => {
      socket.send({ type, ...payload });
      if (activeSessionId) {
        api.sendRemoteEvent(activeSessionId, type, payload).catch(() => {});
      }
    },
    [activeSessionId]
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

  // Touch drawing handlers on phone canvas
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

  // Trackpad handlers (Mode: Touchpad)
  const handleTouchpadStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    lastTouch.current = { x: touch.clientX, y: touch.clientY };

    sendEvent('remote:pointer', {
      x: virtualCursor.current.x,
      y: virtualCursor.current.y,
      isDown: true,
      mode: activeTool === 'laser' ? 'laser' : 'move',
    });
  };

  const handleTouchpadMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!lastTouch.current) return;

    const touch = e.touches[0];
    const dx = (touch.clientX - lastTouch.current.x) * 2.4;
    const dy = (touch.clientY - lastTouch.current.y) * 2.4;

    lastTouch.current = { x: touch.clientX, y: touch.clientY };

    virtualCursor.current.x = Math.max(50, Math.min(1800, virtualCursor.current.x + dx));
    virtualCursor.current.y = Math.max(50, Math.min(1000, virtualCursor.current.y + dy));

    sendEvent('remote:pointer', {
      x: virtualCursor.current.x,
      y: virtualCursor.current.y,
      isDown: true,
      mode: activeTool === 'laser' ? 'laser' : 'move',
    });
  };

  const handleTouchpadEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    lastTouch.current = null;

    sendEvent('remote:pointer', {
      x: virtualCursor.current.x,
      y: virtualCursor.current.y,
      isDown: false,
      mode: activeTool === 'laser' ? 'laser' : 'move',
    });
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
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-center items-center p-6 select-none">
        <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Connect Phone Remote</h1>
            <p className="text-xs text-slate-400 mt-1">
              Control your laptop whiteboard wirelessly. Write equations, draw, and present.
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-900/40 flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Connect to Laptop</span>
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
      {/* Top Mobile Bar */}
      <header className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>Whiteboard Remote</span>
              {activePasscode && (
                <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-400">
                  {activePasscode}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">
              {isConnected ? 'Connected & Synced ✓' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Mode Switcher: Draw Mode vs Touchpad Mode */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => {
              setControlMode('draw');
              triggerHaptic();
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              controlMode === 'draw'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Draw & Write
          </button>
          <button
            onClick={() => {
              setControlMode('touchpad');
              triggerHaptic();
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              controlMode === 'touchpad'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Touchpad
          </button>
        </div>
      </header>

      {/* Main Touch Area */}
      <main className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
        {/* MODE A: Direct Handwriting & Equation Surface */}
        {controlMode === 'draw' ? (
          <div className="flex-1 relative flex flex-col bg-slate-900 border-y border-slate-800 overflow-hidden">
            {/* Tool Bar inside Draw mode */}
            <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
              {/* Tool choice */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setActiveTool('pen');
                    triggerHaptic();
                  }}
                  className={`p-2 rounded-lg transition-colors ${
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
                  className={`p-2 rounded-lg transition-colors ${
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
                    className={`w-6 h-6 rounded-full border border-slate-600 transition-transform ${
                      selectedColor === c && activeTool === 'pen' ? 'scale-110 ring-2 ring-blue-400' : ''
                    }`}
                  />
                ))}
              </div>

              {/* Clear & Solve Math shortcuts */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearPhoneCanvas}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                  title="Clear Writing Surface"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMathModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-xs shadow-sm"
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
        ) : (
          /* MODE B: Trackpad Touchpad */
          <div
            ref={trackpadRef}
            onTouchStart={handleTouchpadStart}
            onTouchMove={handleTouchpadMove}
            onTouchEnd={handleTouchpadEnd}
            className="flex-1 relative bg-gradient-to-b from-slate-900 to-slate-950 border-y border-slate-800 flex flex-col items-center justify-center p-6 cursor-crosshair overflow-hidden"
          >
            <div className="w-16 h-16 rounded-full border border-slate-700/60 flex items-center justify-center text-slate-600 pointer-events-none">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-300 pointer-events-none">
              Wireless Touchpad Active
            </p>
            <p className="text-[11px] text-slate-500 mt-1 pointer-events-none">
              Drag finger to move mouse • Tap to click
            </p>

            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'laser' ? 'pen' : 'laser');
                  triggerHaptic();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTool === 'laser'
                    ? 'bg-red-600 text-white shadow-md shadow-red-900/40 ring-2 ring-red-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Laser Pointer</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Remote Control Action Deck */}
      <footer className="p-3 bg-slate-900 border-t border-slate-800 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-1.5 text-xs">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('undo')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('redo')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('zoom_out')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('zoom_reset')}
              className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-mono"
              title="Reset 100%"
            >
              100%
            </button>
            <button
              onClick={() => handleAction('zoom_in')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Page Slide Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('prev_page')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('next_page')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAction('add_page')}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
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
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
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
                  className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-bold"
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
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-40"
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

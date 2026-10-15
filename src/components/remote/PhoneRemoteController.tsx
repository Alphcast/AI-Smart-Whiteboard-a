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
  Sliders,
  Gauge,
  Type,
  StickyNote,
  Send,
  Hand,
  Check,
  X,
  ShieldCheck,
  Smartphone,
  Move,
  Maximize2,
} from 'lucide-react';
import { socket } from '../../services/socket';
import { api } from '../../services/api';

interface PhoneRemoteControllerProps {
  sessionId?: string;
  passcode?: string;
  onExit?: () => void;
}

type RemoteControllerStep =
  | 'passcode_entry'
  | 'verifying'
  | 'pending_approval' // WhatsApp Web style authorization prompt
  | 'connected'
  | 'rejected'
  | 'disconnected';

interface CalibrationPadProps {
  cursorSensitivity: number;
  scrollSpeed: number;
  scrollInverted: boolean;
  pointerAcceleration: boolean;
  triggerHaptic: (ms?: number) => void;
}

const TouchpadCalibrationPad: React.FC<CalibrationPadProps> = ({
  cursorSensitivity,
  scrollSpeed,
  scrollInverted,
  pointerAcceleration,
}) => {
  const [testPos, setTestPos] = useState<{ x: number; y: number }>({ x: 140, y: 55 });
  const [touchStatus, setTouchStatus] = useState<string>('Drag here to test cursor speed');
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const twoFingerLastRef = useRef<{ x: number; y: number } | null>(null);

  const handleTestTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      twoFingerLastRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      setTouchStatus('2-Finger Scrolling...');
      return;
    }
    const t = e.touches[0];
    lastTouchRef.current = { x: t.clientX, y: t.clientY };
    setTouchStatus('Tracking Cursor...');
  };

  const handleTestTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 2 && twoFingerLastRef.current) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dir = scrollInverted ? -1 : 1;
      const dx = (midX - twoFingerLastRef.current.x) * scrollSpeed * dir;
      const dy = (midY - twoFingerLastRef.current.y) * scrollSpeed * dir;
      twoFingerLastRef.current = { x: midX, y: midY };
      setTouchStatus(`Pan: ΔX=${Math.round(dx)}, ΔY=${Math.round(dy)} (${scrollSpeed.toFixed(1)}x)`);
      return;
    }

    if (!lastTouchRef.current || e.touches.length < 1) return;
    const t = e.touches[0];
    const rawDx = t.clientX - lastTouchRef.current.x;
    const rawDy = t.clientY - lastTouchRef.current.y;
    lastTouchRef.current = { x: t.clientX, y: t.clientY };

    const speed = Math.abs(rawDx) + Math.abs(rawDy);
    const accel = pointerAcceleration ? Math.min(1.8, Math.max(0.8, 0.7 + speed * 0.1)) : 1.0;
    const dx = rawDx * cursorSensitivity * accel * 0.6;
    const dy = rawDy * cursorSensitivity * accel * 0.6;

    setTestPos((prev) => ({
      x: Math.max(16, Math.min(270, prev.x + dx)),
      y: Math.max(16, Math.min(95, prev.y + dy)),
    }));
    setTouchStatus(`Cursor: ${cursorSensitivity.toFixed(1)}x speed`);
  };

  const handleTestTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    lastTouchRef.current = null;
    twoFingerLastRef.current = null;
    setTouchStatus('Try 1-finger move or 2-finger pan');
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-slate-200 flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-blue-400" />
          <span>Interactive Test Pad</span>
        </span>
        <span className="text-[10px] text-blue-400 font-mono font-semibold">{touchStatus}</span>
      </div>

      <div
        onTouchStart={handleTestTouchStart}
        onTouchMove={handleTestTouchMove}
        onTouchEnd={handleTestTouchEnd}
        className="w-full h-28 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden touch-none select-none flex items-center justify-center cursor-crosshair"
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

        {/* Virtual test cursor dot */}
        <div
          className="absolute w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50 pointer-events-none transition-transform"
          style={{
            left: `${testPos.x}px`,
            top: `${testPos.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="text-[10px] text-slate-500 pointer-events-none text-center px-4">
          Glide finger here to test speed &amp; scroll response
        </div>
      </div>
    </div>
  );
};

export const PhoneRemoteController: React.FC<PhoneRemoteControllerProps> = ({
  sessionId: initialSessionId,
  passcode: initialPasscode,
  onExit,
}) => {
  // Connection states
  const [step, setStep] = useState<RemoteControllerStep>('verifying');
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSessionId || '');
  const [activePasscode, setActivePasscode] = useState<string>(initialPasscode || '');
  const [activeToken, setActiveToken] = useState<string>('');
  const [boardId, setBoardId] = useState<string>('');
  const [boardTitle, setBoardTitle] = useState<string>('Interactive Whiteboard');
  const [inputCode, setInputCode] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Controller Mode: 'touchpad' vs 'draw' (full handwriting screen)
  const [controlMode, setControlMode] = useState<'touchpad' | 'draw'>('touchpad');

  // Touchpad Action: 'draw' vs 'cursor' (pointer) vs 'laser' (laser beam)
  const [touchpadAction, setTouchpadAction] = useState<'draw' | 'cursor' | 'laser'>('draw');

  // Hold-to-drag button for pointer mode
  const [isDragModeActive, setIsDragModeActive] = useState<boolean>(false);

  // Drawing settings
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'highlighter'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#2563eb');
  const [strokeSize, setStrokeSize] = useState<number>(5);

  // Touch Pressure & Sensitivity settings
  const [pressureEnabled, setPressureEnabled] = useState<boolean>(true);
  const [pressureSensitivity, setPressureSensitivity] = useState<number>(1.2);
  const [minStrokeScale, setMinStrokeScale] = useState<number>(0.3);
  const [maxStrokeScale, setMaxStrokeScale] = useState<number>(2.4);
  const [pressureCurve, setPressureCurve] = useState<'linear' | 'ease-in' | 'expressive'>('expressive');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [liveTouchPressure, setLiveTouchPressure] = useState<number>(0);

  // Touchpad Cursor Tracking Speed Sensitivity (0.5x to 5.0x)
  const [cursorSensitivity, setCursorSensitivity] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('phone_remote_cursor_sensitivity');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 5.0) return parsed;
      }
    }
    return 2.4;
  });

  // Touchpad 2-Finger Scroll / Pan Speed (0.5x to 4.0x)
  const [scrollSpeed, setScrollSpeed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('phone_remote_scroll_speed');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 4.0) return parsed;
      }
    }
    return 1.4;
  });

  // Natural vs Inverted Scroll Direction
  const [scrollInverted, setScrollInverted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('phone_remote_scroll_inverted') === 'true';
    }
    return false;
  });

  // Pointer Acceleration (speeds up fast swipes for broad navigation)
  const [pointerAcceleration, setPointerAcceleration] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('phone_remote_pointer_acceleration');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  // Haptics Enabled
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('phone_remote_haptics_enabled');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  // Tap Detection Sensitivity Thresholds
  const [tapThresholdTime, setTapThresholdTime] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('phone_remote_tap_time');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 150 && parsed <= 450) return parsed;
      }
    }
    return 250;
  });

  const [tapThresholdDistance, setTapThresholdDistance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('phone_remote_tap_dist');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 6 && parsed <= 30) return parsed;
      }
    }
    return 12;
  });

  const handleCursorSensitivityChange = useCallback((val: number) => {
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(val * 10) / 10));
    setCursorSensitivity(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('phone_remote_cursor_sensitivity', clamped.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  const handleScrollSpeedChange = useCallback((val: number) => {
    const clamped = Math.max(0.5, Math.min(4.0, Math.round(val * 10) / 10));
    setScrollSpeed(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('phone_remote_scroll_speed', clamped.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  const handleScrollInvertedChange = useCallback((val: boolean) => {
    setScrollInverted(val);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('phone_remote_scroll_inverted', val ? 'true' : 'false');
      } catch {
        // ignore
      }
    }
  }, []);

  const handlePointerAccelerationChange = useCallback((val: boolean) => {
    setPointerAcceleration(val);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('phone_remote_pointer_acceleration', val ? 'true' : 'false');
      } catch {
        // ignore
      }
    }
  }, []);

  const handleHapticsEnabledChange = useCallback((val: boolean) => {
    setHapticsEnabled(val);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('phone_remote_haptics_enabled', val ? 'true' : 'false');
      } catch {
        // ignore
      }
    }
  }, []);

  const handleResetToDefaults = useCallback(() => {
    handleCursorSensitivityChange(2.4);
    handleScrollSpeedChange(1.4);
    handleScrollInvertedChange(false);
    handlePointerAccelerationChange(true);
    handleHapticsEnabledChange(true);
    setTapThresholdTime(250);
    setTapThresholdDistance(12);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('phone_remote_tap_time');
        localStorage.removeItem('phone_remote_tap_dist');
      } catch {
        // ignore
      }
    }
  }, [
    handleCursorSensitivityChange,
    handleScrollSpeedChange,
    handleScrollInvertedChange,
    handlePointerAccelerationChange,
    handleHapticsEnabledChange,
  ]);

  // Keyboard & Text Input Modal on Phone
  const [isTextInputOpen, setIsTextInputOpen] = useState<boolean>(false);
  const [textInputContent, setTextInputContent] = useState<string>('');
  const [textNoteType, setTextNoteType] = useState<'sticky' | 'text'>('sticky');
  const [textStickyColor, setTextStickyColor] = useState<string>('#fef08a'); // yellow

  // Quick Math Equation Tool on Phone
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [equationText, setEquationText] = useState('2x + 5 = 15');
  const [equationSolution, setEquationSolution] = useState<any>(null);
  const [isSolving, setIsSolving] = useState(false);

  // Real-time Transmission Activity & Diagnostics
  const [isTransmitting, setIsTransmitting] = useState(false);
  const transmitTimeoutRef = useRef<any>(null);
  const [txPacketsCount, setTxPacketsCount] = useState(0);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [showPhoneDiag, setShowPhoneDiag] = useState(false);

  // Canvas refs for phone handwriting surface
  const phoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPhonePointerDown = useRef(false);
  const currentPhoneStroke = useRef<{ x: number; y: number }[]>([]);

  // Trackpad refs
  const trackpadCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const touchStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchMovementDist = useRef<number>(0);
  const isTouchpadDown = useRef(false);
  const isTwoFingerPan = useRef(false);
  const twoFingerLast = useRef<{ x: number; y: number } | null>(null);
  const virtualCursor = useRef<{ x: number; y: number }>({ x: 700, y: 400 });
  const touchTrail = useRef<{ x: number; y: number; age: number }[]>([]);
  const lastTouchTime = useRef<number>(0);
  const smoothedPressure = useRef<number>(1.0);

  // Whiteboard origin for handwriting surface
  const writeOrigin = useRef<{ x: number; y: number }>({ x: 200, y: 150 });

  const triggerHaptic = useCallback(
    (ms = 15) => {
      if (!hapticsEnabled) return;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(ms);
        }
      } catch {
        // ignore
      }
    },
    [hapticsEnabled]
  );

  const pulseTransmitting = useCallback(() => {
    setIsTransmitting(true);
    setTxPacketsCount((c) => c + 1);
    if (transmitTimeoutRef.current) clearTimeout(transmitTimeoutRef.current);
    transmitTimeoutRef.current = setTimeout(() => {
      setIsTransmitting(false);
    }, 250);
  }, []);

  const computeNormalizedPressure = useCallback(
    (touch: React.Touch, dx = 0, dy = 0, dt = 16): number => {
      if (!pressureEnabled) return 1.0;

      let rawPressure = 0.5;
      const extendedTouch = touch as any;

      if (typeof extendedTouch.force === 'number' && extendedTouch.force > 0) {
        rawPressure = extendedTouch.force;
      } else {
        const rx = (extendedTouch.radiusX as number) || 10;
        const ry = (extendedTouch.radiusY as number) || 10;
        const avgRadius = (rx + ry) / 2;
        const estimatedFromArea = Math.min(1.0, Math.max(0.1, (avgRadius - 7) / 20));
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = dt > 0 ? dist / dt : 0;
        rawPressure = estimatedFromArea * 0.7 + (1.0 - Math.min(1.0, speed * 0.5)) * 0.3;
      }

      smoothedPressure.current = smoothedPressure.current * 0.4 + rawPressure * 0.6;
      let p = smoothedPressure.current;

      if (pressureCurve === 'ease-in') {
        p = Math.pow(p, 1.6);
      } else if (pressureCurve === 'expressive') {
        p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      }

      const adjusted = p * pressureSensitivity;
      const finalScale = Math.max(minStrokeScale, Math.min(maxStrokeScale, adjusted));
      setLiveTouchPressure(finalScale);
      return finalScale;
    },
    [pressureEnabled, pressureSensitivity, minStrokeScale, maxStrokeScale, pressureCurve]
  );

  // Send event via real-time transport (WebSockets / Socket.IO / WebRTC)
  const sendEvent = useCallback(
    (type: string, payload: any = {}) => {
      pulseTransmitting();
      socket.emit(type, payload);
    },
    [pulseTransmitting]
  );

  // 1. Initial Load & Scan Detection
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionParam = searchParams.get('session') || initialSessionId;
    const tokenParam = searchParams.get('token');
    const codeParam = searchParams.get('code') || initialPasscode;
    const boardParam = searchParams.get('boardId');

    if (sessionParam) {
      setActiveSessionId(sessionParam);
      if (tokenParam) setActiveToken(tokenParam);
      if (codeParam) setActivePasscode(codeParam);
      if (boardParam) setBoardId(boardParam);

      // Verify session with server and notify scan
      const verifyAndNotify = async () => {
        try {
          const sessInfo = await api.getRemoteSession(sessionParam);
          if (sessInfo.boardTitle) setBoardTitle(sessInfo.boardTitle);
          if (sessInfo.boardId) setBoardId(sessInfo.boardId);
          if (sessInfo.passcode) setActivePasscode(sessInfo.passcode);

          // If session was already connected/authorized before, resume directly
          if (sessInfo.state === 'connected' && sessInfo.connectedControllersCount > 0) {
            setStep('connected');
            socket.bindRemote(sessionParam, 'controller', sessInfo.passcode, tokenParam || undefined);
            return;
          }

          // Report QR scan to server so laptop display updates to "QR Scanned!"
          try {
            await api.scanRemoteSession(sessionParam, tokenParam || undefined, codeParam || undefined, navigator.userAgent);
          } catch {
            // ignore
          }

          // Connect socket as controller
          socket.bindRemote(sessionParam, 'controller', sessInfo.passcode, tokenParam || undefined);
          socket.scanDetected(sessionParam, tokenParam || undefined, codeParam || undefined);

          // Render WhatsApp Web Authorization Screen
          setStep('pending_approval');
        } catch (err: any) {
          console.warn('[PhoneRemote] Session verification fallback:', err);
          setStep('pending_approval');
          socket.bindRemote(sessionParam, 'controller', codeParam || undefined, tokenParam || undefined);
        }
      };

      verifyAndNotify();
    } else {
      // No session parameters in URL -> Show Passcode Entry Screen
      setStep('passcode_entry');
    }
  }, [initialSessionId, initialPasscode]);

  // Listen to remote events
  useEffect(() => {
    const unsubApproved = socket.on('remote:approved', (data) => {
      console.log('[PhoneRemote] Connection approved by server:', data);
      setStep('connected');
      setIsAuthorizing(false);
      triggerHaptic(35);
    });

    const unsubPaired = socket.on('remote:phone_paired', (data) => {
      console.log('[PhoneRemote] Phone paired notification:', data);
      setStep('connected');
      setIsAuthorizing(false);
    });

    const unsubRejected = socket.on('remote:rejected', (data) => {
      console.log('[PhoneRemote] Connection rejected:', data);
      setStep('rejected');
      setIsAuthorizing(false);
    });

    const unsubDisc = socket.on('remote:phone_disconnected', () => {
      console.log('[PhoneRemote] Phone disconnected');
      setStep('disconnected');
    });

    const unsubStatus = socket.on('remote:status', (data) => {
      if (data?.isPaired === true && step === 'pending_approval') {
        setStep('connected');
      } else if (data?.isPaired === false && step === 'connected') {
        setStep('disconnected');
      }
    });

    const unsubHeartbeat = socket.on('socket:heartbeat', (data) => {
      if (typeof data?.latencyMs === 'number') {
        setPingLatency(data.latencyMs);
      }
    });

    return () => {
      unsubApproved();
      unsubPaired();
      unsubRejected();
      unsubDisc();
      unsubStatus();
      unsubHeartbeat();
    };
  }, [step, triggerHaptic]);

  // Handle User Approving Connection (WhatsApp Web Reference)
  const handleApproveConnection = async () => {
    setIsAuthorizing(true);
    triggerHaptic(20);

    try {
      // 1. API approval call
      await api.approveRemoteSession(
        activeSessionId,
        activeToken || undefined,
        activePasscode || undefined,
        navigator.userAgent
      );

      // 2. Socket approval emission
      socket.approveConnection(
        activeSessionId,
        activeToken || undefined,
        activePasscode || undefined,
        navigator.userAgent
      );

      setStep('connected');
      triggerHaptic(40);
    } catch (err: any) {
      console.error('[PhoneRemote] Approval error:', err);
      // Fallback via socket emission
      socket.approveConnection(
        activeSessionId,
        activeToken || undefined,
        activePasscode || undefined,
        navigator.userAgent
      );
      setStep('connected');
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Handle User Declining Connection
  const handleDeclineConnection = async () => {
    triggerHaptic(20);
    try {
      await api.rejectRemoteSession(activeSessionId, 'User declined on phone');
    } catch {
      // ignore
    }
    socket.rejectConnection(activeSessionId, 'User declined on phone');
    setStep('rejected');
  };

  // Manual code entry lookup
  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean.length < 4) return;

    setConnectionError(null);
    setStep('verifying');

    try {
      const found = await api.lookupSessionByCode(clean);
      setActiveSessionId(found.sessionId);
      setActivePasscode(found.passcode);
      if (found.boardTitle) setBoardTitle(found.boardTitle);
      if (found.boardId) setBoardId(found.boardId);
      if (found.authToken) setActiveToken(found.authToken);

      socket.bindRemote(found.sessionId, 'controller', found.passcode, found.authToken);
      socket.scanDetected(found.sessionId, found.authToken, found.passcode);

      setStep('pending_approval');
    } catch (err: any) {
      setConnectionError(err.message || 'Whiteboard session not found. Check the code.');
      setStep('passcode_entry');
    }
  };

  // Trackpad Touch Handlers
  const handleTouchpadStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touches = e.touches;
    const now = Date.now();
    lastTouchTime.current = now;
    touchStartTime.current = now;
    touchMovementDist.current = 0;

    if (touches.length === 2) {
      // Two-finger gesture initiation (pan canvas)
      isTwoFingerPan.current = true;
      twoFingerLast.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
      return;
    }

    isTwoFingerPan.current = false;
    const touch = touches[0];
    lastTouch.current = { x: touch.clientX, y: touch.clientY };
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isTouchpadDown.current = true;

    const trackpadRect = e.currentTarget.getBoundingClientRect();
    const localX = touch.clientX - trackpadRect.left;
    const localY = touch.clientY - trackpadRect.top;
    touchTrail.current.push({ x: localX, y: localY, age: 0 });

    const pressure = computeNormalizedPressure(touch, 0, 0, 16);

    if (touchpadAction === 'draw') {
      sendEvent('remote:stroke_start', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        color: activeTool === 'eraser' ? '#ffffff' : activeTool === 'highlighter' ? '#fef08a' : selectedColor,
        size: activeTool === 'highlighter' ? strokeSize * 2.5 : strokeSize * 1.5,
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
        isDown: isDragModeActive,
        mode: touchpadAction === 'laser' ? 'laser' : isDragModeActive ? 'drag' : 'move',
        pressure,
      });
    }
  };

  const handleTouchpadMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touches = e.touches;
    const now = Date.now();
    const dt = Math.max(1, now - (lastTouchTime.current || now));
    lastTouchTime.current = now;

    // Handle 2-Finger Canvas Pan / Scroll
    if (touches.length === 2 && twoFingerLast.current) {
      const midX = (touches[0].clientX + touches[1].clientX) / 2;
      const midY = (touches[0].clientY + touches[1].clientY) / 2;
      const dirSign = scrollInverted ? -1 : 1;
      const dx = (midX - twoFingerLast.current.x) * scrollSpeed * dirSign;
      const dy = (midY - twoFingerLast.current.y) * scrollSpeed * dirSign;
      twoFingerLast.current = { x: midX, y: midY };

      sendEvent('remote:pan', { dx, dy });
      return;
    }

    if (!lastTouch.current || !isTouchpadDown.current || touches.length < 1) return;

    const touch = touches[0];
    const rawDx = touch.clientX - lastTouch.current.x;
    const rawDy = touch.clientY - lastTouch.current.y;
    touchMovementDist.current += Math.abs(rawDx) + Math.abs(rawDy);

    // Dynamic pointer acceleration calculation (accelerate on rapid flicks, precise on slow drags)
    const speed = dt > 0 ? (Math.abs(rawDx) + Math.abs(rawDy)) / dt : 1;
    const accelMultiplier = pointerAcceleration ? Math.min(1.8, Math.max(0.8, 0.7 + speed * 0.35)) : 1.0;
    const dx = rawDx * cursorSensitivity * accelMultiplier;
    const dy = rawDy * cursorSensitivity * accelMultiplier;
    lastTouch.current = { x: touch.clientX, y: touch.clientY };

    const pressure = computeNormalizedPressure(touch, dx, dy, dt);

    // Clamp virtual cursor on whiteboard
    virtualCursor.current.x = Math.max(20, Math.min(2200, virtualCursor.current.x + dx));
    virtualCursor.current.y = Math.max(20, Math.min(1400, virtualCursor.current.y + dy));

    const trackpadRect = e.currentTarget.getBoundingClientRect();
    const localX = touch.clientX - trackpadRect.left;
    const localY = touch.clientY - trackpadRect.top;
    touchTrail.current.push({ x: localX, y: localY, age: 0 });

    if (touchpadAction === 'draw') {
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
        isDown: isDragModeActive,
        mode: touchpadAction === 'laser' ? 'laser' : isDragModeActive ? 'drag' : 'move',
        pressure,
      });
    }
  };

  const handleTouchpadEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const duration = Date.now() - touchStartTime.current;
    const moved = touchMovementDist.current;

    if (isTwoFingerPan.current) {
      isTwoFingerPan.current = false;
      twoFingerLast.current = null;
      return;
    }

    // Tap Detection: If quick release with minimal movement (< tapThresholdDistance and < tapThresholdTime), dispatch TAP / CLICK!
    if (moved < tapThresholdDistance && duration < tapThresholdTime && touchpadAction !== 'draw') {
      triggerHaptic(18);
      sendEvent('remote:tap', {
        x: virtualCursor.current.x,
        y: virtualCursor.current.y,
        isDoubleTap: false,
      });
    }

    isTouchpadDown.current = false;
    lastTouch.current = null;

    if (touchpadAction === 'draw') {
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

  // Recenter virtual cursor on whiteboard
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

  // Send typed text / sticky note to whiteboard
  const handleSendTextInput = () => {
    if (!textInputContent.trim()) return;
    triggerHaptic(25);

    sendEvent('remote:text_input', {
      text: textInputContent.trim(),
      noteType: textNoteType,
      color: textStickyColor,
      x: virtualCursor.current.x,
      y: virtualCursor.current.y,
    });

    setTextInputContent('');
    setIsTextInputOpen(false);
  };

  // Quick Solve Math from Phone
  const handleSolveMath = async () => {
    if (!equationText.trim()) return;
    setIsSolving(true);
    try {
      const sol = await api.solveEquation(equationText.trim());
      setEquationSolution(sol);
      triggerHaptic(30);

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

  // Full Screen Handwriting Canvas handlers (Mode: Draw)
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

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(px, py, effectiveStrokeWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = activeTool === 'eraser' ? '#0f172a' : selectedColor;
      ctx.fill();
    }

    const wbX = writeOrigin.current.x + px * 1.5;
    const wbY = writeOrigin.current.y + py * 1.5;

    triggerHaptic(10);
    sendEvent('remote:stroke_start', {
      x: wbX,
      y: wbY,
      color: activeTool === 'eraser' ? '#ffffff' : activeTool === 'highlighter' ? '#fef08a' : selectedColor,
      size: activeTool === 'highlighter' ? strokeSize * 2.5 : strokeSize * 1.5,
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

  // Render Touchpad Trail
  useEffect(() => {
    if (controlMode !== 'touchpad') return;

    let animId: number;
    const renderTrackpadTrail = () => {
      const canvas = trackpadCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  // ================= VIEW 1: PASSCODE ENTRY SCREEN =================
  if (step === 'passcode_entry' || (step === 'verifying' && !activeSessionId)) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-center items-center p-6 select-none font-sans">
        <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Connect Phone Remote</h1>
            <p className="text-xs text-slate-400 mt-1">
              Control your laptop whiteboard wirelessly. Real-time touchpad, handwriting, and text notes.
            </p>
          </div>

          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
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
              disabled={inputCode.length < 4}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-900/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Verify & Connect</span>
            </button>
          </form>

          <p className="text-[11px] text-slate-500">
            Find the passcode or QR code by clicking <strong>Connect Phone</strong> on your laptop whiteboard.
          </p>
        </div>
      </div>
    );
  }

  // ================= VIEW 2: WHATSAPP WEB STYLE AUTHORIZATION SCREEN =================
  if (step === 'pending_approval') {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-center items-center p-6 select-none font-sans">
        <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-blue-600/15 text-blue-400 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/30">
            <Smartphone className="w-8 h-8 text-blue-400" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2.5 py-1 rounded-full border border-blue-800/50">
              Pairing Request
            </span>
            <h1 className="text-xl font-bold text-white mt-2.5">Pair with Whiteboard?</h1>
            <p className="text-xs text-slate-400 mt-1">
              Your phone will be linked as a wireless trackpad, handwriting surface, and remote controller.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500 font-medium">Target Board:</span>
              <span className="font-bold text-white truncate max-w-[180px]">{boardTitle}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500 font-medium">Session ID:</span>
              <span className="font-mono text-slate-300 truncate max-w-[150px]">{activeSessionId}</span>
            </div>
            {activePasscode && (
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-500 font-medium">Passcode:</span>
                <span className="font-mono font-bold text-blue-400 bg-slate-800 px-2 py-0.5 rounded">
                  {activePasscode}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-400 border-t border-slate-800/80">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Token validated • Encrypted transport</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleDeclineConnection}
              disabled={isAuthorizing}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-2xl text-xs transition-colors border border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveConnection}
              disabled={isAuthorizing}
              className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isAuthorizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Approve &amp; Connect</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= VIEW 3: REJECTED / DISCONNECTED SCREEN =================
  if (step === 'rejected' || step === 'disconnected') {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-center items-center p-6 select-none font-sans">
        <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 bg-red-600/15 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30">
            {step === 'rejected' ? <X className="w-7 h-7" /> : <WifiOff className="w-7 h-7" />}
          </div>

          <h2 className="text-lg font-bold text-white">
            {step === 'rejected' ? 'Connection Declined' : 'Disconnected from Whiteboard'}
          </h2>
          <p className="text-xs text-slate-400">
            {step === 'rejected'
              ? 'You cancelled this pairing request.'
              : 'The wireless communication channel between phone and laptop was closed.'}
          </p>

          <button
            onClick={() => {
              if (activeSessionId) {
                setStep('pending_approval');
              } else {
                setStep('passcode_entry');
              }
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer"
          >
            Reconnect / Scan Again
          </button>
        </div>
      </div>
    );
  }

  // ================= VIEW 4: ACTIVE CONNECTED TOUCHPAD & CONTROLLER =================
  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-between select-none touch-none overflow-hidden font-sans">
      {/* Top Mobile Header & Connection Status Banner */}
      <header className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
        <div
          onClick={() => setShowPhoneDiag(true)}
          className="flex items-center gap-2.5 cursor-pointer active:opacity-75 transition-opacity"
          title="Click to view connection telemetry"
        >
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>Touchpad Connected ✓</span>
              {activePasscode && (
                <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-400 border border-slate-700">
                  {activePasscode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              {isTransmitting ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Transmitting ({txPacketsCount})
                </span>
              ) : (
                <span className="text-emerald-400">
                  Live Active • {pingLatency !== null ? `${pingLatency}ms` : 'WebSockets'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls: Configuration Panel & View Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsSettingsOpen(true);
              triggerHaptic();
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            title="Configure Touchpad Sensitivity & Scroll Speed"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden xs:inline">Config</span>
          </button>

          {/* View Switcher: Touchpad vs Full Handwriting Canvas */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => {
                setControlMode('touchpad');
                triggerHaptic();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                controlMode === 'touchpad' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Touchpad
            </button>
            <button
              onClick={() => {
                setControlMode('draw');
                triggerHaptic();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                controlMode === 'draw' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Canvas
            </button>
          </div>
        </div>
      </header>

      {/* Main Touch Interaction Surface */}
      <main className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
        {controlMode === 'touchpad' ? (
          /* MODE A: Wireless Touchpad */
          <div className="flex-1 relative flex flex-col bg-slate-900/60 overflow-hidden">
            {/* Sub-toolbar */}
            <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-1.5 shrink-0 flex-wrap">
              {/* Touchpad Mode Buttons */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => {
                    setTouchpadAction('draw');
                    triggerHaptic();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    touchpadAction === 'draw' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Drag on touchpad to write/draw"
                >
                  <Pen className="w-3.5 h-3.5" />
                  <span>Draw</span>
                </button>

                <button
                  onClick={() => {
                    setTouchpadAction('cursor');
                    triggerHaptic();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    touchpadAction === 'cursor' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Move mouse cursor & tap to select"
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
                    touchpadAction === 'laser' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Presentation laser pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Laser</span>
                </button>
              </div>

              {/* In Pointer Mode: Hold to Drag Toggle */}
              {touchpadAction === 'cursor' && (
                <button
                  onClick={() => {
                    setIsDragModeActive(!isDragModeActive);
                    triggerHaptic(15);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                    isDragModeActive
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  title="Toggle drag / select mode on pointer"
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>{isDragModeActive ? 'Dragging' : 'Hold Drag'}</span>
                </button>
              )}

              {/* Keyboard / Text Insertion Button (Explicit Requirement) */}
              <button
                onClick={() => setIsTextInputOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                title="Type text or sticky note from phone keyboard"
              >
                <Type className="w-3.5 h-3.5" />
                <span>Text Note</span>
              </button>

              {/* Math & Quick Reset */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetCursor}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                  title="Recenter cursor"
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

            {/* Tracking Speed & Drawing Inks */}
            <div className="px-3 py-1.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-xs gap-2">
              {touchpadAction === 'draw' ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
                    <button
                      onClick={() => setActiveTool('pen')}
                      className={`p-1 rounded ${activeTool === 'pen' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                    >
                      <Pen className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setActiveTool('eraser')}
                      className={`p-1 rounded ${activeTool === 'eraser' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                    >
                      <Eraser className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {['#2563eb', '#dc2626', '#16a34a', '#ffffff', '#eab308'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setSelectedColor(c);
                          setActiveTool('pen');
                        }}
                        style={{ backgroundColor: c }}
                        className={`w-4 h-4 rounded-full border border-slate-600 ${
                          selectedColor === c && activeTool === 'pen' ? 'scale-125 ring-2 ring-blue-400' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Speed:</span>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={cursorSensitivity}
                    onChange={(e) => handleCursorSensitivityChange(parseFloat(e.target.value))}
                    className="w-18 xs:w-24 accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className="font-mono text-blue-400 font-bold">{cursorSensitivity.toFixed(1)}x</span>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      triggerHaptic();
                    }}
                    className="ml-1 text-[10px] text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 cursor-pointer flex items-center gap-0.5"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Config</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-medium hidden xs:inline">
                  Scroll: {scrollSpeed.toFixed(1)}x
                </span>
                <button
                  onClick={() => {
                    setIsSettingsOpen(true);
                    triggerHaptic();
                  }}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Configure Touchpad Sensitivity & Scroll Speed"
                >
                  <Sliders className="w-3 h-3 text-blue-400" />
                  <span>Sensitivity &amp; Scroll</span>
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
              <canvas
                ref={trackpadCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                width={600}
                height={800}
              />

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
                    ? 'Writing on Whiteboard'
                    : touchpadAction === 'laser'
                    ? 'Laser Pointer Active'
                    : isDragModeActive
                    ? 'Drag / Select Mode Active'
                    : 'Trackpad Pointer Active'}
                </p>

                <p className="text-xs text-slate-400 max-w-[260px]">
                  {touchpadAction === 'draw'
                    ? 'Glide finger to draw smooth math proofs & equations'
                    : 'Tap to select objects • Glide finger to steer laptop pointer • 2 fingers to pan canvas'}
                </p>
              </div>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 pointer-events-none text-center bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 whitespace-nowrap">
                Live bidirectional connection active
              </div>
            </div>
          </div>
        ) : (
          /* MODE B: Full Screen Handwriting Slate */
          <div className="flex-1 relative flex flex-col bg-slate-900 border-y border-slate-800 overflow-hidden">
            <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTool('pen')}
                  className={`p-2 rounded-lg ${activeTool === 'pen' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  <Pen className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`p-2 rounded-lg ${activeTool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {['#2563eb', '#dc2626', '#16a34a', '#ffffff', '#eab308'].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedColor(c);
                      setActiveTool('pen');
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border border-slate-600 ${
                      selectedColor === c && activeTool === 'pen' ? 'scale-110 ring-2 ring-blue-400' : ''
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const canvas = phoneCanvasRef.current;
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      ctx?.clearRect(0, 0, canvas.width, canvas.height);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                  title="Clear Writing Surface"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMathModalOpen(true)}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-xs shadow-sm"
                >
                  Solve Math
                </button>
              </div>
            </div>

            <div className="flex-1 relative w-full h-full cursor-crosshair">
              <canvas
                ref={phoneCanvasRef}
                onTouchStart={handleDrawStart}
                onTouchMove={handleDrawMove}
                onTouchEnd={handleDrawEnd}
                className="w-full h-full block touch-none"
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-slate-500 pointer-events-none text-center bg-slate-950/70 px-3 py-1 rounded-full border border-slate-800">
                Write formula with finger • Rendered live on laptop whiteboard
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
              title="Reset Zoom"
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
              title="Add Page"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* ================= MODAL: KEYBOARD / TEXT INPUT FROM PHONE ================= */}
      {isTextInputOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Type onto Whiteboard</h3>
              </div>
              <button
                onClick={() => setIsTextInputOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Note Type Toggle */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setTextNoteType('sticky')}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  textNoteType === 'sticky' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span>Sticky Note</span>
              </button>
              <button
                onClick={() => setTextNoteType('text')}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  textNoteType === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Plain Text</span>
              </button>
            </div>

            {/* Sticky Color Palette */}
            {textNoteType === 'sticky' && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400">Card Color:</span>
                <div className="flex items-center gap-2">
                  {[
                    { color: '#fef08a', label: 'Yellow' },
                    { color: '#bbf7d0', label: 'Green' },
                    { color: '#bae6fd', label: 'Blue' },
                    { color: '#fbcfe8', label: 'Pink' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      onClick={() => setTextStickyColor(item.color)}
                      style={{ backgroundColor: item.color }}
                      className={`w-6 h-6 rounded-full border border-slate-600 transition-transform ${
                        textStickyColor === item.color ? 'scale-125 ring-2 ring-indigo-400' : ''
                      }`}
                      title={item.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Textarea Input */}
            <div>
              <textarea
                rows={4}
                value={textInputContent}
                onChange={(e) => setTextInputContent(e.target.value)}
                placeholder={
                  textNoteType === 'sticky'
                    ? 'Type note content to pin on the whiteboard canvas...'
                    : 'Type text label to place on the whiteboard...'
                }
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white outline-none focus:border-indigo-500 font-sans resize-none"
                autoFocus
              />
            </div>

            <button
              onClick={handleSendTextInput}
              disabled={!textInputContent.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Insert on Laptop Whiteboard</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: MATH EQUATION SOLVER ================= */}
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
              <input
                type="text"
                value={equationText}
                onChange={(e) => setEquationText(e.target.value)}
                placeholder="e.g. 2x + 5 = 15 or x² - 5x + 6 = 0"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white outline-none focus:border-blue-500"
              />
            </div>

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
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="font-semibold text-emerald-400 flex justify-between">
                  <span>Answer:</span>
                  <span>{equationSolution.solution}</span>
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
                  <span>Insert Solution onto Laptop</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: DIAGNOSTICS ================= */}
      {showPhoneDiag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-4 text-xs text-slate-300 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span>Connection Telemetry</span>
              </div>
              <button onClick={() => setShowPhoneDiag(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Session Status:</span>
                <span className="text-emerald-400 font-bold">Connected &amp; Paired</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Latency:</span>
                <span className="text-blue-400 font-bold">{pingLatency !== null ? `${pingLatency} ms` : 'Active'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Packets Transmitted:</span>
                <span className="text-blue-400 font-bold">{txPacketsCount}</span>
              </div>
            </div>

            <button
              onClick={() => setShowPhoneDiag(false)}
              className="w-full py-1.5 text-center text-slate-400 hover:text-slate-200 text-[11px]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: TOUCHPAD CONFIGURATION PANEL ================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Touchpad Configuration</h3>
                  <p className="text-[11px] text-slate-400">Pointer sensitivity, scroll speed &amp; gesture response</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  triggerHaptic();
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Configuration Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain text-xs">
              {/* Section 1: Pointer Tracking Speed */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs block">Pointer Tracking Speed</span>
                    <span className="text-[11px] text-slate-400">Cursor movement ratio on whiteboard</span>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-950/80 border border-blue-800/60 text-blue-400 font-mono font-bold text-xs rounded-lg">
                    {cursorSensitivity.toFixed(1)}x
                  </span>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={cursorSensitivity}
                    onChange={(e) => handleCursorSensitivityChange(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.5x (Slow)</span>
                    <span>2.4x (Default)</span>
                    <span>5.0x (Ultra Fast)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Presets:</span>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {[
                      { label: '1.0x', title: 'Slow', val: 1.0 },
                      { label: '1.8x', title: 'Fine', val: 1.8 },
                      { label: '2.4x', title: 'Default', val: 2.4 },
                      { label: '3.5x', title: 'Fast', val: 3.5 },
                      { label: '4.8x', title: 'Turbo', val: 4.8 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        onClick={() => {
                          handleCursorSensitivityChange(preset.val);
                          triggerHaptic(10);
                        }}
                        className={`py-1.5 px-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                          Math.abs(cursorSensitivity - preset.val) < 0.05
                            ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="font-bold">{preset.label}</div>
                        <div className="text-[9px] opacity-75">{preset.title}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pointer Acceleration Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="font-semibold text-slate-200 block text-xs">Pointer Acceleration</span>
                    <span className="text-[10px] text-slate-400">Accelerate fast flicks for large whiteboards</span>
                  </div>
                  <button
                    onClick={() => {
                      handlePointerAccelerationChange(!pointerAcceleration);
                      triggerHaptic(15);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border ${
                      pointerAcceleration ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        pointerAcceleration ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Section 2: Two-Finger Scroll Speed */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs block">2-Finger Scroll Speed</span>
                    <span className="text-[11px] text-slate-400">Canvas pan velocity multiplier</span>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 font-mono font-bold text-xs rounded-lg">
                    {scrollSpeed.toFixed(1)}x
                  </span>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.1"
                    value={scrollSpeed}
                    onChange={(e) => handleScrollSpeedChange(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.5x (Gentle)</span>
                    <span>1.4x (Default)</span>
                    <span>4.0x (Rapid)</span>
                  </div>
                </div>

                {/* Scroll Presets */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Presets:</span>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: '0.8x', title: 'Gentle', val: 0.8 },
                      { label: '1.4x', title: 'Default', val: 1.4 },
                      { label: '2.2x', title: 'Fast', val: 2.2 },
                      { label: '3.2x', title: 'Turbo', val: 3.2 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        onClick={() => {
                          handleScrollSpeedChange(preset.val);
                          triggerHaptic(10);
                        }}
                        className={`py-1.5 px-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                          Math.abs(scrollSpeed - preset.val) < 0.05
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="font-bold">{preset.label}</div>
                        <div className="text-[9px] opacity-75">{preset.title}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Invert Scroll Direction Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="font-semibold text-slate-200 block text-xs">Invert Scroll Direction</span>
                    <span className="text-[10px] text-slate-400">Swipe down moves canvas upward (Natural vs Traditional)</span>
                  </div>
                  <button
                    onClick={() => {
                      handleScrollInvertedChange(!scrollInverted);
                      triggerHaptic(15);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border ${
                      scrollInverted ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        scrollInverted ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Section 3: Tap & Haptics Feedback */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <span className="font-bold text-white text-xs block">Gestures &amp; Touch Feedback</span>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 block text-xs">Haptic Vibration</span>
                    <span className="text-[10px] text-slate-400">Vibration feedback on tap, tools, and shortcuts</span>
                  </div>
                  <button
                    onClick={() => {
                      handleHapticsEnabledChange(!hapticsEnabled);
                      if (!hapticsEnabled) triggerHaptic(20);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border ${
                      hapticsEnabled ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        hapticsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Tap Movement Tolerance</span>
                    <span className="font-mono text-indigo-400 font-bold">{tapThresholdDistance}px</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="25"
                    step="1"
                    value={tapThresholdDistance}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setTapThresholdDistance(v);
                      localStorage.setItem('phone_remote_tap_dist', v.toString());
                    }}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>

              {/* Section 4: Live Calibration Pad */}
              <TouchpadCalibrationPad
                cursorSensitivity={cursorSensitivity}
                scrollSpeed={scrollSpeed}
                scrollInverted={scrollInverted}
                pointerAcceleration={pointerAcceleration}
                triggerHaptic={triggerHaptic}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  handleResetToDefaults();
                  triggerHaptic(20);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Restore default speeds and settings"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  triggerHaptic(20);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/40 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save &amp; Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

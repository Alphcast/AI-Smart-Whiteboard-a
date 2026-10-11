/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { Smartphone, CheckCircle2, Copy, Check, ExternalLink, X, RefreshCw, Clock } from 'lucide-react';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

export interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  sessionId?: string | null;
  passcode?: string | null;
  title?: string;
  subtitle?: string;
  isPhoneConnected?: boolean;
  onPhoneConnectionChange?: (connected: boolean) => void;
  onSessionReady?: (sessionId: string, passcode?: string) => void;
}

const PASSCODE_TTL = 30; // Passcode is stable and valid for at least 30 seconds before changing

function generatePasscode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  boardId,
  sessionId: propSessionId,
  passcode: propPasscode,
  title = 'Connect Your Smartphone',
  subtitle = 'Wireless touchpad, handwriting & remote slide controller',
  isPhoneConnected = false,
  onPhoneConnectionChange,
  onSessionReady,
}) => {
  const [activePasscode, setActivePasscode] = useState<string>(() => {
    return propPasscode || generatePasscode();
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return propSessionId || `sess-${Date.now()}-${activePasscode.toLowerCase()}`;
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(PASSCODE_TTL);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollIntervalRef = useRef<any>(null);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const pairingUrl = `${currentOrigin}/remote?session=${encodeURIComponent(activeSessionId)}&code=${encodeURIComponent(activePasscode)}`;

  // Generate QR Code immediately (both SVG and Canvas/DataURL)
  const renderQRCode = useCallback(async (url: string) => {
    if (!url) return;
    const qrLib: any = (QRCode as any)?.default || QRCode;

    try {
      if (typeof qrLib?.toString === 'function') {
        const svgString = await qrLib.toString(url, {
          type: 'svg',
          width: 240,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        setQrSvg(svgString);
      }
    } catch (err) {
      console.warn('[QRCodeModal] SVG generation error:', err);
    }

    try {
      if (typeof qrLib?.toDataURL === 'function') {
        const dataUrl = await qrLib.toDataURL(url, {
          width: 240,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
      }
    } catch (err) {
      console.warn('[QRCodeModal] DataURL generation error:', err);
    }

    try {
      if (canvasRef.current && typeof qrLib?.toCanvas === 'function') {
        await qrLib.toCanvas(canvasRef.current, url, {
          width: 240,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
      }
    } catch {
      // ignore
    }
  }, []);

  // Rotate to a new 6-character passcode when 30 seconds elapse or on manual refresh
  const rotatePasscode = useCallback(() => {
    const newCode = generatePasscode();
    const newSessId = `sess-${Date.now()}-${newCode.toLowerCase()}`;
    setActivePasscode(newCode);
    setActiveSessionId(newSessId);
    setSecondsRemaining(PASSCODE_TTL);

    const newUrl = `${currentOrigin}/remote?session=${encodeURIComponent(newSessId)}&code=${encodeURIComponent(newCode)}`;
    renderQRCode(newUrl);

    onSessionReady?.(newSessId, newCode);
    socket.bindRemote(newSessId, 'display', newCode);
    api.createRemoteSession(boardId, newSessId, newCode).catch(() => {});
  }, [boardId, currentOrigin, renderQRCode, onSessionReady]);

  // Initial modal opening: render QR code & register session once
  useEffect(() => {
    if (!isOpen) return;

    renderQRCode(pairingUrl);
    onSessionReady?.(activeSessionId, activePasscode);
    socket.bindRemote(activeSessionId, 'display', activePasscode);
    api.createRemoteSession(boardId, activeSessionId, activePasscode).catch(() => {});

    // Listen for phone paired / disconnected events
    const unsubPaired = socket.on('remote:phone_paired', () => {
      onPhoneConnectionChange?.(true);
    });
    const unsubDisc = socket.on('remote:phone_disconnected', () => {
      onPhoneConnectionChange?.(false);
    });

    // Poll session status periodically
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await api.getRemoteSession(activeSessionId);
        if (status.connectedControllers > 0) {
          onPhoneConnectionChange?.(true);
        }
      } catch {
        // ignore
      }
    }, 1500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      unsubPaired();
      unsubDisc();
    };
  }, [isOpen]); // Only runs on open / close, never in an infinite loop

  // 30-Second countdown timer before rotating to the next passcode
  useEffect(() => {
    if (!isOpen) return;

    // While phone is connected, keep current session locked
    if (isPhoneConnected) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // 30 seconds reached! Rotate to new passcode
          rotatePasscode();
          return PASSCODE_TTL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPhoneConnected, rotatePasscode]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!pairingUrl) return;
    navigator.clipboard.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Status Indicator */}
          <div
            className={`p-3 rounded-xl flex items-center justify-between text-xs transition-colors ${
              isPhoneConnected
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-slate-50 border border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isPhoneConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="font-semibold">
                {isPhoneConnected ? 'Phone Connected ✓' : 'Scan to Connect Touchpad'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {isPhoneConnected ? 'Session Active' : 'Ready to pair'}
            </span>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-5 bg-slate-50/80 border border-slate-200 rounded-2xl relative">
            <div className="w-56 h-56 bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/80 flex items-center justify-center overflow-hidden">
              {qrSvg ? (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Pairing QR Code"
                  className="w-full h-full object-contain"
                />
              ) : (
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
              )}
            </div>

            {/* 6-Character Passcode & 30-Second Countdown */}
            <div className="mt-3.5 text-center flex flex-col items-center w-full max-w-xs">
              <div className="flex items-center justify-between w-full px-1 text-[11px] text-slate-500 font-semibold mb-1">
                <span className="uppercase tracking-wider">Passcode</span>
                {isPhoneConnected ? (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Paired
                  </span>
                ) : (
                  <span className="font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Changes in <strong className="text-slate-800">{secondsRemaining}s</strong></span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-center w-full">
                <span className="text-2xl font-mono font-bold tracking-widest text-slate-900 bg-white px-4 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  {activePasscode}
                </span>
                <button
                  onClick={rotatePasscode}
                  disabled={isPhoneConnected}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Generate new passcode now (resets 30s timer)"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* 30-Second Animated Progress Bar */}
              {!isPhoneConnected && (
                <div className="w-full bg-slate-200/80 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(secondsRemaining / PASSCODE_TTL) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <p className="text-xs text-slate-600 text-center leading-relaxed">
            Scan the QR code with your phone camera or enter the passcode at{' '}
            <span className="font-mono font-medium text-slate-800">/remote</span>. Passcode refreshes every 30 seconds for security.
          </p>

          {/* Direct Actions: Copy Link & Open in Tab */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Link' : 'Copy Remote URL'}
            </button>
            <a
              href={pairingUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors shrink-0"
              title="Test the touchpad interface directly in a new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Controller
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

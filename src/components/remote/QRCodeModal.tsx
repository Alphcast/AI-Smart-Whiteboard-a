/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  X,
  RefreshCw,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Radio,
  Unplug,
} from 'lucide-react';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

export interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardTitle?: string;
  sessionId?: string | null;
  passcode?: string | null;
  title?: string;
  subtitle?: string;
  isPhoneConnected?: boolean;
  onPhoneConnectionChange?: (connected: boolean) => void;
  onSessionReady?: (sessionId: string, passcode?: string) => void;
}

type PairingStep = 'generating' | 'awaiting_scan' | 'scanned' | 'connected' | 'rejected';

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  boardId,
  boardTitle = 'Interactive Whiteboard',
  sessionId: propSessionId,
  passcode: propPasscode,
  title = 'Connect Smartphone Touchpad',
  subtitle = 'Wireless touchpad, live handwriting & whiteboard controller',
  isPhoneConnected = false,
  onPhoneConnectionChange,
  onSessionReady,
}) => {
  const [pairingStep, setPairingStep] = useState<PairingStep>('generating');
  const [activeSessionId, setActiveSessionId] = useState<string>(propSessionId || '');
  const [activePasscode, setActivePasscode] = useState<string>(propPasscode || '');
  const [activeToken, setActiveToken] = useState<string>('');
  const [phoneDeviceInfo, setPhoneDeviceInfo] = useState<string>('');
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollTimerRef = useRef<any>(null);

  // Generate QR Code visuals (SVG + DataURL)
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
  }, []);

  // Initialize a fresh, secure pairing session
  const initPairingSession = useCallback(async () => {
    setPairingStep('generating');
    setErrorMsg(null);

    try {
      const session = await api.createRemoteSession(boardId, undefined, undefined, boardTitle);
      setActiveSessionId(session.sessionId);
      setActivePasscode(session.passcode);
      setActiveToken(session.authToken);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const fullUrl = session.publicUrl || `${origin}${session.url}`;
      setPairingUrl(fullUrl);

      await renderQRCode(fullUrl);

      onSessionReady?.(session.sessionId, session.passcode);

      // Bind socket as display listener
      socket.bindRemote(session.sessionId, 'display', session.passcode, session.authToken);

      setPairingStep('awaiting_scan');
    } catch (err: any) {
      console.error('[QRCodeModal] Failed to create pairing session:', err);
      setErrorMsg('Failed to initialize pairing session. Please try again.');
      setPairingStep('awaiting_scan');
    }
  }, [boardId, boardTitle, onSessionReady, renderQRCode]);

  // Setup modal lifecycle and real-time socket events
  useEffect(() => {
    if (!isOpen) return;

    if (isPhoneConnected) {
      setPairingStep('connected');
    } else {
      initPairingSession();
    }

    // 1. Phone reports QR scan detected (WhatsApp Web step 1)
    const unsubScanned = socket.on('remote:scan_detected', (data) => {
      console.log('[QRCodeModal] QR scan detected on phone:', data);
      if (data?.deviceInfo) setPhoneDeviceInfo(data.deviceInfo);
      setPairingStep('scanned');
    });

    // 2. Phone user explicitly approved connection (WhatsApp Web step 2)
    const unsubApproved = socket.on('remote:approved', (data) => {
      console.log('[QRCodeModal] Remote connection approved by user:', data);
      if (data?.deviceInfo) setPhoneDeviceInfo(data.deviceInfo);
      setPairingStep('connected');
      onPhoneConnectionChange?.(true);
    });

    const unsubPaired = socket.on('remote:phone_paired', (data) => {
      console.log('[QRCodeModal] Remote phone paired:', data);
      if (data?.deviceInfo) setPhoneDeviceInfo(data.deviceInfo);
      setPairingStep('connected');
      onPhoneConnectionChange?.(true);
    });

    // 3. Phone user rejected connection
    const unsubRejected = socket.on('remote:rejected', (data) => {
      console.warn('[QRCodeModal] Remote connection declined by user:', data);
      setPairingStep('rejected');
      onPhoneConnectionChange?.(false);
    });

    // 4. Phone disconnected
    const unsubDisc = socket.on('remote:phone_disconnected', () => {
      console.log('[QRCodeModal] Remote phone disconnected');
      setPairingStep('awaiting_scan');
      onPhoneConnectionChange?.(false);
    });

    // 5. Periodic status check fallback
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      if (!activeSessionId) return;
      try {
        const sess = await api.getRemoteSession(activeSessionId);
        if (sess.state === 'connected' && sess.connectedControllersCount > 0) {
          setPairingStep('connected');
          if (sess.deviceInfo) setPhoneDeviceInfo(sess.deviceInfo);
          onPhoneConnectionChange?.(true);
        } else if (sess.state === 'scanned') {
          setPairingStep('scanned');
          if (sess.deviceInfo) setPhoneDeviceInfo(sess.deviceInfo);
        } else if (sess.state === 'rejected') {
          setPairingStep('rejected');
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      unsubScanned();
      unsubApproved();
      unsubPaired();
      unsubRejected();
      unsubDisc();
    };
  }, [isOpen, isPhoneConnected, initPairingSession, onPhoneConnectionChange, activeSessionId]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!pairingUrl) return;
    navigator.clipboard.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnectPhone = async () => {
    if (activeSessionId) {
      try {
        await api.disconnectRemoteSession(activeSessionId);
      } catch {
        // ignore
      }
    }
    setPairingStep('awaiting_scan');
    onPhoneConnectionChange?.(false);
    initPairingSession();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Real-time Connection Lifecycle Status Banner */}
          {pairingStep === 'connected' ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
                <div>
                  <span className="font-bold block">Phone Connected & Authorized ✓</span>
                  <span className="text-[11px] text-emerald-700">
                    {phoneDeviceInfo || 'Wireless Touchpad Active'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleDisconnectPhone}
                className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Disconnect Phone"
              >
                <Unplug className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : pairingStep === 'scanned' ? (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-3 text-xs animate-in fade-in">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
              <div>
                <span className="font-bold block">QR Code Scanned!</span>
                <span className="text-[11px] text-blue-700">
                  Waiting for you to tap <strong>&ldquo;Approve & Connect&rdquo;</strong> on your phone...
                </span>
              </div>
            </div>
          ) : pairingStep === 'rejected' ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pairing was declined on phone</span>
              </div>
              <button
                onClick={initPairingSession}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-semibold">Waiting for QR scan...</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Code: {activePasscode || '------'}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Connected State View */}
          {pairingStep === 'connected' ? (
            <div className="p-6 bg-slate-50/80 border border-slate-200 rounded-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Touchpad Ready to Use</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  Your phone is actively controlling this whiteboard. Glide your finger on the trackpad to move or draw, tap to click, and type text in real time.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Start Using Whiteboard
                </button>
              </div>
            </div>
          ) : (
            /* QR Code Pairing View */
            <div className="flex flex-col items-center justify-center p-5 bg-slate-50/80 border border-slate-200 rounded-2xl relative">
              <div className="w-56 h-56 bg-white p-2.5 rounded-xl shadow-xs border border-slate-200/80 flex items-center justify-center overflow-hidden">
                {pairingStep === 'generating' ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Generating QR...</span>
                  </div>
                ) : qrSvg ? (
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

              {/* Passcode & Security Notice */}
              <div className="mt-3.5 text-center flex flex-col items-center w-full max-w-xs space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Pairing Passcode
                </span>

                <div className="flex items-center gap-2 justify-center">
                  <span className="text-2xl font-mono font-bold tracking-widest text-slate-900 bg-white px-4 py-1 rounded-xl border border-slate-200 shadow-2xs">
                    {activePasscode || '------'}
                  </span>
                  <button
                    onClick={initPairingSession}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                    title="Generate new QR & Passcode"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  <span>Secure end-to-end token verification</span>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          {pairingStep !== 'connected' && (
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              Scan with your phone&apos;s camera app, then tap <strong>&ldquo;Approve &amp; Connect&rdquo;</strong> to link.
            </p>
          )}

          {/* Action Links */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleCopyLink}
              disabled={!pairingUrl}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied URL' : 'Copy Remote Link'}
            </button>
            <a
              href={pairingUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors shrink-0"
              title="Test controller directly in a browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Controller</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, CheckCircle2, Copy, Check, ExternalLink, X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

interface ConnectPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  isPhoneConnected: boolean;
  onPhoneConnectionChange: (connected: boolean) => void;
  onSessionReady?: (sessionId: string, passcode?: string) => void;
}

export const ConnectPhoneModal: React.FC<ConnectPhoneModalProps> = ({
  isOpen,
  onClose,
  boardId,
  isPhoneConnected,
  onPhoneConnectionChange,
  onSessionReady,
}) => {
  const [sessionData, setSessionData] = useState<{
    sessionId: string;
    passcode: string;
    url: string;
    publicUrl?: string;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const pollIntervalRef = React.useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    api
      .createRemoteSession(boardId)
      .then(async (session) => {
        if (!isMounted) return;
        setSessionData(session);
        onSessionReady?.(session.sessionId, session.passcode);

        // Bind laptop as display socket with WebRTC P2P passcode host
        socket.bindRemote(session.sessionId, 'display', session.passcode);

        // Always prioritize the live browser origin (so phone connects to the exact same deployment/Vercel URL)
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${currentOrigin}${session.url}`;

        const qrUrl = await QRCode.toDataURL(fullUrl, {
          width: 240,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        if (isMounted) {
          setQrDataUrl(qrUrl);
          setLoading(false);
        }

        // Poll session status periodically as secondary check
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(async () => {
          if (!isMounted) return;
          try {
            const status = await api.getRemoteSession(session.sessionId);
            if (status.connectedControllers > 0) {
              onPhoneConnectionChange(true);
            }
          } catch {
            // ignore
          }
        }, 1500);
      })
      .catch((err) => {
        console.error('Failed to create remote session:', err);
        if (isMounted) setLoading(false);
      });

    // Listen for phone paired event
    const unsubPaired = socket.on('remote:phone_paired', () => {
      onPhoneConnectionChange(true);
    });

    const unsubDisconnect = socket.on('remote:phone_disconnected', () => {
      onPhoneConnectionChange(false);
    });

    return () => {
      isMounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      unsubPaired();
      unsubDisconnect();
    };
  }, [isOpen, boardId, onPhoneConnectionChange, onSessionReady]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullPairingUrl = sessionData
    ? `${currentOrigin}${sessionData.url}`
    : '';

  const handleCopyLink = () => {
    if (!fullPairingUrl) return;
    navigator.clipboard.writeText(fullPairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Connect Your Phone</h3>
            <p className="text-xs text-slate-500">Wireless touchpad, drawing & slide controller</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Generating secure pairing session...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Banner */}
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
                  {isPhoneConnected ? 'Phone Connected ✓' : 'Waiting for phone scan...'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {isPhoneConnected ? 'Latency: ~12ms' : 'Ready to pair'}
              </span>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50/80 border border-slate-200 rounded-2xl">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Pairing QR Code"
                  className="w-48 h-48 rounded-xl shadow-sm border border-slate-100"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                  Loading QR Code...
                </div>
              )}

              {/* 6-char passcode */}
              <div className="mt-3 text-center">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
                  Connection Passcode
                </span>
                <span className="text-2xl font-mono font-bold tracking-widest text-slate-900">
                  {sessionData?.passcode || '------'}
                </span>
              </div>
            </div>

            {/* Instructions */}
            <p className="text-xs text-slate-600 text-center">
              Scan the QR code with your phone camera or tablet browser to instantly turn your device into a
              remote touchpad.
            </p>

            {/* Direct Link & Test Button */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied Link' : 'Copy Remote URL'}
              </button>
              <a
                href={fullPairingUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                title="Test remote control in a new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Controller
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

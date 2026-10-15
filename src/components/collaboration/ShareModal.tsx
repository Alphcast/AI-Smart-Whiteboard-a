/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { Share2, Copy, Check, Users, Shield, X, Smartphone, QrCode as QrIcon, ExternalLink } from 'lucide-react';
import { Whiteboard } from '../../types/whiteboard';
import { socket } from '../../services/socket';
import { api } from '../../services/api';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Whiteboard;
  sessionId?: string | null;
  passcode?: string | null;
  isPhoneConnected?: boolean;
  onPhoneConnectionChange?: (connected: boolean) => void;
  onOpenPhoneRemote?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  board,
  sessionId: propSessionId,
  passcode: propPasscode,
  isPhoneConnected = false,
  onPhoneConnectionChange,
  onOpenPhoneRemote,
}) => {
  const [activeTab, setActiveTab] = useState<'remote' | 'collaborate'>('remote');
  const [permission, setPermission] = useState<'editor' | 'viewer'>('editor');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRemote, setCopiedRemote] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string>(propSessionId || '');
  const [activePasscode, setActivePasscode] = useState<string>(propPasscode || '');
  const [remoteUrl, setRemoteUrl] = useState<string>('');
  const [phoneState, setPhoneState] = useState<'awaiting_scan' | 'scanned' | 'connected'>('awaiting_scan');

  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${currentOrigin}/whiteboard/${board.id}?role=${permission}`;

  const renderQRCode = useCallback(async (url: string) => {
    if (!url) return;
    const qrLib: any = (QRCode as any)?.default || QRCode;

    try {
      if (typeof qrLib?.toString === 'function') {
        const svgString = await qrLib.toString(url, {
          type: 'svg',
          width: 220,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        setQrSvg(svgString);
      }
    } catch {
      // ignore
    }

    try {
      if (typeof qrLib?.toDataURL === 'function') {
        const dataUrl = await qrLib.toDataURL(url, {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (isPhoneConnected) {
      setPhoneState('connected');
    }

    // Initialize or fetch secure remote session
    api
      .createRemoteSession(board.id, propSessionId || undefined, propPasscode || undefined, board.title)
      .then((sess) => {
        setActiveSessionId(sess.sessionId);
        setActivePasscode(sess.passcode);
        const fullUrl = sess.publicUrl || `${currentOrigin}${sess.url}`;
        setRemoteUrl(fullUrl);
        renderQRCode(fullUrl);
        socket.bindRemote(sess.sessionId, 'display', sess.passcode, sess.authToken);
      })
      .catch(() => {
        const fallbackUrl = `${currentOrigin}/remote?session=${encodeURIComponent(activeSessionId || board.id)}`;
        setRemoteUrl(fallbackUrl);
        renderQRCode(fallbackUrl);
      });

    const unsubScanned = socket.on('remote:scan_detected', () => {
      setPhoneState('scanned');
    });

    const unsubApproved = socket.on('remote:approved', () => {
      setPhoneState('connected');
      onPhoneConnectionChange?.(true);
    });

    const unsubPaired = socket.on('remote:phone_paired', () => {
      setPhoneState('connected');
      onPhoneConnectionChange?.(true);
    });

    const unsubDisc = socket.on('remote:phone_disconnected', () => {
      setPhoneState('awaiting_scan');
      onPhoneConnectionChange?.(false);
    });

    return () => {
      unsubScanned();
      unsubApproved();
      unsubPaired();
      unsubDisc();
    };
  }, [isOpen, isPhoneConnected, board.id, board.title, propSessionId, propPasscode, currentOrigin, renderQRCode, onPhoneConnectionChange]);

  if (!isOpen) return null;

  const handleCopyShare = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyRemote = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopiedRemote(true);
    setTimeout(() => setCopiedRemote(false), 2000);
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
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Share & Connect</h3>
            <p className="text-xs text-slate-500">Scan QR for phone touchpad or share live whiteboard link</p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('remote')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
              activeTab === 'remote'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Phone Touchpad (QR)</span>
          </button>
          <button
            onClick={() => setActiveTab('collaborate')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
              activeTab === 'collaborate'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Invite Collaborators</span>
          </button>
        </div>

        {/* Tab 1: Smartphone Touchpad QR Code */}
        {activeTab === 'remote' && (
          <div className="space-y-4">
            <div
              className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition-colors ${
                isPhoneConnected
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPhoneConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="font-semibold">
                  {isPhoneConnected ? 'Phone Connected ✓' : 'Scan to Control Whiteboard'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {isPhoneConnected ? 'Active' : 'Passcode: ' + activePasscode}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-50/80 border border-slate-200 rounded-2xl">
              <div className="w-48 h-48 bg-white p-2 rounded-xl shadow-2xs border border-slate-200 flex items-center justify-center overflow-hidden">
                {qrSvg ? (
                  <div
                    className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="Phone Remote QR" className="w-full h-full object-contain" />
                ) : (
                  <canvas ref={canvasRef} className="w-full h-full object-contain" />
                )}
              </div>

              <div className="mt-3 text-center">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
                  Pairing Passcode
                </span>
                <span className="text-xl font-mono font-bold tracking-widest text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs inline-block mt-0.5">
                  {activePasscode}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 text-center">
              Scan with your phone to use it as a wireless writing pad, laser pointer, and whiteboard remote.
            </p>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleCopyRemote}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                {copiedRemote ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedRemote ? 'Copied' : 'Copy Remote Link'}
              </button>
              <a
                href={remoteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Controller
              </a>
            </div>
          </div>
        )}

        {/* Tab 2: Web Collaboration Link */}
        {activeTab === 'collaborate' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">General Access</span>
              </div>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'editor' | 'viewer')}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="editor">Can Edit</option>
                <option value="viewer">View Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 outline-none select-all"
              />
              <button
                onClick={handleCopyShare}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50/60 rounded-xl text-blue-900 text-xs">
              <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                Anyone with this link can join this board session in real-time. Changes sync automatically across all
                connected browsers.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Share2, Copy, Check, Users, Shield, X } from 'lucide-react';
import { Whiteboard } from '../../types/whiteboard';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Whiteboard;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, board }) => {
  const [permission, setPermission] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/whiteboard/${board.id}?role=${permission}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
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
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Share Whiteboard</h3>
            <p className="text-xs text-slate-500">Collaborate live with students, teachers, and teams</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Permission selector */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">General Access</span>
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

          {/* Link box */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 outline-none select-all"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50/60 rounded-xl text-blue-900 text-xs">
            <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Anyone with this link can join this board session in real-time. Changes sync automatically across all
              connected browsers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

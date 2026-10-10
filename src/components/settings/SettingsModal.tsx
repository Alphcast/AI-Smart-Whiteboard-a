/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings, Command, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Whiteboard Settings & Shortcuts</h3>
            <p className="text-xs text-slate-500">Keyboard shortcuts and canvas preferences</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Shortcuts table */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Command className="w-3.5 h-3.5" /> Keyboard Shortcuts
            </span>
            <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200/60 overflow-hidden">
              <div className="flex justify-between items-center p-2.5">
                <span className="text-slate-700">Select & Move Tool</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700">V</kbd>
              </div>
              <div className="flex justify-between items-center p-2.5">
                <span className="text-slate-700">Pan Canvas</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700">H or Space+Drag</kbd>
              </div>
              <div className="flex justify-between items-center p-2.5">
                <span className="text-slate-700">Pen Tool</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700">P</kbd>
              </div>
              <div className="flex justify-between items-center p-2.5">
                <span className="text-slate-700">Eraser Tool</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700">E</kbd>
              </div>
              <div className="flex justify-between items-center p-2.5">
                <span className="text-slate-700">Text Tool</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700">T</kbd>
              </div>
              <div className="flex justify-between items-center p-2.5">
                <span className="text-slate-700">Undo / Redo</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700">Ctrl+Z / Ctrl+Y</kbd>
              </div>
              <div className="flex justify-between items-center p-2.5">
                <span className="text-slate-700">Zoom In / Out</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-700">Ctrl + Mouse Wheel</kbd>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

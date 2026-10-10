/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Download,
  FileImage,
  FileCode,
  FileText,
  Copy,
  Check,
  X,
  Sparkles,
  Layers,
  Crop,
  Maximize,
  Sliders,
} from 'lucide-react';
import { Whiteboard } from '../../types/whiteboard';
import {
  exportToPNG,
  exportToSVG,
  exportToJSON,
  copyCanvasToClipboard,
  exportAllPagesToPNG,
  exportAllPagesToSVG,
} from '../../utils/export';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Whiteboard;
  currentPageId: string;
  onToast?: (message: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  board,
  currentPageId,
  onToast,
}) => {
  const [format, setFormat] = useState<'png' | 'svg' | 'pdf' | 'json'>('png');
  const [resolution, setResolution] = useState<1 | 2 | 3>(2);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [includeGrid, setIncludeGrid] = useState(true);
  const [autoCrop, setAutoCrop] = useState(true);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const currentPage = board.pages.find((p) => p.id === currentPageId) || board.pages[0];
  const currentObjects = board.objects[currentPageId] || [];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const options = {
        resolution,
        transparentBackground,
        includeGrid,
        autoCrop,
      };

      if (format === 'png') {
        if (scope === 'all') {
          await exportAllPagesToPNG(board, options);
          onToast?.(`Exported all ${board.pages.length} pages as PNG images`);
        } else {
          exportToPNG(board.title, currentPage.title, currentObjects, currentPage, options);
          onToast?.(`Downloaded ${currentPage.title}.png (${resolution}x HD)`);
        }
      } else if (format === 'svg') {
        if (scope === 'all') {
          await exportAllPagesToSVG(board, options);
          onToast?.(`Exported all ${board.pages.length} pages as SVG vectors`);
        } else {
          exportToSVG(board, currentPageId, options);
          onToast?.(`Downloaded ${currentPage.title}.svg (Vector)`);
        }
      } else if (format === 'json') {
        exportToJSON(board);
        onToast?.(`Exported whiteboard backup data (.json)`);
      } else if (format === 'pdf') {
        window.print();
      }
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickCopyPNG = async () => {
    setIsExporting(true);
    const success = await copyCanvasToClipboard(currentObjects, currentPage, {
      resolution: 2,
      transparentBackground,
      includeGrid,
      autoCrop,
    });
    setIsExporting(false);
    if (success) {
      setIsCopied(true);
      onToast?.('Canvas copied to clipboard as PNG! Ready to paste (Ctrl+V)');
      setTimeout(() => setIsCopied(false), 2500);
    } else {
      // Fallback: download PNG directly
      exportToPNG(board.title, currentPage.title, currentObjects, currentPage, {
        resolution: 2,
        transparentBackground,
        includeGrid,
        autoCrop,
      });
      onToast?.('Clipboard unavailable, downloaded PNG instead');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Export Whiteboard</h3>
            <p className="text-xs text-slate-500">
              Save or share canvas in crisp PNG, SVG vector, or print format
            </p>
          </div>
        </div>

        {/* Canvas stats summary pill */}
        <div className="mb-4 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium truncate">
            <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-slate-900 font-semibold">{currentPage?.title}</span>
            <span className="text-slate-400">•</span>
            <span>{currentObjects.length} canvas objects</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
            Page {board.pages.findIndex((p) => p.id === currentPageId) + 1} of {board.pages.length}
          </span>
        </div>

        <div className="space-y-4 text-xs">
          {/* Format selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Choose Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('png')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  format === 'png'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-2 ring-blue-500/30'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700">
                  <FileImage className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">PNG Image</div>
                  <div className="text-[11px] text-slate-500">Crisp high-res bitmap</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('svg')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  format === 'svg'
                    ? 'border-purple-600 bg-purple-50/60 text-purple-900 ring-2 ring-purple-500/30'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-purple-100/70 text-purple-700">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">SVG Vector</div>
                  <div className="text-[11px] text-slate-500">Infinite scaling, Figma / web</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  format === 'pdf'
                    ? 'border-rose-600 bg-rose-50/60 text-rose-900 ring-2 ring-rose-500/30'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-rose-100/70 text-rose-700">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">PDF Document</div>
                  <div className="text-[11px] text-slate-500">Printable lesson notes</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  format === 'json'
                    ? 'border-amber-600 bg-amber-50/60 text-amber-900 ring-2 ring-amber-500/30'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-amber-100/70 text-amber-700">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Whiteboard JSON</div>
                  <div className="text-[11px] text-slate-500">Full editable data backup</div>
                </div>
              </button>
            </div>
          </div>

          {/* Format-specific customizations */}
          {format === 'png' && (
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Resolution Scale:</span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setResolution(1)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      resolution === 1 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    1x (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution(2)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      resolution === 2 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    2x (Retina HD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution(3)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      resolution === 3 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    3x (Ultra 4K)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transparentBackground}
                    onChange={(e) => setTransparentBackground(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Transparent Background</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeGrid}
                    onChange={(e) => setIncludeGrid(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Include Grid Pattern</span>
                </label>
              </div>

              <div className="pt-1 border-t border-slate-200/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoCrop}
                    onChange={(e) => setAutoCrop(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">
                    Auto-crop to drawn content (neat margins)
                  </span>
                </label>
              </div>
            </div>
          )}

          {format === 'svg' && (
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transparentBackground}
                    onChange={(e) => setTransparentBackground(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-700">Transparent Canvas</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeGrid}
                    onChange={(e) => setIncludeGrid(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-700">Include Grid Lines</span>
                </label>
              </div>

              <div className="pt-1 border-t border-slate-200/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoCrop}
                    onChange={(e) => setAutoCrop(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-700">Auto-crop to drawn content viewBox</span>
                </label>
              </div>
            </div>
          )}

          {/* Scope selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Pages to Export
            </label>
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'current'}
                  onChange={() => setScope('current')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700 font-medium">
                  Current Page ({currentPage.title})
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700 font-medium">
                  All Pages ({board.pages.length} total)
                </span>
              </label>
            </div>
          </div>

          {/* Quick Copy Action for PNG */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Quick Copy Image</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Copy PNG directly to clipboard to paste into Docs, Slack, or email
              </p>
            </div>
            <button
              type="button"
              onClick={handleQuickCopyPNG}
              disabled={isExporting}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white hover:bg-slate-50 text-blue-700 border border-blue-200'
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy PNG</span>
                </>
              )}
            </button>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-2 active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Generating File...'
                  : format === 'png'
                  ? `Download PNG (${resolution}x)`
                  : format === 'svg'
                  ? 'Download SVG Vector'
                  : format === 'pdf'
                  ? 'Print / Save PDF'
                  : 'Download JSON Backup'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  MousePointer,
  Hand,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Type,
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowUpRight,
  StickyNote,
  Sigma,
  Undo2,
  Redo2,
  Trash2,
  ChevronRight,
  Download,
  Lock,
} from 'lucide-react';
import { ToolType } from '../../types/whiteboard';

interface WhiteboardToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onRecognizeEquation?: () => void;
  onExport?: () => void;
  readOnly?: boolean;
}

export const WhiteboardToolbar: React.FC<WhiteboardToolbarProps> = ({
  currentTool,
  setTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onRecognizeEquation,
  onExport,
  readOnly = false,
}) => {
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);

  const isShapeActive = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(currentTool);

  return (
    <div className="flex flex-col items-center bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md rounded-xl p-1.5 gap-1 select-none">
      {/* Read-Only Lock Indicator */}
      {readOnly && (
        <div
          className="w-full py-1 px-1 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center gap-1 mb-0.5 border border-amber-200"
          title="Whiteboard editing is locked (View-Only Mode)"
        >
          <Lock className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Select */}
      <button
        onClick={() => setTool('select')}
        className={`p-2.5 rounded-lg transition-colors relative group cursor-pointer ${
          currentTool === 'select' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Select & Move (V)"
      >
        <MousePointer className="w-5 h-5" />
      </button>

      {/* Pan */}
      <button
        onClick={() => setTool('pan')}
        className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
          currentTool === 'pan' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Pan Canvas (H / Space+Drag)"
      >
        <Hand className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Pen */}
      <button
        onClick={() => !readOnly && setTool('pen')}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          readOnly
            ? 'opacity-35 cursor-not-allowed text-slate-400'
            : currentTool === 'pen'
            ? 'bg-blue-50 text-blue-600 cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
        title={readOnly ? 'Drawing locked (View-Only)' : 'Smooth Pen (P)'}
      >
        <Pen className="w-5 h-5" />
      </button>

      {/* Pencil */}
      <button
        onClick={() => !readOnly && setTool('pencil')}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          readOnly
            ? 'opacity-35 cursor-not-allowed text-slate-400'
            : currentTool === 'pencil'
            ? 'bg-blue-50 text-blue-600 cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
        title={readOnly ? 'Drawing locked (View-Only)' : 'Pencil (Fine lines)'}
      >
        <Pencil className="w-5 h-5" />
      </button>

      {/* Highlighter */}
      <button
        onClick={() => !readOnly && setTool('highlighter')}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          readOnly
            ? 'opacity-35 cursor-not-allowed text-slate-400'
            : currentTool === 'highlighter'
            ? 'bg-blue-50 text-blue-600 cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
        title={readOnly ? 'Drawing locked (View-Only)' : 'Highlighter (Semi-transparent)'}
      >
        <Highlighter className="w-5 h-5" />
      </button>

      {/* Eraser */}
      <button
        onClick={() => !readOnly && setTool('eraser')}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          readOnly
            ? 'opacity-35 cursor-not-allowed text-slate-400'
            : currentTool === 'eraser'
            ? 'bg-blue-50 text-blue-600 cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
        title={readOnly ? 'Eraser locked (View-Only)' : 'Eraser (E)'}
      >
        <Eraser className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Text */}
      <button
        onClick={() => !readOnly && setTool('text')}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          readOnly
            ? 'opacity-35 cursor-not-allowed text-slate-400'
            : currentTool === 'text'
            ? 'bg-blue-50 text-blue-600 cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
        title={readOnly ? 'Text locked (View-Only)' : 'Text (T)'}
      >
        <Type className="w-5 h-5" />
      </button>

      {/* Equation Tool */}
      <button
        onClick={() => {
          if (readOnly) return;
          setTool('equation');
          if (onRecognizeEquation) onRecognizeEquation();
        }}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors relative ${
          readOnly
            ? 'opacity-35 cursor-not-allowed text-slate-400'
            : currentTool === 'equation'
            ? 'bg-blue-600 text-white shadow-sm cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
        title={readOnly ? 'Equation tool locked (View-Only)' : 'Equation Tool: write math or recognize equation'}
      >
        <Sigma className="w-5 h-5" />
      </button>

      {/* Shapes Dropdown / Flyout */}
      <div className="relative">
        <button
          onClick={() => !readOnly && setShapesMenuOpen(!shapesMenuOpen)}
          disabled={readOnly}
          className={`p-2.5 rounded-lg transition-colors flex items-center justify-center relative ${
            readOnly
              ? 'opacity-35 cursor-not-allowed text-slate-400'
              : isShapeActive
              ? 'bg-blue-50 text-blue-600 cursor-pointer'
              : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
          }`}
          title={readOnly ? 'Shapes locked (View-Only)' : 'Shapes (Rectangle, Circle, Triangle, Line, Arrow)'}
        >
          {currentTool === 'rectangle' ? (
            <Square className="w-5 h-5" />
          ) : currentTool === 'circle' ? (
            <Circle className="w-5 h-5" />
          ) : currentTool === 'triangle' ? (
            <Triangle className="w-5 h-5" />
          ) : currentTool === 'line' ? (
            <Minus className="w-5 h-5" />
          ) : currentTool === 'arrow' ? (
            <ArrowUpRight className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5" />
          )}
          <ChevronRight className="w-2.5 h-2.5 absolute bottom-1 right-0.5 opacity-60" />
        </button>

        {shapesMenuOpen && !readOnly && (
          <div className="absolute left-full top-0 ml-2 bg-white border border-slate-200 shadow-lg rounded-xl p-1 flex flex-col gap-1 z-50">
            <button
              onClick={() => {
                setTool('rectangle');
                setShapesMenuOpen(false);
              }}
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer ${
                currentTool === 'rectangle' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Square className="w-4 h-4" /> Rectangle
            </button>
            <button
              onClick={() => {
                setTool('circle');
                setShapesMenuOpen(false);
              }}
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer ${
                currentTool === 'circle' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Circle className="w-4 h-4" /> Circle
            </button>
            <button
              onClick={() => {
                setTool('triangle');
                setShapesMenuOpen(false);
              }}
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer ${
                currentTool === 'triangle' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Triangle className="w-4 h-4" /> Triangle
            </button>
            <button
              onClick={() => {
                setTool('line');
                setShapesMenuOpen(false);
              }}
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer ${
                currentTool === 'line' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Minus className="w-4 h-4" /> Line
            </button>
            <button
              onClick={() => {
                setTool('arrow');
                setShapesMenuOpen(false);
              }}
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium cursor-pointer ${
                currentTool === 'arrow' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> Arrow
            </button>
          </div>
        )}
      </div>

      {/* Sticky Note */}
      <button
        onClick={() => !readOnly && setTool('sticky')}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          readOnly
            ? 'opacity-35 cursor-not-allowed text-slate-400'
            : currentTool === 'sticky'
            ? 'bg-blue-50 text-blue-600 cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
        title={readOnly ? 'Sticky notes locked (View-Only)' : 'Sticky Note (N)'}
      >
        <StickyNote className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo || readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          canUndo && !readOnly ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-5 h-5" />
      </button>

      {/* Redo */}
      <button
        onClick={onRedo}
        disabled={!canRedo || readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          canRedo && !readOnly ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-5 h-5" />
      </button>

      {/* Clear Page */}
      <button
        onClick={onClear}
        disabled={readOnly}
        className={`p-2.5 rounded-lg transition-colors ${
          readOnly
            ? 'text-slate-300 opacity-40 cursor-not-allowed'
            : 'text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer'
        }`}
        title={readOnly ? 'Clear disabled in View-Only mode' : 'Clear Current Page'}
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Export Canvas */}
      {onExport && (
        <button
          onClick={onExport}
          className="p-2.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Export Canvas as PNG / SVG"
        >
          <Download className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

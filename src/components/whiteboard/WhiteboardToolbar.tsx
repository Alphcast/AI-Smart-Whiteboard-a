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
}) => {
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);

  const isShapeActive = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(currentTool);

  return (
    <div className="flex flex-col items-center bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md rounded-xl p-1.5 gap-1 select-none">
      {/* Select */}
      <button
        onClick={() => setTool('select')}
        className={`p-2.5 rounded-lg transition-colors relative group ${
          currentTool === 'select' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Select & Move (V)"
      >
        <MousePointer className="w-5 h-5" />
      </button>

      {/* Pan */}
      <button
        onClick={() => setTool('pan')}
        className={`p-2.5 rounded-lg transition-colors ${
          currentTool === 'pan' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Pan Canvas (H / Space+Drag)"
      >
        <Hand className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Pen */}
      <button
        onClick={() => setTool('pen')}
        className={`p-2.5 rounded-lg transition-colors ${
          currentTool === 'pen' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Smooth Pen (P)"
      >
        <Pen className="w-5 h-5" />
      </button>

      {/* Pencil */}
      <button
        onClick={() => setTool('pencil')}
        className={`p-2.5 rounded-lg transition-colors ${
          currentTool === 'pencil' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Pencil (Fine lines)"
      >
        <Pencil className="w-5 h-5" />
      </button>

      {/* Highlighter */}
      <button
        onClick={() => setTool('highlighter')}
        className={`p-2.5 rounded-lg transition-colors ${
          currentTool === 'highlighter' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Highlighter (Semi-transparent)"
      >
        <Highlighter className="w-5 h-5" />
      </button>

      {/* Eraser */}
      <button
        onClick={() => setTool('eraser')}
        className={`p-2.5 rounded-lg transition-colors ${
          currentTool === 'eraser' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Eraser (E)"
      >
        <Eraser className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Text */}
      <button
        onClick={() => setTool('text')}
        className={`p-2.5 rounded-lg transition-colors ${
          currentTool === 'text' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Text (T)"
      >
        <Type className="w-5 h-5" />
      </button>

      {/* Equation Tool */}
      <button
        onClick={() => {
          setTool('equation');
          if (onRecognizeEquation) onRecognizeEquation();
        }}
        className={`p-2.5 rounded-lg transition-colors relative ${
          currentTool === 'equation' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Equation Tool: write math or recognize equation"
      >
        <Sigma className="w-5 h-5" />
      </button>

      {/* Shapes Dropdown / Flyout */}
      <div className="relative">
        <button
          onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
          className={`p-2.5 rounded-lg transition-colors flex items-center justify-center relative ${
            isShapeActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
          }`}
          title="Shapes (Rectangle, Circle, Triangle, Line, Arrow)"
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

        {shapesMenuOpen && (
          <div className="absolute left-full top-0 ml-2 bg-white border border-slate-200 shadow-lg rounded-xl p-1 flex flex-col gap-1 z-50">
            <button
              onClick={() => {
                setTool('rectangle');
                setShapesMenuOpen(false);
              }}
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium ${
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
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium ${
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
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium ${
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
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium ${
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
              className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium ${
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
        onClick={() => setTool('sticky')}
        className={`p-2.5 rounded-lg transition-colors ${
          currentTool === 'sticky' ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-100'
        }`}
        title="Sticky Note (N)"
      >
        <StickyNote className="w-5 h-5" />
      </button>

      <div className="w-6 h-px bg-slate-200 my-0.5" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-2.5 rounded-lg transition-colors ${
          canUndo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-5 h-5" />
      </button>

      {/* Redo */}
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-2.5 rounded-lg transition-colors ${
          canRedo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-5 h-5" />
      </button>

      {/* Clear Page */}
      <button
        onClick={onClear}
        className="p-2.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        title="Clear Current Page"
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

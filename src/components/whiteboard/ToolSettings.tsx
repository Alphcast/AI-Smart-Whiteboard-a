/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToolType, BackgroundPattern } from '../../types/whiteboard';

interface ToolSettingsProps {
  currentTool: ToolType;
  color: string;
  setColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  backgroundPattern: BackgroundPattern;
  setBackgroundPattern: (pattern: BackgroundPattern) => void;
  fillColor: string;
  setFillColor: (fill: string) => void;
}

const PRESET_COLORS = [
  '#0f172a', // Slate black
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#d97706', // Amber
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#ffffff', // White
];

const PRESET_FILLS = [
  'transparent',
  '#dbeafe', // light blue
  '#fee2e2', // light red
  '#dcfce7', // light green
  '#fef3c7', // light yellow
  '#f3e8ff', // light purple
];

export const ToolSettings: React.FC<ToolSettingsProps> = ({
  currentTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  backgroundPattern,
  setBackgroundPattern,
  fillColor,
  setFillColor,
}) => {
  const isStrokeTool = ['pen', 'pencil', 'highlighter', 'line', 'arrow'].includes(currentTool);
  const isShapeTool = ['rectangle', 'circle', 'triangle'].includes(currentTool);
  const isTextTool = currentTool === 'text';

  return (
    <div className="flex items-center gap-4 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 text-xs text-slate-700">
      {/* Colors */}
      {(isStrokeTool || isShapeTool || isTextTool) && (
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
          <span className="text-slate-400 font-medium mr-1">Color:</span>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-5 h-5 rounded-full border border-slate-300 transition-transform ${
                color === c ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'
              }`}
              title={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-5 h-5 rounded border border-slate-300 cursor-pointer ml-1 p-0"
            title="Custom color"
          />
        </div>
      )}

      {/* Shape Fill */}
      {isShapeTool && (
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
          <span className="text-slate-400 font-medium mr-1">Fill:</span>
          {PRESET_FILLS.map((f) => (
            <button
              key={f}
              onClick={() => setFillColor(f)}
              style={{ backgroundColor: f === 'transparent' ? '#ffffff' : f }}
              className={`w-5 h-5 rounded border border-slate-300 transition-transform relative ${
                fillColor === f ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'
              }`}
              title={f === 'transparent' ? 'No Fill' : f}
            >
              {f === 'transparent' && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-red-500">
                  /
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Stroke Width */}
      {(isStrokeTool || isShapeTool) && (
        <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
          <span className="text-slate-400 font-medium">Size:</span>
          {[2, 4, 8, 14].map((sz) => (
            <button
              key={sz}
              onClick={() => setStrokeWidth(sz)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                strokeWidth === sz
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {sz}px
            </button>
          ))}
        </div>
      )}

      {/* Canvas Grid Style */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 font-medium">Grid:</span>
        {(['blank', 'grid', 'dots', 'lined'] as BackgroundPattern[]).map((pattern) => (
          <button
            key={pattern}
            onClick={() => setBackgroundPattern(pattern)}
            className={`px-2 py-0.5 rounded text-xs capitalize transition-colors ${
              backgroundPattern === pattern
                ? 'bg-slate-900 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {pattern}
          </button>
        ))}
      </div>
    </div>
  );
};

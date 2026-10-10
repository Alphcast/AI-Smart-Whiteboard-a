/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, HelpCircle, ArrowDownToLine, Trash2, Edit3, CheckCircle2 } from 'lucide-react';
import { WhiteboardObject, MathSolution } from '../../types/whiteboard';
import { LatexRenderer } from '../math/LatexRenderer';

interface EquationOverlayProps {
  equations: WhiteboardObject[];
  zoom: number;
  pan: { x: number; y: number };
  onSolve: (equationObj: WhiteboardObject) => void;
  onExplain: (equationObj: WhiteboardObject) => void;
  onInsertSolution: (equationObj: WhiteboardObject, solution: MathSolution) => void;
  onDelete: (id: string) => void;
  onEdit: (equationObj: WhiteboardObject) => void;
}

export const EquationOverlay: React.FC<EquationOverlayProps> = ({
  equations,
  zoom,
  pan,
  onSolve,
  onExplain,
  onInsertSolution,
  onDelete,
  onEdit,
}) => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {equations.map((obj) => {
        const { equationData } = obj;
        if (!equationData) return null;

        const screenX = obj.x * zoom + pan.x;
        const screenY = obj.y * zoom + pan.y;

        const isSolved = equationData.status === 'solved' && equationData.solution;

        return (
          <div
            key={obj.id}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY}px`,
              transform: `scale(${Math.min(Math.max(zoom, 0.6), 1.2)})`,
              transformOrigin: 'top left',
            }}
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md rounded-xl p-4 w-[380px] transition-all hover:shadow-lg hover:border-blue-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Equation Detected</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(obj)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  title="Edit Equation"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(obj.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Remove Equation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expression KaTeX render */}
            <div className="py-3 px-2 my-2 bg-slate-50/80 rounded-lg text-center overflow-x-auto">
              <LatexRenderer
                latex={equationData.latex || equationData.rawExpression}
                displayMode={true}
                className="text-lg text-slate-900"
              />
            </div>

            {/* If Solved: Show Steps & Answer */}
            {isSolved && equationData.solution && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Answer:</span>
                  </div>
                  <LatexRenderer latex={equationData.solution.solution} className="font-bold text-sm text-blue-900" />
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {equationData.solution.steps.map((step) => (
                    <div key={step.stepNumber} className="bg-slate-50 p-2 rounded border border-slate-100 text-slate-700">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 mb-0.5">
                        <span>Step {step.stepNumber}</span>
                        <LatexRenderer latex={step.latex || step.expression} className="text-slate-900" />
                      </div>
                      <p className="text-[11px] text-slate-600">{step.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
              {!isSolved ? (
                <button
                  onClick={() => onSolve(obj)}
                  disabled={equationData.status === 'solving'}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {equationData.status === 'solving' ? 'Solving...' : 'Solve'}
                </button>
              ) : (
                <button
                  onClick={() => onInsertSolution(obj, equationData.solution!)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
                  title="Place solution steps onto the whiteboard canvas"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Insert onto Board
                </button>
              )}

              <button
                onClick={() => onExplain(obj)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                title="Open pedagogical explanation and questions"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Explain
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

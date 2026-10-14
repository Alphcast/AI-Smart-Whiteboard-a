/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Users, Shield, Check, Lock, Unlock, Radio, UserCheck, Eye } from 'lucide-react';
import { LessonParticipant, CollaborationMode } from '../../types/lesson';

interface LiveParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: LessonParticipant[];
  currentRole: 'teacher' | 'student';
  collaborationMode: CollaborationMode;
  onUpdateCollaborationMode: (mode: CollaborationMode) => void;
  onToggleStudentPermission: (userId: string, canEdit: boolean) => void;
}

export const LiveParticipantsModal: React.FC<LiveParticipantsModalProps> = ({
  isOpen,
  onClose,
  participants,
  currentRole,
  collaborationMode,
  onUpdateCollaborationMode,
  onToggleStudentPermission,
}) => {
  if (!isOpen) return null;

  const isTeacher = currentRole === 'teacher';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Classroom Participants</h2>
              <p className="text-[11px] text-slate-500">
                {participants.length} user{participants.length === 1 ? '' : 's'} connected in real time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Permission Controls (Teacher Only) */}
        {isTeacher && (
          <div className="p-4 bg-blue-50/50 border-b border-blue-100/70 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Global Class Collaboration Mode
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateCollaborationMode('everyone_can_edit')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                  collaborationMode === 'everyone_can_edit'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Unlock className="w-3.5 h-3.5" />
                Everyone Can Edit
              </button>

              <button
                type="button"
                onClick={() => onUpdateCollaborationMode('teacher_only')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                  collaborationMode === 'teacher_only'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Teacher-Only
              </button>
            </div>
          </div>
        )}

        {/* Participants List */}
        <div className="p-4 overflow-y-auto space-y-2.5 max-h-[400px]">
          {participants.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Waiting for students to join this lesson room...
            </div>
          ) : (
            participants.map((p) => {
              const isUserTeacher = p.role === 'teacher';

              return (
                <div
                  key={p.userId}
                  className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                      style={{ backgroundColor: p.color || '#3b82f6' }}
                    >
                      {p.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {p.userName}
                        </span>
                        {isUserTeacher && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-semibold">
                            Teacher
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Connected</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Permissions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isTeacher && !isUserTeacher ? (
                      <button
                        type="button"
                        onClick={() => onToggleStudentPermission(p.userId, !p.canEditBoard)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border flex items-center gap-1 transition-all ${
                          p.canEditBoard
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        {p.canEditBoard ? (
                          <>
                            <Unlock className="w-3 h-3 text-emerald-600" />
                            <span>Can Draw</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-amber-600" />
                            <span>View-Only</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500">
                        {p.canEditBoard ? '✓ Can Draw' : '👁️ View-Only'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500 px-5">
          <span>Live WebSocket Presence</span>
          <button
            onClick={onClose}
            className="px-3 py-1 font-semibold text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

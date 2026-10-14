/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Users,
  Lock,
  Unlock,
  FileText,
  Sparkles,
  Shield,
  Eye,
  Check,
  ChevronDown,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { Lesson, LessonParticipant, CollaborationMode } from '../../types/lesson';

interface LessonClassroomBarProps {
  lesson: Lesson | null;
  currentRole: 'teacher' | 'student';
  currentUserName: string;
  onChangeRole: (role: 'teacher' | 'student', name: string) => void;
  participants: LessonParticipant[];
  canEditBoard: boolean;
  collaborationMode: CollaborationMode;
  onUpdateCollaborationMode: (mode: CollaborationMode) => void;
  onOpenParticipants: () => void;
  onOpenNotes: () => void;
  onOpenSummary: () => void;
  onClearBoard?: () => void;
}

export const LessonClassroomBar: React.FC<LessonClassroomBarProps> = ({
  lesson,
  currentRole,
  currentUserName,
  onChangeRole,
  participants,
  canEditBoard,
  collaborationMode,
  onUpdateCollaborationMode,
  onOpenParticipants,
  onOpenNotes,
  onOpenSummary,
  onClearBoard,
}) => {
  const isTeacher = currentRole === 'teacher';

  return (
    <div className="bg-slate-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800 shadow-inner z-20">
      {/* Left: Lesson Topic & Subject Badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-300 font-bold text-[11px] border border-blue-500/30 shrink-0">
          {lesson?.subject || 'Live Classroom'}
        </span>
        <h2 className="font-semibold text-slate-100 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
          {lesson?.topic || 'Interactive Teaching Whiteboard'}
        </h2>
      </div>

      {/* Middle: Role Switcher & Live Participant Avatars */}
      <div className="flex items-center gap-3">
        {/* Role Switcher */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/80">
          <button
            type="button"
            onClick={() => onChangeRole('teacher', 'Prof. Clarke')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              isTeacher
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>Teacher</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeRole('student', 'Alex Student')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              !isTeacher
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>Student</span>
          </button>
        </div>

        {/* Live Participants Roster Button */}
        <button
          type="button"
          onClick={onOpenParticipants}
          title="View active classroom participants"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold">{participants.length || 1}</span>
          <span className="hidden sm:inline text-slate-400">Online</span>
        </button>

        {/* Teacher Collaboration Mode Toggle */}
        {isTeacher ? (
          <button
            type="button"
            onClick={() =>
              onUpdateCollaborationMode(
                collaborationMode === 'everyone_can_edit' ? 'teacher_only' : 'everyone_can_edit'
              )
            }
            title="Click to toggle whether students can draw"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all border cursor-pointer ${
              collaborationMode === 'everyone_can_edit'
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
                : 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30'
            }`}
          >
            {collaborationMode === 'everyone_can_edit' ? (
              <>
                <Unlock className="w-3 h-3 text-blue-400" />
                <span className="hidden sm:inline">Students Can Edit</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">Teacher-Only</span>
              </>
            )}
          </button>
        ) : (
          <span
            className={`px-2 py-0.5 rounded-md font-medium text-[11px] flex items-center gap-1 ${
              canEditBoard
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
            }`}
          >
            {canEditBoard ? <Unlock className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{canEditBoard ? 'Drawing Enabled' : 'View-Only'}</span>
          </span>
        )}
      </div>

      {/* Right: Notes Drawer & AI Summary */}
      <div className="flex items-center gap-2">
        {onClearBoard && isTeacher && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear all drawings on this whiteboard page?')) {
                onClearBoard();
              }
            }}
            title="Clear board page"
            className="px-2.5 py-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden md:inline">Clear</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSummary}
          title="AI Lesson Pedagogical Summary & Revision"
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-yellow-400" />
          <span className="hidden sm:inline">AI Summary</span>
        </button>

        <button
          type="button"
          onClick={onOpenNotes}
          title="Open private student study notes"
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>My Notes</span>
        </button>
      </div>
    </div>
  );
};

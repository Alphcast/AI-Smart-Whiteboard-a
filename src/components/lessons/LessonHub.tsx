/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Calendar,
  Clock,
  Users,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  PlayCircle,
  FileText,
  Trash2,
  Layers,
  ChevronRight,
  RefreshCw,
  GraduationCap,
} from 'lucide-react';
import { Lesson, SubjectItem } from '../../types/lesson';
import { api } from '../../services/api';
import { CreateLessonModal } from './CreateLessonModal';
import { AISummaryModal } from './AISummaryModal';

interface LessonHubProps {
  onOpenLessonBoard: (boardId: string, lessonId: string) => void;
  onOpenStudentNotes: (lessonId: string) => void;
  onCreateNewBoard?: () => void;
}

export const LessonHub: React.FC<LessonHubProps> = ({
  onOpenLessonBoard,
  onOpenStudentNotes,
  onCreateNewBoard,
}) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLessonForSummary, setSelectedLessonForSummary] = useState<Lesson | null>(null);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const [fetchedLessons, fetchedSubjects] = await Promise.all([
        api.getLessons({
          subject: selectedSubject !== 'all' ? selectedSubject : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery || undefined,
          date: selectedDate || undefined,
        }),
        api.getSubjects(),
      ]);
      setLessons(fetchedLessons);
      setSubjects(fetchedSubjects);
    } catch (err) {
      console.error('Failed to fetch lessons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, [selectedSubject, statusFilter, searchQuery, selectedDate]);

  const handleDeleteLesson = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this lesson?')) {
      try {
        await api.deleteLesson(id);
        setLessons((prev) => prev.filter((l) => l.id !== id));
      } catch (err) {
        console.error('Failed to delete lesson:', err);
      }
    }
  };

  const handleUpdateStatus = async (
    lesson: Lesson,
    newStatus: 'scheduled' | 'active' | 'completed',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      const updated = await api.updateLesson(lesson.id, { status: newStatus });
      setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, status: newStatus } : l)));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getSubjectColor = (subjName: string) => {
    const found = subjects.find((s) => s.name.toLowerCase() === subjName.toLowerCase());
    return found?.color || '#3b82f6';
  };

  const getSubjectIcon = (subjName: string) => {
    const found = subjects.find((s) => s.name.toLowerCase() === subjName.toLowerCase());
    return found?.icon || '📚';
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-[calc(100vh-65px)] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
              <GraduationCap className="w-3.5 h-3.5" />
              Real-Time Collaborative Teaching Workspace
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Structured Lessons & Curriculum
            </h1>
            <p className="text-slate-600 text-sm max-w-2xl">
              Organize classes by subject, schedule upcoming sessions, conduct live interactive whiteboard instruction with multi-student collaboration, and review student learning notes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Schedule New Lesson
            </button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
          {/* Search bar & status tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics, learning objectives, or subjects..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {(
                [
                  { id: 'all', label: 'All Lessons' },
                  { id: 'active', label: '🟢 Live Active' },
                  { id: 'scheduled', label: '📅 Scheduled' },
                  { id: 'completed', label: '✓ Completed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={fetchLessons}
              title="Refresh lessons"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors self-end md:self-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Subject pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Subject:
            </span>
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 transition-colors ${
                selectedSubject === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Subjects
            </button>
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.name)}
                className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 flex items-center gap-1.5 transition-colors ${
                  selectedSubject.toLowerCase() === s.name.toLowerCase()
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{s.icon || '📚'}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Lessons List Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse space-y-4">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                <div className="h-16 bg-slate-100 rounded"></div>
                <div className="h-10 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-2xl font-bold">
              📚
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">No lessons found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                No lessons match your current filters. Create a new structured lesson or clear your filters to view all.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Lesson
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson) => {
              const subjColor = getSubjectColor(lesson.subject);
              const subjIcon = getSubjectIcon(lesson.subject);
              const isLive = lesson.status === 'active';
              const isScheduled = lesson.status === 'scheduled';

              return (
                <div
                  key={lesson.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header Top */}
                  <div className="p-5 pb-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                        style={{
                          backgroundColor: `${subjColor}15`,
                          color: subjColor,
                        }}
                      >
                        <span>{subjIcon}</span>
                        <span>{lesson.subject}</span>
                      </span>

                      {/* Status indicator */}
                      {isLive ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Live Classroom
                        </span>
                      ) : isScheduled ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                          📅 Scheduled
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          ✓ Completed
                        </span>
                      )}
                    </div>

                    {/* Topic Title */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {lesson.topic}
                      </h3>
                      {lesson.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {lesson.description}
                        </p>
                      )}
                    </div>

                    {/* Date, Time, Teacher */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {lesson.lessonDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {lesson.teacherName}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {lesson.collaborationMode === 'everyone_can_edit' ? '🔓 Multi-User' : '🔒 Teacher-Only'}
                      </span>
                    </div>

                    {/* Learning Objectives */}
                    {lesson.learningObjectives && lesson.learningObjectives.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Objectives:
                        </span>
                        <ul className="space-y-1">
                          {lesson.learningObjectives.slice(0, 2).map((obj, i) => (
                            <li key={i} className="text-xs text-slate-600 truncate flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                              <span className="truncate">{obj}</span>
                            </li>
                          ))}
                          {lesson.learningObjectives.length > 2 && (
                            <li className="text-[11px] text-blue-600 font-medium">
                              +{lesson.learningObjectives.length - 2} more objectives
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* AI Summary / Revision button */}
                      <button
                        onClick={() => setSelectedLessonForSummary(lesson)}
                        title="AI Pedagogical Summary & Revision Questions"
                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors flex items-center gap-1 text-xs font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="hidden sm:inline">AI Summary</span>
                      </button>

                      {/* Student notes button */}
                      <button
                        onClick={() => onOpenStudentNotes(lesson.id)}
                        title="Student Learning Notes"
                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors flex items-center gap-1 text-xs font-medium"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        <span className="hidden sm:inline">Notes</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => handleDeleteLesson(lesson.id, e)}
                        title="Delete lesson"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Launch / Open Board */}
                    <button
                      onClick={() => onOpenLessonBoard(lesson.boardId, lesson.id)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        isLive
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isLive ? (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" />
                          Join Live
                        </>
                      ) : (
                        <>
                          <span>Open Board</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Lesson Modal */}
      <CreateLessonModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLessonCreated={(newLesson) => {
          setLessons((prev) => [newLesson, ...prev]);
          onOpenLessonBoard(newLesson.boardId, newLesson.id);
        }}
      />

      {/* AI Summary & Revision Modal */}
      {selectedLessonForSummary && (
        <AISummaryModal
          isOpen={!!selectedLessonForSummary}
          onClose={() => setSelectedLessonForSummary(null)}
          lesson={selectedLessonForSummary}
          onOpenWhiteboard={(boardId) => onOpenLessonBoard(boardId, selectedLessonForSummary.id)}
        />
      )}
    </div>
  );
};

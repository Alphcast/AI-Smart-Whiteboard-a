/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, BookOpen, Layers, Users, Sparkles, Check } from 'lucide-react';
import { SubjectItem, CollaborationMode } from '../../types/lesson';
import { api } from '../../services/api';

interface CreateLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLessonCreated: (lesson: any) => void;
}

export const CreateLessonModal: React.FC<CreateLessonModalProps> = ({
  isOpen,
  onClose,
  onLessonCreated,
}) => {
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subject, setSubject] = useState<string>('Mathematics');
  const [customSubjectName, setCustomSubjectName] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [lessonDate, setLessonDate] = useState<string>(getLocalDateString);
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [status, setStatus] = useState<'scheduled' | 'active'>('active');
  const [collaborationMode, setCollaborationMode] = useState<CollaborationMode>('everyone_can_edit');
  const [objectiveInput, setObjectiveInput] = useState<string>('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>([
    'Understand core concepts and formulas',
    'Collaborate on step-by-step whiteboard derivations',
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSubjects().then((list) => {
        setSubjects(list);
        if (list.length > 0 && !subject) {
          setSubject(list[0].name);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectiveInput.trim()) {
      setLearningObjectives([...learningObjectives, objectiveInput.trim()]);
      setObjectiveInput('');
    }
  };

  const handleRemoveObjective = (index: number) => {
    setLearningObjectives(learningObjectives.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Please provide a lesson topic or title.');
      return;
    }

    let finalSubject = subject;
    if (subject === 'Custom Subject') {
      if (!customSubjectName.trim()) {
        setError('Please enter a name for the custom subject.');
        return;
      }
      finalSubject = customSubjectName.trim();
      try {
        await api.createSubject({ name: finalSubject, color: '#4f46e5', icon: '🎓' });
      } catch {
        // fallback
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${lessonDate}T${scheduledTime || '10:00'}:00`).toISOString();
      const newLesson = await api.createLesson({
        subject: finalSubject,
        topic: topic.trim(),
        description: description.trim(),
        learningObjectives,
        lessonDate,
        scheduledAt,
        status,
        collaborationMode,
      });

      onLessonCreated(newLesson);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create lesson');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-lg">
              📚
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create New Lesson</h2>
              <p className="text-xs text-slate-500">Organize collaborative online instruction & whiteboard session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
              {error}
            </div>
          )}

          {/* Subject & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.icon || '📖'} {s.name}
                  </option>
                ))}
                <option value="Custom Subject">+ Other Subject</option>
              </select>
              {subject === 'Custom Subject' && (
                <input
                  type="text"
                  required
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  placeholder="Enter new subject name..."
                  className="mt-2 w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Lesson Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all text-center ${
                    status === 'active'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold ring-1 ring-emerald-500'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🟢 Live / Active Now
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('scheduled')}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all text-center ${
                    status === 'scheduled'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 font-semibold ring-1 ring-blue-500'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  📅 Scheduled
                </button>
              </div>
            </div>
          </div>

          {/* Topic Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lesson Topic & Title *
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Quadratic Systems & Graphing Masterclass"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lesson Overview / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context of formulas, concepts, or problem sets being covered..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Lesson Date
              </label>
              <input
                type="date"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Class Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Collaboration Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Whiteboard Collaboration Permission
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setCollaborationMode('everyone_can_edit')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  collaborationMode === 'everyone_can_edit'
                    ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">🔓 Collaborative</span>
                  {collaborationMode === 'everyone_can_edit' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500">Students can draw and annotate simultaneously on board</p>
              </div>

              <div
                onClick={() => setCollaborationMode('teacher_only')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  collaborationMode === 'teacher_only'
                    ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">🔒 Teacher-Only</span>
                  {collaborationMode === 'teacher_only' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500">Students view board in real time, only teacher can draw</p>
              </div>
            </div>
          </div>

          {/* Learning Objectives */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Key Learning Objectives
            </label>
            <div className="space-y-1.5 mb-2">
              {learningObjectives.map((obj, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200/60">
                  <span className="truncate">• {obj}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveObjective(i)}
                    className="text-slate-400 hover:text-red-500 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={objectiveInput}
                onChange={(e) => setObjectiveInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddObjective(e);
                  }
                }}
                placeholder="Add objective (e.g. Master substitution method)..."
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddObjective}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Add
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              {submitting ? 'Creating...' : 'Create & Open Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

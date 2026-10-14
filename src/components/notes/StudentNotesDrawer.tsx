/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Save,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  Bold,
  Italic,
  List,
  CheckSquare,
  BookOpen,
  Calendar,
  Lock,
} from 'lucide-react';
import { StudentNote, Lesson } from '../../types/lesson';
import { api } from '../../services/api';

interface StudentNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  lesson?: Lesson | null;
  studentId?: string;
  studentName?: string;
}

export const StudentNotesDrawer: React.FC<StudentNotesDrawerProps> = ({
  isOpen,
  onClose,
  lessonId,
  lesson,
  studentId = 'student-demo',
  studentName = 'Alex Student',
}) => {
  const [note, setNote] = useState<StudentNote | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [takeawayInput, setTakeawayInput] = useState('');
  const [activeTab, setActiveTab] = useState<'notes' | 'takeaways' | 'revision'>('notes');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [copied, setCopied] = useState(false);
  const autoSaveTimerRef = useRef<any>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch or initialize note for this student & lesson
  useEffect(() => {
    if (!isOpen || !lessonId) return;

    api.getStudentLessonNote(lessonId, studentId).then((existing) => {
      if (existing) {
        setNote(existing);
        setTitle(existing.title || `${lesson?.topic || 'Lesson'} Notes`);
        setContent(existing.content || '');
        setTakeaways(existing.keyTakeaways || []);
      } else {
        const defaultTitle = `${lesson?.topic || 'Interactive Lesson'} - Study Notes`;
        const initialContent = `## Key Concepts & Mathematical Principles\n- Notes taken during live classroom session\n\n### Step-by-Step Derivations:\n- Record formulas and inverse balance steps here\n\n### Questions to clarify:\n- \n`;
        setTitle(defaultTitle);
        setContent(initialContent);
        setTakeaways(
          lesson?.learningObjectives && lesson.learningObjectives.length > 0
            ? lesson.learningObjectives.slice(0, 3)
            : ['Master foundational rules', 'Practice verification step']
        );
      }
      setSaveStatus('saved');
    });
  }, [isOpen, lessonId, studentId, lesson]);

  // Debounced auto-save
  const triggerAutosave = (newContent: string, newTitle: string, newTakeaways: string[]) => {
    setSaveStatus('unsaved');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const saved = await api.saveStudentNote(lessonId, {
          studentId,
          studentName,
          title: newTitle,
          content: newContent,
          keyTakeaways: newTakeaways,
          version: note?.version,
        });
        setNote(saved);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to autosave student note:', err);
        setSaveStatus('unsaved');
      }
    }, 1200);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    triggerAutosave(val, title, takeaways);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerAutosave(content, val, takeaways);
  };

  const handleAddTakeaway = (e: React.FormEvent) => {
    e.preventDefault();
    if (takeawayInput.trim()) {
      const next = [...takeaways, takeawayInput.trim()];
      setTakeaways(next);
      setTakeawayInput('');
      triggerAutosave(content, title, next);
    }
  };

  const handleRemoveTakeaway = (index: number) => {
    const next = takeaways.filter((_, i) => i !== index);
    setTakeaways(next);
    triggerAutosave(content, title, next);
  };

  const insertFormatting = (prefix: string, suffix = '') => {
    const el = contentTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end) || 'text';
    const replacement = `${prefix}${selected}${suffix}`;
    const nextContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(nextContent);
    triggerAutosave(nextContent, title, takeaways);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const handleExportMarkdown = () => {
    const markdown = `# ${title}\n\n**Subject:** ${lesson?.subject || 'Mathematics'}\n**Date:** ${lesson?.lessonDate || new Date().toISOString().split('T')[0]}\n**Student:** ${studentName}\n\n## Key Takeaways:\n${takeaways.map((t) => `- ${t}`).join('\n')}\n\n---\n\n${content}`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(title || 'notes').toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[460px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
            📝
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 truncate">My Learning Notes</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Private
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {studentName} • {lesson?.topic || 'Live Whiteboard Lesson'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Save Status Badge */}
          <div className="text-[11px] font-medium text-slate-500">
            {saveStatus === 'saving' && <span className="text-amber-600 animate-pulse">Saving...</span>}
            {saveStatus === 'saved' && <span className="text-emerald-600">✓ Saved</span>}
            {saveStatus === 'unsaved' && <span className="text-slate-400">Unsaved</span>}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-100 px-4 bg-slate-50/30">
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'notes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Editor & Notes
        </button>
        <button
          onClick={() => setActiveTab('takeaways')}
          className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'takeaways'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Key Takeaways</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600">
            {takeaways.length}
          </span>
        </button>
        {lesson?.revisionQuestions && lesson.revisionQuestions.length > 0 && (
          <button
            onClick={() => setActiveTab('revision')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1 ${
              activeTab === 'revision'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3 h-3 text-yellow-500" />
            <span>AI Revision</span>
          </button>
        )}
      </div>

      {/* Tab Body */}
      {activeTab === 'notes' && (
        <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
          {/* Note Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Note title..."
              className="w-full text-sm font-bold text-slate-900 px-2 py-1 bg-transparent hover:bg-slate-50 focus:bg-white border-b border-transparent focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          {/* Markdown Toolbar */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-slate-600 shrink-0">
            <button
              onClick={() => insertFormatting('**', '**')}
              title="Bold"
              className="p-1 hover:bg-white hover:text-slate-900 rounded transition-colors"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('*', '*')}
              title="Italic"
              className="p-1 hover:bg-white hover:text-slate-900 rounded transition-colors"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('- ')}
              title="Bullet list"
              className="p-1 hover:bg-white hover:text-slate-900 rounded transition-colors"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('$ ', ' $')}
              title="LaTeX / Math formula"
              className="px-1.5 py-0.5 text-[11px] font-mono hover:bg-white hover:text-slate-900 rounded transition-colors font-semibold"
            >
              $f(x)$
            </button>
            <button
              onClick={() => insertFormatting('### ')}
              title="Heading"
              className="px-1.5 py-0.5 text-[11px] hover:bg-white hover:text-slate-900 rounded transition-colors font-semibold"
            >
              H3
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={contentTextareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Type your notes, formulas, questions, or derivations here..."
            className="flex-1 w-full p-3 text-xs leading-relaxed font-sans bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none transition-colors"
          />
        </div>
      )}

      {activeTab === 'takeaways' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">Key Lesson Takeaways</h4>
            <p className="text-[11px] text-slate-500">Record quick summary points, core formulas, or tips to remember.</p>
          </div>

          <form onSubmit={handleAddTakeaway} className="flex gap-2">
            <input
              type="text"
              value={takeawayInput}
              onChange={(e) => setTakeawayInput(e.target.value)}
              placeholder="e.g. Always check roots by substitution..."
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </form>

          <div className="space-y-2">
            {takeaways.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No takeaways recorded yet.</p>
            ) : (
              takeaways.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800"
                >
                  <span className="font-semibold text-blue-600 shrink-0">{index + 1}.</span>
                  <span className="flex-1">{item}</span>
                  <button
                    onClick={() => handleRemoveTakeaway(index)}
                    className="text-slate-400 hover:text-red-500 shrink-0 p-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'revision' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              AI Pedagogical Revision Questions
            </h4>
            <p className="text-[11px] text-slate-500">Practice questions generated specifically from this lesson's content.</p>
          </div>

          <div className="space-y-3">
            {lesson?.revisionQuestions?.map((q, idx) => (
              <div
                key={idx}
                className="p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl text-xs text-indigo-950 space-y-2"
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span>Practice Question</span>
                </div>
                <p className="text-slate-700 leading-relaxed pl-5">{q}</p>
                <button
                  onClick={() => {
                    const toAppend = `\n\n### Practice Question ${idx + 1}:\n**${q}**\n*My Answer / Working:*\n- `;
                    handleContentChange(content + toAppend);
                    setActiveTab('notes');
                  }}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 pl-5 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add to my notes to solve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .md</span>
          </button>
        </div>

        <button
          onClick={() => triggerAutosave(content, title, takeaways)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Now</span>
        </button>
      </div>
    </aside>
  );
};

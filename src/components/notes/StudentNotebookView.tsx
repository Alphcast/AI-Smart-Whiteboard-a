/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  FileText,
  Calendar,
  Download,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Folder,
} from 'lucide-react';
import { StudentNote, SubjectItem } from '../../types/lesson';
import { api } from '../../services/api';

interface StudentNotebookViewProps {
  onOpenLessonBoard: (boardId: string, lessonId: string) => void;
  onNavigateHome: () => void;
  studentId?: string;
}

export const StudentNotebookView: React.FC<StudentNotebookViewProps> = ({
  onOpenLessonBoard,
  onNavigateHome,
  studentId = 'student-demo',
}) => {
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedNote, setSelectedNote] = useState<StudentNote | null>(null);
  const [copied, setCopied] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<StudentNote | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const [fetchedNotes, fetchedSubjects] = await Promise.all([
        api.getStudentAllNotes(studentId),
        api.getSubjects(),
      ]);
      setNotes(fetchedNotes);
      setSubjects(fetchedSubjects);
      if (fetchedNotes.length > 0 && !selectedNote) {
        setSelectedNote(fetchedNotes[0]);
      }
    } catch (err) {
      console.error('Failed to fetch student notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [studentId]);

  const filteredNotes = notes.filter((n) => {
    const matchesSubj = selectedSubject === 'all' || n.subject.toLowerCase() === selectedSubject.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.topic.toLowerCase().includes(q);
    return matchesSubj && matchesSearch;
  });

  const handleDeleteClick = (note: StudentNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToDelete(note);
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    setDeleting(true);
    try {
      await api.deleteStudentNote(noteToDelete.lessonId, noteToDelete.id, studentId);
      const next = notes.filter((item) => item.id !== noteToDelete.id);
      setNotes(next);
      if (selectedNote?.id === noteToDelete.id) {
        setSelectedNote(next.length > 0 ? next[0] : null);
      }
      setNoteToDelete(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportMarkdown = (noteToExport: StudentNote) => {
    const md = `# ${noteToExport.title}\n\n**Subject:** ${noteToExport.subject}\n**Topic:** ${noteToExport.topic}\n**Date:** ${noteToExport.lessonDate}\n\n## Key Takeaways:\n${noteToExport.keyTakeaways?.map((t) => `- ${t}`).join('\n') || 'None recorded'}\n\n---\n\n${noteToExport.content}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${noteToExport.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-[calc(100vh-65px)] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              Private Student Learning Notebook
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              My Personal Study Notes
            </h1>
            <p className="text-slate-600 text-sm max-w-2xl">
              Access your lesson annotations, structured formula derivations, key takeaways, and practice exercises recorded during live whiteboard classes.
            </p>
          </div>

          <button
            onClick={fetchNotes}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-colors flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Notebook
          </button>
        </div>

        {/* Master-Detail Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Notes Sidebar List (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            {/* Search & Subject filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in your notes..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setSelectedSubject('all')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg shrink-0 transition-colors ${
                    selectedSubject === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubject(s.name)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg shrink-0 flex items-center gap-1 transition-colors ${
                      selectedSubject.toLowerCase() === s.name.toLowerCase()
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{s.icon || '📚'}</span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading notes...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs">No notes found matching your filters.</p>
                </div>
              ) : (
                filteredNotes.map((item) => {
                  const isSelected = selectedNote?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedNote(item)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500'
                          : 'border-slate-200/80 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {item.subject}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {item.lessonDate}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.content}
                      </p>

                      {item.keyTakeaways && item.keyTakeaways.length > 0 && (
                        <div className="text-[11px] text-emerald-700 font-medium">
                          ✓ {item.keyTakeaways.length} key takeaway{item.keyTakeaways.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Note Detail Preview & Actions (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[500px] flex flex-col justify-between">
            {selectedNote ? (
              <div className="space-y-6">
                {/* Header Top */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {selectedNote.subject}
                      </span>
                      <span className="text-xs text-slate-400">
                        Recorded on {selectedNote.lessonDate}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900">{selectedNote.title}</h2>
                    <p className="text-xs text-slate-500">Lesson: {selectedNote.topic}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(selectedNote.content)}
                      title="Copy content"
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExportMarkdown(selectedNote)}
                      title="Export as Markdown"
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(selectedNote, e)}
                      title="Delete note"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Key Takeaways Box */}
                {selectedNote.keyTakeaways && selectedNote.keyTakeaways.length > 0 && (
                  <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/60 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Key Takeaways:
                    </h3>
                    <ul className="space-y-1.5">
                      {selectedNote.keyTakeaways.map((takeaway, idx) => (
                        <li key={idx} className="text-xs text-emerald-950 flex items-start gap-2">
                          <span className="font-bold text-emerald-700">•</span>
                          <span>{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Content body */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Full Notes & Working:
                  </h3>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                    {selectedNote.content}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <FileText className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-medium">Select a note from the left to view details</p>
              </div>
            )}

            {/* Bottom Actions */}
            {selectedNote && (
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Version {selectedNote.version || 1} • Last updated {new Date(selectedNote.updatedAt).toLocaleTimeString()}
                </span>

                <button
                  onClick={() => onOpenLessonBoard(selectedNote.lessonId, selectedNote.lessonId)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Reopen Lesson Whiteboard</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-app Delete Confirmation Modal */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Study Note?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Are you sure you want to delete your notes for <strong className="text-slate-900 font-semibold">{noteToDelete.title}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteNote}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

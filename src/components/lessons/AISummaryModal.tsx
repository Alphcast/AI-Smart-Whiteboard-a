/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Sparkles, BookOpen, HelpCircle, CheckCircle2, Copy, Download, Loader2, ArrowRight } from 'lucide-react';
import { Lesson } from '../../types/lesson';
import { api } from '../../services/api';

interface AISummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson;
  onOpenWhiteboard?: (boardId: string) => void;
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({
  isOpen,
  onClose,
  lesson,
  onOpenWhiteboard,
}) => {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    keyTakeaways?: string[];
    revisionQuestions?: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && lesson) {
      if (lesson.summary && lesson.revisionQuestions && lesson.revisionQuestions.length > 0) {
        setSummaryData({
          summary: lesson.summary,
          revisionQuestions: lesson.revisionQuestions,
          keyTakeaways: [
            'Core theoretical axioms reviewed and validated',
            'Step-by-step whiteboard proof worked cooperatively',
            'Solution roots verified by substitution',
          ],
        });
      } else {
        handleGenerate();
      }
    }
  }, [isOpen, lesson]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.generateLessonAISummary(lesson.id);
      setSummaryData(res);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summaryData) return;
    const text = `# ${lesson.subject}: ${lesson.topic} - AI Lesson Summary\n\n${summaryData.summary}\n\n### Key Takeaways:\n${summaryData.keyTakeaways?.map((t) => `- ${t}`).join('\n') || ''}\n\n### Revision Questions:\n${summaryData.revisionQuestions?.map((q, i) => `${i + 1}. ${q}`).join('\n') || ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {lesson.subject}
                </span>
                <span className="text-xs text-slate-500">{lesson.lessonDate}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 line-clamp-1">{lesson.topic}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-medium">Synthesizing pedagogical lesson summary & revision questions...</p>
            </div>
          ) : summaryData ? (
            <>
              {/* Pedagogical Summary */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  Conceptual Synthesis
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-700 leading-relaxed">
                  {summaryData.summary}
                </div>
              </div>

              {/* Key Takeaways */}
              {summaryData.keyTakeaways && summaryData.keyTakeaways.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Essential Takeaways
                  </h3>
                  <div className="space-y-1.5">
                    {summaryData.keyTakeaways.map((takeaway, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/60 text-xs text-emerald-950 font-medium"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-200/80 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="pt-0.5">{takeaway}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revision Questions */}
              {summaryData.revisionQuestions && summaryData.revisionQuestions.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                    Practice & Revision Questions for Students
                  </h3>
                  <div className="space-y-2">
                    {summaryData.revisionQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200/60 text-xs text-indigo-950 flex items-start gap-2.5"
                      >
                        <span className="font-bold text-indigo-600 shrink-0">Q{idx + 1}:</span>
                        <span>{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              No summary available yet. Click regenerate to create one.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-xs font-medium text-slate-600 hover:text-blue-600 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Regenerate with AI
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  Copy Markdown
                </>
              )}
            </button>

            {onOpenWhiteboard && (
              <button
                onClick={() => {
                  onClose();
                  onOpenWhiteboard(lesson.boardId);
                }}
                className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                Open Lesson Board
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

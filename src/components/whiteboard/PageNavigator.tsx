/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, ChevronLeft, ChevronRight, Copy, Trash2, Edit2 } from 'lucide-react';
import { WhiteboardPage } from '../../types/whiteboard';

interface PageNavigatorProps {
  pages: WhiteboardPage[];
  currentPageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onRenamePage: (id: string, newTitle: string) => void;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  pages,
  currentPageId,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onRenamePage,
}) => {
  const currentIndex = pages.findIndex((p) => p.id === currentPageId);

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectPage(pages[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < pages.length - 1) {
      onSelectPage(pages[currentIndex + 1].id);
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm rounded-xl px-2.5 py-1.5 select-none text-xs">
      {/* Prev / Next Page controls */}
      <button
        onClick={handlePrev}
        disabled={currentIndex <= 0}
        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-100 transition-colors"
        title="Previous Page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Pages list */}
      <div className="flex items-center gap-1 max-w-md overflow-x-auto py-0.5">
        {pages.map((p, idx) => {
          const isActive = p.id === currentPageId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors group cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white font-medium shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => onSelectPage(p.id)}
            >
              <span>{p.title || `Page ${idx + 1}`}</span>

              {isActive && (
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newTitle = prompt('Rename page:', p.title);
                      if (newTitle) onRenamePage(p.id, newTitle);
                    }}
                    className="p-0.5 hover:text-blue-300 transition-colors"
                    title="Rename"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicatePage(p.id);
                    }}
                    className="p-0.5 hover:text-blue-300 transition-colors"
                    title="Duplicate Page"
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                  {pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${p.title}?`)) onDeletePage(p.id);
                      }}
                      className="p-0.5 hover:text-red-400 transition-colors"
                      title="Delete Page"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleNext}
        disabled={currentIndex >= pages.length - 1}
        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-100 transition-colors"
        title="Next Page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Add Page Button */}
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button
        onClick={onAddPage}
        className="flex items-center gap-1 px-2 py-1 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
        title="Add Blank Page"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Page</span>
      </button>
    </div>
  );
};

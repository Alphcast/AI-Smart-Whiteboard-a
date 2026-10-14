/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Star,
  Trash2,
  Clock,
  Folder,
  Copy,
  MoreVertical,
  Layers,
  Sparkles,
  BookOpen,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Radio,
  Download,
  FileImage,
  FileCode,
  FileText,
  Users,
} from 'lucide-react';
import { Whiteboard } from '../../types/whiteboard';
import { api } from '../../services/api';
import { exportToPNG, exportToSVG } from '../../utils/export';

interface DashboardProps {
  onOpenBoard: (id: string, lessonId?: string) => void;
  onCreateNewBoard: () => void;
  onNavigateHome: () => void;
  onNavigateRemote?: () => void;
  onNavigateLessons?: () => void;
  onNavigateNotes?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenBoard,
  onCreateNewBoard,
  onNavigateHome,
  onNavigateRemote,
  onNavigateLessons,
  onNavigateNotes,
}) => {
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'recent' | 'starred' | 'trash'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const fetchBoards = async () => {
    setLoading(true);
    try {
      const data = await api.getBoards();
      setBoards(data);
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newBoard = await api.duplicateBoard(id);
      setBoards((prev) => [newBoard, ...prev]);
      setMenuOpenId(null);
    } catch (err) {
      console.error('Duplicate error:', err);
    }
  };

  const handleDelete = async (id: string, permanent: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteBoard(id, permanent);
      setBoards((prev) => prev.filter((b) => b.id !== id));
      setMenuOpenId(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleToggleStar = async (board: Whiteboard, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.updateBoard(board.id, { isStarred: !board.isStarred });
      setBoards((prev) => prev.map((b) => (b.id === board.id ? updated : b)));
    } catch (err) {
      console.error('Toggle star error:', err);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      const newBoard = await api.createFromTemplate(templateId);
      onOpenBoard(newBoard.id);
    } catch (err) {
      console.error('Create template error:', err);
    }
  };

  // Filter logic
  const filteredBoards = boards.filter((b) => {
    if (filterTab === 'trash') {
      if (!b.isTrash) return false;
    } else {
      if (b.isTrash) return false;
      if (filterTab === 'starred' && !b.isStarred) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q)) ||
        (b.tags && b.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Dashboard Subheader */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Whiteboard Workspace</h1>
            <p className="text-xs text-slate-500 mt-1">
              Organize lessons, mathematical research, diagram planning, and collaborative boards
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateLessons && (
              <button
                onClick={onNavigateLessons}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                title="Enter Live Collaborative Lessons"
              >
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Live Lessons</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            )}

            {onNavigateNotes && (
              <button
                onClick={onNavigateNotes}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                title="Open Student Notes & Notebooks"
              >
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Student Notes</span>
              </button>
            )}

            {onNavigateRemote && (
              <button
                onClick={onNavigateRemote}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                title="Connect phone touchpad remote controller"
              >
                <Radio className="w-4 h-4 text-blue-600" />
                <span>Phone Controller</span>
              </button>
            )}

            <button
              onClick={onCreateNewBoard}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Board</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Collaborative Teaching Hub Quick Banner */}
        {filterTab !== 'trash' && onNavigateLessons && (
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-xs">
                <Users className="w-3.5 h-3.5 text-blue-100" />
                <span>Real-Time Teaching Classroom</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Online Classroom & Live Collaboration
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                Start an interactive teaching session with synchronized whiteboard drawing, participant permissions,
                and private student revision notes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={onNavigateLessons}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-700 rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Enter Live Lessons Hub</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onNavigateNotes && (
                <button
                  onClick={onNavigateNotes}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/30 hover:bg-blue-500/40 text-white border border-white/25 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-200" />
                  <span>Student Notes</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Templates Banner */}
        {filterTab !== 'trash' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Start from Educational Templates
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => handleCreateFromTemplate('algebra')}
                className="group p-4 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-serif text-sm font-bold mb-3">
                    f(x)
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                    Algebra & Equations
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Linear balance, quadratic formula, and instant step breakdown
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-blue-600 font-medium mt-4">
                  <span>Use template</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => handleCreateFromTemplate('geometry')}
                className="group p-4 bg-white hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl text-left transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm mb-3">
                    △
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 group-hover:text-purple-600 transition-colors">
                    Geometry & Proofs
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Pythagorean theorem right triangle proofs and visual trigonometry
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-purple-600 font-medium mt-4">
                  <span>Use template</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => handleCreateFromTemplate('brainstorm')}
                className="group p-4 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm mb-3">
                    💡
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 group-hover:text-amber-600 transition-colors">
                    Visual Brainstorm
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Color-coded sticky notes, connector links, and concept mind-mapping
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-4">
                  <span>Use template</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-medium w-full sm:w-auto">
            <button
              onClick={() => setFilterTab('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-colors ${
                filterTab === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Boards ({boards.filter((b) => !b.isTrash).length})
            </button>
            <button
              onClick={() => setFilterTab('starred')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                filterTab === 'starred' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Starred
            </button>
            <button
              onClick={() => setFilterTab('trash')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                filterTab === 'trash' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Trash
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search whiteboard titles or tags..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 transition-colors shadow-sm"
            />
          </div>
        </div>

        {/* Boards Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            Loading your whiteboards...
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {filterTab === 'trash' ? 'Trash is empty' : 'No whiteboards found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {filterTab === 'trash'
                ? 'Deleted boards will appear here before being permanently removed.'
                : 'Create your first smart whiteboard to begin writing, solving mathematics, and connecting your phone.'}
            </p>
            {filterTab !== 'trash' && (
              <button
                onClick={onCreateNewBoard}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                Create Whiteboard
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBoards.map((board) => {
              const pagesCount = board.pages?.length || 1;
              const objectsCount = Object.values(board.objects || {}).reduce(
                (sum, arr) => sum + arr.length,
                0
              );
              const formattedDate = new Date(board.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={board.id}
                  onClick={() => onOpenBoard(board.id)}
                  className="group bg-white border border-slate-200 hover:border-blue-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative"
                >
                  {/* Canvas Preview Graphic Thumbnail */}
                  <div className="h-36 bg-slate-100/70 border-b border-slate-100 p-4 flex flex-col justify-between relative overflow-hidden">
                    {/* Pattern background */}
                    <div
                      className="absolute inset-0 opacity-40 pointer-events-none"
                      style={{
                        backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                        backgroundSize: '16px 16px',
                      }}
                    />

                    {/* Top tags and star */}
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>{pagesCount} {pagesCount === 1 ? 'page' : 'pages'}</span>
                      </div>

                      <button
                        onClick={(e) => handleToggleStar(board, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          board.isStarred
                            ? 'text-amber-500 hover:bg-amber-50'
                            : 'text-slate-300 hover:text-amber-500 hover:bg-white'
                        }`}
                        title={board.isStarred ? 'Remove from starred' : 'Star whiteboard'}
                      >
                        <Star className={`w-4 h-4 ${board.isStarred ? 'fill-amber-500' : ''}`} />
                      </button>
                    </div>

                    {/* Preview mock mathematical cards inside thumbnail */}
                    <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-lg p-2.5 border border-slate-200/80 shadow-xs max-w-[220px]">
                      <div className="text-[11px] font-mono text-slate-800 truncate">
                        {board.title}
                      </div>
                      <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                        {objectsCount} canvas {objectsCount === 1 ? 'element' : 'elements'}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {board.title}
                        </h3>

                        {/* Menu trigger */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === board.id ? null : board.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {menuOpenId === board.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-30 text-xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  const firstPage = board.pages[0];
                                  const objects = board.objects[firstPage?.id || ''] || [];
                                  exportToPNG(board.title, firstPage?.title || 'page', objects, firstPage || { id: 'p1', title: 'Page 1', order: 0, background: 'grid' }, { resolution: 2 });
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-left"
                              >
                                <FileImage className="w-3.5 h-3.5 text-blue-600" /> Export PNG (HD)
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  const firstPage = board.pages[0];
                                  exportToSVG(board, firstPage?.id || '');
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg text-left"
                              >
                                <FileCode className="w-3.5 h-3.5 text-purple-600" /> Export SVG
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                onClick={(e) => handleDuplicate(board.id, e)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg text-left"
                              >
                                <Copy className="w-3.5 h-3.5" /> Duplicate
                              </button>
                              <button
                                onClick={(e) => handleDelete(board.id, filterTab === 'trash', e)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {filterTab === 'trash' ? 'Delete Permanently' : 'Move to Trash'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {board.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {board.description}
                        </p>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Edited {formattedDate}</span>
                      </div>
                      <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Open <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

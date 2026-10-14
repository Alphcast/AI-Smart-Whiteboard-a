/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { Menu, X, BookOpen, Layers, FileText, Smartphone, LayoutDashboard, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentView: 'landing' | 'dashboard' | 'lessons' | 'notes' | 'whiteboard' | 'remote';
  onNavigate: (view: 'landing' | 'dashboard' | 'lessons' | 'notes' | 'whiteboard') => void;
  onCreateBoard?: () => void;
  onCreateLesson?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onCreateBoard }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMobileNav = (view: 'landing' | 'dashboard' | 'lessons' | 'notes' | 'whiteboard') => {
    setMobileOpen(false);
    onNavigate(view);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleMobileNav('landing')}
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-600 transition-colors text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              AI
            </div>
            <span>AI Smart Whiteboard</span>
          </button>
        </div>

        {/* Zone 2: Desktop Navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            onClick={() => onNavigate('landing')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              currentView === 'landing' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => onNavigate('lessons')}
            className={`inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              currentView === 'lessons' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            <span>Live Lessons</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </button>

          <button
            onClick={() => onNavigate('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              currentView === 'dashboard' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            My Boards
          </button>

          <button
            onClick={() => onNavigate('notes')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              currentView === 'notes' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            Student Notes
          </button>

          <a
            href="#remote-touchpad"
            onClick={(e) => {
              if (currentView !== 'landing') {
                e.preventDefault();
                onNavigate('landing');
                setTimeout(() => {
                  document.getElementById('remote-touchpad')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900"
          >
            Remote Touchpad
          </a>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PWAInstallButton variant="compact" />

          {currentView === 'landing' ? (
            <button
              onClick={() => onNavigate('lessons')}
              className="px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer"
            >
              Open Workspace
            </button>
          ) : (
            <button
              onClick={onCreateBoard || (() => onNavigate('dashboard'))}
              className="px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer"
            >
              New Board
            </button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 md:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => handleMobileNav('landing')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              currentView === 'landing' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => handleMobileNav('lessons')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              currentView === 'lessons' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Live Collaborative Lessons</span>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
              Live
            </span>
          </button>

          <button
            onClick={() => handleMobileNav('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              currentView === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-600" />
            <span>My Boards</span>
          </button>

          <button
            onClick={() => handleMobileNav('notes')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              currentView === 'notes' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Student Notebook & Notes</span>
          </button>
        </div>
      )}
    </header>
  );
};

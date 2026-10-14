/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface NavbarProps {
  currentView: 'landing' | 'dashboard' | 'lessons' | 'notes' | 'whiteboard' | 'remote';
  onNavigate: (view: 'landing' | 'dashboard' | 'lessons' | 'notes' | 'whiteboard') => void;
  onCreateBoard?: () => void;
  onCreateLesson?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onCreateBoard }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Brand wordmark */}
        <button
          onClick={() => onNavigate('landing')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-600 transition-colors text-left cursor-pointer"
        >
          AI Smart Whiteboard
        </button>

        {/* Zone 2: Navigation links */}
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
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 cursor-pointer ${
              currentView === 'lessons' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            Live Lessons
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
            My Notes
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
        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton variant="compact" />

          {currentView === 'landing' ? (
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer"
            >
              Open Whiteboard
            </button>
          ) : (
            <button
              onClick={onCreateBoard || (() => onNavigate('dashboard'))}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer"
            >
              New Board
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

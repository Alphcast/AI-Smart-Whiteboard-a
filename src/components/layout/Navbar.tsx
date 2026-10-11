/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface NavbarProps {
  currentView: 'landing' | 'dashboard' | 'whiteboard' | 'remote';
  onNavigate: (view: 'landing' | 'dashboard' | 'whiteboard') => void;
  onCreateBoard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onCreateBoard }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Brand wordmark */}
        <button
          onClick={() => onNavigate('landing')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-600 transition-colors text-left"
        >
          AI Smart Whiteboard
        </button>

        {/* Zone 2: 4-5 single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            onClick={() => onNavigate('landing')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              currentView === 'landing' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            Overview
          </button>
          <a
            href="#mathematics"
            onClick={(e) => {
              if (currentView !== 'landing') {
                e.preventDefault();
                onNavigate('landing');
                setTimeout(() => {
                  document.getElementById('mathematics')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900"
          >
            Mathematics
          </a>
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
          <a
            href="#templates"
            onClick={(e) => {
              if (currentView !== 'landing') {
                e.preventDefault();
                onNavigate('landing');
                setTimeout(() => {
                  document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900"
          >
            Templates
          </a>
          <button
            onClick={() => onNavigate('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
              currentView === 'dashboard' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            My Boards
          </button>
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

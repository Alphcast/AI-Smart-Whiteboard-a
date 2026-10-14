/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { MarketingLanding } from './components/marketing/MarketingLanding';
import { Dashboard } from './components/dashboard/Dashboard';
import { WhiteboardEditor } from './components/whiteboard/WhiteboardEditor';
import { PhoneRemoteController } from './components/remote/PhoneRemoteController';
import { LessonHub } from './components/lessons/LessonHub';
import { StudentNotebookView } from './components/notes/StudentNotebookView';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { api } from './services/api';

type AppView = 'landing' | 'dashboard' | 'lessons' | 'notes' | 'whiteboard' | 'remote';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [activeBoardId, setActiveBoardId] = useState<string>('board-algebra-demo');
  const [activeLessonId, setActiveLessonId] = useState<string | undefined>(undefined);
  const [remoteSessionParams, setRemoteSessionParams] = useState<{
    sessionId: string;
    passcode?: string;
  } | null>(null);

  // Check URL on load (supports `/remote?session=...`, `/lessons`, `/notes`, or `/whiteboard/:id`)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const session = searchParams.get('session');
    const code = searchParams.get('code');
    const lesson = searchParams.get('lesson');
    const path = window.location.pathname;

    if (session || path.includes('/remote')) {
      const sessId = session || path.split('/remote/')[1] || '';
      setRemoteSessionParams({ sessionId: sessId, passcode: code || undefined });
      setCurrentView('remote');
      return;
    }

    if (path.includes('/lessons')) {
      setCurrentView('lessons');
      return;
    }

    if (path.includes('/notes')) {
      setCurrentView('notes');
      return;
    }

    if (path.includes('/dashboard')) {
      setCurrentView('dashboard');
      return;
    }

    if (path.includes('/whiteboard/')) {
      const bId = path.split('/whiteboard/')[1]?.split('?')[0];
      if (bId) {
        setActiveBoardId(bId);
        if (lesson) setActiveLessonId(lesson);
        setCurrentView('whiteboard');
      }
    }
  }, []);

  const handleOpenBoard = (boardId: string, lessonId?: string) => {
    setActiveBoardId(boardId);
    setActiveLessonId(lessonId);
    setCurrentView('whiteboard');
    window.history.pushState(
      {},
      '',
      `/whiteboard/${boardId}${lessonId ? `?lesson=${encodeURIComponent(lessonId)}` : ''}`
    );
  };

  const handleCreateNewBoard = async () => {
    try {
      const newBoard = await api.createBoard('Untitled Whiteboard');
      setActiveBoardId(newBoard.id);
      setActiveLessonId(undefined);
      setCurrentView('whiteboard');
      window.history.pushState({}, '', `/whiteboard/${newBoard.id}`);
    } catch (err) {
      console.error('Failed to create board:', err);
    }
  };

  const handleNavigate = (view: 'landing' | 'dashboard' | 'lessons' | 'notes' | 'whiteboard') => {
    setCurrentView(view);
    if (view === 'landing') window.history.pushState({}, '', '/');
    else if (view === 'dashboard') window.history.pushState({}, '', '/dashboard');
    else if (view === 'lessons') window.history.pushState({}, '', '/lessons');
    else if (view === 'notes') window.history.pushState({}, '', '/notes');
  };

  // If in Smartphone Remote Controller mode
  if (currentView === 'remote') {
    return (
      <PhoneRemoteController
        sessionId={remoteSessionParams?.sessionId || ''}
        passcode={remoteSessionParams?.passcode}
        onExit={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // If inside the Whiteboard Canvas Editor
  if (currentView === 'whiteboard') {
    return (
      <WhiteboardEditor
        boardId={activeBoardId}
        lessonId={activeLessonId}
        onBackToDashboard={() => handleNavigate('dashboard')}
      />
    );
  }

  // Otherwise: Public Marketing Landing or Dashboard with Topbar
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onCreateBoard={handleCreateNewBoard}
      />

      {currentView === 'landing' && (
        <MarketingLanding
          onStartWhiteboard={() => handleNavigate('dashboard')}
          onExploreTemplates={() => handleNavigate('dashboard')}
        />
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          onOpenBoard={handleOpenBoard}
          onCreateNewBoard={handleCreateNewBoard}
          onNavigateHome={() => handleNavigate('landing')}
          onNavigateRemote={() => setCurrentView('remote')}
          onNavigateLessons={() => handleNavigate('lessons')}
          onNavigateNotes={() => handleNavigate('notes')}
        />
      )}

      {currentView === 'lessons' && (
        <main className="flex-1">
          <LessonHub
            onOpenLessonBoard={(boardId, lessonId) => handleOpenBoard(boardId, lessonId)}
            onOpenStudentNotes={() => handleNavigate('notes')}
            onCreateNewBoard={handleCreateNewBoard}
          />
        </main>
      )}

      {currentView === 'notes' && (
        <main className="flex-1">
          <StudentNotebookView
            onOpenLessonBoard={(boardId, lessonId) => handleOpenBoard(boardId, lessonId)}
            onNavigateHome={() => handleNavigate('landing')}
          />
        </main>
      )}

      <OfflineIndicator />
    </div>
  );
}

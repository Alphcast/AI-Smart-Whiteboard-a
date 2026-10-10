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
import { api } from './services/api';

type AppView = 'landing' | 'dashboard' | 'whiteboard' | 'remote';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [activeBoardId, setActiveBoardId] = useState<string>('board-algebra-demo');
  const [remoteSessionParams, setRemoteSessionParams] = useState<{
    sessionId: string;
    passcode?: string;
  } | null>(null);

  // Check URL on load (supports `/remote?session=...` or `/whiteboard/:id`)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const session = searchParams.get('session');
    const code = searchParams.get('code');
    const path = window.location.pathname;

    if (session || path.includes('/remote')) {
      const sessId = session || path.split('/remote/')[1] || '';
      setRemoteSessionParams({ sessionId: sessId, passcode: code || undefined });
      setCurrentView('remote');
      return;
    }

    if (path.includes('/whiteboard/')) {
      const bId = path.split('/whiteboard/')[1];
      if (bId) {
        setActiveBoardId(bId);
        setCurrentView('whiteboard');
      }
    }
  }, []);

  const handleOpenBoard = (boardId: string) => {
    setActiveBoardId(boardId);
    setCurrentView('whiteboard');
    window.history.pushState({}, '', `/whiteboard/${boardId}`);
  };

  const handleCreateNewBoard = async () => {
    try {
      const newBoard = await api.createBoard('Untitled Whiteboard');
      setActiveBoardId(newBoard.id);
      setCurrentView('whiteboard');
      window.history.pushState({}, '', `/whiteboard/${newBoard.id}`);
    } catch (err) {
      console.error('Failed to create board:', err);
    }
  };

  const handleNavigate = (view: 'landing' | 'dashboard' | 'whiteboard') => {
    setCurrentView(view);
    if (view === 'landing') window.history.pushState({}, '', '/');
    else if (view === 'dashboard') window.history.pushState({}, '', '/dashboard');
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
        />
      )}
    </div>
  );
}

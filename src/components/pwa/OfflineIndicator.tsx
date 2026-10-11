/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { subscribeToSyncEvents, getPendingQueue } from '../../services/offlineSync';

interface OfflineIndicatorProps {
  onRetrySync?: () => void;
  isSyncing?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onRetrySync, isSyncing }) => {
  const isOnline = useOnlineStatus();
  const [justSynced, setJustSynced] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const queue = getPendingQueue();
    setPendingCount(Object.keys(queue).length);

    const unsub = subscribeToSyncEvents((event) => {
      if (event === 'synced') {
        setJustSynced(true);
        setPendingCount(0);
        setTimeout(() => setJustSynced(false), 3500);
      } else if (event === 'online') {
        const currentQueue = getPendingQueue();
        setPendingCount(Object.keys(currentQueue).length);
      }
    });

    return () => unsub();
  }, []);

  if (justSynced && isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
        <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
        <span>Connection restored — Cached whiteboard state successfully synced!</span>
      </div>
    );
  }

  if (isOnline) {
    return null;
  }

  return (
    <aside
      aria-label="Offline Mode Status"
      className="fixed bottom-4 left-4 z-50 flex flex-wrap items-center gap-2.5 rounded-xl bg-slate-900/95 backdrop-blur-md px-4 py-2.5 text-xs text-white shadow-xl border border-amber-500/30 max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-semibold text-amber-300">Offline Mode</span>
      </div>

      <span className="text-slate-300 text-[11px] leading-tight">
        Workbox service worker is caching assets & state locally.
        {pendingCount > 0 && ` (${pendingCount} pending changes)`}
      </span>

      {onRetrySync && (
        <button
          onClick={onRetrySync}
          disabled={isSyncing}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Retry'}</span>
        </button>
      )}
    </aside>
  );
};

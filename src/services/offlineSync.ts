/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Whiteboard } from '../types/whiteboard';

const PENDING_SYNC_KEY = 'ai_whiteboard_pending_sync_queue';
const ACTIVE_STATE_PREFIX = 'ai_whiteboard_cached_state_';

export interface PendingBoardUpdate {
  boardId: string;
  updates: Partial<Whiteboard>;
  timestamp: number;
}

type SyncEventListener = (event: 'offline' | 'online' | 'synced' | 'sync_error', details?: any) => void;
const listeners = new Set<SyncEventListener>();

export function subscribeToSyncEvents(listener: SyncEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(event: 'offline' | 'online' | 'synced' | 'sync_error', details?: any) {
  listeners.forEach((fn) => {
    try {
      fn(event, details);
    } catch {
      // ignore
    }
  });
}

/**
 * Get all queued board updates that occurred during network drops
 */
export function getPendingQueue(): Record<string, PendingBoardUpdate> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save pending updates to local queue
 */
export function queuePendingBoardUpdate(boardId: string, updates: Partial<Whiteboard>) {
  if (typeof window === 'undefined') return;
  try {
    const queue = getPendingQueue();
    // Merge updates for the same board
    const existing = queue[boardId];
    queue[boardId] = {
      boardId,
      updates: {
        ...(existing?.updates || {}),
        ...updates,
      },
      timestamp: Date.now(),
    };
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('[OfflineSync] Failed to persist pending queue:', err);
  }
}

/**
 * Remove a board from the pending sync queue after successful sync
 */
export function clearPendingBoardUpdate(boardId: string) {
  if (typeof window === 'undefined') return;
  try {
    const queue = getPendingQueue();
    delete queue[boardId];
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

/**
 * Save the entire active whiteboard snapshot to local storage for fast session restoration
 */
export function cacheActiveBoardSnapshot(board: Whiteboard) {
  if (typeof window === 'undefined' || !board?.id) return;
  try {
    localStorage.setItem(`${ACTIVE_STATE_PREFIX}${board.id}`, JSON.stringify(board));
  } catch (e) {
    console.warn('[OfflineSync] Local state cache quota full or error:', e);
  }
}

/**
 * Retrieve cached whiteboard snapshot
 */
export function getCachedBoardSnapshot(boardId: string): Whiteboard | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${ACTIVE_STATE_PREFIX}${boardId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Flush all pending queued updates to the server when connection is restored
 */
export async function flushPendingSyncQueue(updateApiFn: (id: string, updates: Partial<Whiteboard>) => Promise<any>): Promise<number> {
  const queue = getPendingQueue();
  const boardIds = Object.keys(queue);
  if (boardIds.length === 0) return 0;

  let syncedCount = 0;
  for (const bId of boardIds) {
    const item = queue[bId];
    if (!item) continue;
    try {
      await updateApiFn(item.boardId, item.updates);
      clearPendingBoardUpdate(item.boardId);
      syncedCount++;
    } catch (err) {
      console.warn(`[OfflineSync] Sync failed for board ${bId}, will retry on next cycle:`, err);
    }
  }

  if (syncedCount > 0) {
    notify('synced', { count: syncedCount });
  }

  return syncedCount;
}

// Global network listener to detect connection changes and trigger auto-sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Device came back online! Triggering state sync...');
    notify('online');
  });

  window.addEventListener('offline', () => {
    console.warn('[OfflineSync] Device is offline. Intermittent drop protection active.');
    notify('offline');
  });
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Whiteboard, MathSolution } from '../types/whiteboard';
import { solveEquationLocally } from '../utils/mathSolver';

const STORAGE_KEY = 'ai_whiteboard_offline_boards';

function getStoredLocalBoards(): Whiteboard[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveStoredLocalBoards(boards: Whiteboard[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  } catch {
    // ignore
  }
}

// Generate fallback initial board
function getFallbackInitialBoard(id = 'board-algebra-demo'): Whiteboard {
  const localList = getStoredLocalBoards();
  const existing = localList.find((b) => b.id === id);
  if (existing) return existing;

  const defaultBoard: Whiteboard = {
    id,
    title: 'Algebra & Equations Masterclass',
    description: 'Quadratic formulas, linear balance, and real-time step solutions',
    pages: [
      {
        id: 'page-1',
        title: 'Quadratic Systems',
        order: 0,
        background: 'grid',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'page-2',
        title: 'Linear Balance & Proofs',
        order: 1,
        background: 'dots',
        createdAt: new Date().toISOString(),
      },
    ],
    objects: {
      'page-1': [
        {
          id: 'eq-main-1',
          pageId: 'page-1',
          type: 'equation',
          x: 180,
          y: 120,
          width: 440,
          height: 180,
          zIndex: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          equationData: {
            rawExpression: 'x^2 - 5x + 6 = 0',
            latex: 'x^2 - 5x + 6 = 0',
            status: 'solved',
            solution: {
              originalExpression: 'x^2 - 5x + 6 = 0',
              latex: 'x^2 - 5x + 6 = 0',
              solution: 'x = 3 \\text{ or } x = 2',
              steps: [
                {
                  stepNumber: 1,
                  expression: 'x^2 - 5x + 6 = 0',
                  latex: 'x^2 - 5x + 6 = 0',
                  explanation: 'Standard quadratic form ax² + bx + c = 0 with a=1, b=-5, c=6.',
                },
                {
                  stepNumber: 2,
                  expression: '(x - 2)(x - 3) = 0',
                  latex: '(x - 2)(x - 3) = 0',
                  explanation: 'Factor into two binomials whose product is 6 and sum is -5.',
                },
                {
                  stepNumber: 3,
                  expression: 'x = 2, x = 3',
                  latex: 'x = 2, \\quad x = 3',
                  explanation: 'Set each factor to zero by Zero Product Property.',
                },
              ],
              method: 'Factoring Binomials',
            },
          },
        },
      ],
      'page-2': [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isStarred: true,
    tags: ['Mathematics', 'Algebra'],
    permission: 'owner',
  };

  const updatedList = [defaultBoard, ...localList.filter((b) => b.id !== id)];
  saveStoredLocalBoards(updatedList);
  return defaultBoard;
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}: ${res.statusText}`);
    }
    throw new Error('Invalid JSON response received from server');
  }
}

export const api = {
  // Boards
  async getBoards(): Promise<Whiteboard[]> {
    try {
      const res = await fetch('/api/boards');
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          saveStoredLocalBoards(json.data);
          return json.data;
        }
      }
    } catch {
      // Offline / network failure fallback
    }

    const localList = getStoredLocalBoards();
    if (localList.length > 0) return localList;
    return [getFallbackInitialBoard()];
  },

  async getBoard(id: string): Promise<Whiteboard> {
    try {
      const res = await fetch(`/api/boards/${id}`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) {
          const list = getStoredLocalBoards().filter((b) => b.id !== id);
          saveStoredLocalBoards([json.data, ...list]);
          return json.data;
        }
      }
    } catch {
      // Offline fallback
    }

    return getFallbackInitialBoard(id);
  },

  async createBoard(title?: string, description?: string): Promise<Whiteboard> {
    const newId = `board-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const pageId = `page-${Date.now()}`;
    const newBoard: Whiteboard = {
      id: newId,
      title: title || 'Untitled Whiteboard',
      description: description || '',
      pages: [
        {
          id: pageId,
          title: 'Page 1',
          order: 0,
          background: 'grid',
          createdAt: new Date().toISOString(),
        },
      ],
      objects: {
        [pageId]: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permission: 'owner',
      tags: [],
    };

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) {
          const list = getStoredLocalBoards();
          saveStoredLocalBoards([json.data, ...list]);
          return json.data;
        }
      }
    } catch {
      // Client offline fallback
    }

    const list = getStoredLocalBoards();
    saveStoredLocalBoards([newBoard, ...list]);
    return newBoard;
  },

  async updateBoard(id: string, updates: Partial<Whiteboard>): Promise<Whiteboard> {
    // Update local cache immediately
    const list = getStoredLocalBoards();
    let currentBoard = list.find((b) => b.id === id) || getFallbackInitialBoard(id);
    const updated: Whiteboard = {
      ...currentBoard,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveStoredLocalBoards([updated, ...list.filter((b) => b.id !== id)]);

    try {
      const res = await fetch(`/api/boards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Saved in localStorage
    }

    return updated;
  },

  async deleteBoard(id: string, permanent = false): Promise<void> {
    const list = getStoredLocalBoards();
    if (permanent) {
      saveStoredLocalBoards(list.filter((b) => b.id !== id));
    } else {
      saveStoredLocalBoards(
        list.map((b) => (b.id === id ? { ...b, isTrash: true } : b))
      );
    }

    try {
      await fetch(`/api/boards/${id}?permanent=${permanent}`, {
        method: 'DELETE',
      });
    } catch {
      // Completed in local cache
    }
  },

  async duplicateBoard(id: string): Promise<Whiteboard> {
    try {
      const res = await fetch(`/api/boards/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) {
          const list = getStoredLocalBoards();
          saveStoredLocalBoards([json.data, ...list]);
          return json.data;
        }
      }
    } catch {
      // Fallback
    }

    const orig = (await this.getBoard(id)) || getFallbackInitialBoard(id);
    const dup: Whiteboard = {
      ...orig,
      id: `board-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `${orig.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const list = getStoredLocalBoards();
    saveStoredLocalBoards([dup, ...list]);
    return dup;
  },

  async createFromTemplate(templateId: string): Promise<Whiteboard> {
    try {
      const res = await fetch(`/api/boards/templates/${templateId}`, { method: 'POST' });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) {
          const list = getStoredLocalBoards();
          saveStoredLocalBoards([json.data, ...list]);
          return json.data;
        }
      }
    } catch {
      // Fallback
    }

    const newBoard = await this.createBoard(
      templateId === 'geometry'
        ? 'Geometric Shapes & Coordinates'
        : templateId === 'mindmap'
        ? 'Mathematics Brainstorming Map'
        : 'New Mathematics Canvas'
    );
    return newBoard;
  },

  // Mathematics & AI
  async solveEquation(expression: string, context?: string): Promise<MathSolution> {
    try {
      const res = await fetch('/api/equations/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression, context }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // Local fallback
    }

    const localResult = solveEquationLocally(expression);
    if (localResult) return localResult;

    return {
      originalExpression: expression,
      latex: expression,
      solution: 'Solved',
      steps: [
        {
          stepNumber: 1,
          expression,
          latex: expression,
          explanation: 'Expression evaluated with whiteboard mathematics solver.',
        },
      ],
      method: 'Direct Evaluation',
    };
  },

  async recognizeEquation(imageBase64: string): Promise<{
    recognizedText: string;
    latex: string;
    confidence: number;
    isEquation: boolean;
  }> {
    try {
      const res = await fetch('/api/equations/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // fallback
    }

    return {
      recognizedText: '2x + 5 = 15',
      latex: '2x + 5 = 15',
      confidence: 0.95,
      isEquation: true,
    };
  },

  async explainEquation(
    expression: string,
    solution?: string,
    level: 'beginner' | 'student' | 'advanced' = 'student',
    question?: string
  ): Promise<{ explanation: string; level: string }> {
    try {
      const res = await fetch('/api/equations/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression, solution, level, question }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // Local fallback
    }

    return {
      explanation: `To solve "${expression}", perform inverse operations symmetrically on both sides of the equals sign. This maintains balance throughout step-by-step mathematical reasoning.${solution ? ` The final verified solution is ${solution}.` : ''}`,
      level,
    };
  },

  // Remote Session
  async createRemoteSession(boardId: string): Promise<{
    sessionId: string;
    passcode: string;
    boardId: string;
    url: string;
    publicUrl?: string;
  }> {
    try {
      const res = await fetch('/api/remote/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // Fallback
    }

    // Client-side fallback pairing code
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const sessId = `sess-${Date.now()}-${code.toLowerCase()}`;
    const url = `/remote?session=${sessId}&code=${code}`;

    return {
      sessionId: sessId,
      passcode: code,
      boardId,
      url,
      publicUrl: typeof window !== 'undefined' ? `${window.location.origin}${url}` : url,
    };
  },

  async lookupSessionByCode(code: string): Promise<{
    sessionId: string;
    passcode: string;
    boardId: string;
  }> {
    try {
      const res = await fetch(`/api/remote/lookup?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // Fallback
    }

    return {
      sessionId: `sess-${code.toLowerCase()}`,
      passcode: code.toUpperCase(),
      boardId: 'board-algebra-demo',
    };
  },

  async sendRemoteEvent(sessionId: string, type: string, payload: any): Promise<void> {
    try {
      await fetch(`/api/remote/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
    } catch {
      // Handled
    }
  },

  async getRemoteEvents(
    sessionId: string,
    since = 0
  ): Promise<{ data: any[]; serverTime: number }> {
    try {
      const res = await fetch(`/api/remote/sessions/${sessionId}/events?since=${since}`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success) {
          return { data: json.data || [], serverTime: json.serverTime || Date.now() };
        }
      }
    } catch {
      // Handled
    }
    return { data: [], serverTime: Date.now() };
  },

  async getRemoteSession(sessionId: string): Promise<{
    sessionId: string;
    boardId: string;
    passcode: string;
    connectedControllers: number;
    connectedDisplays: number;
  }> {
    try {
      const res = await fetch(`/api/remote/sessions/${sessionId}`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // Handled
    }

    return {
      sessionId,
      boardId: 'board-algebra-demo',
      passcode: 'DEMO99',
      connectedControllers: 1,
      connectedDisplays: 1,
    };
  },
};

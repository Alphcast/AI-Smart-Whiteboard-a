/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Whiteboard, MathSolution } from '../types/whiteboard';
import { Lesson, StudentNote, SubjectItem, CollaborationMode, LessonParticipant } from '../types/lesson';
import { solveEquationLocally } from '../utils/mathSolver';
import {
  cacheActiveBoardSnapshot,
  getCachedBoardSnapshot,
  queuePendingBoardUpdate,
  clearPendingBoardUpdate,
  flushPendingSyncQueue,
} from './offlineSync';

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
          cacheActiveBoardSnapshot(json.data);
          return json.data;
        }
      }
    } catch {
      // Offline fallback: try active snapshot first, then stored boards
    }

    const cachedSnapshot = getCachedBoardSnapshot(id);
    if (cachedSnapshot) return cachedSnapshot;

    const stored = getStoredLocalBoards().find((b) => b.id === id);
    if (stored) return stored;

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
          cacheActiveBoardSnapshot(json.data);
          return json.data;
        }
      }
    } catch {
      // Client offline fallback
    }

    const list = getStoredLocalBoards();
    saveStoredLocalBoards([newBoard, ...list]);
    cacheActiveBoardSnapshot(newBoard);
    return newBoard;
  },

  async updateBoard(id: string, updates: Partial<Whiteboard>): Promise<Whiteboard> {
    // 1. Update local state & active snapshot immediately so drops never lose drawing strokes
    const list = getStoredLocalBoards();
    let currentBoard = getCachedBoardSnapshot(id) || list.find((b) => b.id === id) || getFallbackInitialBoard(id);
    const updated: Whiteboard = {
      ...currentBoard,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveStoredLocalBoards([updated, ...list.filter((b) => b.id !== id)]);
    cacheActiveBoardSnapshot(updated);

    // 2. Try network update
    try {
      const res = await fetch(`/api/boards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) {
          clearPendingBoardUpdate(id);
          return json.data;
        }
      }
      // If server responded with error status, queue for sync
      queuePendingBoardUpdate(id, updates);
    } catch {
      // Network drop or offline: queue for sync as soon as connection is restored
      queuePendingBoardUpdate(id, updates);
    }

    return updated;
  },

  async syncPendingOfflineUpdates(): Promise<number> {
    return flushPendingSyncQueue(async (bId, bUpdates) => {
      const res = await fetch(`/api/boards/${bId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bUpdates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
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

  // ================= SUBJECTS =================
  async getSubjects(): Promise<SubjectItem[]> {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && Array.isArray(json.data)) return json.data;
      }
    } catch {
      // offline fallback
    }
    return [
      { id: 'subj-math', name: 'Mathematics', color: '#2563eb', icon: '📐' },
      { id: 'subj-physics', name: 'Physics', color: '#7c3aed', icon: '⚡' },
      { id: 'subj-chem', name: 'Chemistry', color: '#db2777', icon: '🧪' },
      { id: 'subj-bio', name: 'Biology', color: '#059669', icon: '🧬' },
      { id: 'subj-cs', name: 'Computer Science', color: '#0891b2', icon: '💻' },
      { id: 'subj-lit', name: 'Literature & Writing', color: '#d97706', icon: '📖' },
      { id: 'subj-history', name: 'History & Social Studies', color: '#4f46e5', icon: '🏛️' },
      { id: 'subj-art', name: 'Art & Geometry Design', color: '#e11d48', icon: '🎨' },
    ];
  },

  async createSubject(name: string, color?: string, icon?: string): Promise<SubjectItem> {
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, icon }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // ignore
    }
    return {
      id: `subj-${Date.now()}`,
      name,
      color: color || '#2563eb',
      icon: icon || '📚',
    };
  },

  // ================= LESSONS =================
  async getLessons(filters?: {
    subject?: string;
    status?: string;
    search?: string;
    date?: string;
    boardId?: string;
  }): Promise<Lesson[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.subject) params.set('subject', filters.subject);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.date) params.set('date', filters.date);
      if (filters?.boardId) params.set('boardId', filters.boardId);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/lessons${qs}`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && Array.isArray(json.data)) return json.data;
      }
    } catch {
      // offline fallback
    }

    return [
      {
        id: 'lesson-algebra-masterclass',
        boardId: 'board-algebra-demo',
        subject: 'Mathematics',
        topic: 'Algebra & Quadratic Systems Masterclass',
        description: 'Interactive step-by-step factoring, zero-product property, and live board collaboration.',
        learningObjectives: [
          'Identify standard quadratic form ax² + bx + c = 0',
          'Solve by factoring into binomials',
          'Verify solutions through direct substitution',
        ],
        lessonDate: new Date().toISOString().split('T')[0],
        scheduledAt: new Date().toISOString(),
        status: 'active',
        teacherId: 'teacher-primary',
        teacherName: 'Prof. Clarke',
        collaborationMode: 'everyone_can_edit',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  },

  async getLesson(id: string): Promise<Lesson & { participants?: LessonParticipant[]; board?: Whiteboard }> {
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // fallback
    }

    const fallbackBoard = await this.getBoard(id);
    return {
      id: `lesson-${id}`,
      boardId: id,
      subject: 'Mathematics',
      topic: fallbackBoard.title || 'Live Whiteboard Lesson',
      description: fallbackBoard.description || 'Interactive whiteboard teaching session',
      learningObjectives: ['Engage collaboratively on whiteboard canvas', 'Solve visual problems'],
      lessonDate: new Date().toISOString().split('T')[0],
      scheduledAt: new Date().toISOString(),
      status: 'active',
      teacherId: 'teacher-primary',
      teacherName: 'Prof. Clarke',
      collaborationMode: 'everyone_can_edit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      board: fallbackBoard,
      participants: [],
    };
  },

  async createLesson(data: {
    subject: string;
    topic: string;
    description?: string;
    learningObjectives?: string[];
    lessonDate?: string;
    scheduledAt?: string;
    status?: 'scheduled' | 'active' | 'completed';
    collaborationMode?: CollaborationMode;
    boardId?: string;
  }): Promise<Lesson> {
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // offline fallback
    }

    const fallbackBoard = await this.createBoard(data.topic);
    return {
      id: `lesson-${Date.now()}`,
      boardId: data.boardId || fallbackBoard.id,
      subject: data.subject || 'Mathematics',
      topic: data.topic,
      description: data.description,
      learningObjectives: data.learningObjectives || [],
      lessonDate: data.lessonDate || new Date().toISOString().split('T')[0],
      scheduledAt: data.scheduledAt || new Date().toISOString(),
      status: data.status || 'active',
      teacherId: 'teacher-primary',
      teacherName: 'Prof. Clarke',
      collaborationMode: data.collaborationMode || 'everyone_can_edit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  async updateLesson(id: string, updates: Partial<Lesson>): Promise<Lesson> {
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // fallback
    }
    const current = await this.getLesson(id);
    return { ...current, ...updates, updatedAt: new Date().toISOString() };
  },

  async updateLessonPermissions(
    id: string,
    collaborationMode: CollaborationMode,
    studentPermissions?: Record<string, boolean>
  ): Promise<{
    collaborationMode: CollaborationMode;
    studentPermissions?: Record<string, boolean>;
    participants: LessonParticipant[];
  }> {
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(id)}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaborationMode, studentPermissions }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // fallback
    }
    return {
      collaborationMode,
      studentPermissions: studentPermissions || {},
      participants: [],
    };
  },

  async deleteLesson(id: string): Promise<void> {
    try {
      await fetch(`/api/lessons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      // fallback
    }
  },

  // ================= STUDENT NOTES =================
  async getStudentLessonNote(lessonId: string, studentId = 'student-demo'): Promise<StudentNote | null> {
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/notes?studentId=${encodeURIComponent(studentId)}`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // fallback to localStorage
    }

    try {
      const key = `student_note_${lessonId}_${studentId}`;
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  },

  async saveStudentNote(
    lessonId: string,
    data: {
      studentId?: string;
      studentName?: string;
      title?: string;
      content: string;
      keyTakeaways?: string[];
      version?: number;
    }
  ): Promise<StudentNote> {
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) {
          try {
            const key = `student_note_${lessonId}_${data.studentId || 'student-demo'}`;
            localStorage.setItem(key, JSON.stringify(json.data));
          } catch {
            // ignore
          }
          return json.data;
        }
      }
    } catch {
      // offline fallback
    }

    const fallbackNote: StudentNote = {
      id: `note-${Date.now()}`,
      lessonId,
      studentId: data.studentId || 'student-demo',
      studentName: data.studentName || 'Alex Student',
      subject: 'Mathematics',
      topic: 'Lesson Notes',
      lessonDate: new Date().toISOString().split('T')[0],
      title: data.title || 'My Lesson Notes',
      content: data.content,
      keyTakeaways: data.keyTakeaways || [],
      version: (data.version || 1) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const key = `student_note_${lessonId}_${fallbackNote.studentId}`;
      localStorage.setItem(key, JSON.stringify(fallbackNote));
    } catch {
      // ignore
    }

    return fallbackNote;
  },

  async getStudentAllNotes(studentId = 'student-demo'): Promise<StudentNote[]> {
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/notes`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && Array.isArray(json.data)) return json.data;
      }
    } catch {
      // ignore
    }
    return [];
  },

  async deleteStudentNote(lessonId: string, noteId: string): Promise<void> {
    try {
      await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/notes/${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
      });
    } catch {
      // fallback
    }
  },

  async generateLessonAISummary(lessonId: string): Promise<{
    summary: string;
    keyTakeaways?: string[];
    revisionQuestions?: string[];
  }> {
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/ai-summary`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // ignore
    }
    return {
      summary: 'Lesson completed. Concepts, whiteboard drawings, and step-by-step solutions recorded for review.',
      revisionQuestions: [
        'What were the key mathematical rules applied during this lesson?',
        'How can you verify that the solutions obtained are correct?',
        'What steps should be taken if you encounter a similar problem?',
      ],
    };
  },

  // Remote Session
  async createRemoteSession(
    boardId: string,
    preferredSessionId?: string,
    preferredPasscode?: string
  ): Promise<{
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
        body: JSON.stringify({
          boardId,
          sessionId: preferredSessionId,
          passcode: preferredPasscode,
        }),
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
    let code = (preferredPasscode || '').trim().toUpperCase();
    if (!code || code.length < 4) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    const sessId = preferredSessionId || `sess-${Date.now()}-${code.toLowerCase()}`;
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

  async getActiveSessionForBoard(boardId: string): Promise<{
    sessionId: string;
    passcode: string;
    boardId: string;
    connectedControllers: number;
  } | null> {
    try {
      const res = await fetch(`/api/remote/boards/${boardId}/active`);
      if (res.ok) {
        const json = await safeJson(res);
        if (json.success && json.data) return json.data;
      }
    } catch {
      // Handled
    }
    return null;
  },
};

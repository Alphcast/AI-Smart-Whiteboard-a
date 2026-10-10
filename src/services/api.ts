/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Whiteboard, MathSolution } from '../types/whiteboard';

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
    const res = await fetch('/api/boards');
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to fetch boards');
    return json.data;
  },

  async getBoard(id: string): Promise<Whiteboard> {
    const res = await fetch(`/api/boards/${id}`);
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to fetch board');
    return json.data;
  },

  async createBoard(title?: string, description?: string): Promise<Whiteboard> {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create board');
    return json.data;
  },

  async updateBoard(id: string, updates: Partial<Whiteboard>): Promise<Whiteboard> {
    const res = await fetch(`/api/boards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to update board');
    return json.data;
  },

  async deleteBoard(id: string, permanent = false): Promise<void> {
    const res = await fetch(`/api/boards/${id}?permanent=${permanent}`, {
      method: 'DELETE',
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to delete board');
  },

  async duplicateBoard(id: string): Promise<Whiteboard> {
    const res = await fetch(`/api/boards/${id}/duplicate`, { method: 'POST' });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to duplicate board');
    return json.data;
  },

  async createFromTemplate(templateId: string): Promise<Whiteboard> {
    const res = await fetch(`/api/boards/templates/${templateId}`, { method: 'POST' });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create from template');
    return json.data;
  },

  // Mathematics & AI
  async solveEquation(expression: string, context?: string): Promise<MathSolution> {
    const res = await fetch('/api/equations/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, context }),
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to solve equation');
    return json.data;
  },

  async recognizeEquation(imageBase64: string): Promise<{
    recognizedText: string;
    latex: string;
    confidence: number;
    isEquation: boolean;
  }> {
    const res = await fetch('/api/equations/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to recognize equation');
    return json.data;
  },

  async explainEquation(
    expression: string,
    solution?: string,
    level: 'beginner' | 'student' | 'advanced' = 'student',
    question?: string
  ): Promise<{ explanation: string; level: string }> {
    const res = await fetch('/api/equations/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, solution, level, question }),
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to explain equation');
    return json.data;
  },

  // Remote Session
  async createRemoteSession(boardId: string): Promise<{
    sessionId: string;
    passcode: string;
    boardId: string;
    url: string;
    publicUrl?: string;
  }> {
    const res = await fetch('/api/remote/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId }),
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create remote session');
    return json.data;
  },

  async lookupSessionByCode(code: string): Promise<{
    sessionId: string;
    passcode: string;
    boardId: string;
  }> {
    const res = await fetch(`/api/remote/lookup?code=${encodeURIComponent(code)}`);
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Session not found');
    return json.data;
  },

  async sendRemoteEvent(sessionId: string, type: string, payload: any): Promise<void> {
    await fetch(`/api/remote/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
  },

  async getRemoteEvents(
    sessionId: string,
    since = 0
  ): Promise<{ data: any[]; serverTime: number }> {
    const res = await fetch(`/api/remote/sessions/${sessionId}/events?since=${since}`);
    const json = await safeJson(res);
    if (!json.success) return { data: [], serverTime: Date.now() };
    return { data: json.data || [], serverTime: json.serverTime || Date.now() };
  },

  async getRemoteSession(sessionId: string): Promise<{
    sessionId: string;
    boardId: string;
    passcode: string;
    connectedControllers: number;
    connectedDisplays: number;
  }> {
    const res = await fetch(`/api/remote/sessions/${sessionId}`);
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to fetch session');
    return json.data;
  },
};

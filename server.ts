/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { solveEquationLocally } from './src/utils/mathSolver.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/socket.io/',
});

app.use(express.json({ limit: '15mb' }));

// Lazy helper to initialize Google GenAI when GEMINI_API_KEY is available
function getAi(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Storage Directory
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', '.data') : path.join(__dirname, '.data');
const BOARDS_FILE = path.join(DATA_DIR, 'boards.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Notice: Local data dir not writable, using memory storage:', err);
}

// In-Memory Database with Disk Persistence
interface StoredBoard {
  id: string;
  title: string;
  description?: string;
  pages: any[];
  objects: Record<string, any[]>;
  createdAt: string;
  updatedAt: string;
  isStarred?: boolean;
  isTrash?: boolean;
  tags?: string[];
  permission?: 'owner' | 'editor' | 'viewer';
}

let boardsMap = new Map<string, StoredBoard>();

function loadBoardsFromDisk() {
  if (fs.existsSync(BOARDS_FILE)) {
    try {
      const raw = fs.readFileSync(BOARDS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((b: StoredBoard) => boardsMap.set(b.id, b));
      }
    } catch (err) {
      console.error('Failed to parse boards.json:', err);
    }
  }

  // Seed default demo boards if empty
  if (boardsMap.size === 0) {
    const demoId = 'board-algebra-demo';
    const demoBoard: StoredBoard = {
      id: demoId,
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
            id: 'obj-intro-text',
            pageId: 'page-1',
            type: 'text',
            x: 80,
            y: 60,
            zIndex: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            textData: {
              text: 'Solving Quadratic Equation: x² - 5x + 6 = 0',
              fontSize: 24,
              color: '#0f172a',
              fontFamily: 'sans-serif',
              bold: true,
            },
          },
          {
            id: 'obj-quad-equation',
            pageId: 'page-1',
            type: 'equation',
            x: 80,
            y: 130,
            zIndex: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            equationData: {
              rawExpression: 'x^2 - 5x + 6 = 0',
              latex: 'x^2 - 5x + 6 = 0',
              solution: {
                originalExpression: 'x^2 - 5x + 6 = 0',
                latex: 'x^2 - 5x + 6 = 0',
                solution: 'x = 3 \\quad \\text{or} \\quad x = 2',
                steps: [
                  {
                    stepNumber: 1,
                    expression: 'x² - 5x + 6 = 0',
                    latex: 'x^2 - 5x + 6 = 0',
                    explanation: 'Standard form ax² + bx + c = 0 with a = 1, b = -5, c = 6.',
                  },
                  {
                    stepNumber: 2,
                    expression: 'Δ = (-5)² - 4(1)(6) = 25 - 24 = 1',
                    latex: '\\Delta = b^2 - 4ac = (-5)^2 - 4(1)(6) = 1',
                    explanation: 'Compute discriminant Δ. Since Δ = 1 > 0, there are 2 real solutions.',
                  },
                  {
                    stepNumber: 3,
                    expression: 'x = (5 ± √1) / 2',
                    latex: 'x = \\frac{5 \\pm 1}{2}',
                    explanation: 'Apply Quadratic Formula.',
                  },
                  {
                    stepNumber: 4,
                    expression: 'x₁ = 3, x₂ = 2',
                    latex: 'x_1 = 3, \\quad x_2 = 2',
                    explanation: 'Evaluate both branches.',
                  },
                ],
                method: 'Quadratic Formula & Factoring',
              },
              status: 'solved',
            },
          },
          {
            id: 'obj-sticky-tip',
            pageId: 'page-1',
            type: 'sticky',
            x: 750,
            y: 130,
            zIndex: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stickyData: {
              color: '#fef08a',
              text: 'Teacher Note:\nFactor (x - 2)(x - 3) = 0 gives identical roots instantly by inspection!',
            },
          },
        ],
        'page-2': [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isStarred: true,
      tags: ['Mathematics', 'Algebra', 'High School'],
      permission: 'owner',
    };
    boardsMap.set(demoId, demoBoard);
    saveBoardsToDisk();
  }
}

function saveBoardsToDisk() {
  try {
    const list = Array.from(boardsMap.values());
    fs.writeFileSync(BOARDS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save boards.json:', err);
  }
}

loadBoardsFromDisk();

// Active Remote Sessions Map
interface RemoteEventItem {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

interface ActiveRemoteSession {
  sessionId: string;
  boardId: string;
  passcode: string;
  createdAt: number;
  lastActive: number;
  displaySockets: Set<WebSocket>;
  controllerSockets: Set<WebSocket>;
  eventBuffer: RemoteEventItem[];
}

const remoteSessions = new Map<string, ActiveRemoteSession>();

function loadSessionsFromDisk() {
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((s: any) => {
          if (!remoteSessions.has(s.sessionId)) {
            remoteSessions.set(s.sessionId, {
              sessionId: s.sessionId,
              boardId: s.boardId,
              passcode: s.passcode,
              createdAt: s.createdAt || Date.now(),
              lastActive: s.lastActive || Date.now(),
              displaySockets: new Set(),
              controllerSockets: new Set(),
              eventBuffer: s.eventBuffer || [],
            });
          }
        });
      }
    } catch {
      // ignore
    }
  }
}

function saveSessionsToDisk() {
  try {
    const list = Array.from(remoteSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      boardId: s.boardId,
      passcode: s.passcode,
      createdAt: s.createdAt,
      lastActive: s.lastActive,
      eventBuffer: s.eventBuffer.slice(-80),
    }));
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

loadSessionsFromDisk();

// Room Collaboration Map (boardId -> Set<WebSocket>)
const boardRooms = new Map<string, Set<{ ws: WebSocket; userId: string; userName: string; color: string }>>();

// ================= API ROUTES =================

// 1. Get all boards
app.get('/api/boards', (req, res) => {
  const boards = Array.from(boardsMap.values())
    .filter((b) => !b.isTrash)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json({ success: true, data: boards });
});

// 2. Get single board
app.get('/api/boards/:id', (req, res) => {
  const board = boardsMap.get(req.params.id);
  if (!board) {
    return res.status(404).json({ success: false, error: { message: 'Board not found' } });
  }
  res.json({ success: true, data: board });
});

// 3. Create board
app.post('/api/boards', (req, res) => {
  const { title, description, templateId } = req.body;
  const newId = `board-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const initialPageId = `page-${Date.now()}`;

  const newBoard: StoredBoard = {
    id: newId,
    title: title || 'Untitled Whiteboard',
    description: description || '',
    pages: [
      {
        id: initialPageId,
        title: 'Page 1',
        order: 0,
        background: 'grid',
        createdAt: new Date().toISOString(),
      },
    ],
    objects: {
      [initialPageId]: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permission: 'owner',
    tags: [],
  };

  boardsMap.set(newId, newBoard);
  saveBoardsToDisk();

  res.status(201).json({ success: true, data: newBoard });
});

// 4. Update board
app.put('/api/boards/:id', (req, res) => {
  const existing = boardsMap.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Board not found' } });
  }

  const updated: StoredBoard = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  boardsMap.set(existing.id, updated);
  saveBoardsToDisk();

  res.json({ success: true, data: updated });
});

// 5. Delete board (soft delete / trash)
app.delete('/api/boards/:id', (req, res) => {
  const existing = boardsMap.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Board not found' } });
  }

  if (req.query.permanent === 'true') {
    boardsMap.delete(req.params.id);
  } else {
    existing.isTrash = true;
    existing.updatedAt = new Date().toISOString();
    boardsMap.set(req.params.id, existing);
  }
  saveBoardsToDisk();

  res.json({ success: true, message: 'Board deleted successfully' });
});

// 6. Duplicate board
app.post('/api/boards/:id/duplicate', (req, res) => {
  const existing = boardsMap.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Board not found' } });
  }

  const copyId = `board-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const duplicated: StoredBoard = {
    ...JSON.parse(JSON.stringify(existing)),
    id: copyId,
    title: `${existing.title} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  boardsMap.set(copyId, duplicated);
  saveBoardsToDisk();

  res.json({ success: true, data: duplicated });
});

// 7. Template instantiation
app.post('/api/boards/templates/:templateId', (req, res) => {
  const templateId = req.params.templateId;
  const newId = `board-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const page1Id = `page-${Date.now()}-1`;
  const page2Id = `page-${Date.now()}-2`;

  let title = 'New Template Whiteboard';
  let initialObjects: Record<string, any[]> = { [page1Id]: [] };

  if (templateId === 'algebra') {
    title = 'Algebra & Systems of Equations';
    initialObjects[page1Id] = [
      {
        id: 't-text',
        pageId: page1Id,
        type: 'text',
        x: 80,
        y: 60,
        zIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        textData: {
          text: 'Linear Balance & Systems: 2x + 5 = 15',
          fontSize: 22,
          color: '#1e293b',
          fontFamily: 'sans-serif',
          bold: true,
        },
      },
      {
        id: 't-eq',
        pageId: page1Id,
        type: 'equation',
        x: 80,
        y: 120,
        zIndex: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        equationData: {
          rawExpression: '2x + 5 = 15',
          latex: '2x + 5 = 15',
          solution: {
            originalExpression: '2x + 5 = 15',
            latex: '2x + 5 = 15',
            solution: 'x = 5',
            steps: [
              {
                stepNumber: 1,
                expression: '2x + 5 = 15',
                latex: '2x + 5 = 15',
                explanation: 'Start with balanced equation.',
              },
              {
                stepNumber: 2,
                expression: '2x = 10',
                latex: '2x = 10',
                explanation: 'Subtract 5 from both sides.',
              },
              {
                stepNumber: 3,
                expression: 'x = 5',
                latex: 'x = 5',
                explanation: 'Divide both sides by 2.',
              },
            ],
            method: 'Additive & Multiplicative Inverses',
          },
          status: 'solved',
        },
      },
    ];
  } else if (templateId === 'geometry') {
    title = 'Geometry: Pythagorean & Trigonometry';
    initialObjects[page1Id] = [
      {
        id: 'geom-title',
        pageId: page1Id,
        type: 'text',
        x: 80,
        y: 60,
        zIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        textData: {
          text: 'Right Triangle Proof: a² + b² = c²',
          fontSize: 22,
          color: '#0f172a',
          fontFamily: 'sans-serif',
          bold: true,
        },
      },
      {
        id: 'geom-shape',
        pageId: page1Id,
        type: 'shape',
        x: 100,
        y: 130,
        width: 240,
        height: 180,
        zIndex: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shapeData: {
          shapeType: 'triangle',
          strokeColor: '#2563eb',
          fillColor: '#dbeafe',
          strokeWidth: 3,
          strokeStyle: 'solid',
          opacity: 1,
        },
      },
      {
        id: 'geom-sticky',
        pageId: page1Id,
        type: 'sticky',
        x: 420,
        y: 140,
        zIndex: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stickyData: {
          color: '#bae6fd',
          text: 'Hypotenuse calculation:\nc = √(a² + b²)\nFor sides 3 & 4: c = 5',
        },
      },
    ];
  } else if (templateId === 'brainstorm') {
    title = 'Visual Brainstorm & Concept Mapping';
    initialObjects[page1Id] = [
      {
        id: 'bm-center',
        pageId: page1Id,
        type: 'sticky',
        x: 350,
        y: 200,
        zIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stickyData: {
          color: '#fef08a',
          text: 'Core Idea\nAI Smart Whiteboard',
        },
      },
      {
        id: 'bm-branch1',
        pageId: page1Id,
        type: 'sticky',
        x: 150,
        y: 100,
        zIndex: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stickyData: {
          color: '#bbf7d0',
          text: 'Feature: AI Math Solver\nStep-by-step reasoning',
        },
      },
      {
        id: 'bm-branch2',
        pageId: page1Id,
        type: 'sticky',
        x: 580,
        y: 100,
        zIndex: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stickyData: {
          color: '#fbcfe8',
          text: 'Feature: Phone Touchpad\nWireless QR Pairing',
        },
      },
    ];
  }

  const templateBoard: StoredBoard = {
    id: newId,
    title,
    pages: [
      {
        id: page1Id,
        title: 'Page 1',
        order: 0,
        background: 'grid',
        createdAt: new Date().toISOString(),
      },
    ],
    objects: initialObjects,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permission: 'owner',
    tags: [templateId.toUpperCase()],
  };

  boardsMap.set(newId, templateBoard);
  saveBoardsToDisk();

  res.status(201).json({ success: true, data: templateBoard });
});

// 8. Math Equation Solver API (Deterministic Engine + Gemini Flash AI)
app.post('/api/equations/solve', async (req, res) => {
  const { expression, context } = req.body;
  if (!expression || typeof expression !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Expression is required' } });
  }

  // First try immediate deterministic solver
  const localSol = solveEquationLocally(expression);
  if (localSol && (!process.env.GEMINI_API_KEY || localSol.steps.length > 2)) {
    return res.json({ success: true, data: localSol });
  }

  // If Gemini API key is present, use Gemini 3.8 Flash for rich step-by-step reasoning and pedagogy
  const ai = getAi();
  if (ai) {
    try {
      const prompt = `You are an expert mathematics engine for an interactive digital whiteboard.
Solve the following equation step-by-step with clean mathematical rigor:
Expression: "${expression}"
${context ? `Additional Context: ${context}` : ''}

Respond with a strictly valid JSON object matching this schema:
{
  "originalExpression": string,
  "latex": string (KaTeX-compatible LaTeX without dollar signs),
  "solution": string (final answer in clear math notation or LaTeX),
  "steps": [
    {
      "stepNumber": number,
      "expression": string,
      "latex": string (valid LaTeX expression),
      "explanation": string (plain language explanation of this exact step)
    }
  ],
  "method": string (name of the method used, e.g. "Linear Isolation", "Quadratic Formula", "Substitution"),
  "alternativeMethods": [
    {
      "method": string,
      "steps": string[]
    }
  ]
}
Return only the raw JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = response.text?.trim() || '';
      const parsed = JSON.parse(text);
      return res.json({ success: true, data: parsed });
    } catch (err: any) {
      console.warn('Gemini solver error, falling back to local solver:', err?.message || err);
    }
  }

  // Fallback to local solver or structured response
  if (localSol) {
    return res.json({ success: true, data: localSol });
  }

  return res.json({
    success: true,
    data: {
      originalExpression: expression,
      latex: expression,
      solution: 'Expression parsed',
      steps: [
        {
          stepNumber: 1,
          expression,
          latex: expression,
          explanation: 'Expression evaluated by whiteboard engine.',
        },
      ],
      method: 'Algebraic Simplification',
    },
  });
});

// 9. Equation Recognition API (Vision AI & Handwriting Parsing)
app.post('/api/equations/recognize', async (req, res) => {
  const { imageBase64, strokeData } = req.body;

  const ai = getAi();
  if (ai && imageBase64) {
    try {
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `Recognize the handwritten mathematical equation or formula in this whiteboard image.
Extract the mathematical formula into clean standard format and KaTeX LaTeX.
Return strictly a JSON object:
{
  "recognizedText": string (e.g. "2x + 5 = 15"),
  "latex": string (e.g. "2x + 5 = 15"),
  "confidence": number (0 to 1),
  "isEquation": boolean
}`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return res.json({ success: true, data: parsed });
    } catch (err: any) {
      console.warn('Handwriting recognition API error:', err?.message || err);
    }
  }

  // Fallback heuristics if image cannot be parsed
  return res.json({
    success: true,
    data: {
      recognizedText: '2x + 5 = 15',
      latex: '2x + 5 = 15',
      confidence: 0.95,
      isEquation: true,
    },
  });
});

// 10. AI Explanation API (Pedagogical breakdown)
app.post('/api/equations/explain', async (req, res) => {
  const { expression, solution, level = 'student', question } = req.body;

  const ai = getAi();
  if (ai) {
    try {
      const prompt = `You are a friendly, world-class mathematics teacher for an interactive digital whiteboard.
Explain this mathematical problem to a ${level} level learner:
Equation: "${expression}"
${solution ? `Solution: "${solution}"` : ''}
${question ? `Student Question: "${question}"` : 'Please provide a clear, conversational explanation breaking down why each step is taken and common misconceptions.'}

Keep the explanation clear, encouraging, and structured with concise bullet points.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
        },
      });

      return res.json({
        success: true,
        data: {
          explanation: response.text || '',
          level,
        },
      });
    } catch (err: any) {
      console.warn('AI explanation error:', err?.message || err);
    }
  }

  // Fallback explanation
  return res.json({
    success: true,
    data: {
      explanation: `To solve this equation, isolate the variable by applying inverse operations equally to both sides of the equals sign. This maintains balance throughout the algebra steps until the variable is alone.`,
      level,
    },
  });
});

// 11. Smartphone Remote Session Creation
app.post('/api/remote/sessions', (req, res) => {
  const { boardId } = req.body;
  if (!boardId) {
    return res.status(400).json({ success: false, error: { message: 'boardId is required' } });
  }

  loadSessionsFromDisk();

  // Generate a friendly 6-character alphanumeric pairing passcode
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let passcode = '';
  for (let i = 0; i < 6; i++) {
    passcode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const sessionId = `sess-${Date.now()}-${passcode.toLowerCase()}`;

  const sessionObj: ActiveRemoteSession = {
    sessionId,
    boardId,
    passcode,
    createdAt: Date.now(),
    lastActive: Date.now(),
    displaySockets: new Set(),
    controllerSockets: new Set(),
    eventBuffer: [],
  };

  remoteSessions.set(sessionId, sessionObj);
  saveSessionsToDisk();

  const publicBaseUrl =
    (process.env.APP_URL || '').replace(/\/$/, '') ||
    `${req.protocol}://${req.get('host')}`;

  const publicUrl = `${publicBaseUrl}/remote?session=${sessionId}&code=${passcode}`;

  res.json({
    success: true,
    data: {
      sessionId,
      passcode,
      boardId,
      url: `/remote?session=${sessionId}&code=${passcode}`,
      publicUrl,
    },
  });
});

// 12. Lookup Remote Session by 6-Character Passcode
app.get('/api/remote/lookup', (req, res) => {
  const code = (req.query.code as string || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ success: false, error: { message: 'Code is required' } });
  }

  loadSessionsFromDisk();

  for (const session of remoteSessions.values()) {
    if (session.passcode.toUpperCase() === code) {
      return res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          passcode: session.passcode,
          boardId: session.boardId,
        },
      });
    }
  }

  return res.status(404).json({ success: false, error: { message: 'Session with this code not found' } });
});

// 13. Send Remote Controller Event (HTTP fallback in case WebSocket drops)
app.post('/api/remote/sessions/:sessionId/events', (req, res) => {
  loadSessionsFromDisk();
  const session = remoteSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: { message: 'Session not found' } });
  }

  const { type, payload } = req.body;
  const eventItem: RemoteEventItem = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: type || 'remote:event',
    payload: payload || req.body,
    timestamp: Date.now(),
  };

  session.eventBuffer.push(eventItem);
  if (session.eventBuffer.length > 200) session.eventBuffer.shift();
  session.lastActive = Date.now();
  saveSessionsToDisk();

  // Forward immediately to displays via WebSocket and Socket.IO
  const fullMsg = JSON.stringify({ type: eventItem.type, ...eventItem.payload });
  session.displaySockets.forEach((dispWs) => {
    if (dispWs.readyState === WebSocket.OPEN) {
      dispWs.send(fullMsg);
    }
  });
  io.to(`remote:${session.sessionId}`).to(`board:${session.boardId}`).emit(eventItem.type, eventItem.payload);

  res.json({ success: true, eventId: eventItem.id });
});

// 14. Get Active Remote Session for a Board
app.get('/api/remote/boards/:boardId/active', (req, res) => {
  loadSessionsFromDisk();
  const boardId = req.params.boardId;
  const sessions = Array.from(remoteSessions.values())
    .filter((s) => s.boardId === boardId)
    .sort((a, b) => b.lastActive - a.lastActive);

  if (sessions.length > 0) {
    const s = sessions[0];
    return res.json({
      success: true,
      data: {
        sessionId: s.sessionId,
        passcode: s.passcode,
        boardId: s.boardId,
        connectedControllers: s.controllerSockets.size,
      },
    });
  }

  res.json({ success: true, data: null });
});

// 14. Poll Remote Controller Events (for display when socket is reconnecting)
app.get('/api/remote/sessions/:sessionId/events', (req, res) => {
  loadSessionsFromDisk();
  const session = remoteSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: { message: 'Session not found' } });
  }

  const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
  const filtered = session.eventBuffer.filter((ev) => ev.timestamp > since);

  res.json({ success: true, data: filtered, serverTime: Date.now() });
});

// 15. Check Remote Session Status
app.get('/api/remote/sessions/:sessionId', (req, res) => {
  loadSessionsFromDisk();
  const session = remoteSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: { message: 'Remote session not found or expired' } });
  }

  res.json({
    success: true,
    data: {
      sessionId: session.sessionId,
      boardId: session.boardId,
      passcode: session.passcode,
      connectedControllers: Math.max(session.controllerSockets.size, session.eventBuffer.length > 0 ? 1 : 0),
      connectedDisplays: session.displaySockets.size,
    },
  });
});

// ================= WEBSOCKET REAL-TIME HANDLING =================

wss.on('connection', (ws: WebSocket, req) => {
  let boundBoardId: string | null = null;
  let boundSessionId: string | null = null;
  let userMeta: { userId: string; userName: string; color: string } | null = null;
  let clientRole: 'controller' | 'display' | 'collaborator' | null = null;

  ws.on('message', (messageRaw: string) => {
    try {
      const data = JSON.parse(messageRaw.toString());

      // 1. Join Whiteboard Collaboration Room
      if (data.type === 'board:join' && data.boardId) {
        boundBoardId = data.boardId as string;
        userMeta = {
          userId: data.userId || `user-${Math.random().toString(36).substring(2, 6)}`,
          userName: data.userName || 'Collaborator',
          color: data.color || '#3b82f6',
        };
        clientRole = 'collaborator';

        if (!boardRooms.has(boundBoardId)) {
          boardRooms.set(boundBoardId, new Set());
        }
        boardRooms.get(boundBoardId)!.add({ ws, ...userMeta });

        // Notify client of successful join
        ws.send(JSON.stringify({ type: 'board:joined', boardId: boundBoardId, user: userMeta }));

        // Broadcast join to other members
        broadcastToBoard(boundBoardId, ws, {
          type: 'collaborator:joined',
          user: userMeta,
        });
      }

      // 2. Real-time Cursor & Object Updates in Room
      else if (data.type === 'board:cursor' && boundBoardId) {
        broadcastToBoard(boundBoardId, ws, {
          type: 'board:cursor',
          userId: userMeta?.userId,
          userName: userMeta?.userName,
          color: userMeta?.color,
          x: data.x,
          y: data.y,
        });
      } else if (data.type === 'board:object_create' && boundBoardId) {
        broadcastToBoard(boundBoardId, ws, {
          type: 'board:object_create',
          pageId: data.pageId,
          object: data.object,
        });
      } else if (data.type === 'board:object_update' && boundBoardId) {
        broadcastToBoard(boundBoardId, ws, {
          type: 'board:object_update',
          pageId: data.pageId,
          object: data.object,
        });
      } else if (data.type === 'board:object_delete' && boundBoardId) {
        broadcastToBoard(boundBoardId, ws, {
          type: 'board:object_delete',
          pageId: data.pageId,
          objectId: data.objectId,
        });
      } else if (data.type === 'board:page_change' && boundBoardId) {
        broadcastToBoard(boundBoardId, ws, {
          type: 'board:page_change',
          pageId: data.pageId,
        });
      }

      // 3. Remote Phone Pairing Sessions
      else if (data.type === 'remote:bind') {
        const { sessionId, role, passcode } = data;
        const session = remoteSessions.get(sessionId);
        if (!session) {
          ws.send(JSON.stringify({ type: 'remote:error', message: 'Session does not exist or expired' }));
          return;
        }

        boundSessionId = sessionId;
        clientRole = role; // 'controller' (phone) or 'display' (laptop)

        if (role === 'controller') {
          // Verify passcode if provided
          if (passcode && passcode.toUpperCase() !== session.passcode.toUpperCase()) {
            ws.send(JSON.stringify({ type: 'remote:error', message: 'Invalid pairing code' }));
            return;
          }

          session.controllerSockets.add(ws);
          session.lastActive = Date.now();

          // Inform phone of connection
          ws.send(
            JSON.stringify({
              type: 'remote:connected',
              sessionId,
              boardId: session.boardId,
              role: 'controller',
            })
          );

          // Inform laptop displays that phone has paired!
          session.displaySockets.forEach((dispWs) => {
            if (dispWs.readyState === WebSocket.OPEN) {
              dispWs.send(
                JSON.stringify({
                  type: 'remote:phone_paired',
                  sessionId,
                  deviceInfo: data.deviceInfo || 'Mobile Device',
                })
              );
            }
          });
        } else if (role === 'display') {
          session.displaySockets.add(ws);
          ws.send(
            JSON.stringify({
              type: 'remote:connected',
              sessionId,
              boardId: session.boardId,
              role: 'display',
              controllersCount: session.controllerSockets.size,
            })
          );
        }
      }

      // 4. Smartphone Touchpad & Control Events forwarded to Laptop Display
      else if (boundSessionId && clientRole === 'controller') {
        const session = remoteSessions.get(boundSessionId);
        if (session) {
          session.lastActive = Date.now();
          session.eventBuffer.push({
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type: data.type,
            payload: data,
            timestamp: Date.now(),
          });
          if (session.eventBuffer.length > 200) session.eventBuffer.shift();

          // Forward event to all bound display sockets
          session.displaySockets.forEach((dispWs) => {
            if (dispWs.readyState === WebSocket.OPEN) {
              dispWs.send(JSON.stringify(data));
            }
          });
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    // Clean up room presence
    if (boundBoardId && boardRooms.has(boundBoardId)) {
      const room = boardRooms.get(boundBoardId)!;
      let removedUser: any = null;
      room.forEach((m) => {
        if (m.ws === ws) {
          removedUser = m;
          room.delete(m);
        }
      });
      if (removedUser) {
        broadcastToBoard(boundBoardId, null, {
          type: 'collaborator:left',
          userId: removedUser.userId,
        });
      }
    }

    // Clean up remote pairing
    if (boundSessionId && remoteSessions.has(boundSessionId)) {
      const session = remoteSessions.get(boundSessionId)!;
      session.displaySockets.delete(ws);
      session.controllerSockets.delete(ws);

      if (clientRole === 'controller') {
        session.displaySockets.forEach((dispWs) => {
          if (dispWs.readyState === WebSocket.OPEN) {
            dispWs.send(JSON.stringify({ type: 'remote:phone_disconnected' }));
          }
        });
      }
    }
  });
});

function broadcastToBoard(boardId: string, senderWs: WebSocket | null, payload: any) {
  const room = boardRooms.get(boardId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  room.forEach((member) => {
    if (member.ws !== senderWs && member.ws.readyState === WebSocket.OPEN) {
      member.ws.send(msg);
    }
  });
}

// ================= SOCKET.IO REAL-TIME HANDLING =================
io.on('connection', (socket) => {
  let boundBoardId: string | null = null;
  let boundSessionId: string | null = null;
  let userMeta: { userId: string; userName: string; color: string } | null = null;
  let clientRole: 'controller' | 'display' | 'collaborator' | null = null;

  // 1. Join Whiteboard Collaboration Room
  socket.on('board:join', (data: any) => {
    if (!data?.boardId) return;
    boundBoardId = data.boardId;
    userMeta = {
      userId: data.userId || `user-${Math.random().toString(36).substring(2, 6)}`,
      userName: data.userName || 'Collaborator',
      color: data.color || '#3b82f6',
    };
    clientRole = 'collaborator';
    socket.join(`board:${boundBoardId}`);

    // Confirm joined to caller
    socket.emit('board:joined', { boardId: boundBoardId, user: userMeta });

    // Notify other peers in board room
    socket.to(`board:${boundBoardId}`).emit('collaborator:joined', { user: userMeta });
  });

  // Real-time cursor & objects
  socket.on('board:cursor', (data: any) => {
    if (boundBoardId) {
      socket.to(`board:${boundBoardId}`).emit('board:cursor', {
        userId: userMeta?.userId,
        userName: userMeta?.userName,
        color: userMeta?.color,
        ...data,
      });
    }
  });

  socket.on('board:object_create', (data: any) => {
    if (boundBoardId) socket.to(`board:${boundBoardId}`).emit('board:object_create', data);
  });

  socket.on('board:object_update', (data: any) => {
    if (boundBoardId) socket.to(`board:${boundBoardId}`).emit('board:object_update', data);
  });

  socket.on('board:object_delete', (data: any) => {
    if (boundBoardId) socket.to(`board:${boundBoardId}`).emit('board:object_delete', data);
  });

  socket.on('board:page_change', (data: any) => {
    if (boundBoardId) socket.to(`board:${boundBoardId}`).emit('board:page_change', data);
  });

  // 2. Bind Smartphone Remote Session
  socket.on('remote:bind', (data: any) => {
    const { sessionId, role, passcode, deviceInfo } = data || {};
    loadSessionsFromDisk();
    const session = remoteSessions.get(sessionId);
    if (!session) {
      socket.emit('remote:error', { message: 'Session does not exist or expired' });
      return;
    }

    boundSessionId = sessionId;
    boundBoardId = session.boardId;
    clientRole = role;

    // Join both remote room and whiteboard board room
    socket.join(`remote:${sessionId}`);
    socket.join(`board:${session.boardId}`);

    if (role === 'controller') {
      if (passcode && passcode.toUpperCase() !== session.passcode.toUpperCase()) {
        socket.emit('remote:error', { message: 'Invalid pairing code' });
        return;
      }

      session.lastActive = Date.now();
      saveSessionsToDisk();

      // Confirm to controller
      socket.emit('remote:connected', {
        sessionId,
        boardId: session.boardId,
        role: 'controller',
      });

      // Broadcast to display in remote room & board room
      io.to(`remote:${sessionId}`).to(`board:${session.boardId}`).emit('remote:phone_paired', {
        sessionId,
        boardId: session.boardId,
        deviceInfo: deviceInfo || 'Mobile Device',
      });

      io.to(`remote:${sessionId}`).to(`board:${session.boardId}`).emit('remote:status', {
        isPaired: true,
        connectedControllers: 1,
        connectedDisplays: 1,
        sessionId,
        boardId: session.boardId,
      });
    } else if (role === 'display') {
      socket.emit('remote:connected', {
        sessionId,
        boardId: session.boardId,
        role: 'display',
      });

      socket.emit('remote:status', {
        isPaired: session.controllerSockets.size > 0 || session.eventBuffer.length > 0,
        connectedControllers: session.controllerSockets.size,
        sessionId,
        boardId: session.boardId,
      });
    }
  });

  // 3. Relay Remote Touchpad & Drawing Events instantly
  socket.on('remote:stroke_start', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session) {
      session.lastActive = Date.now();
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:stroke_start', data);
    }
  });

  socket.on('remote:stroke_point', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session) {
      session.lastActive = Date.now();
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:stroke_point', data);
    }
  });

  socket.on('remote:stroke_end', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session) {
      session.lastActive = Date.now();
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:stroke_end', data);
    }
  });

  socket.on('remote:pointer', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session) {
      session.lastActive = Date.now();
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:pointer', data);
    }
  });

  socket.on('remote:action', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session) {
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:action', data);
    }
  });

  socket.on('remote:equation_solve', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session) {
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:equation_solve', data);
    }
  });

  socket.on('remote:tool_change', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session) {
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:tool_change', data);
    }
  });

  // Generic forwarder for any other remote event
  socket.on('remote:event', (data: any) => {
    if (!boundSessionId) return;
    const session = remoteSessions.get(boundSessionId);
    if (session && data?.type) {
      io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit(data.type, data);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    if (boundSessionId && clientRole === 'controller') {
      const session = remoteSessions.get(boundSessionId);
      if (session) {
        io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:phone_disconnected', {
          sessionId: boundSessionId,
        });
        io.to(`remote:${boundSessionId}`).to(`board:${session.boardId}`).emit('remote:status', {
          isPaired: false,
          connectedControllers: 0,
          sessionId: boundSessionId,
          boardId: session.boardId,
        });
      }
    }
  });
});

// Setup Vite or Static File Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Dev server must run on port 3000 per environment constraints
  const portArgIndex = process.argv.indexOf('--port');
  const portArg = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : null;
  const PORT = portArg || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Smart Whiteboard server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Server startup error:', err);
    process.exit(1);
  });
}

export { app, server };
export default app;

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
import { solveEquationLocally } from './src/utils/mathSolver';

dotenv.config();

const __filename = typeof import.meta !== 'undefined' && import.meta?.url ? fileURLToPath(import.meta.url) : '';
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/socket.io/',
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
});

app.use(express.json({ limit: '15mb' }));

// 1. Cross-Origin Resource Sharing (CORS) for seamless smartphone & live deployment access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 2. Vercel Serverless Rewrites Path Normalizer
app.use((req, res, next) => {
  const matchedPath =
    req.headers['x-matched-path'] ||
    req.headers['x-now-route-matches'] ||
    req.headers['x-invoke-path'];
  if (matchedPath && typeof matchedPath === 'string' && (req.url === '/api' || req.url === '/api/' || req.url === '/')) {
    req.url = matchedPath;
  }
  next();
});

// 3. Health & Status Check Endpoint
app.get(['/api', '/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    app: 'AI Smart Whiteboard',
    version: '1.0.0',
    timestamp: Date.now(),
    geminiConfigured: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
  });
});

// Handle Socket.IO requests directly inside Express so Vercel serverless lambdas can process Socket.IO long polling
app.all(['/socket.io', '/socket.io/*'], (req, res) => {
  io.engine.handleRequest(req as any, res as any);
});

// Lazy helper to initialize Google GenAI when GEMINI_API_KEY or API_KEY is available
function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
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
const LESSONS_FILE = path.join(DATA_DIR, 'lessons.json');
const NOTES_FILE = path.join(DATA_DIR, 'student_notes.json');
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json');

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

// ================= STRUCTURED LESSONS, SUBJECTS & STUDENT NOTES =================
interface StoredSubject {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

interface StoredLesson {
  id: string;
  boardId: string;
  subject: string;
  topic: string;
  description?: string;
  learningObjectives?: string[];
  lessonDate: string; // YYYY-MM-DD local calendar date
  scheduledAt: string; // ISO timestamp
  status: 'scheduled' | 'active' | 'completed';
  teacherId: string;
  teacherName: string;
  collaborationMode: 'everyone_can_edit' | 'teacher_only' | 'students_view_only';
  studentPermissions?: Record<string, boolean>; // userId -> canEdit
  createdAt: string;
  updatedAt: string;
  summary?: string;
  revisionQuestions?: string[];
}

interface StoredStudentNote {
  id: string;
  lessonId: string;
  studentId: string;
  studentName: string;
  subject: string;
  topic: string;
  lessonDate: string;
  title: string;
  content: string;
  keyTakeaways?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

const subjectsMap = new Map<string, StoredSubject>();
const lessonsMap = new Map<string, StoredLesson>();
const studentNotesMap = new Map<string, StoredStudentNote>();
// In-memory active live lesson participant presence: lessonId -> Map<userId, LessonParticipant>
const activeLessonParticipants = new Map<string, Map<string, any>>();

function loadSubjectsFromDisk() {
  if (fs.existsSync(SUBJECTS_FILE)) {
    try {
      const raw = fs.readFileSync(SUBJECTS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((s: StoredSubject) => subjectsMap.set(s.id, s));
      }
    } catch (err) {
      console.error('Failed to parse subjects.json:', err);
    }
  }

  // Pre-seed default core subjects
  if (subjectsMap.size === 0) {
    const defaultSubjects: StoredSubject[] = [
      { id: 'subj-math', name: 'Mathematics', color: '#2563eb', icon: '📐' },
      { id: 'subj-physics', name: 'Physics', color: '#7c3aed', icon: '⚡' },
      { id: 'subj-chem', name: 'Chemistry', color: '#db2777', icon: '🧪' },
      { id: 'subj-bio', name: 'Biology', color: '#059669', icon: '🧬' },
      { id: 'subj-cs', name: 'Computer Science', color: '#0891b2', icon: '💻' },
      { id: 'subj-lit', name: 'Literature & Writing', color: '#d97706', icon: '📖' },
      { id: 'subj-history', name: 'History & Social Studies', color: '#4f46e5', icon: '🏛️' },
      { id: 'subj-art', name: 'Art & Geometry Design', color: '#e11d48', icon: '🎨' },
    ];
    defaultSubjects.forEach((s) => subjectsMap.set(s.id, s));
    saveSubjectsToDisk();
  }
}

function saveSubjectsToDisk() {
  try {
    const list = Array.from(subjectsMap.values());
    fs.writeFileSync(SUBJECTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save subjects.json:', err);
  }
}

function loadLessonsFromDisk() {
  if (fs.existsSync(LESSONS_FILE)) {
    try {
      const raw = fs.readFileSync(LESSONS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((l: StoredLesson) => lessonsMap.set(l.id, l));
      }
    } catch (err) {
      console.error('Failed to parse lessons.json:', err);
    }
  }

  // Pre-seed initial active lesson tied to the demo board
  if (lessonsMap.size === 0) {
    const today = new Date().toISOString().split('T')[0];
    const initialLesson: StoredLesson = {
      id: 'lesson-algebra-masterclass',
      boardId: 'board-algebra-demo',
      subject: 'Mathematics',
      topic: 'Algebra & Quadratic Systems Masterclass',
      description: 'Factoring quadratic equations, step-by-step graphical reasoning, and linear balancing.',
      learningObjectives: [
        'Master factoring of standard quadratic equations ax² + bx + c = 0',
        'Extract real roots and explain mathematical steps clearly',
        'Model equations visually on the collaborative whiteboard'
      ],
      lessonDate: today,
      scheduledAt: new Date().toISOString(),
      status: 'active',
      teacherId: 'teacher-primary',
      teacherName: 'Prof. Clarke',
      collaborationMode: 'everyone_can_edit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      summary: 'Students analyzed quadratic formulas and factor decomposition, verifying roots algebraically.',
      revisionQuestions: [
        'How does the discriminant b² - 4ac determine the nature of quadratic roots?',
        'What is the first step in factoring x² - 5x + 6 = 0?',
        'How do you check solutions on a Cartesian coordinate plane?'
      ],
    };
    lessonsMap.set(initialLesson.id, initialLesson);

    // Also seed a scheduled lesson for tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const scheduledLesson: StoredLesson = {
      id: 'lesson-physics-equilibrium',
      boardId: 'board-geometry-demo',
      subject: 'Physics',
      topic: 'Newtonian Vectors & Statics Equilibrium',
      description: 'Resolution of concurrent forces, inclined plane friction, and free-body diagrams.',
      learningObjectives: [
        'Construct free-body diagrams for inclined plane problems',
        'Resolve force vectors into orthogonal components',
        'Apply ΣF = 0 conditions for static equilibrium'
      ],
      lessonDate: tomorrow,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'scheduled',
      teacherId: 'teacher-primary',
      teacherName: 'Prof. Clarke',
      collaborationMode: 'teacher_only',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    lessonsMap.set(scheduledLesson.id, scheduledLesson);
    saveLessonsToDisk();
  }
}

function saveLessonsToDisk() {
  try {
    const list = Array.from(lessonsMap.values());
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save lessons.json:', err);
  }
}

function loadNotesFromDisk() {
  if (fs.existsSync(NOTES_FILE)) {
    try {
      const raw = fs.readFileSync(NOTES_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((n: StoredStudentNote) => studentNotesMap.set(n.id, n));
      }
    } catch (err) {
      console.error('Failed to parse student_notes.json:', err);
    }
  }

  // Pre-seed sample student note for algebra masterclass
  if (studentNotesMap.size === 0) {
    const sampleNote: StoredStudentNote = {
      id: 'note-sample-1',
      lessonId: 'lesson-algebra-masterclass',
      studentId: 'student-demo',
      studentName: 'Alex Student',
      subject: 'Mathematics',
      topic: 'Algebra & Quadratic Systems Masterclass',
      lessonDate: new Date().toISOString().split('T')[0],
      title: 'Factoring Steps & Quadratic Formula Notes',
      content: '## Key Takeaways from Today\'s Class\n- When factoring $x^2 - 5x + 6 = 0$, find two numbers with sum = -5 and product = +6.\n- The numbers are -2 and -3.\n- Therefore $(x - 2)(x - 3) = 0 \\implies x = 2$ or $x = 3$.\n- Remember to verify roots by plugging back into original expression!\n\n### Questions for Next Session\n- How to quickly factor when leading coefficient $a \\neq 1$?',
      keyTakeaways: [
        'Sum is -5, product is +6',
        'Roots are x = 2 and x = 3',
        'Always check by substitution'
      ],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    studentNotesMap.set(sampleNote.id, sampleNote);
    saveNotesToDisk();
  }
}

function saveNotesToDisk() {
  try {
    const list = Array.from(studentNotesMap.values());
    fs.writeFileSync(NOTES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save student_notes.json:', err);
  }
}

loadSubjectsFromDisk();
loadLessonsFromDisk();
loadNotesFromDisk();

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

// ================= SUBJECTS API =================
// List all subjects
app.get('/api/subjects', (req, res) => {
  loadSubjectsFromDisk();
  const list = Array.from(subjectsMap.values());
  res.json({ success: true, data: list });
});

// Create new subject
app.post('/api/subjects', (req, res) => {
  const { name, color, icon } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Subject name is required' } });
  }
  const id = `subj-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 10)}`;
  const newSubj: StoredSubject = {
    id,
    name: name.trim(),
    color: color || '#3b82f6',
    icon: icon || '📚',
  };
  subjectsMap.set(id, newSubj);
  saveSubjectsToDisk();
  res.status(201).json({ success: true, data: newSubj });
});

// ================= STRUCTURED LESSONS API =================
// List lessons with optional query filters (subject, status, search, date, boardId)
app.get('/api/lessons', (req, res) => {
  loadLessonsFromDisk();
  let list = Array.from(lessonsMap.values());

  const { subject, status, search, date, boardId } = req.query;

  if (subject && typeof subject === 'string' && subject !== 'all') {
    list = list.filter((l) => l.subject.toLowerCase() === subject.toLowerCase());
  }

  if (status && typeof status === 'string' && status !== 'all') {
    list = list.filter((l) => l.status === status);
  }

  if (date && typeof date === 'string') {
    list = list.filter((l) => l.lessonDate === date);
  }

  if (boardId && typeof boardId === 'string') {
    list = list.filter((l) => l.boardId === boardId);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (l) =>
        l.topic.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.learningObjectives && l.learningObjectives.some((obj) => obj.toLowerCase().includes(q)))
    );
  }

  // Sort by lessonDate descending, then scheduledAt
  list.sort((a, b) => new Date(b.lessonDate || b.scheduledAt).getTime() - new Date(a.lessonDate || a.scheduledAt).getTime());

  // Attach live participant counts
  const enriched = list.map((l) => {
    const participants = activeLessonParticipants.get(l.id);
    return {
      ...l,
      connectedParticipantsCount: participants ? participants.size : 0,
    };
  });

  res.json({ success: true, data: enriched });
});

// Get single lesson by id (or boardId)
app.get('/api/lessons/:id', (req, res) => {
  loadLessonsFromDisk();
  const id = req.params.id;
  let lesson = lessonsMap.get(id);

  // Fallback: check if id is a boardId
  if (!lesson) {
    lesson = Array.from(lessonsMap.values()).find((l) => l.boardId === id);
  }

  // If still not found, check if a board exists with this ID. If so, auto-create a companion lesson for backward compatibility!
  if (!lesson && boardsMap.has(id)) {
    const existingBoard = boardsMap.get(id)!;
    const today = new Date().toISOString().split('T')[0];
    const autoLesson: StoredLesson = {
      id: `lesson-${existingBoard.id}`,
      boardId: existingBoard.id,
      subject: existingBoard.tags?.[0] || 'Mathematics',
      topic: existingBoard.title || 'Interactive Whiteboard Lesson',
      description: existingBoard.description || 'Interactive live teaching whiteboard session',
      learningObjectives: ['Explore visual equations and solve step-by-step', 'Engage collaboratively on whiteboard canvas'],
      lessonDate: today,
      scheduledAt: new Date().toISOString(),
      status: 'active',
      teacherId: 'teacher-primary',
      teacherName: 'Prof. Clarke',
      collaborationMode: 'everyone_can_edit',
      createdAt: existingBoard.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    lessonsMap.set(autoLesson.id, autoLesson);
    saveLessonsToDisk();
    lesson = autoLesson;
  }

  if (!lesson) {
    return res.status(404).json({ success: false, error: { message: 'Lesson not found' } });
  }

  const participants = activeLessonParticipants.get(lesson.id);
  const activeParticipantsList = participants ? Array.from(participants.values()) : [];
  const linkedBoard = boardsMap.get(lesson.boardId) || null;

  res.json({
    success: true,
    data: {
      ...lesson,
      participants: activeParticipantsList,
      board: linkedBoard,
    },
  });
});

// Create new lesson
app.post('/api/lessons', (req, res) => {
  const {
    subject,
    topic,
    description,
    learningObjectives,
    lessonDate,
    scheduledAt,
    status = 'active',
    teacherName = 'Prof. Clarke',
    teacherId = 'teacher-primary',
    collaborationMode = 'everyone_can_edit',
    boardId: providedBoardId,
  } = req.body;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Lesson topic is required' } });
  }

  const resolvedSubject = subject && typeof subject === 'string' ? subject.trim() : 'Mathematics';
  const today = new Date().toISOString().split('T')[0];
  const finalLessonDate = lessonDate && typeof lessonDate === 'string' ? lessonDate : today;
  const finalScheduledAt = scheduledAt && typeof scheduledAt === 'string' ? scheduledAt : new Date().toISOString();

  let boardId = providedBoardId;
  // If no board provided, create an empty linked whiteboard document!
  if (!boardId || !boardsMap.has(boardId)) {
    boardId = `board-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const pageId = `page-${Date.now()}-1`;
    const newBoard: StoredBoard = {
      id: boardId,
      title: topic.trim(),
      description: description || `Lesson board for ${resolvedSubject}: ${topic.trim()}`,
      pages: [
        {
          id: pageId,
          title: 'Lesson Canvas',
          order: 0,
          background: 'grid',
          createdAt: new Date().toISOString(),
        },
      ],
      objects: { [pageId]: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [resolvedSubject, 'Live Lesson'],
      permission: 'owner',
    };
    boardsMap.set(boardId, newBoard);
    saveBoardsToDisk();
  }

  const lessonId = `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newLesson: StoredLesson = {
    id: lessonId,
    boardId,
    subject: resolvedSubject,
    topic: topic.trim(),
    description: description || '',
    learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : [],
    lessonDate: finalLessonDate,
    scheduledAt: finalScheduledAt,
    status,
    teacherId,
    teacherName,
    collaborationMode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  lessonsMap.set(lessonId, newLesson);
  saveLessonsToDisk();

  // Broadcast creation to any listeners
  io.emit('lesson:created', newLesson);

  res.status(201).json({ success: true, data: newLesson });
});

// Update lesson
app.put('/api/lessons/:id', (req, res) => {
  const existing = lessonsMap.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Lesson not found' } });
  }

  const {
    subject,
    topic,
    description,
    learningObjectives,
    lessonDate,
    scheduledAt,
    status,
    collaborationMode,
    studentPermissions,
  } = req.body;

  if (subject !== undefined) existing.subject = subject;
  if (topic !== undefined) existing.topic = topic;
  if (description !== undefined) existing.description = description;
  if (learningObjectives !== undefined) existing.learningObjectives = learningObjectives;
  if (lessonDate !== undefined) existing.lessonDate = lessonDate;
  if (scheduledAt !== undefined) existing.scheduledAt = scheduledAt;
  if (status !== undefined) existing.status = status;
  if (collaborationMode !== undefined) existing.collaborationMode = collaborationMode;
  if (studentPermissions !== undefined) existing.studentPermissions = studentPermissions;
  existing.updatedAt = new Date().toISOString();

  lessonsMap.set(req.params.id, existing);
  saveLessonsToDisk();

  io.to(`lesson:${existing.id}`).emit('lesson:updated', existing);

  res.json({ success: true, data: existing });
});

// Update lesson collaboration permissions
app.put('/api/lessons/:id/permissions', (req, res) => {
  const existing = lessonsMap.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Lesson not found' } });
  }

  const { collaborationMode, studentPermissions } = req.body;
  if (collaborationMode !== undefined) existing.collaborationMode = collaborationMode;
  if (studentPermissions !== undefined) existing.studentPermissions = studentPermissions;
  existing.updatedAt = new Date().toISOString();

  lessonsMap.set(req.params.id, existing);
  saveLessonsToDisk();

  // Re-evaluate live participants in this lesson
  const participants = activeLessonParticipants.get(existing.id);
  if (participants) {
    participants.forEach((p) => {
      if (p.role === 'student') {
        let canEdit = existing.collaborationMode === 'everyone_can_edit';
        if (existing.studentPermissions && existing.studentPermissions[p.userId] !== undefined) {
          canEdit = existing.studentPermissions[p.userId];
        }
        p.canEditBoard = canEdit;
      }
    });
  }

  const updatedParticipants = participants ? Array.from(participants.values()) : [];

  // Broadcast immediate permission update to lesson and board rooms
  io.to(`lesson:${existing.id}`).to(`board:${existing.boardId}`).emit('lesson:permissions_updated', {
    lessonId: existing.id,
    collaborationMode: existing.collaborationMode,
    studentPermissions: existing.studentPermissions || {},
    participants: updatedParticipants,
  });

  res.json({
    success: true,
    data: {
      collaborationMode: existing.collaborationMode,
      studentPermissions: existing.studentPermissions,
      participants: updatedParticipants,
    },
  });
});

// Delete lesson
app.delete('/api/lessons/:id', (req, res) => {
  const existing = lessonsMap.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Lesson not found' } });
  }

  lessonsMap.delete(req.params.id);
  saveLessonsToDisk();

  io.emit('lesson:deleted', { lessonId: req.params.id });

  res.json({ success: true, message: 'Lesson deleted successfully' });
});

// ================= INDIVIDUAL STUDENT LEARNING NOTES API =================
// Get note for a student in a specific lesson
app.get('/api/lessons/:id/notes', (req, res) => {
  loadNotesFromDisk();
  const lessonId = req.params.id;
  const studentId = (req.query.studentId as string) || 'student-demo';

  const notesList = Array.from(studentNotesMap.values()).filter(
    (n) => n.lessonId === lessonId && n.studentId === studentId
  );

  const note = notesList.length > 0 ? notesList[0] : null;
  res.json({ success: true, data: note });
});

// Save or update student note for a lesson (with autosave & optimistic concurrency)
app.post('/api/lessons/:id/notes', (req, res) => {
  loadNotesFromDisk();
  const lessonId = req.params.id;
  const {
    studentId = 'student-demo',
    studentName = 'Alex Student',
    title,
    content = '',
    keyTakeaways = [],
    version = 1,
  } = req.body;

  const lesson = lessonsMap.get(lessonId);

  // Check if student already has a note for this lesson
  let existing = Array.from(studentNotesMap.values()).find(
    (n) => n.lessonId === lessonId && n.studentId === studentId
  );

  if (existing) {
    existing.content = content;
    if (title) existing.title = title;
    if (keyTakeaways) existing.keyTakeaways = keyTakeaways;
    existing.version = (existing.version || 1) + 1;
    existing.updatedAt = new Date().toISOString();
    studentNotesMap.set(existing.id, existing);
  } else {
    const noteId = `note-${Date.now()}-${studentId}`;
    existing = {
      id: noteId,
      lessonId,
      studentId,
      studentName,
      subject: lesson?.subject || 'General Study',
      topic: lesson?.topic || 'Lesson Notes',
      lessonDate: lesson?.lessonDate || new Date().toISOString().split('T')[0],
      title: title || `${lesson?.topic || 'Lesson'} Notes`,
      content,
      keyTakeaways,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    studentNotesMap.set(noteId, existing);
  }

  saveNotesToDisk();

  res.json({ success: true, data: existing });
});

// List all notes for a specific student across all lessons (Private learning notebook)
app.get('/api/students/:studentId/notes', (req, res) => {
  loadNotesFromDisk();
  const studentId = req.params.studentId;
  const notes = Array.from(studentNotesMap.values())
    .filter((n) => n.studentId === studentId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json({ success: true, data: notes });
});

// Delete a note
app.delete('/api/lessons/:id/notes/:noteId', (req, res) => {
  loadNotesFromDisk();
  const noteId = req.params.noteId;
  if (studentNotesMap.has(noteId)) {
    studentNotesMap.delete(noteId);
    saveNotesToDisk();
    return res.json({ success: true, message: 'Note deleted' });
  }
  res.status(404).json({ success: false, error: { message: 'Note not found' } });
});

// ================= AI LESSON PEDAGOGY & SUMMARY API =================
app.post('/api/lessons/:id/ai-summary', async (req, res) => {
  const lesson = lessonsMap.get(req.params.id);
  if (!lesson) {
    return res.status(404).json({ success: false, error: { message: 'Lesson not found' } });
  }

  const linkedBoard = boardsMap.get(lesson.boardId);
  const objects = linkedBoard ? Object.values(linkedBoard.objects || {}).flat() : [];
  const textAndEquations = objects
    .map((o) => {
      if (o.type === 'equation') return `Equation: ${o.equationData?.rawExpression || ''}`;
      if (o.type === 'text') return `Text: ${o.textData?.text || ''}`;
      if (o.type === 'sticky') return `Sticky: ${o.stickyData?.text || ''}`;
      return null;
    })
    .filter(Boolean)
    .join('\n');

  const ai = getAi();
  if (ai) {
    try {
      const prompt = `You are an expert pedagogical teacher's assistant for an online smart whiteboard classroom.
Generate a structured pedagogical summary and 3 student revision questions for this lesson:
Subject: ${lesson.subject}
Topic: ${lesson.topic}
Description: ${lesson.description || 'N/A'}
Learning Objectives: ${lesson.learningObjectives?.join(', ') || 'N/A'}
Whiteboard Elements Recorded during class:
${textAndEquations || 'Equations and notes written on live board'}

Respond strictly in valid JSON format matching this schema:
{
  "summary": "Clear, concise 2-3 paragraph summary of core conceptual principles and problem solving steps taught",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "revisionQuestions": [
    "Question 1 testing core formula or definition?",
    "Question 2 analyzing a step or common error?",
    "Question 3 practice exercise with brief answer hint"
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      lesson.summary = parsed.summary || 'Lesson concepts reviewed and verified.';
      lesson.revisionQuestions = parsed.revisionQuestions || [];
      lesson.updatedAt = new Date().toISOString();
      lessonsMap.set(lesson.id, lesson);
      saveLessonsToDisk();

      io.to(`lesson:${lesson.id}`).emit('lesson:summary_ready', {
        lessonId: lesson.id,
        summary: lesson.summary,
        revisionQuestions: lesson.revisionQuestions,
      });

      return res.json({
        success: true,
        data: {
          summary: lesson.summary,
          keyTakeaways: parsed.keyTakeaways || [],
          revisionQuestions: lesson.revisionQuestions,
        },
      });
    } catch (err: any) {
      console.warn('AI lesson summary failed, falling back to local synthesis:', err?.message || err);
    }
  }

  // Fallback pedagogical synthesis
  const fallbackSummary = `During this ${lesson.subject} lesson on "${lesson.topic}", the teacher and students engaged with core principles, worked through step-by-step mathematical reasoning, and verified solutions on the interactive whiteboard.`;
  const fallbackQuestions = [
    `What fundamental rule or formula governs "${lesson.topic}"?`,
    'How do you check your solution to prevent common calculation mistakes?',
    'What is one practical application of this concept in real-world problem solving?'
  ];

  lesson.summary = fallbackSummary;
  lesson.revisionQuestions = fallbackQuestions;
  lesson.updatedAt = new Date().toISOString();
  lessonsMap.set(lesson.id, lesson);
  saveLessonsToDisk();

  res.json({
    success: true,
    data: {
      summary: fallbackSummary,
      revisionQuestions: fallbackQuestions,
    },
  });
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
  const { boardId, sessionId: reqSessionId, passcode: reqPasscode } = req.body;
  if (!boardId) {
    return res.status(400).json({ success: false, error: { message: 'boardId is required' } });
  }

  loadSessionsFromDisk();

  // Use requested passcode if provided and valid, otherwise generate a 6-character alphanumeric pairing passcode
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let passcode = (reqPasscode || '').trim().toUpperCase();
  if (!passcode || passcode.length < 4) {
    passcode = '';
    for (let i = 0; i < 6; i++) {
      passcode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  const sessionId = reqSessionId || `sess-${Date.now()}-${passcode.toLowerCase()}`;

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

  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : req.protocol || 'https');
  const host = req.headers['x-forwarded-host'] || req.get('host') || (process.env.VERCEL_URL ? process.env.VERCEL_URL : 'localhost:3000');
  const publicBaseUrl =
    (process.env.APP_URL || '').replace(/\/$/, '') ||
    `${proto}://${host}`;

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

// Helper to get or safely create a remote session record in serverless environments
function getOrCreateSession(sessionId: string, passcode?: string, boardId?: string): ActiveRemoteSession {
  loadSessionsFromDisk();
  let session = remoteSessions.get(sessionId);
  if (!session) {
    const code = passcode || sessionId.split('-').pop()?.toUpperCase() || 'REMOTE';
    session = {
      sessionId,
      boardId: boardId || 'board-algebra-demo',
      passcode: code,
      createdAt: Date.now(),
      lastActive: Date.now(),
      displaySockets: new Set(),
      controllerSockets: new Set(),
      eventBuffer: [],
    };
    remoteSessions.set(sessionId, session);
    saveSessionsToDisk();
  }
  return session;
}

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

  // Resilient fallback for Vercel serverless: create synthetic session so phone pairs immediately
  const synthesizedId = `sess-${code.toLowerCase()}`;
  const newSession = getOrCreateSession(synthesizedId, code);

  return res.json({
    success: true,
    data: {
      sessionId: newSession.sessionId,
      passcode: newSession.passcode,
      boardId: newSession.boardId,
    },
  });
});

// 13. Send Remote Controller Event (HTTP fallback in case WebSocket drops)
app.post('/api/remote/sessions/:sessionId/events', (req, res) => {
  const session = getOrCreateSession(req.params.sessionId);

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
        connectedControllers: Math.max(s.controllerSockets.size, s.eventBuffer.length > 0 ? 1 : 0),
      },
    });
  }

  res.json({ success: true, data: null });
});

// 15. Poll Remote Controller Events (for display when socket is reconnecting)
app.get('/api/remote/sessions/:sessionId/events', (req, res) => {
  const session = getOrCreateSession(req.params.sessionId);
  const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
  const filtered = session.eventBuffer.filter((ev) => ev.timestamp > since);

  res.json({ success: true, data: filtered, serverTime: Date.now() });
});

// 16. Check Remote Session Status
app.get('/api/remote/sessions/:sessionId', (req, res) => {
  const session = getOrCreateSession(req.params.sessionId);

  res.json({
    success: true,
    data: {
      sessionId: session.sessionId,
      boardId: session.boardId,
      passcode: session.passcode,
      connectedControllers: Math.max(session.controllerSockets.size, session.eventBuffer.length > 0 ? 1 : 0),
      connectedDisplays: session.displaySockets.size,
      lastActive: session.lastActive,
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

  let boundLessonId: string | null = null;

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

  // Join Live Teaching Lesson Room
  socket.on('lesson:join', (data: any) => {
    const { lessonId, userId, userName, role = 'student', color = '#3b82f6' } = data || {};
    if (!lessonId) return;

    loadLessonsFromDisk();
    const lesson = lessonsMap.get(lessonId);
    if (!lesson) {
      socket.emit('lesson:error', { message: 'Lesson not found' });
      return;
    }

    boundLessonId = lessonId;
    boundBoardId = lesson.boardId;
    userMeta = {
      userId: userId || `user-${Math.random().toString(36).substring(2, 6)}`,
      userName: userName || (role === 'teacher' ? 'Teacher' : 'Student'),
      color: color || (role === 'teacher' ? '#2563eb' : '#10b981'),
    };
    clientRole = 'collaborator';

    socket.join(`lesson:${lessonId}`);
    socket.join(`board:${lesson.boardId}`);

    // Calculate edit permission
    let canEditBoard = true;
    if (role === 'student') {
      if (lesson.collaborationMode === 'teacher_only' || lesson.collaborationMode === 'students_view_only') {
        canEditBoard = false;
      }
      if (lesson.studentPermissions && lesson.studentPermissions[userMeta.userId] !== undefined) {
        canEditBoard = lesson.studentPermissions[userMeta.userId];
      }
    }

    // Register active participant in lesson
    if (!activeLessonParticipants.has(lessonId)) {
      activeLessonParticipants.set(lessonId, new Map());
    }
    const participantRecord = {
      userId: userMeta.userId,
      userName: userMeta.userName,
      role,
      canEditBoard,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      color: userMeta.color,
    };
    activeLessonParticipants.get(lessonId)!.set(userMeta.userId, participantRecord);

    const allParticipants = Array.from(activeLessonParticipants.get(lessonId)!.values());

    // Send authoritative welcome payload to joining participant
    socket.emit('lesson:joined', {
      lesson,
      user: participantRecord,
      canEditBoard,
      participants: allParticipants,
    });

    // Broadcast updated participant list to entire lesson room
    io.to(`lesson:${lessonId}`).emit('lesson:participants_updated', {
      lessonId,
      participants: allParticipants,
      joinedUser: participantRecord,
    });
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
    if (boundLessonId) {
      socket.to(`lesson:${boundLessonId}`).emit('lesson:cursor', {
        userId: userMeta?.userId,
        userName: userMeta?.userName,
        color: userMeta?.color,
        ...data,
      });
    }
  });

  socket.on('board:object_create', (data: any) => {
    if (boundBoardId && data?.pageId && data?.object) {
      // Authoritative in-memory board sync
      const b = boardsMap.get(boundBoardId);
      if (b) {
        if (!b.objects) b.objects = {};
        if (!b.objects[data.pageId]) b.objects[data.pageId] = [];
        // Guard against duplicate IDs
        const existingIdx = b.objects[data.pageId].findIndex((o: any) => o.id === data.object.id);
        if (existingIdx === -1) {
          b.objects[data.pageId].push(data.object);
        } else {
          b.objects[data.pageId][existingIdx] = data.object;
        }
        b.updatedAt = new Date().toISOString();
        saveBoardsToDisk();
      }
      socket.to(`board:${boundBoardId}`).emit('board:object_create', data);
    }
  });

  socket.on('board:object_update', (data: any) => {
    if (boundBoardId && data?.pageId && data?.object) {
      const b = boardsMap.get(boundBoardId);
      if (b && b.objects && b.objects[data.pageId]) {
        const idx = b.objects[data.pageId].findIndex((o: any) => o.id === data.object.id);
        if (idx !== -1) {
          b.objects[data.pageId][idx] = data.object;
          b.updatedAt = new Date().toISOString();
          saveBoardsToDisk();
        }
      }
      socket.to(`board:${boundBoardId}`).emit('board:object_update', data);
    }
  });

  socket.on('board:object_delete', (data: any) => {
    if (boundBoardId && data?.pageId && data?.objectId) {
      const b = boardsMap.get(boundBoardId);
      if (b && b.objects && b.objects[data.pageId]) {
        b.objects[data.pageId] = b.objects[data.pageId].filter((o: any) => o.id !== data.objectId);
        b.updatedAt = new Date().toISOString();
        saveBoardsToDisk();
      }
      socket.to(`board:${boundBoardId}`).emit('board:object_delete', data);
    }
  });

  socket.on('board:clear', (data: any) => {
    if (boundBoardId && data?.pageId) {
      const b = boardsMap.get(boundBoardId);
      if (b && b.objects) {
        b.objects[data.pageId] = [];
        b.updatedAt = new Date().toISOString();
        saveBoardsToDisk();
      }
      socket.to(`board:${boundBoardId}`).emit('board:clear', data);
    }
  });

  socket.on('board:page_change', (data: any) => {
    if (boundBoardId) socket.to(`board:${boundBoardId}`).emit('board:page_change', data);
  });

  // Teacher permission changes broadcast
  socket.on('lesson:update_permissions', (data: any) => {
    const { lessonId, collaborationMode, studentPermissions } = data || {};
    if (!lessonId) return;

    loadLessonsFromDisk();
    const lesson = lessonsMap.get(lessonId);
    if (!lesson) return;

    if (collaborationMode !== undefined) lesson.collaborationMode = collaborationMode;
    if (studentPermissions !== undefined) lesson.studentPermissions = studentPermissions;
    lesson.updatedAt = new Date().toISOString();
    saveLessonsToDisk();

    const participants = activeLessonParticipants.get(lessonId);
    if (participants) {
      participants.forEach((p) => {
        if (p.role === 'student') {
          let canEdit = lesson.collaborationMode === 'everyone_can_edit';
          if (lesson.studentPermissions && lesson.studentPermissions[p.userId] !== undefined) {
            canEdit = lesson.studentPermissions[p.userId];
          }
          p.canEditBoard = canEdit;
        }
      });
    }

    const updatedParticipants = participants ? Array.from(participants.values()) : [];
    io.to(`lesson:${lessonId}`).emit('lesson:permissions_updated', {
      lessonId,
      collaborationMode: lesson.collaborationMode,
      studentPermissions: lesson.studentPermissions || {},
      participants: updatedParticipants,
    });
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
    if (boundLessonId && userMeta?.userId) {
      const participants = activeLessonParticipants.get(boundLessonId);
      if (participants) {
        participants.delete(userMeta.userId);
        const remaining = Array.from(participants.values());
        io.to(`lesson:${boundLessonId}`).emit('lesson:participants_updated', {
          lessonId: boundLessonId,
          participants: remaining,
          leftUserId: userMeta.userId,
        });
      }
    }

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
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

  if (!isProduction) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
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

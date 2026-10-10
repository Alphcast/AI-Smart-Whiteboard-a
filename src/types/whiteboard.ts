/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToolType =
  | 'select'
  | 'pan'
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'equation'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'sticky';

export type BackgroundPattern = 'blank' | 'grid' | 'dots' | 'lined';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface StrokeData {
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  tool: 'pen' | 'pencil' | 'highlighter';
}

export interface ShapeData {
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow';
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed';
  opacity: number;
}

export interface TextData {
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
}

export interface StickyData {
  text: string;
  color: string; // e.g. '#fef08a' (yellow), '#bae6fd' (blue), etc.
}

export interface MathSolutionStep {
  stepNumber: number;
  expression: string;
  latex: string;
  explanation: string;
}

export interface MathSolution {
  originalExpression: string;
  latex: string;
  solution: string;
  steps: MathSolutionStep[];
  difficultyLevel?: 'beginner' | 'student' | 'advanced';
  method?: string;
  alternativeMethods?: { method: string; steps: string[] }[];
  graphPoints?: { x: number; y: number }[];
}

export interface EquationData {
  rawExpression: string;
  latex: string;
  solution?: MathSolution;
  status: 'idle' | 'detected' | 'solving' | 'solved' | 'error';
  errorMessage?: string;
}

export interface WhiteboardObject {
  id: string;
  pageId: string;
  type: 'stroke' | 'shape' | 'text' | 'sticky' | 'equation';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
  strokeData?: StrokeData;
  shapeData?: ShapeData;
  textData?: TextData;
  stickyData?: StickyData;
  equationData?: EquationData;
}

export interface WhiteboardPage {
  id: string;
  title: string;
  order: number;
  background: BackgroundPattern;
  createdAt: string;
}

export interface Whiteboard {
  id: string;
  title: string;
  description?: string;
  pages: WhiteboardPage[];
  objects: Record<string, WhiteboardObject[]>; // keyed by pageId
  createdAt: string;
  updatedAt: string;
  isStarred?: boolean;
  isTrash?: boolean;
  thumbnail?: string;
  tags?: string[];
  permission?: 'owner' | 'editor' | 'viewer';
}

export interface RemoteSession {
  sessionId: string;
  boardId: string;
  passcode: string;
  connectedDevices: number;
  lastActive: string;
  status: 'waiting' | 'connected' | 'disconnected';
  deviceInfo?: string;
}

export interface CollaboratorCursor {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  lastUpdated: number;
}

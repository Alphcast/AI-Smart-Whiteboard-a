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
  | 'sticky'
  | 'laser';

export type BackgroundPattern = 'blank' | 'grid' | 'dots' | 'lined';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export interface StrokeData {
  points: Point[];
  color: string;
  size: number;
  strokeWidth?: number;
  tool?: 'pen' | 'pencil' | 'highlighter' | 'eraser';
  opacity: number;
}

export interface TextData {
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ShapeData {
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow';
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle?: 'solid' | 'dashed';
  opacity: number;
}

export interface StickyData {
  text: string;
  color: string;
}

export interface MathSolutionStep {
  stepNumber: number;
  expression: string;
  latex?: string;
  explanation: string;
}

export interface MathSolution {
  originalExpression: string;
  latex: string;
  solution: string;
  steps: MathSolutionStep[];
  method: string;
  alternativeMethods?: {
    method: string;
    steps: string[];
  }[];
}

export interface EquationData {
  rawExpression: string;
  latex: string;
  solution?: MathSolution;
  status?: 'idle' | 'unsolved' | 'solving' | 'solved' | 'error';
  error?: string;
  errorMessage?: string;
}

export interface WhiteboardObject {
  id: string;
  pageId: string;
  type: 'stroke' | 'text' | 'shape' | 'sticky' | 'equation';
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
  strokeData?: StrokeData;
  textData?: TextData;
  shapeData?: ShapeData;
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

export interface CollaboratorCursor {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
}

export interface Whiteboard {
  id: string;
  title: string;
  description?: string;
  pages: WhiteboardPage[];
  objects: Record<string, WhiteboardObject[]>;
  createdAt: string;
  updatedAt: string;
  isStarred?: boolean;
  isTrash?: boolean;
  tags?: string[];
  permission?: 'owner' | 'editor' | 'viewer';
}

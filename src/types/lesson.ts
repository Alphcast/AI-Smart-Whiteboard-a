/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LessonStatus = 'scheduled' | 'active' | 'completed';

export type CollaborationMode =
  | 'everyone_can_edit'
  | 'teacher_only'
  | 'students_view_only';

export type ParticipantRole = 'teacher' | 'student';

export interface LessonParticipant {
  userId: string;
  userName: string;
  role: ParticipantRole;
  canEditBoard: boolean;
  joinedAt: string;
  lastSeenAt: string;
  color: string;
  cursor?: { x: number; y: number };
}

export interface Lesson {
  id: string;
  boardId: string;
  subject: string;
  topic: string;
  description?: string;
  learningObjectives?: string[];
  lessonDate: string; // YYYY-MM-DD local calendar date
  scheduledAt: string; // ISO UTC timestamp
  status: LessonStatus;
  teacherId: string;
  teacherName: string;
  collaborationMode: CollaborationMode;
  studentPermissions?: Record<string, boolean>; // userId -> canEdit
  createdAt: string;
  updatedAt: string;
  summary?: string;
  revisionQuestions?: string[];
}

export interface StudentNote {
  id: string;
  lessonId: string;
  studentId: string;
  studentName: string;
  subject: string;
  topic: string;
  lessonDate: string;
  title: string;
  content: string; // markdown / structured text
  keyTakeaways?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectItem {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

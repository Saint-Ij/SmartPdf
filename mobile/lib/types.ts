export interface User {
  id: string;
  email: string;
  name: string;
  timezone?: string;
}

export interface Section {
  id: string;
  documentId: string;
  title: string;
  order: number;
  startPage: number;
  endPage: number;
  startChunkIndex: number;
  endChunkIndex: number;
  estimatedReadingMinutes: number;
  isLocked: boolean;
}

export interface Document {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  documentType: "text" | "scanned" | "mixed";
  processingStatus: "uploading" | "processing" | "ready" | "failed";
  uploadedAt: string;
  processedAt: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  documentId: string;
  title: string;
  documentTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sourceChunkIds: string[];
  tokenUsage: { prompt: number; completion: number; total: number };
  createdAt: string;
}

export interface Quiz {
  id: string;
  documentId: string;
  sectionId: string | null;
  documentTitle?: string;
  sectionTitle?: string;
  status: "not_started" | "in_progress" | "passed" | "failed";
  totalQuestions: number;
  passingScore: number;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  order: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
}

export interface Flashcard {
  id: string;
  documentId: string;
  sectionId: string | null;
  front: string;
  back: string;
  difficulty: number;
  sectionTitle?: string;
  createdAt: string;
}

export interface Summary {
  id: string;
  documentId: string;
  sectionId: string | null;
  content: string;
  version: number;
  createdAt: string;
}

export interface LearningProgress {
  id: string;
  userId: string;
  documentId: string;
  sectionId: string;
  lastPageRead: number;
  completionPercentage: number;
  quizPassed: boolean;
  totalStudyMinutes: number;
  lastStudiedAt: string | null;
}

export interface Reminder {
  id: string;
  userId: string;
  documentId: string | null;
  scheduledFor: string;
  status: "pending" | "sent" | "dismissed";
  createdAt: string;
}

import { relations } from "drizzle-orm";
import {
  chunks,
  conversations,
  documents,
  flashcards,
  images,
  learningProgress,
  messages,
  pages,
  quizAttempts,
  quizQuestions,
  quizzes,
  reminders,
  sections,
  summaries,
  users,
} from "./schema.js";

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  conversations: many(conversations),
  quizAttempts: many(quizAttempts),
  learningProgress: many(learningProgress),
  reminders: many(reminders),
}));

// ─── Documents ───────────────────────────────────────────────────────────────

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  pages: many(pages),
  sections: many(sections),
  chunks: many(chunks),
  images: many(images),
  conversations: many(conversations),
  quizzes: many(quizzes),
  summaries: many(summaries),
  flashcards: many(flashcards),
  learningProgress: many(learningProgress),
  reminders: many(reminders),
}));

// ─── Pages ───────────────────────────────────────────────────────────────────

export const pagesRelations = relations(pages, ({ one, many }) => ({
  document: one(documents, {
    fields: [pages.documentId],
    references: [documents.id],
  }),
  startChunks: many(chunks, { relationName: "startPage" }),
  endChunks: many(chunks, { relationName: "endPage" }),
  images: many(images),
}));

// ─── Sections ────────────────────────────────────────────────────────────────

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  document: one(documents, {
    fields: [sections.documentId],
    references: [documents.id],
  }),
  chunks: many(chunks),
  quizzes: many(quizzes),
  summaries: many(summaries),
  flashcards: many(flashcards),
  learningProgress: many(learningProgress),
}));

// ─── Chunks ──────────────────────────────────────────────────────────────────

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
  section: one(sections, {
    fields: [chunks.sectionId],
    references: [sections.id],
  }),
  startPage: one(pages, {
    fields: [chunks.startPageId],
    references: [pages.id],
    relationName: "startPage",
  }),
  endPage: one(pages, {
    fields: [chunks.endPageId],
    references: [pages.id],
    relationName: "endPage",
  }),
}));

// ─── Images ──────────────────────────────────────────────────────────────────

export const imagesRelations = relations(images, ({ one }) => ({
  document: one(documents, {
    fields: [images.documentId],
    references: [documents.id],
  }),
  page: one(pages, {
    fields: [images.pageId],
    references: [pages.id],
  }),
}));

// ─── Conversations ───────────────────────────────────────────────────────────

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [conversations.documentId],
    references: [documents.id],
  }),
  messages: many(messages),
}));

// ─── Messages ────────────────────────────────────────────────────────────────

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// ─── Quizzes ─────────────────────────────────────────────────────────────────

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  document: one(documents, {
    fields: [quizzes.documentId],
    references: [documents.id],
  }),
  section: one(sections, {
    fields: [quizzes.sectionId],
    references: [sections.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

// ─── Quiz Questions ──────────────────────────────────────────────────────────

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
}));

// ─── Quiz Attempts ───────────────────────────────────────────────────────────

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
}));

// ─── Summaries ───────────────────────────────────────────────────────────────

export const summariesRelations = relations(summaries, ({ one }) => ({
  document: one(documents, {
    fields: [summaries.documentId],
    references: [documents.id],
  }),
  section: one(sections, {
    fields: [summaries.sectionId],
    references: [sections.id],
  }),
}));

// ─── Flashcards ──────────────────────────────────────────────────────────────

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  document: one(documents, {
    fields: [flashcards.documentId],
    references: [documents.id],
  }),
  section: one(sections, {
    fields: [flashcards.sectionId],
    references: [sections.id],
  }),
}));

// ─── Learning Progress ───────────────────────────────────────────────────────

export const learningProgressRelations = relations(learningProgress, ({ one }) => ({
  user: one(users, {
    fields: [learningProgress.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [learningProgress.documentId],
    references: [documents.id],
  }),
  section: one(sections, {
    fields: [learningProgress.sectionId],
    references: [sections.id],
  }),
}));

// ─── Reminders ───────────────────────────────────────────────────────────────

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, {
    fields: [reminders.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [reminders.documentId],
    references: [documents.id],
  }),
}));

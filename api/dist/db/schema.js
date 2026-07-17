import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar, vector, } from "drizzle-orm/pg-core";
// ─── Enums ───────────────────────────────────────────────────────────────────
export const documentType = pgEnum("document_type", ["text", "scanned", "mixed"]);
export const documentStatus = pgEnum("document_status", ["uploading", "processing", "ready", "failed"]);
export const messageRole = pgEnum("message_role", ["user", "assistant", "system"]);
export const quizStatus = pgEnum("quiz_status", ["not_started", "in_progress", "passed", "failed"]);
export const reminderStatus = pgEnum("reminder_status", ["pending", "sent", "dismissed"]);
// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("users_email_idx").on(table.email),
]);
// ─── Documents ───────────────────────────────────────────────────────────────
export const documents = pgTable("documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    originalFilename: varchar("original_filename", { length: 512 }).notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSize: integer("file_size").notNull(),
    pageCount: integer("page_count").notNull().default(0),
    language: varchar("language", { length: 16 }).notNull().default("en"),
    documentType: documentType("document_type").notNull().default("text"),
    processingStatus: documentStatus("processing_status").notNull().default("uploading"),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("documents_user_id_idx").on(table.userId),
    index("documents_processing_status_idx").on(table.processingStatus),
]);
// ─── Pages ───────────────────────────────────────────────────────────────────
export const pages = pgTable("pages", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    extractedText: text("extracted_text").notNull().default(""),
    characterCount: integer("character_count").notNull().default(0),
    imagePath: text("image_path"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    unique().on(table.documentId, table.pageNumber),
    index("pages_document_id_idx").on(table.documentId),
    index("pages_page_number_idx").on(table.pageNumber),
]);
// ─── Sections ────────────────────────────────────────────────────────────────
export const sections = pgTable("sections", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    order: integer("order").notNull(),
    startPage: integer("start_page").notNull(),
    endPage: integer("end_page").notNull(),
    startChunkIndex: integer("start_chunk_index").notNull(),
    endChunkIndex: integer("end_chunk_index").notNull(),
    estimatedReadingMinutes: integer("estimated_reading_minutes").notNull().default(0),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("sections_document_id_idx").on(table.documentId),
    index("sections_order_idx").on(table.order),
]);
// ─── Chunks ──────────────────────────────────────────────────────────────────
export const chunks = pgTable("chunks", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
    startPageId: uuid("start_page_id")
        .notNull()
        .references(() => pages.id, { onDelete: "cascade" }),
    endPageId: uuid("end_page_id")
        .notNull()
        .references(() => pages.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("chunks_document_id_idx").on(table.documentId),
    index("chunks_section_id_idx").on(table.sectionId),
    index("chunks_chunk_index_idx").on(table.chunkIndex),
    index("chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);
// ─── Images ──────────────────────────────────────────────────────────────────
export const images = pgTable("images", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
        .notNull()
        .references(() => pages.id, { onDelete: "cascade" }),
    caption: text("caption").notNull().default(""),
    imagePath: text("image_path").notNull(),
    imageEmbedding: vector("image_embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("images_document_id_idx").on(table.documentId),
    index("images_page_id_idx").on(table.pageId),
]);
// ─── Conversations ───────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull().default("New Conversation"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("conversations_user_id_idx").on(table.userId),
    index("conversations_document_id_idx").on(table.documentId),
]);
// ─── Messages ────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    sourceChunkIds: jsonb("source_chunk_ids").$type().default([]).notNull(),
    tokenUsage: jsonb("token_usage")
        .$type()
        .default({ prompt: 0, completion: 0, total: 0 })
        .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_role_idx").on(table.role),
]);
// ─── Quizzes ─────────────────────────────────────────────────────────────────
export const quizzes = pgTable("quizzes", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
    status: quizStatus("status").notNull().default("not_started"),
    totalQuestions: integer("total_questions").notNull().default(0),
    passingScore: integer("passing_score").notNull().default(70),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("quizzes_document_id_idx").on(table.documentId),
    index("quizzes_section_id_idx").on(table.sectionId),
]);
// ─── Quiz Questions ──────────────────────────────────────────────────────────
export const quizQuestions = pgTable("quiz_questions", {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
        .notNull()
        .references(() => quizzes.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: jsonb("options").$type().notNull(),
    correctAnswer: text("correct_answer").notNull(),
    explanation: text("explanation").notNull().default(""),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("quiz_questions_quiz_id_idx").on(table.quizId),
]);
// ─── Quiz Attempts ───────────────────────────────────────────────────────────
export const quizAttempts = pgTable("quiz_attempts", {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
        .notNull()
        .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    passed: boolean("passed").notNull().default(false),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
}, (table) => [
    index("quiz_attempts_quiz_id_idx").on(table.quizId),
    index("quiz_attempts_user_id_idx").on(table.userId),
]);
// ─── Summaries ───────────────────────────────────────────────────────────────
export const summaries = pgTable("summaries", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("summaries_section_id_idx").on(table.sectionId),
]);
// ─── Flashcards ──────────────────────────────────────────────────────────────
export const flashcards = pgTable("flashcards", {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    difficulty: integer("difficulty").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("flashcards_section_id_idx").on(table.sectionId),
]);
// ─── Learning Progress ───────────────────────────────────────────────────────
export const learningProgress = pgTable("learning_progress", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
        .notNull()
        .references(() => sections.id, { onDelete: "cascade" }),
    lastPageRead: integer("last_page_read").notNull().default(0),
    completionPercentage: integer("completion_percentage").notNull().default(0),
    quizPassed: boolean("quiz_passed").notNull().default(false),
    totalStudyMinutes: integer("total_study_minutes").notNull().default(0),
    lastStudiedAt: timestamp("last_studied_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    unique().on(table.userId, table.documentId, table.sectionId),
    index("learning_progress_user_id_idx").on(table.userId),
    index("learning_progress_document_id_idx").on(table.documentId),
]);
// ─── Reminders ───────────────────────────────────────────────────────────────
export const reminders = pgTable("reminders", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    scheduledFor: timestamp("scheduled_for", { mode: "date", withTimezone: true }).notNull(),
    status: reminderStatus("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("reminders_user_id_idx").on(table.userId),
    index("reminders_scheduled_for_idx").on(table.scheduledFor),
]);
//# sourceMappingURL=schema.js.map
export declare const usersRelations: import("drizzle-orm").Relations<"users", {
    documents: import("drizzle-orm").Many<"documents">;
    conversations: import("drizzle-orm").Many<"conversations">;
    quizAttempts: import("drizzle-orm").Many<"quiz_attempts">;
    learningProgress: import("drizzle-orm").Many<"learning_progress">;
    reminders: import("drizzle-orm").Many<"reminders">;
}>;
export declare const documentsRelations: import("drizzle-orm").Relations<"documents", {
    user: import("drizzle-orm").One<"users", true>;
    pages: import("drizzle-orm").Many<"pages">;
    sections: import("drizzle-orm").Many<"sections">;
    chunks: import("drizzle-orm").Many<"chunks">;
    images: import("drizzle-orm").Many<"images">;
    conversations: import("drizzle-orm").Many<"conversations">;
    quizzes: import("drizzle-orm").Many<"quizzes">;
    summaries: import("drizzle-orm").Many<"summaries">;
    flashcards: import("drizzle-orm").Many<"flashcards">;
    learningProgress: import("drizzle-orm").Many<"learning_progress">;
    reminders: import("drizzle-orm").Many<"reminders">;
}>;
export declare const pagesRelations: import("drizzle-orm").Relations<"pages", {
    document: import("drizzle-orm").One<"documents", true>;
    startChunks: import("drizzle-orm").Many<"chunks">;
    endChunks: import("drizzle-orm").Many<"chunks">;
    images: import("drizzle-orm").Many<"images">;
}>;
export declare const sectionsRelations: import("drizzle-orm").Relations<"sections", {
    document: import("drizzle-orm").One<"documents", true>;
    chunks: import("drizzle-orm").Many<"chunks">;
    quizzes: import("drizzle-orm").Many<"quizzes">;
    summaries: import("drizzle-orm").Many<"summaries">;
    flashcards: import("drizzle-orm").Many<"flashcards">;
    learningProgress: import("drizzle-orm").Many<"learning_progress">;
}>;
export declare const chunksRelations: import("drizzle-orm").Relations<"chunks", {
    document: import("drizzle-orm").One<"documents", true>;
    section: import("drizzle-orm").One<"sections", false>;
    startPage: import("drizzle-orm").One<"pages", true>;
    endPage: import("drizzle-orm").One<"pages", true>;
}>;
export declare const imagesRelations: import("drizzle-orm").Relations<"images", {
    document: import("drizzle-orm").One<"documents", true>;
    page: import("drizzle-orm").One<"pages", true>;
}>;
export declare const conversationsRelations: import("drizzle-orm").Relations<"conversations", {
    user: import("drizzle-orm").One<"users", true>;
    document: import("drizzle-orm").One<"documents", true>;
    messages: import("drizzle-orm").Many<"messages">;
}>;
export declare const messagesRelations: import("drizzle-orm").Relations<"messages", {
    conversation: import("drizzle-orm").One<"conversations", true>;
}>;
export declare const quizzesRelations: import("drizzle-orm").Relations<"quizzes", {
    document: import("drizzle-orm").One<"documents", true>;
    section: import("drizzle-orm").One<"sections", false>;
    questions: import("drizzle-orm").Many<"quiz_questions">;
    attempts: import("drizzle-orm").Many<"quiz_attempts">;
}>;
export declare const quizQuestionsRelations: import("drizzle-orm").Relations<"quiz_questions", {
    quiz: import("drizzle-orm").One<"quizzes", true>;
}>;
export declare const quizAttemptsRelations: import("drizzle-orm").Relations<"quiz_attempts", {
    quiz: import("drizzle-orm").One<"quizzes", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const summariesRelations: import("drizzle-orm").Relations<"summaries", {
    document: import("drizzle-orm").One<"documents", true>;
    section: import("drizzle-orm").One<"sections", false>;
}>;
export declare const flashcardsRelations: import("drizzle-orm").Relations<"flashcards", {
    document: import("drizzle-orm").One<"documents", true>;
    section: import("drizzle-orm").One<"sections", false>;
}>;
export declare const learningProgressRelations: import("drizzle-orm").Relations<"learning_progress", {
    user: import("drizzle-orm").One<"users", true>;
    document: import("drizzle-orm").One<"documents", true>;
    section: import("drizzle-orm").One<"sections", true>;
}>;
export declare const remindersRelations: import("drizzle-orm").Relations<"reminders", {
    user: import("drizzle-orm").One<"users", true>;
    document: import("drizzle-orm").One<"documents", false>;
}>;
//# sourceMappingURL=relations.d.ts.map
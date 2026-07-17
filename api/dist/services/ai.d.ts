export declare function generateEmbedding(text: string): Promise<number[]>;
export declare function chatWithDocument(conversationId: string, userMessage: string, documentId: string): Promise<{
    content: string;
    sourceChunkIds: string[];
    tokenUsage: {
        prompt: number;
        completion: number;
        total: number;
    };
}>;
export declare function generateQuizFromDocument(documentId: string, totalQuestions?: number): Promise<{
    questions: {
        question: string;
        options: string[];
        correctAnswer: string;
        explanation: string;
    }[];
}>;
export declare function generateFlashcardsFromDocument(documentId: string, count?: number): Promise<{
    flashcards: {
        front: string;
        back: string;
    }[];
}>;
export declare function summarizeDocument(documentId: string, sectionId?: string): Promise<string>;
//# sourceMappingURL=ai.d.ts.map
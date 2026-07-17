import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { logger } from "../config/logger.js";
const AI_ENDPOINT = process.env.AI_ENDPOINT || "https://api.groq.com/openai/v1";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "llama-3.1-70b-versatile";
const AI_EMBEDDING_ENDPOINT = process.env.AI_EMBEDDING_ENDPOINT || "https://api.jina.ai/v1";
const AI_EMBEDDING_API_KEY = process.env.AI_EMBEDDING_API_KEY || "";
const AI_EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || "jina-embeddings-v4";
export async function generateEmbedding(text) {
    const res = await fetch(`${AI_EMBEDDING_ENDPOINT}/embeddings`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${AI_EMBEDDING_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: AI_EMBEDDING_MODEL,
            input: text,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    return data.data[0].embedding;
}
async function callLLM(messages) {
    const res = await fetch(`${AI_ENDPOINT}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${AI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages,
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    return {
        content: data.choices[0]?.message?.content || "",
        tokenUsage: {
            prompt: data.usage?.prompt_tokens || 0,
            completion: data.usage?.completion_tokens || 0,
            total: data.usage?.total_tokens || 0,
        },
    };
}
export async function chatWithDocument(conversationId, userMessage, documentId) {
    const userEmbedding = await generateEmbedding(userMessage);
    const vectorStr = `[${userEmbedding.join(",")}]`;
    const similarChunks = await db.execute(sql `
    SELECT id, content, chunk_index
    FROM chunks
    WHERE document_id = ${documentId}::uuid
    ORDER BY embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}
    LIMIT 6
  `);
    const contextText = similarChunks.map((c) => c.content).join("\n\n---\n\n");
    const sourceIds = similarChunks.map((c) => c.id);
    const recentMessages = await db.execute(sql `
    SELECT role, content FROM messages WHERE conversation_id = ${conversationId}::uuid ORDER BY created_at LIMIT 10
  `);
    const systemPrompt = `You are a helpful study assistant. Answer the user's question based on the provided document context. If the context doesn't contain enough information, say so clearly. Be concise and accurate.

Document Context:
${contextText || "No relevant context found."}`;
    const llmMessages = [
        { role: "system", content: systemPrompt },
        ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage },
    ];
    const response = await callLLM(llmMessages);
    return {
        content: response.content,
        sourceChunkIds: sourceIds,
        tokenUsage: response.tokenUsage,
    };
}
export async function generateQuizFromDocument(documentId, totalQuestions = 5) {
    const docChunks = await db.execute(sql `
    SELECT content FROM chunks WHERE document_id = ${documentId}::uuid LIMIT 20
  `);
    const contextText = docChunks.map((c) => c.content).join("\n\n").slice(0, 8000);
    const prompt = `Based on the following document content, generate ${totalQuestions} multiple-choice questions. Each question should have 4 options and one correct answer.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
[
  {
    "question": "Question text?",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correctAnswer": "A",
    "explanation": "Why this answer is correct"
  }
]

Document content:
${contextText}`;
    const response = await callLLM([
        { role: "system", content: "You are a quiz generator. Output only valid JSON." },
        { role: "user", content: prompt },
    ]);
    let questions;
    try {
        const cleaned = response.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        questions = JSON.parse(cleaned);
    }
    catch {
        logger.error("Failed to parse quiz JSON from LLM: " + response.content);
        questions = [
            {
                question: "Failed to generate quiz. Please try again.",
                options: ["A. OK", "B. Try again", "C. Cancel", "D. Help"],
                correctAnswer: "A",
                explanation: "The AI failed to generate proper quiz questions.",
            },
        ];
    }
    return { questions };
}
export async function generateFlashcardsFromDocument(documentId, count = 5) {
    const docChunks = await db.execute(sql `
    SELECT content FROM chunks WHERE document_id = ${documentId}::uuid LIMIT 20
  `);
    const contextText = docChunks.map((c) => c.content).join("\n\n").slice(0, 8000);
    const prompt = `Based on the following document content, generate ${count} flashcards. Each flashcard has a "front" (question/term) and "back" (answer/definition).

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
[
  { "front": "Term or question", "back": "Definition or answer" }
]

Document content:
${contextText}`;
    const response = await callLLM([
        { role: "system", content: "You are a flashcard generator. Output only valid JSON." },
        { role: "user", content: prompt },
    ]);
    let flashcards;
    try {
        const cleaned = response.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        flashcards = JSON.parse(cleaned);
    }
    catch {
        logger.error("Failed to parse flashcard JSON from LLM: " + response.content);
        flashcards = [{ front: "Generation failed", back: "Please try again." }];
    }
    return { flashcards };
}
export async function summarizeDocument(documentId, sectionId) {
    const query = sectionId
        ? sql `SELECT content FROM chunks WHERE document_id = ${documentId}::uuid AND section_id = ${sectionId}::uuid LIMIT 30`
        : sql `SELECT content FROM chunks WHERE document_id = ${documentId}::uuid LIMIT 30`;
    const docChunks = await db.execute(query);
    const contextText = docChunks.map((c) => c.content).join("\n\n").slice(0, 10000);
    const prompt = `Provide a comprehensive summary of the following document content. Include the main topics, key points, and important details.

Document content:
${contextText}`;
    const response = await callLLM([
        { role: "system", content: "You are a summarization assistant. Create clear, concise summaries." },
        { role: "user", content: prompt },
    ]);
    return response.content;
}
//# sourceMappingURL=ai.js.map
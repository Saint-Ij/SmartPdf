import { Router } from "express";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { generateQuizFromDocument } from "../services/ai.js";
import { AppError } from "../middleware/error.js";
const router = Router();
router.get("/all", authenticate, async (req, res) => {
    const qs = await db.execute(sql `
    SELECT q.* FROM quizzes q
    JOIN documents d ON d.id = q.document_id
    WHERE d.user_id = ${req.userId}::uuid
    ORDER BY q.created_at
  `);
    res.json({ quizzes: qs });
});
router.post("/generate", authenticate, async (req, res) => {
    const schema = z.object({
        documentId: z.string().uuid(),
        totalQuestions: z.number().int().min(1).max(20).default(5),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const docs = await db.execute(sql `
    SELECT * FROM documents WHERE id = ${parsed.data.documentId}::uuid AND user_id = ${req.userId} LIMIT 1
  `);
    if (!docs[0])
        throw new AppError(404, "Document not found");
    const { questions } = await generateQuizFromDocument(parsed.data.documentId, parsed.data.totalQuestions);
    const quizzes = await db.execute(sql `
    INSERT INTO quizzes (document_id, total_questions, status)
    VALUES (${parsed.data.documentId}::uuid, ${questions.length}, 'not_started')
    RETURNING *
  `);
    const quiz = quizzes[0];
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.execute(sql `
      INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, explanation, "order")
      VALUES (${quiz.id}::uuid, ${q.question}, ${JSON.stringify(q.options)}, ${q.correctAnswer}, ${q.explanation}, ${i + 1})
    `);
    }
    res.status(201).json({ quiz });
});
router.get("/:id", authenticate, async (req, res) => {
    const quizzes = await db.execute(sql `
    SELECT q.* FROM quizzes q
    JOIN documents d ON d.id = q.document_id
    WHERE q.id = ${req.params.id}::uuid AND d.user_id = ${req.userId} LIMIT 1
  `);
    if (!quizzes[0])
        throw new AppError(404, "Quiz not found");
    res.json({ quiz: quizzes[0] });
});
router.get("/:id/questions", authenticate, async (req, res) => {
    const quizzes = await db.execute(sql `
    SELECT q.* FROM quizzes q
    JOIN documents d ON d.id = q.document_id
    WHERE q.id = ${req.params.id}::uuid AND d.user_id = ${req.userId} LIMIT 1
  `);
    if (!quizzes[0])
        throw new AppError(404, "Quiz not found");
    const questions = await db.execute(sql `
    SELECT id, quiz_id, question, options, "order"
    FROM quiz_questions WHERE quiz_id = ${req.params.id}::uuid ORDER BY "order"
  `);
    res.json({ questions });
});
router.post("/:id/submit", authenticate, async (req, res) => {
    const schema = z.object({ answers: z.record(z.string(), z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const quizzes = await db.execute(sql `
    SELECT * FROM quizzes WHERE id = ${req.params.id}::uuid LIMIT 1
  `);
    const quiz = quizzes[0];
    if (!quiz)
        throw new AppError(404, "Quiz not found");
    const allQuestions = await db.execute(sql `
    SELECT * FROM quiz_questions WHERE quiz_id = ${req.params.id}::uuid ORDER BY "order"
  `);
    let correct = 0;
    for (const q of allQuestions) {
        const userAnswer = parsed.data.answers[q.id];
        if (userAnswer && userAnswer.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()) {
            correct++;
        }
    }
    const total = allQuestions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= quiz.passing_score;
    const attempts = await db.execute(sql `
    INSERT INTO quiz_attempts (quiz_id, user_id, score, passed, completed_at)
    VALUES (${req.params.id}::uuid, ${req.userId}::uuid, ${score}, ${passed}, NOW())
    RETURNING *
  `);
    await db.execute(sql `
    UPDATE quizzes SET status = ${passed ? "passed" : "failed"} WHERE id = ${req.params.id}::uuid
  `);
    res.json({ attempt: attempts[0], score, passed, correct, total });
});
router.get("/:id/answers", authenticate, async (req, res) => {
    const questions = await db.execute(sql `
    SELECT * FROM quiz_questions WHERE quiz_id = ${req.params.id}::uuid ORDER BY "order"
  `);
    res.json({ questions });
});
export default router;
//# sourceMappingURL=quiz.js.map
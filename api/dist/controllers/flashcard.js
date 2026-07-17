import { Router } from "express";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { generateFlashcardsFromDocument } from "../services/ai.js";
import { AppError } from "../middleware/error.js";
const router = Router();
router.post("/generate", authenticate, async (req, res) => {
    const schema = z.object({
        documentId: z.string().uuid(),
        count: z.number().int().min(1).max(50).default(5),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const docs = await db.execute(sql `
    SELECT * FROM documents WHERE id = ${parsed.data.documentId}::uuid AND user_id = ${req.userId} LIMIT 1
  `);
    if (!docs[0])
        throw new AppError(404, "Document not found");
    const result = await generateFlashcardsFromDocument(parsed.data.documentId, parsed.data.count);
    const created = [];
    for (const fc of result.flashcards) {
        const cards = await db.execute(sql `
      INSERT INTO flashcards (document_id, front, back)
      VALUES (${parsed.data.documentId}::uuid, ${fc.front}, ${fc.back})
      RETURNING id, front, back
    `);
        created.push(cards[0]);
    }
    res.status(201).json({ flashcards: created });
});
router.get("/:id", authenticate, async (req, res) => {
    const cards = await db.execute(sql `
    SELECT * FROM flashcards WHERE id = ${req.params.id}::uuid LIMIT 1
  `);
    if (!cards[0])
        throw new AppError(404, "Flashcard not found");
    res.json({ flashcard: cards[0] });
});
router.get("/document/:docId", authenticate, async (req, res) => {
    const cards = await db.execute(sql `
    SELECT * FROM flashcards WHERE document_id = ${req.params.docId}::uuid ORDER BY created_at
  `);
    res.json({ flashcards: cards });
});
router.patch("/:id/difficulty", authenticate, async (req, res) => {
    const schema = z.object({ difficulty: z.number().int().min(1).max(3) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const cards = await db.execute(sql `
    UPDATE flashcards SET difficulty = ${parsed.data.difficulty}
    WHERE id = ${req.params.id}::uuid RETURNING *
  `);
    if (!cards[0])
        throw new AppError(404, "Flashcard not found");
    res.json({ success: true });
});
export default router;
//# sourceMappingURL=flashcard.js.map
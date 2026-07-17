import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { summarizeDocument } from "../services/ai.js";
import { AppError } from "../middleware/error.js";
const router = Router();
router.get("/document/:docId", authenticate, async (req, res) => {
    const docs = await db.execute(sql `
    SELECT * FROM documents WHERE id = ${req.params.docId}::uuid AND user_id = ${req.userId} LIMIT 1
  `);
    if (!docs[0])
        throw new AppError(404, "Document not found");
    const existing = await db.execute(sql `
    SELECT * FROM summaries WHERE document_id = ${req.params.docId}::uuid ORDER BY created_at
  `);
    if (existing.length > 0) {
        res.json({ summaries: existing });
        return;
    }
    const content = await summarizeDocument(req.params.docId);
    const summaries = await db.execute(sql `
    INSERT INTO summaries (document_id, content)
    VALUES (${req.params.docId}::uuid, ${content})
    RETURNING *
  `);
    res.json({ summaries: [summaries[0]] });
});
export default router;
//# sourceMappingURL=summary.js.map
import { Router } from "express";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { chatWithDocument } from "../services/ai.js";
import { AppError } from "../middleware/error.js";
const router = Router();
router.get("/", authenticate, async (req, res) => {
    const convs = await db.execute(sql `
    SELECT * FROM conversations WHERE user_id = ${req.userId} ORDER BY updated_at DESC
  `);
    res.json({ conversations: convs });
});
router.post("/", authenticate, async (req, res) => {
    const schema = z.object({
        documentId: z.string().uuid(),
        title: z.string().max(512).default("New Conversation"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const convs = await db.execute(sql `
    INSERT INTO conversations (user_id, document_id, title)
    VALUES (${req.userId}::uuid, ${parsed.data.documentId}::uuid, ${parsed.data.title})
    RETURNING id
  `);
    res.status(201).json({ conversation: convs[0] });
});
router.get("/:id/messages", authenticate, async (req, res) => {
    const convs = await db.execute(sql `
    SELECT * FROM conversations WHERE id = ${req.params.id}::uuid AND user_id = ${req.userId} LIMIT 1
  `);
    if (!convs[0])
        throw new AppError(404, "Conversation not found");
    const msgs = await db.execute(sql `
    SELECT * FROM messages WHERE conversation_id = ${req.params.id}::uuid ORDER BY created_at
  `);
    res.json({ messages: msgs });
});
router.post("/:id/chat", authenticate, async (req, res) => {
    const schema = z.object({ content: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const convs = await db.execute(sql `
    SELECT * FROM conversations WHERE id = ${req.params.id}::uuid AND user_id = ${req.userId} LIMIT 1
  `);
    const conv = convs[0];
    if (!conv)
        throw new AppError(404, "Conversation not found");
    const userMsgs = await db.execute(sql `
    INSERT INTO messages (conversation_id, role, content)
    VALUES (${req.params.id}::uuid, 'user', ${parsed.data.content})
    RETURNING *
  `);
    const result = await chatWithDocument(req.params.id, parsed.data.content, conv.document_id);
    const assistantMsgs = await db.execute(sql `
    INSERT INTO messages (conversation_id, role, content, source_chunk_ids, token_usage)
    VALUES (${req.params.id}::uuid, 'assistant', ${result.content}, ${JSON.stringify(result.sourceChunkIds)}, ${JSON.stringify(result.tokenUsage)})
    RETURNING *
  `);
    await db.execute(sql `
    UPDATE conversations SET updated_at = NOW() WHERE id = ${req.params.id}::uuid
  `);
    res.json({ message: assistantMsgs[0] });
});
router.delete("/:id", authenticate, async (req, res) => {
    const convs = await db.execute(sql `
    DELETE FROM conversations WHERE id = ${req.params.id}::uuid AND user_id = ${req.userId} RETURNING *
  `);
    if (!convs[0])
        throw new AppError(404, "Conversation not found");
    res.json({ success: true });
});
export default router;
//# sourceMappingURL=conversation.js.map
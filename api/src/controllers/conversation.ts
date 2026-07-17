import { Router, type Response } from "express";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { chatWithDocument } from "../services/ai.js";
import { AppError } from "../middleware/error.js";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const convs = await db.execute(sql`
    SELECT c.*, d.title as document_title FROM conversations c
    JOIN documents d ON d.id = c.document_id
    WHERE c.user_id = ${req.userId!}
    ORDER BY c.updated_at DESC
  `);
  res.json({ conversations: convs });
});

router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    documentId: z.string().uuid(),
    title: z.string().max(512).default("New Conversation"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "Invalid request");

  const convs = await db.execute(sql`
    INSERT INTO conversations (user_id, document_id, title)
    VALUES (${req.userId!}::uuid, ${parsed.data.documentId}::uuid, ${parsed.data.title})
    RETURNING id
  `);

  res.status(201).json({ conversation: convs[0] });
});

router.get("/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  const convs: any[] = await db.execute(sql`
    SELECT * FROM conversations WHERE id = ${req.params.id as string}::uuid AND user_id = ${req.userId!} LIMIT 1
  `);
  if (!convs[0]) throw new AppError(404, "Conversation not found");

  const msgs = await db.execute(sql`
    SELECT * FROM messages WHERE conversation_id = ${req.params.id as string}::uuid ORDER BY created_at
  `);
  res.json({ messages: msgs });
});

router.post("/:id/chat", authenticate, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ content: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "Invalid request");

  const convs: any[] = await db.execute(sql`
    SELECT * FROM conversations WHERE id = ${req.params.id as string}::uuid AND user_id = ${req.userId!} LIMIT 1
  `);
  const conv = convs[0];
  if (!conv) throw new AppError(404, "Conversation not found");

  const userMsgs = await db.execute(sql`
    INSERT INTO messages (conversation_id, role, content)
    VALUES (${req.params.id as string}::uuid, 'user', ${parsed.data.content})
    RETURNING *
  `);

  let result;
  try {
    result = await chatWithDocument(req.params.id as string, parsed.data.content, conv.document_id);
  } catch (err) {
    const msg = err instanceof TypeError && err.message.includes("fetch")
      ? "AI service is currently unreachable. Please try again later."
      : "Failed to get AI response. Please try again.";
    throw new AppError(502, msg);
  }

  const assistantMsgs = await db.execute(sql`
    INSERT INTO messages (conversation_id, role, content, source_chunk_ids, token_usage)
    VALUES (${req.params.id as string}::uuid, 'assistant', ${result.content}, ${JSON.stringify(result.sourceChunkIds)}, ${JSON.stringify(result.tokenUsage)})
    RETURNING *
  `);

  await db.execute(sql`
    UPDATE conversations SET updated_at = NOW() WHERE id = ${req.params.id as string}::uuid
  `);

  res.json({ message: assistantMsgs[0] });
});

router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const convs: any[] = await db.execute(sql`
    DELETE FROM conversations WHERE id = ${req.params.id as string}::uuid AND user_id = ${req.userId!} RETURNING *
  `);
  if (!convs[0]) throw new AppError(404, "Conversation not found");
  res.json({ success: true });
});

export default router;

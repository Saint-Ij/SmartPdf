import { Router, type Response } from "express";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { upload } from "../config/upload.js";
import { processDocument } from "../services/document-processor.js";
import { AppError } from "../middleware/error.js";
import { validatePdfBuffer } from "../config/upload.js";
import { logger } from "../config/logger.js";

const UPLOAD_TIMEOUT_MS = 180_000;

const router = Router();

function sanitizeName(name: string): string {
  let cleaned = name;
  try { cleaned = decodeURIComponent(cleaned); } catch { /* leave as-is */ }
  return cleaned.replace(/%/g, "").replace(/\s+/g, " ").replace(/\.pdf$/i, "").trim();
}

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const docs = await db.execute(sql`
    SELECT * FROM documents WHERE user_id = ${req.userId!} ORDER BY created_at
  `);
  res.json({ documents: docs });
});

router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const docs: any[] = await db.execute(sql`
    SELECT * FROM documents WHERE id = ${req.params.id as string}::uuid AND user_id = ${req.userId!} LIMIT 1
  `);
  const doc = docs[0];
  if (!doc) throw new AppError(404, "Document not found");
  res.json({ document: doc });
});

router.post("/upload", authenticate, upload.single("file"), async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError(400, "No file uploaded");

  logger.info({ filename: file.originalname, size: file.size, userId: req.userId }, "upload: file received");

  validatePdfBuffer(file.buffer);
  logger.info({ filename: file.originalname }, "upload: PDF magic bytes validated");

  const docId = randomUUID();
  const title = sanitizeName(file.originalname);

  await db.execute(sql`
    INSERT INTO documents (id, user_id, title, original_filename, storage_path, mime_type, file_size, processing_status)
    VALUES (${docId}::uuid, ${req.userId!}::uuid, ${title}, ${file.originalname}, '', ${file.mimetype}, ${file.size}, 'processing')
  `);
  logger.info({ docId, title }, "upload: document record inserted");

  try {
    logger.info({ docId }, "upload: starting document processing");
    await Promise.race([
      processDocument(docId, file.buffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AppError(504, "Document processing timed out")), UPLOAD_TIMEOUT_MS)
      ),
    ]);
    logger.info({ docId }, "upload: document processing completed successfully");
  } catch (err) {
    logger.error({ docId, err }, "upload: document processing failed");
    await db.execute(sql`
      UPDATE documents SET processing_status = 'failed' WHERE id = ${docId}::uuid
    `);
    if (err instanceof AppError) throw err;
    throw new AppError(500, "Failed to process document");
  }

  const docs: any[] = await db.execute(sql`
    SELECT * FROM documents WHERE id = ${docId}::uuid LIMIT 1
  `);

  logger.info({ docId, title }, "upload: returning document");
  res.status(201).json({ document: docs[0] });
});

router.get("/:id/sections", authenticate, async (req: AuthRequest, res: Response) => {
  const docs: any[] = await db.execute(sql`
    SELECT * FROM documents WHERE id = ${req.params.id as string}::uuid AND user_id = ${req.userId!} LIMIT 1
  `);
  if (!docs[0]) throw new AppError(404, "Document not found");

  const sections = await db.execute(sql`
    SELECT * FROM sections WHERE document_id = ${req.params.id as string}::uuid ORDER BY "order"
  `);
  res.json({ sections });
});

router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const docs: any[] = await db.execute(sql`
    DELETE FROM documents WHERE id = ${req.params.id as string}::uuid AND user_id = ${req.userId!} RETURNING id
  `);
  if (!docs[0]) throw new AppError(404, "Document not found");
  res.json({ success: true });
});

export default router;

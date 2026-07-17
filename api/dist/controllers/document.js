import { Router } from "express";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { upload } from "../config/upload.js";
import { processDocument } from "../services/document-processor.js";
import { AppError } from "../middleware/error.js";
const router = Router();
router.get("/", authenticate, async (req, res) => {
    const docs = await db.execute(sql `
    SELECT * FROM documents WHERE user_id = ${req.userId} ORDER BY created_at
  `);
    res.json({ documents: docs });
});
router.get("/:id", authenticate, async (req, res) => {
    const docs = await db.execute(sql `
    SELECT * FROM documents WHERE id = ${req.params.id}::uuid AND user_id = ${req.userId} LIMIT 1
  `);
    const doc = docs[0];
    if (!doc)
        throw new AppError(404, "Document not found");
    res.json({ document: doc });
});
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file)
        throw new AppError(400, "No file uploaded");
    const docId = randomUUID();
    await db.execute(sql `
    INSERT INTO documents (id, user_id, title, original_filename, storage_path, mime_type, file_size, processing_status)
    VALUES (${docId}::uuid, ${req.userId}::uuid, ${file.originalname.replace(/\.pdf$/i, "")}, ${file.originalname}, '', ${file.mimetype}, ${file.size}, 'processing')
  `);
    try {
        await processDocument(docId, file.buffer);
    }
    catch {
        await db.execute(sql `
      UPDATE documents SET processing_status = 'failed' WHERE id = ${docId}::uuid
    `);
        throw new AppError(500, "Failed to process document");
    }
    const docs = await db.execute(sql `
    SELECT * FROM documents WHERE id = ${docId}::uuid LIMIT 1
  `);
    res.status(201).json({ document: docs[0] });
});
router.delete("/:id", authenticate, async (req, res) => {
    const docs = await db.execute(sql `
    DELETE FROM documents WHERE id = ${req.params.id}::uuid AND user_id = ${req.userId} RETURNING id
  `);
    if (!docs[0])
        throw new AppError(404, "Document not found");
    res.json({ success: true });
});
export default router;
//# sourceMappingURL=document.js.map
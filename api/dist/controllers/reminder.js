import { Router } from "express";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
const router = Router();
router.get("/", authenticate, async (req, res) => {
    const items = await db.execute(sql `
    SELECT * FROM reminders WHERE user_id = ${req.userId} ORDER BY scheduled_for
  `);
    res.json({ reminders: items });
});
router.post("/", authenticate, async (req, res) => {
    const schema = z.object({
        scheduledFor: z.string().datetime(),
        documentId: z.string().uuid().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const reminders = await db.execute(sql `
    INSERT INTO reminders (user_id, scheduled_for, document_id)
    VALUES (${req.userId}::uuid, ${new Date(parsed.data.scheduledFor).toISOString()}::timestamptz, ${parsed.data.documentId || null}::uuid)
    RETURNING *
  `);
    res.status(201).json({ reminder: reminders[0] });
});
router.patch("/:id/status", authenticate, async (req, res) => {
    const schema = z.object({ status: z.enum(["pending", "sent", "dismissed"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid request");
    const items = await db.execute(sql `
    UPDATE reminders
    SET status = ${parsed.data.status}, sent_at = CASE WHEN ${parsed.data.status} = 'sent' THEN NOW() ELSE sent_at END
    WHERE id = ${req.params.id}::uuid
    RETURNING *
  `);
    if (!items[0])
        throw new AppError(404, "Reminder not found");
    res.json({ success: true });
});
export default router;
//# sourceMappingURL=reminder.js.map
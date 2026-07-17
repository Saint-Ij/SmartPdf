import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";
const registerSchema = z.object({
    email: z.email(),
    name: z.string().min(1).max(255),
    password: z.string().min(6),
});
const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});
router.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues });
        return;
    }
    const { email, name, password } = parsed.data;
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
        res.status(409).json({ error: "Email already registered" });
        return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
        .insert(users)
        .values({ email, name, passwordHash })
        .returning({ id: users.id, email: users.email, name: users.name });
    if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ user, token });
});
router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues });
        return;
    }
    const { email, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
        user: { id: user.id, email: user.email, name: user.name },
        token,
    });
});
router.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing authorization header" });
        return;
    }
    const token = authHeader.slice(7);
    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    }
    catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }
    const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    res.json({ user });
});
export default router;
//# sourceMappingURL=auth.js.map
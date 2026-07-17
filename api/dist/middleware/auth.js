import {} from "express";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing authorization header" });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.userId;
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
//# sourceMappingURL=auth.js.map
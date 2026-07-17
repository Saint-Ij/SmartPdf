import {} from "express";
import { logger } from "../config/logger.js";
export class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
    }
    logger.error(err);
    if (err.message?.includes("Only PDF")) {
        res.status(400).json({ error: err.message });
        return;
    }
    res.status(500).json({ error: "Internal server error" });
}
//# sourceMappingURL=error.js.map
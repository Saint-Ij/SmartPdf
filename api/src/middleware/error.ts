import { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { logger } from "../config/logger.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large. Maximum size is 50MB." });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  logger.error(err);

  if (err.message?.includes("Only PDF")) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}

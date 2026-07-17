import express from "express";
import { configDotenv } from "dotenv";
import { logger } from "./config/logger.js";
import compression from "compression";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./controllers/auth.js";
import documentRouter from "./controllers/document.js";
import conversationRouter from "./controllers/conversation.js";
import quizRouter from "./controllers/quiz.js";
import flashcardRouter from "./controllers/flashcard.js";
import summaryRouter from "./controllers/summary.js";
import reminderRouter from "./controllers/reminder.js";
import { errorHandler } from "./middleware/error.js";
const app = express();
app.use(cors());
app.use(morgan("tiny"));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
const PORT = Number(process.env.PORT || 3000);
app.use(express.json());
app.get("/", (req, res) => {
    res.send("Express Server is running!");
});
const v1 = "/api/v1";
app.use(`${v1}/auth`, authRouter);
app.use(`${v1}/documents`, documentRouter);
app.use(`${v1}/conversations`, conversationRouter);
app.use(`${v1}/quizzes`, quizRouter);
app.use(`${v1}/flashcards`, flashcardRouter);
app.use(`${v1}/summaries`, summaryRouter);
app.use(`${v1}/reminders`, reminderRouter);
app.use(errorHandler);
app.listen(PORT, "0.0.0.0", () => {
    logger.info(`[server]: Server is running at http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map
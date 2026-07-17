# SmartPdf API

RESTful backend for the SmartPdf study companion. Handles PDF text extraction, AI-powered chat, quizzes, flashcards, summaries, and reminders.

## Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js / Express 5** | HTTP server |
| **TypeScript** | Type safety |
| **PostgreSQL + pgvector** | Database + vector embeddings |
| **Drizzle ORM** | Schema, migrations, queries |
| **pdf-parse** | PDF text extraction |
| **Groq API** | LLM for chat, quiz/flashcard/summary generation |
| **Jina AI** | Text embeddings for semantic search |
| **Multer** | File upload (in-memory only) |
| **JWT + bcryptjs** | Authentication |
| **Zod** | Request validation |

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **PostgreSQL** >= 14 with pgvector extension

### Setup

```bash
npm install
```

Configure `.env` (see `.env` for reference).

### Database

```bash
npx drizzle-kit push
```

### Run

```bash
npm run dev     # Development (hot reload)
npm run build   # Build
npm start       # Production
```

Server starts at `http://localhost:3000` by default.

---

## API Reference

All endpoints prefixed with `/api/v1`. Most require `Authorization: Bearer <token>`.

### Auth

#### `POST /api/v1/auth/register`
```json
{ "email": "...", "name": "...", "password": "..." }
```
**Response** `201` — `{ user: { id, email, name }, token }`

#### `POST /api/v1/auth/login`
```json
{ "email": "...", "password": "..." }
```
**Response** `200` — `{ user: { id, email, name }, token }`

#### `GET /api/v1/auth/me`
**Response** `200` — `{ user: { id, email, name, timezone } }`

---

### Documents

PDFs are **not stored** on the backend. Text is extracted in memory and discarded after processing. Only text content, embeddings, and metadata persist.

#### `POST /api/v1/documents/upload`
`multipart/form-data` with a `file` field. Max 50 MB, PDF only.
**Response** `201` — `{ document: { id, title, originalFilename, mimeType, fileSize, pageCount, documentType, processingStatus, uploadedAt, processedAt, createdAt } }`

#### `GET /api/v1/documents`
List user's documents.

#### `GET /api/v1/documents/:id`
Get a single document.

#### `DELETE /api/v1/documents/:id`
Delete a document and all its data.

---

### Conversations

#### `POST /api/v1/conversations`
```json
{ "documentId": "uuid", "title": "optional" }
```
**Response** `201` — `{ conversation: { id } }`

#### `GET /api/v1/conversations`
List user's conversations.

#### `DELETE /api/v1/conversations/:id`
Delete a conversation.

#### `GET /api/v1/conversations/:id/messages`
Get all messages in a conversation.

#### `POST /api/v1/conversations/:id/chat`
Send a message and get an AI response.
```json
{ "content": "Explain this concept..." }
```
**Response** `200` — `{ message: { id, conversationId, role, content, sourceChunkIds, tokenUsage, createdAt } }`

---

### Quizzes

#### `GET /api/v1/quizzes/all`
List quizzes for user's documents.

#### `POST /api/v1/quizzes/generate`
AI-generate a quiz from a document.
```json
{ "documentId": "uuid", "totalQuestions": 5 }
```
**Response** `201` — `{ quiz: { id, documentId, totalQuestions, status } }`

#### `GET /api/v1/quizzes/:id`
Get quiz metadata.

#### `GET /api/v1/quizzes/:id/questions`
Get questions (without correct answers).

#### `POST /api/v1/quizzes/:id/submit`
Submit quiz answers.
```json
{ "answers": { "questionId": "answer" } }
```
**Response** `200` — `{ attempt, score, passed, correct, total }`

#### `GET /api/v1/quizzes/:id/answers`
Get questions with correct answers and explanations.

---

### Flashcards

#### `POST /api/v1/flashcards/generate`
AI-generate flashcards from a document.
```json
{ "documentId": "uuid", "count": 5 }
```
**Response** `201` — `{ flashcards: [{ id, front, back }] }`

#### `GET /api/v1/flashcards/:id`
Get a single flashcard.

#### `GET /api/v1/flashcards/document/:docId`
Get all flashcards for a document.

#### `PATCH /api/v1/flashcards/:id/difficulty`
Update difficulty (1-3).
```json
{ "difficulty": 2 }
```

---

### Summaries

#### `GET /api/v1/summaries/document/:docId`
Get summaries for a document. Auto-generates via AI if none exist.

---

### Reminders

#### `GET /api/v1/reminders`
List user's reminders.

#### `POST /api/v1/reminders`
```json
{ "scheduledFor": "ISO datetime", "documentId": "optional uuid" }
```
**Response** `201` — `{ reminder }`

#### `PATCH /api/v1/reminders/:id/status`
```json
{ "status": "dismissed" }
```
Valid: `pending`, `sent`, `dismissed`.

---

## Project Structure

```
api/
├── drizzle/                  # DB migrations
├── src/
│   ├── config/
│   │   ├── logger.ts
│   │   └── upload.ts         # Multer config
│   ├── controllers/          # Route handlers (one file per entity)
│   │   ├── auth.ts
│   │   ├── document.ts
│   │   ├── conversation.ts
│   │   ├── quiz.ts
│   │   ├── flashcard.ts
│   │   ├── summary.ts
│   │   └── reminder.ts
│   ├── services/
│   │   ├── ai.ts             # Groq + Jina API calls
│   │   └── document-processor.ts  # PDF text extraction + chunking + embedding
│   ├── middleware/
│   │   ├── auth.ts           # JWT middleware
│   │   └── error.ts          # AppError + error handler
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── relations.ts
│   └── index.ts
├── .env
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

## Error Handling

All errors return:
```json
{ "error": "message" }
```

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request |
| 401 | Unauthorized |
| 404 | Not found |
| 409 | Conflict |
| 500 | Internal error |

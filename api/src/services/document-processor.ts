import { PDFParse } from "pdf-parse";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { generateEmbedding } from "./ai.js";
import { logger } from "../config/logger.js";

const CHUNK_MAX_CHARS = 1500;
const CHUNK_OVERLAP = 200;
const EMBEDDING_CONCURRENCY = 5;

export async function processDocument(
  documentId: string,
  buffer: Buffer,
) {
  logger.info({ docId: documentId, bufferSize: buffer.length }, "processor: starting PDF parse");

  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy();

  const totalTextLength = textResult.text?.length ?? 0;
  const pageCount = textResult.pages?.length ?? 0;
  logger.info(
    { docId: documentId, pageCount, totalTextLength },
    "processor: PDF parsed",
  );

  const pageRecords: { id: string; page_number: number }[] = [];

  for (const page of textResult.pages) {
    const text = page.text || "";
    const pages: any[] = await db.execute(sql`
      INSERT INTO pages (document_id, page_number, extracted_text, character_count)
      VALUES (${documentId}::uuid, ${page.num}, ${text}, ${text.length})
      RETURNING id, page_number
    `);
    pageRecords.push({ id: pages[0]!.id, page_number: pages[0]!.page_number });
    logger.debug(
      { docId: documentId, pageNum: page.num, pageId: pages[0]!.id, charCount: text.length },
      "processor: page inserted",
    );
  }

  logger.info(
    { docId: documentId, totalPages: pageRecords.length },
    "processor: all pages saved to DB",
  );

  const allText = textResult.text || "";
  const pageOffsets = buildPageOffsets(textResult.pages);
  const chunkTexts = splitIntoChunks(allText);
  const totalPages = pageRecords.length;

  logger.info(
    { docId: documentId, totalChunks: chunkTexts.length, chunkMaxChars: CHUNK_MAX_CHARS, overlap: CHUNK_OVERLAP },
    "processor: text split into chunks",
  );

  const infoResult = await parser.getInfo();
  const outline = infoResult?.outline ?? null;
  let sections: { id: string; title: string; order: number; startPageIdx: number; endPageIdx: number; startChunk: number; endChunk: number }[] = [];

  if (outline && outline.length > 0) {
    for (let i = 0; i < outline.length; i++) {
      const item = outline[i]!;

      const searchIdx = allText.indexOf(item.title || "");
      const startPageIdx = searchIdx >= 0 ? findPageIndex(pageOffsets, searchIdx) : 0;

      const endPageIdx = i < outline.length - 1
        ? (() => {
            const nextSearchIdx = allText.indexOf(outline[i + 1]!.title || "");
            return nextSearchIdx >= 0 ? findPageIndex(pageOffsets, nextSearchIdx) : totalPages - 1;
          })()
        : totalPages - 1;

      const result: any[] = await db.execute(sql`
        INSERT INTO sections (document_id, title, "order", start_page, end_page, start_chunk_index, end_chunk_index, estimated_reading_minutes)
        VALUES (${documentId}::uuid, ${item.title || `Section ${i + 1}`}, ${i}, ${startPageIdx + 1}, ${endPageIdx + 1}, 0, 0, 0)
        RETURNING id
      `);

      sections.push({
        id: result[0]!.id as string,
        title: item.title || `Section ${i + 1}`,
        order: i,
        startPageIdx,
        endPageIdx,
        startChunk: 0,
        endChunk: 0,
      });
    }

    logger.info({ docId: documentId, sectionCount: sections.length }, "processor: sections created from PDF outline");
  } else {
    const result: any[] = await db.execute(sql`
      INSERT INTO sections (document_id, title, "order", start_page, end_page, start_chunk_index, end_chunk_index, estimated_reading_minutes)
      VALUES (${documentId}::uuid, 'Full Document', 0, 1, ${totalPages}, 0, ${chunkTexts.length - 1}, ${Math.max(1, Math.round(allText.length / 1000))})
      RETURNING id
    `);
    sections.push({
      id: result[0]!.id as string,
      title: "Full Document",
      order: 0,
      startPageIdx: 0,
      endPageIdx: totalPages - 1,
      startChunk: 0,
      endChunk: chunkTexts.length - 1,
    });
    logger.info({ docId: documentId, sectionId: sections[0]!.id }, "processor: single section created");
  }

  const chunkEntries: {
    content: string;
    index: number;
    startPageId: string;
    endPageId: string;
    sectionIdx: number;
  }[] = [];

  for (let i = 0; i < chunkTexts.length; i++) {
    const content = chunkTexts[i];
    if (!content || !content.trim()) continue;

    const charStart = allText.indexOf(content);
    const charEnd = charStart + content.length;
    const startPageIdx = findPageIndex(pageOffsets, charStart);
    const endPageIdx = findPageIndex(pageOffsets, charEnd);
    const startPageId = pageRecords[startPageIdx]?.id ?? pageRecords[0]!.id;
    const endPageId = pageRecords[endPageIdx]?.id ?? pageRecords[pageRecords.length - 1]!.id;

    const sectionIdx = sections.findIndex((s) => startPageIdx >= s.startPageIdx && startPageIdx <= s.endPageIdx);
    const secIdx = sectionIdx >= 0 ? sectionIdx : 0;

    chunkEntries.push({ content, index: i, startPageId, endPageId, sectionIdx: secIdx });

    logger.debug(
      { docId: documentId, chunkIndex: i, contentLength: content.length, startPage: startPageIdx + 1, endPage: endPageIdx + 1 },
      "processor: chunk mapped to pages",
    );
  }

  for (const sec of sections) {
    const secChunks = chunkEntries.filter((c) => c.sectionIdx === sec.order);
    if (secChunks.length > 0) {
      await db.execute(sql`
        UPDATE sections SET start_chunk_index = ${secChunks[0]!.index}, end_chunk_index = ${secChunks[secChunks.length - 1]!.index}
        WHERE id = ${sec.id}::uuid
      `);
    }
  }

  const embeddings = await runWithConcurrency(
    chunkEntries.map((c) => () => generateEmbedding(c.content)),
    EMBEDDING_CONCURRENCY,
  );

  for (let i = 0; i < chunkEntries.length; i++) {
    const entry = chunkEntries[i]!;
    const embedding = embeddings[i] ?? new Array(1024).fill(0);
    const sec = sections[entry.sectionIdx]!;

    await db.execute(sql`
      INSERT INTO chunks (document_id, section_id, start_page_id, end_page_id, chunk_index, token_count, content, embedding)
      VALUES (${documentId}::uuid, ${sec.id}::uuid, ${entry.startPageId}::uuid, ${entry.endPageId}::uuid, ${entry.index}, ${Math.round(entry.content.length / 4)}, ${entry.content}, ${sql.raw(`'[${embedding.join(",")}]'::vector`)})
    `);

    logger.debug(
      { docId: documentId, chunkIndex: entry.index, tokenCount: Math.round(entry.content.length / 4) },
      "processor: chunk inserted",
    );
  }

  logger.info(
    { docId: documentId, chunksInserted: chunkEntries.length },
    "processor: all chunks saved to DB",
  );

  await db.execute(sql`
    UPDATE documents SET processing_status = 'ready', page_count = ${totalPages}, processed_at = NOW()
    WHERE id = ${documentId}::uuid
  `);

  logger.info(
    { docId: documentId, totalPages },
    "processor: document marked as ready",
  );
}

function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length > CHUNK_MAX_CHARS && current.length > 0) {
      chunks.push(current.trim());
      current = current.slice(-CHUNK_OVERLAP) + "\n\n";
    }
    current += (current.length > 0 && current !== current.slice(-CHUNK_OVERLAP) ? "\n\n" : "") + trimmed;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text.slice(0, CHUNK_MAX_CHARS)];
}

function buildPageOffsets(pages: { text?: string }[]): number[] {
  const offsets: number[] = [0];
  for (const page of pages) {
    offsets.push(offsets[offsets.length - 1]! + (page.text?.length ?? 0));
  }
  return offsets;
}

function findPageIndex(offsets: number[], charPos: number): number {
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (charPos >= offsets[i]!) {
      return Math.min(i, offsets.length - 2);
    }
  }
  return 0;
}

async function runWithConcurrency<T>(
  factories: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < factories.length) {
      const i = index++;
      try {
        results[i] = await factories[i]!();
      } catch {
        results[i] = new Array(1024).fill(0) as unknown as T;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, factories.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

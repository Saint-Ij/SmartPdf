import { PDFParse } from "pdf-parse";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { generateEmbedding } from "./ai.js";
const CHUNK_MAX_CHARS = 1500;
const CHUNK_OVERLAP = 200;
export async function processDocument(documentId, buffer) {
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    await parser.destroy();
    const pageRecords = [];
    for (const page of textResult.pages) {
        const text = page.text || "";
        const pages = await db.execute(sql `
      INSERT INTO pages (document_id, page_number, extracted_text, character_count)
      VALUES (${documentId}::uuid, ${page.num}, ${text}, ${text.length})
      RETURNING id, page_number
    `);
        pageRecords.push({ id: pages[0].id, page_number: pages[0].page_number });
    }
    const allText = textResult.text || "";
    const chunkTexts = splitIntoChunks(allText);
    const totalPages = pageRecords.length;
    const sections = await db.execute(sql `
    INSERT INTO sections (document_id, title, "order", start_page, end_page, start_chunk_index, end_chunk_index, estimated_reading_minutes)
    VALUES (${documentId}::uuid, 'Full Document', 0, 1, ${totalPages}, 0, ${chunkTexts.length - 1}, ${Math.max(1, Math.round(allText.length / 1000))})
    RETURNING id
  `);
    const section = sections[0];
    for (let i = 0; i < chunkTexts.length; i++) {
        const content = chunkTexts[i];
        if (!content || !content.trim())
            continue;
        const startPage = pageRecords[0];
        const endPage = pageRecords[pageRecords.length - 1];
        let embedding;
        try {
            embedding = await generateEmbedding(content);
        }
        catch {
            embedding = new Array(1024).fill(0);
        }
        await db.execute(sql `
      INSERT INTO chunks (document_id, section_id, start_page_id, end_page_id, chunk_index, token_count, content, embedding)
      VALUES (${documentId}::uuid, ${section.id}::uuid, ${startPage.id}::uuid, ${endPage.id}::uuid, ${i}, ${Math.round(content.length / 4)}, ${content}, ${sql.raw(`'[${embedding.join(",")}]'::vector`)})
    `);
    }
    await db.execute(sql `
    UPDATE documents SET processing_status = 'ready', page_count = ${totalPages}, processed_at = NOW()
    WHERE id = ${documentId}::uuid
  `);
}
function splitIntoChunks(text) {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let current = "";
    for (const p of paragraphs) {
        const trimmed = p.trim();
        if (!trimmed)
            continue;
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
//# sourceMappingURL=document-processor.js.map
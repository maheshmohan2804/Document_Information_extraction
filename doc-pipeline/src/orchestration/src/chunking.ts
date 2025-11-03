/**
 * Advanced chunking module
 * Implements intelligent document chunking with the following strategies:
 * - Markdown header-based chunking
 * - Table detection and preservation
 * - Min/max size constraints with combining/splitting
 * - Recursive chunking with overlap for documents without headers
 */

/**
 * Chunking Thought Process:
 * A header-based chunking strategy can give the LLM the best possible information to 
 * provide key details such as Summary, Methods, Findings, etc.
 * Code Logic: The code uses multiple strategies to chunk:
 * If the document was written in markdown, it uses:
      * - Header-based chunking: It splits the document at markdown headers (levels 1-3).
      * - Combines smaller chunks under each header to meet a minimum size.
      * - Splits larger chunks that exceed a maximum size by removing the latest combined chunk.
      * - Table detection: It identifies markdown tables and ensures they are kept intact within chunks.
      * - Size constraints: It enforces minimum and maximum chunk sizes, combining smaller chunks and splitting larger ones as needed.
  * If the document lacks markdown structure, it falls back to recursive chunking with overlap:
      * - This method splits text into chunks of a specified maximum size, with overlapping text between chunks to preserve context.
      * - It attempts to split at paragraph boundaries first, then sentences, and finally words as a last resort.
  * Throughout the process, it logs detailed information about the chunking steps, including any warnings about chunks that still exceed size limits (e.g., due to large tables).
  * The final output is an array of chunks, each with metadata indicating its header, content, character count, and whether it contains a table.
 * 
 * 
 */

import { Chunk, ChunkingConfig } from './types';
import { logger } from './logger';

/**
 * Extract markdown tables from text and return their positions
 */
function extractTables(markdownText: string): Array<{ content: string; start: number; end: number }> {
  const tables: Array<{ content: string; start: number; end: number }> = [];

  // Pattern to match markdown tables
  const tablePattern = /(\|[^\n]+\|[\n\r]+\|[-:\s|]+\|[\n\r]+(?:\|[^\n]+\|[\n\r]+)*)/g;

  let match;
  while ((match = tablePattern.exec(markdownText)) !== null) {
    tables.push({
      content: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  logger.debug(`Extracted ${tables.length} tables from markdown`);
  return tables;
}

/**
 * Check if a text range intersects with any table
 */
function rangeIntersectsTable(
  start: number,
  end: number,
  tableRanges: Array<{ start: number; end: number }>
): boolean {
  return tableRanges.some(
    table => (start <= table.start && table.start < end) || (start < table.end && table.end <= end) || (table.start <= start && end <= table.end)
  );
}

/**
 * Recursively split text into chunks with overlap
 * Tries to split at paragraph, then sentence, then word boundaries
 */
function recursiveChunkWithOverlap(
  text: string,
  maxSize: number,
  overlap: number
): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks: string[] = [];

  // Try splitting by paragraphs first
  const paragraphs = text.split(/\n\n+/);

  if (paragraphs.length > 1) {
    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length + 2 <= maxSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          // Add overlap from end of previous chunk
          const overlapText = currentChunk.length > overlap
            ? currentChunk.slice(-overlap)
            : currentChunk;
          currentChunk = overlapText + '\n\n' + para;
        } else {
          // Single paragraph is too large, recurse
          const subChunks = recursiveChunkWithOverlap(para, maxSize, overlap);
          chunks.push(...subChunks.slice(0, -1));
          currentChunk = subChunks[subChunks.length - 1] || '';
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Try splitting by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);

  if (sentences.length > 1) {
    let currentChunk = '';

    for (const sent of sentences) {
      if (currentChunk.length + sent.length + 1 <= maxSize) {
        currentChunk += (currentChunk ? ' ' : '') + sent;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          const overlapText = currentChunk.length > overlap
            ? currentChunk.slice(-overlap)
            : currentChunk;
          currentChunk = overlapText + ' ' + sent;
        } else {
          // Single sentence too large, recurse
          const subChunks = recursiveChunkWithOverlap(sent, maxSize, overlap);
          chunks.push(...subChunks.slice(0, -1));
          currentChunk = subChunks[subChunks.length - 1] || '';
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Last resort: split by words
  const words = text.split(/\s+/);
  let currentChunk = '';

  for (const word of words) {
    if (currentChunk.length + word.length + 1 <= maxSize) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        const overlapText = currentChunk.length > overlap
          ? currentChunk.slice(-overlap)
          : currentChunk;
        currentChunk = overlapText + ' ' + word;
      } else {
        // Single word exceeds maxSize (rare edge case)
        chunks.push(word.slice(0, maxSize));
        currentChunk = word.slice(maxSize);
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Split a large chunk into smaller chunks at paragraph boundaries with overlap
 */
function splitLargeChunk(
  chunkContent: string,
  header: string,
  maxSize: number,
  overlap: number
): Chunk[] {
  const splitTexts = recursiveChunkWithOverlap(chunkContent, maxSize, overlap);

  return splitTexts.map((text, index) => ({
    header: splitTexts.length > 1 ? `${header} (Part ${index + 1})` : header,
    content: text.trim(),
    charCount: text.trim().length,
    containsTable: false
  }));
}

/**
 * Main chunking function
 * Implements all chunking strategies
 */
export function chunkDocument(
  markdownText: string,
  config: ChunkingConfig
): Chunk[] {
  logger.section('Starting Document Chunking');
  logger.info(`Config: min=${config.minChunkSize}, max=${config.maxChunkSize}, overlap=${config.overlap}`);

  const { minChunkSize, maxChunkSize, overlap } = config;

  // Early exit for empty or whitespace-only input
  if (!markdownText || markdownText.trim().length === 0) {
    logger.info('Empty input provided to chunkDocument; returning 0 chunks');
    return [];
  }

  // Extract tables
  const tables = extractTables(markdownText);
  const tableRanges = tables.map(t => ({ start: t.start, end: t.end }));

  // Find all markdown headers (levels 1-3)
  const headerPattern = /^#{1,3}\s+.+$/gm;
  const headerMatches = Array.from(markdownText.matchAll(headerPattern));

  // If no headers found, use recursive chunking
  if (headerMatches.length === 0) {
    logger.warn('No markdown headers found. Using recursive chunking with overlap.');
    const chunkTexts = recursiveChunkWithOverlap(markdownText, maxChunkSize, overlap);

    const chunks = chunkTexts.map((text, index) => ({
      header: `Chunk ${index + 1}`,
      content: text,
      charCount: text.length,
      containsTable: false
    }));

    logger.success(`Created ${chunks.length} chunks using recursive strategy`);
    return chunks;
  }

  // Process header-based chunks by extracting content between headers
  const rawChunks: Chunk[] = [];

  for (let idx = 0; idx < headerMatches.length; idx++) {
    const headerMatch = headerMatches[idx];
    const headerStart = headerMatch.index!;
    const nextHeaderStart = idx + 1 < headerMatches.length
      ? headerMatches[idx + 1].index!
      : markdownText.length;

    // Extract content from this header to the next header (or end of document)
    let chunkText = markdownText.substring(headerStart, nextHeaderStart).trim();

    // Skip truly empty chunks
    if (!chunkText) {
      continue;
    }

    // Capture header text (support 1-3 hashes)
    const headerTextMatch = chunkText.match(/^(#{1,3}\s+)(.+)/);
    const header = headerTextMatch ? headerTextMatch[2].trim() : 'Unknown';

    // Check if chunk contains a table
    const chunkEnd = headerStart + chunkText.length;
    const containsTable = tableRanges.some(
      ({ start, end }) =>
        (headerStart <= start && start < chunkEnd) ||
        (headerStart < end && end <= chunkEnd)
    );

    rawChunks.push({
      header,
      content: chunkText,
      charCount: chunkText.length,
      containsTable
    });
  }

  logger.info(`Created ${rawChunks.length} raw chunks from headers`);

  // Process chunks: combine small, split large
  const processedChunks: Chunk[] = [];
  let i = 0;

  while (i < rawChunks.length) {
    const current = rawChunks[i];

    // If chunk contains a table, keep it as-is
    if (current.containsTable) {
      processedChunks.push(current);
      i++;
      continue;
    }

    // If chunk is too small, combine with next chunks
    if (current.charCount !== undefined && current.charCount < minChunkSize) {
      let combinedContent = current.content;
      let combinedHeader = current.header;
      let j = i + 1;

      while (j < rawChunks.length && combinedContent.length < minChunkSize) {
        if (rawChunks[j].containsTable) {
          break;
        }
        combinedContent += '\n\n' + rawChunks[j].content;
        combinedHeader += ' + ' + rawChunks[j].header;
        j++;
      }

      // Check if combined chunk is now too large
      if (combinedContent.length > maxChunkSize) {
        const splitChunks = splitLargeChunk(combinedContent, combinedHeader, maxChunkSize, overlap);
        processedChunks.push(...splitChunks);
      } else {
        processedChunks.push({
          header: combinedHeader,
          content: combinedContent,
          charCount: combinedContent.length,
          containsTable: false
        });
      }

      i = j;
      continue;
    }

    // If chunk is too large, split it
    if (current.charCount !== undefined && current.charCount > maxChunkSize) {
      const splitChunks = splitLargeChunk(current.content, current.header, maxChunkSize, overlap);
      processedChunks.push(...splitChunks);
      i++;
      continue;
    }

    // Chunk is just right
    processedChunks.push(current);
    i++;
  }

  // Log statistics
  const small = processedChunks.filter(c => c.charCount !== undefined && c.charCount < minChunkSize).length;
  const medium = processedChunks.filter(c => c.charCount !== undefined && c.charCount >= minChunkSize && c.charCount <= maxChunkSize).length;
  const large = processedChunks.filter(c => c.charCount !== undefined && c.charCount > maxChunkSize).length;
  const withTables = processedChunks.filter(c => c.containsTable).length;

  logger.success(`Chunking complete: ${processedChunks.length} total chunks`);
  logger.info(`Size distribution: Small=${small}, Medium=${medium}, Large=${large}, Tables=${withTables}`);

  if (large > 0) {
    logger.warn(`Warning: ${large} chunks still exceed max size (likely tables)`);
  }

  return processedChunks;
}

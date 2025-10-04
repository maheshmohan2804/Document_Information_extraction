/**
 * Helper utilities for tests
 */

import { TaggedChunk, Chunk } from '../src/types';

/**
 * Create a test TaggedChunk with all required fields
 */
export function createTestChunk(
  header: string,
  content: string,
  chunkId: number,
  tags: string[] = [],
  containsTable: boolean = false
): TaggedChunk {
  return {
    header,
    content,
    charCount: content.length,
    containsTable,
    chunkId,
    tags
  };
}

/**
 * Create multiple test chunks
 */
export function createTestChunks(data: Array<{
  header: string;
  content: string;
  tags?: string[];
  containsTable?: boolean;
}>): TaggedChunk[] {
  return data.map((item, index) => createTestChunk(
    item.header,
    item.content,
    index,
    item.tags || [],
    item.containsTable || false
  ));
}

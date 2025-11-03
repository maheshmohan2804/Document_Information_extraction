/**
 * Vector store module
 * Handles storing and retrieving document chunks using embeddings
 * Note: This is a simplified in-memory implementation
 * For production, integrate with ChromaDB or similar vector database
 */

import { TaggedChunk, SearchResult } from './types';
import { logger } from './logger';

/**
 * Simple cosine similarity calculation
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Simple embedding generation using character frequency
 * In production, replace with actual embedding model (e.g., OpenAI, Sentence Transformers)
 */
function generateSimpleEmbedding(text: string): number[] {
  // Normalize text
  const normalized = text.toLowerCase();

  // Create a simple frequency-based embedding (300 dimensions)
  const embedding = new Array(300).fill(0);

  // Character frequency
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = charCode % 300;
    embedding[idx] += 1;
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * In-memory vector store
 */
export class VectorStore {
  private chunks: TaggedChunk[] = [];
  private embeddings: number[][] = [];

  /**
   * Add chunks to the store
   */
  async addChunks(chunks: TaggedChunk[]): Promise<void> {
    logger.section('Adding Chunks to Vector Store');
    logger.info(`Adding ${chunks.length} chunks`);

    this.chunks = chunks;
    this.embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.debug(`Generating embedding for chunk ${i + 1}/${chunks.length}`);

      // Generate embedding
      const embedding = generateSimpleEmbedding(chunk.content);
      this.embeddings.push(embedding);
    }

    logger.success(`Added ${chunks.length} chunks with embeddings`);
  }

  /**
   * Semantic search using embeddings
   */
  async semanticSearch(
    query: string,
    topK: number = 5,
    tagFilter?: string
  ): Promise<SearchResult[]> {
    logger.debug(`Semantic search: query="${query}", topK=${topK}, filter=${tagFilter || 'none'}`);

    // Generate query embedding
    const queryEmbedding = generateSimpleEmbedding(query);

    // Calculate similarities
    const scores: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < this.embeddings.length; i++) {
      const chunk = this.chunks[i];

      // Apply tag filter if specified
      if (tagFilter && !chunk.tags.includes(tagFilter)) {
        continue;
      }

      const similarity = cosineSimilarity(queryEmbedding, this.embeddings[i]);
      scores.push({ index: i, score: similarity });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Get top K results
    const topResults = scores.slice(0, topK);

    const results: SearchResult[] = topResults.map(({ index, score }) => {
      const chunk = this.chunks[index];
      return {
        chunkId: `chunk_${chunk.chunkId}`,
        score,
        header: chunk.header,
        content: chunk.content,
        tags: chunk.tags
      };
    });

    logger.debug(`Semantic search returned ${results.length} results`);
    return results;
  }

  /**
   * Get chunk by ID
   */
  getChunkById(chunkId: string): TaggedChunk | undefined {
    const id = parseInt(chunkId.replace('chunk_', ''));
    return this.chunks.find(c => c.chunkId === id);
  }

  /**
   * Get all chunks
   */
  getAllChunks(): TaggedChunk[] {
    return this.chunks;
  }

  /**
   * Get total number of chunks
   */
  getCount(): number {
    return this.chunks.length;
  }
}

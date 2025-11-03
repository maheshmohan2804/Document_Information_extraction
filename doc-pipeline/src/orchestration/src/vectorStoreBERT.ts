/**
 * Vector Store with Sentence-BERT Embeddings
 * Uses @xenova/transformers for high-quality semantic embeddings
  * Falls back to simple embedding method if model load fails
  * Uses lazy loading to avoid startup delays
  * Uses simple array-based storage for embeddings, no external DB as number of chunks is small and O(n) search is acceptable
  * Includes cosine similarity for semantic search
 */

import { TaggedChunk, SearchResult } from './types';
import { logger } from './logger';

// Lazy-load transformers to avoid startup overhead
let pipelineInstance: any = null;
let embeddingModel: any = null;

/**
 * Initialize the embedding model (lazy loaded)
 */
async function initializeEmbeddingModel() {
  if (embeddingModel) {
    return embeddingModel;
  }

  logger.info('🤖 Loading Sentence-BERT model (Xenova/all-MiniLM-L6-v2)...');
  const startTime = Date.now();

  try {
    // Dynamic import to avoid bundling issues
    const { pipeline } = await import('@xenova/transformers');
    pipelineInstance = pipeline;

    // Load the model (downloads on first run, then cached)
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(`✅ Sentence-BERT model loaded in ${duration}s`);
    return embeddingModel;
  } catch (error) {
    logger.error('❌ Failed to load Sentence-BERT model, falling back to simple embeddings');
    logger.debug(`Error: ${error}`);
    return null;
  }
}

/**
 * Generate embeddings using Sentence-BERT
 */
async function generateSentenceBERTEmbedding(text: string): Promise<number[]> {
  try {
    const model = await initializeEmbeddingModel();

    if (!model) {
      // Fallback to simple embeddings
      return generateSimpleEmbedding(text);
    }

    // Truncate text to avoid token limits (512 tokens ~= 2000 chars)
    const truncatedText = text.slice(0, 2000);

    // Generate embedding
    const output = await model(truncatedText, { pooling: 'mean', normalize: true });

    // Convert to array
    const embedding = Array.from(output.data) as number[];

    return embedding;
  } catch (error) {
    logger.warn('⚠️ Sentence-BERT generation failed, using fallback');
    logger.debug(`Error: ${error}`);
    return generateSimpleEmbedding(text);
  }
}

/**
 * Fallback: Simple embedding generation using character frequency
 * Used if Sentence-BERT fails to load
 */
function generateSimpleEmbedding(text: string): number[] {
  // Normalize text
  const normalized = text.toLowerCase();

  // Create a simple frequency-based embedding (384 dimensions to match Sentence-BERT)
  const embedding = new Array(384).fill(0);

  // Character frequency
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = charCode % 384;
    embedding[idx] += 1;
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

/**
 * Simple cosine similarity calculation
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    logger.warn(`⚠️ Vector length mismatch: ${vec1.length} vs ${vec2.length}`);
    // Pad shorter vector with zeros
    const maxLen = Math.max(vec1.length, vec2.length);
    vec1 = [...vec1, ...new Array(maxLen - vec1.length).fill(0)];
    vec2 = [...vec2, ...new Array(maxLen - vec2.length).fill(0)];
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Vector Store with Sentence-BERT embeddings
 */
export class VectorStoreBERT {
  private chunks: TaggedChunk[] = [];
  private embeddings: number[][] = [];
  private isInitialized: boolean = false;

  /**
   * Add chunks to the store and generate embeddings
   */
  async addChunks(chunks: TaggedChunk[]): Promise<void> {
    logger.section('Adding Chunks to Vector Store (Sentence-BERT)');
    logger.info(`📊 Adding ${chunks.length} chunks with Sentence-BERT embeddings`);

    this.chunks = chunks;
    this.embeddings = [];

    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPreview = chunk.header.slice(0, 50);
      logger.debug(`Embedding chunk ${i + 1}/${chunks.length}: ${chunkPreview}...`);

      // Generate embedding using Sentence-BERT
      const embedding = await generateSentenceBERTEmbedding(chunk.content);
      this.embeddings.push(embedding);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(`✅ Generated ${chunks.length} embeddings in ${duration}s`);
    logger.info(`📐 Embedding dimension: ${this.embeddings[0]?.length || 0}`);

    this.isInitialized = true;
  }

  /**
   * Semantic search using cosine similarity
   */
  async semanticSearch(
    query: string,
    topK: number = 5,
    tagFilter?: string
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Vector store not initialized. Call addChunks first.');
    }

    logger.debug(`🔍 Semantic search: query="${query.slice(0, 50)}...", topK=${topK}, filter=${tagFilter || 'none'}`);

    // Generate query embedding
    const queryEmbedding = await generateSentenceBERTEmbedding(query);

    // Calculate similarities
    const results: SearchResult[] = [];

    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];

      // Apply tag filter if provided
      if (tagFilter && !chunk.tags.includes(tagFilter)) {
        continue;
      }

      const similarity = cosineSimilarity(queryEmbedding, this.embeddings[i]);

      results.push({
        chunkId: `chunk_${chunk.chunkId}`,
        score: similarity,
        header: chunk.header,
        content: chunk.content,
        tags: chunk.tags
      });
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.score - a.score);

    // Return top K
    const topResults = results.slice(0, topK);

    const topScore = topResults[0]?.score.toFixed(4) || 'N/A';
    logger.debug(`📊 Semantic search returned ${topResults.length} results (top score: ${topScore})`);

    return topResults;
  }

  /**
   * Get all chunks
   */
  getAllChunks(): TaggedChunk[] {
    return this.chunks;
  }

  /**
   * Get chunk by ID
   */
  getChunkById(chunkId: string): TaggedChunk | undefined {
    const id = parseInt(chunkId.replace('chunk_', ''));
    return this.chunks.find(c => c.chunkId === id);
  }

  /**
   * Get embedding for a chunk
   */
  getEmbedding(chunkId: string): number[] | undefined {
    const id = parseInt(chunkId.replace('chunk_', ''));
    return this.embeddings[id];
  }

  /**
   * Check if store is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get total number of chunks
   */
  getCount(): number {
    return this.chunks.length;
  }
}

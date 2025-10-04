/**
 * Hybrid search module
 * Combines semantic search (embeddings) with BM25 keyword search
 */

import { SearchResult } from './types';
import { VectorStore } from './vectorStore';
import { logger } from './logger';

/**
 * Simple BM25 implementation
 */
class BM25 {
  private documents: string[][] = [];
  private avgDocLength: number = 0;
  private docLengths: number[] = [];
  private idf: Map<string, number> = new Map();
  private k1: number = 1.5;
  private b: number = 0.75;

  /**
   * Initialize BM25 with documents
   */
  initialize(documents: string[]): void {
    // Tokenize documents
    this.documents = documents.map(doc => this.tokenize(doc));

    // Calculate document lengths
    this.docLengths = this.documents.map(doc => doc.length);
    this.avgDocLength = this.docLengths.reduce((a, b) => a + b, 0) / this.docLengths.length;

    // Calculate IDF scores
    this.calculateIDF();

    logger.debug(`BM25 initialized with ${documents.length} documents`);
  }

  /**
   * Simple tokenization
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for all terms
   */
  private calculateIDF(): void {
    const N = this.documents.length;
    const termDocCount = new Map<string, number>();

    // Count documents containing each term
    this.documents.forEach(doc => {
      const uniqueTerms = new Set(doc);
      uniqueTerms.forEach(term => {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      });
    });

    // Calculate IDF for each term
    termDocCount.forEach((docCount, term) => {
      const idf = Math.log((N - docCount + 0.5) / (docCount + 0.5) + 1);
      this.idf.set(term, idf);
    });
  }

  /**
   * Calculate BM25 score for a query against a document
   */
  private calculateScore(queryTerms: string[], docIndex: number): number {
    const doc = this.documents[docIndex];
    const docLength = this.docLengths[docIndex];

    let score = 0;

    queryTerms.forEach(term => {
      // Term frequency in document
      const tf = doc.filter(t => t === term).length;

      // IDF score
      const idf = this.idf.get(term) || 0;

      // BM25 formula
      const numerator = tf * (this.k1 + 1);
      const denominator =
        tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

      score += idf * (numerator / denominator);
    });

    return score;
  }

  /**
   * Get BM25 scores for all documents given a query
   */
  getScores(query: string): number[] {
    const queryTerms = this.tokenize(query);
    return this.documents.map((_, index) => this.calculateScore(queryTerms, index));
  }
}

/**
 * Hybrid search combining semantic and BM25
 */
export class HybridSearcher {
  private vectorStore: VectorStore;
  private bm25: BM25;
  private allDocuments: string[] = [];

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
    this.bm25 = new BM25();
  }

  /**
   * Initialize BM25 with all documents
   */
  initialize(): void {
    logger.section('Initializing Hybrid Search');

    const chunks = this.vectorStore.getAllChunks();
    this.allDocuments = chunks.map(c => c.content);

    this.bm25.initialize(this.allDocuments);

    logger.success('Hybrid search initialized');
  }

  /**
   * Perform hybrid search
   * @param query - Search query
   * @param topK - Number of results to return
   * @param alpha - Weight for semantic search (0-1), (1-alpha) for BM25
   * @param tagFilter - Optional tag to filter by
   */
  async search(
    query: string,
    topK: number = 5,
    alpha: number = 0.5,
    tagFilter?: string
  ): Promise<SearchResult[]> {
    logger.debug(
      `Hybrid search: query="${query}", topK=${topK}, alpha=${alpha}, filter=${tagFilter || 'none'}`
    );

    // Get semantic search results (more results for reranking)
    const semanticResults = await this.vectorStore.semanticSearch(
      query,
      topK * 2,
      tagFilter
    );

    // Get BM25 scores
    const bm25Scores = this.bm25.getScores(query);

    // Create map of semantic scores (normalized)
    const semanticScoreMap = new Map<string, number>();
    const semanticDistances = semanticResults.map(r => r.score);
    const maxDist = semanticDistances.length > 0 ? Math.max(...semanticDistances) : 0;

    semanticResults.forEach(result => {
      const normalizedScore = maxDist > 0 ? result.score / maxDist : 0;
      semanticScoreMap.set(result.chunkId, normalizedScore);
    });

    // Combine scores, respecting tagFilter (if provided)
    const allChunks = this.vectorStore.getAllChunks();
    const combinedScores: Array<{ chunkId: string; score: number }> = [];

    // Determine candidate indices (respect tag filter)
    const candidateIndices = allChunks
      .map((chunk, idx) => ({ chunk, idx }))
      .filter(({ chunk }) => (tagFilter ? chunk.tags.includes(tagFilter) : true))
      .map(({ idx }) => idx);

    // Compute max BM25 among candidates for normalization
    const bm25Candidates = candidateIndices.map(i => bm25Scores[i] || 0);
    const maxBM25 = bm25Candidates.length > 0 ? Math.max(...bm25Candidates) : 0;

    // Build combined scores only for candidates
    candidateIndices.forEach(index => {
      const chunk = allChunks[index];
      const chunkId = `chunk_${chunk.chunkId}`;
      const semScore = semanticScoreMap.get(chunkId) || 0;
      const bm25Score = maxBM25 > 0 ? (bm25Scores[index] || 0) / maxBM25 : 0;

      const combinedScore = alpha * semScore + (1 - alpha) * bm25Score;
      combinedScores.push({ chunkId, score: combinedScore });
    });

    // Sort by combined score
    combinedScores.sort((a, b) => b.score - a.score);

    // Get top K chunks
    const topChunks = combinedScores.slice(0, topK);

    // Build search results
    const results: SearchResult[] = topChunks.map(({ chunkId, score }) => {
      const chunk = this.vectorStore.getChunkById(chunkId)!;
      return {
        chunkId,
        score,
        header: chunk.header,
        content: chunk.content,
        tags: chunk.tags
      };
    });

    logger.debug(`Hybrid search returned ${results.length} results`);
    return results;
  }
}

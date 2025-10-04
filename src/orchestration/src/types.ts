/**
 * Type definitions for the corrective RAG system
 */

export interface Chunk {
  header: string;
  content: string;
  charCount?: number;
  containsTable?: boolean;
  chunkId?: number;
  tags?: string[];
}

export interface TaggedChunk extends Chunk {
  chunkId: number;
  tags: string[];
}

export interface DocumentMetadata {
  authors: string | null;
  date: string | null;
}

export interface RelevanceGrade {
  relevant: boolean;
  score: 'high' | 'medium' | 'low';
  reason: string;
}

export interface SearchResult {
  chunkId: string;
  score: number;
  header: string;
  content: string;
  tags: string[];
  relevanceGrade?: RelevanceGrade;
}

export interface CorrectiveRAGResult {
  query: string;
  finalQuery: string;
  iterations: number;
  relevantChunks: SearchResult[];
  totalFound: number;
}

export interface ExtractionResult {
  authors: string;
  date: string;
  documentType: string;
  summary: string;
  methods: string;
  findings: string;
}

export interface QueryAnswerResult {
  query: string;
  answer: string;
  sourceChunks: SearchResult[];
}

export interface GroqConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens?: number;
}

export interface ChromaDBConfig {
  collectionName: string;
  host?: string;
  port?: number;
}

export interface ChunkingConfig {
  minChunkSize: number;
  maxChunkSize: number;
  overlap: number;
}

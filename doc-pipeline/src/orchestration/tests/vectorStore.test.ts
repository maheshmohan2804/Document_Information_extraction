/**
 * Unit tests for vector store module
 */

import { VectorStore } from '../src/vectorStore';
import { TaggedChunk } from '../src/types';

describe('VectorStore Module', () => {
  let vectorStore: VectorStore;

  const sampleChunks: TaggedChunk[] = [
    {
      header: 'Introduction',
      content: 'This paper introduces a novel approach to machine learning.',
      charCount: 62,
      containsTable: false,
      chunkId: 0,
      tags: ['<summary>']
    },
    {
      header: 'Methods',
      content: 'We used deep neural networks and reinforcement learning techniques.',
      charCount: 67,
      containsTable: false,
      chunkId: 1,
      tags: ['<research_methods>']
    },
    {
      header: 'Results',
      content: 'The model achieved 95% accuracy on the test dataset.',
      charCount: 53,
      containsTable: false,
      chunkId: 2,
      tags: ['<findings_conclusion>']
    }
  ];

  beforeEach(() => {
    vectorStore = new VectorStore();
  });

  describe('Adding chunks', () => {
    it('should add chunks successfully', async () => {
      await vectorStore.addChunks(sampleChunks);

      const allChunks = vectorStore.getAllChunks();
      expect(allChunks).toHaveLength(3);
    });

    it('should handle empty chunk array', async () => {
      await vectorStore.addChunks([]);
      expect(vectorStore.getAllChunks()).toHaveLength(0);
    });
  });

  describe('Semantic search', () => {
    beforeEach(async () => {
      await vectorStore.addChunks(sampleChunks);
    });

    it('should return top-K most similar chunks', async () => {
      const results = await vectorStore.semanticSearch('machine learning neural networks', 2);

      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    it('should filter by tags', async () => {
      const results = await vectorStore.semanticSearch('methods', 5, '<research_methods>');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.tags).toContain('<research_methods>');
      });
    });

    it('should calculate similarity scores', async () => {
      const results = await vectorStore.semanticSearch('machine learning', 3);

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle search on empty store', async () => {
      const results = await vectorStore.semanticSearch('test query', 5);

      expect(results).toHaveLength(0);
    });

    it('should handle empty search query', async () => {
      await vectorStore.addChunks(sampleChunks);
      const results = await vectorStore.semanticSearch('', 3);

      expect(results).toBeDefined();
    });
  });
});

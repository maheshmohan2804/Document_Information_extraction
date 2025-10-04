/**
 * Unit tests for hybrid search module
 */

import { HybridSearcher } from '../src/hybridSearch';
import { VectorStore } from '../src/vectorStore';
import { TaggedChunk } from '../src/types';

describe('HybridSearch Module', () => {
  let hybridSearcher: HybridSearcher;
  let vectorStore: VectorStore;

  const sampleChunks: TaggedChunk[] = [
    {
      header: 'Introduction',
      content: 'Machine learning and artificial intelligence are transforming healthcare.',
      chunkId: 0,
      tags: ['<summary>'],
      charCount: 80,
      containsTable: false
    },
    {
      header: 'Deep Learning Methods',
      content: 'We implemented convolutional neural networks for image classification.',
      chunkId: 1,
      tags: ['<research_methods>'],
      charCount: 80,
      containsTable: false
    },
    {
      header: 'Results',
      content: 'The deep learning model achieved state-of-the-art performance.',
      chunkId: 2,
      tags: ['<findings_conclusion>'],
      charCount: 70,
      containsTable: false
    },
    {
      header: 'Discussion',
      content: 'Machine learning techniques show promise for medical diagnosis.',
      chunkId: 3,
      tags: ['<findings_conclusion>'],
      charCount: 70,
      containsTable: false
    }
  ];

  beforeEach(async () => {
    vectorStore = new VectorStore();
    await vectorStore.addChunks(sampleChunks);
    hybridSearcher = new HybridSearcher(vectorStore);
    // initialize BM25 with documents
    hybridSearcher.initialize();
  });

  describe('Hybrid search functionality', () => {
    it('should combine semantic and BM25 search results', async () => {
      const results = await hybridSearcher.search('deep learning neural networks', 3, 0.5);

      expect(results).toHaveLength(3);
      expect(results[0].content).toBeDefined();
      expect(results[0].score).toBeDefined();
    });

    it('should respect topK parameter', async () => {
      const results = await hybridSearcher.search('machine learning', 2, 0.5);

      expect(results).toHaveLength(2);
    });

    it('should handle alpha = 0 (BM25 only)', async () => {
      const results = await hybridSearcher.search('deep learning', 3, 0);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle alpha = 1 (semantic only)', async () => {
      const results = await hybridSearcher.search('neural networks', 3, 1);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle alpha = 0.5 (balanced)', async () => {
      const results = await hybridSearcher.search('machine learning', 3, 0.5);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Tag filtering', () => {
  it('should filter results by single tag', async () => {
      const results = await hybridSearcher.search(
        'methods',
        5,
        0.5,
        '<research_methods>'
      );

      results.forEach(result => {
        expect(result.tags).toContain('<research_methods>');
      });
    });

  it('should filter results by multiple tags', async () => {
      const results = await hybridSearcher.search(
        'learning',
        5,
        0.5,
        '<summary>'
      );

      results.forEach(result => {
        const hasSummary = result.tags.includes('<summary>');
        const hasFindings = result.tags.includes('<findings_conclusion>');
        expect(hasSummary || hasFindings).toBe(true);
      });
    });

  it('should return empty array for non-matching tags', async () => {
      const results = await hybridSearcher.search(
        'test',
        5,
        0.5,
        '<nonexistent_tag>'
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('Score calculation', () => {
    it('should return results sorted by score (descending)', async () => {
      const results = await hybridSearcher.search('deep learning', 4, 0.5);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should have scores between 0 and 1', async () => {
      const results = await hybridSearcher.search('machine learning', 4, 0.5);

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('BM25 specifics', () => {
    it('should rank exact keyword matches highly', async () => {
      const results = await hybridSearcher.search('convolutional neural networks', 4, 0);

      // The chunk with "convolutional neural networks" should rank high
      const topResult = results[0];
      expect(topResult.content).toContain('convolutional neural networks');
    });

    it('should handle common words appropriately', async () => {
      const results = await hybridSearcher.search('the and or', 3, 0);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty query', async () => {
      const results = await hybridSearcher.search('', 3, 0.5);

      expect(results).toBeDefined();
    });

    it('should handle query with no matches', async () => {
      const results = await hybridSearcher.search('quantum physics biochemistry', 3, 0.5);

      expect(results).toBeDefined();
    });

    it('should handle special characters in query', async () => {
      const results = await hybridSearcher.search('test-query_with#special$chars', 3, 0.5);

      expect(results).toBeDefined();
    });

    it('should handle very long queries', async () => {
      const longQuery = 'machine learning '.repeat(100);
      const results = await hybridSearcher.search(longQuery, 3, 0.5);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Search with empty vector store', () => {
    it('should handle search on empty store', async () => {
      const emptyVectorStore = new VectorStore();
      const emptySearcher = new HybridSearcher(emptyVectorStore);
      emptySearcher.initialize();

      const results = await emptySearcher.search('test query', 3, 0.5);

      expect(results).toHaveLength(0);
    });
  });
});

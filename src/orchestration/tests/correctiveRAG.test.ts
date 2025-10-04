/**
 * Unit tests for corrective RAG module
 */

import { correctiveRAGRetrieval, gradeRelevance, rewriteQuery } from '../src/correctiveRAG';
import { HybridSearcher } from '../src/hybridSearch';
import { VectorStore } from '../src/vectorStore';
import { GroqConfig, TaggedChunk } from '../src/types';

// Mock Groq SDK
jest.mock('groq-sdk');
import Groq from 'groq-sdk';

describe('CorrectiveRAG Module', () => {
  let hybridSearcher: HybridSearcher;
  let vectorStore: VectorStore;

  const mockConfig: GroqConfig = {
    apiKey: 'test-api-key',
    model: 'test-model',
    temperature: 0.3
  };

  const sampleChunks: TaggedChunk[] = [
    {
      header: 'Introduction',
      content: 'This paper discusses machine learning applications in healthcare diagnostics.',
      chunkId: 0,
      tags: ['<summary>']
    },
    {
      header: 'Methods',
      content: 'We used deep neural networks trained on medical imaging data.',
      chunkId: 1,
      tags: ['<research_methods>']
    },
    {
      header: 'Results',
      content: 'The model achieved 92% accuracy in diagnosing diseases from X-rays.',
      chunkId: 2,
      tags: ['<findings_conclusion>']
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    vectorStore = new VectorStore();
    vectorStore.addChunks(sampleChunks);
    hybridSearcher = new HybridSearcher(vectorStore);
  });

  describe('Relevance grading', () => {
    it('should grade chunk as relevant', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'RELEVANCE: HIGH\nREASON: The chunk directly answers the query about machine learning in healthcare.'
          }
        }]
      });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await gradeRelevance(
        'What machine learning methods were used?',
        sampleChunks[1].content,
        mockConfig
      );

      expect(result.isRelevant).toBe(true);
      expect(result.relevance).toBe('HIGH');
    });

    it('should grade chunk as not relevant', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'RELEVANCE: REJECT\nREASON: This chunk does not answer the query.'
          }
        }]
      });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await gradeRelevance(
        'What is quantum physics?',
        sampleChunks[0].content,
        mockConfig
      );

      expect(result.isRelevant).toBe(false);
    });

    it('should handle MEDIUM relevance', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'RELEVANCE: MEDIUM\nREASON: Partially relevant.'
          }
        }]
      });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await gradeRelevance(
        'test query',
        'test content',
        mockConfig
      );

      expect(result.isRelevant).toBe(true);
      expect(result.relevance).toBe('MEDIUM');
    });
  });

  describe('Query rewriting', () => {
    it('should rewrite query with feedback', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'NEW_QUERY: What specific deep learning architectures were used for medical image analysis?'
          }
        }]
      });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const newQuery = await rewriteQuery(
        'What methods were used?',
        'Not specific enough',
        mockConfig
      );

      expect(newQuery).toContain('deep learning');
      expect(newQuery).not.toBe('What methods were used?');
    });

    it('should return different query from original', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'NEW_QUERY: How were neural networks trained for healthcare applications?'
          }
        }]
      });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const original = 'What is the training method?';
      const rewritten = await rewriteQuery(original, 'Too vague', mockConfig);

      expect(rewritten).not.toBe(original);
    });
  });

  describe('Corrective RAG retrieval', () => {
    it('should return relevant chunks on first iteration', async () => {
      const mockCreate = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANCE: HIGH\nREASON: Directly answers the query.'
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANCE: HIGH\nREASON: Very relevant.'
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANCE: MEDIUM\nREASON: Partially relevant.'
            }
          }]
        });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await correctiveRAGRetrieval(
        'What machine learning methods were used?',
        hybridSearcher,
        mockConfig,
        2,
        3
      );

      expect(result.relevantChunks.length).toBeGreaterThan(0);
      expect(result.iterations).toBe(1);
    });

    it('should rewrite query if insufficient relevant chunks', async () => {
      const mockCreate = jest.fn()
        // First iteration - reject all
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANCE: REJECT\nREASON: Not relevant.' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANCE: REJECT\nREASON: Not relevant.' } }]
        })
        // Query rewriting
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'NEW_QUERY: What deep learning architectures were implemented?'
            }
          }]
        })
        // Second iteration - accept
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANCE: HIGH\nREASON: Relevant.' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANCE: HIGH\nREASON: Relevant.' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANCE: HIGH\nREASON: Relevant.' } }]
        });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await correctiveRAGRetrieval(
        'What methods?',
        hybridSearcher,
        mockConfig,
        2,
        3
      );

      expect(result.iterations).toBe(2);
      expect(result.finalQuery).not.toBe('What methods?');
    });

    it('should stop at max iterations', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'RELEVANCE: REJECT\nREASON: Not relevant.'
          }
        }]
      });

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await correctiveRAGRetrieval(
        'unrelated query',
        hybridSearcher,
        mockConfig,
        3,
        5
      );

      expect(result.iterations).toBeLessThanOrEqual(3);
    });
  });

  describe('Error handling', () => {
    it('should handle grading API errors', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await gradeRelevance(
        'test query',
        'test content',
        mockConfig
      );

      expect(result.isRelevant).toBe(false);
    });

    it('should handle query rewriting errors', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const originalQuery = 'test query';
      const result = await rewriteQuery(originalQuery, 'feedback', mockConfig);

      expect(result).toBe(originalQuery);
    });
  });
});

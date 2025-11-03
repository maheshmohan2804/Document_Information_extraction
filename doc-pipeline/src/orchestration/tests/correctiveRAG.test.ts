/**
 * Unit tests for corrective RAG module
 */

import { correctiveRAGRetrieval, gradeChunkRelevance, rewriteQuery } from '../src/correctiveRAG';
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
            content: 'RELEVANT: yes\nSCORE: high\nREASON: The chunk directly answers the query about machine learning in healthcare.'
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

      const groqClient = new Groq({ apiKey: mockConfig.apiKey });
      const result = await gradeChunkRelevance(
        groqClient,
        sampleChunks[1].content,
        'What machine learning methods were used?',
        mockConfig
      );

      expect(result.relevant).toBe(true);
      expect(result.score).toBe('high');
    });

    it('should grade chunk as not relevant', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'RELEVANT: no\nSCORE: low\nREASON: This chunk does not answer the query.'
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

      const groqClient = new Groq({ apiKey: mockConfig.apiKey });
      const result = await gradeChunkRelevance(
        groqClient,
        sampleChunks[0].content,
        'What is quantum physics?',
        mockConfig
      );

      expect(result.relevant).toBe(false);
    });

    it('should handle MEDIUM relevance', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'RELEVANT: yes\nSCORE: medium\nREASON: Partially relevant.'
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

      const groqClient = new Groq({ apiKey: mockConfig.apiKey });
      const result = await gradeChunkRelevance(
        groqClient,
        'test content',
        'test query',
        mockConfig
      );

      expect(result.relevant).toBe(true);
      expect(result.score).toBe('medium');
    });
  });

  describe('Query rewriting', () => {
    it('should rewrite query with feedback', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              rewritten_query: 'What specific deep learning architectures were used for medical image analysis'
            })
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

      const groqClient = new Groq({ apiKey: mockConfig.apiKey });
      const newQuery = await rewriteQuery(
        groqClient,
        'What methods were used?',
        mockConfig,
        'Not specific enough'
      );

      expect(newQuery).toContain('deep learning');
      expect(newQuery).not.toBe('What methods were used?');
    });

    it('should return different query from original', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              rewritten_query: 'How were neural networks trained for healthcare applications'
            })
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

      const groqClient = new Groq({ apiKey: mockConfig.apiKey });
      const original = 'What is the training method?';
      const rewritten = await rewriteQuery(groqClient, original, mockConfig, 'Too vague');

      expect(rewritten).not.toBe(original);
    });
  });

  describe('Corrective RAG retrieval', () => {
    it('should return relevant chunks on first iteration', async () => {
      const mockCreate = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANT: yes\nSCORE: high\nREASON: Directly answers the query.'
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANT: yes\nSCORE: high\nREASON: Very relevant.'
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANT: yes\nSCORE: medium\nREASON: Partially relevant.'
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
          choices: [{ message: { content: 'RELEVANT: no\nSCORE: low\nREASON: Not relevant.' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANT: no\nSCORE: low\nREASON: Not relevant.' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANT: no\nSCORE: low\nREASON: Not relevant.' } }]
        })
        // Query rewriting
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_query: 'What deep learning architectures were implemented'
              })
            }
          }]
        })
        // Second iteration - accept
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANT: yes\nSCORE: high\nREASON: Relevant.' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANT: yes\nSCORE: high\nREASON: Relevant.' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'RELEVANT: yes\nSCORE: high\nREASON: Relevant.' } }]
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

      const groqClient = new Groq({ apiKey: mockConfig.apiKey });
      const result = await gradeChunkRelevance(
        groqClient,
        'test content',
        'test query',
        mockConfig
      );

      // On error, the function returns a fallback grade with relevant=true
      expect(result.relevant).toBe(true);
      expect(result.score).toBe('medium');
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

      const groqClient = new Groq({ apiKey: mockConfig.apiKey });
      const originalQuery = 'test query';
      const result = await rewriteQuery(groqClient, originalQuery, mockConfig, 'feedback');

      expect(result).toBe(originalQuery);
    });
  });
});

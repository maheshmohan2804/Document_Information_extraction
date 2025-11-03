/**
 * Unit tests for extraction module
 */

import { extractDocumentInformation, answerQuery } from '../src/extraction';
import { HybridSearcher } from '../src/hybridSearch';
import { VectorStore } from '../src/vectorStore';
import { GroqConfig, DocumentMetadata, TaggedChunk } from '../src/types';

// Mock Groq SDK
jest.mock('groq-sdk');
import Groq from 'groq-sdk';

describe('Extraction Module', () => {
  let hybridSearcher: HybridSearcher;
  let vectorStore: VectorStore;

  const mockConfig: GroqConfig = {
    apiKey: 'test-api-key',
    model: 'test-model',
    temperature: 0.2
  };

  const mockMetadata: DocumentMetadata = {
    authors: 'John Doe, Jane Smith',
    date: '2024'
  };

  const sampleChunks: TaggedChunk[] = [
    {
      header: 'Title',
      content: 'Machine Learning in Healthcare: A Systematic Review\nAuthors: John Doe, Jane Smith\nPublished: 2024',
      chunkId: 0,
      tags: ['<metadata>']
    },
    {
      header: 'Abstract',
      content: 'This systematic review analyzes the application of machine learning in healthcare diagnostics.',
      chunkId: 1,
      tags: ['<summary>']
    },
    {
      header: 'Methods',
      content: 'We conducted a systematic review following PRISMA guidelines. Deep learning models were trained on imaging data.',
      chunkId: 2,
      tags: ['<research_methods>']
    },
    {
      header: 'Results',
      content: 'Machine learning models achieved 95% accuracy. Results show significant improvement over traditional methods.',
      chunkId: 3,
      tags: ['<findings_conclusion>']
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    vectorStore = new VectorStore();
    vectorStore.addChunks(sampleChunks);
    hybridSearcher = new HybridSearcher(vectorStore);
  });

  describe('Document information extraction', () => {
    it('should extract all document fields from JSON response', async () => {
      // Mock relevance grading (all HIGH)
      const mockGradingResponse = {
        choices: [{
          message: {
            content: 'RELEVANT: yes\nSCORE: high\nREASON: Directly relevant.'
          }
        }]
      };

      // Mock final extraction
      const mockExtractionResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              authors: 'John Doe, Jane Smith',
              date: '2024',
              documentType: 'Systematic Review',
              summary: 'This paper reviews machine learning applications in healthcare diagnostics.',
              methods: 'Systematic review following PRISMA guidelines with deep learning models.',
              findings: 'Models achieved 95% accuracy with significant improvements.'
            })
          }
        }]
      };

      // CorrectiveRAG retrieves topK=4 chunks for each of 6 fields (authors, date, documentType, summary, methods, findings)
      // Each chunk needs grading = 4*6 = 24 grading calls + 1 final extraction call = 25 total
      const mockCreate = jest.fn();

      // Mock 24 grading responses (4 chunks x 6 fields)
      for (let i = 0; i < 24; i++) {
        mockCreate.mockResolvedValueOnce(mockGradingResponse);
      }

      // Final extraction call
      mockCreate.mockResolvedValueOnce(mockExtractionResponse);

      // Default fallback for any extra calls
      mockCreate.mockResolvedValue(mockGradingResponse);

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await extractDocumentInformation(
        hybridSearcher,
        mockMetadata,
        mockConfig
      );

      expect(result.authors).toBe('John Doe, Jane Smith');
      expect(result.date).toBe('2024');
      expect(result.documentType).toBe('Systematic Review');
      expect(result.summary).toContain('machine learning');
      expect(result.methods).toContain('PRISMA');
      expect(result.findings).toContain('95%');
    });

    it('should handle JSON with markdown code blocks', async () => {
      const mockGradingResponse = {
        choices: [{
          message: {
            content: 'RELEVANT: yes\nSCORE: high\nREASON: Relevant.'
          }
        }]
      };

      const mockExtractionResponse = {
        choices: [{
          message: {
            content: '```json\n{"authors": "Test Author", "date": "2024", "documentType": "Research Article", "summary": "Test summary", "methods": "Test methods", "findings": "Test findings"}\n```'
          }
        }]
      };

      const mockCreate = jest.fn();

      // Mock 24 grading responses (4 chunks x 6 fields)
      for (let i = 0; i < 24; i++) {
        mockCreate.mockResolvedValueOnce(mockGradingResponse);
      }

      // Final extraction call with markdown code blocks
      mockCreate.mockResolvedValueOnce(mockExtractionResponse);

      // Default fallback for any extra calls
      mockCreate.mockResolvedValue(mockGradingResponse);

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await extractDocumentInformation(
        hybridSearcher,
        mockMetadata,
        mockConfig
      );

      expect(result.authors).toBe('Test Author');
      expect(result.documentType).toBe('Research Article');
    });

    it('should use defaults when JSON parsing fails', async () => {
      const mockGradingResponse = {
        choices: [{
          message: {
            content: 'RELEVANT: yes\nSCORE: high\nREASON: Relevant.'
          }
        }]
      };

      const mockInvalidExtractionResponse = {
        choices: [{
          message: {
            content: 'This is not valid JSON {invalid}'
          }
        }]
      };

      const mockCreate = jest.fn();

      // Mock 24 grading responses (4 chunks x 6 fields)
      for (let i = 0; i < 24; i++) {
        mockCreate.mockResolvedValueOnce(mockGradingResponse);
      }

      // Final extraction call with invalid JSON
      mockCreate.mockResolvedValueOnce(mockInvalidExtractionResponse);

      // Default fallback for any extra calls
      mockCreate.mockResolvedValue(mockGradingResponse);

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await extractDocumentInformation(
        hybridSearcher,
        mockMetadata,
        mockConfig
      );

      expect(result.documentType).toBe('Not extracted');
      expect(result.summary).toBe('Not extracted');
    });
  });

  describe('Query answering', () => {
    it('should answer custom queries', async () => {
      const mockGradingResponse = {
        choices: [{
          message: {
            content: 'RELEVANT: yes\nSCORE: high\nREASON: Answers the query.'
          }
        }]
      };

      const mockAnswerResponse = {
        choices: [{
          message: {
            content: 'The accuracy was 95% on the test dataset.'
          }
        }]
      };

      const mockCreate = jest.fn();

      // answerQuery uses correctiveRAG with topK=4, so it needs 4 grading calls + 1 answer call
      for (let i = 0; i < 4; i++) {
        mockCreate.mockResolvedValueOnce(mockGradingResponse);
      }

      // Final answer generation call
      mockCreate.mockResolvedValueOnce(mockAnswerResponse);

      // Default fallback for any extra calls
      mockCreate.mockResolvedValue(mockGradingResponse);

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await answerQuery(
        'What was the accuracy?',
        hybridSearcher,
        mockConfig
      );

      expect(result.query).toBe('What was the accuracy?');
      expect(result.answer).toContain('95%');
      expect(result.sourceChunks.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      await expect(
        extractDocumentInformation(hybridSearcher, mockMetadata, mockConfig)
      ).rejects.toThrow();
    });
  });
});

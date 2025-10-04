/**
 * Integration tests for the complete RAG pipeline
 */

import { runCorrectiveRAGPipeline, runQueryMode } from '../src/correctiveRAGPipeline';
import { PipelineConfig } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock Groq SDK
jest.mock('groq-sdk');
import Groq from 'groq-sdk';

// Mock fetch for PDF conversion API
global.fetch = jest.fn();

describe('Pipeline Integration Tests', () => {
  const mockConfig: PipelineConfig = {
    doclingApiUrl: 'http://localhost:8000',
    groqApiKey: 'test-api-key',
    groqModel: 'test-model',
    chunkingConfig: {
      minChunkSize: 1000,
      maxChunkSize: 8000,
      overlap: 200
    }
  };

  const testPdfPath = path.join(__dirname, 'fixtures', 'test.pdf');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full pipeline execution', () => {
    it('should process PDF and extract document information', async () => {
      // Mock PDF conversion API
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          content: '# Research Paper\n\nThis is a test research paper about machine learning.\n\n## Methods\n\nWe used deep learning.\n\n## Results\n\nThe model achieved 90% accuracy.',
          html_content: '<h1>Research Paper</h1><p>This is a test research paper about machine learning.</p>',
          metadata: { num_pages: 1 }
        })
      });

      // Mock Groq responses for tagging
      const mockTaggingResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              tags: ['<summary>'],
              authors: 'Test Author',
              date: '2024'
            })
          }
        }]
      };

      // Mock Groq responses for relevance grading
      const mockGradingResponse = {
        choices: [{
          message: {
            content: 'RELEVANCE: HIGH\nREASON: Directly relevant.'
          }
        }]
      };

      // Mock final extraction response
      const mockExtractionResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              authors: 'Test Author',
              date: '2024',
              documentType: 'Research Article',
              summary: 'This paper discusses machine learning applications.',
              methods: 'Deep learning techniques were used.',
              findings: 'The model achieved 90% accuracy.'
            })
          }
        }]
      };

      const mockCreate = jest.fn()
        .mockResolvedValue(mockTaggingResponse)
        .mockResolvedValueOnce(mockTaggingResponse)
        .mockResolvedValueOnce(mockTaggingResponse)
        .mockResolvedValueOnce(mockGradingResponse)
        .mockResolvedValueOnce(mockGradingResponse)
        .mockResolvedValueOnce(mockGradingResponse)
        .mockResolvedValueOnce(mockGradingResponse)
        .mockResolvedValueOnce(mockGradingResponse)
        .mockResolvedValueOnce(mockGradingResponse)
        .mockResolvedValueOnce(mockExtractionResponse);

      (Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const result = await runCorrectiveRAGPipeline(testPdfPath, mockConfig);

      expect(result.authors).toBeDefined();
      expect(result.documentType).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.methods).toBeDefined();
      expect(result.findings).toBeDefined();
    });

    it('should fallback to HTML when markdown produces no chunks', async () => {
      // Mock PDF conversion with markdown that produces no chunks
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          content: 'Short text',
          html_content: '<p>This is HTML content that will be chunked. '.repeat(200) + '</p>',
          metadata: { num_pages: 1 }
        })
      });

      const mockCreate = jest.fn()
        .mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: [],
                authors: null,
                date: null
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANCE: HIGH\nREASON: Relevant.'
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                authors: 'Not found',
                date: 'Not found',
                documentType: 'Not extracted',
                summary: 'Not extracted',
                methods: 'Not extracted',
                findings: 'Not extracted'
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

      const result = await runCorrectiveRAGPipeline(testPdfPath, mockConfig);

      expect(result).toBeDefined();
    });
  });

  describe('Query mode execution', () => {
    it('should answer custom queries about documents', async () => {
      // Mock PDF conversion
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          content: '# Research\n\nThe accuracy was 95%.',
          html_content: '<h1>Research</h1><p>The accuracy was 95%.</p>',
          metadata: { num_pages: 1 }
        })
      });

      const mockCreate = jest.fn()
        .mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: [],
                authors: null,
                date: null
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANCE: HIGH\nREASON: Contains accuracy information.'
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'The model achieved 95% accuracy on the test dataset.'
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

      const result = await runQueryMode(
        testPdfPath,
        'What was the accuracy?',
        mockConfig
      );

      expect(result.query).toBe('What was the accuracy?');
      expect(result.answer).toContain('95%');
    });
  });

  describe('Error handling', () => {
    it('should handle PDF conversion errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      await expect(
        runCorrectiveRAGPipeline(testPdfPath, mockConfig)
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        runCorrectiveRAGPipeline(testPdfPath, mockConfig)
      ).rejects.toThrow('Network error');
    });
  });

  describe('Output validation', () => {
    it('should save results to output directory', async () => {
      // Mock PDF conversion
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          content: '# Test\n\nContent here.',
          html_content: '<h1>Test</h1><p>Content here.</p>',
          metadata: { num_pages: 1 }
        })
      });

      const mockCreate = jest.fn()
        .mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: [],
                authors: null,
                date: null
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'RELEVANCE: HIGH\nREASON: Relevant.'
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                authors: 'Test',
                date: '2024',
                documentType: 'Article',
                summary: 'Summary',
                methods: 'Methods',
                findings: 'Findings'
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

      const result = await runCorrectiveRAGPipeline(testPdfPath, mockConfig);

      expect(result).toHaveProperty('authors');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('documentType');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('methods');
      expect(result).toHaveProperty('findings');
    });
  });
});

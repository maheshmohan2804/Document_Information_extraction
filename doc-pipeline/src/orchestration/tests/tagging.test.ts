/**
 * Unit tests for tagging module
 */

import { tagChunksAndExtractMetadata } from '../src/tagging';
import { Chunk, GroqConfig } from '../src/types';

// Mock Groq SDK
jest.mock('groq-sdk');
import Groq from 'groq-sdk';

describe('Tagging Module', () => {
  const mockConfig: GroqConfig = {
    apiKey: 'test-api-key',
    model: 'test-model',
    temperature: 0.3
  };

  const sampleChunks: Chunk[] = [
    {
      header: 'Introduction',
      content: 'This is the introduction section of a research paper about AI.'
    },
    {
      header: 'Methods',
      content: 'We used machine learning algorithms to analyze the data.'
    },
    {
      header: 'Results',
      content: 'The findings show significant improvements in accuracy.'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tag extraction with JSON response', () => {
    it('should parse valid JSON responses', async () => {
      const mockCreate = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: ['<summary>'],
                authors: 'John Doe, Jane Smith',
                date: '2024'
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: ['<research_methods>'],
                authors: null,
                date: null
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: ['<findings_conclusion>'],
                authors: null,
                date: null
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

      const result = await tagChunksAndExtractMetadata(sampleChunks, mockConfig);

      expect(result.taggedChunks).toHaveLength(3);
      expect(result.taggedChunks[0].tags).toContain('<summary>');
      expect(result.metadata.authors).toBe('John Doe, Jane Smith');
      expect(result.metadata.date).toBe('2024');
    });

    it('should handle JSON with markdown code blocks', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: '```json\n{"tags": ["<summary>"], "authors": null, "date": null}\n```'
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

      const result = await tagChunksAndExtractMetadata([sampleChunks[0]], mockConfig);

      expect(result.taggedChunks[0].tags).toContain('<summary>');
    });
  });

  describe('Fallback parsing for non-JSON responses', () => {
    it('should parse old format responses', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'TAGS: <summary>, <metadata>\nAUTHORS: Alice Johnson\nDATE: 2023-05'
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

      const result = await tagChunksAndExtractMetadata([sampleChunks[0]], mockConfig);

      expect(result.taggedChunks[0].tags).toContain('<summary>');
      expect(result.taggedChunks[0].tags).toContain('<metadata>');
      expect(result.metadata.authors).toBe('Alice Johnson');
      expect(result.metadata.date).toBe('2023-05');
    });

    it('should ignore "None" values in fallback parsing', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'TAGS: <research_methods>\nAUTHORS: None\nDATE: None'
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

      const result = await tagChunksAndExtractMetadata([sampleChunks[0]], mockConfig);

      expect(result.metadata.authors).toBeNull();
      expect(result.metadata.date).toBeNull();
    });
  });

  describe('Metadata extraction priority', () => {
    it('should keep first found authors and date', async () => {
      const mockCreate = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: ['<metadata>'],
                authors: 'First Author',
                date: '2023'
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                tags: [],
                authors: 'Second Author',
                date: '2024'
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

      const result = await tagChunksAndExtractMetadata([sampleChunks[0], sampleChunks[1]], mockConfig);

      expect(result.metadata.authors).toBe('First Author');
      expect(result.metadata.date).toBe('2023');
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

      const result = await tagChunksAndExtractMetadata([sampleChunks[0]], mockConfig);

      expect(result.taggedChunks).toHaveLength(1);
      expect(result.taggedChunks[0].tags).toEqual([]);
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'This is not valid JSON {invalid}'
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

      const result = await tagChunksAndExtractMetadata([sampleChunks[0]], mockConfig);

      expect(result.taggedChunks).toHaveLength(1);
      expect(result.taggedChunks[0].tags).toEqual([]);
    });
  });
});

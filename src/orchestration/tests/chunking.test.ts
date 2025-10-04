/**
 * Unit tests for chunking module
 */

import { chunkDocument } from '../src/chunking';
import { ChunkingConfig } from '../src/types';

describe('Chunking Module', () => {
  const defaultConfig: ChunkingConfig = {
    minChunkSize: 1000,
    maxChunkSize: 8000,
    overlap: 200
  };

  describe('Header-based chunking', () => {
    it('should split markdown by headers', () => {
      const markdown = `# Introduction
This is the introduction section with some content.

## Methods
This is the methods section with detailed methodology.

## Results
These are the results of the study.`;

      const chunks = chunkDocument(markdown, defaultConfig);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].header).toContain('Introduction');
    });

    it('should combine small chunks', () => {
      const markdown = `# Title
Short intro.

## Section 1
Very short.

## Section 2
Also short.

## Section 3
Another short one.`;

      const chunks = chunkDocument(markdown, {
        minChunkSize: 100,
        maxChunkSize: 8000,
        overlap: 50
      });

      // Should combine sections that are too small
      expect(chunks.length).toBeLessThan(4);
    });

    it('should preserve tables as single chunks', () => {
      const markdown = `# Introduction
Some text before the table.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

More text after the table.`;

      const chunks = chunkDocument(markdown, defaultConfig);

      // Find chunk containing table
      const tableChunk = chunks.find(c => c.content.includes('Column 1'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk!.content).toContain('|');
    });

    it('should split large chunks at paragraph boundaries', () => {
      const largeContent = 'A'.repeat(10000);
      const markdown = `# Large Section
${largeContent}

This is a new paragraph after the large content.`;

      const chunks = chunkDocument(markdown, {
        minChunkSize: 1000,
        maxChunkSize: 5000,
        overlap: 200
      });

      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('Recursive chunking fallback', () => {
    it('should use recursive chunking when no headers present', () => {
      const plainText = 'This is plain text without any markdown headers. '.repeat(200);

      const chunks = chunkDocument(plainText, defaultConfig);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].header).toContain('Chunk');
    });

    it('should respect overlap in recursive chunking', () => {
      const plainText = 'Word '.repeat(3000);

      const chunks = chunkDocument(plainText, {
        minChunkSize: 1000,
        maxChunkSize: 5000,
        overlap: 500
      });

      if (chunks.length > 1) {
        // Check that consecutive chunks have overlapping content
        const firstChunkEnd = chunks[0].content.slice(-500);
        const secondChunkStart = chunks[1].content.slice(0, 500);

        expect(firstChunkEnd.slice(0, 100)).toBe(secondChunkStart.slice(0, 100));
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', () => {
      const chunks = chunkDocument('', defaultConfig);
      expect(chunks.length).toBe(0);
    });

    it('should handle very short input', () => {
      const chunks = chunkDocument('Short text', defaultConfig);
      expect(chunks.length).toBe(1);
    });

    it('should handle input with only headers', () => {
      const markdown = `# Header 1
## Header 2
### Header 3`;

      const chunks = chunkDocument(markdown, defaultConfig);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});

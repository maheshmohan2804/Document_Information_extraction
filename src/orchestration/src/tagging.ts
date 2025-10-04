/**
 * Tagging and metadata extraction module
 * Uses LLM to tag chunks with categories and extract document metadata
 */

import Groq from 'groq-sdk';
import { Chunk, TaggedChunk, DocumentMetadata, GroqConfig } from './types';
import { logger } from './logger';

/**
 * Initialize Groq client
 */
function createGroqClient(config: GroqConfig): Groq {
  return new Groq({
    apiKey: config.apiKey
  });
}

/**
 * Tag a single chunk using LLM
 * Returns tags and any metadata found
 */
async function tagSingleChunk(
  groqClient: Groq,
  chunkContent: string,
  config: GroqConfig
): Promise<{ tags: string[]; authors: string | null; date: string | null }> {
  const taggingPrompt = `Analyze this text chunk from a research paper and return ONLY a valid JSON object.

Assign tags based on content:
- <summary>: abstract, introduction, conclusion
- <research_methods>: methodology, study design, data collection
- <findings_conclusion>: results, findings, conclusions
- <metadata>: authors, dates, affiliations

Extract metadata if present:
- Authors: full names of authors if found. generally found close to the start of the document
- Date: publication date if found

Return JSON in this exact format:
{
  "tags": ["<tag1>", "<tag2>"],
  "authors": "author names or null",
  "date": "date or null"
}

IMPORTANT: Return ONLY the JSON object with no markdown formatting, no code blocks, no additional text.

Text:
${chunkContent.slice(0, 2000)}`;

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a JSON generator. Always return valid JSON objects only, no other text.' },
        { role: 'user', content: taggingPrompt }
      ],
      temperature: config.temperature,
      max_tokens: 300
    });

    const result = response.choices[0]?.message?.content || '';

    // Debug: Log raw LLM response for debugging
    logger.debug(`Raw tagging response: ${result.slice(0, 200)}`);

    // Parse JSON response
    let parsedData: any = {
      tags: [],
      authors: null,
      date: null
    };

    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedText = result.trim();
      cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
      cleanedText = cleanedText.replace(/\n?```\s*$/i, '');

      parsedData = JSON.parse(cleanedText);
    } catch (parseError) {
      logger.debug(`Failed to parse JSON from tagging. Response was: ${result}`);

      // Fallback to old parsing method
      let tags: string[] = [];
      let authors: string | null = null;
      let date: string | null = null;

      for (const line of result.split('\n')) {
        if (line.startsWith('TAGS:')) {
          const tagsStr = line.replace('TAGS:', '').trim();
          tags = tagsStr
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
        } else if (line.startsWith('AUTHORS:')) {
          const authorsStr = line.replace('AUTHORS:', '').trim();
          if (authorsStr.toLowerCase() !== 'none') {
            authors = authorsStr;
          }
        } else if (line.startsWith('DATE:')) {
          const dateStr = line.replace('DATE:', '').trim();
          if (dateStr.toLowerCase() !== 'none') {
            date = dateStr;
          }
        }
      }

      return { tags, authors, date };
    }

    return {
      tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
      authors: parsedData.authors || null,
      date: parsedData.date || null
    };
  } catch (error) {
    logger.error('Error tagging chunk', error);
    return { tags: [], authors: null, date: null };
  }
}

/**
 * Tag all chunks and extract document metadata
 */
export async function tagChunksAndExtractMetadata(
  chunks: Chunk[],
  config: GroqConfig
): Promise<{ taggedChunks: TaggedChunk[]; metadata: DocumentMetadata }> {
  logger.section('Tagging Chunks and Extracting Metadata');
  logger.info(`Processing ${chunks.length} chunks`);

  const groqClient = createGroqClient(config);
  const documentMetadata: DocumentMetadata = {
    authors: null,
    date: null
  };

  const taggedChunks: TaggedChunk[] = [];

  // First pass: Look for authors and dates in first 3 chunks with enhanced prompting
  for (let i = 0; i < Math.min(3, chunks.length); i++) {
    const chunk = chunks[i];
    logger.debug(`Processing chunk ${i + 1}/${chunks.length} (metadata extraction): ${chunk.header.slice(0, 50)}...`);

    try {
      // Use enhanced prompt for first few chunks to extract metadata
      const enhancedPrompt = `Extract metadata from this research paper chunk. Return ONLY a valid JSON object.

Look for:
- Author names (full names, usually at the beginning)
- Publication date (year, month, or full date)
- Content tags

Return JSON in this exact format:
{
  "tags": ["<summary>", "<research_methods>", "<findings_conclusion>", "<metadata>"],
  "authors": "comma-separated full names or null",
  "date": "publication date (YYYY, MM/YYYY, or DD/MM/YYYY) or null"
}

IMPORTANT: Return ONLY the JSON object with no markdown formatting, no code blocks, no additional text.

Text:
${chunk.content.slice(0, 3000)}`;

      const response = await groqClient.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a JSON generator. Always return valid JSON objects only, no other text.' },
          { role: 'user', content: enhancedPrompt }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      const result = response.choices[0]?.message?.content || '';
      logger.debug(`Raw metadata extraction response: ${result.slice(0, 200)}`);

      // Parse JSON
      try {
        let cleanedText = result.trim();
        cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
        cleanedText = cleanedText.replace(/\n?```\s*$/i, '');

        const parsedData = JSON.parse(cleanedText);

        // Store first found authors and date
        if (parsedData.authors && !documentMetadata.authors) {
          documentMetadata.authors = parsedData.authors;
          logger.info(`Found authors: ${parsedData.authors}`);
        }

        if (parsedData.date && !documentMetadata.date) {
          documentMetadata.date = parsedData.date;
          logger.info(`Found date: ${parsedData.date}`);
        }

        taggedChunks.push({
          ...chunk,
          chunkId: i,
          tags: Array.isArray(parsedData.tags) ? parsedData.tags : []
        });

        logger.debug(`Chunk ${i + 1} tagged with: ${parsedData.tags?.join(', ') || 'none'}`);
      } catch (parseError) {
        logger.debug(`JSON parse failed for chunk ${i + 1}, adding without tags`);
        taggedChunks.push({
          ...chunk,
          chunkId: i,
          tags: []
        });
      }
    } catch (error) {
      logger.error(`Error processing chunk ${i + 1}`, error);
      taggedChunks.push({
        ...chunk,
        chunkId: i,
        tags: []
      });
    }
  }

  // Second pass: Tag remaining chunks (if any) with standard tagging
  for (let i = 3; i < chunks.length; i++) {
    const chunk = chunks[i];
    logger.debug(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.header.slice(0, 50)}...`);

    try {
      const { tags, authors, date } = await tagSingleChunk(
        groqClient,
        chunk.content,
        config
      );

      // Store first found authors and date
      if (authors && !documentMetadata.authors) {
        documentMetadata.authors = authors;
        logger.info(`Found authors: ${authors}`);
      }

      if (date && !documentMetadata.date) {
        documentMetadata.date = date;
        logger.info(`Found date: ${date}`);
      }

      taggedChunks.push({
        ...chunk,
        chunkId: i,
        tags
      });

      logger.debug(`Chunk ${i + 1} tagged with: ${tags.join(', ')}`);
    } catch (error) {
      logger.error(`Error processing chunk ${i + 1}`, error);

      // Add chunk with no tags on error
      taggedChunks.push({
        ...chunk,
        chunkId: i,
        tags: []
      });
    }
  }

  // Log tag distribution
  const tagCounts: Record<string, number> = {};
  taggedChunks.forEach(chunk => {
    chunk.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  logger.success(`Tagged ${taggedChunks.length} chunks`);
  logger.info('Tag distribution:', tagCounts);
  logger.info('Document metadata:', documentMetadata);

  return { taggedChunks, metadata: documentMetadata };
}

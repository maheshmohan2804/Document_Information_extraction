/**
 * Corrective RAG module
 * Implements agentic retrieval with:
 * - Relevance grading
 * - Query rewriting
 * - Iterative retrieval with feedback
 */

import Groq from 'groq-sdk';
import { SearchResult, RelevanceGrade, CorrectiveRAGResult, GroqConfig } from './types';
import { HybridSearcher } from './hybridSearch';
import { logger } from './logger';

/**
 * Grade chunk relevance using LLM
 */
async function gradeChunkRelevance(
  groqClient: Groq,
  chunkContent: string,
  query: string,
  config: GroqConfig
): Promise<RelevanceGrade> {
  const gradingPrompt = `You are a grading expert. Is this chunk relevant to the query?

Query: ${query}

Chunk:
${chunkContent.slice(0, 1000)}

Format:
RELEVANT: yes or no
SCORE: high, medium, or low
REASON: brief explanation (1 sentence)
`;

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: gradingPrompt }],
      temperature: 0.1,
      max_tokens: 150
    });

    const result = response.choices[0]?.message?.content || '';

    let relevant = false;
    let score: 'high' | 'medium' | 'low' = 'low';
    let reason = 'Unknown';

    for (const line of result.split('\n')) {
      if (line.startsWith('RELEVANT:')) {
        relevant = line.toLowerCase().includes('yes');
      } else if (line.startsWith('SCORE:')) {
        const scoreStr = line.replace('SCORE:', '').trim().toLowerCase();
        if (scoreStr === 'high' || scoreStr === 'medium' || scoreStr === 'low') {
          score = scoreStr;
        }
      } else if (line.startsWith('REASON:')) {
        reason = line.replace('REASON:', '').trim();
      }
    }

    return { relevant, score, reason };
  } catch (error) {
    logger.error('Error grading chunk relevance', error);
    return { relevant: true, score: 'medium', reason: 'Error during grading' };
  }
}

/**
 * Rewrite query to improve retrieval
 */
async function rewriteQuery(
  groqClient: Groq,
  originalQuery: string,
  config: GroqConfig,
  feedback?: string
): Promise<string> {
  const prompt = feedback
    ? `Original query failed to retrieve relevant results.

Original: ${originalQuery}
Feedback: ${feedback}

Rewrite for better retrieval. Return only the rewritten query.`
    : `Improve this query for better retrieval:

${originalQuery}

Return only the improved query.`;

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 100
    });

    const rewrittenQuery = response.choices[0]?.message?.content?.trim() || originalQuery;
    logger.debug(`Query rewritten: "${originalQuery}" -> "${rewrittenQuery}"`);

    return rewrittenQuery;
  } catch (error) {
    logger.error('Error rewriting query', error);
    return originalQuery;
  }
}

/**
 * Corrective RAG retrieval with iterative refinement
 */
export async function correctiveRAGRetrieval(
  query: string,
  hybridSearcher: HybridSearcher,
  config: GroqConfig,
  maxIterations: number = 3,
  topK: number = 5
): Promise<CorrectiveRAGResult> {
  logger.section('Corrective RAG Retrieval');
  logger.info(`Query: "${query}"`);
  logger.info(`Max iterations: ${maxIterations}, Top-K: ${topK}`);

  const groqClient = new Groq({ apiKey: config.apiKey });

  let currentQuery = query;
  let iteration = 0;
  const allRelevantChunks: SearchResult[] = [];

  while (iteration < maxIterations) {
    iteration++;
    logger.info(`Iteration ${iteration}: Searching with query: "${currentQuery}"`);

    // Retrieve chunks using hybrid search
    const retrievedChunks = await hybridSearcher.search(currentQuery, topK, 0.5);

    if (retrievedChunks.length === 0) {
      logger.warn('No chunks retrieved. Rewriting query...');
      currentQuery = await rewriteQuery(groqClient, currentQuery, config, 'No results found');
      continue;
    }

    // Grade each chunk for relevance
    logger.info(`Grading ${retrievedChunks.length} chunks...`);
    let relevantCount = 0;

    for (const chunk of retrievedChunks) {
      const grade = await gradeChunkRelevance(
        groqClient,
        chunk.content,
        query,
        config
      );

      chunk.relevanceGrade = grade;

      if (grade.relevant && (grade.score === 'high' || grade.score === 'medium')) {
        // Avoid duplicates
        if (!allRelevantChunks.some(c => c.chunkId === chunk.chunkId)) {
          allRelevantChunks.push(chunk);
          relevantCount++;
          logger.info(
            `  [ACCEPT] ${chunk.header.slice(0, 50)}... - ${grade.score.toUpperCase()} (${grade.reason})`
          );
        }
      } else {
        logger.debug(
          `  [REJECT] ${chunk.header.slice(0, 50)}... - Rejected (${grade.reason})`
        );
      }
    }

    logger.info(`Found ${relevantCount} relevant chunks (Total: ${allRelevantChunks.length})`);

    // Check if we have enough relevant chunks
    if (allRelevantChunks.length >= 3) {
      logger.success(`SUCCESS: Found ${allRelevantChunks.length} relevant chunks!`);
      break;
    }

    // Rewrite query if not enough relevant chunks and iterations remain
    if (iteration < maxIterations) {
      const feedback = `Only found ${allRelevantChunks.length} relevant chunks. Need more specific information.`;
      logger.info('Insufficient relevant chunks. Rewriting query...');
      currentQuery = await rewriteQuery(groqClient, query, config, feedback);
    }
  }

  // If no relevant chunks found, use top hybrid search results as fallback
  if (allRelevantChunks.length === 0) {
    logger.warn('No relevant chunks found after all iterations. Using fallback...');
    const fallbackResults = await hybridSearcher.search(query, topK, 0.5);
    allRelevantChunks.push(...fallbackResults);
  }

  const result: CorrectiveRAGResult = {
    query,
    finalQuery: currentQuery,
    iterations: iteration,
    relevantChunks: allRelevantChunks,
    totalFound: allRelevantChunks.length
  };

  logger.success('Corrective RAG retrieval complete');
  logger.info(`Final query: "${currentQuery}"`);
  logger.info(`Iterations: ${iteration}, Relevant chunks: ${allRelevantChunks.length}`);

  return result;
}

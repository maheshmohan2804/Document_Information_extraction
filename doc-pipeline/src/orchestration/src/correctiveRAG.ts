
/***
 * This code implements a 1 step corrective RAG system, which iteratively:
 * Grades retrieved chunk relevance to the query using an LLM. (relevant: Yes/No), (Relevant score: high, medium, low)
 * If not relevant/"low" relevance score, iteratively rewrites the query to improve retrieval
 * If nothing is found after all iterations, uses intelligent tag-based fallback with grading
 * Reduces potential hallucination and improves relevance
 *
 * Key functions:
 * gradeChunkRelevance - Uses LLM to grade chunk relevance
 * rewriteQuery - Uses LLM to rewrite query based on feedback and rejected chunks
 * inferTagFromQuery - Infers appropriate tag filter from query content
 * correctiveRAGRetrieval - Main loop to perform iterative retrieval and refinement
 *   - Uses HybridSearcher for retrieval
 *   - Implements intelligent fallback:
 *     1. Infers relevant tag from query (e.g., <metadata>, <research_methods>)
 *     2. Searches chunks filtered by inferred tag
 *     3. Grades filtered chunks for relevance
 *     4. Falls back to general search if tag-based search fails
 *     5. ALL fallback chunks are graded before returning
 * Returns relevant chunks with relevance grades and final query
 */

import Groq from 'groq-sdk';
import { SearchResult, RelevanceGrade, CorrectiveRAGResult, GroqConfig } from './types';
import { HybridSearcher } from './hybridSearch';
import { logger } from './logger';

/**
 * Grade chunk relevance using LLM
 */
export async function gradeChunkRelevance(
  groqClient: Groq,
  chunkContent: string,
  query: string,
  config: GroqConfig
): Promise<RelevanceGrade> {
  const gradingPrompt = `You are a grading expert. Check if either of the below is true:
  - this chunk relevant to the query?
  - chunk contains same/similar keywords as the query ?
  - chunk contains information that answers the query?

Query: ${query}

Chunk:
${chunkContent}

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
      max_tokens: 200
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
 * Rewrite query to improve retrieval with context from rejected chunks
 */
export async function rewriteQuery(
  groqClient: Groq,
  originalQuery: string,
  config: GroqConfig,
  feedback?: string,
  rejectedChunks?: Array<{ header: string; reason: string }>
): Promise<string> {
  // Build context from rejected chunks to help LLM learn
  let rejectionContext = '';
  if (rejectedChunks && rejectedChunks.length > 0) {
    rejectionContext = '\n\nRejected chunks (what NOT to match):\n';
    rejectedChunks.slice(0, 3).forEach((chunk, idx) => {
      rejectionContext += `${idx + 1}. "${chunk.header.slice(0, 80)}..." - Rejected because: ${chunk.reason}\n`;
    });
  }

  const prompt = `You are a query optimization expert. Your task is to improve a search query that failed to find relevant information.

**Original Query:** "${originalQuery}"

**Problem:** ${feedback || 'Not enough relevant results found'}
${rejectionContext}

**Your Task:**
1. Analyze why the original query failed (what irrelevant chunks matched?)
2. Think about what keywords would better match the Original Query information
3. Rewrite the query to be MORE SPECIFIC and avoid matching irrelevant chunks

**Guidelines:**
- Use 3-8 keywords that are highly specific to the target content
- Avoid generic terms that match too broadly
- If looking for authors: focus on "author names affiliations byline title page"
- If looking for dates: focus on "publication date year published received accepted"

**Output Format:** Return ONLY a valid JSON object with this structure:
{
  "rewritten_query": "your improved query here"
}

Return ONLY the JSON object. NO explanation, NO markdown code blocks, NO extra text.`;

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a search query optimizer. STRICTLY Return JSON format only with structure: {"rewritten_query": "improved query"}. No markdown, no explanations.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 400,
      response_format: { type: 'json_object' }
    });

    const rawResponse = response.choices[0]?.message?.content?.trim() || '';
    logger.info(`Raw LLM response: ${rawResponse}`);

    // Check if LLM returned empty string
    if (!rawResponse || rawResponse.length === 0) {
      logger.error('⚠️  LLM returned EMPTY STRING for query rewrite! Using original query.');
      logger.debug(`Original query was: "${originalQuery}"`);
      logger.debug(`Feedback was: "${feedback}"`);
      return originalQuery;
    }

    // Parse JSON response
    try {
      const jsonResponse = JSON.parse(rawResponse);
      let rewrittenQuery = jsonResponse.rewritten_query?.trim() || '';

      // Validate the extracted query
      if (!rewrittenQuery || rewrittenQuery.length === 0) {
        logger.error('⚠️  JSON parsing succeeded but "rewritten_query" field is EMPTY! Using original query.');
        logger.debug(`Parsed JSON: ${JSON.stringify(jsonResponse)}`);
        return originalQuery;
      }

      // If rewrite is too long or verbose, use original
      if (rewrittenQuery.length > 150 || rewrittenQuery.split(' ').length > 20) {
        logger.warn(`Query rewrite too verbose (${rewrittenQuery.length} chars), using original`);
        return originalQuery;
      }

      logger.info(`🔄 Query rewritten: "${originalQuery}" → "${rewrittenQuery}"`);
      return rewrittenQuery;

    } catch (parseError) {
      logger.error('⚠️  Failed to parse JSON response! Using original query.');
      logger.debug(`Raw response was: "${rawResponse}"`);
      logger.debug(`Parse error: ${parseError}`);
      return originalQuery;
    }
  } catch (error) {
    logger.error('Error rewriting query', error);
    return originalQuery;
  }
}

/**
 * Infer the most likely tag to search based on query content
 */
function inferTagFromQuery(query: string): string | undefined {
  const queryLower = query.toLowerCase();

  // Map query patterns to tags
  if (queryLower.includes('author') || queryLower.includes('affiliation') || queryLower.includes('contributor')) {
    return '<metadata>';
  }
  if (queryLower.includes('date') || queryLower.includes('published') || queryLower.includes('publication')) {
    return '<metadata>';
  }
  if (queryLower.includes('method') || queryLower.includes('study design') || queryLower.includes('analytical approach')) {
    return '<research_methods>';
  }
  if (queryLower.includes('finding') || queryLower.includes('result') || queryLower.includes('conclusion')) {
    return '<findings_conclusion>';
  }
  if (queryLower.includes('abstract') || queryLower.includes('summary') || queryLower.includes('purpose') || queryLower.includes('overview')) {
    return '<summary>';
  }

  // No specific tag inferred
  return undefined;
}

/**
 * Corrective RAG retrieval with iterative refinement
 * break condition: reaches max iterations or finds 3 or more relevant chunks
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

      // Collect rejected chunks from this iteration to help LLM learn from mistakes
      const rejectedChunks = retrievedChunks
        .filter(chunk => !chunk.relevanceGrade?.relevant || chunk.relevanceGrade?.score === 'low')
        .map(chunk => ({
          header: chunk.header,
          reason: chunk.relevanceGrade?.reason || 'Not relevant'
        }));

      logger.info('Insufficient relevant chunks. Rewriting query...');
      logger.debug(`Passing ${rejectedChunks.length} rejected chunks to query rewriter`);
      currentQuery = await rewriteQuery(groqClient, query, config, feedback, rejectedChunks);
    }
  }

  // If no relevant chunks found, use intelligent tag-based fallback with grading
  if (allRelevantChunks.length === 0) {
    logger.warn('No relevant chunks found after all iterations. Using intelligent fallback...');

    // Infer the best tag to search based on query
    const inferredTag = inferTagFromQuery(query);

    if (inferredTag) {
      logger.info(`Inferred tag: ${inferredTag} - Searching with tag filter...`);
      const tagFilteredResults = await hybridSearcher.search(query, 8, 0.6, inferredTag);

      if (tagFilteredResults.length > 0) {
        logger.info(`Found ${tagFilteredResults.length} chunks with tag ${inferredTag}. Grading them...`);

        // Grade the tag-filtered results
        for (const chunk of tagFilteredResults) {
          const grade = await gradeChunkRelevance(
            groqClient,
            chunk.content,
            query,
            config
          );

          chunk.relevanceGrade = grade;

          // Accept all graded chunks (even low scores) since this is fallback
          // But prioritize better scores
          allRelevantChunks.push(chunk);
          logger.info(
            `  [FALLBACK] ${chunk.header.slice(0, 50)}... - ${grade.score.toUpperCase()} (${grade.reason})`
          );
        }

        // Sort by relevance score (high > medium > low)
        allRelevantChunks.sort((a, b) => {
          const scoreOrder = { high: 3, medium: 2, low: 1 };
          const aScore = a.relevanceGrade ? scoreOrder[a.relevanceGrade.score] : 0;
          const bScore = b.relevanceGrade ? scoreOrder[b.relevanceGrade.score] : 0;
          return bScore - aScore;
        });

        logger.info(`Fallback with tag filter returned ${allRelevantChunks.length} graded chunks`);
      } else {
        logger.warn(`No chunks found with tag ${inferredTag}. Using general hybrid search...`);
      }
    }

    // If tag-based fallback didn't work or no tag was inferred, use general search with grading
    if (allRelevantChunks.length === 0) {
      logger.info('Using general hybrid search fallback with grading...');
      const fallbackResults = await hybridSearcher.search(query, topK, 0.5);

      // Grade the fallback results
      for (const chunk of fallbackResults) {
        const grade = await gradeChunkRelevance(
          groqClient,
          chunk.content,
          query,
          config
        );

        chunk.relevanceGrade = grade;
        allRelevantChunks.push(chunk);
        logger.info(
          `  [FALLBACK] ${chunk.header.slice(0, 50)}... - ${grade.score.toUpperCase()} (${grade.reason})`
        );
      }

      logger.info(`General fallback returned ${allRelevantChunks.length} graded chunks`);
    }
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

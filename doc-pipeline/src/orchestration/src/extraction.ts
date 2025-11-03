/**
 * Document extraction module
 * Uses corrective RAG to extract structured information from documents
 * Prompy to extract infomration
 */

/**
 * Predifined queries to extract Authors, Date, Document Type, Summary, Methods, Findings
 * Run the corrective RAG retrieval for each query
 * Concatenate chunks for each section
 * Main prompt to extract all sections in one go
 * Clean and Extract JSON
 * Return structured ExtractionResult
 */

import Groq from 'groq-sdk';
import { ExtractionResult, DocumentMetadata, GroqConfig, CorrectiveRAGResult, QueryAnswerResult } from './types';
import { HybridSearcher } from './hybridSearch';
import { correctiveRAGRetrieval } from './correctiveRAG';
import { logger } from './logger';

/**
 * Extract complete document information using corrective RAG
 */
export async function extractDocumentInformation(
  hybridSearcher: HybridSearcher,
  metadata: DocumentMetadata,
  config: GroqConfig
): Promise<ExtractionResult> {
  logger.section('Complete Document Extraction');

  // Define extraction queries for each section
  const queries = {
    authors: 'author names affiliations byline contributors. Right below the title, near the title or authors contributions section',
    date: 'publication date published received accepted submission year',
    documentType: 'What type of document is this? Examples: case study, clinical trial, review article, meta-analysis, research article, technical workshop paper, etc.',
    summary: 'What is the abstract, main purpose, and overview of this paper?',
    methods: 'What research methods, study design, and analytical approaches were used?',
    findings: 'What are the key findings, discussions, overall results, results and inference from tables and graphs and conclusions?'
  };

  // Retrieve relevant chunks for each section using corrective RAG
  const extractionResults: Record<string, CorrectiveRAGResult> = {};

  for (const [section, query] of Object.entries(queries)) {
    logger.info(`Extracting: ${section.toUpperCase()}`);

    const result = await correctiveRAGRetrieval(
      query,
      hybridSearcher,
      config,
      2, // max iterations (reduced from 2 for speed)
      4  // top K (reduced from 5 for speed)
    );

    extractionResults[section] = result;
  }

  /**
   * Clean text for author extraction - remove invalid special characters
   * Keep only: () {} [] / % @ ' , . and alphanumeric
   */
  function cleanAuthorText(text: string): string {
    // Replace invalid special characters with space
    // Keep: alphanumeric, spaces, and valid specials: ( ) { } [ ] / % @ ' , .
    return text
      .replace(/[^\w\s()\{\}\[\]/%@',.]/g, ' ')  // Remove invalid chars
      .replace(/\s+/g, ' ')  // Collapse multiple spaces
      .trim();
  }

  // Compile contexts from relevant chunks
  // Log which chunks are being used for authors
  logger.separator('=');
  logger.info('AUTHORS EXTRACTION - Retrieved Chunks:');
  extractionResults.authors.relevantChunks.slice(0, 5).forEach((chunk, idx) => {
    logger.info(`Chunk ${idx + 1}:`);
    logger.info(`  Header: ${chunk.header}`);
    logger.info(`  ChunkId: ${chunk.chunkId}`);
    logger.info(`  Score: ${chunk.score}`);
    logger.info(`  Content preview: ${chunk.content.slice(0, 200)}...`);
  });
  logger.separator('=');

  const authorsContext = extractionResults.authors.relevantChunks
    .slice(0, 5)
    .map(c => cleanAuthorText(c.content))  // Clean author chunks
    .join('\n\n---\n\n');

  const dateContext = extractionResults.date.relevantChunks
    .slice(0, 5)
    .map(c => c.content.slice(0, 4000))
    .join('\n\n---\n\n');

  const documentTypeContext = extractionResults.documentType.relevantChunks
    .slice(0, 5)
    .map(c => c.content.slice(0, 3500))
    .join('\n\n---\n\n');

  const summaryContext = extractionResults.summary.relevantChunks
    .slice(0, 5)
    .map(c => c.content.slice(0, 4500))
    .join('\n\n---\n\n');

  const methodsContext = extractionResults.methods.relevantChunks
    .slice(0, 5)
    .map(c => c.content.slice(0, 4500))
    .join('\n\n---\n\n');

  const findingsContext = extractionResults.findings.relevantChunks
    .slice(0, 5)
    .map(c => c.content.slice(0, 4500))
    .join('\n\n---\n\n');

  // Generate final extraction using LLM
  logger.info('Generating final extraction with LLM...');
  logger.info(`Authors context : ${authorsContext} `);

  const finalPrompt = `You are a research paper analyst. Extract information from the provided context chunks and return ONLY a valid JSON object.

Based on the context provided, extract the information and respond with a JSON object in this exact format:

{
  "authors": "comma-separated list of ALL author names (full names, e.g., 'John Smith, Jane Doe, Bob Lee')",
  "date": "publication date (year, month/year, or full date)",
  "documentType": "type of document (e.g., meta-analysis, research article, case study, etc.)",
  "summary": "2-3 sentence summary of the document's main purpose and overview",
  "methods": "Give 3 bullet points for study design, 1 bullet point explaining the data sources,  1 for sample size , and  3 explaining the unique analytical methods. Give a 2 sentence brief sumamary of the research methods",
  "findings": "Add 3 bullet points explaining the hard facts from results, 2 bullet points inferring from graphs and 2 bullet points outlining major important findings from the tables, 1 bullet points about statistical significance, 3 sentence conclusion and implications of the paper"
}

IMPORTANT:
- Return ONLY the JSON object with no markdown formatting, no code blocks, no additional text
- For authors: Extract ALL author names (first and last names). Look for patterns like "Author Name¹", "Name, Name, and Name", author bylines near the title
- For date: Look for "Published:", "Received:", "Accepted:", or standalone dates in YYYY format

---
AUTHORS CONTEXT: Extract ALL FULL NAMES of the authors. Authors typically appear near the title, in a byline, or in "Authors' contributions" sections. Include ALL authors, not just the first one.
${authorsContext.slice(0, 6000)}

---
DATE CONTEXT: Extract the PUBLICATION DATE. Look for: "Published:", "Received:", "Accepted:", or standalone years. Prefer the published/accepted date.
${dateContext.slice(0, 6000)}

---
DOCUMENT TYPE CONTEXT:
${documentTypeContext.slice(0, 5000)}

---
SUMMARY CONTEXT:
${summaryContext}

---
METHODS CONTEXT:
${methodsContext}

---
FINDINGS CONTEXT:
${findingsContext}
`;

  const groqClient = new Groq({ apiKey: config.apiKey });

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.3,
      max_tokens: 4500
    });

    const extractionText = response.choices[0]?.message?.content || '';

    // Debug: Log the raw LLM response
    logger.debug('Raw LLM extraction response:');
    logger.debug(extractionText);

    // Parse JSON response
    let parsedData: any = {
      documentType: 'Not extracted',
      date: 'Not found',
      summary: 'Not extracted',
      methods: 'Not extracted',
      findings: 'Not extracted'
    };

    try {
      // Clean the response - remove markdown code blocks and think tags if present
      let cleanedText = extractionText.trim();

      // Remove <think> tags (chain-of-thought reasoning from some LLMs)
      cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/think>\s*/gi, '');

      // Remove ```json or ``` markers if present
      cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
      cleanedText = cleanedText.replace(/\n?```\s*$/i, '');

      // Try parsing first
      let parseAttempt = 1;
      try {
        parsedData = JSON.parse(cleanedText.trim());
        logger.success('Successfully parsed JSON response');
      } catch (firstError: any) {
        // If parsing fails due to control characters, try to fix the JSON
        if (firstError.message?.includes('control character') || firstError.message?.includes('Bad control')) {
          logger.warn('JSON contains invalid control characters, attempting to sanitize...');
          parseAttempt = 2;

          // Sanitize: escape control characters within JSON string values
          // This preserves the JSON structure while fixing literal newlines/tabs/etc
          let sanitized = cleanedText;

          // Replace literal newlines in string values with escaped \n
          sanitized = sanitized.replace(/: "([^"]*?)"/gs, (match, content) => {
            const escaped = content
              .replace(/\n/g, '\\n')   // Escape newlines
              .replace(/\r/g, '\\r')   // Escape carriage returns
              .replace(/\t/g, '\\t');  // Escape tabs
            return `: "${escaped}"`;
          });

          parsedData = JSON.parse(sanitized.trim());
          logger.success('Successfully parsed JSON after sanitizing control characters');
        } else {
          throw firstError;
        }
      }
    } catch (parseError) {
      logger.error('Failed to parse JSON response, using defaults', parseError);
      logger.debug('Attempted to parse:', extractionText);
    }

    const extraction: ExtractionResult = {
      authors: parsedData.authors || 'Not found',
      date: parsedData.date || 'Not found',
      documentType: parsedData.documentType || 'Not extracted',
      summary: parsedData.summary || 'Not extracted',
      methods: parsedData.methods || 'Not extracted',
      findings: parsedData.findings || 'Not extracted'
    };

    // Log statistics
    logger.success('Document extraction complete');
    logger.info('Extraction statistics:', {
      authorsChunks: extractionResults.authors.relevantChunks.length,
      dateChunks: extractionResults.date.relevantChunks.length,
      documentTypeChunks: extractionResults.documentType.relevantChunks.length,
      summaryChunks: extractionResults.summary.relevantChunks.length,
      methodsChunks: extractionResults.methods.relevantChunks.length,
      findingsChunks: extractionResults.findings.relevantChunks.length,
      totalIterations:
        extractionResults.authors.iterations +
        extractionResults.date.iterations +
        extractionResults.documentType.iterations +
        extractionResults.summary.iterations +
        extractionResults.methods.iterations +
        extractionResults.findings.iterations
    });

    return extraction;
  } catch (error) {
    logger.error('Error during final extraction', error);
    throw error;
  }
}

/**
 * Answer a custom query using corrective RAG
 */
export async function answerQuery(
  query: string,
  hybridSearcher: HybridSearcher,
  config: GroqConfig
): Promise<QueryAnswerResult> {
  logger.section('Answering Custom Query');
  logger.info(`Query: "${query}"`);

  // Use corrective RAG to find relevant chunks
  const ragResult = await correctiveRAGRetrieval(
    query,
    hybridSearcher,
    config,
    2, // max iterations
    4  // top K
  );

  // Compile context from relevant chunks
  const context = ragResult.relevantChunks
    .slice(0, 5)
    .map(c => c.content.slice(0, 2000))
    .join('\n\n---\n\n');

  // Generate answer using LLM
  logger.info('Generating answer with LLM...');

  const answerPrompt = `Based on the following document sections, answer the user's question comprehensively and accurately.

Question: ${query}

Relevant Document Sections:
${context}

Provide a detailed answer based only on the information in the document sections above. If the information is not sufficient to answer the question, state that clearly.`;

  const groqClient = new Groq({ apiKey: config.apiKey });

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: answerPrompt }],
      temperature: 0.2,
      max_tokens: 1000
    });

    const answer = response.choices[0]?.message?.content || 'Unable to generate answer';

    logger.success('Answer generated successfully');
    logger.info(`Answer length: ${answer.length} characters`);
    logger.info(`Source chunks used: ${ragResult.relevantChunks.length}`);

    return {
      query,
      answer,
      sourceChunks: ragResult.relevantChunks
    };
  } catch (error) {
    logger.error('Error generating answer', error);
    throw error;
  }
}

/**
 * Document extraction module
 * Uses corrective RAG to extract structured information from documents
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
    authors: 'Who are the authors of this paper? List all author names.',
    date: 'What is the publication date or year of this paper?',
    documentType: 'What type of document is this? Examples: case study, clinical trial, review article, meta-analysis, research article, technical workshop paper, etc.',
    summary: 'What is the abstract, main purpose, and overview of this paper?',
    methods: 'What research methods, study design, and analytical approaches were used?',
    findings: 'What are the key findings, discussions, overall results, results from tables and graphs and conclusions?'
  };

  // Retrieve relevant chunks for each section using corrective RAG
  const extractionResults: Record<string, CorrectiveRAGResult> = {};

  for (const [section, query] of Object.entries(queries)) {
    logger.info(`Extracting: ${section.toUpperCase()}`);

    const result = await correctiveRAGRetrieval(
      query,
      hybridSearcher,
      config,
      2, // max iterations
      5  // top K
    );

    extractionResults[section] = result;
  }

  // Compile contexts from relevant chunks
  const authorsContext = extractionResults.authors.relevantChunks
    .slice(0, 3)
    .map(c => c.content.slice(0, 2000))
    .join('\n\n---\n\n');

  const dateContext = extractionResults.date.relevantChunks
    .slice(0, 3)
    .map(c => c.content.slice(0, 2000))
    .join('\n\n---\n\n');

  const documentTypeContext = extractionResults.documentType.relevantChunks
    .slice(0, 3)
    .map(c => c.content.slice(0, 2500))
    .join('\n\n---\n\n');

  const summaryContext = extractionResults.summary.relevantChunks
    .slice(0, 3)
    .map(c => c.content.slice(0, 2500))
    .join('\n\n---\n\n');

  const methodsContext = extractionResults.methods.relevantChunks
    .slice(0, 3)
    .map(c => c.content.slice(0, 2500))
    .join('\n\n---\n\n');

  const findingsContext = extractionResults.findings.relevantChunks
    .slice(0, 3)
    .map(c => c.content.slice(0, 2500))
    .join('\n\n---\n\n');

  // Generate final extraction using LLM
  logger.info('Generating final extraction with LLM...');

  const finalPrompt = `You are a research paper analyst. Extract information from the provided context chunks and return ONLY a valid JSON object.

Based on the context provided, extract the information and respond with a JSON object in this exact format:

{
  "authors": "comma-separated list of author names",
  "date": "publication date (year, month/year, or full date)",
  "documentType": "type of document (e.g., meta-analysis, research article, case study, etc.)",
  "summary": "2-3 sentence summary of the document's main purpose and overview",
  "methods": "Give bullet points for study design, data sources, sample size, and analytical methods and give a brief sumamary of the research methods",
  "findings": "Add bullet points and summarise primary outcomes, infernce from graphs and tables, statistical significance, conclusions, and implications"
}

IMPORTANT: Return ONLY the JSON object with no markdown formatting, no code blocks, no additional text.

---
AUTHORS CONTEXT:
${authorsContext.slice(0, 2000)}

---
DATE CONTEXT:
${dateContext.slice(0, 2000)}

---
DOCUMENT TYPE CONTEXT:
${documentTypeContext.slice(0, 3000)}

---
SUMMARY CONTEXT:
${summaryContext.slice(0, 4000)}

---
METHODS CONTEXT:
${methodsContext.slice(0, 4000)}

---
FINDINGS CONTEXT:
${findingsContext.slice(0, 3000)}
`;

  const groqClient = new Groq({ apiKey: config.apiKey });

  try {
    const response = await groqClient.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.2,
      max_tokens: 1500
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
      // Clean the response - remove markdown code blocks if present
      let cleanedText = extractionText.trim();

      // Remove ```json or ``` markers if present
      cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
      cleanedText = cleanedText.replace(/\n?```\s*$/i, '');

      // Parse JSON
      parsedData = JSON.parse(cleanedText);
      logger.success('Successfully parsed JSON response');
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
    3, // max iterations
    5  // top K
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

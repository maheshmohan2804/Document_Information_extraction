/**
 * Main corrective RAG pipeline
 * Orchestrates the complete document extraction flow:
 * 1. PDF to Markdown conversion (via Docling API)
 * 2. Advanced chunking
 * 3. LLM tagging and metadata extraction
 * 4. Vector storage
 * 5. Hybrid search initialization
 * 6. Corrective RAG extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { chunkDocument } from './chunking';
import { tagChunksAndExtractMetadata } from './tagging';
import { VectorStore } from './vectorStore';
import { HybridSearcher } from './hybridSearch';
import { extractDocumentInformation, answerQuery } from './extraction';
import { logger } from './logger';
import { ExtractionResult, GroqConfig, ChunkingConfig, QueryAnswerResult } from './types';

interface PipelineConfig {
  doclingApiUrl: string;
  groqApiKey: string;
  groqModel: string;
  groqTemperature: number;
  groqMaxTokens: number;
  chunkingConfig: ChunkingConfig;
}

interface DoclingResponse {
  status: string;
  filename: string;
  content: string;
  html_content: string;
  metadata: {
    num_pages: number | null;
  };
}

/**
 * Convert PDF to Markdown/HTML using Docling API
 * Returns both markdown and HTML content
 */
async function convertPDFToContent(
  filePath: string,
  apiUrl: string
): Promise<{ markdown: string; html: string }> {
  logger.section('PDF Conversion');
  logger.info(`File: ${path.basename(filePath)}`);
  logger.info(`API URL: ${apiUrl}`);

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Validate file is PDF
  if (!filePath.toLowerCase().endsWith('.pdf')) {
    throw new Error('File must be a PDF');
  }

  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // Send request
    logger.info('Uploading and processing PDF...');
    const response = await axios.post<DoclingResponse>(
      `${apiUrl}/process-pdf/`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const markdownContent = response.data.content;
    const htmlContent = response.data.html_content;

    logger.success(`Conversion complete.`);
    logger.info(`Markdown length: ${markdownContent.length} chars`);
    logger.info(`HTML length: ${htmlContent.length} chars`);

    if (response.data.metadata.num_pages) {
      logger.info(`Pages: ${response.data.metadata.num_pages}`);
    }

    return { markdown: markdownContent, html: htmlContent };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Docling API error:', error.response?.data || error.message);
    } else {
      logger.error('Unexpected error during PDF conversion', error);
    }
    throw error;
  }
}

/**
 * Run the complete corrective RAG pipeline
 */
export async function runCorrectiveRAGPipeline(
  pdfFilePath: string,
  config: PipelineConfig
): Promise<ExtractionResult> {
  logger.section('Corrective RAG Pipeline Started');
  logger.info('Configuration:', {
    pdfFile: path.basename(pdfFilePath),
    doclingApi: config.doclingApiUrl,
    groqModel: config.groqModel,
    chunking: config.chunkingConfig
  });

  const startTime = Date.now();

  try {
    // Step 1: Convert PDF to Markdown and HTML
    const { markdown, html } = await convertPDFToContent(
      pdfFilePath,
      config.doclingApiUrl
    );

    // Step 2: Chunk the document (try markdown first, fallback to HTML)
    let chunks = chunkDocument(markdown, config.chunkingConfig);

    if (chunks.length === 1) {
      logger.warn('No chunks from markdown. Trying HTML...');
      chunks = chunkDocument(html, config.chunkingConfig);

      if (chunks.length === 0) {
        throw new Error('Failed to create chunks from both markdown and HTML formats');
      }
      logger.success(`Created ${chunks.length} chunks from HTML`);
    } else {
      logger.success(`Created ${chunks.length} chunks from markdown`);
    }

    // Step 3: Tag chunks and extract metadata
    const groqConfig: GroqConfig = {
      apiKey: config.groqApiKey,
      model: config.groqModel,
      temperature: config.groqTemperature,
      maxTokens: config.groqMaxTokens
    };

    const { taggedChunks, metadata } = await tagChunksAndExtractMetadata(
      chunks,
      groqConfig
    );

    // Step 4: Create vector store and add chunks
    const vectorStore = new VectorStore();
    await vectorStore.addChunks(taggedChunks);

    // Step 5: Initialize hybrid searcher
    const hybridSearcher = new HybridSearcher(vectorStore);
    hybridSearcher.initialize();

    // Step 6: Extract document information using corrective RAG
    const extraction = await extractDocumentInformation(
      hybridSearcher,
      metadata,
      groqConfig
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    logger.section('Pipeline Complete');
    logger.success(`Total execution time: ${duration}s`);
    logger.info('Extraction result:', extraction);

    return extraction;
  } catch (error) {
    logger.error('Pipeline failed', error);
    throw error;
  } finally {
    // Close logger
    logger.info(`Log file: ${logger.getLogFilePath()}`);
  }
}

/**
 * Run query mode - answer a custom question about the document
 */
export async function runQueryMode(
  pdfFilePath: string,
  query: string,
  config: PipelineConfig
): Promise<QueryAnswerResult> {
  logger.section('Corrective RAG Query Mode');
  logger.info('Configuration:', {
    pdfFile: path.basename(pdfFilePath),
    query,
    doclingApi: config.doclingApiUrl,
    groqModel: config.groqModel
  });

  const startTime = Date.now();

  try {
    // Step 1: Convert PDF to Markdown and HTML
    const { markdown, html } = await convertPDFToContent(
      pdfFilePath,
      config.doclingApiUrl
    );

    // Step 2: Chunk the document (try markdown first, fallback to HTML)
    let chunks = chunkDocument(markdown, config.chunkingConfig);

    if (chunks.length === 1) {
      logger.warn('No chunks from markdown. Trying HTML...');
      chunks = chunkDocument(html, config.chunkingConfig);

      if (chunks.length === 0) {
        throw new Error('Failed to create chunks from both markdown and HTML formats');
      }
      logger.success(`Created ${chunks.length} chunks from HTML`);
    } else {
      logger.success(`Created ${chunks.length} chunks from markdown`);
    }

    // Step 3: Tag chunks and extract metadata
    const groqConfig: GroqConfig = {
      apiKey: config.groqApiKey,
      model: config.groqModel,
      temperature: config.groqTemperature,
      maxTokens: config.groqMaxTokens
    };

    const { taggedChunks } = await tagChunksAndExtractMetadata(
      chunks,
      groqConfig
    );

    // Step 4: Create vector store and add chunks
    const vectorStore = new VectorStore();
    await vectorStore.addChunks(taggedChunks);

    // Step 5: Initialize hybrid searcher
    const hybridSearcher = new HybridSearcher(vectorStore);
    hybridSearcher.initialize();

    // Step 6: Answer the query
    const queryResult = await answerQuery(query, hybridSearcher, groqConfig);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    logger.section('Query Mode Complete');
    logger.success(`Total execution time: ${duration}s`);

    return queryResult;
  } catch (error) {
    logger.error('Query mode failed', error);
    throw error;
  } finally {
    logger.info(`Log file: ${logger.getLogFilePath()}`);
  }
}

/**
 * Save extraction results to a JSON file
 */
export function saveExtractionResults(
  extraction: ExtractionResult,
  outputPath: string
): void {
  logger.info(`Saving extraction results to: ${outputPath}`);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(extraction, null, 2),
    'utf-8'
  );

  logger.success(`Results saved to: ${outputPath}`);
}

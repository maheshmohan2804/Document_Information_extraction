/**
 * Main entry point for the corrective RAG CLI
 * Provides command-line interface for running the pipeline
 */

import * as path from 'path';
import { runCorrectiveRAGPipeline, runQueryMode, saveExtractionResults } from './correctiveRAGPipeline';
import { logger } from './logger';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  pdfPath: string;
  doclingApiUrl: string;
  groqApiKey: string;
  outputPath?: string;
  query?: string;
} {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Corrective RAG Document Extraction Pipeline

Usage:
  npm start -- <pdf-file-path> [options]

Arguments:
  <pdf-file-path>           Path to the PDF file to process (required)

Options:
  --api-url <url>           Docling API base URL (default: http://localhost:8000)
  --groq-key <key>          Groq API key (required, or set GROQ_API_KEY env var)
  --output <path>           Output JSON file path (optional)
  --query <question>        Ask a custom question about the document (optional)
  --help, -h                Show this help message

Environment Variables:
  GROQ_API_KEY              Groq API key (alternative to --groq-key)

Modes:
  1. Full Extraction (default): Extracts document type, summary, methods, findings
  2. Query Mode (--query): Answers a specific question about the document

Examples:
  # Full extraction
  npm start -- document.pdf --groq-key sk-xxx
  npm start -- document.pdf --groq-key sk-xxx --output results.json

  # Query mode
  npm start -- document.pdf --groq-key sk-xxx --query "What are the main findings?"
  npm start -- document.pdf --groq-key sk-xxx --query "What methodology was used?"

  # Custom API URL
  npm start -- "C:\\path\\to\\document.pdf" --api-url http://192.168.1.100:8000
`);
    process.exit(0);
  }

  const pdfPath = args[0];
  let doclingApiUrl = 'http://localhost:8000';
  let groqApiKey = process.env.GROQ_API_KEY || '';
  let outputPath: string | undefined;
  let query: string | undefined;

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--api-url':
        doclingApiUrl = value;
        break;
      case '--groq-key':
        groqApiKey = value;
        break;
      case '--output':
        outputPath = value;
        break;
      case '--query':
        query = value;
        break;
    }
  }

  if (!groqApiKey) {
    console.error('Error: Groq API key is required. Provide via --groq-key or GROQ_API_KEY env var.');
    process.exit(1);
  }

  return { pdfPath, doclingApiUrl, groqApiKey, outputPath, query };
}

/**
 * Main function
 */
async function main() {
  const { pdfPath, doclingApiUrl, groqApiKey, outputPath, query } = parseArgs();

  const pipelineConfig = {
    doclingApiUrl,
    groqApiKey,
    groqModel: 'moonshotai/kimi-k2-instruct-0905',
    groqTemperature: 0.1,
    groqMaxTokens: 1500,
    chunkingConfig: {
      minChunkSize: 1000,
      maxChunkSize: 8000,
      overlap: 200
    }
  };

  try {
    if (query) {
      // Query mode - answer a specific question
      logger.info('Running in QUERY MODE');
      const queryResult = await runQueryMode(pdfPath, query, pipelineConfig);

      // Display results
      logger.separator('=');
      logger.info('QUERY RESULTS');
      logger.separator('=');
      console.log('\nQuestion:', queryResult.query);
      console.log('\nAnswer:');
      console.log(queryResult.answer);
      console.log('\nSource Chunks:', queryResult.sourceChunks.length);
      logger.separator('=');

      // Save to file if output path provided
      if (outputPath) {
        const fs = require('fs');
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(queryResult, null, 2), 'utf-8');
        logger.success(`Results saved to: ${outputPath}`);
      }
    } else {
      // Full extraction mode
      logger.info('Running in FULL EXTRACTION MODE');
      const extraction = await runCorrectiveRAGPipeline(pdfPath, pipelineConfig);

      // Display results
      logger.separator('=');
      logger.info('EXTRACTION RESULTS');
      logger.separator('=');
      console.log('\nAuthors:', extraction.authors);
      console.log('Date:', extraction.date);
      console.log('Document Type:', extraction.documentType);
      console.log('\nSummary:');
      console.log(extraction.summary);
      console.log('\nResearch Methods:');
      console.log(extraction.methods);
      console.log('\nKey Findings and Conclusions:');
      console.log(extraction.findings);
      logger.separator('=');

      // Save to file if output path provided
      if (outputPath) {
        saveExtractionResults(extraction, outputPath);
      } else {
        // Save to default location
        const defaultOutput = path.join(
          process.cwd(),
          'output',
          `extraction-${Date.now()}.json`
        );
        saveExtractionResults(extraction, defaultOutput);
      }
    }

    logger.success('Pipeline completed successfully');
  } catch (error) {
    logger.error('Pipeline failed', error);
    process.exit(1);
  }
}

// Run main
main();

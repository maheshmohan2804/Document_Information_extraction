# Corrective RAG Document Extraction Pipeline

A TypeScript implementation of an agentic corrective RAG (Retrieval-Augmented Generation) system for intelligent PDF document extraction.

## Features

- **PDF to Markdown Conversion**: Uses Docling API to convert PDFs to structured markdown
- **Advanced Chunking**: Intelligent document chunking with:
  - Markdown header-based splitting
  - Table detection and preservation
  - Min/max size constraints with combining/splitting
  - Recursive chunking with overlap for unstructured content
- **LLM Tagging**: Automatic categorization of chunks (summary, methods, findings)
- **Metadata Extraction**: Automatic extraction of authors and dates
- **Hybrid Search**: Combines semantic similarity and BM25 keyword search
- **Corrective RAG**: Agentic retrieval with:
  - Relevance grading of retrieved chunks
  - Query rewriting based on feedback
  - Iterative retrieval until sufficient relevant chunks found
- **Comprehensive Logging**: All processes logged to both console and file

## Architecture

```
PDF File
   |
   v
[Docling API] --> Markdown
   |
   v
[Chunking] --> Chunks (with table preservation)
   |
   v
[LLM Tagging] --> Tagged Chunks + Metadata
   |
   v
[Vector Store] --> Embeddings
   |
   v
[Hybrid Search] --> Semantic + BM25
   |
   v
[Corrective RAG] --> Iterative Retrieval
   |
   v
[Extraction] --> Structured Output
```

## Installation

```bash
cd src/orchestration
npm install
```

## Usage

### Prerequisites

1. **Docling API** must be running (default: `http://localhost:8000`)
2. **Groq API Key** required (get from https://console.groq.com)

### Basic Usage

```bash
# Set your Groq API key
export GROQ_API_KEY="your-api-key-here"

# Run the pipeline
npm start -- path/to/document.pdf
```

### Advanced Usage

```bash
# Specify custom Docling API URL
npm start -- document.pdf --api-url http://192.168.1.100:8000

# Specify Groq API key via command line
npm start -- document.pdf --groq-key sk-xxx

# Save output to specific file
npm start -- document.pdf --groq-key sk-xxx --output results.json
```

### Help

```bash
npm start -- --help
```

## Output

The pipeline produces:

1. **Console output**: Real-time progress and results
2. **Log file**: Detailed logs in `./logs/rag-TIMESTAMP.log`
3. **JSON output**: Extraction results in `./output/extraction-TIMESTAMP.json`

### Extraction Format

```json
{
  "authors": "Author names",
  "date": "Publication date",
  "summary": "2-3 sentence summary of the paper",
  "methods": "Summary of research methods used",
  "findings": "Key findings and conclusions"
}
```

## Configuration

Default configuration in `main.ts`:

```typescript
{
  groqModel: 'llama-3.3-70b-versatile',
  groqTemperature: 0.1,
  groqMaxTokens: 1500,
  chunkingConfig: {
    minChunkSize: 1000,
    maxChunkSize: 8000,
    overlap: 200
  }
}
```

## Module Structure

- **types.ts**: TypeScript type definitions
- **logger.ts**: Logging system (console + file)
- **chunking.ts**: Advanced document chunking
- **tagging.ts**: LLM-based chunk tagging and metadata extraction
- **vectorStore.ts**: In-memory vector storage
- **hybridSearch.ts**: Hybrid search (Semantic + BM25)
- **correctiveRAG.ts**: Agentic corrective retrieval
- **extraction.ts**: Document information extraction
- **correctiveRAGPipeline.ts**: Main pipeline orchestration
- **main.ts**: CLI entry point

## Development

### Build

```bash
npm run build
```

### Run Built Version

```bash
node dist/main.js document.pdf --groq-key sk-xxx
```

## Logging

Logs are automatically created in the `./logs` directory with timestamps. Each log file contains:

- Timestamps for all operations
- Log levels (DEBUG, INFO, WARN, ERROR, SUCCESS)
- Detailed process information
- Error stack traces

## Notes

- The vector store implementation is simplified (in-memory, simple embeddings)
- For production, consider integrating with ChromaDB or Pinecone for proper vector storage
- The system requires an active internet connection for Groq API calls
- Processing time depends on document size and API response times

## License

MIT

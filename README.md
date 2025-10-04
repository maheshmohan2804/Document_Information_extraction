# PDF Data Extraction and Insights Generation Pipeline

## Overview
The PDF Data Extraction Pipeline processes and extracts meaningful information from scientific PDF documents using Docling and Groq's vision models. The pipeline features advanced document parsing, Agentic Retrieval Augmented Generation (RAG), and automated quality evaluation.

### Key Features
- **Advanced PDF Processing**: Leverages Docling with Groq vision models for accurate text and image extraction
- **Multi-format Output**: Generates both Markdown and HTML outputs
- **Modular Architecture**: Easy to customize and extend for various use cases
- **Hybrid Chunking**: Combines recursive chunking with heading and paragraph-based segmentation
- **Hybrid Retrieval**: Utilizes keyword-based (BM25) + semantic (embedding) retrieval
- **Reranking**: Employs BM25 reranker for superior result ranking
- **Agentic Corrective RAG**: Leverages AI reasoning to grade chunks and improve retrieval through query rewriting when needed

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Document Processing                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Docling Parser       │
                    │  • PDF → Markdown     │
                    │  • PDF → HTML         │
                    │  • Image Extraction   │
                    └───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Chunking Layer                           │
│  ┌──────────────────────┐    ┌────────────────────────────┐    │
│  │ Recursive Chunking   │    │ Heading/Paragraph Based    │    │
│  │ • Hierarchical       │ +  │ • Structure-aware          │    │
│  │ • Overlap            │    │ • Semantic boundaries      │    │
│  └──────────────────────┘    └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Hybrid Retrieval                           │
│  ┌──────────────────┐         ┌──────────────────────────┐     │
│  │ Keyword Search   │         │  Semantic Search         │     │
│  │ (BM25)           │    +    │  (Embeddings)            │     │
│  └──────────────────┘         └──────────────────────────┘     │
│                                │                                │
│                                ▼                                │
│                      ┌──────────────────┐                       │
│                      │  BM25 Reranker   │                       │
│                      └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Agentic Corrective RAG                         │
│                                                                 │
│  1. Grade retrieved chunks (relevant/not relevant)              │
│  2. If insufficient relevant chunks → Query rewrite             │
│  3. Re-retrieve with improved query                             │
│  4. Generate final output with graded context                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Structured Output   │
                    │   • Authors           │
                    │   • Date              │
                    │   • Document Type     │
                    │   • Summary           │
                    │   • Methods           │
                    │   • Findings          │
                    │   • Full Markdown     │
                    └───────────────────────┘
```

## Experimentation Process

I conducted systematic experiments to identify the optimal approach:

1. **PDF Parsing Libraries**: Evaluated multiple frameworks and identified **Docling** as the best-performing library for scientific document parsing
2. **Simple RAG**: Initial implementation with basic retrieval - results did not meet quality expectations
3. **Corrective RAG**: Implemented agentic RAG with chunk grading and query rewriting - achieved best results with minimal hallucinations

## Results & Evaluation

I evaluated **9 out of 15** research papers using an automated LLM-as-a-Judge approach. The primary design focus was minimizing hallucinations and maintaining factual accuracy.

### Evaluation Methodology
Used ChatGPT with Reasoning to assess:
- ✓ Date extraction accuracy
- ✓ Author name completeness and correctness
- ✓ Document type classification accuracy
- ✓ Research methodology summarization accuracy and grounding
- ✓ Summary factual accuracy and grounding
- ✓ Findings/conclusions accuracy and grounding
- ✓ Overall quality score (0-100)

### Performance Metrics
- **96** - Average overall quality rating
- **100%** - Dates correctly extracted
- **100%** - Methodologies factually correct
- **98.4%** - Summaries factually accurate
- **97.2%** - Findings accurately extracted
- **77.7%** - Author names perfectly extracted
- **77.7%** - Document types correctly identified

*Detailed evaluation results available in the `doc-pipeline/Evaluation/` folder*

## Design Trade-offs

### Prioritized Quality over Speed
- **Higher LLM calls**: Each chunk is individually graded for relevance
- **Increased latency**: Multiple retrieval iterations when needed
- **Benefit**: Significantly reduced hallucinations and improved factual grounding

## Time Investment

| Phase | Duration |
|-------|----------|
| Problem analysis & system design | 2 hours |
| Python prototype & performance testing | 3 hours |
| Full framework build & integration | 6 hours |
| Testing & documentation | 3 hours |
| **Total** | **14 hours** |

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Python 3.8+**
3. **npm** (Node Package Manager)
4. **API Keys**:
   - Groq API key (for document processing)
   - OpenRouter API key (optional, for evaluation)

## Installation

### Backend Setup (Python/FastAPI)

1. Navigate to the document parsing directory:
   ```bash
   cd doc-pipeline/src/documentParsing
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set environment variables:
   ```bash
   # Linux/Mac
   export GROQ_API_KEY="your-groq-api-key"

   # Windows PowerShell
   $env:GROQ_API_KEY="your-groq-api-key"

   # Windows CMD
   set GROQ_API_KEY=your-groq-api-key
   ```

4. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup (TypeScript CLI)

1. Navigate to the orchestration directory:
   ```bash
   cd doc-pipeline/src/orchestration
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Basic Usage

Process a single PDF:
```bash
npm start -- "<path-to-pdf>" --groq-key "<your-groq-key>"
```

### Save Outputs

Save both Markdown and HTML outputs:
```bash
npm start -- "<path-to-pdf>" --groq-key "<your-groq-key>" --save-outputs --output-dir "./outputs"
```

### Advanced Options

```bash
npm start -- "<path-to-pdf>" \
  --api-url "http://localhost:8000" \
  --model "meta-llama/llama-4-scout-17b-16e-instruct" \
  --temperature 0.1 \
  --top-p 0.10 \
  --max-tokens 350 \
  --format markdown \
  --save-outputs \
  --output-dir "./outputs"
```

### CLI Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `<path-to-pdf>` | Absolute path to PDF file | Required |
| `--groq-key` | Groq API key | Required |
| `--api-url` | API base URL | `http://localhost:8000` |
| `--model` | Groq model to use | `meta-llama/llama-4-scout-17b-16e-instruct` |
| `--temperature` | Sampling temperature | `0.1` |
| `--top-p` | Top-p sampling parameter | `0.10` |
| `--max-tokens` | Max completion tokens | `350` |
| `--format` | Output format (`markdown` or `json`) | `markdown` |
| `--save-outputs` | Save markdown and HTML files | `false` |
| `--output-dir` | Directory for saved outputs | `./outputs` |

## Project Structure

```
.
├── doc-pipeline/
│   ├── Data/                    # Sample PDF documents
│   ├── Evaluation/              # Evaluation results & metrics
│   ├── Notebooks/               # Jupyter notebooks for experimentation
│   ├── reference-docs/          # Reference documents for testing
│   ├── src/
│   │   ├── documentParsing/     # FastAPI backend (Docling integration)
│   │   └── orchestration/       # TypeScript CLI (RAG pipeline)
│   └── testing_reference/       # Automated quality evaluation framework
└── README.md
```

## Automated Quality Evaluation

An automated evaluation framework using Gemini 2.5 Pro is available in `doc-pipeline/testing_reference/`.

See the [evaluation README](doc-pipeline/testing_reference/README.md) for setup and usage instructions.

---

## Challenge Context: Theo AI Take-Home Challenges

This project was completed as part of the **Theo AI Document AI Pipeline Challenge**.

### Evaluation Questions

#### 1. Why did you choose this particular challenge?
I chose the Document AI Pipeline challenge because it allowed me to showcase my expertise in:
- AI/ML system design and implementation
- Building production-grade data pipelines
- Working with modern LLM frameworks and RAG architectures
- Balancing quality vs. performance trade-offs

#### 2. How long did it take to complete the challenge?
**Total: 14 hours** (breakdown in Time Investment section above)

#### 3. What was the hardest part of the challenge and how did you tackle it?
**Hallucination Reduction**: The biggest challenge was minimizing hallucinations while maintaining comprehensive extraction.

**Solution**: Implemented Corrective RAG with:
- Chunk-level relevance grading
- Iterative query rewriting
- BM25 + semantic hybrid retrieval
- Strict grounding checks during generation

#### 4. Where did you have the most fun and why?
Designing and implementing the **Agentic Corrective RAG** system. It was fascinating to see how AI agents could grade their own retrieval quality and autonomously improve through query rewriting - essentially creating a self-correcting system.

#### 5. What would you have done if you had more time?
- **Multi-document analysis**: Cross-reference findings across multiple papers
- **Citation extraction**: Build citation graphs and relationships
- **Advanced caching**: Implement vector store caching for faster re-processing
- **Streaming outputs**: Real-time streaming of extraction results
- **Enhanced evaluation**: Expand automated evaluation to all 15 documents
- **UI Dashboard**: Web interface for batch processing and visualization

---

## License
MIT License

## Contact
For questions or issues, please open a GitHub issue or contact the repository owner.
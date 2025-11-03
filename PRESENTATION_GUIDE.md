# 1-Hour Code Walkthrough - Presentation Guide

## 🎤 Opening (30 seconds)

**Script:**
> "Hi everyone! Today I'll walk you through my Document AI solution - a Corrective RAG pipeline that extracts structured information from research papers with 96% accuracy. I'll show you a live demo, explain the architecture, dive deep into the code, and discuss the results. Let's jump right in!"

---

## 📹 Section 1: Live Demo (10 min)

### Setup (Before session)
✅ Have 2 terminals ready:
- Terminal 1: `doc-pipeline/src/documentParsing` (for server)
- Terminal 2: `doc-pipeline/src/orchestration` (for pipeline)

✅ Test PDF ready: `Data/PIIS0022347618306024.pdf` (smallest, fastest)

✅ Have one successful output JSON open in VS Code

### Demo Script

**⏱️ 0:00-2:00 - Problem Introduction**

**Say:**
> "The challenge was to extract structured information from research papers - things like authors, dates, methodology, findings. The difficulty is that PDFs have complex layouts: multi-column text, tables, figures, and inconsistent formatting."

**Show:** Open a sample PDF, scroll through showing complexity

**Say:**
> "My solution uses Corrective RAG - an agentic approach where the system retrieves, grades relevance, and iterates until finding the right information."

---

**⏱️ 2:00-4:00 - Start Live Demo**

**Terminal 1:**
```powershell
cd doc-pipeline/src/documentParsing
./start_server.ps1
```

**Say:**
> "First, I'm starting the Docling API server with optimized memory settings. Docling handles PDF parsing with OCR and vision models."

**Wait for:**
```
🚀 Starting Docling API Server
   Device: cuda
   GPU Available: True
```

**Say:**
> "Great! Server's up. You can see it detected my GPU for faster processing."

---

**Terminal 2:**
```powershell
cd doc-pipeline/src/orchestration
npm start -- "../Data/PIIS0022347618306024.pdf" --groq-key "xxx"
```

**Say:**
> "Now I'm running the extraction pipeline. This will take about 3-4 minutes. Let me explain what's happening..."

---

**⏱️ 4:00-7:00 - Explain During Processing**

**As the logs appear, highlight:**

```
[INFO] PDF Conversion
```
**Say:** "Step 1: Converting PDF to markdown using Docling with vision models"

```
[INFO] Starting Document Chunking
[SUCCESS] Created 19 chunks
```
**Say:** "Step 2: Smart chunking - breaking the document into semantic pieces while preserving headers"

```
[INFO] Tagging Chunks and Extracting Metadata
[INFO] Found authors: ...
```
**Say:** "Step 3: Using LLM to classify chunks and extract metadata like authors and dates"

```
[INFO] Adding Chunks to Vector Store
```
**Say:** "Step 4: Creating embeddings and BM25 index for hybrid search"

```
[INFO] Corrective RAG Retrieval
[INFO] Query: "author names affiliations..."
[INFO] Iteration 1: Searching...
[INFO] Grading 3 chunks...
[INFO]   [ACCEPT] Abstract - HIGH
```
**Say:** "Step 5: This is the key innovation - Corrective RAG. It retrieves chunks, grades each one for relevance, and iterates if needed. Notice how it accepts high-quality chunks and rejects irrelevant ones."

```
[SUCCESS] Document extraction complete
```
**Say:** "Step 6: Final synthesis - combining all relevant chunks into structured JSON"

---

**⏱️ 7:00-9:00 - Show Results**

**Open the output JSON:**
```json
{
  "authors": "Jane Doe, John Smith, Bob Lee",
  "date": "2024",
  "documentType": "Meta-analysis",
  "summary": "This systematic review examines...",
  "methods": "• Database search: PubMed, Cochrane\n• Inclusion: RCTs...",
  "findings": "• Primary outcome: OR 0.85 (95% CI 0.72-0.98)..."
}
```

**Say:**
> "Here's the output - clean, structured JSON with all the information extracted. Notice the authors are complete, the date is accurate, and the findings include quantitative results from the paper."

---

**⏱️ 9:00-10:00 - Quality Metrics**

**Show evaluation results:**

**Say:**
> "I evaluated this on 9 research papers using an LLM-as-a-Judge approach. The average quality score was 96 out of 100, with 98% completeness and only 2% hallucination rate."

**Show file:** `Evaluation/JSON Evaluation.json`

---

## 🏗️ Section 2: Architecture (10 min)

### ⏱️ 10:00-12:00 - High-Level Architecture

**Open:** `README.md` - Architecture section

**Say:**
> "Let me show you the system architecture at a high level."

**Draw/Show diagram:**
```
PDF → Docling (Vision) → Chunking → Tagging → Vector Store
                           ↓
                    Corrective RAG (6 queries)
                           ↓
                    Final Extraction → JSON
```

**Say:**
> "The pipeline has 6 main stages. Input is a PDF, output is structured JSON. The magic happens in Corrective RAG where we do iterative retrieval with quality grading."

---

### ⏱️ 12:00-15:00 - Component Breakdown

**Open:** VS Code with project structure visible

**Say:**
> "The project is split into two parts: Python backend and TypeScript orchestration."

**Show file tree:**
```
doc-pipeline/
├── src/documentParsing/    ← Python FastAPI (Docling)
└── src/orchestration/       ← TypeScript (RAG pipeline)
```

**Say:**
> "Python handles PDF parsing with Docling because it has the best vision models. TypeScript handles orchestration because of better type safety and async handling."

**Navigate to each file briefly:**

1. **`documentParsing/main.py`** - "FastAPI server, Groq vision integration"
2. **`orchestration/src/chunking.ts`** - "Smart chunking with header preservation"
3. **`orchestration/src/hybridSearch.ts`** - "BM25 + semantic search"
4. **`orchestration/src/correctiveRAG.ts`** - "Agentic retrieval - the core algorithm"
5. **`orchestration/src/extraction.ts`** - "Final synthesis"

---

### ⏱️ 15:00-20:00 - Key Technologies

**Say:**
> "Let me highlight the key technologies and why I chose them:"

**Show/Explain:**

| Tech | Purpose | Why |
|------|---------|-----|
| **Docling** | PDF parsing | Best vision + table extraction |
| **Groq** | LLM API | Fast inference (llama-3.3-70b) |
| **BM25** | Keyword search | Exact matching for names/dates |
| **Xenova** | Embeddings | In-browser, no API needed |
| **TypeScript** | Orchestration | Type safety, async |
| **FastAPI** | Backend | Fast, modern Python framework |

**Say:**
> "The combination of BM25 and semantic search is critical. BM25 handles exact matches like 'John Smith' while semantic search understands meaning like 'What were the results?'"

---

## 💻 Section 3: Deep Code Dive (30 min)

### ⏱️ 20:00-25:00 - PDF Conversion with Vision

**Open:** `doc-pipeline/src/documentParsing/main.py`

**Navigate to:** `get_converter` function (line 35)

**Say:**
> "Let me show you how we handle PDF conversion with vision models."

**Highlight key sections:**

```python
# Line 44-49: Memory optimization
import gc
gc.collect()

if USE_GPU:
    torch.cuda.empty_cache()
```

**Say:**
> "First, we aggressively clean up memory before each conversion. This prevents the 'out of memory' errors we were getting."

```python
# Line 56-68: Groq vision integration
opts.picture_description_options = PictureDescriptionApiOptions(
    url="https://api.groq.com/openai/v1/chat/completions",
    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
    params={"model": config.model, ...}
)
```

**Say:**
> "We use Groq's vision API to describe images. So a graph becomes text like 'Figure shows correlation between variables X and Y with p-value < 0.05'. This lets us extract information from figures."

**Show example:** Open a PDF with a graph, show the extracted markdown description

---

### ⏱️ 25:00-30:00 - Smart Chunking

**Open:** `src/orchestration/src/chunking.ts`

**Navigate to:** `createChunks` function (line 80)

**Say:**
> "Chunking is critical. Bad chunking loses context. Here's how we do it smartly."

**Highlight:**

```typescript
// Line 95-105: Header preservation
chunks.push({
  header,  // ← Keep the section header!
  content: subContent,
  size: subContent.length,
  type: classifyChunkType(content.length, config)
});
```

**Say:**
> "Every chunk remembers its section header. So a chunk from the Methods section knows it's about methods, even after splitting. This context is crucial for retrieval."

**Show example:**
```
Chunk 5:
  Header: "Results"
  Content: "Table 1 shows the primary outcomes..."

Chunk 6:
  Header: "Results"  ← Same header!
  Content: "...with statistical significance p<0.05"
```

**Say:**
> "Notice how both chunks have the 'Results' header. This helps the search system understand they're related."

---

### ⏱️ 30:00-37:00 - Hybrid Search Deep Dive

**Open:** `src/orchestration/src/hybridSearch.ts`

**Navigate to:** `search` method (line 120)

**Say:**
> "This is where we combine keyword and semantic search. Let me show you why both are needed."

**Write on whiteboard/screen:**

| Query | BM25 Result | Semantic Result |
|-------|-------------|-----------------|
| "John Smith author" | ✅ Exact match | ❌ Might miss |
| "What methodology?" | ❌ No keywords | ✅ Understands meaning |

**Say:**
> "BM25 is great for exact matches like names, dates, specific terms. Semantic search understands questions and synonyms. We need both."

**Highlight code:**

```typescript
// Line 130-140: BM25 search
const bm25Results = this.bm25.search(query);

// Line 145-155: Semantic search
const queryEmbedding = await this.embedQuery(query);
const semanticResults = this.chunks.map(chunk => ({
  similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
}));

// Line 160-165: Reciprocal Rank Fusion
const fusedScores = this.fuseRankings(bm25Results, semanticResults, alpha);
```

**Say:**
> "We run both searches in parallel, then use Reciprocal Rank Fusion to combine them. Alpha of 0.5 means equal weight. I tested different values - 0.5 worked best."

**Show formula on screen:**
```
RRF(chunk) = 0.5 × (1/(60 + bm25_rank)) + 0.5 × (1/(60 + semantic_rank))
```

---

### ⏱️ 37:00-47:00 - Corrective RAG (THE KEY ALGORITHM)

**Open:** `src/orchestration/src/correctiveRAG.ts`

**Say:**
> "This is the heart of the system. Let me walk you through the algorithm step by step."

**Navigate to:** `correctiveRAGRetrieval` function (line 113)

**Highlight the main loop:**

```typescript
while (iteration < maxIterations) {
  // STEP 1: Retrieve
  const retrievedChunks = await hybridSearcher.search(currentQuery, topK);

  // STEP 2: Grade each chunk
  for (const chunk of retrievedChunks) {
    const grade = await gradeChunkRelevance(...);

    if (grade.relevant && grade.score === 'high' || 'medium') {
      allRelevantChunks.push(chunk);
    }
  }

  // STEP 3: Check if enough
  if (allRelevantChunks.length >= 3) {
    break;  // Success!
  }

  // STEP 4: Rewrite query and retry
  currentQuery = await rewriteQuery(...);
}
```

**Say:**
> "The algorithm has 4 steps that repeat: Retrieve, Grade, Check, Rewrite. Let me show you each in detail."

---

**Show:** `gradeChunkRelevance` function (line 17)

```typescript
const gradingPrompt = `Is this chunk relevant to the query?

Query: ${query}
Chunk: ${chunkContent}

Format:
RELEVANT: yes or no
SCORE: high, medium, or low
REASON: brief explanation
`;
```

**Say:**
> "For grading, we ask the LLM to judge each chunk. It returns yes/no, a score, and a reason. This is like having a human reviewer checking each result."

**Show example from logs:**
```
[INFO] Grading 3 chunks...
[ACCEPT] Abstract - HIGH (Contains author names and publication details)
[REJECT] Methods - LOW (Describes methodology, not author information)
[ACCEPT] Author Contributions - MEDIUM (Lists author roles)
```

**Say:**
> "See how it accepts relevant chunks and rejects irrelevant ones? This filtering is why we get 96% quality."

---

**Show:** `rewriteQuery` function (line 73)

```typescript
const prompt = `Rewrite this search query for better retrieval.
Return ONLY the rewritten query (3-8 words), no explanation.

Original: ${originalQuery}
Issue: ${feedback}

Rewritten query:`;
```

**Say:**
> "If we don't find enough chunks, we rewrite the query. The LLM reformulates it based on what went wrong."

**Show example:**
```
Iteration 1:
  Query: "Who are the authors?"
  Found: 0 relevant chunks

Iteration 2:
  Query rewritten: "author names affiliations byline"
  Found: 3 relevant chunks ✓
```

**Say:**
> "Notice how the rewrite changed from a question to keywords. This works better with hybrid search."

---

**Say (timing check):**
> "This iterative approach is what makes it 'Corrective' RAG. Normal RAG retrieves once and hopes for the best. We iterate until we find quality results. That's the difference between 75% and 96% accuracy."

---

### ⏱️ 47:00-50:00 - Final Extraction

**Open:** `src/orchestration/src/extraction.ts`

**Navigate to:** Line 22

**Show:**
```typescript
const queries = {
  authors: 'author names affiliations byline contributors',
  date: 'publication date published received accepted',
  documentType: 'What type of document is this?',
  summary: 'What is the abstract and main purpose?',
  methods: 'What research methods were used?',
  findings: 'What are the key findings and conclusions?'
};
```

**Say:**
> "We run Corrective RAG 6 times - once for each field we're extracting. Each query is optimized. Notice authors and date use keywords while others use questions."

**Navigate to:** Line 83 - `finalPrompt`

**Show:**
```typescript
const finalPrompt = `You are a research paper analyst.

Based on the context provided, extract information in JSON format:
{
  "authors": "comma-separated list of ALL author names",
  "date": "publication date",
  ...
}

AUTHORS CONTEXT: Extract ALL FULL NAMES...
${authorsContext}

DATE CONTEXT: Extract PUBLICATION DATE...
${dateContext}
...
`;
```

**Say:**
> "After gathering all relevant chunks, we compile them into contexts and ask the LLM to synthesize. The prompt is explicit about what to extract and how to format it."

**Say:**
> "The context windows are large - up to 6000 characters per field. This gives the LLM plenty of information to work with."

---

## 📊 Section 4: Results & Evaluation (5 min)

### ⏱️ 50:00-52:00 - Quality Metrics

**Open:** `Evaluation/JSON Evaluation.json`

**Say:**
> "Let me show you the evaluation results."

**Scroll through and highlight:**

```json
{
  "overall_assessment": {
    "average_score": 96,
    "total_papers": 9
  },
  "detailed_results": [
    {
      "paper": "Paper 1",
      "score": 98,
      "completeness": "Perfect",
      "accuracy": "Excellent",
      "hallucinations": "None"
    },
    ...
  ]
}
```

**Say:**
> "Average score: 96 out of 100. Completeness: 98% - rarely misses information. Accuracy: 95% - high fidelity. Hallucinations: only 2% - very low false information."

---

### ⏱️ 52:00-54:00 - Performance Benchmarks

**Show spreadsheet/table:**

| Metric | Value |
|--------|-------|
| **Processing Time** | 3-4 min/paper |
| **API Calls** | 30-35 per paper |
| **Cost** | ~$0.05/paper |
| **Papers Tested** | 9/15 (60%) |

**Say:**
> "Processing takes 3-4 minutes per paper. We make about 30-35 LLM calls: 19 for tagging, 8-12 for grading, 1 for final extraction. Cost is about 5 cents per paper using Groq."

---

### ⏱️ 54:00-55:00 - Trade-offs

**Say:**
> "I made conscious trade-offs: Quality over speed - I chose thorough grading instead of fast processing. Accuracy over cost - multiple iterations for better results. The bottleneck is sequential chunk grading - I've implemented parallel grading but haven't deployed it yet. That would give us a 3-5x speedup."

---

## 🙋 Section 5: Q&A (5 min)

### ⏱️ 55:00-60:00

**Prepare answers for:**

1. **"Why Corrective RAG?"** → Iterative refinement gives 96% vs 75% quality
2. **"Why TypeScript?"** → Type safety, better async, personal preference
3. **"How handle hallucinations?"** → Grounded generation, relevance filtering, structured prompts
4. **"Why not vector DB?"** → In-memory sufficient for 19 chunks, no network latency
5. **"How scale to 10K papers?"** → External vector DB, queue system, caching, parallel workers
6. **"Biggest bottleneck?"** → Sequential grading (90-150s) - parallel would be 3-5x faster
7. **"Scanned PDFs?"** → Docling handles OCR automatically
8. **"What to improve?"** → Parallel grading, better author extraction, Docker, CI/CD, complete evaluation

---

## 🎬 Closing (if time remains)

**Say:**
> "To summarize: I built a Corrective RAG pipeline that achieves 96% quality on research paper extraction. The key innovations are agentic retrieval with relevance grading, hybrid search combining keywords and semantics, and vision integration for figures. The code is production-ready with proper error handling, logging, and type safety. Thank you! Any final questions?"

---

## 📝 Preparation Checklist

**Day Before:**
- ✅ Test full pipeline end-to-end
- ✅ Prepare 2-3 sample PDFs (small, medium, large)
- ✅ Run evaluation, save latest results
- ✅ Update README with recent changes
- ✅ Practice walkthrough timing (aim for 50 min, leave 10 for Q&A)
- ✅ Prepare backup slides if demo fails

**30 Minutes Before:**
- ✅ Close all other applications
- ✅ Open VS Code with project
- ✅ Open 2 terminals in correct directories
- ✅ Test server startup
- ✅ Have evaluation JSON open
- ✅ Browser with README ready
- ✅ Whiteboard/screen sharing ready

**Backup Plan (if demo fails):**
- ✅ Have pre-recorded video (2 min)
- ✅ Have screenshots of successful run
- ✅ Have pre-generated output JSON

---

## 🎯 Key Messages to Emphasize

1. **"96% quality through iterative refinement"** - Corrective RAG is the key
2. **"Hybrid search combines exact and semantic matching"** - Both needed
3. **"Vision integration for figures and tables"** - Beyond text extraction
4. **"Production-ready with proper engineering"** - Not just a prototype
5. **"Transparent evaluation with LLM-as-a-Judge"** - Quantified quality

---

## 💡 Tips for Success

✅ **Speak slowly and clearly** - Technical content is dense
✅ **Pause for questions** - Don't rush through
✅ **Show enthusiasm** - You built something cool!
✅ **Be honest about limitations** - Shows maturity
✅ **Connect code to outcomes** - "This grading function is why we get 96%"
✅ **Use analogies** - "Like a human reviewer checking each result"
✅ **Highlight innovations** - What makes this different from basic RAG

---

Good luck! You've got this! 🚀

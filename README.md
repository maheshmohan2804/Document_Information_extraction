# PDF Data Extraction and Insights Generation

## Overview
The PDF Data Extraction Pipeline is designed to process and extract meaningful information from PDF documents using Docling and Groq's vision models. The pipeline includes advanced features for document parsing, Agentic Retrieval Augmented Generation and quality evaluation.

### Key Features
- **Advanced PDF Processing**: Uses Docling with Groq vision models for accurate text and image extraction
- **Multi-format Output**: Generates both Markdown and HTML outputs
- **Modular Architecture**: Easy to customize and extend for various use cases
- **Hybrid Chunking**: Leverages recursive chunking and heading and paragraph based chunking
- **Hybrid Retrieval** Uses keyword + semantic retrieval
- **Rerank** Uses BM25 reranker for superior reranking
- **Agentic Corrective RAG**: Leverages Agentic AI reasoning to grade chunks and if no chunk is suitable, we leverage 'query rewrite' to make improve retrieval

### Architecture Overview
Docling Document Parsing and Markdown/HTML data processing -> Chunking -> Hybrid Retrieval ->Agentic Corrective RAG -> output
           |_____________|

## Experimentation
I first experimented with different frameworks to identify the best parsing library, I identified Docling to be the best.
Experimented with Simple RAG system which did not meet expectations
Experimented with Corrective RAG which gave the best results

## Results
I evaluated 9/15 given research papers and document the results. My main focus on the design of this solution was to keep halucinations to a minimum and maintain faithfulness.
To evaluate this framework, I leveraged the principle of LLM as a Judge. I used a ChatGPT with Reasoning to answer these questions:
- Check if the extracted dates match what's in the ground truth document
- Verify author names are correct and complete compared to the ground truth
- Assess if the document type correctly describes the ground truth document
- Evaluate if research methodologies are accurately summarized and all facts are grounded in the document
- Check if the summary is factually accurate and grounded in the actual document content
- Check if findings/conclusions are accurate and grounded in the document
- Provide an overall quality score from 0-100
- Give a brief reason for the overall score
This pipeline is able to generate high quality and factually grounded text.(see evaluation folder for Excel)
 - **96** Average overall rating for text generation
 - **100%** of dates were extracted
 - **100%** of methodologies were factually correct
 - **98.4%** of Summaries were factually correct
 -**97.2%** of Findings were accurate
 - **77.7%** of authour names were Perfectly extracted
 - **77.7%*** of Document Type were correctly identified

## Tradeoffs in the design
Since I targetted to have high quality text generation, this approach takes higher number of LLM calls to judge each chunk
Latency is also high in this approach due to higher LLM calls

## Time Spent
I spent 2 Hours to understand the problem framework and design the system
3 hours to prototype the solution in python and test the performance
6 hours to Build and integrate the framework
3 hours to test and document findings
Total 14 hours

## Prerequisites
Before running the pipeline, ensure the following are installed:

1. **Node.js** (v16 or higher)
2. **Python 3.8+** with FastAPI and Docling
3. **npm** (Node Package Manager)
4. Required API keys:
   - Groq API key (for document processing)
 

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
   export GROQ_API_KEY="your-groq-api-key"
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

## Running the Pipeline

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

### Parameters:
- `<path-to-pdf>`: Absolute path to the PDF file to be processed
- `--api-url`: API base URL (default: http://localhost:8000)
- `--model`: Groq model to use (default: meta-llama/llama-4-scout-17b-16e-instruct)
- `--temperature`: Temperature for sampling (default: 0.1)
- `--top-p`: Top-p sampling parameter (default: 0.10)
- `--max-tokens`: Max completion tokens (default: 350)
- `--format`: Output format - markdown or json (default: markdown)
- `--save-outputs`: Save markdown and HTML files to disk
- `--output-dir`: Directory to save outputs (default: ./outputs)



---


# Theo Ai Take-Home Challenges

## Table of Contents

* [General Instructions](#general-instructions)
* [General Evaluation Criteria](#general-evaluation-criteria)
  * [Evaluation Questions](#evaluation-questions)
* [Challenge 1: Artworks App](#challenge-1-artworks-app)
* [Challenge 2: Document AI Pipeline](#challenge-2-document-ai-pipeline)
* [Challenge 3: Modernize a Legacy Codebase](#challenge-3-modernize-a-legacy-codebase)
* [Suggestions](#suggestions)

## General Instructions

1. Read all the requirements
2. Choose one challenge from the list of challenges below
3. Once you have chosen, fork this repository and create a new branch
   for your solution
4. Once you have completed the challenge, create a pull request
   against this repo's main branch and send an email to
   [tiago@theoai.ai](mailto:tiago@theoai.ai)
5. Your solution's documentation (README, comments, commit messages,
   etc) should answer the questions in the evaluation criteria

See [Suggestions](#suggestions) on how to manage your time
allocation. The submission of your solution is expected within 96
hours (4 days) of having received access to this repo.

---

## General Evaluation Criteria

- **Code Quality**: The code should be clean, readable, and maintainable.
- **Functionality**: The solution should work as expected and meet the
  specifications
- **Performance**: The solution should be performant and efficient
- **Testing**: The solution should be tested and have a good test coverage
- **Documentation**: The solution should be well documented and easy to
  understand
- **Code Structure**: The solution should be well structured and follow best
  practices
- **Error Handling**: The solution should handle errors gracefully and provide
  meaningful error messages
- **Git Hygiene**: The solution should be committed, pushed, and commit history
  should be clean and descriptive

### Evaluation Questions

1. Why did you choose this particular challenge?
2. How long did it take you to complete the challenge?
3. What was the hardest part of the challenge and how did you tackle it?
4. Where did you have the most fun and why?
5. What would you have done if you had more time?

---

## Challenge 1: Artworks App

Your challenge is to build a website that uses the [Metropolitan Museum's
API](https://metmuseum.github.io/).

You bought a Raspberry Pi attached to a portable 7" screen and with WiFi
capabilities. You want to use it to show artwork in your house.

Using TypeScript and React create an interactive website that displays artwork
that you pull from the Metropolitan Museum's API.

### Specifications

- The website should change artworks every 10 seconds
- The artwork should take the whole viewport (scaled proportionaly)
- When tapping on an artwork, display additional information about the artwork
- When displaying the art information, the timer should stop

### Location

This challenge is located in the `artworks-app` folder.

### Choose this challenge if

- You are willing to showcase your frontend, React and TypeScript skills
- You like exploring APIs and work with particular integrations

---

## Challenge 2: Document AI Pipeline

Your challenge is to create a document processing pipeline using AI.

Using TypeScript you need to create a CLI that takes a scientific
document as input and returns a series of datapoints about it (see
specs below).

### Specifications

- Your solution needs to be triggered from the command line and take a
  single scientific paper as input
- Using any AI and data services you find relevant, create a pipeline
  that returns the following fields for the given document:
  - Document type
  - Document author(s)
  - Document date
  - Brief summary about the document's content
  - Brief summary of research methods utilized
  - Brief summary of findings and conclusions

### Location

This challenge is located in the `doc-pipeline` folder. In there, you
will find a folder with some documents to use as reference.

## Choose this challenge if

- You are willing to showcase your AI, agentic and data skills
- You like exploring how AIs work over complex documents

---

## Challenge 3: Modernize a Legacy Codebase

Your challenge is to modernize the Typescript implementation of the [Make a Lisp
(MAL)](https://github.com/kanaka/mal) project.

You have been asked to make sure that your improved implementation runs on Bun
and Deno in addition to Node.

### Specifications

- All dependencies need to be updated to their latest versions (including Node)
- The following modernizations are required. Show your work:
  - Replace manual type checking with TypeScript discriminated unions
  - Use type guards instead of explicit type checks
  - Replace IIFE with direct exports
  - Use optional chaining (?.) where appropriate
  - Use nullish coalescing (??) instead of logical OR
  - Extract repetitive type validations into helper functions
  - Group related functions together
  - Use object destructuring for cleaner function parameters
  - Use array methods (map, reduce, filter) more consistently
  - Simplify conditional logic where possible

### Location

This challenge is located in the `mal` folder. It contains a simplified copy of
the original `Make a Lisp` project for you to work on.

## Choose this challenge if

- You are willing to showcase your ability to dive into a big codebase
- You like exploring meta-problems such as language design

---

## Suggestions

- **Timebox your work**: simply add to your documentation how much time you have
  invested and we will take that into account (solutions usually range from 30
  minutes to 3 hours)
- **The journey matters**: we are interested in your journey to the solution as
  much - if not more than - the solution itself. Make sure to capture the it in
  your final documentation
- **Have fun**: if the challenge ceases to be fun, write how you feel and why as
  part of your documentation and submit it
>>>>>>> 81af4e3e0723593cf5372f3ea5166b0f4444f47c

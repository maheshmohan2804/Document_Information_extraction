# PDF Data Extraction Pipeline

## Overview
The PDF Data Extraction Pipeline is designed to process and extract meaningful information from PDF documents. It leverages advanced techniques such as chunking, hybrid search, and corrective RAG (Retrieve and Generate) to ensure accurate and efficient data extraction. The pipeline is modular, making it easy to customize and extend for various use cases.

### Key Features
- **Chunking**: Splits large documents into manageable chunks for processing.
- **Hybrid Search**: Combines multiple search strategies to retrieve relevant information.
- **Corrective RAG**: Iteratively refines queries and results to improve accuracy.
- **Integration with Groq SDK**: Utilizes Groq for advanced language model interactions.

## Prerequisites
Before running the pipeline, ensure the following are installed:

1. **Node.js** (v16 or higher)
2. **npm** (Node Package Manager)
3. **Python** (if using Python-based components)
4. Required npm packages (install via `npm install`)

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/maheshmohan2804/Document_Information_extraction.git
   cd Document_Information_extraction
   ```

2. Navigate to the `src/orchestration` directory:
   ```bash
   cd src/orchestration
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Pipeline
To run the pipeline, use the following command:

```bash
npm start -- "<path-to-pdf>" --groq-key "<your-groq-key>"
```

### Example:
```bash
npm start -- "<path-to-pdf>" --groq-key "<your-groq-key>"
```

### Parameters:
- `<path-to-pdf>`: Absolute path to the PDF file to be processed.
- `<your-groq-key>`: API key for Groq SDK.

## Testing
To run the tests, navigate to the `tests` directory and execute:

```bash
npm test
```

## Debugging
For detailed logs, use the `--debug` flag:

```bash
npm start -- "<path-to-pdf>" --groq-key "<your-groq-key>" --debug
```

## Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

## License
This project is licensed under the MIT License.
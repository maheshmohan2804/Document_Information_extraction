import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import axios from 'axios';

interface ProcessResponse {
  status: string;
  filename: string;
  content: string;
  metadata: {
    num_pages: number | null;
  };
}

interface CliOptions {
  apiUrl?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  outputFormat?: 'markdown' | 'json';
}

async function processPDF(filePath: string, options: CliOptions = {}): Promise<void> {
  const {
    apiUrl = 'http://localhost:8000',
    model = 'meta-llama/llama-4-scout-17b-16e-instruct',
    temperature = 0.1,
    topP = 0.10,
    maxTokens = 350,
    outputFormat = 'markdown'
  } = options;

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Validate file is PDF
  if (!filePath.toLowerCase().endsWith('.pdf')) {
    console.error('❌ Error: File must be a PDF');
    process.exit(1);
  }

  const fileName = path.basename(filePath);
  console.log(`📄 Processing: ${fileName}`);
  console.log(`🔗 API URL: ${apiUrl}`);
  console.log(`🤖 Model: ${model}`);
  console.log(`⚙️  Temperature: ${temperature}\n`);

  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', model);
    form.append('temperature', temperature.toString());
    form.append('top_p', topP.toString());
    form.append('max_completion_tokens', maxTokens.toString());

    // Choose endpoint based on output format
    const endpoint = outputFormat === 'json' 
      ? `${apiUrl}/process-pdf-json/`
      : `${apiUrl}/process-pdf/`;

    console.log('⏳ Uploading and processing...\n');

    // Send request
    const response = await axios.post<ProcessResponse>(endpoint, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Print results
    console.log('✅ Processing complete!\n');
    console.log('─'.repeat(80));
    
    if (outputFormat === 'json') {
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log(`📊 Status: ${response.data.status}`);
      console.log(`📄 Filename: ${response.data.filename}`);
      if (response.data.metadata.num_pages) {
        console.log(`📑 Pages: ${response.data.metadata.num_pages}`);
      }
      console.log('\n📝 Content:\n');
      console.log('─'.repeat(80));
      console.log(response.data.content);
    }
    console.log('─'.repeat(80));

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ API Error:');
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.request) {
        console.error('No response received from server');
        console.error('Make sure the API is running at', apiUrl);
      } else {
        console.error(error.message);
      }
    } else {
      console.error('❌ Unexpected error:', error);
    }
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): { filePath: string; options: CliOptions } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📄 PDF Processing CLI

Usage: 
  npm start -- <pdf-file-path> [options]
  
  or after building:
  node dist/index.js <pdf-file-path> [options]

Arguments:
  <pdf-file-path>           Path to the PDF file to process (required)

Options:
  --api-url <url>           API base URL (default: http://localhost:8000)
  --model <model>           Groq model to use (default: meta-llama/llama-4-scout-17b-16e-instruct)
  --temperature <number>    Temperature for sampling (default: 0.1)
  --top-p <number>          Top-p sampling parameter (default: 0.10)
  --max-tokens <number>     Max completion tokens (default: 350)
  --format <markdown|json>  Output format (default: markdown)
  --help, -h                Show this help message

Examples:
  npm start -- document.pdf
  npm start -- document.pdf --temperature 0.2
  npm start -- document.pdf --format json
  npm start -- "C:\\path\\to\\document.pdf" --api-url http://192.168.1.100:8000
`);
    process.exit(0);
  }

  const filePath = args[0];
  const options: CliOptions = {};

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--api-url':
        options.apiUrl = value;
        break;
      case '--model':
        options.model = value;
        break;
      case '--temperature':
        options.temperature = parseFloat(value);
        break;
      case '--top-p':
        options.topP = parseFloat(value);
        break;
      case '--max-tokens':
        options.maxTokens = parseInt(value);
        break;
      case '--format':
        if (value === 'markdown' || value === 'json') {
          options.outputFormat = value;
        }
        break;
    }
  }

  return { filePath, options };
}

// Main
async function main() {
  const { filePath, options } = parseArgs();
  await processPDF(filePath, options);
}

main();
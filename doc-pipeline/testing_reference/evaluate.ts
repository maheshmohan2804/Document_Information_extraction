import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface ExtractionData {
  authors: string;
  date: string;
  documentType: string;
  summary: string;
  methods: string;
  findings: string;
  markdown?: string;
}

interface EvaluationResult {
  extractionFile: string;
  pdfFile: string;
  datesMatch: 'Yes' | 'No';
  datesCorrectPercentage: string;
  authorsMatch: 'Yes' | 'No';
  authorsCorrectPercentage: string;
  documentTypeCorrect: 'Yes' | 'No';
  methodologiesCorrect: 'Yes' | 'No';
  methodologiesGroundedPercentage: string;
  summaryCorrect: 'Yes' | 'No';
  summaryGroundedPercentage: string;
  findingsCorrect: 'Yes' | 'No';
  findingsGroundedPercentage: string;
  overallScore: number;
  scoreReason: string;
  error?: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EXTRACTION_OUTPUT_DIR = path.join(__dirname, '..', 'src', 'orchestration', 'output');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');

// Create outputs directory if it doesn't exist
if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

// Generate results file name with datetime
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const RESULTS_FILE = path.join(OUTPUTS_DIR, `evaluation-results-${timestamp}.json`);

async function evaluateWithGemini(
  extractionData: ExtractionData,
  extractionFileName: string
): Promise<Omit<EvaluationResult, 'extractionFile' | 'pdfFile' | 'error'>> {

  if (!extractionData.markdown || extractionData.markdown.trim().length === 0) {
    throw new Error('No markdown content available in extraction file. Please regenerate extraction with updated pipeline.');
  }

  const prompt = `You are an expert document evaluator. You have been given:
1. The GROUND TRUTH: Full markdown content extracted from a PDF document
2. EXTRACTED FIELDS: Structured information extracted by an AI pipeline

Your task is to evaluate how accurately the extracted fields represent the information in the ground truth document.

Extraction File: ${extractionFileName}

=== GROUND TRUTH (Full Markdown Document) ===
${extractionData.markdown}

=== EXTRACTED FIELDS ===
Authors: ${extractionData.authors}
Date: ${extractionData.date}
Document Type: ${extractionData.documentType}

Summary:
${extractionData.summary}

Research Methods:
${extractionData.methods}

Key Findings and Conclusions:
${extractionData.findings}

=== EVALUATION TASK ===
Compare the EXTRACTED FIELDS against the GROUND TRUTH document and provide your evaluation in the following JSON format:

{
  "datesMatch": "Yes" or "No",
  "datesCorrectPercentage": "percentage as string, e.g., '95%'",
  "authorsMatch": "Yes" or "No",
  "authorsCorrectPercentage": "percentage as string, e.g., '100%'",
  "documentTypeCorrect": "Yes" or "No",
  "methodologiesCorrect": "Yes" or "No",
  "methodologiesGroundedPercentage": "percentage as string, e.g., '90%'",
  "summaryCorrect": "Yes" or "No",
  "summaryGroundedPercentage": "percentage as string, e.g., '85%'",
  "findingsCorrect": "Yes" or "No",
  "findingsGroundedPercentage": "percentage as string, e.g., '88%'",
  "overallScore": 0-100,
  "scoreReason": "Brief explanation of the overall score"
}

Guidelines:
- Check if the extracted dates match what's in the ground truth document
- Verify author names are correct and complete compared to the ground truth
- Assess if the document type correctly describes the ground truth document
- Evaluate if research methodologies are accurately summarized and all facts are grounded in the document
- Check if the summary is factually accurate and grounded in the actual document content
- Check if findings/conclusions are accurate and grounded in the document
- Provide an overall quality score from 0-100
- Give a brief reason for the overall score

Respond ONLY with the JSON object, no additional text.`;

  try {
    console.log('   Sending request to Google Gemini API...');
    console.log(`   Prompt length: ${prompt.length} characters`);

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

    return JSON.parse(jsonStr.trim());
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.error('\n⚠️  Rate limit exceeded!');
      console.error('   Please wait a few minutes and try again');
      throw new Error('Rate limit exceeded. Please wait and try again.');
    }
    console.error('Error calling Gemini API:', error.response?.data || error.message);
    throw error;
  }
}

async function evaluateExtractionFile(extractionFilePath: string): Promise<EvaluationResult> {
  const extractionFileName = path.basename(extractionFilePath);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Evaluating: ${extractionFileName}`);
  console.log('='.repeat(80));

  try {
    // Read the extraction file
    const extractionData: ExtractionData = JSON.parse(
      fs.readFileSync(extractionFilePath, 'utf-8')
    );

    // Determine PDF file name (if we can infer it)
    let pdfFileName = 'Unknown';
    if (extractionData.markdown) {
      // Try to extract PDF name from markdown content or use extraction file name
      pdfFileName = extractionFileName.replace('extraction-', '').replace('.json', '') + '.pdf';
    }

    console.log(`📄 PDF: ${pdfFileName}`);
    console.log(`📊 Authors: ${extractionData.authors}`);
    console.log(`📅 Date: ${extractionData.date}`);
    console.log(`📋 Document Type: ${extractionData.documentType}`);
    console.log(`📝 Markdown length: ${extractionData.markdown?.length || 0} chars`);

    if (!extractionData.markdown || extractionData.markdown.trim().length === 0) {
      throw new Error('No markdown content available. Please regenerate extraction with updated pipeline.');
    }

    console.log('\n🤖 Evaluating with Gemini 2.0 Flash...');

    // Evaluate with Gemini using markdown as ground truth
    const evaluation = await evaluateWithGemini(extractionData, extractionFileName);

    const evalResult: EvaluationResult = {
      extractionFile: extractionFileName,
      pdfFile: pdfFileName,
      ...evaluation
    };

    console.log('\n✅ Evaluation complete!');
    console.log(JSON.stringify(evalResult, null, 2));

    return evalResult;

  } catch (error) {
    console.error(`\n❌ Error evaluating ${extractionFileName}:`, error);
    return {
      extractionFile: extractionFileName,
      pdfFile: 'Unknown',
      datesMatch: 'No',
      datesCorrectPercentage: '0%',
      authorsMatch: 'No',
      authorsCorrectPercentage: '0%',
      documentTypeCorrect: 'No',
      methodologiesCorrect: 'No',
      methodologiesGroundedPercentage: '0%',
      summaryCorrect: 'No',
      summaryGroundedPercentage: '0%',
      findingsCorrect: 'No',
      findingsGroundedPercentage: '0%',
      overallScore: 0,
      scoreReason: 'Evaluation failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  console.log('📋 PDF Extraction Quality Evaluation Pipeline');
  console.log('='.repeat(80));
  console.log('\n💡 This tool evaluates extraction quality by comparing:');
  console.log('   - GROUND TRUTH: Full markdown content from the PDF');
  console.log('   - EXTRACTED FIELDS: Structured data (authors, date, summary, etc.)');
  console.log('');

  // Validate API key
  if (!GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY not set');
    console.error('\nSet it with:');
    console.error('  export GEMINI_API_KEY="your-key"  # Linux/Mac');
    console.error('  set GEMINI_API_KEY=your-key       # Windows CMD');
    console.error('  $env:GEMINI_API_KEY="your-key"    # Windows PowerShell');
    process.exit(1);
  }

  // Check extraction output directory exists
  if (!fs.existsSync(EXTRACTION_OUTPUT_DIR)) {
    console.error(`❌ Error: Extraction output directory not found: ${EXTRACTION_OUTPUT_DIR}`);
    console.error('\nPlease run the pipeline first to generate extraction files:');
    console.error('  cd doc-pipeline/src/orchestration');
    console.error('  npm start -- "path/to/document.pdf" --groq-key "your-key"');
    process.exit(1);
  }

  // Get all extraction JSON files
  const extractionFiles = fs.readdirSync(EXTRACTION_OUTPUT_DIR)
    .filter(file => file.startsWith('extraction-') && file.endsWith('.json'))
    .map(file => path.join(EXTRACTION_OUTPUT_DIR, file))
    .sort((a, b) => {
      // Sort by modification time, newest first
      return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
    });

  if (extractionFiles.length === 0) {
    console.error('❌ No extraction files found in output directory');
    console.error('\nPlease run the pipeline first to generate extraction files:');
    console.error('  cd doc-pipeline/src/orchestration');
    console.error('  npm start -- "path/to/document.pdf" --groq-key "your-key"');
    process.exit(1);
  }

  console.log(`\n📁 Found ${extractionFiles.length} extraction files in output directory`);
  console.log(`📂 Location: ${EXTRACTION_OUTPUT_DIR}\n`);

  // Check for CLI argument
  const cliFileName = process.argv[2];
  let filesToEvaluate: string[] = [];

  if (cliFileName) {
    // User specified a file
    const specifiedFile = path.join(EXTRACTION_OUTPUT_DIR, cliFileName);
    if (fs.existsSync(specifiedFile)) {
      filesToEvaluate = [specifiedFile];
      console.log(`🎯 Evaluating specified file: ${cliFileName}\n`);
    } else {
      console.error(`❌ Error: File not found: ${cliFileName}`);
      console.error(`\nAvailable files:`);
      extractionFiles.forEach(file => {
        console.error(`  - ${path.basename(file)}`);
      });
      process.exit(1);
    }
  } else {
    // No CLI argument, evaluate ALL files
    console.log('📄 Available extraction files:');
    extractionFiles.forEach((file, idx) => {
      const fileName = path.basename(file);
      const stats = fs.statSync(file);
      const modTime = stats.mtime.toLocaleString();
      console.log(`  ${idx + 1}. ${fileName} (${modTime})`);
    });

    console.log('\n💡 Usage:');
    console.log('  npx ts-node evaluate.ts <filename>          # Evaluate specific file');
    console.log('  npx ts-node evaluate.ts                      # Evaluate ALL files');
    console.log('\nExample:');
    console.log('  npx ts-node evaluate.ts extraction-1760320927388.json');

    // Default to ALL files
    filesToEvaluate = extractionFiles;
    console.log(`\n🎯 No file specified, evaluating ALL ${extractionFiles.length} files\n`);
  }

  // Evaluate each extraction file
  const results: EvaluationResult[] = [];

  for (let i = 0; i < filesToEvaluate.length; i++) {
    const extractionFile = filesToEvaluate[i];
    console.log(`\n[${i + 1}/${filesToEvaluate.length}]`);

    const result = await evaluateExtractionFile(extractionFile);
    results.push(result);

    // Longer delay between requests to avoid rate limiting (especially for free tier)
    if (i < filesToEvaluate.length - 1) {
      const delaySeconds = 10;
      console.log(`\n⏳ Waiting ${delaySeconds} seconds before next evaluation (rate limit protection)...`);
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 Summary');
  console.log('='.repeat(80));
  console.log(`Total extractions evaluated: ${results.length}`);
  console.log(`Successful: ${results.filter(r => !r.error).length}`);
  console.log(`Failed: ${results.filter(r => r.error).length}`);

  const successfulResults = results.filter(r => !r.error);
  if (successfulResults.length > 0) {
    const avgScore = successfulResults.reduce((sum, r) => sum + r.overallScore, 0) / successfulResults.length;
    console.log(`Average score: ${avgScore.toFixed(2)}/100`);

    // Show breakdown
    const avgAuthors = successfulResults.filter(r => r.authorsMatch === 'Yes').length / successfulResults.length * 100;
    const avgDates = successfulResults.filter(r => r.datesMatch === 'Yes').length / successfulResults.length * 100;
    const avgDocType = successfulResults.filter(r => r.documentTypeCorrect === 'Yes').length / successfulResults.length * 100;
    const avgMethods = successfulResults.filter(r => r.methodologiesCorrect === 'Yes').length / successfulResults.length * 100;
    const avgSummary = successfulResults.filter(r => r.summaryCorrect === 'Yes').length / successfulResults.length * 100;
    const avgFindings = successfulResults.filter(r => r.findingsCorrect === 'Yes').length / successfulResults.length * 100;

    console.log('\n📈 Accuracy Breakdown:');
    console.log(`  Authors:   ${avgAuthors.toFixed(0)}% correct`);
    console.log(`  Dates:     ${avgDates.toFixed(0)}% correct`);
    console.log(`  Doc Type:  ${avgDocType.toFixed(0)}% correct`);
    console.log(`  Methods:   ${avgMethods.toFixed(0)}% correct`);
    console.log(`  Summary:   ${avgSummary.toFixed(0)}% correct`);
    console.log(`  Findings:  ${avgFindings.toFixed(0)}% correct`);
  }

  console.log(`\n💾 Results saved to: ${RESULTS_FILE}`);
}

main();

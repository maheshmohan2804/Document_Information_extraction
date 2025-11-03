# PowerShell script to process all PDFs in the Data folder
# Usage: .\process_all_pdfs.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PDF Batch Processing Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set paths
$scriptDir = $PSScriptRoot
$dataDir = Join-Path $scriptDir "Data"
$orchestrationDir = Join-Path $scriptDir "src\orchestration"

# Check if Data directory exists
if (-not (Test-Path $dataDir)) {
    Write-Host "ERROR: Data directory not found at: $dataDir" -ForegroundColor Red
    exit 1
}

# Get all PDF files
$pdfFiles = Get-ChildItem -Path $dataDir -Filter "*.pdf" -File

if ($pdfFiles.Count -eq 0) {
    Write-Host "ERROR: No PDF files found in Data directory" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($pdfFiles.Count) PDF files to process" -ForegroundColor Yellow
Write-Host ""

# Process each PDF
$successCount = 0
$failCount = 0
$startTime = Get-Date

foreach ($pdf in $pdfFiles) {
    $pdfPath = $pdf.FullName
    $pdfName = $pdf.Name

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Processing: $pdfName" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan

    # Run the pipeline
    Push-Location $orchestrationDir
    try {
        npm start -- "$pdfPath"

        if ($LASTEXITCODE -eq 0) {
            $successCount++
            Write-Host "✓ SUCCESS: $pdfName" -ForegroundColor Green
        } else {
            $failCount++
            Write-Host "✗ FAILED: $pdfName (exit code: $LASTEXITCODE)" -ForegroundColor Red
        }
    } catch {
        $failCount++
        Write-Host "✗ FAILED: $pdfName (error: $_)" -ForegroundColor Red
    } finally {
        Pop-Location
    }

    Write-Host ""
}

# Summary
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BATCH PROCESSING COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total files: $($pdfFiles.Count)" -ForegroundColor Yellow
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "Duration: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor Yellow
Write-Host ""
Write-Host "Results saved in: $orchestrationDir\output" -ForegroundColor Cyan
Write-Host ""

# Run evaluation
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RUNNING EVALUATION" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

$testingDir = Join-Path $scriptDir "testing_reference"

if (Test-Path $testingDir) {
    Push-Location $testingDir
    try {
        Write-Host "Evaluating extraction results with Gemini..." -ForegroundColor Yellow
        npm run evaluate

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Evaluation completed successfully" -ForegroundColor Green
            Write-Host "Evaluation results saved in: $testingDir\outputs" -ForegroundColor Cyan
        } else {
            Write-Host "✗ Evaluation failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Evaluation error: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
} else {
    Write-Host "⚠ Testing directory not found at: $testingDir" -ForegroundColor Yellow
    Write-Host "Skipping evaluation..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ALL TASKS COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

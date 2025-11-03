# PowerShell script to run evaluation on all extraction results
# Usage: .\run_evaluation.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Extraction Results Evaluation Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set paths
$scriptDir = $PSScriptRoot
$testingDir = Join-Path $scriptDir "testing_reference"
$outputDir = Join-Path $scriptDir "src\orchestration\output"

# Check if testing directory exists
if (-not (Test-Path $testingDir)) {
    Write-Host "ERROR: Testing directory not found at: $testingDir" -ForegroundColor Red
    exit 1
}

# Check if output directory exists
if (-not (Test-Path $outputDir)) {
    Write-Host "ERROR: Output directory not found at: $outputDir" -ForegroundColor Red
    Write-Host "Please run the extraction pipeline first to generate extraction files." -ForegroundColor Yellow
    exit 1
}

# Get all extraction files
$extractionFiles = Get-ChildItem -Path $outputDir -Filter "extraction-*.json" -File | Sort-Object LastWriteTime

if ($extractionFiles.Count -eq 0) {
    Write-Host "ERROR: No extraction files found in $outputDir" -ForegroundColor Red
    Write-Host "Please run the extraction pipeline first." -ForegroundColor Yellow
    exit 1
}

# Display extraction files found
Write-Host "Found $($extractionFiles.Count) extraction files:" -ForegroundColor Yellow
foreach ($file in $extractionFiles) {
    $timestamp = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "  - $($file.Name) (Modified: $timestamp)" -ForegroundColor Gray
}
Write-Host ""

# Ask for confirmation
Write-Host "This will evaluate all extraction files above." -ForegroundColor Yellow
$confirmation = Read-Host "Continue? (Y/N)"

if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "Evaluation cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RUNNING EVALUATION" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to testing directory and run evaluation
Push-Location $testingDir

try {
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
        Write-Host ""
    }

    # Check if .env file exists
    $envFile = Join-Path $testingDir ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "WARNING: .env file not found at $envFile" -ForegroundColor Yellow
        Write-Host "Make sure GEMINI_API_KEY is set in your environment or .env file" -ForegroundColor Yellow
        Write-Host ""
    }

    # Run evaluation
    Write-Host "Evaluating $($extractionFiles.Count) extraction files with Gemini AI..." -ForegroundColor Cyan
    Write-Host ""

    $startTime = Get-Date
    npm run evaluate

    if ($LASTEXITCODE -eq 0) {
        $endTime = Get-Date
        $duration = $endTime - $startTime

        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "[SUCCESS] EVALUATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Duration: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor Yellow
        Write-Host ""

        # Find the latest evaluation results file
        $evalOutputDir = Join-Path $testingDir "outputs"
        if (Test-Path $evalOutputDir) {
            $latestEvalFile = Get-ChildItem -Path $evalOutputDir -Filter "evaluation-results-*.json" -File |
                             Sort-Object LastWriteTime -Descending |
                             Select-Object -First 1

            if ($latestEvalFile) {
                Write-Host "Evaluation results saved to:" -ForegroundColor Cyan
                Write-Host "  $($latestEvalFile.FullName)" -ForegroundColor White
                Write-Host ""

                # Display summary if possible
                try {
                    $evalData = Get-Content $latestEvalFile.FullName | ConvertFrom-Json

                    Write-Host "========================================" -ForegroundColor Cyan
                    Write-Host "EVALUATION SUMMARY" -ForegroundColor Green
                    Write-Host "========================================" -ForegroundColor Cyan
                    Write-Host "Total documents evaluated: $($evalData.Count)" -ForegroundColor Yellow

                    if ($evalData.Count -gt 0) {
                        $avgScore = ($evalData | Measure-Object -Property overallScore -Average).Average
                        Write-Host "Average Overall Score: $([math]::Round($avgScore, 2))/10" -ForegroundColor Yellow

                        $successCount = ($evalData | Where-Object { $_.overallScore -ge 7 }).Count
                        Write-Host "High Quality (7-10): $successCount documents" -ForegroundColor Green

                        $mediumCount = ($evalData | Where-Object { $_.overallScore -ge 5 -and $_.overallScore -lt 7 }).Count
                        Write-Host "Medium Quality (5-7): $mediumCount documents" -ForegroundColor Yellow

                        $lowCount = ($evalData | Where-Object { $_.overallScore -lt 5 }).Count
                        Write-Host "Low Quality (<5): $lowCount documents" -ForegroundColor Red
                    }

                    Write-Host "========================================" -ForegroundColor Cyan
                } catch {
                    Write-Host "Could not parse evaluation results for summary display" -ForegroundColor Gray
                }
            }
        }
    } else {
        Write-Host ""
        Write-Host "[FAILED] Evaluation failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Check the output above for error details" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "[ERROR] Evaluation error: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host ""

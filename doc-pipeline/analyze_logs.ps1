# PowerShell script to analyze pipeline execution logs
# Extracts: execution time, API calls, input/output tokens

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pipeline Log Analysis" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$logsDir = Join-Path $PSScriptRoot "src\orchestration\logs"

if (-not (Test-Path $logsDir)) {
    Write-Host "ERROR: Logs directory not found at: $logsDir" -ForegroundColor Red
    exit 1
}

# Get all recent log files (from the batch run)
$logFiles = Get-ChildItem -Path $logsDir -Filter "rag-2025-10-15T18*.log" -File | Sort-Object LastWriteTime -Descending

if ($logFiles.Count -eq 0) {
    Write-Host "ERROR: No log files found" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($logFiles.Count) log files to analyze" -ForegroundColor Yellow
Write-Host ""

# Analysis results
$results = @()
$totalExecutionTime = 0
$totalApiCalls = 0
$totalInputTokens = 0
$totalOutputTokens = 0

foreach ($logFile in $logFiles) {
    $content = Get-Content $logFile.FullName -Raw

    # Extract execution time (from "Total execution time: XXXs")
    if ($content -match 'Total execution time:\s*(\d+\.?\d*)s') {
        $execTime = [double]$matches[1]
    } else {
        $execTime = 0
    }

    # Count Groq API calls (search for "Grading" or "Generating" patterns)
    $gradingCalls = ([regex]::Matches($content, 'Grading \d+ chunks')).Count
    $generationCalls = ([regex]::Matches($content, 'Generating (final extraction|answer) with LLM')).Count
    $rewriteCalls = ([regex]::Matches($content, 'Query rewritten:')).Count
    $taggingCalls = ([regex]::Matches($content, 'Processing chunk \d+/\d+ \(metadata extraction\)')).Count

    # Approximate API calls
    # Each query has: grading calls + 1 final extraction + query rewrites + tagging calls
    $apiCalls = $gradingCalls + $generationCalls + $rewriteCalls + $taggingCalls

    # For token estimation, we need to parse the content more carefully
    # Look for patterns that indicate token usage (this is approximate)
    # Groq API typically uses ~500-2000 input tokens and ~200-500 output tokens per call

    # Estimate based on API calls
    $avgInputTokensPerCall = 1200  # Conservative estimate
    $avgOutputTokensPerCall = 300  # Conservative estimate

    $estimatedInputTokens = $apiCalls * $avgInputTokensPerCall
    $estimatedOutputTokens = $apiCalls * $avgOutputTokensPerCall

    $results += [PSCustomObject]@{
        LogFile = $logFile.Name
        ExecutionTime = $execTime
        ApiCalls = $apiCalls
        EstimatedInputTokens = $estimatedInputTokens
        EstimatedOutputTokens = $estimatedOutputTokens
    }

    $totalExecutionTime += $execTime
    $totalApiCalls += $apiCalls
    $totalInputTokens += $estimatedInputTokens
    $totalOutputTokens += $estimatedOutputTokens
}

# Calculate averages
$avgExecutionTime = if ($results.Count -gt 0) { $totalExecutionTime / $results.Count } else { 0 }
$avgApiCalls = if ($results.Count -gt 0) { $totalApiCalls / $results.Count } else { 0 }
$avgInputTokens = if ($results.Count -gt 0) { $totalInputTokens / $results.Count } else { 0 }
$avgOutputTokens = if ($results.Count -gt 0) { $totalOutputTokens / $results.Count } else { 0 }

# Display results
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INDIVIDUAL DOCUMENT STATISTICS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Log File                                    Exec Time (s)  API Calls  Input Tokens  Output Tokens" -ForegroundColor Yellow
Write-Host "-" * 100 -ForegroundColor Gray

foreach ($result in $results | Select-Object -First 10) {
    $logName = $result.LogFile.PadRight(43)
    $execTime = $result.ExecutionTime.ToString("F2").PadLeft(13)
    $apiCalls = $result.ApiCalls.ToString().PadLeft(10)
    $inputTokens = $result.EstimatedInputTokens.ToString("N0").PadLeft(13)
    $outputTokens = $result.EstimatedOutputTokens.ToString("N0").PadLeft(14)

    Write-Host "$logName $execTime $apiCalls $inputTokens $outputTokens" -ForegroundColor White
}

if ($results.Count -gt 10) {
    Write-Host "... and $($results.Count - 10) more files" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AVERAGE STATISTICS (Per Document)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Average Execution Time:      " -NoNewline -ForegroundColor Yellow
Write-Host "$([math]::Round($avgExecutionTime, 2)) seconds" -ForegroundColor White

Write-Host "Average API Calls:           " -NoNewline -ForegroundColor Yellow
Write-Host "$([math]::Round($avgApiCalls, 0)) calls" -ForegroundColor White

Write-Host "Average Input Tokens:        " -NoNewline -ForegroundColor Yellow
Write-Host "$([math]::Round($avgInputTokens, 0).ToString('N0')) tokens" -ForegroundColor White

Write-Host "Average Output Tokens:       " -NoNewline -ForegroundColor Yellow
Write-Host "$([math]::Round($avgOutputTokens, 0).ToString('N0')) tokens" -ForegroundColor White

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TOTAL STATISTICS (All $($results.Count) Documents)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Execution Time:        " -NoNewline -ForegroundColor Yellow
Write-Host "$([math]::Round($totalExecutionTime, 2)) seconds ($([math]::Round($totalExecutionTime / 60, 2)) minutes)" -ForegroundColor White

Write-Host "Total API Calls:             " -NoNewline -ForegroundColor Yellow
Write-Host "$totalApiCalls calls" -ForegroundColor White

Write-Host "Total Input Tokens:          " -NoNewline -ForegroundColor Yellow
Write-Host "$($totalInputTokens.ToString('N0')) tokens" -ForegroundColor White

Write-Host "Total Output Tokens:         " -NoNewline -ForegroundColor Yellow
Write-Host "$($totalOutputTokens.ToString('N0')) tokens" -ForegroundColor White

Write-Host "Total Tokens (Combined):     " -NoNewline -ForegroundColor Yellow
Write-Host "$(($totalInputTokens + $totalOutputTokens).ToString('N0')) tokens" -ForegroundColor White

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COST ESTIMATION (Groq Pricing)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Groq pricing (approximate - llama-3.1-70b-versatile)
$inputCostPer1M = 0.59  # $0.59 per 1M input tokens
$outputCostPer1M = 0.79  # $0.79 per 1M output tokens

$inputCost = ($totalInputTokens / 1000000) * $inputCostPer1M
$outputCost = ($totalOutputTokens / 1000000) * $outputCostPer1M
$totalCost = $inputCost + $outputCost

Write-Host "Input Cost:                  " -NoNewline -ForegroundColor Yellow
Write-Host "`$$([math]::Round($inputCost, 4))" -ForegroundColor White

Write-Host "Output Cost:                 " -NoNewline -ForegroundColor Yellow
Write-Host "`$$([math]::Round($outputCost, 4))" -ForegroundColor White

Write-Host "Total Estimated Cost:        " -NoNewline -ForegroundColor Yellow
Write-Host "`$$([math]::Round($totalCost, 4))" -ForegroundColor Cyan

Write-Host ""
Write-Host "Note: Token counts are estimates based on API call patterns." -ForegroundColor Gray
Write-Host "Actual usage may vary. Check Groq dashboard for precise metrics." -ForegroundColor Gray
Write-Host ""

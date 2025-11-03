#!/bin/bash
# Bash script to process all PDFs in the Data folder
# Usage: ./process_all_pdfs.sh

echo "========================================"
echo "PDF Batch Processing Script"
echo "========================================"
echo ""

# Set paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/Data"
ORCHESTRATION_DIR="$SCRIPT_DIR/src/orchestration"

# Check if Data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo "ERROR: Data directory not found at: $DATA_DIR"
    exit 1
fi

# Count PDF files
PDF_COUNT=$(find "$DATA_DIR" -maxdepth 1 -name "*.pdf" -type f | wc -l)

if [ "$PDF_COUNT" -eq 0 ]; then
    echo "ERROR: No PDF files found in Data directory"
    exit 1
fi

echo "Found $PDF_COUNT PDF files to process"
echo ""

# Process each PDF
SUCCESS_COUNT=0
FAIL_COUNT=0
START_TIME=$(date +%s)

find "$DATA_DIR" -maxdepth 1 -name "*.pdf" -type f | while read -r PDF_PATH; do
    PDF_NAME=$(basename "$PDF_PATH")

    echo "========================================"
    echo "Processing: $PDF_NAME"
    echo "========================================"

    # Run the pipeline
    cd "$ORCHESTRATION_DIR" || exit 1

    if npm start -- "$PDF_PATH"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "✓ SUCCESS: $PDF_NAME"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "✗ FAILED: $PDF_NAME"
    fi

    cd "$SCRIPT_DIR" || exit 1
    echo ""
done

# Summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
HOURS=$((DURATION / 3600))
MINUTES=$(((DURATION % 3600) / 60))
SECONDS=$((DURATION % 60))

echo "========================================"
echo "BATCH PROCESSING COMPLETE"
echo "========================================"
echo "Total files: $PDF_COUNT"
echo "Duration: ${HOURS}h ${MINUTES}m ${SECONDS}s"
echo ""
echo "Results saved in: $ORCHESTRATION_DIR/output"
echo ""

# Run evaluation
echo "========================================"
echo "RUNNING EVALUATION"
echo "========================================"

TESTING_DIR="$SCRIPT_DIR/testing_reference"

if [ -d "$TESTING_DIR" ]; then
    cd "$TESTING_DIR" || exit 1

    echo "Evaluating extraction results with Gemini..."

    if npm run evaluate; then
        echo "✓ Evaluation completed successfully"
        echo "Evaluation results saved in: $TESTING_DIR/outputs"
    else
        echo "✗ Evaluation failed"
    fi

    cd "$SCRIPT_DIR" || exit 1
else
    echo "⚠ Testing directory not found at: $TESTING_DIR"
    echo "Skipping evaluation..."
fi

echo ""
echo "========================================"
echo "ALL TASKS COMPLETE"
echo "========================================"

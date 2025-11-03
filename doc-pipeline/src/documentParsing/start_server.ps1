# Increase Python memory allocation and start Docling API server

# Set environment variables


# Increase PyTorch memory allocation
$env:PYTORCH_CUDA_ALLOC_CONF = "max_split_size_mb:512,garbage_collection_threshold:0.6"
$env:OMP_NUM_THREADS = "4"
$env:MKL_NUM_THREADS = "4"

# Configure Python memory
$env:PYTHONMALLOC = "malloc"

# Set PyTorch to allocate memory more aggressively
$env:PYTORCH_NO_CUDA_MEMORY_CACHING = "0"

Write-Host "Starting Docling API Server with increased memory allocation..." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "GROQ_API_KEY: Set" -ForegroundColor Yellow
Write-Host "PyTorch max split size: 512MB" -ForegroundColor Yellow
Write-Host "OMP threads: 4" -ForegroundColor Yellow
Write-Host "GPU support: Enabled (if available)" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Start uvicorn
python -m uvicorn main:app --host localhost --port 8000 --timeout-keep-alive 300

@echo off
REM Increase Python memory allocation and start Docling API server

REM Set environment variables


REM Increase PyTorch memory allocation (adjust based on available RAM)
set PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
set OMP_NUM_THREADS=4
set MKL_NUM_THREADS=4

REM Allow Python to use more memory (remove 2GB limit on 32-bit systems)
set PYTHON_GIL_DISABLED=0

REM Configure garbage collection to be less aggressive
set PYTHONMALLOC=malloc

echo Starting Docling API Server with increased memory allocation...
echo ================================================================
echo GROQ_API_KEY: Set
echo PyTorch max split size: 512MB
echo OMP threads: 4
echo ================================================================

REM Start uvicorn with increased workers and timeout
python -m uvicorn main:app --host localhost --port 8000 --timeout-keep-alive 300 --workers 1

pause

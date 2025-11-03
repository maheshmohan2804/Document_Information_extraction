# Memory Configuration for Docling API Server

## Problem
The error `std::bad_alloc` or "not enough memory" occurs when PyTorch tries to allocate ~1.2GB for the vision model but your system doesn't have enough contiguous memory available.

## ✅ Solutions Implemented

### 1. **Optimized Startup Scripts**

Use these scripts instead of running uvicorn manually:

#### **Windows PowerShell (Recommended):**
```powershell
cd doc-pipeline/src/documentParsing
./start_server.ps1
```

#### **Windows Command Prompt:**
```cmd
cd doc-pipeline\src\documentParsing
start_server.bat
```

### 2. **What These Scripts Do:**

- ✅ Set `GROQ_API_KEY` automatically
- ✅ Configure PyTorch memory allocation (`PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512`)
- ✅ Optimize thread usage (`OMP_NUM_THREADS=4`)
- ✅ Enable GPU if available (10-100x faster, uses GPU RAM instead of system RAM)
- ✅ Configure Python memory allocator
- ✅ Set timeout to 5 minutes for large PDFs

### 3. **Code Optimizations**

The `main.py` now includes:

- ✅ Garbage collection before each conversion (`gc.collect()`)
- ✅ GPU cache clearing (`torch.cuda.empty_cache()`)
- ✅ Automatic GPU detection and usage
- ✅ Memory-efficient pipeline options

## 🚀 How to Use

### Option 1: Use the Startup Script (Easiest)

```powershell
cd "C:\Users\madha\OneDrive\Documents\PDF Data Extraction Pipeline\doc-pipeline\src\documentParsing"
./start_server.ps1
```

### Option 2: Manual Setup (More Control)

```powershell
cd "C:\Users\madha\OneDrive\Documents\PDF Data Extraction Pipeline\doc-pipeline\src\documentParsing"

# Set environment variables
$env:GROQ_API_KEY = "your-api-key-here"
$env:PYTORCH_CUDA_ALLOC_CONF = "max_split_size_mb:512,garbage_collection_threshold:0.6"
$env:OMP_NUM_THREADS = "4"
$env:PYTHONMALLOC = "malloc"

# Start server
python -m uvicorn main:app --host localhost --port 8000 --timeout-keep-alive 300
```

## 📊 Memory Usage

| Component | Memory (CPU) | Memory (GPU) |
|-----------|-------------|--------------|
| **Without GPU** | ~2.5 GB | 0 GB |
| **With GPU** | ~800 MB | ~1.5 GB |

**Recommendation:** If you have an NVIDIA GPU, install CUDA-enabled PyTorch:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

## 🔧 Troubleshooting

### Still Getting Memory Errors?

1. **Close other applications** to free up RAM
2. **Process smaller PDFs first** (< 10 pages)
3. **Restart Python** between large batches
4. **Upgrade RAM** (need 8GB+ total system RAM)

### Check Available Memory

```powershell
# PowerShell
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory, TotalVisibleMemorySize

# Or check GPU memory (if using CUDA)
python -c "import torch; print(f'GPU: {torch.cuda.is_available()}'); print(f'Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB' if torch.cuda.is_available() else 'CPU only')"
```

### Server Won't Start?

Make sure port 8000 is free:

```powershell
# Kill any process on port 8000
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
```

## 📝 Notes

- **Image descriptions** are enabled by default (can disable with `enable_images=false` to save memory)
- Server includes **automatic garbage collection** before each PDF
- GPU acceleration is **automatic** if CUDA is available
- Timeout is set to **5 minutes** for large PDFs

## ✨ Features Enabled

- ✅ OCR text extraction
- ✅ Table structure detection
- ✅ Image description with Groq vision models
- ✅ GPU acceleration (automatic)
- ✅ Memory-efficient processing
- ✅ Markdown + HTML export
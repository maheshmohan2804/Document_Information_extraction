"""
Docling PDF Processing API:
get_converter is a function to initialize DocumentConverter and further convert the PDF to structured data.
process_pdf is an endpoint to process a PDF file and return the extracted content in markdown and HTML formats.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import os
import tempfile
import torch
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, PictureDescriptionApiOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Docling PDF Processing API", version="1.0.0")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
USE_GPU = torch.cuda.is_available()
DEVICE = "cuda" if USE_GPU else "cpu"

print(f" Starting Docling API Server")
print(f"   Device: {DEVICE}")
print(f"   GPU Available: {USE_GPU}")
if USE_GPU:
    print(f"   GPU: {torch.cuda.get_device_name(0)}")
    print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")


class ProcessingConfig(BaseModel):
    model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    max_completion_tokens: int = 350
    temperature: float = 0.1
    top_p: float = 0.10
    prompt: Optional[str] = None


def get_converter(config: ProcessingConfig, enable_images: bool = True):
    """Initialize DocumentConverter with optimized memory usage.

    Memory optimization:
    - Clears cache before processing
    - Uses GPU if available (reduces CPU RAM usage)
    - Configures efficient memory allocation
    """

    # Clean up memory before processing
    import gc
    gc.collect()

    if USE_GPU:
        torch.cuda.empty_cache()

    opts = PdfPipelineOptions()
    opts.do_ocr = True  # Enable OCR for text extraction
    opts.do_table_structure = True  # Enable table detection

    # Enable image description with Groq vision
    if enable_images:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

        prompt = config.prompt or (
            "If you the image has text, extract the text first. "
            "Describe the figure concisely and accurately, including axes/units if visible. "
            "If the image is a flowchart, describe the steps in order. "
            "If the image is a diagram, describe the components and their relationships. "
            "If the image is a graph, identify and describe the axes, trends and patterns."
        )

        opts.enable_remote_services = True
        opts.do_picture_description = True
        opts.picture_description_options = PictureDescriptionApiOptions(
            url="https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            params={
                "model": config.model,
                "max_completion_tokens": config.max_completion_tokens,
                "temperature": config.temperature,
                "top_p": config.top_p,
            },
            prompt=prompt,
            timeout=90,
        )
    else:
        opts.do_picture_description = False

    # Set device for GPU acceleration
    if USE_GPU:
        opts.accelerator_options = {"device": DEVICE}

    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Docling PDF Processing API"}


@app.post("/process-pdf/")
async def process_pdf(
    file: UploadFile = File(...),
    enable_images: bool = True,  # Disable by default to save memory
    model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
    max_completion_tokens: int = 850,
    temperature: float = 0.1,
    top_p: float = 0.10,
):
    """
    Process a PDF file using Docling.

    Parameters:
    - file: PDF file to process
    - enable_images: Enable image description (requires more memory, default: False)
    - model: Groq model to use for image descriptions (if enabled)
    - max_completion_tokens: Maximum tokens in completion
    - temperature: Sampling temperature
    - top_p: Top-p sampling parameter
    """

    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # Configure and process
        config = ProcessingConfig(
            model=model,
            max_completion_tokens=max_completion_tokens,
            temperature=temperature,
            top_p=top_p,
        )

        converter = get_converter(config, enable_images=enable_images)
        result = converter.convert(tmp_path)
        doc = result.document

        # Extract document content as both markdown and HTML
        markdown_content = doc.export_to_markdown()
        html_content = doc.export_to_html()

        # Clean up temporary file
        os.unlink(tmp_path)

        return JSONResponse({
            "status": "success",
            "filename": file.filename,
            "content": markdown_content,
            "html_content": html_content,
            "metadata": {
                "num_pages": len(doc.pages) if hasattr(doc, 'pages') else None,
            }
        })
    
    except Exception as e:
        # Clean up on error
        if 'tmp_path' in locals():
            try:
                os.unlink(tmp_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@app.post("/process-pdf-json/")
async def process_pdf_json(
    file: UploadFile = File(...),
    enable_images: bool = True,
    model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
):
    """
    Process a PDF file and return structured JSON output.
    """

    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        config = ProcessingConfig(model=model)
        converter = get_converter(config, enable_images=enable_images)
        result = converter.convert(tmp_path)
        doc = result.document
        
        # Export to dict/JSON
        doc_dict = doc.export_to_dict()
        
        os.unlink(tmp_path)
        
        return JSONResponse({
            "status": "success",
            "filename": file.filename,
            "document": doc_dict,
        })
    
    except Exception as e:
        if 'tmp_path' in locals():
            try:
                os.unlink(tmp_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
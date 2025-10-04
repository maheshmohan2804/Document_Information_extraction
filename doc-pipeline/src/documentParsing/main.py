from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import os
import tempfile
from pathlib import Path
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, PictureDescriptionApiOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Docling PDF Processing API", version="1.0.0")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


class ProcessingConfig(BaseModel):
    model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    max_completion_tokens: int = 350
    temperature: float = 0.1
    top_p: float = 0.10
    prompt: Optional[str] = None


def get_converter(config: ProcessingConfig):
    """Initialize DocumentConverter with given configuration."""
    
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")
    
    prompt = config.prompt or (
        "If you the image has text, extract the text first. "
        "Describe the figure concisely and accurately, including axes/units if visible. "
        "If the image is a flowchart, describe the steps in order. "
        "If the image is a diagram, describe the components and their relationships. "
        "If the image is a graph, identify and describe the axes, trends and patterns."
    )
    
    opts = PdfPipelineOptions(enable_remote_services=True)
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
    model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
    max_completion_tokens: int = 350,
    temperature: float = 0.1,
    top_p: float = 0.10,
):
    """
    Process a PDF file using Docling with Groq's vision model.
    
    Parameters:
    - file: PDF file to process
    - model: Groq model to use for image descriptions
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
        
        converter = get_converter(config)
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
        converter = get_converter(config)
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
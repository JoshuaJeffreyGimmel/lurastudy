"""
Text extraction and chunking service.
Supports .txt, .md, and .pdf files.
"""
import io
import re
from pathlib import Path

import aiofiles
from pypdf import PdfReader

# Chunking parameters
MIN_CHUNK_CHARS = 100
MAX_CHUNK_CHARS = 1500


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF file given its raw bytes."""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text.strip())
    return "\n\n".join(pages_text)


def extract_text_from_plaintext(file_bytes: bytes) -> str:
    """Decode plain text / markdown files."""
    return file_bytes.decode("utf-8", errors="replace")


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """Dispatch to the correct extractor based on file type."""
    if file_type == "pdf":
        return extract_text_from_pdf(file_bytes)
    return extract_text_from_plaintext(file_bytes)


def chunk_text(text: str) -> list[str]:
    """
    Split text into contextual chunks.

    Strategy:
    1. Split on double newlines (paragraph boundaries).
    2. Merge very short paragraphs with the next one.
    3. Split very long paragraphs at sentence boundaries.
    """
    # Normalise line endings and collapse excessive blank lines
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    raw_paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: list[str] = []
    buffer = ""

    for para in raw_paragraphs:
        if len(buffer) + len(para) < MIN_CHUNK_CHARS:
            # Too short — accumulate
            buffer = (buffer + " " + para).strip() if buffer else para
        else:
            if buffer:
                chunks.append(buffer)
            buffer = para

    if buffer:
        chunks.append(buffer)

    # Split chunks that are too long at sentence boundaries
    final_chunks: list[str] = []
    for chunk in chunks:
        if len(chunk) <= MAX_CHUNK_CHARS:
            final_chunks.append(chunk)
        else:
            # Split on sentence-ending punctuation
            sentences = re.split(r"(?<=[.!?])\s+", chunk)
            current = ""
            for sentence in sentences:
                if len(current) + len(sentence) <= MAX_CHUNK_CHARS:
                    current = (current + " " + sentence).strip() if current else sentence
                else:
                    if current:
                        final_chunks.append(current)
                    current = sentence
            if current:
                final_chunks.append(current)

    # Filter out any remaining tiny fragments
    return [c for c in final_chunks if len(c) >= MIN_CHUNK_CHARS]


async def read_upload_file(file_path: str) -> bytes:
    """Read an uploaded file from disk asynchronously."""
    async with aiofiles.open(file_path, "rb") as f:
        return await f.read()

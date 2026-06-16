"""
Text extraction and chunking service.
Uses markitdown to support a wide range of file formats:
PDF, DOCX, PPTX, XLSX, HTML, TXT, MD, and more.
"""
import io
import re

from markitdown import MarkItDown

# Shared MarkItDown instance (stateless, safe to reuse)
_md = MarkItDown()

# Chunking parameters
MIN_CHUNK_CHARS = 20
MAX_CHUNK_CHARS = 1500


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """
    Extract plain text from a file using markitdown.
    Supports PDF, DOCX, PPTX, XLSX, HTML, TXT, MD, and more.
    Returns the extracted content as a Markdown-formatted string.
    """
    # markitdown needs a file-like object; pass the extension as a hint
    stream = io.BytesIO(file_bytes)
    result = _md.convert_stream(stream, file_extension=f".{file_type}")
    return result.text_content or ""


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
    import aiofiles
    async with aiofiles.open(file_path, "rb") as f:
        return await f.read()

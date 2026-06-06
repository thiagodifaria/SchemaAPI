import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

from parse import DocumentBlock, compact_text


@dataclass
class SemanticChunk:
    raw_text: str
    clean_text: str
    text: str
    context: str
    section_title: str | None
    content_type: str
    page_number: int | None
    metadata: dict[str, Any] = field(default_factory=dict)


def signature(value: str) -> str:
    normalized = compact_text(value).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def split_large_text(value: str, max_words: int) -> list[str]:
    words = value.split()
    if len(words) <= max_words:
        return [value]

    parts = []
    overlap = min(48, max_words // 5)
    step = max_words - overlap
    for start in range(0, len(words), step):
        part = " ".join(words[start:start + max_words])
        if part:
            parts.append(part)
    return parts


def infer_context(section_title: str | None, content_type: str, page_number: int | None, text: str) -> str:
    facts = []
    if section_title:
        facts.append(f"secao: {section_title}")
    if page_number is not None:
        facts.append(f"pagina: {page_number}")
    facts.append(f"tipo: {content_type}")

    metrics = re.findall(
        r"(Receita\s+Liquida|EBITDA\s+Ajustado|EBITDA|Lucro\s+Liquido|Margem\s+EBITDA|Produ[cç][aã]o)[^.\n]{0,120}",
        text,
        flags=re.IGNORECASE,
    )
    if metrics:
        facts.append("metricas: " + ", ".join(dict.fromkeys(metric.strip() for metric in metrics[:4])))

    return "Contexto do chunk (" + "; ".join(facts) + ")."


def make_chunk(
    raw_text: str,
    clean_text: str,
    section_title: str | None,
    content_type: str,
    page_number: int | None,
    metadata: dict[str, Any],
) -> SemanticChunk:
    context = infer_context(section_title, content_type, page_number, clean_text)
    return SemanticChunk(
        raw_text=raw_text,
        clean_text=clean_text,
        text=f"{context}\n\n{clean_text}",
        context=context,
        section_title=section_title,
        content_type=content_type,
        page_number=page_number,
        metadata=metadata,
    )


def semantic_chunk(blocks: list[DocumentBlock], chunk_size: int = 320) -> list[dict]:
    chunks: list[SemanticChunk] = []
    current: list[DocumentBlock] = []
    current_section: str | None = None

    def flush():
        nonlocal current
        if not current:
            return

        raw = "\n\n".join(block.raw_text for block in current if block.raw_text)
        clean = "\n\n".join(block.clean_text for block in current if block.clean_text)
        if clean:
            first = current[0]
            section = current_section or first.section_title
            for part in split_large_text(compact_text(clean), chunk_size):
                chunks.append(make_chunk(
                    raw_text=raw,
                    clean_text=part,
                    section_title=section,
                    content_type=first.block_type if len(current) == 1 else "text",
                    page_number=first.page_number,
                    metadata={
                        "chunking": "semantic-contextual",
                        "source_blocks": len(current),
                        "raw_signature": signature(raw),
                        "clean_signature": signature(part),
                    },
                ))
        current = []

    for block in blocks:
        if block.block_type == "heading":
            flush()
            current_section = block.clean_text
            continue

        if block.block_type == "table":
            flush()
            chunks.append(make_chunk(
                raw_text=block.raw_text,
                clean_text=block.clean_text,
                section_title=block.section_title or current_section,
                content_type="table",
                page_number=block.page_number,
                metadata={
                    **block.metadata,
                    "chunking": "semantic-table",
                    "raw_signature": signature(block.raw_text),
                    "clean_signature": signature(block.clean_text),
                },
            ))
            continue

        current_words = sum(len(compact_text(item.clean_text).split()) for item in current)
        block_words = len(compact_text(block.clean_text).split())
        if current and current_words + block_words > chunk_size:
            flush()
        current.append(block)

    flush()

    deduped = []
    seen = set()
    for item in chunks:
        key = item.metadata["clean_signature"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append({
            "text": item.text,
            "raw_text": item.raw_text,
            "clean_text": item.clean_text,
            "context": item.context,
            "section_title": item.section_title,
            "content_type": item.content_type,
            "page_number": item.page_number,
            "metadata": item.metadata,
        })

    return deduped

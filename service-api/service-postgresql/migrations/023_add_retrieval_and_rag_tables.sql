ALTER TABLE chunks
ADD COLUMN IF NOT EXISTS section_title TEXT,
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS page_number INT,
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE chunks
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('simple', coalesce(text_content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_chunks_search_vector ON chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_chunks_section_title ON chunks(section_title);
CREATE INDEX IF NOT EXISTS idx_chunks_content_type ON chunks(content_type);

CREATE TABLE IF NOT EXISTS rag_query_audit (
    id UUID PRIMARY KEY,
    query_text TEXT NOT NULL,
    answer_text TEXT,
    retrieved_chunk_ids UUID[] NOT NULL DEFAULT '{}',
    graph_entity_ids UUID[] NOT NULL DEFAULT '{}',
    warnings TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_query_audit_created_at ON rag_query_audit(created_at DESC);

ALTER TABLE chunks
ADD COLUMN IF NOT EXISTS raw_text_content TEXT,
ADD COLUMN IF NOT EXISTS normalized_text_content TEXT,
ADD COLUMN IF NOT EXISTS contextual_text TEXT,
ADD COLUMN IF NOT EXISTS context_summary TEXT,
ADD COLUMN IF NOT EXISTS layout_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chunks_page_number ON chunks(page_number);
CREATE INDEX IF NOT EXISTS idx_chunks_layout_metadata ON chunks USING gin(layout_metadata);

CREATE TABLE IF NOT EXISTS analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    scope_label TEXT,
    document_ids UUID[] NOT NULL DEFAULT '{}',
    search_queries TEXT[] NOT NULL DEFAULT '{}',
    rag_queries TEXT[] NOT NULL DEFAULT '{}',
    executive_summary TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
    risks JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    markdown TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_created_at
    ON analysis_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_document_ids
    ON analysis_reports USING GIN (document_ids);

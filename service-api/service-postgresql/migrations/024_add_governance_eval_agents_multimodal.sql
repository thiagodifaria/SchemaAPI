ALTER TABLE chunks
ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) NOT NULL DEFAULT 'public',
ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] NOT NULL DEFAULT ARRAY['reader', 'admin']::text[],
ADD COLUMN IF NOT EXISTS pii_redacted_text TEXT,
ADD COLUMN IF NOT EXISTS pii_findings JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_classifications_version_label
ON document_classifications(processing_version_id, label);

CREATE UNIQUE INDEX IF NOT EXISTS idx_temporal_patterns_type_topic
ON temporal_patterns(pattern_type, topic);

CREATE INDEX IF NOT EXISTS idx_chunks_access_level ON chunks(access_level);
CREATE INDEX IF NOT EXISTS idx_chunks_allowed_roles ON chunks USING gin(allowed_roles);

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    actor_role VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_type_created_at ON audit_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS rag_eval_runs (
    id UUID PRIMARY KEY,
    query_audit_id UUID REFERENCES rag_query_audit(id) ON DELETE SET NULL,
    faithfulness REAL NOT NULL,
    context_precision REAL NOT NULL,
    answer_relevance REAL NOT NULL,
    groundedness REAL NOT NULL,
    notes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_eval_runs_created_at ON rag_eval_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY,
    goal TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    requested_tool VARCHAR(100) NOT NULL,
    tool_risk VARCHAR(50) NOT NULL,
    plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

CREATE TABLE IF NOT EXISTS multimodal_blocks (
    id UUID PRIMARY KEY,
    processing_version_id UUID NOT NULL REFERENCES processing_versions(id) ON DELETE CASCADE,
    block_type VARCHAR(50) NOT NULL,
    page_number INT,
    position INT NOT NULL,
    content_text TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multimodal_blocks_version ON multimodal_blocks(processing_version_id, position);

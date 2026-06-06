CREATE TABLE IF NOT EXISTS desktop_ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    processing_version_id UUID NOT NULL REFERENCES processing_versions(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE desktop_ingestion_jobs
    ADD CONSTRAINT desktop_ingestion_jobs_processing_version_id_key
    UNIQUE (processing_version_id);

CREATE INDEX IF NOT EXISTS idx_desktop_ingestion_jobs_status_created_at
    ON desktop_ingestion_jobs(status, created_at);

-- Migration: 015_create_document_structures_table
-- Date: 2025-08-12

CREATE TABLE document_structures (
    id UUID PRIMARY KEY,
    processing_version_id UUID NOT NULL UNIQUE REFERENCES processing_versions(id) ON DELETE CASCADE,
    features JSONB NOT NULL,
    structure_hash TEXT NOT NULL,
    created_at TIMESTAMTz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_structures_structure_hash ON document_structures(structure_hash);
-- Migration: 014_add_classification_examples_table
-- Date: 2025-08-12

CREATE TABLE classification_examples (
    id UUID PRIMARY KEY,
    processing_version_id UUID NOT NULL REFERENCES processing_versions(id) ON DELETE CASCADE,
    example_text TEXT NOT NULL,
    example_label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classification_examples_version_id ON classification_examples(processing_version_id);
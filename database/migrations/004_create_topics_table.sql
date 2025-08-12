-- Migration: 004_create_topics_table
-- Date: 2025-08-12

CREATE TABLE topics (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    topic_text TEXT NOT NULL,
    weight REAL NOT NULL,
    topic_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_topics_document_id ON topics(document_id);
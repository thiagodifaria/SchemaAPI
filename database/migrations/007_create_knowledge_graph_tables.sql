-- Migration: 007_create_knowledge_graph_tables
-- Date: 2025-08-12

CREATE TABLE entities (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, entity_type)
);

CREATE TABLE entity_mentions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    mentioned_text TEXT NOT NULL,
    confidence REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_mentions_document_id ON entity_mentions(document_id);
CREATE INDEX idx_entity_mentions_entity_id ON entity_mentions(entity_id);
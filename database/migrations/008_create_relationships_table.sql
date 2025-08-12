-- Migration: 008_create_relationships_table
-- Date: 2025-08-12

CREATE TABLE relationships (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL,
    weight REAL,
    context_snippet TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relationships_document_id ON relationships(document_id);
CREATE INDEX idx_relationships_source_entity_id ON relationships(source_entity_id);
CREATE INDEX idx_relationships_target_entity_id ON relationships(target_entity_id);
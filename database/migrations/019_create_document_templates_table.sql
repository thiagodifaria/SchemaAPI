CREATE TABLE document_templates (
    id UUID PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    structure_hash TEXT NOT NULL UNIQUE,
    structure_definition JSONB NOT NULL,
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_templates_structure_hash ON document_templates(structure_hash);
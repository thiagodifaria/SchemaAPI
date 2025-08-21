CREATE TABLE legal_clauses (
    id UUID PRIMARY KEY,
    processing_version_id UUID NOT NULL REFERENCES processing_versions(id) ON DELETE CASCADE,
    clause_type TEXT NOT NULL,
    clause_text TEXT NOT NULL,
    confidence INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_legal_clauses_version_id ON legal_clauses(processing_version_id);
CREATE INDEX idx_legal_clauses_clause_type ON legal_clauses(clause_type);
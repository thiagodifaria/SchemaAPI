CREATE TABLE document_classifications (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    confidence REAL NOT NULL,
    classifier_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_classifications_document_id ON document_classifications(document_id);
CREATE UNIQUE INDEX idx_document_classifications_unique_label ON document_classifications(document_id, label);
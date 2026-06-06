CREATE TABLE tabular_data (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    sheet_name TEXT,
    data_json JSONB NOT NULL,
    detected_schema JSONB,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tabular_data_document_id ON tabular_data(document_id);
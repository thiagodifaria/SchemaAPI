CREATE TABLE action_items (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    task_text TEXT NOT NULL,
    original_text TEXT,
    assignee_name VARCHAR(255),
    due_date DATE,
    priority VARCHAR(50),
    confidence REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_action_items_document_id ON action_items(document_id);
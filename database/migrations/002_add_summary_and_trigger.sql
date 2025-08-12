-- Migration: 002_add_summary_and_trigger
-- Date: 2025-08-12

ALTER TABLE documents
ADD COLUMN summary_text TEXT,
ADD COLUMN summary_type VARCHAR(50),
ADD COLUMN summary_confidence REAL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
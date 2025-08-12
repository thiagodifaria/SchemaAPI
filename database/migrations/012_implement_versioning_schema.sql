-- Migration: 012_implement_versioning_schema
-- Date: 2025-08-12

CREATE TABLE processing_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    summary_text TEXT,
    summary_type VARCHAR(50),
    summary_confidence REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

ALTER TABLE documents DROP COLUMN status;
ALTER TABLE documents DROP COLUMN summary_text;
ALTER TABLE documents DROP COLUMN summary_type;
ALTER TABLE documents DROP COLUMN summary_confidence;

CREATE OR REPLACE FUNCTION drop_fk_if_exists(table_name TEXT, constraint_name TEXT) RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
        EXECUTE 'ALTER TABLE ' || table_name || ' DROP CONSTRAINT ' || constraint_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tables_to_update TEXT[] := ARRAY['chunks', 'topics', 'action_items', 'entity_mentions', 'relationships', 'document_classifications', 'tabular_data', 'raw_files'];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables_to_update
    LOOP
        EXECUTE drop_fk_if_exists(tbl, tbl || '_document_id_fkey');
        
        EXECUTE 'ALTER TABLE ' || tbl || ' ADD COLUMN processing_version_id UUID';
        
        
        EXECUTE 'ALTER TABLE ' || tbl || ' ALTER COLUMN processing_version_id SET NOT NULL';
        EXECUTE 'ALTER TABLE ' || tbl || ' ADD CONSTRAINT ' || tbl || '_processing_version_id_fkey FOREIGN KEY (processing_version_id) REFERENCES processing_versions(id) ON DELETE CASCADE';
        
        EXECUTE 'ALTER TABLE ' || tbl || ' DROP COLUMN document_id';
    END LOOP;
END;
$$;
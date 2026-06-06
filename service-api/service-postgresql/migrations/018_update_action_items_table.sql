ALTER TABLE action_items DROP COLUMN IF EXISTS priority;

ALTER TABLE action_items
ADD COLUMN priority VARCHAR(50),
ADD COLUMN dependencies UUID[];

CREATE INDEX idx_action_items_priority ON action_items(priority);
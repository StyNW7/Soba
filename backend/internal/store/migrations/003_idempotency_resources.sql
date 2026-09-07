-- Keep retry keys after an individual deletion, but erase the old response.
-- A tombstone prevents the same create key from recreating a deleted item.
ALTER TABLE idempotency_records ADD COLUMN resource_id uuid;
CREATE INDEX idempotency_resource ON idempotency_records(actor_key,resource_id) WHERE resource_id IS NOT NULL;

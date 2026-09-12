ALTER TABLE api_keys
  ADD COLUMN uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id,
  ADD UNIQUE KEY uq_api_keys_uuid (uuid);

UPDATE api_keys
SET uuid = UUID()
WHERE uuid IS NULL;

ALTER TABLE sessions
  ADD COLUMN api_key_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER api_key_id;

UPDATE sessions
INNER JOIN api_keys ON sessions.api_key_id = api_keys.id
SET sessions.api_key_uuid = api_keys.uuid;

ALTER TABLE sessions
  DROP FOREIGN KEY fk_sessions_api_key,
  DROP INDEX uq_sessions_tenant_name,
  DROP COLUMN api_key_id,
  CHANGE COLUMN api_key_uuid api_key_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ADD UNIQUE KEY uq_sessions_tenant_name (api_key_id, session_name);

ALTER TABLE api_keys
  DROP PRIMARY KEY,
  DROP COLUMN id,
  CHANGE COLUMN uuid id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ADD PRIMARY KEY (id),
  DROP INDEX uq_api_keys_uuid;

ALTER TABLE sessions
  ADD CONSTRAINT fk_sessions_api_key
    FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
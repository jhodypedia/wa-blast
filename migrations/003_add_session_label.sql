ALTER TABLE sessions
  ADD COLUMN label VARCHAR(100) NULL AFTER session_name;
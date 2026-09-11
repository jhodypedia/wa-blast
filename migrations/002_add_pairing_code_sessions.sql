ALTER TABLE sessions
  ADD COLUMN connection_method ENUM('qr', 'pairing_code') NOT NULL DEFAULT 'qr' AFTER api_key_id,
  MODIFY COLUMN status ENUM(
    'qr_pending',
    'pairing_pending',
    'connected',
    'disconnected',
    'logged_out'
  ) NOT NULL DEFAULT 'qr_pending';
ALTER TABLE sessions
  MODIFY COLUMN status ENUM(
    'qr_pending',
    'pairing_pending',
    'connected',
    'disconnected',
    'logged_out',
    'expired'
  ) NOT NULL DEFAULT 'qr_pending';
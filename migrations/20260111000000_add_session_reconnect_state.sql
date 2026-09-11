ALTER TABLE sessions
  MODIFY COLUMN status ENUM(
    'qr_pending',
    'pairing_pending',
    'connected',
    'reconnecting',
    'disconnected',
    'logged_out',
    'expired',
    'terminated'
  ) NOT NULL DEFAULT 'qr_pending',
  ADD COLUMN IF NOT EXISTS last_disconnect_reason VARCHAR(100) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS reconnect_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER last_disconnect_reason;
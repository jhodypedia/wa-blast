CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(128) NOT NULL,
  label VARCHAR(100) NOT NULL,
  owner_telegram_id BIGINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit_per_minute INT UNSIGNED NOT NULL DEFAULT 60,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_keys_key (`key`),
  KEY idx_api_keys_owner (owner_telegram_id),
  KEY idx_api_keys_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_name VARCHAR(100) NOT NULL,
  api_key_id BIGINT UNSIGNED NOT NULL,
  status ENUM('qr_pending', 'connected', 'disconnected', 'logged_out') NOT NULL DEFAULT 'qr_pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_name (session_name),
  UNIQUE KEY uq_sessions_tenant_name (api_key_id, session_name),
  KEY idx_sessions_status (status),
  CONSTRAINT fk_sessions_api_key
    FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  broadcast_id VARCHAR(64) NOT NULL,
  session_id BIGINT UNSIGNED NOT NULL,
  target_number VARCHAR(32) NOT NULL,
  message_type VARCHAR(32) NOT NULL,
  status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_broadcast_logs_broadcast (broadcast_id),
  KEY idx_broadcast_logs_session_status (session_id, status),
  CONSTRAINT fk_broadcast_logs_session
    FOREIGN KEY (session_id) REFERENCES sessions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
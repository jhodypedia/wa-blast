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
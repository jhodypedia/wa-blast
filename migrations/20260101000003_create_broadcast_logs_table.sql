CREATE TABLE IF NOT EXISTS broadcast_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  broadcast_id VARCHAR(64) NOT NULL,
  session_id BIGINT UNSIGNED NOT NULL,
  target_number VARCHAR(128) NOT NULL,
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
CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(64) NOT NULL,
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
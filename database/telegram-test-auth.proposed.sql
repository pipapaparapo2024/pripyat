-- PROPOSAL ONLY. DO NOT RUN without approval. Target: NEW stalker_telegram_test.
-- Proposed database creation (operator only; not executed by application):
CREATE DATABASE `stalker_telegram_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Then create an empty game schema from database/schema.sql (no player rows).
-- Use a separate MySQL account with grants ONLY on stalker_telegram_test.*.
-- Existing VK/OK databases and their users.id remain unchanged.
USE `stalker_telegram_test`;
CREATE TABLE `telegram_identities` (
  `player_id` int NOT NULL AUTO_INCREMENT,
  `telegram_id` bigint unsigned NOT NULL,
  `created_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`player_id`),
  UNIQUE KEY `uq_telegram_id` (`telegram_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- player_id is allocated here, then used as users.id within the SAME transaction.
-- No FK to users: allocation precedes creation of the user row.
CREATE TABLE `telegram_sessions` (
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `player_id` int NOT NULL,
  `expires_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `idx_player` (`player_id`),
  KEY `idx_expiry` (`expires_at`),
  CONSTRAINT `fk_telegram_session_player` FOREIGN KEY (`player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

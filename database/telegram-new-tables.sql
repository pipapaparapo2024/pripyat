-- Additional Telegram-only tables. Apply only inside the new Telegram database.
CREATE TABLE `telegram_identities` (
  `player_id` int NOT NULL AUTO_INCREMENT,
  `telegram_id` bigint unsigned NOT NULL,
  `created_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`player_id`),
  UNIQUE KEY `uq_telegram_id` (`telegram_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `telegram_sessions` (
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `player_id` int NOT NULL,
  `expires_at` bigint unsigned NOT NULL,
  `request_key` char(32) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `idx_player` (`player_id`),
  KEY `idx_expiry` (`expires_at`),
  CONSTRAINT `fk_tg_session_player` FOREIGN KEY (`player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `telegram_roles` (
  `player_id` int NOT NULL,
  `role` enum('developer','admin') NOT NULL,
  `created_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`player_id`,`role`),
  CONSTRAINT `fk_tg_role_player` FOREIGN KEY (`player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `telegram_friendships` (
  `player_low` int NOT NULL,
  `player_high` int NOT NULL,
  `friends_since_ms` bigint unsigned NOT NULL,
  PRIMARY KEY (`player_low`,`player_high`),
  KEY `idx_friend_high` (`player_high`),
  CONSTRAINT `chk_tg_friend_pair` CHECK (`player_low` < `player_high`),
  CONSTRAINT `fk_tg_friend_low` FOREIGN KEY (`player_low`) REFERENCES `telegram_identities` (`player_id`),
  CONSTRAINT `fk_tg_friend_high` FOREIGN KEY (`player_high`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `telegram_friend_invites` (
  `code` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `owner_player_id` int NOT NULL,
  `created_at` bigint unsigned NOT NULL,
  `revoked_at` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`code`),
  KEY `idx_invite_owner` (`owner_player_id`),
  CONSTRAINT `fk_tg_invite_player` FOREIGN KEY (`owner_player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

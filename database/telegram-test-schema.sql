-- Schema-only Telegram TEST installation. No VK/OK rows. Source: live SHOW CREATE TABLE.
CREATE DATABASE `stalker_telegram_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `stalker_telegram_test`;
CREATE TABLE `users` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `exp` int NOT NULL DEFAULT '0',
  `level` int NOT NULL DEFAULT '1',
  `create_time` int NOT NULL DEFAULT '0',
  `visit` int NOT NULL DEFAULT '0',
  `coins` bigint NOT NULL DEFAULT '0',
  `stew` bigint NOT NULL DEFAULT '0',
  `cigarettes` int NOT NULL DEFAULT '0',
  `energy` int NOT NULL DEFAULT '50',
  `health` int NOT NULL DEFAULT '100',
  `weapon_machete` int NOT NULL DEFAULT '0',
  `weapon_pistol` int NOT NULL DEFAULT '0',
  `weapon_ak` int NOT NULL DEFAULT '0',
  `boss_keys` int NOT NULL DEFAULT '0',
  `total_damage` bigint DEFAULT '0',
  `zone_fights` int DEFAULT '0',
  `dvor_wins` int DEFAULT '0',
  `bosses_killed` int DEFAULT '0',
  `habar_opened` int DEFAULT '0',
  `train_count` int DEFAULT '0',
  `vassilich_buys` int DEFAULT '0',
  `coins_earned` bigint DEFAULT '0',
  `stew_spent` bigint DEFAULT '0',
  `zone` text COLLATE utf8mb4_unicode_ci,
  `base_buildings` text COLLATE utf8mb4_unicode_ci,
  `base_stats` text COLLATE utf8mb4_unicode_ci,
  `base_location` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gang_id` int DEFAULT '0',
  `gang_data` text COLLATE utf8mb4_unicode_ci,
  `weapons` text COLLATE utf8mb4_unicode_ci,
  `shmot` text COLLATE utf8mb4_unicode_ci,
  `inventory` text COLLATE utf8mb4_unicode_ci,
  `hapuga_items` text COLLATE utf8mb4_unicode_ci,
  `hapuga_sold` int DEFAULT '0',
  `hapuga_refreshes` int DEFAULT '0',
  `hapuga_avail` text COLLATE utf8mb4_unicode_ci,
  `hapuga_next_ts` bigint DEFAULT '0',
  `bp_level` int DEFAULT '1',
  `bp_xp` int DEFAULT '0',
  `bp_xp_next` int DEFAULT '1000',
  `bp_claimed` text COLLATE utf8mb4_unicode_ci,
  `svod_claimed` text COLLATE utf8mb4_unicode_ci,
  `zadaniya` text COLLATE utf8mb4_unicode_ci,
  `zadaniya_day` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `habar_counts` text COLLATE utf8mb4_unicode_ci,
  `bot_settings` text COLLATE utf8mb4_unicode_ci,
  `bot_running` tinyint(1) DEFAULT '0',
  `days_played` int DEFAULT '0',
  `max_energy` int NOT NULL DEFAULT '50',
  `bosses_data` text COLLATE utf8mb4_unicode_ci,
  `zone_income_time` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `natisk_event_id` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `natisk_free_attempts` int NOT NULL DEFAULT '3',
  `natisk_paid_attempts` int NOT NULL DEFAULT '3',
  `natisk_kills` int NOT NULL DEFAULT '0',
  `stash_data` text COLLATE utf8mb4_unicode_ci,
  `roulette_winner` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `boss_kills_0` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_1` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_2` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `bj_games` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_games` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_spent` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_time` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_games` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_daily` text COLLATE utf8mb4_unicode_ci,
  `dvor_daily_sigs` text COLLATE utf8mb4_unicode_ci,
  `dvor_games_data` text COLLATE utf8mb4_unicode_ci,
  `dice_points` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `blue_points` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_chips` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_spichki` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_spichki` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_auto` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_gun` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_machete` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `respect` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nickname` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `natisk_seen_event_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `ach_score` int DEFAULT '0',
  `skills_data` text COLLATE utf8mb4_unicode_ci,
  `skill_points` int DEFAULT '0',
  `hata_progress` text COLLATE utf8mb4_unicode_ci,
  `base_bg_owned` text COLLATE utf8mb4_unicode_ci,
  `base_bg_active` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `zone_fights_0` int DEFAULT '0',
  `zone_fights_1` int DEFAULT '0',
  `zone_fights_2` int DEFAULT '0',
  `zone_fights_3` int DEFAULT '0',
  `zone_fights_4` int DEFAULT '0',
  `friends` text COLLATE utf8mb4_unicode_ci,
  `sedoy_dmg_total` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `sedoy_dmg_left` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_days_collected` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_cups` text COLLATE utf8mb4_unicode_ci,
  `keyring_owner` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `achievements` text COLLATE utf8mb4_unicode_ci,
  `achievement_stars` int DEFAULT '0',
  `coins_spent` bigint DEFAULT '0',
  `votes_spent` int DEFAULT '0',
  `str_xp_total` int DEFAULT '0',
  `login_streak` int DEFAULT '0',
  `last_login_day` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `habar_bought` int DEFAULT '0',
  `ryukzak_points` int DEFAULT '0',
  `ryukzak_claimed_level` int DEFAULT '0',
  `bullets` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `tatu` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nick` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `cards_games` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `cards_combos` text COLLATE utf8mb4_unicode_ci,
  `poker_games` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_combos` text COLLATE utf8mb4_unicode_ci,
  `roulette_games` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `solo_kills` text COLLATE utf8mb4_unicode_ci,
  `speed_kills` text COLLATE utf8mb4_unicode_ci,
  `habar_last_collect_ts` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_0` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_1` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_2` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_3` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_4` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_free_ts` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `stash_count` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_0` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_1` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_2` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_3` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_4` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_session` text COLLATE utf8mb4_unicode_ci,
  `yashik_session` text COLLATE utf8mb4_unicode_ci,
  `skills_levels` text COLLATE utf8mb4_unicode_ci,
  `poker_session` text COLLATE utf8mb4_unicode_ci,
  `blackjack_session` text COLLATE utf8mb4_unicode_ci,
  `zaruba_cooldowns` text COLLATE utf8mb4_unicode_ci,
  `gym_pump_cooldowns` text COLLATE utf8mb4_unicode_ci,
  `zaruba_last_ts` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `shmot_fragments` text COLLATE utf8mb4_unicode_ci,
  `lost_stash_pity` text COLLATE utf8mb4_unicode_ci,
  `dev_force_drops` tinyint(1) NOT NULL DEFAULT '0',
  `zadaniya_session` text COLLATE utf8mb4_unicode_ci,
  `boss_fight_session` text COLLATE utf8mb4_unicode_ci,
  `snd_vol` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT '0.7',
  `mus_vol` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT '0.5',
  `dev_force_jackpot` tinyint(1) NOT NULL DEFAULT '0',
  `dev_force_dice` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_poker` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_blackjack` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_roulette` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `friends_since` text COLLATE utf8mb4_unicode_ci,
  `onboarding_step` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `achievement_revoked` text COLLATE utf8mb4_unicode_ci,
  `friends_scope_granted` tinyint(1) NOT NULL DEFAULT '0',
  `pvp_wins` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gym_invites_sent` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_bought_ts` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `raznaryadka_data` text COLLATE utf8mb4_unicode_ci,
  `game2048_session` text COLLATE utf8mb4_unicode_ci,
  `game2048_daily` text COLLATE utf8mb4_unicode_ci,
  `game2048_fragments` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed_at` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_lifetime` text COLLATE utf8mb4_unicode_ci,
  `stash_claims` text COLLATE utf8mb4_unicode_ci,
  `stash_wishlist` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `boss_damage_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uid` int unsigned NOT NULL,
  `boss_id` tinyint unsigned NOT NULL,
  `diff_idx` tinyint unsigned NOT NULL,
  `damage` int unsigned NOT NULL,
  `critical` tinyint(1) NOT NULL DEFAULT '0',
  `is_sedoy` tinyint(1) NOT NULL DEFAULT '0',
  `time` bigint unsigned NOT NULL,
  `instance_id` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_uid_boss_time` (`uid`,`boss_id`,`diff_idx`,`time`),
  KEY `idx_instance` (`instance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `boss_instances` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `boss_id` tinyint unsigned NOT NULL,
  `diff_idx` tinyint unsigned NOT NULL,
  `owner_uid` int DEFAULT NULL,
  `max_hp` bigint unsigned NOT NULL,
  `current_hp` bigint unsigned NOT NULL,
  `status` enum('ALIVE','DEAD') NOT NULL DEFAULT 'ALIVE',
  `start_time` bigint unsigned NOT NULL,
  `end_time` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_shared_lookup` (`boss_id`,`diff_idx`,`owner_uid`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `boss_instance_claims` (
  `instance_id` int unsigned NOT NULL,
  `uid` int NOT NULL,
  `claimed_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`instance_id`,`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `boss_last_kill` (
  `boss_id` tinyint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `killed_at` int NOT NULL,
  PRIMARY KEY (`boss_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `roulette_state` (
  `id` tinyint unsigned NOT NULL,
  `spin_counter` int unsigned NOT NULL DEFAULT '0',
  `spin_threshold` int unsigned NOT NULL DEFAULT '3000',
  `kush_counter` int unsigned NOT NULL DEFAULT '0',
  `kush_threshold` int unsigned NOT NULL DEFAULT '6',
  `keyring_owner_id` int unsigned NOT NULL DEFAULT '0',
  `keyring_cycle_ends_at` int unsigned NOT NULL DEFAULT '0',
  `jackpot_pool` int unsigned DEFAULT '3000',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `zone_respect_leader` (
  `location_id` tinyint unsigned NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `amount` int unsigned NOT NULL DEFAULT '0',
  `updated_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `event_settings` (
  `key` varchar(50) NOT NULL,
  `value` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `reward_links` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(64) NOT NULL,
  `reward` text NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `created_at` int unsigned NOT NULL DEFAULT '0',
  `expires_at` int unsigned DEFAULT NULL,
  `active` tinyint unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `reward_link_claims` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `link_id` int unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `claimed_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_link_user` (`link_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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


INSERT INTO `roulette_state` (`id`) VALUES (1);
INSERT INTO `event_settings` (`key`,`value`) VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');
INSERT INTO `zone_respect_leader` (`location_id`) VALUES (0),(1),(2),(3),(4);

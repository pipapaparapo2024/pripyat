-- PROPOSED ONLY. Requires explicit approval before execution.
-- Fresh TEST databases only. No data import, ALTER, DROP, or production writes.

CREATE DATABASE `stalker_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `stalker_test`;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boss_instance_claims` (
  `instance_id` int unsigned NOT NULL,
  `uid` int NOT NULL,
  `claimed_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`instance_id`,`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boss_last_kill` (
  `boss_id` tinyint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `killed_at` int NOT NULL,
  PRIMARY KEY (`boss_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_settings` (
  `key` varchar(50) NOT NULL,
  `value` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reward_admin_totp` (
  `id` tinyint unsigned NOT NULL,
  `secret_ciphertext` text NOT NULL,
  `enabled_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `reward_admin_totp_singleton` CHECK ((`id` = 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reward_link_claims` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `link_id` int unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `claimed_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_link_user` (`link_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `secure` (
  `id` int NOT NULL,
  `token` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `req_key` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `time` int NOT NULL DEFAULT '0',
  `lifetime` int NOT NULL DEFAULT '2592000',
  `vk_params` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trans` (
  `tid` bigint NOT NULL,
  `uid` int NOT NULL,
  `time` int NOT NULL,
  `count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`tid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
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
  `zone` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_buildings` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_stats` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_location` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gang_id` int DEFAULT '0',
  `gang_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `weapons` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `shmot` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `inventory` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_items` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_sold` int DEFAULT '0',
  `hapuga_refreshes` int DEFAULT '0',
  `hapuga_avail` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_next_ts` bigint DEFAULT '0',
  `bp_level` int DEFAULT '1',
  `bp_xp` int DEFAULT '0',
  `bp_xp_next` int DEFAULT '1000',
  `bp_claimed` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `svod_claimed` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zadaniya` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zadaniya_day` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `habar_counts` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `bot_settings` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `bot_running` tinyint(1) DEFAULT '0',
  `days_played` int DEFAULT '0',
  `max_energy` int NOT NULL DEFAULT '50',
  `bosses_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zone_income_time` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `natisk_event_id` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `natisk_free_attempts` int NOT NULL DEFAULT '3',
  `natisk_paid_attempts` int NOT NULL DEFAULT '3',
  `natisk_kills` int NOT NULL DEFAULT '0',
  `stash_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `roulette_winner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `boss_kills_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `bj_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_spent` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_time` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_daily` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dvor_daily_sigs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dvor_games_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dice_points` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `blue_points` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_chips` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_spichki` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_spichki` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_auto` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_gun` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_machete` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `respect` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nickname` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `natisk_seen_event_id` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `ach_score` int DEFAULT '0',
  `skills_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `skill_points` int DEFAULT '0',
  `hata_progress` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_bg_owned` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_bg_active` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `zone_fights_0` int DEFAULT '0',
  `zone_fights_1` int DEFAULT '0',
  `zone_fights_2` int DEFAULT '0',
  `zone_fights_3` int DEFAULT '0',
  `zone_fights_4` int DEFAULT '0',
  `friends` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `sedoy_dmg_total` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `sedoy_dmg_left` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_days_collected` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_cups` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `keyring_owner` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `achievements` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `achievement_stars` int DEFAULT '0',
  `coins_spent` bigint DEFAULT '0',
  `votes_spent` int DEFAULT '0',
  `str_xp_total` int DEFAULT '0',
  `login_streak` int DEFAULT '0',
  `last_login_day` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `habar_bought` int DEFAULT '0',
  `ryukzak_points` int DEFAULT '0',
  `ryukzak_claimed_level` int DEFAULT '0',
  `bullets` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `tatu` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nick` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `cards_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `cards_combos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `poker_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_combos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `roulette_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `solo_kills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `speed_kills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `habar_last_collect_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_3` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_4` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_free_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `stash_count` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_3` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_4` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `yashik_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `skills_levels` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `poker_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `blackjack_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zaruba_cooldowns` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `gym_pump_cooldowns` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zaruba_last_ts` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `shmot_fragments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `lost_stash_pity` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dev_force_drops` tinyint(1) NOT NULL DEFAULT '0',
  `zadaniya_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `boss_fight_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `snd_vol` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0.7',
  `mus_vol` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0.5',
  `dev_force_jackpot` tinyint(1) NOT NULL DEFAULT '0',
  `dev_force_dice` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_poker` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_blackjack` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_roulette` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `friends_since` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `onboarding_step` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `achievement_revoked` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `friends_scope_granted` tinyint(1) NOT NULL DEFAULT '0',
  `pvp_wins` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gym_invites_sent` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_bought_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `raznaryadka_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_daily` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_fragments` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed_at` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_lifetime` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `stash_claims` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `stash_wishlist` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zone_respect_leader` (
  `location_id` tinyint unsigned NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `amount` int unsigned NOT NULL DEFAULT '0',
  `updated_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


INSERT INTO roulette_state (id) VALUES (1);
INSERT INTO event_settings (`key`,`value`) VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');
INSERT INTO zone_respect_leader (location_id) VALUES (0),(1),(2),(3),(4);

CREATE DATABASE `stalker_ok_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `stalker_ok_test`;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boss_instance_claims` (
  `instance_id` int unsigned NOT NULL,
  `uid` int NOT NULL,
  `claimed_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`instance_id`,`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boss_last_kill` (
  `boss_id` tinyint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `killed_at` int NOT NULL,
  PRIMARY KEY (`boss_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_settings` (
  `key` varchar(50) NOT NULL,
  `value` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ok_payment_transactions` (
  `transaction_id` varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `ok_uid` varchar(20) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `game_uid` bigint NOT NULL DEFAULT '0',
  `product_id` int NOT NULL,
  `amount` int NOT NULL,
  `reward_field` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `reward_count` bigint NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reward_link_claims` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `link_id` int unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `claimed_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_link_user` (`link_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `secure` (
  `id` int NOT NULL,
  `token` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `req_key` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `time` int NOT NULL DEFAULT '0',
  `lifetime` int NOT NULL DEFAULT '2592000',
  `vk_params` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trans` (
  `tid` bigint NOT NULL,
  `uid` int NOT NULL,
  `time` int NOT NULL,
  `count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`tid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
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
  `zone` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_buildings` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_stats` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_location` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gang_id` int DEFAULT '0',
  `gang_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `weapons` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `shmot` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `inventory` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_items` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_sold` int DEFAULT '0',
  `hapuga_refreshes` int DEFAULT '0',
  `hapuga_avail` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_next_ts` bigint DEFAULT '0',
  `bp_level` int DEFAULT '1',
  `bp_xp` int DEFAULT '0',
  `bp_xp_next` int DEFAULT '1000',
  `bp_claimed` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `svod_claimed` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zadaniya` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zadaniya_day` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `habar_counts` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `bot_settings` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `bot_running` tinyint(1) DEFAULT '0',
  `days_played` int DEFAULT '0',
  `max_energy` int NOT NULL DEFAULT '50',
  `bosses_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zone_income_time` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `natisk_event_id` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `natisk_free_attempts` int NOT NULL DEFAULT '3',
  `natisk_paid_attempts` int NOT NULL DEFAULT '3',
  `natisk_kills` int NOT NULL DEFAULT '0',
  `stash_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `roulette_winner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `boss_kills_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `bj_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_spent` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_time` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_daily` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dvor_daily_sigs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dvor_games_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dice_points` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `blue_points` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_chips` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_spichki` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_spichki` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_auto` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_gun` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_machete` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `respect` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nickname` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `natisk_seen_event_id` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `ach_score` int DEFAULT '0',
  `skills_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `skill_points` int DEFAULT '0',
  `hata_progress` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_bg_owned` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_bg_active` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `zone_fights_0` int DEFAULT '0',
  `zone_fights_1` int DEFAULT '0',
  `zone_fights_2` int DEFAULT '0',
  `zone_fights_3` int DEFAULT '0',
  `zone_fights_4` int DEFAULT '0',
  `friends` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `sedoy_dmg_total` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `sedoy_dmg_left` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_days_collected` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_cups` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `keyring_owner` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `achievements` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `achievement_stars` int DEFAULT '0',
  `coins_spent` bigint DEFAULT '0',
  `votes_spent` int DEFAULT '0',
  `str_xp_total` int DEFAULT '0',
  `login_streak` int DEFAULT '0',
  `last_login_day` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `habar_bought` int DEFAULT '0',
  `ryukzak_points` int DEFAULT '0',
  `ryukzak_claimed_level` int DEFAULT '0',
  `bullets` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `tatu` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nick` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `cards_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `cards_combos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `poker_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_combos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `roulette_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `solo_kills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `speed_kills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `habar_last_collect_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_3` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_4` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_free_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `stash_count` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_3` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_4` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `yashik_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `skills_levels` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `poker_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `blackjack_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zaruba_cooldowns` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `gym_pump_cooldowns` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zaruba_last_ts` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `shmot_fragments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `lost_stash_pity` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dev_force_drops` tinyint(1) NOT NULL DEFAULT '0',
  `zadaniya_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `boss_fight_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `snd_vol` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0.7',
  `mus_vol` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0.5',
  `dev_force_jackpot` tinyint(1) NOT NULL DEFAULT '0',
  `dev_force_dice` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_poker` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_blackjack` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_roulette` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `friends_since` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `onboarding_step` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `achievement_revoked` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `friends_scope_granted` tinyint(1) NOT NULL DEFAULT '0',
  `pvp_wins` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gym_invites_sent` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_bought_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `raznaryadka_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_daily` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_fragments` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed_at` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_lifetime` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `stash_claims` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `stash_wishlist` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zone_respect_leader` (
  `location_id` tinyint unsigned NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `amount` int unsigned NOT NULL DEFAULT '0',
  `updated_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


INSERT INTO roulette_state (id) VALUES (1);
INSERT INTO event_settings (`key`,`value`) VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');
INSERT INTO zone_respect_leader (location_id) VALUES (0),(1),(2),(3),(4);

CREATE DATABASE `stalker_telegram_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `stalker_telegram_test`;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boss_instance_claims` (
  `instance_id` int unsigned NOT NULL,
  `uid` int NOT NULL,
  `claimed_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`instance_id`,`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boss_last_kill` (
  `boss_id` tinyint unsigned NOT NULL,
  `user_id` int NOT NULL,
  `killed_at` int NOT NULL,
  PRIMARY KEY (`boss_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_settings` (
  `key` varchar(50) NOT NULL,
  `value` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reward_link_claims` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `link_id` int unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `claimed_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_link_user` (`link_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telegram_friend_invites` (
  `code` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `owner_player_id` int NOT NULL,
  `created_at` bigint unsigned NOT NULL,
  `revoked_at` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`code`),
  KEY `idx_invite_owner` (`owner_player_id`),
  CONSTRAINT `fk_tg_invite_player` FOREIGN KEY (`owner_player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telegram_friendships` (
  `player_low` int NOT NULL,
  `player_high` int NOT NULL,
  `friends_since_ms` bigint unsigned NOT NULL,
  PRIMARY KEY (`player_low`,`player_high`),
  KEY `idx_friend_high` (`player_high`),
  CONSTRAINT `fk_tg_friend_high` FOREIGN KEY (`player_high`) REFERENCES `telegram_identities` (`player_id`),
  CONSTRAINT `fk_tg_friend_low` FOREIGN KEY (`player_low`) REFERENCES `telegram_identities` (`player_id`),
  CONSTRAINT `chk_tg_friend_pair` CHECK ((`player_low` < `player_high`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telegram_identities` (
  `player_id` int NOT NULL AUTO_INCREMENT,
  `telegram_id` bigint unsigned NOT NULL,
  `created_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`player_id`),
  UNIQUE KEY `uq_telegram_id` (`telegram_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telegram_payment_orders` (
  `order_id` char(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `player_id` int NOT NULL,
  `telegram_id` bigint unsigned NOT NULL,
  `product_id` smallint unsigned NOT NULL,
  `stars` int unsigned NOT NULL,
  `reward_field` enum('stew','coins','cigarettes','energy') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reward_count` bigint unsigned NOT NULL,
  `status` enum('created','checkout','paid','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'created',
  `checkout_id` varchar(255) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `created_at` bigint unsigned NOT NULL,
  `expires_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`order_id`),
  KEY `idx_order_player` (`player_id`,`created_at`),
  CONSTRAINT `fk_tg_order_player` FOREIGN KEY (`player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telegram_payment_transactions` (
  `charge_id` varchar(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `order_id` char(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `player_id` int NOT NULL,
  `stars` int unsigned NOT NULL,
  `credited_at` bigint unsigned NOT NULL,
  `refunded_at` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`charge_id`),
  UNIQUE KEY `uq_tg_paid_order` (`order_id`),
  KEY `idx_payment_player` (`player_id`),
  CONSTRAINT `fk_tg_transaction_order` FOREIGN KEY (`order_id`) REFERENCES `telegram_payment_orders` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telegram_roles` (
  `player_id` int NOT NULL,
  `role` enum('developer','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`player_id`,`role`),
  CONSTRAINT `fk_tg_role_player` FOREIGN KEY (`player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
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
  `zone` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_buildings` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_stats` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_location` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gang_id` int DEFAULT '0',
  `gang_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `weapons` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `shmot` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `inventory` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_items` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_sold` int DEFAULT '0',
  `hapuga_refreshes` int DEFAULT '0',
  `hapuga_avail` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hapuga_next_ts` bigint DEFAULT '0',
  `bp_level` int DEFAULT '1',
  `bp_xp` int DEFAULT '0',
  `bp_xp_next` int DEFAULT '1000',
  `bp_claimed` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `svod_claimed` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zadaniya` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zadaniya_day` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `habar_counts` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `bot_settings` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `bot_running` tinyint(1) DEFAULT '0',
  `days_played` int DEFAULT '0',
  `max_energy` int NOT NULL DEFAULT '50',
  `bosses_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zone_income_time` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `natisk_event_id` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `natisk_free_attempts` int NOT NULL DEFAULT '3',
  `natisk_paid_attempts` int NOT NULL DEFAULT '3',
  `natisk_kills` int NOT NULL DEFAULT '0',
  `stash_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `roulette_winner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `boss_kills_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `boss_kills_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `bj_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_spent` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `energy_time` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dvor_daily` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dvor_daily_sigs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dvor_games_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dice_points` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `blue_points` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_chips` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_spichki` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_spichki` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_auto` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_gun` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `ammo_machete` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `respect` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nickname` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `natisk_seen_event_id` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `ach_score` int DEFAULT '0',
  `skills_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `skill_points` int DEFAULT '0',
  `hata_progress` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_bg_owned` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `base_bg_active` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `zone_fights_0` int DEFAULT '0',
  `zone_fights_1` int DEFAULT '0',
  `zone_fights_2` int DEFAULT '0',
  `zone_fights_3` int DEFAULT '0',
  `zone_fights_4` int DEFAULT '0',
  `friends` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `sedoy_dmg_total` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `sedoy_dmg_left` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_days_collected` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `roulette_cups` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `keyring_owner` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `achievements` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `achievement_stars` int DEFAULT '0',
  `coins_spent` bigint DEFAULT '0',
  `votes_spent` int DEFAULT '0',
  `str_xp_total` int DEFAULT '0',
  `login_streak` int DEFAULT '0',
  `last_login_day` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `habar_bought` int DEFAULT '0',
  `ryukzak_points` int DEFAULT '0',
  `ryukzak_claimed_level` int DEFAULT '0',
  `bullets` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `tatu` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `nick` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `cards_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `cards_combos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `poker_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `poker_combos` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `roulette_games` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `solo_kills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `speed_kills` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `habar_last_collect_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_3` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `loc_respect_4` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_free_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `stash_count` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_0` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_1` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_2` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_3` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `zone_collect_4` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `dice_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `yashik_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `skills_levels` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `poker_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `blackjack_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zaruba_cooldowns` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `gym_pump_cooldowns` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `zaruba_last_ts` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `shmot_fragments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `lost_stash_pity` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dev_force_drops` tinyint(1) NOT NULL DEFAULT '0',
  `zadaniya_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `boss_fight_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `snd_vol` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0.7',
  `mus_vol` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0.5',
  `dev_force_jackpot` tinyint(1) NOT NULL DEFAULT '0',
  `dev_force_dice` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_poker` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_blackjack` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dev_force_roulette` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `friends_since` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `onboarding_step` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `achievement_revoked` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `friends_scope_granted` tinyint(1) NOT NULL DEFAULT '0',
  `pvp_wins` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `gym_invites_sent` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `habar_bought_ts` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `raznaryadka_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_session` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_daily` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `game2048_fragments` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_games_completed_at` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `game2048_lifetime` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `stash_claims` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `stash_wishlist` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zone_respect_leader` (
  `location_id` tinyint unsigned NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `amount` int unsigned NOT NULL DEFAULT '0',
  `updated_at` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


INSERT INTO roulette_state (id) VALUES (1);
INSERT INTO event_settings (`key`,`value`) VALUES ('event_active','0'),('event_id',''),('event_ends_at','0');
INSERT INTO zone_respect_leader (location_id) VALUES (0),(1),(2),(3),(4);

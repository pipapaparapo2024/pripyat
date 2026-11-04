-- Telegram TEST only. Two new tables; no existing player columns are changed.
USE `stalker_telegram_test`;
CREATE TABLE `telegram_payment_orders` (
 `order_id` char(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `player_id` int NOT NULL,
 `telegram_id` bigint unsigned NOT NULL,
 `product_id` smallint unsigned NOT NULL,
 `stars` int unsigned NOT NULL,
 `reward_field` enum('stew','coins','cigarettes','energy') NOT NULL,
 `reward_count` bigint unsigned NOT NULL,
 `status` enum('created','checkout','paid','refunded') NOT NULL DEFAULT 'created',
 `checkout_id` varchar(255) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
 `created_at` bigint unsigned NOT NULL,
 `expires_at` bigint unsigned NOT NULL,
 PRIMARY KEY (`order_id`), KEY `idx_order_player` (`player_id`,`created_at`),
 CONSTRAINT `fk_tg_order_player` FOREIGN KEY (`player_id`) REFERENCES `telegram_identities` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `telegram_payment_transactions` (
 `charge_id` varchar(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `order_id` char(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 `player_id` int NOT NULL,
 `stars` int unsigned NOT NULL,
 `credited_at` bigint unsigned NOT NULL,
 `refunded_at` bigint unsigned DEFAULT NULL,
 PRIMARY KEY (`charge_id`), UNIQUE KEY `uq_tg_paid_order` (`order_id`),
 KEY `idx_payment_player` (`player_id`),
 CONSTRAINT `fk_tg_transaction_order` FOREIGN KEY (`order_id`) REFERENCES `telegram_payment_orders` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

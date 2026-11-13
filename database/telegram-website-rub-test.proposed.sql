-- Requires explicit approval. Telegram TEST only.
USE stalker_telegram_test;

CREATE TABLE site_payment_orders (
    id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    player_id INT NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    amount_minor INT UNSIGNED NOT NULL,
    currency CHAR(3) CHARACTER SET ascii NOT NULL DEFAULT 'RUB',
    reward_field ENUM('stew','coins','cigarettes','energy') NOT NULL,
    reward_count INT UNSIGNED NOT NULL,
    provider_payment_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    status ENUM('created','pending','succeeded','canceled') NOT NULL DEFAULT 'created',
    created_at BIGINT UNSIGNED NOT NULL,
    credited_at BIGINT UNSIGNED DEFAULT NULL,
    UNIQUE KEY uq_site_payment_provider (provider_payment_id),
    KEY ix_site_payment_player (player_id, created_at),
    FOREIGN KEY (player_id) REFERENCES telegram_identities (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_payment_receipts (
    provider_payment_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    order_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount_minor INT UNSIGNED NOT NULL,
    credited_at BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_site_payment_order (order_id),
    FOREIGN KEY (order_id) REFERENCES site_payment_orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

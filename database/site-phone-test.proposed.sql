-- Только предложение. Не применять без отдельного согласования пользователя.
-- Только stalker_site_test. Существующие таблицы не изменяются.
USE stalker_site_test;
CREATE TABLE site_phone_identities (
 player_id INT NOT NULL,
 phone_hmac CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 phone_encrypted VARBINARY(512) NOT NULL,
 verified_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY (player_id),
 UNIQUE KEY uq_site_phone (phone_hmac),
 FOREIGN KEY (player_id) REFERENCES site_accounts(player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE site_phone_checks (
 id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 owner_session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 phone_hmac CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 phone_encrypted VARBINARY(512) NOT NULL,
 provider_check_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
 purpose ENUM('register','change_email','change_phone') NOT NULL,
 player_id INT DEFAULT NULL,
 status ENUM('pending','verified','consumed','failed') NOT NULL DEFAULT 'pending',
 created_at BIGINT UNSIGNED NOT NULL,
 expires_at BIGINT UNSIGNED NOT NULL,
 consumed_at BIGINT UNSIGNED DEFAULT NULL,
 PRIMARY KEY (id),
 KEY ix_site_phone_checks (phone_hmac,created_at),
 KEY ix_site_phone_email_checks (email,created_at),
 FOREIGN KEY (player_id) REFERENCES site_accounts(player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

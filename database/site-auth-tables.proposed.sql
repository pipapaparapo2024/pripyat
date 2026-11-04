-- PROPOSED ONLY: four additional tables for native WEBSITE TEST accounts.
-- Run only after explicit approval, in stalker_site_test with ten common game tables.
CREATE TABLE site_accounts (
  player_id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email_verified_at BIGINT UNSIGNED DEFAULT NULL,
  auth_version INT UNSIGNED NOT NULL DEFAULT 1,
  disabled_at BIGINT UNSIGNED DEFAULT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (player_id), UNIQUE KEY uq_site_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_email_tokens (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  player_id INT NOT NULL,
  purpose ENUM('verify_email','reset_password') NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  consumed_at BIGINT UNSIGNED DEFAULT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (token_hash), KEY ix_site_email_token_owner (player_id,purpose),
  CONSTRAINT fk_site_email_token_account FOREIGN KEY (player_id) REFERENCES site_accounts(player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_test_invitations (
  email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  consumed_by INT DEFAULT NULL,
  consumed_at BIGINT UNSIGNED DEFAULT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (email), UNIQUE KEY uq_site_invitation_hash (token_hash),
  CONSTRAINT fk_site_invitation_account FOREIGN KEY (consumed_by) REFERENCES site_accounts(player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  player_id INT NOT NULL,
  request_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  auth_version INT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (token_hash), UNIQUE KEY uq_site_active_player (player_id),
  CONSTRAINT fk_site_session_account FOREIGN KEY (player_id) REFERENCES site_accounts(player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

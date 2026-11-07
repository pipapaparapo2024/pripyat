-- Применять только после согласования. Новые заявки, существующая дружба сохраняется.
USE stalker_site_test;
CREATE TABLE game_friend_requests (
 sender_id INT NOT NULL,
 recipient_id INT NOT NULL,
 status ENUM('pending','accepted','declined','canceled') NOT NULL DEFAULT 'pending',
 created_at BIGINT NOT NULL,
 updated_at BIGINT NOT NULL,
 PRIMARY KEY(sender_id,recipient_id),
 KEY incoming_requests(recipient_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
USE stalker_telegram_test;
CREATE TABLE game_friend_requests (
 sender_id INT NOT NULL,
 recipient_id INT NOT NULL,
 status ENUM('pending','accepted','declined','canceled') NOT NULL DEFAULT 'pending',
 created_at BIGINT NOT NULL,
 updated_at BIGINT NOT NULL,
 PRIMARY KEY(sender_id,recipient_id),
 KEY incoming_requests(recipient_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

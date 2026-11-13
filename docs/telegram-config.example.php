<?php
// Example only. Real config MUST live outside public document root and Git.
// PRIPYAT_TELEGRAM_CONFIG points to that file in the dedicated TEST PHP pool.
return [
    'enabled' => false,
    'stars_enabled' => false,
    // 'test' means Telegram's separate test network, not merely a game TEST deployment.
    // Use a bot created in that network and a separate database/config/vhost.
    'bot_api_environment' => 'production',
    // TEST VPS uses a local TLS-preserving relay to api.telegram.org.
    'bot_api_relay_port' => 10443,
    'environment' => 'test',
    'database' => 'stalker_telegram_test',
    'bot_token' => 'SET_PRIVATELY_ON_SERVER',
    'db_user' => 'SET_DEDICATED_TEST_USER',
    'db_password' => 'SET_PRIVATELY_ON_SERVER',
];

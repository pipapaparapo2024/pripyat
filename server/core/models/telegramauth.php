<?php
require_once __DIR__.'/telegramenvironment.php';
/** Telegram login boundary. Does not load Registry or select VK/OK databases. */
final class TelegramAuth {
    public static function verify(string $raw, string $botToken, int $now): array {
        if ($botToken === '' || strlen($raw) > 16384 || $raw === '') throw new InvalidArgumentException('invalid_init_data');
        $fields = [];
        foreach (explode('&', $raw) as $pair) {
            $parts = explode('=', $pair, 2);
            if (count($parts) !== 2 || preg_match('/%(?![0-9a-fA-F]{2})/', $pair)) throw new InvalidArgumentException('invalid_init_data');
            $key = urldecode($parts[0]); $value = urldecode($parts[1]);
            if (!preg_match('/^[a-z_]+$/D', $key) || array_key_exists($key, $fields)) throw new InvalidArgumentException('invalid_init_data');
            $fields[$key] = $value;
        }
        $hash = $fields['hash'] ?? '';
        unset($fields['hash']);
        if (!preg_match('/^[a-f0-9]{64}$/D', $hash)) throw new InvalidArgumentException('invalid_init_data');
        ksort($fields, SORT_STRING);
        $lines = [];
        foreach ($fields as $key => $value) $lines[] = $key . '=' . $value;
        $secret = hash_hmac('sha256', $botToken, 'WebAppData', true);
        if (!hash_equals(hash_hmac('sha256', implode("\n", $lines), $secret), $hash)) throw new InvalidArgumentException('invalid_init_data');
        $date = $fields['auth_date'] ?? '';
        if (!ctype_digit($date) || (int)$date < $now - 600 || (int)$date > $now + 30) throw new InvalidArgumentException('expired_init_data');
        $user = json_decode($fields['user'] ?? '', true, 32, JSON_THROW_ON_ERROR);
        // Telegram IDs have up to 52 significant bits; never narrow to the game's INT ID.
        $id = $user['id'] ?? null;
        if (!is_int($id) || $id <= 0 || $id > 4503599627370495 || ($user['is_bot'] ?? false)) throw new InvalidArgumentException('invalid_user');
        return ['telegram_id' => (string)$id, 'start_param'=>is_string($fields['start_param']??null)?$fields['start_param']:'', 'profile' => [
            'first_name'=>is_string($user['first_name'] ?? null) ? $user['first_name'] : 'Сталкер',
            'last_name'=>is_string($user['last_name'] ?? null) ? $user['last_name'] : '',
        ]];
    }

    public static function validateConfig(array $config): void {
        // First stage is TEST only. A client parameter cannot choose a database or bot.
        if (($config['enabled'] ?? false) !== true
            || !is_string($config['bot_token'] ?? null) || !preg_match('/^[0-9]+:[A-Za-z0-9_-]{20,}$/D', $config['bot_token'])) {
            throw new RuntimeException('telegram_disabled');
        }
        TelegramEnvironment::select($config);
    }

    /** Store must implement transaction + UNIQUE Telegram ID; injected for offline tests. */
    public static function login(string $raw, array $config, $store, int $now): array {
        self::validateConfig($config);
        $identity = self::verify($raw, $config['bot_token'], $now);
        return self::issueSession($identity,$store,$now);
    }
    /** Website JWT must verify cryptographically; posted IDs never reach the store. */
    public static function loginWebsite(string $jwt,array $jwks,string $clientId,?string $nonce,array $config,$store,int $now): array {
        self::validateConfig($config);
        require_once __DIR__.'/telegramoidc.php';
        $identity=TelegramOidc::verify($jwt,$jwks,$clientId,$nonce,$now);
        return self::issueSession($identity,$store,$now);
    }
    /** Identity must come exclusively from the server session created by a verified OIDC callback. */
    public static function loginVerifiedWebsiteSession(array $identity,array $config,$store,int $now): array {
        self::validateConfig($config);
        if(!is_string($identity['telegram_id']??null)||!preg_match('/^[1-9][0-9]{0,15}$/D',$identity['telegram_id'])
            ||!is_array($identity['profile']??null))throw new InvalidArgumentException('invalid_website_identity');
        return self::issueSession($identity,$store,$now);
    }
    private static function issueSession(array $identity,$store,int $now): array {
        $token = bin2hex(random_bytes(32));
        $requestKey = bin2hex(random_bytes(16));
        $store->begin();
        try {
            $uid = $store->resolvePlayer($identity['telegram_id'], $now);
            if ($uid <= 0 || $uid > 2147483647) throw new RuntimeException('invalid_game_id');
            $store->saveSession($uid, hash('sha256', $token), $now + 3600, $requestKey);
            $store->commit();
        } catch (Throwable $e) {
            $store->rollback();
            throw $e;
        }
        return ['platform'=>'telegram', 'environment'=>TelegramEnvironment::name(), 'player_id'=>(string)$uid,
            'token'=>$token, 'expires_at'=>$now + 3600, 'req_key'=>$requestKey, 'profile'=>$identity['profile'],
            'owner_diagnostics'=>$identity['telegram_id']==='1355806786',
            'roles'=>method_exists($store,'roles')?$store->roles($uid):[]];
    }
}

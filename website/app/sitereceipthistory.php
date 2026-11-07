<?php

final class SiteReceiptHistory
{
    public static function read(array $session, array $config): array
    {
        if (($config['access']['enabled'] ?? false) !== true) {
            throw new DomainException('login_required');
        }
        $auth = $session['site_authenticated'] ?? null;
        if ($auth !== null) {
            if (($auth['expires_at'] ?? 0) <= time()) {
                throw new DomainException('login_required');
            }
            $uid = (int)$auth['player_id'];
            ErasedAccounts::assertAllowed('site', $uid);
            $d = $config['database'];
            if ($d['database'] !== 'stalker_site_test' || !in_array($d['host'], ['127.0.0.1', 'localhost'], true)) {
                throw new RuntimeException('invalid_database');
            }
            $db = new PDO('mysql:host='.$d['host'].';dbname=stalker_site_test;charset=utf8mb4',
                $d['user'], $d['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $q = $db->prepare('SELECT email, auth_version FROM site_accounts WHERE player_id=? AND disabled_at IS NULL AND email_verified_at IS NOT NULL');
            $q->execute([$uid]);
            $account = $q->fetch(PDO::FETCH_ASSOC);
            $access = $config['access']['email'];
            if (!$account || (int)$account['auth_version'] !== (int)$auth['auth_version']
                || ($access['mode'] !== 'open' && !in_array(strtolower($account['email']), $access['ids'], true))) {
                throw new DomainException('login_required');
            }
        } else {
            if (!isset($session['social_verified'])) {
                throw new DomainException('login_required');
            }
            require_once __DIR__.'/socialidentity.php';
            $identity = SocialIdentity::resolve($session['social_verified'], $config);
            $db = $identity['db'];
            $uid = $identity['uid'];
            ErasedAccounts::assertAllowed($identity['platform'], $uid);
        }
        return self::orders($db, $uid, __DIR__.'/../private/npd-receipts');
    }

    public static function orders(PDO $db, int $uid, string $directory): array
    {
        $query = $db->prepare("SELECT o.provider_payment_id, o.amount_minor, o.credited_at,
            o.reward_field, o.reward_count FROM site_payment_orders o
            WHERE o.player_id=? AND o.status='succeeded' AND o.credited_at IS NOT NULL
            ORDER BY o.credited_at DESC LIMIT 30");
        $query->execute([$uid]);
        $items = [];
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $order) {
            $id = $order['provider_payment_id'];
            if (!is_string($id) || !preg_match('/^[a-zA-Z0-9-]{1,64}$/D', $id)) {
                continue;
            }
            $file = $directory.'/'.$id.'.json';
            if (!is_readable($file)) {
                continue;
            }
            $receipt = json_decode((string)file_get_contents($file), true);
            if (($receipt['payment_id'] ?? null) !== $id) {
                continue;
            }
            $status = $receipt['status'] ?? '';
            $url = $receipt['receipt_url'] ?? null;
            $items[] = [
                'amount_minor' => (int)$order['amount_minor'],
                'credited_at' => (int)$order['credited_at'],
                'reward_field' => $order['reward_field'],
                'reward_count' => (int)$order['reward_count'],
                'status' => $status,
                'receipt_url' => $status === 'registered' && is_string($url)
                    && parse_url($url, PHP_URL_SCHEME) === 'https'
                    && parse_url($url, PHP_URL_HOST) === 'lknpd.nalog.ru' ? $url : null,
            ];
        }
        return $items;
    }
}

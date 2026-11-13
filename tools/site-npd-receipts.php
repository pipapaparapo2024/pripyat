<?php
declare(strict_types=1);

// The credited-order ledger is the durable queue. Only orders created after activation qualify.

function npdRequest(string $key, string $path, ?array $order = null): ?array
{
    $curl = curl_init('https://npdcheck.ru/api/v1/' . $path);
    curl_setopt_array($curl, [
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 10,
    ]);
    if ($order !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($order, JSON_THROW_ON_ERROR));
    }
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($order === null && $status === 404) {
        return null;
    }
    if (!is_string($body) || !in_array($status, [200, 201], true)) {
        throw new RuntimeException('npd_http_' . $status);
    }
    return json_decode($body, true, 32, JSON_THROW_ON_ERROR);
}

function npdOrder(array $row, array $payment, string $world, string $shop): array
{
    SiteYooKassa::validatePaid($payment, $row, $shop, false);
    if (($payment['metadata']['game_world'] ?? '') !== $world
        || ($payment['refunded_amount']['value'] ?? '0.00') !== '0.00') {
        throw new DomainException('payment_requires_review');
    }
    $labels = [
        'stew' => 'тушёнка',
        'coins' => 'игровые рубли',
        'cigarettes' => 'сухари',
        'energy' => 'энергия',
    ];
    return [
        'provider' => 'yookassa',
        'external_id' => 'charge:' . $row['provider_payment_id'],
        'payment_id' => $row['provider_payment_id'],
        'description' => 'Игровые ресурсы «Припять»: ' . $labels[$row['reward_field']] . ', ' . (int)$row['reward_count'],
        'amount' => $payment['amount']['value'],
        'currency' => 'RUB',
    ];
}

function npdRefundStatus(array $payment, int $gross): ?string
{
    $refund = $payment['refunded_amount'] ?? ['currency' => 'RUB', 'value' => '0.00'];
    if (($refund['currency'] ?? '') !== 'RUB'
        || !preg_match('/^([0-9]{1,9})\.([0-9]{2})$/D', $refund['value'] ?? '', $parts)) {
        throw new DomainException('invalid_refund_amount');
    }
    $minor = (int)$parts[1] * 100 + (int)$parts[2];
    if ($minor > $gross) {
        throw new DomainException('invalid_refund_amount');
    }
    if ($minor === 0) {
        return null;
    }
    return $minor === $gross ? 'refund_review' : 'partial_refund';
}

function npdSave(string $file, array $state, int $mode): void
{
    $temporary = $file . '.tmp';
    if (file_put_contents($temporary, json_encode($state, JSON_THROW_ON_ERROR)) === false
        || !chmod($temporary, $mode) || !rename($temporary, $file)) {
        throw new RuntimeException('receipt_state_write_failed');
    }
}

function npdProcess(array $row, array $payload, callable $request): array
{
    $state = $request('orders/' . rawurlencode($payload['external_id']))
        ?? $request('orders', $payload);
    $receipt = $state['order'] ?? [];
    foreach (['payment_id', 'external_id', 'amount', 'currency'] as $field) {
        if (($receipt[$field] ?? null) !== $payload[$field]) {
            throw new DomainException('receipt_mismatch');
        }
    }
    $status = $receipt['status'] ?? '';
    if (!preg_match('/^[a-z_]{1,40}$/D', $status)) {
        throw new DomainException('receipt_status_invalid');
    }
    $result = ['payment_id' => $row['provider_payment_id'], 'status' => $status];
    if ($status === 'registered' && ($receipt['ready'] ?? false) === true) {
        $url = $receipt['receipt_url'] ?? '';
        if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL)
            || parse_url($url, PHP_URL_SCHEME) !== 'https'
            || parse_url($url, PHP_URL_HOST) !== 'lknpd.nalog.ru'
            || parse_url($url, PHP_URL_USER) !== null
            || !str_starts_with(parse_url($url, PHP_URL_PATH) ?? '', '/api/v1/receipt/')) {
            throw new DomainException('receipt_url_invalid');
        }
        $result['receipt_url'] = $url;
    }
    return $result;
}

function npdRun(bool $checkOnly): void
{
    require_once '/var/www/pripyat-site/app/siteyookassa.php';
    $dir = '/var/lib/pripyat-npdcheck';
    $cutoff = trim(file_get_contents($dir . '/started-at'));
    if (!preg_match('/^[1-9][0-9]{8,10}$/D', $cutoff)) {
        throw new RuntimeException('invalid_cutoff');
    }
    $key = trim(file_get_contents('/etc/pripyat/npdcheck-integration.key'));
    if (!str_starts_with($key, 'npdc_int_')) {
        throw new RuntimeException('invalid_key');
    }
    $runtime = json_decode(file_get_contents('/var/www/pripyat-site/private/site-runtime.json'), true, 32, JSON_THROW_ON_ERROR);
    $provider = new SiteYooKassa($runtime['payments']);
    if (!$provider->ready() || $provider->isTest() || $provider->shopId() !== '1517337') {
        throw new RuntimeException('invalid_shop');
    }
    $request = static fn(string $path, ?array $payload = null) => npdRequest($key, $path, $payload);
    if ($checkOnly) {
        $status = $request('status');
        if (($status['provider'] ?? '') !== 'yookassa' || ($status['shop_connected'] ?? false) !== true
            || ($status['subscription_active'] ?? false) !== true) {
            throw new RuntimeException('npd_not_ready');
        }
    }
    $worlds = ['site' => 'stalker_site_test', 'vk' => 'stalker', 'ok' => 'stalker_ok', 'telegram' => 'stalker_telegram'];
    $pdo = new PDO('mysql:unix_socket=/run/mysqld/mysqld.sock', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pending = 0;
    foreach ($worlds as $world => $schema) {
        $query = $pdo->prepare("SELECT o.* FROM `$schema`.site_payment_orders o
            JOIN `$schema`.site_payment_receipts r ON r.order_id=o.id
                AND r.provider_payment_id=o.provider_payment_id AND r.amount_minor=o.amount_minor
            WHERE o.created_at>? AND o.status='succeeded' AND o.credited_at IS NOT NULL");
        $query->execute([(int)$cutoff]);
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $id = $row['provider_payment_id'];
            if (!preg_match('/^[a-zA-Z0-9-]{1,64}$/D', $id)) {
                continue;
            }
            $file = $dir . '/' . $id . '.json';
            $published = ($world === 'telegram'
                ? '/var/lib/pripyat-telegram-website/receipts/'
                : '/var/www/pripyat-site/private/npd-receipts/') . $id . '.json';
            $old = is_file($file) ? json_decode(file_get_contents($file), true) : [];
            $terminal = in_array($old['status'] ?? '', ['review','failed','unknown','canceled','refund_review'], true);
            $registered = ($old['status'] ?? '') === 'registered' && isset($old['receipt_url']);
            $monitoring = $registered || ($old['status'] ?? '') === 'partial_refund';
            if ($terminal || ($monitoring && time() - ($old['refund_checked_at'] ?? 0) < 300)) {
                if (!$checkOnly && !is_file($published)) {
                    npdSave($published, $old, 0640);
                }
                continue;
            }
            $pending++;
            if ($checkOnly) {
                continue;
            }
            try {
                $payment = $provider->request('payments/' . $id);
                SiteYooKassa::validatePaid($payment, $row, $provider->shopId(), false);
                if (($payment['metadata']['game_world'] ?? '') !== $world) {
                    throw new DomainException('payment_world_mismatch');
                }
                $refund = npdRefundStatus($payment, (int)$row['amount_minor']);
                if ($refund !== null) {
                    $result = ['payment_id' => $id, 'status' => $refund];
                } elseif ($registered) {
                    $result = $old;
                } else {
                    $result = npdProcess($row, npdOrder($row, $payment, $world, $provider->shopId()), $request);
                }
                $result['refund_checked_at'] = time();
                npdSave($published, $result, 0640);
                npdSave($file, $result, 0600);
                if (($old['status'] ?? null) !== $result['status']) {
                    echo 'Receipt status: ' . $world . ' ' . $result['status'] . PHP_EOL;
                }
            } catch (Throwable $error) {
                $reason = $error->getMessage();
                error_log('NPD receipt needs attention: ' . $world . ' ' .
                    (preg_match('/^[a-z0-9_]{1,50}$/D', $reason) ? $reason : get_class($error)));
            }
        }
    }
    if ($checkOnly) {
        echo "NPD API connected, subscription active, payment ledgers readable. Pending: $pending\n";
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    umask(0077);
    try {
        npdRun(in_array('--check', $argv, true));
    } catch (Throwable $error) {
        error_log('NPD worker unavailable: ' . get_class($error));
        exit(1);
    }
}

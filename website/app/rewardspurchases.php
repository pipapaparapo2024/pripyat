<?php
require_once __DIR__.'/sitedonations.php';
require_once __DIR__.'/paymentattempts.php';
require_once __DIR__.'/rewardstotp-gate.php';
if (getenv('PRIPYAT_REWARDS_AUTH_CONFIG')) requireRewardsLogin();
if (($_SERVER['PRIPYAT_REWARDS_PURCHASES'] ?? '') !== '1' || !is_string($_SERVER['REMOTE_USER'] ?? null) || trim($_SERVER['REMOTE_USER']) === '') {
    http_response_code(403); exit('Доступ закрыт.');
}
requireRewardsTotp();
header('Cache-Control: private, no-store');
header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: text/html; charset=utf-8');
try {
    $report = SiteDonations::readForRewardsAdmin($_SERVER, static function (): array {
        return json_decode(file_get_contents(__DIR__.'/../private/site-runtime.json'), true, 32, JSON_THROW_ON_ERROR);
    });
} catch (DomainException $e) {
    if ($e->getMessage() === 'admin_login_required') {
        http_response_code(403);
        exit('Доступ закрыт.');
    }
    http_response_code(503);
    exit('История покупок временно недоступна.');
} catch (Throwable $e) {
    error_log('[rewards-purchases] report unavailable: '.get_class($e));
    http_response_code(503);
    exit('История покупок временно недоступна.');
}
$escape = static fn ($value): string => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$money = static fn (int $minor): string => number_format($minor / 100, 2, ',', ' ').' ₽';
$worlds = ['site'=>'Сайт','vk'=>'ВКонтакте','ok'=>'Одноклассники'];
$msk = new DateTimeZone('Europe/Moscow');
?>
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>История покупок — Припять</title>
    <link rel="stylesheet" href="style.css">
</head>
<body><main class="wrap">
<nav><h1>История покупок</h1><a href="index.php">К наградным ссылкам</a></nav>
<p><?= $escape($report['note']) ?></p>
<?php if ($report['unverified'] > 0): ?>
<p>Заказов, которые не удалось подтвердить: <?= (int)$report['unverified'] ?>.</p>
<?php endif; ?>
<?php foreach ([0 => 'Игроки', 1 => 'Разработчики'] as $group => $label):
    $items = array_filter($report['items'], static fn (array $row): bool => (int)$row['developer'] === $group);
    $sum = array_sum(array_column(array_filter($items, static fn ($row) => $row['credited_at'] !== null), 'amount_minor'));
?>
<section>
    <h2><?= $escape($label) ?> · <?= count($items) ?> · <?= $money($sum) ?></h2>
    <?php if (!$items): ?><p>Подтверждённых покупок нет.</p><?php else: ?>
    <table>
        <thead><tr><th>Игрок</th><th>Мир / ID</th><th>Дата и время (МСК)</th><th>Сумма</th><th>Статус и детали</th></tr></thead>
        <tbody>
        <?php foreach ($items as $row): ?>
            <tr>
                <td><?= $escape($row['nick']) ?></td>
                <td><?= $escape($worlds[$row['world']] ?? $row['world']) ?> / <?= $escape($row['player_id']) ?></td>
                <td><?= $escape((new DateTimeImmutable('@'.(int)$row['time']))->setTimezone($msk)->format('d.m.Y H:i')) ?></td>
                <td><?= $money((int)$row['amount_minor']) ?></td>
                <td><details><summary><?= $escape($row['order_status']) ?></summary><dl>
                <?php foreach ([
                    'order_id'=>'ID заказа', 'payment_id'=>'ID платежа', 'product_id'=>'ID товара',
                    'reward_field'=>'Ресурс', 'reward_count'=>'Количество', 'currency'=>'Валюта',
                    'provider_status'=>'Статус ЮKassa', 'provider_method'=>'Способ оплаты',
                    'provider_created_at'=>'Создание платежа', 'provider_captured_at'=>'Подтверждение оплаты',
                    'verification'=>'Проверка через API'
                ] as $field => $title): ?>
                    <dt><?= $escape($title) ?></dt><dd><?= $escape($row[$field] ?? '—') ?></dd>
                <?php endforeach; ?>
                <?php foreach (['created_at'=>'Создание заказа', 'credited_at'=>'Начисление'] as $field => $title): ?>
                    <dt><?= $escape($title) ?> (МСК)</dt>
                    <dd><?= $row[$field] ? $escape((new DateTimeImmutable('@'.(int)$row[$field]))->setTimezone($msk)->format('d.m.Y H:i:s')) : '—' ?></dd>
                <?php endforeach; ?>
                </dl>
                <h3>Сверка и доставка webhook</h3>
                <?php $attempts = PaymentAttempts::read(getenv('PRIPYAT_RECONCILE_STATE') ?: '/var/lib/pripyat-payment-reconcile', $row['world'], (string)$row['payment_id']); ?>
                <?php $attempts = array_merge($attempts, PaymentAttempts::read(getenv('PRIPYAT_WEBHOOK_AUDIT_DIR') ?: '/var/lib/pripyat-payment-webhooks', $row['world'], (string)$row['payment_id'])); usort($attempts, static fn($a,$b)=>$a['time']<=>$b['time']); $attempts=array_slice($attempts,-100); ?>
                <p>Последние доступные записи журнала (до 100). Отсутствие записи не подтверждает отсутствие попыток.</p>
                <?php foreach ($attempts as $attempt): ?>
                <p><?= $escape((new DateTimeImmutable('@'.$attempt['time']))->setTimezone($msk)->format('d.m.Y H:i:s')) ?> — <?= $escape($attempt['source']) ?>: <?= $escape($attempt['outcome']) ?> <?= $attempt['http_status'] ? '(HTTP '.(int)$attempt['http_status'].')' : '' ?> · <?= $escape($attempt['attempt_id']) ?></p>
                <?php endforeach; ?>
                </details></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</section>
<?php endforeach; ?>
</main></body></html>

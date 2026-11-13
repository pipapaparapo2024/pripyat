<?php
if (PHP_SAPI !== 'cli') exit(1);

function reconcilePendingPayments(PDO $db, callable $settle, callable $report): int {
    $orders = $db->query("SELECT provider_payment_id FROM site_payment_orders
        WHERE status='pending' AND credited_at IS NULL AND provider_payment_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 100");
    $failures = 0;
    foreach ($orders->fetchAll(PDO::FETCH_COLUMN) as $id) {
        try {
            $report($id, $settle($id));
        } catch (Throwable $error) {
            $failures++;
            $report($id, 'error:' . get_class($error));
        }
    }
    return $failures;
}

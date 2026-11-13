<?php
if (PHP_SAPI !== 'cli') exit(1);

function reconcilePendingPayments(PDO $db, callable $settle, callable $report): int {
    // A complete bounded-memory pass prevents permanently pending orders starving older ones.
    $after = '';
    $failures = 0;
    do {
        $query = $db->prepare("SELECT id, provider_payment_id FROM site_payment_orders
            WHERE status='pending' AND credited_at IS NULL AND provider_payment_id IS NOT NULL
            AND id > ? ORDER BY id LIMIT 100");
        $query->execute([$after]);
        $orders = $query->fetchAll(PDO::FETCH_ASSOC);
        foreach ($orders as $order) {
            $after = $order['id'];
            $id = $order['provider_payment_id'];
            $report($id, 'started');
            try { $result = $settle($id); }
            catch (Throwable $error) { $failures++; $result = 'error:' . get_class($error); }
            $report($id, $result);
        }
    } while (count($orders) === 100);
    return $failures;
}

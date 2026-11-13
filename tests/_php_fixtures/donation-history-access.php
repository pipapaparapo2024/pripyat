<?php
require __DIR__.'/../../website/app/sitedonations.php';
$loaded = false;
$loadConfig = static function () use (&$loaded): array {
    $loaded = true;
    throw new LogicException('config_loader_called');
};
foreach ([
    [],
    ['REMOTE_USER' => 'admin'],
    ['PRIPYAT_REWARDS_PURCHASES' => '1'],
    ['PRIPYAT_REWARDS_PURCHASES' => '1', 'REMOTE_USER' => ''],
    ['HTTP_PRIPYAT_REWARDS_PURCHASES' => '1', 'HTTP_REMOTE_USER' => 'admin'],
] as $server) {
    try {
        SiteDonations::readForRewardsAdmin($server, $loadConfig);
        throw new LogicException('Unauthorized report');
    } catch (DomainException $e) {
        if ($e->getMessage() !== 'admin_login_required' || $loaded) throw $e;
    }
}
try {
    SiteDonations::readForRewardsAdmin(['PRIPYAT_REWARDS_PURCHASES'=>'1', 'REMOTE_USER'=>'admin'], $loadConfig);
    throw new LogicException('Missing configuration check');
} catch (LogicException $e) {
    if (!$loaded || $e->getMessage() !== 'config_loader_called') throw $e;
}
$baseOrder = ['order_status'=>'canceled', 'credited_at'=>null];
$verified = 'verified';
$cases = [
    ['expired', $baseOrder, ['status'=>'canceled','paid'=>false,'cancellation_details'=>['reason'=>'expired_on_confirmation']], $verified, 'expired'],
    ['cancelled', $baseOrder, ['status'=>'canceled','paid'=>false,'cancellation_details'=>['reason'=>'canceled_by_user']], $verified, 'canceled'],
    ['paid_without_credit', $baseOrder, ['status'=>'succeeded','paid'=>true], $verified, 'paid_uncredited'],
    ['pending', $baseOrder, ['status'=>'pending','paid'=>false], $verified, 'pending'],
    ['unverified', ['order_status'=>'succeeded','credited_at'=>null], ['status'=>'succeeded','paid'=>true], 'verification_failed', 'unverified'],
];
foreach ($cases as [$name, $order, $payment, $verification, $expected]) {
    $actual = SiteDonations::historyStatus($order, $payment, $verification);
    if ($actual !== $expected) throw new RuntimeException($name.' classified as '.$actual);
}
if (SiteDonations::historyStatus(['order_status'=>'succeeded','credited_at'=>123], [], 'verification_failed') !== 'credited') {
    throw new RuntimeException('Previously recorded credit must remain a purchase if provider lookup is unavailable');
}
if (SiteDonations::historyStatus(['order_status'=>'created','credited_at'=>null], [], 'not_checked') !== 'created') {
    throw new RuntimeException('Unpaid intent must remain a separate attempt');
}
echo "PASS: only the authenticated rewards route can load the report configuration\n";
echo "PASS: expired, canceled, unpaid, paid-uncredited and credited orders are classified separately\n";

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
echo "PASS: only the authenticated rewards route can load the report configuration\n";

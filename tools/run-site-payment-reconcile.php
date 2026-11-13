<?php
if (PHP_SAPI !== 'cli') exit(1);
require_once __DIR__.'/site-payment-reconcile.php';
$app = is_dir(__DIR__.'/../website/app') ? __DIR__.'/../website/app' : __DIR__.'/../app';
require_once $app.'/sitepayments.php';
require_once __DIR__.'/../server/core/models/nativeprodboundary.php';

if ($argc !== 3 || !in_array($argv[2], ['site','vk','ok','telegram'], true)) exit(2);
$world = $argv[2];
$state = getenv('PRIPYAT_RECONCILE_STATE');
if (!$state || !is_dir($state) || !is_writable($state)) exit(2);
$lock = fopen($state.'/'.$world.'.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(3);
$journal = fopen($state.'/'.$world.'.jsonl', 'ab');
if (!$journal) exit(2);
chmod($state.'/'.$world.'.jsonl', 0640);
$config = json_decode(file_get_contents($argv[1]), true, 32, JSON_THROW_ON_ERROR);
if ($world === 'telegram') {
    $path = getenv('PRIPYAT_TELEGRAM_WEBSITE_PAYMENT_CONFIG');
    if (!$path) exit(2);
    $dbConfig = json_decode(file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
    if (($dbConfig['environment'] ?? '') !== 'prod') exit(2);
} else {
    $dbConfig = $world === 'site' ? $config['database'] : NativeProdBoundary::database($config['native'], $world);
}
$expected = ['site'=>'stalker_site_test','vk'=>'stalker','ok'=>'stalker_ok','telegram'=>'stalker_telegram'][$world];
if (($dbConfig['database'] ?? '') !== $expected || ($dbConfig['host'] ?? '') !== '127.0.0.1' || (int)($dbConfig['port'] ?? 3306) !== 3306) exit(2);
$db = new PDO("mysql:host=127.0.0.1;dbname=$expected;charset=utf8mb4", $dbConfig['user'], $dbConfig['password'],
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
exit(reconcilePendingPayments($db, static function ($id) use ($config, $db, $world) {
    [$provider] = SiteYooKassa::lookup($config, $id);
    return (new SitePayments($db, $provider, $world))->settle($id, time());
}, static function ($id, $result) use ($world) {
    global $journal;
    $line = json_encode(['time'=>time(),'source'=>'reconcile','world'=>$world,'payment_id'=>$id,'outcome'=>$result], JSON_THROW_ON_ERROR)."\n";
    if (fwrite($journal, $line) !== strlen($line) || !fflush($journal)) throw new RuntimeException('audit_write_failed');
}) > 0 ? 1 : 0);

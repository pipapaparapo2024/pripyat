<?php
if(PHP_SAPI !== 'cli' || realpath(__DIR__.'/..') !== '/var/www/stalker-native-test') exit(1);
chdir(__DIR__);
spl_autoload_register(static function(string $class): void {
    $file = __DIR__.'/core/models/'.strtolower($class).'.php';
    if(is_file($file)) require_once $file;
});
require_once __DIR__.'/core/controllers/habar.php';

$dryRun = ($argv[1] ?? '') === '--check';
if(count($argv) > 1 && (!$dryRun || count($argv) !== 2)) exit(1);
$config = json_decode(file_get_contents('/etc/pripyat/vk-ok-native-test.json'), true, 32, JSON_THROW_ON_ERROR);
if(($config['enabled'] ?? false) !== true || ($config['environment'] ?? '') !== 'test') exit(1);

$json = new Jsonloader();
$ops = new Gameops(['json' => $json]);
$days = intval($ops->catalog('habar_daily_config')['total_days']);
$dayMs = 86400000;
$today = $ops->mskNextResetMs() - $dayMs;
$firstActiveDay = $today - ($days - 1) * $dayMs;
$candidates = 0;
$processed = 0;
$failed = 0;
foreach(HabarAutoTest::WORLDS as $world){
    $creds = $config['databases'][$world];
    $db = HabarAutoTest::connect($world, $creds['user'], $creds['password']);
    $q = $db->prepare("SELECT id FROM users WHERE habar_bought BETWEEN 1 AND 4
        AND (COALESCE(habar_bought_ts,0)=0 OR habar_bought_ts>=?)
        AND COALESCE(habar_last_collect_ts,0)<?
        AND JSON_EXTRACT(IF(JSON_VALID(bot_settings),bot_settings,'{}'),'$.autoHabar') = CAST('true' AS JSON)
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(bot_settings),bot_settings,'{}'),'$.autoHabarAccessUntilMs')) AS UNSIGNED)>?
        ORDER BY id");
    $q->execute([$firstActiveDay, $today, (int) floor(microtime(true) * 1000)]);
    foreach($q->fetchAll(PDO::FETCH_COLUMN) as $uid){
        $uid = (int)$uid;
        if($world === 'stalker_test' && !in_array((string)$uid, $config['access']['vk']['ids'] ?? [], true)) continue;
        $candidates++;
        if($dryRun) continue;
        $lock = HabarAutoTest::lock($db, $world, $uid, 0);
        if($lock === null) continue;
        try {
            $registry = new ArrayObject([
                'db'=>$world, 'server'=>'127.0.0.1', 'user'=>$creds['user'], 'pass'=>$creds['password'],
                'uid'=>$uid, 'utb'=>'users', 'json'=>$json, 'db_sampler'=>new SampleLoader(),
                'habar_auto_test'=>true, 'req_key'=>null,
            ]);
            $registry['udb'] = new Database($registry);
            $registry['tools'] = new Tools($registry);
            ob_start();
            try {
                (new Habar($registry))->collectDay(true);
                $result = json_decode(ob_get_contents(), true);
                $outcome = ($result['ok'] ?? 0) === 1 ? 'collected' : match ((int) ($result['code'] ?? 99)) {
                    56 => 'disabled_or_access_unavailable',
                    57, 58 => 'no_active_habar',
                    59 => 'already_collected_today',
                    default => 'failed',
                };
                if($outcome === 'collected') $processed++;
                if($outcome === 'failed') $failed++;
                error_log("[habar-auto-test] world=$world uid=$uid outcome=$outcome");
            } finally {
                ob_end_clean();
            }
        } catch(Throwable $e){
            $failed++;
            error_log('[habar-auto-test] collection failed: '.get_class($e));
        } finally {
            HabarAutoTest::unlock($db, $lock);
        }
    }
}
echo json_encode(['check'=>$dryRun, 'candidates'=>$candidates, 'processed'=>$processed, 'failed'=>$failed]).PHP_EOL;
exit($failed === 0 ? 0 : 1);

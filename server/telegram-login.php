<?php
// Deliberately isolated entry point: no legacy Registry, no fallback database.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
require_once __DIR__ . '/core/models/telegramauth.php';
require_once __DIR__ . '/core/models/telegramloginstore.php';
require_once __DIR__ . '/core/models/telegramfriends.php';
require_once __DIR__ . '/core/models/telegramaccess.php';
require_once __DIR__ . '/core/models/rewardlinktargets.php';
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); throw new InvalidArgumentException('post_required'); }
    // Absolute path configured by the operator outside the public document root.
    $path = getenv('PRIPYAT_TELEGRAM_CONFIG');
    if (!$path || !is_file($path)) throw new RuntimeException('telegram_disabled');
    $config = require $path;
    TelegramAuth::validateConfig($config);
    $raw = $_POST['init_data'] ?? null;
    if (!is_string($raw)) throw new InvalidArgumentException('invalid_init_data');
    // Reject forged data BEFORE opening any DB connection.
    $identity=TelegramAuth::verify($raw, $config['bot_token'], time());
    if(!(new TelegramAccess)->allowed($identity['telegram_id'])){
        http_response_code(403);echo json_encode(['status'=>'error','code'=>'telegram_access_denied','text'=>'Закрытое тестирование. Запросите доступ у разработчика. Ваш Telegram ID: '.$identity['telegram_id']]);exit;
    }
    $db = new PDO('mysql:host=127.0.0.1;port=3306;dbname='.TelegramEnvironment::database().';charset=utf8mb4',
        $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false]);
    $actual = $db->query('SELECT DATABASE()')->fetchColumn();
    if ($actual !== TelegramEnvironment::database()) throw new RuntimeException('database_mismatch');
    $session=TelegramAuth::login($raw, $config, new TelegramLoginStore($db), time());
    $start=$identity['start_param'];
    $reward=str_starts_with($start,'g_')?substr($start,2):($_POST['reward_code']??'');
    if(is_string($reward)&&preg_match('/^r1_(?:test|prod)_telegram_[a-f0-9]{32}$/D',$reward)&&RewardLinkTargets::matches($reward,$config['database']))$session['reward_code']=$reward;
    // A URL invite is an opaque invitation, never an asserted user identity. Resolve it
    // only AFTER authenticating initData; signed start_param takes precedence.
    echo json_encode($session, JSON_THROW_ON_ERROR);
} catch (InvalidArgumentException | JsonException $e) {
    if (http_response_code() !== 405) http_response_code(401);
    echo json_encode(['status'=>'error', 'code'=>'telegram_auth_rejected']);
} catch (Throwable $e) {
    http_response_code(503);
    // Do not log raw initData, tokens, SQL errors or configuration secrets.
    echo json_encode(['status'=>'error', 'code'=>'telegram_unavailable']);
}

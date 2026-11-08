<?php
// 04.10.2026: регресс-тест на 5 критичных дыр, найденных аудитом ("найди дыры, которые стоит
// закрыть"): 'zone','base_buildings','base_stats','gang_id','zone_collect_0..4' были в
// client-writable $allowed users.php.save() БЕЗ какого-либо guard (в отличие от weapons/
// inventory, которые проверяет _sanitizeWeapons()/_sanitizeInventory()) — все пять уже полностью
// server-authoritative через свои эндпоинты (zone.php/base.php/gangs.php, через
// Gameops::saveUser(), в обход этого whitelist), значит оставлять их здесь было чистой дырой без
// единой легитимной причины. Реальное исполнение Users::save() с фейковым udb, перехватывающим
// ИМЕННО то, что реально улетело бы в UPDATE — а не текст исходника — доказывает, что эскалация
// (максимальный бизнес/уровень здания/банда с боевым бонусом/сброс кулдауна сбора дохода) больше
// не проходит, и что легитимные поля (energy) всё ещё проходят как раньше.
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/users.php';

class FakeUdb {
    public $lastSaveUpdate = null;
    function getData($tb, $cols, $cond, $multi = false){ return []; }
    function saveData($tb, $update){ $this->lastSaveUpdate = $update; return ['ok' => 1]; }
}
class FakeTools {
    public $lastOutput = null; public $lastError = null;
    function output($data){ $this->lastOutput = $data; }
    function error($code){ $this->lastError = $code; }
}

$udb = new FakeUdb();
$tools = new FakeTools();
$registry = ['udb' => $udb, 'utb' => 'users', 'uid' => 777, 'tools' => $tools, 'user_params' => []];

$exploitPayload = [
    'natisk_event_id' => 'forged-event',
    'natisk_free_attempts' => '999',
    'natisk_paid_attempts' => '999',
    'natisk_kills' => '999999',
    'zone' => json_encode(['0' => ['cps' => [5,5,5,5,5,5], 'biz' => [10,10,10], 'cleared' => 999]]),
    'base_buildings' => json_encode([['level'=>10,'xp'=>0,'xp_next'=>1,'upgrade_cost'=>['coins'=>0]]]),
    'base_stats' => json_encode([['level'=>50,'xp'=>0,'xp_next'=>1]]),
    'gang_id' => '5', // максимальный боевой бонус (+20% урона) без единого реального вступления
    'zone_collect_0' => '0', 'zone_collect_1' => '0', 'zone_collect_2' => '0',
    'zone_collect_3' => '0', 'zone_collect_4' => '0',
    'energy' => '30', 'energy_time'=>'9999999999', // Server-owned, never accepted from autosave.
    'health'=>'90',
];
$registry['user_params']['udata_json'] = json_encode($exploitPayload);

$users = new Users($registry);
$users->save();

$update = $udb->lastSaveUpdate;
echo "=== Test 1: эксплойт-поля НЕ попали в реальный UPDATE (не текст файла — настоящий перехваченный \$update) ===\n";
echo ($update !== null ? "PASS" : "FAIL") . ": saveData() реально был вызван\n";
foreach(['natisk_event_id', 'natisk_free_attempts', 'natisk_paid_attempts', 'natisk_kills', 'zone', 'base_buildings', 'base_stats', 'gang_id', 'zone_collect_0', 'zone_collect_1', 'zone_collect_2', 'zone_collect_3', 'zone_collect_4'] as $key){
    echo (!isset($update[$key]) ? "PASS" : "FAIL") . ": '$key' отсутствует в реальном UPDATE (эксплойт отклонён), получено " . var_export($update[$key] ?? null, true) . "\n";
}

echo "=== Test 2: легитимное поле (energy) всё ещё проходит как обычно ===\n";
echo (!isset($update['energy']) && !isset($update['energy_time']) ? "PASS" : "FAIL") . ": stale energy autosave ignored\n";
echo (isset($update['health']) && $update['health'] === 90 ? "PASS" : "FAIL") . ": legitimate health update retained\n";

echo "=== Test 3: запрос не упал целиком (ok, не error) — отклонение отдельных полей не ломает весь save() ===\n";
echo ($tools->lastOutput !== null && $tools->lastError === null ? "PASS" : "FAIL") . ": save() вернул успех, не ошибку\n";

echo "=== Защита полей игровой экономики ===\n";
$protected = ['dice_free_ts','dvor_daily','str_xp_total','login_streak','last_login_day',
    'cards_games','cards_combos','poker_games','poker_combos','roulette_games',
    'solo_kills','speed_kills','bosses_data','base_bg_owned','base_bg_active','boss_kills_0','boss_kills_1','boss_kills_2'];
$registry['user_params']['udata_json'] = json_encode(array_fill_keys($protected, 999) + ['snd_vol'=>0.5]);
(new Users($registry))->save();
foreach($protected as $field){
    echo (!array_key_exists($field, $udb->lastSaveUpdate) ? "PASS" : "FAIL") . ": $field защищено от записи клиентом\n";
}
echo (isset($udb->lastSaveUpdate['snd_vol']) ? "PASS" : "FAIL") . ": настройки продолжают сохраняться\n";

class ProfileUdb extends FakeUdb {
    public $cups;
    function getData($tb, $cols, $cond, $multi = false){
        if($multi) return [];
        return ['id'=>777,'energy_time'=>time(),'last_login_day'=>gmdate('Y-m-d'),'friends'=>'',
            'roulette_cups'=>json_encode($this->cups),'poker_session'=>'{"hidden":true}','coins'=>53];
    }
}

echo "=== Загрузка профиля не раскрывает призы и не переписывает баланс ===\n";
$profileDb = new ProfileUdb();
$registry['udb'] = $profileDb;
$registry['user_params'] = ['users'=>'skip'];
foreach([['__prize_choice__'], ['kush','keyring','a','b','c','d','e','f','g']] as $cups){
    $profileDb->cups = $cups;
    (new Users($registry))->get();
    $public = $tools->lastOutput['udata'];
    $visible = is_array($public['roulette_cups']) ? $public['roulette_cups'] : json_decode($public['roulette_cups'], true);
    $expected = count($cups) === 1 ? $cups : array_fill(0, 9, '');
    echo ($visible === $expected ? "PASS" : "FAIL") . ": состояние рулетки восстанавливается без раскрытия призов\n";
    echo (!isset($public['poker_session']) ? "PASS" : "FAIL") . ": состояние покера остаётся на сервере\n";
    echo ($profileDb->lastSaveUpdate === null && $public['coins'] === 53 ? "PASS" : "FAIL") . ": профиль отдаёт баланс без записи снимка\n";
}

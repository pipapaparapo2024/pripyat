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
    'zone' => json_encode(['0' => ['cps' => [5,5,5,5,5,5], 'biz' => [10,10,10], 'cleared' => 999]]),
    'base_buildings' => json_encode([['level'=>10,'xp'=>0,'xp_next'=>1,'upgrade_cost'=>['coins'=>0]]]),
    'base_stats' => json_encode([['level'=>50,'xp'=>0,'xp_next'=>1]]),
    'gang_id' => '5', // максимальный боевой бонус (+20% урона) без единого реального вступления
    'zone_collect_0' => '0', 'zone_collect_1' => '0', 'zone_collect_2' => '0',
    'zone_collect_3' => '0', 'zone_collect_4' => '0',
    'energy' => '30', // легитимное поле — должно пройти как и раньше
];
$registry['user_params']['udata_json'] = json_encode($exploitPayload);

$users = new Users($registry);
$users->save();

$update = $udb->lastSaveUpdate;
echo "=== Test 1: эксплойт-поля НЕ попали в реальный UPDATE (не текст файла — настоящий перехваченный \$update) ===\n";
echo ($update !== null ? "PASS" : "FAIL") . ": saveData() реально был вызван\n";
foreach(['zone', 'base_buildings', 'base_stats', 'gang_id', 'zone_collect_0', 'zone_collect_1', 'zone_collect_2', 'zone_collect_3', 'zone_collect_4'] as $key){
    echo (!isset($update[$key]) ? "PASS" : "FAIL") . ": '$key' отсутствует в реальном UPDATE (эксплойт отклонён), получено " . var_export($update[$key] ?? null, true) . "\n";
}

echo "=== Test 2: легитимное поле (energy) всё ещё проходит как обычно ===\n";
echo (isset($update['energy']) && $update['energy'] === 30 ? "PASS" : "FAIL") . ": 'energy' сохранился (30), получено " . var_export($update['energy'] ?? null, true) . "\n";

echo "=== Test 3: запрос не упал целиком (ok, не error) — отклонение отдельных полей не ломает весь save() ===\n";
echo ($tools->lastOutput !== null && $tools->lastError === null ? "PASS" : "FAIL") . ": save() вернул успех, не ошибку\n";

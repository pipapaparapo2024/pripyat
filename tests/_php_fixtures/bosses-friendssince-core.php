<?php
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/bosses.php';

function invokePrivate($obj, $method, $args) {
    $ref = new ReflectionMethod($obj, $method);
    return $ref->invokeArgs($obj, $args);
}

$bosses = new Bosses([]);

echo "=== Test 1: _myFightStart() — пустой/старый плоский/новый вложенный форматы ===\n";
$r1 = invokePrivate($bosses, '_myFightStart', [[], 0, 1]);
echo ($r1 === 0 ? "PASS" : "FAIL") . ": пустые данные -> 0 (бой не активен), получено " . var_export($r1, true) . "\n";

$dataNested = ['bossStartMs' => [[0,0,0,0,0,0,0,0], [0, 1700000000000, 0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]]];
$r2 = invokePrivate($bosses, '_myFightStart', [$dataNested, 1, 1]);
echo ($r2 === 1700000000000 ? "PASS" : "FAIL") . ": вложенный формат [diffIdx][bossId] -> корректный startMs, получено " . var_export($r2, true) . "\n";

$dataFlat = ['bossStartMs' => [0, 0, 1650000000000, 0, 0, 0, 0, 0]];
$r3 = invokePrivate($bosses, '_myFightStart', [$dataFlat, 0, 2]);
echo ($r3 === 1650000000000 ? "PASS" : "FAIL") . ": старый плоский формат (миграция) -> корректный startMs, получено " . var_export($r3, true) . "\n";

echo "=== Test 2: _friendsSinceMap() — новый друг получает метку 'сейчас', старый сохраняет свою ===\n";
$now = intval(round(microtime(true) * 1000));
$user = ['friends_since' => json_encode(['111' => $now - 500000])]; // друг 111 уже известен 500с назад
$sinceMs = $now - 999999999; // старт боя давно

// &$user прямо в литерале массива аргументов — invokeArgs() сохраняет передачу по ссылке,
// только если это реальная переменная в самом массиве (без промежуточных функций-обёрток,
// которые скопировали бы значение и потеряли ссылку).
$refMap = new ReflectionMethod($bosses, '_friendsSinceMap');
$friendsSince1 = $refMap->invokeArgs($bosses, [&$user, [111, 222], $sinceMs]);

echo (isset($friendsSince1[111]) && $friendsSince1[111] === ($now - 500000) ? "PASS" : "FAIL")
    . ": известный друг (111) -> effectiveSinceMs = max(sinceMs, storedSince) = storedSince (он позже), получено " . var_export($friendsSince1[111] ?? null, true) . "\n";
echo (isset($friendsSince1[222]) && $friendsSince1[222] >= $now - 2000 ? "PASS" : "FAIL")
    . ": НОВЫЙ друг (222, не было в friends_since) -> метка 'сейчас' (бутстрап), получено " . var_export($friendsSince1[222] ?? null, true) . "\n";

$storedAfter = json_decode($user['friends_since'], true);
echo (isset($storedAfter['222']) ? "PASS" : "FAIL") . ": \$user['friends_since'] реально мутирован — новый uid 222 записан (persist для следующего вызова)\n";
echo (isset($storedAfter['111']) && $storedAfter['111'] === ($now - 500000) ? "PASS" : "FAIL") . ": старая метка друга 111 НЕ переписана (дружба не 'молодеет' задним числом)\n";

echo "=== Test 3 (КОРЕНЬ сегодняшнего бага): _friendsSinceConds() — карта даёт РЕАЛЬНЫЕ uid в SQL, плоский список — мусорные индексы ===\n";
$map = [382448269 => $now - 1000, 657771445 => $now - 2000];
$condFromMap = invokePrivate($bosses, '_friendsSinceConds', [$map]);
echo (strpos($condFromMap, 'uid`=382448269') !== false && strpos($condFromMap, 'uid`=657771445') !== false ? "PASS" : "FAIL")
    . ": карта (правильный вход) -> SQL содержит РЕАЛЬНЫЕ uid друзей, условие: " . $condFromMap . "\n";

$flatList = [382448269, 657771445]; // ТОЧНО тот баг, что был сегодня — сырой список вместо карты
$condFromFlat = invokePrivate($bosses, '_friendsSinceConds', [$flatList]);
echo (strpos($condFromFlat, 'uid`=0') !== false ? "PASS" : "FAIL")
    . ": РЕГРЕСС-ПРУФ — плоский список (баг) реально даёт мусорный 'uid=0' (индекс массива вместо uid) в НАСТОЯЩЕМ PHP foreach, не в JS-имитации: " . $condFromFlat . "\n";
echo (strpos($condFromFlat, 'uid`=382448269') === false ? "PASS" : "FAIL")
    . ": и подтверждение — реального uid 382448269 в этом мусорном условии СОВСЕМ нет (SQL никогда не совпадёт ни с одной строкой лога)\n";

<?php
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/game2048.php';

function invokePrivate($obj, $method, $args) {
    $ref = new ReflectionMethod($obj, $method);
    return $ref->invokeArgs($obj, $args);
}

$g = new Game2048([]);

echo "=== Test 1: _slideLine() — слияние один раз за ход, классика 2048 ===\n";
$r1 = invokePrivate($g, '_slideLine', [[2, 2, 2, 2]]);
echo ($r1[0] === [4, 4, 0, 0] && $r1[1] === 8 ? "PASS" : "FAIL")
    . ": [2,2,2,2] -> [4,4,0,0], score+8 (каждая плитка сливается РОВНО один раз), получено " . json_encode($r1) . "\n";

$r2 = invokePrivate($g, '_slideLine', [[2, 0, 2, 0]]);
echo ($r2[0] === [4, 0, 0, 0] ? "PASS" : "FAIL") . ": [2,0,2,0] -> [4,0,0,0] (пустые клетки схлопываются), получено " . json_encode($r2[0]) . "\n";

$r3 = invokePrivate($g, '_slideLine', [[2, 4, 8, 16]]);
echo ($r3[0] === [2, 4, 8, 16] && $r3[1] === 0 ? "PASS" : "FAIL") . ": [2,4,8,16] без пар -> не меняется, score+0, получено " . json_encode($r3) . "\n";

$r4 = invokePrivate($g, '_slideLine', [[0, 0, 0, 0]]);
echo ($r4[0] === [0, 0, 0, 0] ? "PASS" : "FAIL") . ": пустая линия -> остаётся пустой\n";

echo "=== Test 2: _applyMove() — направления, changed-флаг, слияние НЕ распространяется цепочкой ===\n";
// 4×4, строка 0: [2,2,4,4], остальные пустые. left -> [4,8,0,0] (4+4=8, НЕ 4+4+4=12 цепочкой).
$board = array_fill(0, 16, 0);
$board[0] = 2; $board[1] = 2; $board[2] = 4; $board[3] = 4;
list($newBoard, $gained, $changed) = invokePrivate($g, '_applyMove', [$board, 'left']);
echo ($newBoard[0] === 4 && $newBoard[1] === 8 && $newBoard[2] === 0 && $changed === true ? "PASS" : "FAIL")
    . ": строка [2,2,4,4] left -> [4,8,0,0], changed=true, получено row=" . json_encode(array_slice($newBoard, 0, 4)) . "\n";
echo ($gained === 12 ? "PASS" : "FAIL") . ": score за ход = 4+8=12, получено $gained\n";

// Ход без изменений (поле уже прижато вправо, ходим вправо снова) -> changed=false.
$board2 = array_fill(0, 16, 0);
$board2[2] = 2; $board2[3] = 4; // уже у правого края строки 0
list(, , $changed2) = invokePrivate($g, '_applyMove', [$board2, 'right']);
echo ($changed2 === false ? "PASS" : "FAIL") . ": ход, не меняющий поле (уже прижато к краю) -> changed=false (ТЗ: не создаёт новую плитку)\n";

// up/down — проверка, что слайд идёт по СТОЛБЦАМ, не по строкам.
$board3 = array_fill(0, 16, 0);
$board3[0 * 4 + 0] = 2; $board3[3 * 4 + 0] = 2; // столбец 0: верх и низ по 2
list($newBoard3, , ) = invokePrivate($g, '_applyMove', [$board3, 'up']);
echo ($newBoard3[0] === 4 ? "PASS" : "FAIL") . ": столбец [2,0,0,2] up -> верхняя ячейка столбца = 4, получено " . $newBoard3[0] . "\n";

echo "=== Test 3: _hasValidMoves() — автозавершение партии (ТЗ п.2) ===\n";
$full_no_moves = [
    2,4,2,4,  4,2,4,2,  2,4,2,4,  4,2,4,2,
];
echo (invokePrivate($g, '_hasValidMoves', [$full_no_moves]) === false ? "PASS" : "FAIL")
    . ": поле заполнено БЕЗ соседних пар (шахматный узор) -> нет ходов -> партия должна завершиться\n";

$full_with_pair = $full_no_moves;
$full_with_pair[1] = 2; // соседние 2,2 в строке 0
echo (invokePrivate($g, '_hasValidMoves', [$full_with_pair]) === true ? "PASS" : "FAIL")
    . ": поле заполнено, но есть соседняя пара -> ходы ЕСТЬ, получено " . var_export(invokePrivate($g, '_hasValidMoves', [$full_with_pair]), true) . "\n";

$has_empty = array_fill(0, 16, 2); $has_empty[5] = 0;
echo (invokePrivate($g, '_hasValidMoves', [$has_empty]) === true ? "PASS" : "FAIL")
    . ": есть пустая клетка -> ходы есть вне зависимости от пар\n";

echo "=== Test 4: _weightedSpawn() — распределение ~90%/10% (ТЗ приёмка, большая выборка) ===\n";
$catalog = json_decode(file_get_contents(__DIR__ . '/../../server/json/game2048_config.json'), true);
$counts = [2 => 0, 4 => 0];
$N = 20000;
for($i = 0; $i < $N; $i++){
    $v = invokePrivate($g, '_weightedSpawn', [$catalog]);
    $counts[$v] = ($counts[$v] ?? 0) + 1;
}
$pct2 = $counts[2] / $N * 100;
echo ($pct2 > 85 && $pct2 < 95 ? "PASS" : "FAIL") . ": доля плитки 2 ≈90% на выборке $N, получено " . round($pct2, 2) . "%\n";
echo (array_keys($counts) === [2, 4] || (isset($counts[2]) && isset($counts[4]) && count($counts) === 2) ? "PASS" : "FAIL")
    . ": выпадают только значения 2 и 4, получено ключи " . json_encode(array_keys($counts)) . "\n";

echo "=== Test 5: _grantNewThresholds() — идемпотентность в рамках ОДНОЙ партии (ТЗ п.4) ===\n";
$user = ['exp' => '0', 'cigarettes' => '0', 'coins' => '0'];
$session = ['maxTile' => 256, 'type' => 'free', 'rewardedThresholds' => [], 'rewardsThisSession' => []];
$granted1 = invokePrivate($g, '_grantNewThresholds', [&$user, &$session, $catalog]);
$coinsAfterFirst = intval($user['coins']);
echo (count($granted1) > 0 && $coinsAfterFirst === 2 ? "PASS" : "FAIL")
    . ": первое достижение 256 -> +2 рубля (из конфига), получено coins=" . $user['coins'] . " granted=" . json_encode($granted1) . "\n";

// Вторая плитка 256 в ТОЙ ЖЕ партии (maxTile не меняется) -> ничего нового не начисляется.
$granted2 = invokePrivate($g, '_grantNewThresholds', [&$user, &$session, $catalog]);
echo (count($granted2) === 0 && intval($user['coins']) === $coinsAfterFirst ? "PASS" : "FAIL")
    . ": повторный вызов с тем же maxTile=256 -> НИЧЕГО не начисляется повторно (coins не растёт), получено coins=" . $user['coins'] . "\n";

// Новая партия (rewardedThresholds сброшен) -> порог 256 снова доступен.
$session2 = ['maxTile' => 256, 'type' => 'free', 'rewardedThresholds' => [], 'rewardsThisSession' => []];
$granted3 = invokePrivate($g, '_grantNewThresholds', [&$user, &$session2, $catalog]);
echo (count($granted3) > 0 && intval($user['coins']) === $coinsAfterFirst + 2 ? "PASS" : "FAIL")
    . ": НОВАЯ партия (пустой rewardedThresholds) -> порог 256 снова доступен, получено coins=" . $user['coins'] . "\n";

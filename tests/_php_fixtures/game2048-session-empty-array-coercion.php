<?php
// Фикстура для tests/game2048-session-empty-array-coercion.test.js — РЕАЛЬНОЕ исполнение
// Game2048::_loadSession() (приватный метод, чистая логика на входных данных — не трогает
// $link/$this->ops, поэтому без всякого мока, см. tests/_php_bin.js).
//
// Баг: Database::trueJSON() молча подменяет NULL JSON-подобное поле на [] (пустой массив),
// когда $this->sample ложный (а он всегда ложный — core/samples/tables/ пустая папка). Значит
// $user['game2048_session'] у игрока без активной партии РЕАЛЬНО приходит как [] (не null) —
// _loadSession() должен отличать этот артефакт от настоящей сессии (у которой всегда есть
// ключ 'board', см. start()).

require_once 'core/models/jsonloader.php';
require_once 'core/models/gameops.php';
require_once 'core/controllers/game2048.php';

$passed = 0; $failed = 0;
function assertTrue($cond, $msg){
    global $passed, $failed;
    if($cond){ echo "PASS: $msg\n"; $passed++; }
    else     { echo "FAIL: $msg\n"; $failed++; }
}

$game = new Game2048([]);
$method = new ReflectionMethod('Game2048', '_loadSession');

// === Test 1: артефакт коэрсии trueJSON() (пустой массив вместо null) — должен считаться "нет сессии" ===
$result1 = $method->invoke($game, ['game2048_session' => []]);
assertTrue($result1 === null, '_loadSession() с game2048_session=[] (артефакт trueJSON) возвращает null, не []');

// === Test 2: настоящий null — тоже "нет сессии" (без регресса) ===
$result2 = $method->invoke($game, ['game2048_session' => null]);
assertTrue($result2 === null, '_loadSession() с game2048_session=null возвращает null');

// === Test 3: ключ вообще отсутствует в $user — тоже "нет сессии" ===
$result3 = $method->invoke($game, []);
assertTrue($result3 === null, '_loadSession() без ключа game2048_session вообще возвращает null');

// === Test 4: НАСТОЯЩАЯ активная сессия (валидный JSON с board) — должна вернуться КАК ЕСТЬ ===
$realSession = [
    'board' => array_fill(0, 16, 0), 'score' => 0, 'maxTile' => 2, 'type' => 'free',
    'attemptIndex' => 1, 'rewardedThresholds' => [], 'rewardsThisSession' => [], 'moveSeq' => 0,
    'startedAt' => 1700000000000,
];
$result4 = $method->invoke($game, ['game2048_session' => json_encode($realSession)]);
assertTrue(is_array($result4), 'настоящая сессия (JSON-строка с board) распознаётся как массив');
assertTrue($result4['moveSeq'] === 0 && count($result4['board']) === 16, 'настоящая сессия декодируется корректно (moveSeq/board целы)');

// === Test 5: настоящая сессия, пришедшая УЖЕ декодированной в массив (trueJSON сработал как
// задумано для валидного JSON) — тоже должна пройти, не только строковый путь ===
$result5 = $method->invoke($game, ['game2048_session' => $realSession]);
assertTrue(is_array($result5) && isset($result5['board']), 'настоящая сессия, уже являющаяся массивом (не строкой), тоже распознаётся');

// === Test 6: регресс-гвард — пустая СТРОКА '' тоже "нет сессии" (отдельный путь от []) ===
$result6 = $method->invoke($game, ['game2048_session' => '']);
assertTrue($result6 === null, '_loadSession() с game2048_session="" (пустая строка) возвращает null');

echo "\n=== РЕЗУЛЬТАТ ===\n";
echo "passed=$passed failed=$failed\n";
if($failed > 0) exit(1);

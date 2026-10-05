<?php
// 04.10.2026: аудит проекта нашёл AchievementEngine::checkAll() (server/core/models/
// achievementengine.php) — реальный расчёт очков достижений + rollover ach_score→bullets
// (каждые 50 очков = 1 патрон ящика) — БЕЗ единого теста, хотя это активная экономика (очки
// достижений + патроны начисляются КАЖДЫЙ раз, когда игрок пересекает любой из 300+ порогов
// каталога). Функция не трогает $link/БД — принимает $catalog как обычный массив, поэтому
// тестируется напрямую, без фейкового mysqli.
require __DIR__ . '/../../server/core/models/achievementengine.php';

// Минимальный фейковый Gameops — i()/j() с той же сигнатурой, что настоящий класс.
class FakeOps {
    function i($user, $key, $default = 0){ return intval(isset($user[$key]) ? $user[$key] : $default); }
    function j($user, $key, $default = []){
        if(!isset($user[$key]) || $user[$key] === '' || $user[$key] === null) return $default;
        if(is_array($user[$key])) return $user[$key];
        $decoded = json_decode($user[$key], true);
        return is_array($decoded) ? $decoded : $default;
    }
}
$ops = new FakeOps();

// checkAll() только ПРИСВАИВАЕТ $user[key] внутри своих if/while-веток — если ветка не
// сработала (например, ach_score не дотянул до 50), поле остаётся КАК БЫЛО ПЕРЕДАНО (строкой
// '0' из фикстуры, не int 0). Сравниваем через intval(), чтобы не путать это с реальным багом.
function iv($user, $key){ return intval($user[$key] ?? 0); }

echo "=== Test 1: одно достижение пересекает порог — earned=true, stars начислены, ach_score копится ===\n";
{
    $catalog = [
        ['id' => 'dmg_1000', 'statPath' => ['dmg'], 'threshold' => 1000, 'pts' => 10],
    ];
    $user = ['total_damage' => '1500', 'achievements' => '{}', 'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);

    echo (count($newlyEarned) === 1 && $newlyEarned[0]['id'] === 'dmg_1000' ? "PASS" : "FAIL") . ": ровно одно новое достижение, правильный id\n";
    $earnedMap = json_decode($outUser['achievements'], true);
    echo (!empty($earnedMap['dmg_1000']) ? "PASS" : "FAIL") . ": earned-карта содержит dmg_1000=true\n";
    echo (iv($outUser, 'achievement_stars') === 10 ? "PASS" : "FAIL") . ": achievement_stars = 10 (было 0 + pts), получено " . var_export($outUser['achievement_stars'] ?? null, true) . "\n";
    echo (iv($outUser, 'ach_score') === 10 ? "PASS" : "FAIL") . ": ach_score = 10 (меньше 50 — патрон НЕ выдан)\n";
    echo (iv($outUser, 'bullets') === 0 ? "PASS" : "FAIL") . ": bullets не изменились (патроны выдаются только при ach_score>=50)\n";
}

echo "=== Test 2: НЕ пересечённый порог не засчитывается ===\n";
{
    $catalog = [
        ['id' => 'dmg_1000', 'statPath' => ['dmg'], 'threshold' => 1000, 'pts' => 10],
    ];
    $user = ['total_damage' => '999', 'achievements' => '{}', 'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    echo (count($newlyEarned) === 0 ? "PASS" : "FAIL") . ": ничего не засчитано на 999 из 1000\n";
    echo (iv($outUser, 'achievement_stars') === 0 ? "PASS" : "FAIL") . ": очки не начислены\n";
}

echo "=== Test 3: уже earned достижение НЕ пересчитывается повторно (не задваивает очки) ===\n";
{
    $catalog = [
        ['id' => 'dmg_1000', 'statPath' => ['dmg'], 'threshold' => 1000, 'pts' => 10],
    ];
    $user = ['total_damage' => '99999', 'achievements' => json_encode(['dmg_1000' => true]), 'achievement_stars' => '10', 'ach_score' => '10', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    echo (count($newlyEarned) === 0 ? "PASS" : "FAIL") . ": уже earned — не попадает в newlyEarned повторно\n";
    echo (iv($outUser, 'achievement_stars') === 10 ? "PASS" : "FAIL") . ": очки НЕ задвоились (остались 10, не 20)\n";
}

echo "=== Test 4: отозванное (revoked) достижение не засчитывается, даже если порог пересечён ===\n";
{
    $catalog = [
        ['id' => 'dmg_1000', 'statPath' => ['dmg'], 'threshold' => 1000, 'pts' => 10],
    ];
    $user = [
        'total_damage' => '99999', 'achievements' => '{}',
        'achievement_revoked' => json_encode(['dmg_1000' => true]),
        'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0',
    ];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    echo (count($newlyEarned) === 0 ? "PASS" : "FAIL") . ": revoked-достижение не возвращается, несмотря на пересечённый порог\n";
    echo (iv($outUser, 'achievement_stars') === 0 ? "PASS" : "FAIL") . ": очки за revoked не начислены\n";
}

echo "=== Test 5: rollover ach_score->bullets — ровно 1 патрон на каждые полные 50 очков, остаток сохраняется ===\n";
{
    $catalog = [
        ['id' => 'a', 'statPath' => ['dmg'], 'threshold' => 1, 'pts' => 30],
        ['id' => 'b', 'statPath' => ['auto'], 'threshold' => 1, 'pts' => 30],
    ];
    $user = ['total_damage' => '5', 'auto_count' => '5', 'achievements' => '{}', 'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    // 30 + 30 = 60 суммарных очков -> 1 патрон (50), остаток 10 в ach_score.
    echo (count($newlyEarned) === 2 ? "PASS" : "FAIL") . ": оба достижения засчитаны за один проход\n";
    echo (iv($outUser, 'achievement_stars') === 60 ? "PASS" : "FAIL") . ": achievement_stars = 60, получено " . var_export($outUser['achievement_stars'] ?? null, true) . "\n";
    echo (iv($outUser, 'bullets') === 1 ? "PASS" : "FAIL") . ": ровно 1 патрон выдан (60 очков = 1×50 + остаток), получено " . var_export($outUser['bullets'] ?? null, true) . "\n";
    echo (iv($outUser, 'ach_score') === 10 ? "PASS" : "FAIL") . ": остаток ach_score = 10 (60 - 50), получено " . var_export($outUser['ach_score'] ?? null, true) . "\n";
}

echo "=== Test 6: rollover — несколько патронов за один проход, если очков хватает на 2+ раза по 50 ===\n";
{
    $catalog = [
        ['id' => 'huge', 'statPath' => ['dmg'], 'threshold' => 1, 'pts' => 130],
    ];
    $user = ['total_damage' => '5', 'achievements' => '{}', 'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    // 130 очков -> 2 полных патрона (100), остаток 30.
    echo (iv($outUser, 'bullets') === 2 ? "PASS" : "FAIL") . ": 130 очков дают ровно 2 патрона, получено " . var_export($outUser['bullets'] ?? null, true) . "\n";
    echo (iv($outUser, 'ach_score') === 30 ? "PASS" : "FAIL") . ": остаток ach_score = 30, получено " . var_export($outUser['ach_score'] ?? null, true) . "\n";
}

echo "=== Test 7: _getPath() безопасно возвращает 0 на отсутствующем/некорректном пути (не падает) ===\n";
{
    $catalog = [
        ['id' => 'deep', 'statPath' => ['kills', 99], 'threshold' => 1, 'pts' => 5], // индекс вне диапазона массива kills[8]
    ];
    $user = ['achievements' => '{}', 'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    echo (count($newlyEarned) === 0 ? "PASS" : "FAIL") . ": несуществующий путь даёт 0, порог (1) не пересечён — не падает исключением\n";
}

echo "=== Test 8: уже существующий ach_score (накопленный с прошлых проходов) учитывается в rollover ===\n";
{
    $catalog = [
        ['id' => 'small', 'statPath' => ['dmg'], 'threshold' => 1, 'pts' => 20],
    ];
    $user = ['total_damage' => '5', 'achievements' => '{}', 'achievement_stars' => '5', 'ach_score' => '45', 'bullets' => '3'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    // 45 (накоплено) + 20 (новое) = 65 -> 1 патрон (50), остаток 15.
    echo (iv($outUser, 'bullets') === 4 ? "PASS" : "FAIL") . ": патрон выдан с учётом УЖЕ накопленного ach_score (3+1=4), получено " . var_export($outUser['bullets'] ?? null, true) . "\n";
    echo (iv($outUser, 'ach_score') === 15 ? "PASS" : "FAIL") . ": остаток ach_score = 15 (45+20-50), получено " . var_export($outUser['ach_score'] ?? null, true) . "\n";
}

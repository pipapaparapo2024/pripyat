<?php
// 28.10.2026: репорт — "выбил десятки+девятки в блэкджеке на тесте, 'Десятки' не засчиталась,
// даже после перезагрузки". Расследование нашло системный баг: PHP json_encode() пустого
// ассоциативного массива всегда даёт "[]", не "{}" (PHP не различает пустой объект/список).
// cards_combos/poker_combos периодически уходили на клиент пустым МАССИВОМ вместо объекта,
// клиент тихо терял следующую же запись (см. разбор в achievements.js.onDvorGame()), а на
// сервере array_is_list()==true означало бы, что числовая строка-ключ статпути ('88'/'99')
// случайно совпадает с ЧИСЛОВЫМ ИНДЕКСОМ массива — живой пример на проде: uid 382448269 имел
// cards_combos массивом из 100 элементов, непустые позиции ровно 88 и 99, из-за чего
// 'crd_88'/'crd_99' оказались ложно засчитаны мусором, а не реальными победами.
require __DIR__ . '/../../server/core/models/achievementengine.php';

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

echo "=== Test 1: cards_combos испорчен в list-массив (значение на числовом индексе 88) — buildState() сбрасывает его в [] ===\n";
{
    $corrupted = array_fill(0, 100, null);
    $corrupted[88] = 1;
    $user = ['cards_combos' => json_encode($corrupted)];
    $state = AchievementEngine::buildState($ops, $user);
    echo ($state['cardsCombos'] === [] ? "PASS" : "FAIL") . ": cardsCombos сброшен в [] вместо мусорного списка, получено " . json_encode($state['cardsCombos']) . "\n";
}

echo "=== Test 2: честный (не-list) cards_combos остаётся как есть ===\n";
{
    $user = ['cards_combos' => json_encode(['tt' => 1, '88' => 2])];
    $state = AchievementEngine::buildState($ops, $user);
    echo (($state['cardsCombos']['tt'] ?? null) === 1 ? "PASS" : "FAIL") . ": cardsCombos.tt сохранён (реальная ассоциативная карта не трогается)\n";
    echo (($state['cardsCombos']['88'] ?? null) === 2 ? "PASS" : "FAIL") . ": cardsCombos.88 (честный строковый ключ, не индекс) сохранён\n";
}

echo "=== Test 3: та же защита для poker_combos ===\n";
{
    $corrupted = array_fill(0, 50, null);
    $corrupted[12] = 3;
    $user = ['poker_combos' => json_encode($corrupted)];
    $state = AchievementEngine::buildState($ops, $user);
    echo ($state['pokerCombos'] === [] ? "PASS" : "FAIL") . ": pokerCombos сброшен в [] вместо мусорного списка\n";
}

echo "=== Test 4: пустой [] (самый частый случай на проде, 140 из 142 аккаунтов) тоже даёт пустое состояние, не падает ===\n";
{
    $user = ['cards_combos' => '[]'];
    $state = AchievementEngine::buildState($ops, $user);
    echo ($state['cardsCombos'] === [] ? "PASS" : "FAIL") . ": пустой список → пустое состояние\n";
}

echo "=== Test 5: сквозной сценарий — checkAll() с заражённым cards_combos НЕ засчитывает 'crd_88' по случайному совпадению индекса ===\n";
{
    $corrupted = array_fill(0, 100, null);
    $corrupted[88] = 1; // та же форма, что живой баг uid 382448269
    $catalog = [
        ['id' => 'crd_88', 'statPath' => ['cardsCombos', '88'], 'threshold' => 1, 'pts' => 1],
    ];
    $user = ['cards_combos' => json_encode($corrupted), 'achievements' => '{}', 'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    echo (count($newlyEarned) === 0 ? "PASS" : "FAIL") . ": crd_88 НЕ засчитан по случайному индексу 88 испорченного массива (было бы ложное срабатывание без фикса)\n";
}

echo "=== Test 6: сквозной сценарий — checkAll() ПРАВИЛЬНО засчитывает 'crd_tt' при честной ассоциативной карте ===\n";
{
    $catalog = [
        ['id' => 'crd_tt', 'statPath' => ['cardsCombos', 'tt'], 'threshold' => 1, 'pts' => 2],
    ];
    $user = ['cards_combos' => json_encode(['tt' => 1]), 'achievements' => '{}', 'achievement_stars' => '0', 'ach_score' => '0', 'bullets' => '0'];
    list($outUser, $newlyEarned) = AchievementEngine::checkAll($ops, $user, $catalog);
    echo (count($newlyEarned) === 1 && $newlyEarned[0]['id'] === 'crd_tt' ? "PASS" : "FAIL") . ": crd_tt честно засчитан при реальной записи 'tt'=>1\n";
}

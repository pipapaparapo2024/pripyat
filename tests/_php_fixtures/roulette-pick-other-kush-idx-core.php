<?php
// 12.10.2026 — реальное исполнение Roulette::_pickOtherKushIdx() (вынесена из pickCup() 12.10.2026
// по прямому указанию — репорт "если не угадал куш, второй стаканчик с шариком не открывается";
// гипотеза пользователя подтверждена чтением openMinigame(): hasKush=false до kush_threshold
// (6-8 игр), значит 'kush' в cups физически нет НИ ОДНОГО экземпляра до этого порога). Чистая
// функция, $this->ops не трогает — конструктору Roulette достаточно пустого registry (тот же
// приём, что уже проверен для _grantWeaponReward, см. roulette-dice-weapon-reward-core.php).
class Gameops {
    function __construct($registry) {}
}
require __DIR__ . '/../../server/core/controllers/roulette.php';

$passed = 0; $failed = 0;
function check($cond, $msg){
    global $passed, $failed;
    if($cond){ echo "PASS: $msg\n"; $passed++; }
    else { echo "FAIL: $msg\n"; $failed++; }
}

$roulette = new Roulette([]);
$method = new ReflectionMethod('Roulette', '_pickOtherKushIdx');

// 1) Настоящий куш реально лежит в раскладке (не на месте выбора игрока) — возвращает ЕГО
//    индекс, не фейковый случайный.
$cups = ['cig:5','exp:10','kush','roulette_spichki:3','coins:50','auto:1','gun:1','machete:1','blue_points:5'];
check($method->invokeArgs($roulette, [$cups, 0]) === 2, 'реальный kush в раскладке — возвращает его настоящий индекс (2), не случайный');
check($method->invokeArgs($roulette, [$cups, 8]) === 2, 'тот же результат независимо от того, какой стаканчик выбрал игрок (idx=8)');

// 2) Куша в раскладке НЕТ ВООБЩЕ (до 6-8 игр, hasKush=false в openMinigame()) — фейковый reveal:
//    случайный индекс 0-8, который НИКОГДА не равен $idx игрока, и НИКОГДА не null (9 стаканчиков
//    всегда оставляют минимум 8 кандидатов).
$cupsNoKush = ['cig:5','exp:10','coins:50','roulette_spichki:3','coins:50','auto:1','gun:1','machete:1','blue_points:5'];
for($idx = 0; $idx <= 8; $idx++){
    $seen = [];
    for($i = 0; $i < 60; $i++){
        $result = $method->invokeArgs($roulette, [$cupsNoKush, $idx]);
        check($result !== null, "idx=$idx: фейковый otherKushIdx никогда не null (9 кандидатов, 8 после исключения idx)");
        check($result !== $idx, "idx=$idx: фейковый otherKushIdx никогда не совпадает с собственным выбором игрока (попытка #$i)");
        check($result >= 0 && $result <= 8, "idx=$idx: фейковый otherKushIdx всегда в диапазоне 0-8 (попытка #$i)");
        $seen[$result] = true;
    }
    // Не единственное фиксированное значение — array_rand() реально рандомизирует, а не
    // возвращает первый/последний элемент array_diff каждый раз.
    check(count($seen) > 1, "idx=$idx: за 60 попыток фейковый индекс принимает больше одного значения (реальная случайность, не захардкоженный fallback)");
}

echo "\n$passed passed, $failed failed\n";
if($failed > 0) exit(1);

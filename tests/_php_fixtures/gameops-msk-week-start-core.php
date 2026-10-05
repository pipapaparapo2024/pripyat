<?php
require __DIR__ . '/../../server/core/models/gameops.php';

$ops = new Gameops([]);

function assertEq($actual, $expected, $msg){
    if($actual === $expected) echo "PASS: $msg\n";
    else echo "FAIL: $msg (ожидалось $expected, получили $actual)\n";
}

echo "=== Test 1: граница 2026-10-05 00:00 МСК (2026-10-04 21:00 UTC) — возвращает саму себя ===\n";
// gmmktime строит UTC-эпох напрямую, не завися от timezone PHP-процесса (тот же принцип,
// что и у самой mskWeekStartTs()). 2026-10-05 — подтверждённый понедельник (контекст сессии).
$mondayMidnightUtc = gmmktime(21, 0, 0, 10, 4, 2026);
assertEq($ops->mskWeekStartTs($mondayMidnightUtc), $mondayMidnightUtc,
    'на самой границе понедельника 00:00 МСК возвращает ту же секунду');

echo "=== Test 2 (РЕГРЕССИЯ ИЗ РЕПОРТА — \"топ не обновился\"): понедельник 01:30 МСК, ещё воскресенье по UTC-календарю ===\n";
$mondayOneThirtyMsk = $mondayMidnightUtc + 90 * 60;
assertEq($ops->mskWeekStartTs($mondayOneThirtyMsk), $mondayMidnightUtc,
    'mskWeekStartTs() корректно видит новую неделю уже в 01:30 МСК понедельника');
$oldFormula = strtotime('monday this week 00:00:00', $mondayOneThirtyMsk);
if($oldFormula !== $mondayMidnightUtc){
    $daysOff = round(($mondayMidnightUtc - $oldFormula) / 86400, 2);
    echo "PASS: старая формула (strtotime без МСК-поправки) в этот момент ошибалась на {$daysOff} дн. назад — баг из репорта воспроизведён\n";
} else {
    echo "FAIL: старая формула неожиданно совпала с правильной — тест не воспроизводит баг\n";
}

echo "=== Test 3: воскресенье 23:59 МСК (последняя минута недели) — граница ещё не сдвинулась ===\n";
$sundayLateMsk = $mondayMidnightUtc + 7 * 86400 - 60;
assertEq($ops->mskWeekStartTs($sundayLateMsk), $mondayMidnightUtc,
    'в последнюю минуту недели граница ещё указывает на тот же понедельник');

echo "=== Test 4: следующий понедельник 00:00 МСК — граница сдвигается ровно на 7 дней ===\n";
$nextMondayMsk = $mondayMidnightUtc + 7 * 86400;
assertEq($ops->mskWeekStartTs($nextMondayMsk), $nextMondayMsk,
    'следующая неделя стартует ровно через 7 дней от предыдущей границы');

echo "=== Test 5: среда в середине дня — обычный рабочий случай без краевых эффектов ===\n";
$wedNoonMsk = $mondayMidnightUtc + 2 * 86400 + 12 * 3600;
assertEq($ops->mskWeekStartTs($wedNoonMsk), $mondayMidnightUtc,
    'среда корректно относится к текущей (уже начавшейся) неделе');

echo "=== Test 6 (вторая половина старого бага): после 03:00 МСК старая формула отставала на 3ч от реальной МСК-полуночи ===\n";
$afterThreeAmMsk = $mondayMidnightUtc + 4 * 3600; // понедельник 04:00 МСК — UTC тоже уже понедельник
$oldAfterCrossover = strtotime('monday this week 00:00:00', $afterThreeAmMsk);
$expectedWrongBoundary = $mondayMidnightUtc + 3 * 3600; // старая формула съезжает на +3ч позже реальной границы
assertEq($oldAfterCrossover, $expectedWrongBoundary,
    'старая формула после 03:00 МСК давала границу на 3ч позже реальной — теряла урон первых 3ч недели');
assertEq($ops->mskWeekStartTs($afterThreeAmMsk), $mondayMidnightUtc,
    'новая формула в этот же момент правильно указывает на реальную МСК-полночь, без потери 3ч');

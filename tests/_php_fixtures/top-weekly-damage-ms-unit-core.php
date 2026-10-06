<?php
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/top.php';

$ops = new Gameops([]);

function assertTrue($cond, $msg){
    if($cond) echo "PASS: $msg\n";
    else echo "FAIL: $msg\n";
}

// Понедельник 00:00 МСК (2026-10-05, тот же фиксированный момент, что в
// gameops-msk-week-start-core.php) — $now ставим на пару часов внутрь новой недели, чтобы
// mskWeekStartTs() вернул именно эту границу.
$mondayMidnightUtc = gmmktime(21, 0, 0, 10, 4, 2026); // 2026-10-05 00:00 МСК, в секундах UTC-эпохи
$now = $mondayMidnightUtc + 2 * 3600; // понедельник 02:00 МСК
$weekStartSec = $ops->mskWeekStartTs($now);
assertTrue($weekStartSec === $mondayMidnightUtc, 'mskWeekStartTs($now) вернул ожидаемую границу недели (секунды)');

// Синтетические строки boss_damage_log — ВСЕГДА в МИЛЛИСЕКУНДАХ (так реально пишет
// bosses.php.attack(): $now = intval(round(microtime(true) * 1000)) перед INSERT).
$thisWeekRowMs    = ($weekStartSec + 3600) * 1000;        // понедельник 01:00 МСК — текущая неделя
$lastWeekRowMs    = ($weekStartSec - 3600) * 1000;        // воскресенье 23:00 МСК — прошлая неделя
$yearOldRowMs     = ($weekStartSec - 365 * 86400) * 1000; // год назад — явно не эта неделя

// Извлекаем РЕАЛЬНУЮ строку кода из top.php — не переизобретаем формулу, исполняем то, что
// буквально написано в продовом файле, чтобы тест ловил будущую регрессию, а не только
// сегодняшний баг.
$topPhpSrc = file_get_contents(__DIR__ . '/../../server/core/controllers/top.php');
if(!preg_match('/\$weekStartMs\s*=\s*(.+?);/', $topPhpSrc, $m)){
    echo "FAIL: не нашли строку \"\$weekStartMs = ...;\" в top.php — проверь, не переименовали ли переменную\n";
    exit(1);
}
$weekStartTs = $weekStartSec; // имя, от которого зависит извлечённое выражение
eval('$weekStartMs = ' . $m[1] . ';');

assertTrue($weekStartMs === $weekStartSec * 1000,
    '$weekStartMs, вычисленный РЕАЛЬНЫМ выражением из top.php, равен секундам*1000');

echo "=== Основная регрессия (баг 06.10.2026 — \"топ не сбросился\") ===\n";
assertTrue($thisWeekRowMs >= $weekStartMs,
    'удар ЭТОЙ недели (пн 01:00 МСК) проходит фильтр `time` >= $weekStartMs');
assertTrue($lastWeekRowMs < $weekStartMs,
    'удар ПРОШЛОЙ недели (вс 23:00 МСК) НЕ проходит фильтр `time` >= $weekStartMs — должен быть исключён');
assertTrue($yearOldRowMs < $weekStartMs,
    'удар годовой давности НЕ проходит фильтр — топ не превращается в lifetime');

echo "=== Доказательство, что старый (небагованный по месту, но неверный по единицам) код пропускал всё ===\n";
// Старый код сравнивал `time` (мс) напрямую с $weekStartTs (сек, без *1000) — воспроизводим это
// явно, чтобы показать, НАСКОЛЬКО широко баг пропускал данные (не краевые 3ч, как МСК-баг
// 05.10, а буквально ВСЁ время существования лога).
assertTrue($lastWeekRowMs >= $weekStartTs,
    'воспроизведение бага: прошлонедельный мс-штамп всё равно >= секундного порога — старое сравнение ложно пропускало его');
assertTrue($yearOldRowMs >= $weekStartTs,
    'воспроизведение бага: даже годовой мс-штамp >= секундного порога — старое сравнение превращало топ в lifetime, а не недельный');

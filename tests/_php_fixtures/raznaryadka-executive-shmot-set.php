<?php
// Фикстура для tests/oct25-raznaryadka-executive-shmot-set.test.js — РЕАЛЬНОЕ исполнение
// Gameops::grantShmotFromSource()/RaznaryadkaProgress::grantTier() на сете "Исполнитель"
// (приз за полный месяц ежедневных заданий, ids 117-119, source:'raznaryadka' — id116 "Маска"
// выделена 26.10.2026 в отдельный сет "Комбинатор" с source:'game2048', не покрывается этой
// фикстурой). Ни Gameops::catalog()
// (Jsonloader::get() — простое чтение файла), ни add()/i()/j()/applyShmotOwnBonus() не трогают
// БД — весь путь чистый, можно гонять без mysqli-коннекта. CWD обязан быть server/ (Jsonloader
// читает относительный путь 'json/<name>.json') — выставляется вызывающим .test.js через
// execFileSync({cwd: .../server}).

require_once 'core/models/jsonloader.php';
require_once 'core/models/gameops.php';
require_once 'core/models/raznaryadkaprogress.php';

$passed = 0; $failed = 0;
function assertTrue($cond, $msg){
    global $passed, $failed;
    if($cond){ echo "PASS: $msg\n"; $passed++; }
    else     { echo "FAIL: $msg\n"; $failed++; }
}

$registry = ['json' => new Jsonloader()];
$ops = new Gameops($registry);

// === Test 1: каталог shmot_items.json содержит ровно 3 записи source=raznaryadka, ids 117-119 ===
// 26.10.2026 (по прямому указанию — маска id116 выделена в отдельный сет "Комбинатор",
// выдаётся крафтом в игре "2048" (source=game2048), а не раздачей раз в месяц) — пул
// "Исполнитель" для ежедневных заданий сократился с 4 до 3 предметов.
$items = $ops->catalog('shmot_items');
$raznItems = array_values(array_filter($items, function($it){ return ($it['source'] ?? null) === 'raznaryadka'; }));
assertTrue(count($raznItems) === 3, 'ровно 3 предмета с source=raznaryadka в shmot_items.json (нашлось: ' . count($raznItems) . ')');
$raznIds = array_map(function($it){ return intval($it['id']); }, $raznItems);
sort($raznIds);
assertTrue($raznIds === [117, 118, 119], 'ids сета "Исполнитель" — ровно 117,118,119 (нашлось: ' . implode(',', $raznIds) . ')');

// === Test 2: raznaryadka_config.json — чест-тир (need:-1) ссылается на shmot_source=raznaryadka ===
$raznConfig = $ops->catalog('raznaryadka_config');
$chestTier = null;
foreach($raznConfig['reward_tiers'] as $t){ if(intval($t['need']) === -1) $chestTier = $t; }
assertTrue($chestTier !== null, 'в reward_tiers нашёлся тир need:-1 (сундук за полный месяц)');
assertTrue(($chestTier['shmot_source'] ?? null) === 'raznaryadka', 'чест-тир ссылается на shmot_source="raznaryadka"');
assertTrue(!isset($chestTier['shmot_pool']), 'старый placeholder shmot_pool убран из конфига');

// === Test 3: grantShmotFromSource() выдаёт ТОЛЬКО ids из пула, без повторов, пока не выбиты все 3 ===
$user = ['shmot' => '[]'];
$granted = [];
for($i = 0; $i < 3; $i++){
    $id = $ops->grantShmotFromSource($user, 'raznaryadka');
    assertTrue($id !== null, "grantShmotFromSource() вызов #" . ($i+1) . " вернул реальный id (не null)");
    assertTrue(!in_array($id, $granted, true), "вызов #" . ($i+1) . " — id=$id ещё не выдавался ранее (" . implode(',', $granted) . ")");
    $granted[] = $id;
}
sort($granted);
assertTrue($granted === [117, 118, 119], 'за 3 вызова выданы РОВНО все 3 id сета (117,118,119), нашлось: ' . implode(',', $granted));

// === Test 4: когда пул исчерпан — 4-й вызов возвращает null, не падает и не выдаёт дубликат ===
$fourth = $ops->grantShmotFromSource($user, 'raznaryadka');
assertTrue($fourth === null, '4-й вызов (все 3 уже owned) возвращает null, не дублирует');

// === Test 5: owned=true реально проставлен в $user['shmot'] для всех 3 id ===
$state = json_decode($user['shmot'], true);
foreach([117, 118, 119] as $id){
    assertTrue(!empty($state[$id]['owned']), "id=$id помечен owned=true в итоговом state");
}

// === Test 6: RaznaryadkaProgress::grantTier() на реальном чест-тире из конфига — грант шмотки
// отрабатывает через тот же путь (интеграционная проверка связки tier -> grantShmotFromSource),
// монеты/оружейный бонус тира тоже начисляются как обычно, не блокируются шмот-веткой.
$user2 = ['shmot' => '[]', 'coins' => '0', 'ammo_auto' => '0', 'weapons' => '[]'];
RaznaryadkaProgress::grantTier($ops, $user2, $chestTier);
assertTrue(intval($user2['coins']) === intval($chestTier['amt']), 'grantTier() начислил coins тира (' . $chestTier['amt'] . ') наравне со шмоткой');
$state2 = json_decode($user2['shmot'], true);
$ownedAny = false;
foreach([117, 118, 119] as $id){ if(!empty($state2[$id]['owned'])) $ownedAny = true; }
assertTrue($ownedAny, 'grantTier() реально выдал один предмет сета "Исполнитель" через shmot_source');

// === Test 7: grantTier() без shmot_source (обычные тиры) не трогает shmot вообще — регресс-гвард
$user3 = ['shmot' => '[]', 'coins' => '0'];
$plainTier = ['field' => 'coins', 'amt' => 30];
RaznaryadkaProgress::grantTier($ops, $user3, $plainTier);
assertTrue($user3['shmot'] === '[]', 'тир без shmot_source не трогает поле shmot вообще (регресс-гвард)');

echo "\n=== РЕЗУЛЬТАТ ===\n";
echo "passed=$passed failed=$failed\n";
if($failed > 0) exit(1);

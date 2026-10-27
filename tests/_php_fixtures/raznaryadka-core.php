<?php
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/models/raznaryadkaprogress.php';
require __DIR__ . '/../../server/core/controllers/raznaryadka.php';

function invokePrivate($obj, $method, $args) {
    $ref = new ReflectionMethod($obj, $method);
    return $ref->invokeArgs($obj, $args);
}

// Fake Gameops — duck-typing только того, что report()/_grantTier()/loadAndRollover() реально
// используют (i/j/add/catalog/loadUser/saveUser) — тот же приём, что fake $link в комментарии
// AGENTS.md "Реальное исполнение PHP в тестах", без реального mysqli/registry.
class FakeOps {
    public $savedCalls = [];
    public $userRow;
    public $config;
    function __construct($userRow, $config){ $this->userRow = $userRow; $this->config = $config; }
    function loadUser($fields = ['*']){ return $this->userRow; }
    function saveUser($update){ $this->savedCalls[] = $update; foreach($update as $k=>$v) $this->userRow[$k] = $v; return true; }
    function i($user, $key, $default = 0){ return intval(isset($user[$key]) ? $user[$key] : $default); }
    function j($user, $key, $default = []){
        if(!isset($user[$key]) || $user[$key] === '' || $user[$key] === null) return $default;
        if(is_array($user[$key])) return $user[$key];
        $d = json_decode($user[$key], true);
        return is_array($d) ? $d : $default;
    }
    function add(&$user, $currency, $amount){ $amount = intval($amount); if($amount === 0) return; $user[$currency] = $this->i($user, $currency) + $amount; }
    function catalog($name){ return $this->config; }
}

$CONFIG = [
    'months' => [
        '2026-11' => [
            'days' => [
                '1' => ['type' => 'energy', 'need' => 15],
                '2' => ['type' => 'boss', 'need' => 1, 'boss_id' => 0],
            ],
        ],
    ],
    'pay_progression' => [2, 4, 8, 16, 32, 64],
    'reward_tiers' => [
        ['need' => 2, 'field' => 'coins', 'amt' => 30, 'label_icon' => 'coins'],
        ['need' => -1, 'field' => 'coins', 'amt' => 130, 'bonus_field' => 'auto_count', 'bonus_amt' => 10, 'label_icon' => 'chest'],
    ],
    'task_labels' => [
        'energy' => 'Потратить {need} энергии',
        'boss'   => 'Победить {boss_name}',
    ],
    // Винительный падеж ("кого?") — шаблон "Победить {boss_name}" грамматически требует его,
    // не именительный (см. тест ниже — изначально здесь стояло "Охотник", тест это поймал).
    'boss_names' => ['Охотника', 'Счастливчика'],
];

$razn = new Raznaryadka([]);

echo "=== Test 1: _failedDaysDesc() — ранжирование от самого свежего провала к старому ===\n";
// 24.10.2026 (баг найден по прямому указанию — "нажимаю на день, ничего не открывается"):
// раньше здесь перебирались ТОЛЬКО дни с уже существующей записью в $data['days'] — день,
// по которому игрок вообще ничего не делал (нет записи вообще), никогда не попадал в
// проваленные. Теперь перебираются ВСЕ дни 1..today-1 — отсутствие записи = НЕ done = провален.
$data = [
    'days' => [
        '5'  => ['status' => 'done'],       // выполнен — НЕ в списке проваленных
        '15' => ['status' => 'pending'],    // провален, явная запись
        '18' => ['status' => 'pending'],    // провален, явная запись, САМЫЙ СВЕЖИЙ
        // дни 1-4,6-14,16,17 — НЕТ записи вообще (типичный случай: игрок не трогал эти дни) —
        // ДОЛЖНЫ считаться проваленными тоже, это и есть суть фикса.
    ],
];
$failed = invokePrivate($razn, '_failedDaysDesc', [$data, 19]);
$expected = [18,17,16,15,14,13,12,11,10,9,8,7,6,4,3,2,1]; // всё 1..18 кроме 5 (done), по убыв.
echo ($failed === $expected ? "PASS" : "FAIL") . ": все дни 1..18 кроме done=5 (включая БЕЗ явной записи), получено " . json_encode($failed) . "\n";
echo (in_array(1, $failed, true) && in_array(10, $failed, true) ? "PASS" : "FAIL") . ": дни БЕЗ записи в \$data['days'] (например 1, 10) тоже в списке проваленных — это и есть сам баг-фикс\n";

echo "=== Test 1b: _failedDaysDesc() — откупленный (paid) день ОСТАЁТСЯ в списке, честно выполненный — нет ===\n";
// 24.10.2026 (баг найден по прямому указанию — "откупаю день 16, потом 15 — выходит 4 тушёнки;
// в обратном порядке — 6"): раньше ЛЮБОЙ status='done' день (честно выполненный ИЛИ откупленный
// тушёнкой через payDay()) исчезал из списка — соседние проваленные дни "дешевели", когда
// кто-то из них был куплен раньше. Теперь откупленный (paid=true) день остаётся в списке и
// занимает свой ранг — пропадают из ранжирования только ЧЕСТНО выполненные (done И НЕ paid).
$dataPaid = [
    'days' => [
        '10' => ['status' => 'done'],                 // честно выполнен — НЕ в списке
        '15' => ['status' => 'done', 'paid' => true],  // ОТКУПЛЕН тушёнкой — ДОЛЖЕН остаться в списке
        '16' => ['status' => 'pending'],               // провален, ещё не куплен
    ],
];
$failedPaid = invokePrivate($razn, '_failedDaysDesc', [$dataPaid, 17]);
echo (in_array(15, $failedPaid, true) ? "PASS" : "FAIL") . ": откупленный день 15 (paid=true) остаётся в списке ранжирования, получено " . json_encode($failedPaid) . "\n";
echo (!in_array(10, $failedPaid, true) ? "PASS" : "FAIL") . ": честно выполненный день 10 (без paid) исключён из списка, получено " . json_encode($failedPaid) . "\n";
echo (in_array(16, $failedPaid, true) ? "PASS" : "FAIL") . ": обычный проваленный день 16 в списке, получено " . json_encode($failedPaid) . "\n";

echo "=== Test 1c: сумма откупа двух дней НЕ зависит от порядка покупки (сам баг из репорта) ===\n";
// Сценарий пользователя буквально: дни 15 и 16 провалены, остальные 1-14 честно выполнены
// (день 17 тоже честно выполнен — не влияет на ранг 15/16). today=18.
$baseDays = ['15' => ['status' => 'pending'], '16' => ['status' => 'pending'], '17' => ['status' => 'done']];
for($d = 1; $d <= 14; $d++) $baseDays[strval($d)] = ['status' => 'done'];

// Порядок А: сначала откупаем 16 (должен стать rank0=2 тушёнки), потом 15 (должен остаться rank1=4).
$dataA = ['days' => $baseDays];
$failedA1 = invokePrivate($razn, '_failedDaysDesc', [$dataA, 18]);
$rank16_A = array_search(16, $failedA1, true);
$costA1 = invokePrivate($razn, '_payCost', [$CONFIG, $rank16_A]);
$dataA['days']['16'] = ['status' => 'done', 'paid' => true]; // откупили день 16
$failedA2 = invokePrivate($razn, '_failedDaysDesc', [$dataA, 18]);
$rank15_A = array_search(15, $failedA2, true);
$costA2 = invokePrivate($razn, '_payCost', [$CONFIG, $rank15_A]);
$totalA = $costA1 + $costA2;

// Порядок Б: сначала откупаем 15, потом 16 — тот же набор дней, обратный порядок.
$dataB = ['days' => $baseDays];
$failedB1 = invokePrivate($razn, '_failedDaysDesc', [$dataB, 18]);
$rank15_B = array_search(15, $failedB1, true);
$costB1 = invokePrivate($razn, '_payCost', [$CONFIG, $rank15_B]);
$dataB['days']['15'] = ['status' => 'done', 'paid' => true]; // откупили день 15
$failedB2 = invokePrivate($razn, '_failedDaysDesc', [$dataB, 18]);
$rank16_B = array_search(16, $failedB2, true);
$costB2 = invokePrivate($razn, '_payCost', [$CONFIG, $rank16_B]);
$totalB = $costB1 + $costB2;

echo ($totalA === $totalB ? "PASS" : "FAIL") . ": сумма одинакова независимо от порядка откупа — порядок А (16 затем 15) = $totalA, порядок Б (15 затем 16) = $totalB\n";
echo ($totalA === 6 ? "PASS" : "FAIL") . ": ожидаемая сумма 2+4=6 тушёнки (ранг0=2, ранг1=4), получено $totalA\n";

echo "=== Test 2: _payCost() — прогрессия 2,4,8,16,32,64, потолок не удваивается дальше ===\n";
$costs = [];
for($rank = 0; $rank < 8; $rank++) $costs[] = invokePrivate($razn, '_payCost', [$CONFIG, $rank]);
echo ($costs === [2,4,8,16,32,64,64,64] ? "PASS" : "FAIL") . ": [2,4,8,16,32,64,64,64] (ранг 5+ упирается в потолок), получено " . json_encode($costs) . "\n";

echo "=== Test 3: RaznaryadkaProgress::taskLabel() — подстановка {need}/{boss_name} ===\n";
// 23.10.2026: taskLabel() перенесён из приватного Raznaryadka::_taskLabel() в публичный
// RaznaryadkaProgress::taskLabel() — нужен также CLI-инструменту tools/gen_raznaryadka_month.php
// для печати списка на будущий месяц, Reflection больше не нужен (метод публичный).
$lbl1 = RaznaryadkaProgress::taskLabel($CONFIG, ['type' => 'energy', 'need' => 15]);
echo ($lbl1 === 'Потратить 15 энергии' ? "PASS" : "FAIL") . ": energy -> 'Потратить 15 энергии', получено '$lbl1'\n";
$lbl2 = RaznaryadkaProgress::taskLabel($CONFIG, ['type' => 'boss', 'need' => 1, 'boss_id' => 0]);
echo ($lbl2 === 'Победить Охотника' ? "PASS" : "FAIL") . ": boss id0 -> 'Победить Охотника', получено '$lbl2'\n";

echo "=== Test 3b: RaznaryadkaProgress::generateMonth()/monthConfig() — полный рандом, count=daysInMonth, воспроизводимость ===\n";
// 23.10.2026 (по прямому указанию заказчика через пользователя): список заданий на месяц
// теперь ПОЛНОСТЬЮ случайный (не хардкод по дням), но количество заданий ВСЕГДА равно
// количеству дней в месяце — заказчик публикует список постом в группе ВК заранее.
$gen1 = RaznaryadkaProgress::generateMonth(30, crc32('2026-11'));
echo (count($gen1['days']) === 30 ? "PASS" : "FAIL") . ": generateMonth(30,...) -> ровно 30 дней, получено " . count($gen1['days']) . "\n";
// 23.10.2026 (уточнение по прямому указанию — продиктован ТОЧНЫЙ список "Список ежедневных
// заданий", 30 строк): каждый сгенерированный день должен буквально СОВПАДАТЬ (type+need[+
// boss_id]) с одной из строк taskPool() — не просто "валидный type", а точное вхождение в пул,
// иначе рандом мог бы незаметно начать подставлять комбинации вне присланного списка.
$pool = RaznaryadkaProgress::taskPool();
$allValid = true;
foreach($gen1['days'] as $d => $cfg){
    $found = false;
    foreach($pool as $p){ if($p === $cfg){ $found = true; break; } }
    if(!$found){ $allValid = false; break; }
}
echo ($allValid ? "PASS" : "FAIL") . ": каждый сгенерированный день буквально совпадает с одной из строк taskPool() (30 строго заданных вариантов)\n";
echo (count($pool) === 30 ? "PASS" : "FAIL") . ": taskPool() содержит ровно 30 строк (точное соответствие присланному списку), получено " . count($pool) . "\n";
$bossRows = array_filter($pool, fn($p) => $p['type'] === 'boss');
echo (count($bossRows) === 4 ? "PASS" : "FAIL") . ": ровно 4 boss-строки (Охотник/Счастливчик/Ястреб/Меченный), получено " . count($bossRows) . "\n";
$bossIds = array_values(array_unique(array_column($bossRows, 'boss_id')));
sort($bossIds);
echo ($bossIds === [0, 1, 2, 3] ? "PASS" : "FAIL") . ": boss_id строго [0,1,2,3] — Крыс/Баркут/Борода/Жгут НЕ входят в рандомный пул, получено " . json_encode($bossIds) . "\n";
$gen2 = RaznaryadkaProgress::generateMonth(30, crc32('2026-11'));
echo ($gen1['days'] === $gen2['days'] ? "PASS" : "FAIL") . ": одинаковый seed -> одинаковый список (воспроизводимость для CLI-инструмента)\n";

$CONFIG_NO_DEC = $CONFIG; // декабря нет в конфиге — monthConfig() должен сгенерировать фоллбэк
$decCfg = RaznaryadkaProgress::monthConfig($CONFIG_NO_DEC, '2026-12', 31);
echo (isset($decCfg['days']) && count($decCfg['days']) === 31 ? "PASS" : "FAIL") . ": monthConfig() для не подготовленного месяца — фоллбэк на generateMonth(), 31 день\n";
$novCfg = RaznaryadkaProgress::monthConfig($CONFIG, '2026-11', 30);
echo ($novCfg === $CONFIG['months']['2026-11'] ? "PASS" : "FAIL") . ": monthConfig() для подготовленного месяца — возвращает ИЗ конфига, не генерирует заново\n";

echo "=== Test 4: RaznaryadkaProgress::report() — совпадение типа задания засчитывает прогресс ===\n";
$ops = new FakeOps(['id' => 1, 'raznaryadka_data' => json_encode(['month' => '2026-11', 'days' => [], 'claimed' => []])], $CONFIG);
// report() сам вызывает self::mskDay()/mskMonthKey() от РЕАЛЬНОГО текущего времени — тест
// обязан подставлять задание на СЕГОДНЯШНИЙ день, иначе матч никогда не случится. Подменяем
// конфиг так, чтобы сегодняшний (любой реальный) день месяца имел нужный тип — проще: кладём
// задание 'energy' на ЛЮБОЙ день through PHP не предскажешь без вызова — вызываем сперва
// RaznaryadkaProgress::mskDay() и строим конфиг именно под него.
$todayDay = RaznaryadkaProgress::mskDay();
$todayMonth = RaznaryadkaProgress::mskMonthKey();
$cfgToday = $CONFIG;
$cfgToday['months'][$todayMonth] = ['days' => [strval($todayDay) => ['type' => 'energy', 'need' => 15]]];
$ops2 = new FakeOps(['id' => 1, 'raznaryadka_data' => json_encode(['month' => $todayMonth, 'days' => [], 'claimed' => []])], $cfgToday);

RaznaryadkaProgress::report($ops2, 'energy', 10);
$stored = json_decode($ops2->userRow['raznaryadka_data'], true);
$prog1 = $stored['days'][strval($todayDay)]['prog'] ?? null;
echo ($prog1 === 10 ? "PASS" : "FAIL") . ": energy +10 -> prog=10 (ещё не done, need=15), получено " . var_export($prog1, true) . "\n";
$status1 = $stored['days'][strval($todayDay)]['status'] ?? null;
echo ($status1 === 'pending' ? "PASS" : "FAIL") . ": статус всё ещё pending (10 < 15), получено '$status1'\n";

RaznaryadkaProgress::report($ops2, 'energy', 10); // ещё +10 -> итого 20 >= 15
$stored2 = json_decode($ops2->userRow['raznaryadka_data'], true);
$status2 = $stored2['days'][strval($todayDay)]['status'] ?? null;
echo ($status2 === 'done' ? "PASS" : "FAIL") . ": после второго +10 (итого 20>=15) -> status=done, получено '$status2'\n";

echo "=== Test 5: RaznaryadkaProgress::report() — задание ДРУГОГО типа не засчитывается ===\n";
$ops3 = new FakeOps(['id' => 1, 'raznaryadka_data' => json_encode(['month' => $todayMonth, 'days' => [], 'claimed' => []])], $cfgToday);
RaznaryadkaProgress::report($ops3, 'sukhari', 100); // сегодня задание 'energy', не 'sukhari'
$stored3 = json_decode($ops3->userRow['raznaryadka_data'], true);
$hasToday = isset($stored3['days'][strval($todayDay)]);
echo (!$hasToday ? "PASS" : "FAIL") . ": report('sukhari',...) при задании типа 'energy' -> прогресс НЕ создаётся, получено " . var_export($stored3['days'] ?? null, true) . "\n";

echo "=== Test 6: RaznaryadkaProgress::report() — boss-тип сверяет конкретный boss_id ===\n";
$cfgBoss = $CONFIG;
$cfgBoss['months'][$todayMonth] = ['days' => [strval($todayDay) => ['type' => 'boss', 'need' => 1, 'boss_id' => 0]]];
$ops4 = new FakeOps(['id' => 1, 'raznaryadka_data' => json_encode(['month' => $todayMonth, 'days' => [], 'claimed' => []])], $cfgBoss);
RaznaryadkaProgress::report($ops4, 'boss', 1, ['boss_id' => 5]); // убит ДРУГОЙ босс (id5, не id0)
$stored4 = json_decode($ops4->userRow['raznaryadka_data'], true);
echo (!isset($stored4['days'][strval($todayDay)]) ? "PASS" : "FAIL") . ": убийство чужого босса (id5 вместо id0) НЕ засчитывает задание 'Победить <id0>'\n";
RaznaryadkaProgress::report($ops4, 'boss', 1, ['boss_id' => 0]); // правильный босс
$stored5 = json_decode($ops4->userRow['raznaryadka_data'], true);
echo (($stored5['days'][strval($todayDay)]['status'] ?? null) === 'done' ? "PASS" : "FAIL") . ": убийство ПРАВИЛЬНОГО босса (id0) засчитывает и сразу закрывает (need=1)\n";

echo "=== Test 8: RaznaryadkaProgress::grantTier() — пистолет/автомат выдают РЕАЛЬНЫЙ инвентарь оружия ===\n";
// 24.10.2026 (баг найден по прямому указанию — "нельзя собрать награду пистолет/автомат"):
// прежние поля 'gun_count'/'auto_count' были абстрактными счётчиками для ачивок, не реальным
// инвентарём — вдобавок похоже не существовали как колонки БД вообще (saveUser() ронял весь
// UPDATE). Теперь grantTier() с 'weapon_type' пишет напрямую в weapons-блоб тем же путём, что
// честная покупка (weapons.php.buy())/dice.php._grantWeaponReward().
$userW = ['id' => 1];
RaznaryadkaProgress::grantTier($ops, $userW, ['weapon_type' => 'gun', 'amt' => 20]);
$weaponsW = json_decode($userW['weapons'], true);
echo (($weaponsW[4]['qty'] ?? null) === 20 ? "PASS" : "FAIL") . ": пистолет (weapon_type=gun, amt=20) -> weapons[4].qty=20, получено " . json_encode($weaponsW[4] ?? null) . "\n";
echo (($weaponsW[4]['owned'] ?? null) === true ? "PASS" : "FAIL") . ": weapons[4].owned=true после выдачи\n";
echo (($userW['ammo_gun'] ?? null) === '20' ? "PASS" : "FAIL") . ": legacy-колонка ammo_gun зеркалит qty ('20'), получено " . var_export($userW['ammo_gun'] ?? null, true) . "\n";

RaznaryadkaProgress::grantTier($ops, $userW, ['weapon_type' => 'auto', 'amt' => 10]);
$weaponsW2 = json_decode($userW['weapons'], true);
echo (($weaponsW2[5]['qty'] ?? null) === 10 ? "PASS" : "FAIL") . ": автомат (weapon_type=auto, amt=10) -> weapons[5].qty=10, получено " . json_encode($weaponsW2[5] ?? null) . "\n";
echo (($weaponsW2[4]['qty'] ?? null) === 20 ? "PASS" : "FAIL") . ": ранее выданный пистолет (weapons[4].qty=20) НЕ затёрт повторным вызовом, получено " . json_encode($weaponsW2[4] ?? null) . "\n";

echo "=== Test 9: RaznaryadkaProgress::grantTier() — патроны идут в 'bullets' (валюта ящика), не ammo_auto (валюта боя с боссом) ===\n";
$userB = ['id' => 1, 'bullets' => '3'];
RaznaryadkaProgress::grantTier($ops, $userB, ['field' => 'bullets', 'amt' => 2]);
echo ((intval($userB['bullets'] ?? 0) === 5) ? "PASS" : "FAIL") . ": bullets 3+2=5, получено " . var_export($userB['bullets'] ?? null, true) . "\n";
echo (!isset($userB['ammo_auto']) ? "PASS" : "FAIL") . ": ammo_auto (патроны боя с боссом) НЕ тронут наградой 'патроны ящика'\n";

echo "=== Test 10: RaznaryadkaProgress::grantTier() — сундук: coins + бонус-автомат (bonus_weapon_type) ===\n";
$userC = ['id' => 1, 'coins' => '100'];
RaznaryadkaProgress::grantTier($ops, $userC, ['field' => 'coins', 'amt' => 130, 'bonus_weapon_type' => 'auto', 'bonus_amt' => 10]);
echo ((intval($userC['coins'] ?? 0) === 230) ? "PASS" : "FAIL") . ": coins 100+130=230, получено " . var_export($userC['coins'] ?? null, true) . "\n";
$weaponsC = json_decode($userC['weapons'], true);
echo (($weaponsC[5]['qty'] ?? null) === 10 ? "PASS" : "FAIL") . ": бонусный автомат (bonus_weapon_type=auto, bonus_amt=10) -> weapons[5].qty=10, получено " . json_encode($weaponsC[5] ?? null) . "\n";

echo "=== Test 11: RaznaryadkaProgress::grantTier() — учитывает уже существующий (более свежий) legacy ammo_* ===\n";
// Та же защита, что в dice.php._grantWeaponReward(): max(blob.qty, legacy ammo_*) как база,
// чтобы награда не "съедала" оружие, честно купленное через weapons.php.buy() в обход блоба.
$userL = ['id' => 1, 'ammo_gun' => '50', 'weapons' => json_encode([4 => ['owned' => true, 'equipped' => false, 'upg' => 0, 'qty' => 5]])];
RaznaryadkaProgress::grantTier($ops, $userL, ['weapon_type' => 'gun', 'amt' => 20]);
$weaponsL = json_decode($userL['weapons'], true);
echo (($weaponsL[4]['qty'] ?? null) === 70 ? "PASS" : "FAIL") . ": база = max(блоб qty=5, legacy ammo_gun=50) = 50, +20 = 70, получено " . json_encode($weaponsL[4] ?? null) . "\n";

echo "=== Test 7: RaznaryadkaProgress date-хелперы — валидный диапазон/формат (не зависят от мока) ===\n";
echo (preg_match('/^\d{4}-\d{2}$/', $todayMonth) === 1 ? "PASS" : "FAIL") . ": mskMonthKey() формат YYYY-MM, получено '$todayMonth'\n";
echo ($todayDay >= 1 && $todayDay <= 31 ? "PASS" : "FAIL") . ": mskDay() в диапазоне 1..31, получено $todayDay\n";
$dim = RaznaryadkaProgress::daysInMskMonth();
echo ($dim >= 28 && $dim <= 31 ? "PASS" : "FAIL") . ": daysInMskMonth() в диапазоне 28..31, получено $dim\n";

echo "=== Test 12: RaznaryadkaProgress::effectiveDay() — dev_day_offset сдвигает 'сегодня', капается на daysInMskMonth() ===\n";
// 24.10.2026 (по прямому указанию — дев-кнопка "пропустить день", без подмены системных часов).
echo (RaznaryadkaProgress::effectiveDay(['dev_day_offset' => 0]) === $todayDay
    ? "PASS" : "FAIL") . ": offset=0 -> effectiveDay()===mskDay(), получено " . RaznaryadkaProgress::effectiveDay(['dev_day_offset' => 0]) . " (ожидалось $todayDay)\n";
$expectedPlus3 = min($todayDay + 3, $dim);
echo (RaznaryadkaProgress::effectiveDay(['dev_day_offset' => 3]) === $expectedPlus3
    ? "PASS" : "FAIL") . ": offset=3 -> mskDay()+3 (с капом на daysInMskMonth()), получено " . RaznaryadkaProgress::effectiveDay(['dev_day_offset' => 3]) . " (ожидалось $expectedPlus3)\n";
echo (RaznaryadkaProgress::effectiveDay(['dev_day_offset' => 9999]) === $dim
    ? "PASS" : "FAIL") . ": огромный offset капается РОВНО на daysInMskMonth() (" . $dim . "), не уезжает за пределы месяца, получено " . RaznaryadkaProgress::effectiveDay(['dev_day_offset' => 9999]) . "\n";
echo (RaznaryadkaProgress::effectiveDay(['dev_day_offset' => -5]) === $todayDay
    ? "PASS" : "FAIL") . ": отрицательный offset игнорируется (max(0,...)), получено " . RaznaryadkaProgress::effectiveDay(['dev_day_offset' => -5]) . " (ожидалось $todayDay)\n";
echo (RaznaryadkaProgress::effectiveDay([]) === $todayDay
    ? "PASS" : "FAIL") . ": отсутствующий dev_day_offset ведёт себя как 0 (не варнинг/ошибка), получено " . RaznaryadkaProgress::effectiveDay([]) . "\n";

echo "=== Test 13: RaznaryadkaProgress::report() — учитывает dev_day_offset, засчитывает прогресс в ПРОПУЩЕННЫЙ день, не в реальный сегодняшний ===\n";
// Пропускаем на +1 день — та же формула капа, что в effectiveDay(). В ПОСЛЕДНИЙ день месяца
// (todayDay === daysInMskMonth()) пропускать уже некуда — эта ветка просто подтверждает, что
// offset>0 тогда не ломает effectiveDay() (остаётся равен todayDay, см. Test 12), а не создаёт
// ложный FAIL из-за того, что "пропущенный" и "реальный" день совпали бы.
$skippedDay = min($todayDay + 1, $dim);
if($skippedDay === $todayDay){
    echo "PASS: сегодня последний день месяца ($todayDay/$dim) — пропускать некуда, Test 13 пропущен содержательно (см. Test 12 про кап)\n";
} else {
    $cfgSkip = $CONFIG;
    // Сегодняшний (реальный) день — задание 'energy' (чтобы отличить от пропущенного).
    $cfgSkip['months'][$todayMonth]['days'][strval($todayDay)] = ['type' => 'energy', 'need' => 15];
    // Пропущенный (todayDay+1) день — задание 'sukhari'.
    $cfgSkip['months'][$todayMonth]['days'][strval($skippedDay)] = ['type' => 'sukhari', 'need' => 30];
    $opsSkip = new FakeOps(['id' => 1, 'raznaryadka_data' => json_encode(['month' => $todayMonth, 'days' => [], 'claimed' => [], 'dev_day_offset' => $skippedDay - $todayDay])], $cfgSkip);
    RaznaryadkaProgress::report($opsSkip, 'sukhari', 30); // действие соответствует заданию ПРОПУЩЕННОГО дня
    $storedSkip = json_decode($opsSkip->userRow['raznaryadka_data'], true);
    echo ((($storedSkip['days'][strval($skippedDay)]['status'] ?? null) === 'done')
        ? "PASS" : "FAIL") . ": report('sukhari',30) при dev_day_offset засчитался в ПРОПУЩЕННЫЙ день ($skippedDay), получено " . json_encode($storedSkip['days'] ?? null) . "\n";
    echo ((!isset($storedSkip['days'][strval($todayDay)]))
        ? "PASS" : "FAIL") . ": РЕАЛЬНЫЙ сегодняшний день ($todayDay, задание 'energy') НЕ затронут — report() не матчит его при активном offset\n";
}

echo "=== Test 14: RaznaryadkaProgress::devForceLaunchMonth() — переключает месяц на launch_month, автосбор невыбранных наград, dev_day_offset не переносится ===\n";
// 25.10.2026 (по прямому указанию, dev-кнопка "как будто 1 ноября" в dev_panel.js): закрывает
// текущий сохранённый месяц ТОЙ ЖЕ логикой, что обычная граница календарного месяца
// (_closeMonthAndStartNew(), общий код с _rollover()), только целевой месяц — launch_month
// из конфига, не mskMonthKey(). 2 честно выполненных дня старого месяца -> хватает на тир
// need:2 (coins+30), но НЕ хватает на сундук (need:-1, т.е. ВСЕ дни старого месяца).
$cfgLaunch = $CONFIG;
$cfgLaunch['launch_month'] = '2026-11';
// $CONFIG['months'] изначально содержит только '2026-11' (с 2 днями) — monthCfg для СТАРОГО
// месяца ($todayMonth) без этой записи дал бы daysInThatMonth=0, из-за чего тир need:-1
// тривиально сработал бы (doneCount>=0 всегда true) и сундук выдался бы незаслуженно. Явно
// задаём старому месяцу 5 дней, чтобы need:-1 (сундук) НЕ сработал при 2 выполненных днях —
// тест должен проверять выдачу ТОЛЬКО тира need:2, не оба тира разом.
$cfgLaunch['months'][$todayMonth] = ['days' => array_fill_keys(['1','2','3','4','5'], ['type' => 'energy', 'need' => 1])];
$oldDays = ['1' => ['status' => 'done'], '2' => ['status' => 'done']];
$userLaunch = ['id' => 1, 'coins' => '0', 'raznaryadka_data' => json_encode(['month' => $todayMonth, 'days' => $oldDays, 'claimed' => [], 'dev_day_offset' => 5])];
$opsLaunch = new FakeOps($userLaunch, $cfgLaunch);
$resultData = RaznaryadkaProgress::devForceLaunchMonth($opsLaunch, $userLaunch);
echo (($resultData['month'] ?? null) === '2026-11' ? "PASS" : "FAIL") . ": месяц переключён на launch_month ('2026-11'), получено " . var_export($resultData['month'] ?? null, true) . "\n";
echo (($resultData['days'] ?? ['x']) === [] ? "PASS" : "FAIL") . ": дни нового месяца пустые, получено " . json_encode($resultData['days'] ?? null) . "\n";
echo (!array_key_exists('dev_day_offset', $resultData) ? "PASS" : "FAIL") . ": dev_day_offset НЕ перенесён в новый \$data (свежий объект без ключа) — эффективный день нового месяца возвращается к реальному\n";
echo (intval($userLaunch['coins'] ?? 0) === 30 ? "PASS" : "FAIL") . ": автосбор выдал порог need:2 (coins+30) за 2 выполненных дня старого месяца, получено " . var_export($userLaunch['coins'] ?? null, true) . "\n";

echo "=== Test 15: devForceLaunchMonth() — возвращает null, если launch_month не задан в конфиге (ничего не ломает) ===\n";
$cfgNoLaunch = $CONFIG; // launch_month отсутствует в этом локальном $CONFIG
$userNoLaunch = ['id' => 1, 'raznaryadka_data' => json_encode(['month' => $todayMonth, 'days' => [], 'claimed' => []])];
$opsNoLaunch = new FakeOps($userNoLaunch, $cfgNoLaunch);
$resultNull = RaznaryadkaProgress::devForceLaunchMonth($opsNoLaunch, $userNoLaunch);
echo ($resultNull === null ? "PASS" : "FAIL") . ": launch_month отсутствует -> devForceLaunchMonth() возвращает null\n";

echo "=== Test 16: server/json/raznaryadka_config.json — launch_month реально задан ('2026-11') ===\n";
$realConfig = json_decode(file_get_contents(__DIR__ . '/../../server/json/raznaryadka_config.json'), true);
echo (($realConfig['launch_month'] ?? null) === '2026-11' ? "PASS" : "FAIL") . ": реальный конфиг launch_month='2026-11', получено " . var_export($realConfig['launch_month'] ?? null, true) . "\n";

echo "=== Test 17 (26.10.2026, баг репорт — \"нажимаю НА НОЯБРЬ, ничего не меняется\"): форснутый ВПЕРЁД месяц переживает loadAndRollover(), откат только НАЗАД ===\n";
// Сам баг: devForceLaunchMonth() корректно писал 'month'='2026-11' в $data — но САМЫЙ ПЕРВЫЙ
// следующий вызов getState()/claim()/payDay()/report() (все идут через loadAndRollover()
// -> _rollover()) видел несовпадение с РЕАЛЬНЫМ текущим месяцем и немедленно откатывал его
// обратно — форс не доживал даже до следующего рендера экрана.
{
    $futureMonth = ($todayMonth < '2026-11') ? '2026-11' : '2027-01'; // гарантированно СТРОГО впереди реального месяца теста
    $dataForced = ['month' => $futureMonth, 'days' => [], 'claimed' => []];
    $opsForced = new FakeOps(['id' => 1, 'raznaryadka_data' => json_encode($dataForced)], $CONFIG);
    [$afterRollover, ] = RaznaryadkaProgress::loadAndRollover($opsForced, $opsForced->userRow);
    echo (($afterRollover['month'] ?? null) === $futureMonth
        ? "PASS" : "FAIL") . ": forced-вперёд месяц ($futureMonth) переживает loadAndRollover(), НЕ откатывается к реальному ($todayMonth), получено " . var_export($afterRollover['month'] ?? null, true) . "\n";

    // Регресс-гвард в обратную сторону — обычный (НЕ forced) rollover как раньше работает:
    // сохранённый месяц СТРОГО РАНЬШЕ реального -> закрывается и стартует новый реальный месяц.
    $pastMonth = '2020-01'; // заведомо раньше любого реального месяца
    $dataPast = ['month' => $pastMonth, 'days' => ['1' => ['status' => 'done']], 'claimed' => []];
    $opsPast = new FakeOps(['id' => 1, 'raznaryadka_data' => json_encode($dataPast)], $CONFIG);
    [$afterRolloverPast, ] = RaznaryadkaProgress::loadAndRollover($opsPast, $opsPast->userRow);
    echo (($afterRolloverPast['month'] ?? null) === $todayMonth
        ? "PASS" : "FAIL") . ": обычный (НЕ forced) rollover по-прежнему работает — старый месяц ($pastMonth) закрывается, стартует реальный ($todayMonth), получено " . var_export($afterRolloverPast['month'] ?? null, true) . "\n";
    echo (($afterRolloverPast['days'] ?? ['x']) === [] ? "PASS" : "FAIL") . ": новый месяц стартует с пустыми днями (старый прогресс закрыт, не перенесён)\n";
}

echo "=== Test 18 (27.10.2026, баг репорт — \"форснул на ноябрь, показывается 27 ноября вместо 1\"): baseDay()/daysInMonthFor()/effectiveDay() для форснутого ВПЕРЁД месяца ===\n";
// Корень бага: effectiveDay() раньше ВСЕГДА брало реальный mskDay() как базу — после
// devForceLaunchMonth() (data['month'] = launch_month, например "2026-11" при реальном "2026-10")
// это давало "27 ноября" (реальное число дня октября) вместо ожидаемого старта форснутого
// месяца с дня 1. baseDay($data) теперь возвращает 1, когда data['month'] СТРОГО ВПЕРЕДИ
// реального текущего месяца — тот же трюк computedFutureMonth, что в Test 17 выше (гарантированно
// впереди реального месяца теста, не хардкод конкретной даты).
{
    $futureMonth2 = ($todayMonth < '2026-11') ? '2026-11' : '2027-01';

    echo (RaznaryadkaProgress::baseDay(['month' => $futureMonth2]) === 1
        ? "PASS" : "FAIL") . ": baseDay() для форснутого ВПЕРЁД месяца ($futureMonth2) = 1 (не реальный mskDay()), получено " . RaznaryadkaProgress::baseDay(['month' => $futureMonth2]) . "\n";
    echo (RaznaryadkaProgress::baseDay(['month' => $todayMonth]) === $todayDay
        ? "PASS" : "FAIL") . ": baseDay() для ТЕКУЩЕГО реального месяца = mskDay() (обычное поведение не сломано), получено " . RaznaryadkaProgress::baseDay(['month' => $todayMonth]) . "\n";
    echo (RaznaryadkaProgress::baseDay([]) === $todayDay
        ? "PASS" : "FAIL") . ": baseDay() без ключа 'month' трактует его как текущий реальный месяц (= mskDay()), получено " . RaznaryadkaProgress::baseDay([]) . "\n";

    // Ноябрь — всегда 30 дней, независимо от года (детерминировано, без привязки к реальной дате теста).
    echo (RaznaryadkaProgress::daysInMonthFor('2026-11') === 30
        ? "PASS" : "FAIL") . ": daysInMonthFor('2026-11') = 30, получено " . RaznaryadkaProgress::daysInMonthFor('2026-11') . "\n";
    echo (RaznaryadkaProgress::daysInMonthFor($todayMonth) === $dim
        ? "PASS" : "FAIL") . ": daysInMonthFor(\$todayMonth) совпадает с daysInMskMonth() для реального текущего месяца, получено " . RaznaryadkaProgress::daysInMonthFor($todayMonth) . " (ожидалось $dim)\n";

    // Главная регрессия из багрепорта: форснутый вперёд месяц, offset=0 -> день 1 (НЕ "27 ноября").
    echo (RaznaryadkaProgress::effectiveDay(['month' => $futureMonth2, 'dev_day_offset' => 0]) === 1
        ? "PASS" : "FAIL") . ": effectiveDay() для форснутого ВПЕРЁД месяца при offset=0 = 1 (баг — был реальный mskDay(), например 27), получено " . RaznaryadkaProgress::effectiveDay(['month' => $futureMonth2, 'dev_day_offset' => 0]) . "\n";
    echo (RaznaryadkaProgress::effectiveDay(['month' => $futureMonth2, 'dev_day_offset' => 2]) === 3
        ? "PASS" : "FAIL") . ": effectiveDay() для форснутого ВПЕРЁД месяца при offset=2 = 3 (1+2), получено " . RaznaryadkaProgress::effectiveDay(['month' => $futureMonth2, 'dev_day_offset' => 2]) . "\n";
    // Регресс-гвард: обычный (не форснутый) случай с явным 'month'===реальный месяц работает так же,
    // как уже проверено в Test 12 (там $data без ключа 'month' вообще).
    echo (RaznaryadkaProgress::effectiveDay(['month' => $todayMonth, 'dev_day_offset' => 0]) === $todayDay
        ? "PASS" : "FAIL") . ": effectiveDay() с явным \$data['month']===реальный месяц ведёт себя как раньше (=mskDay()), получено " . RaznaryadkaProgress::effectiveDay(['month' => $todayMonth, 'dev_day_offset' => 0]) . "\n";
}

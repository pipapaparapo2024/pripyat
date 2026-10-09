<?php
// 08.10.2026: реальное исполнение Rewardlinks::_applyRewardEntry() через Reflection — метод
// чистый (не трогает $link/БД), поэтому не нужен fake mysqli, достаточно минимального registry
// для конструктора Gameops. Проверяет РЕАЛЬНОЕ поведение, а не текст исходника: что начисление
// ammo_machete/ammo_gun/ammo_auto через reward-ссылку действительно переводит оружие в
// owned=true с правильным qty в $user['weapons'] — ровно то, что bosses.php.attack() читает
// перед тем, как разрешить атаку (fail(89), если owned пусто).
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/rewardlinks.php';

function assertEq($actual, $expected, $msg){
    $ok = $actual === $expected;
    echo ($ok ? "PASS: " : "FAIL: ") . $msg;
    if(!$ok) echo " (ожидалось " . var_export($expected, true) . ", получили " . var_export($actual, true) . ")";
    echo "\n";
}
function assertTrue($cond, $msg){
    echo ($cond ? "PASS: " : "FAIL: ") . $msg . "\n";
}

function invokeApplyEntry($rl, &$user, $entry, &$state){
    $ref = new ReflectionMethod($rl, '_applyRewardEntry');
    return $ref->invokeArgs($rl, [&$user, $entry, &$state]);
}

class FakeCatalog {
    function get($name, $flat = false){ return []; }
}
$registry = ['json' => new FakeCatalog()];
$rl = new Rewardlinks($registry);

echo "=== Test 1: ammo_auto на ЧИСТОМ аккаунте (без поля weapons вообще) — автомат становится owned=true ===\n";
{
    $user = []; // ни одного поля weapons — как у реального нового игрока до первой покупки
    $state = ['shmot' => null, 'bosses_data' => null, 'weapons' => null];
    $result = invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'ammo_auto', 'amount' => 10], $state);

    assertTrue($result !== null, 'метод вернул запись для summary (не null)');
    assertEq($result['kind'], 'currency', 'summary.kind === currency (клиент показывает как обычную валюту, тот же UI)');
    assertEq($result['field'], 'ammo_auto', 'summary.field === ammo_auto');
    assertTrue($state['weapons'] !== null, '$state[\'weapons\'] проинициализирован (лениво, из user[\'weapons\'])');
    assertEq(count($state['weapons']), 6, 'массив weapons дополнен до 6 слотов (нож/цепь/бита/мачете/ствол/автомат)');
    assertEq($state['weapons'][5]['owned'], true, 'АВТОМАТ (idx 5) теперь owned=true — САМА СУТЬ ФИКСА: bosses.php.attack() пропустит проверку fail(89)');
    assertEq($state['weapons'][5]['qty'], 10, 'qty автомата = 10 (ровно сумма из награды)');
    assertEq($user['ammo_auto'], '10', 'легаси-зеркало user[\'ammo_auto\'] синхронизировано с реальным qty (тот же паттерн, что weapons.php.buy())');
}

echo "\n=== Test 2 (РЕГРЕССИЯ ИЗ РЕПОРТА): на аккаунте, где автомат уже НЕ куплен, но ЕСТЬ 3 бесплатных + остальной массив — тот же результат ===\n";
{
    // Реалистичная форма weapons ДО фикса (бесплатное оружие owned, платное — нет, qty=0) —
    // именно так выглядел аккаунт игрока, который репортил баг.
    $user = ['weapons' => json_encode([
        ['owned' => true,  'equipped' => true,  'upg' => 0, 'qty' => 0],
        ['owned' => true,  'equipped' => false, 'upg' => 0, 'qty' => 0],
        ['owned' => true,  'equipped' => false, 'upg' => 0, 'qty' => 0],
        ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0],
        ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0],
        ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0],
    ])];
    $state = ['shmot' => null, 'bosses_data' => null, 'weapons' => null];
    invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'ammo_auto', 'amount' => 10], $state);

    assertEq($state['weapons'][5]['owned'], true, 'автомат переведён в owned=true (ДО фикса оставался false — отсюда fail(89) "оружие не куплено" при атаке)');
    assertEq($state['weapons'][5]['qty'], 10, 'qty = 10');
    assertEq($state['weapons'][0]['owned'], true, 'бесплатное оружие (нож, idx 0) не тронуто — осталось owned=true, как было');
    assertEq($state['weapons'][0]['qty'], 0, 'qty ножа не тронут (0, как и было — бесплатное оружие считает иначе)');
}

echo "\n=== Test 3: ОДНА ссылка даёт ammo_auto+ammo_gun+ammo_machete разом (реальный кейс репорта — \"пацанский хабар и оружие в одной посылке\") ===\n";
{
    $user = [];
    $state = ['shmot' => null, 'bosses_data' => null, 'weapons' => null];
    $r1 = invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'ammo_auto',    'amount' => 10], $state);
    $r2 = invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'ammo_gun',     'amount' => 35], $state);
    $r3 = invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'ammo_machete', 'amount' => 50], $state);

    assertTrue($r1 !== null && $r2 !== null && $r3 !== null, 'все три строки дали результат для summary');
    assertEq($state['weapons'][5]['owned'], true, 'автомат owned=true');
    assertEq($state['weapons'][5]['qty'], 10, 'автомат qty=10');
    assertEq($state['weapons'][4]['owned'], true, 'ствол owned=true');
    assertEq($state['weapons'][4]['qty'], 35, 'ствол qty=35');
    assertEq($state['weapons'][3]['owned'], true, 'мачете owned=true');
    assertEq($state['weapons'][3]['qty'], 50, 'мачете qty=50');
    assertEq($user['ammo_auto'], '10', 'легаси-зеркало ammo_auto=10');
    assertEq($user['ammo_gun'], '35', 'легаси-зеркало ammo_gun=35');
    assertEq($user['ammo_machete'], '50', 'легаси-зеркало ammo_machete=50');
}

echo "\n=== Test 4: повторная выдача ДОБАВЛЯЕТ к уже имеющемуся qty, а не перезаписывает (игрок уже владеет и что-то докупил/получил раньше) ===\n";
{
    $user = ['weapons' => json_encode([
        ['owned' => true, 'equipped' => true, 'upg' => 0, 'qty' => 0],
        ['owned' => true, 'equipped' => false, 'upg' => 0, 'qty' => 0],
        ['owned' => true, 'equipped' => false, 'upg' => 0, 'qty' => 0],
        ['owned' => true, 'equipped' => false, 'upg' => 0, 'qty' => 20], // мачете уже куплено и использовалось
        ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0],
        ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0],
    ])];
    $state = ['shmot' => null, 'bosses_data' => null, 'weapons' => null];
    invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'ammo_machete', 'amount' => 50], $state);

    assertEq($state['weapons'][3]['qty'], 70, 'qty = 20 (было) + 50 (награда) = 70, не перезаписано поверх');
    assertEq($state['weapons'][3]['owned'], true, 'owned остаётся true (уже было true)');
}

echo "\n=== Test 5: обычная валюта (coins) НЕ затронута рефакторингом — идёт старым путём через Gameops::add() ===\n";
{
    $user = ['coins' => '100'];
    $state = ['shmot' => null, 'bosses_data' => null, 'weapons' => null];
    $result = invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'coins', 'amount' => 50], $state);

    assertEq($user['coins'], 150, 'coins = 100 + 50 = 150 (обычное сложение, как раньше)');
    assertEq($result['field'], 'coins', 'summary.field === coins');
    assertTrue($state['weapons'] === null, '$state[\'weapons\'] НЕ тронут (coins — не оружейное поле, weapons вообще не трогается)');
}

echo "\n=== Test 6: неизвестное/запрещённое поле отклоняется (whitelist CURRENCY_FIELDS по-прежнему работает) ===\n";
{
    $user = [];
    $state = ['shmot' => null, 'bosses_data' => null, 'weapons' => null];
    $result = invokeApplyEntry($rl, $user, ['kind' => 'currency', 'field' => 'is_admin', 'amount' => 1], $state);
    assertTrue($result === null, 'произвольное поле (не из CURRENCY_FIELDS) отклонено — вернул null, ничего не записал');
    assertTrue(!isset($user['is_admin']), 'user[\'is_admin\'] не появилось');
}

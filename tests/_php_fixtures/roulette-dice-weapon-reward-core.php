<?php
// 11.10.2026 — реальное исполнение Roulette::_grantWeaponReward()/Dice::_grantWeaponReward()
// (1-в-1 порт уже проверенного poker.php._grantWeaponReward(), см. tests/poker-weapon-reward.php).
// Минимальный стаб Gameops — методу нужен только j() (JSON-геттер с учётом того, что
// Database::trueJSON() могла уже вернуть массив), конструктор ничего не делает.
class Gameops {
    function __construct($registry) {}
    function j($user, $key, $default) {
        $value = $user[$key] ?? $default;
        if(is_array($value)) return $value;
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $default;
    }
}
require __DIR__ . '/../../server/core/controllers/roulette.php';
require __DIR__ . '/../../server/core/controllers/dice.php';

$passed = 0; $failed = 0;
function check($cond, $msg){
    global $passed, $failed;
    if($cond){ echo "PASS: $msg\n"; $passed++; }
    else { echo "FAIL: $msg\n"; $failed++; }
}

foreach([['Roulette', new Roulette([])], ['Dice', new Dice([])]] as [$clsName, $instance]){
    $grant = new ReflectionMethod(get_class($instance), '_grantWeaponReward');

    // 1) Начисление поверх уже существующего запаса — owned/upg сохраняются, qty растёт.
    foreach([['auto',5,40], ['gun',4,5], ['machete',3,12]] as [$type,$id,$amount]){
        $user = ['weapons' => json_encode(array_fill(0,6,
            ['owned'=>false,'equipped'=>false,'upg'=>3,'qty'=>10]))];
        $grant->invokeArgs($instance, [&$user, $type, $amount]);
        $data = json_decode($user['weapons'], true);
        check($data[$id]['qty'] === 10+$amount, "$clsName: $type qty = 10+$amount поверх существующего запаса");
        check($data[$id]['owned'] === true && $data[$id]['upg'] === 3, "$clsName: $type owned=true, upg сохранён");
        check($user['ammo_'.$type] === strval(10+$amount), "$clsName: legacy ammo_$type синхронизирован");
        check($data[($id+1)%6]['qty'] === 10, "$clsName: соседний слот $type не задет");
    }

    // 2) Легаси-only инвентарь (нет weapons вообще, только ammo_auto) — не теряется.
    $user = ['ammo_auto'=>'70'];
    $grant->invokeArgs($instance, [&$user, 'auto', 40]);
    check(json_decode($user['weapons'],true)[5]['qty'] === 110, "$clsName: legacy-only ammo_auto сохранён при первом начислении weapons");

    // 3) Неизвестный тип / нулевая-отрицательная сумма — no-op, ничего не ломает.
    $before = $user;
    $grant->invokeArgs($instance, [&$user, 'coins', 20]);
    check($user === $before, "$clsName: неоружейный тип не трогает weapons");
    $grant->invokeArgs($instance, [&$user, 'auto', -1]);
    check($user === $before, "$clsName: отрицательная сумма игнорируется");
    $grant->invokeArgs($instance, [&$user, 'auto', 0]);
    check($user === $before, "$clsName: нулевая сумма игнорируется");
}

echo "\n$passed passed, $failed failed\n";
if($failed > 0) exit(1);

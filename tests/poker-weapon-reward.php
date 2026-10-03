<?php
// Run with PHP CLI before deployment. Executes the production reward helper.
class Gameops {
    function __construct($registry) {}
    function j($user, $key, $default) {
        $value = $user[$key] ?? $default;
        return is_string($value) ? json_decode($value, true) : $value;
    }
}
require __DIR__ . '/../server/core/controllers/poker.php';
$poker = new Poker([]);
$grant = new ReflectionMethod(Poker::class, '_grantWeaponReward');
$grant->setAccessible(true);
function check($condition, $message) {
    if(!$condition) throw new RuntimeException($message);
}
foreach([['auto',5,40], ['gun',4,5]] as [$type,$id,$amount]){
    $user = ['weapons' => json_encode(array_fill(0,6,
        ['owned'=>false,'equipped'=>false,'upg'=>3,'qty'=>10]))];
    $grant->invokeArgs($poker, [&$user, $type, $amount]);
    $data = json_decode($user['weapons'], true);
    check($data[$id]['qty'] === 10+$amount, 'reward added to existing stock');
    check($data[$id]['owned'] === true && $data[$id]['upg'] === 3, 'ownership and upgrade');
    check($user['ammo_'.$type] === strval(10+$amount), 'legacy ammo synchronized');
    check($data[3]['qty'] === 10, 'unrelated weapon unchanged');
}
$user = ['ammo_auto'=>'70'];
$grant->invokeArgs($poker, [&$user, 'auto', 40]);
check(json_decode($user['weapons'],true)[5]['qty'] === 110, 'legacy-only inventory preserved');
$before = $user;
$grant->invokeArgs($poker, [&$user, 'coins', 20]);
check($user === $before, 'currency reward cannot alter weapons');
$grant->invokeArgs($poker, [&$user, 'auto', -1]);
check($user === $before, 'negative reward ignored');
echo "Poker weapon reward checks passed\n";

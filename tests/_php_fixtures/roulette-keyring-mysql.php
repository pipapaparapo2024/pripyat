<?php
// Run on the test VPS with its local MySQL socket. Every table here is connection-local.
require $argv[1].'/core/models/gameops.php';
require $argv[2];
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$db = new mysqli('localhost', 'root', '', 'stalker_test', 0, '/run/mysqld/mysqld.sock');
$db->query('CREATE TEMPORARY TABLE roulette_state (id INT PRIMARY KEY, keyring_cycle_ends_at INT NOT NULL) ENGINE=InnoDB');
$db->query("CREATE TEMPORARY TABLE users (
    id INT PRIMARY KEY, blue_points INT, roulette_cups TEXT, exp INT, level INT,
    keyring_owner INT DEFAULT 0, dev_force_jackpot INT DEFAULT 0, dev_force_roulette VARCHAR(4) DEFAULT ''
) ENGINE=InnoDB");
$db->query('INSERT INTO roulette_state VALUES (1,0)');
$cups = ['keyring','exp:1000'];
foreach([1,2,3,4] as $id){
    $db->execute_query('INSERT INTO users (id,blue_points,roulette_cups,exp,level) VALUES (?,2,?,10,1)', [$id,json_encode($cups)]);
}
$claim = function(int $id, ?array $expectedCups, bool $forced = false) use ($db): string {
    $roulette = new Roulette(new ArrayObject(['uid'=>$id,'utb'=>'users']));
    $method = new ReflectionMethod(Roulette::class, '_tryClaimKeyring');
    $user = [];
    $db->begin_transaction();
    try {
        $outcome = $method->invokeArgs($roulette, [$db,&$user,$expectedCups,$forced]);
        $db->commit();
        return $outcome;
    } catch(Throwable $e){
        $db->rollback();
        throw $e;
    }
};
$player = fn(int $id) => $db->execute_query('SELECT * FROM users WHERE id=?', [$id])->fetch_assoc();
$cooldown = fn() => (int)$db->query('SELECT keyring_cycle_ends_at FROM roulette_state')->fetch_row()[0];
$check = function(bool $result, string $message){
    if(!$result) throw new RuntimeException($message);
};
$check($claim(1,null)==='awarded' && (int)$player(1)['keyring_owner']===1 && (int)$player(1)['blue_points']===1, 'Wheel prize was not saved with the spin cost');
$pause = $cooldown();
$check($pause >= time()+29*86400, 'Wheel did not start the shared cooldown');
$check($claim(2,$cups)==='consolation' && (int)$player(2)['exp']===1010 && !(int)$player(2)['keyring_owner'], 'Previously opened cups bypassed the cooldown');
$check($claim(2,$cups)==='stale' && (int)$player(2)['exp']===1010, 'Repeated cup paid twice');
$check($claim(3,null,true)==='awarded' && $cooldown()===$pause, 'Developer test changed the public cooldown');

$db->query('UPDATE roulette_state SET keyring_cycle_ends_at=0');
$check($claim(4,$cups)==='awarded' && $player(4)['roulette_cups']===null && (int)$player(4)['keyring_owner']===1 && $cooldown()>0, 'A valid cup did not save its prize and cooldown');
$db->query('UPDATE roulette_state SET keyring_cycle_ends_at=0');
$db->query('ALTER TABLE roulette_state ADD CHECK (keyring_cycle_ends_at <= 0)');
try {
    $claim(2,null);
    throw new RuntimeException('Expected SQL constraint failure');
} catch(mysqli_sql_exception $e){
    $check((int)$player(2)['keyring_owner']===0 && (int)$player(2)['blue_points']===2 && $cooldown()===0, 'Failed cooldown update left a partial prize');
}
echo "MySQL keyring: wheel, cups, repeat, developer isolation and rollback verified\n";

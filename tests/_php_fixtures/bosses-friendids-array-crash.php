<?php
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/bosses.php';

function invokePrivate($obj, $method, $args) {
    $ref = new ReflectionMethod($obj, $method);
    return $ref->invokeArgs($obj, $args);
}

// Фейковый udb — duck-typing только метода getData(), который реально зовёт _friendIds()
// для поиска взаимных друзей. Не поднимаем mysqli, см. tests/_php_bin.js.
class FakeUdbMutual {
    public $lastWhere = null;
    function getData($table, $fields, $where = 1, $as_array = false){
        $this->lastWhere = $where;
        // Имитируем единственного кандидата (id=111), у которого в ЕГО собственном списке
        // друзей есть мой uid (382448269) — значит дружба взаимная.
        return [['id' => 111, 'friends' => '382448269,999']];
    }
}

$myUid = 382448269;

echo "=== Test 1 (ТОЧНЫЙ прод-репорт, uid=63547944): friends пришло ПУСТЫМ МАССИВОМ []  ===\n";
// Database::trueJSON() превращает friends в [] когда в БД NULL/''/\"0\" — обычное состояние
// игрока без выданного доступа к друзьям ВК. Раньше здесь падал
// \"TypeError: explode(): Argument #2 ($string) must be of type string, array given\".
$bosses1 = new Bosses(['uid' => $myUid]);
$threw = false;
$result1 = null;
try {
    $result1 = invokePrivate($bosses1, '_friendIds', [['friends' => []]]);
} catch (\Throwable $e) {
    $threw = true;
    echo "EXCEPTION: " . $e->getMessage() . "\n";
}
echo (!$threw ? "PASS" : "FAIL") . ": friends=[] (пустой массив) — не бросает TypeError (регресс-пруф прод-краша)\n";
echo ($result1 === [] ? "PASS" : "FAIL") . ": friends=[] -> результат [] (нет друзей для проверки), получено " . var_export($result1, true) . "\n";

echo "=== Test 2: friends пришло обычной пустой строкой '' (контроль — старое поведение) ===\n";
$bosses2 = new Bosses(['uid' => $myUid]);
$result2 = invokePrivate($bosses2, '_friendIds', [['friends' => '']]);
echo ($result2 === [] ? "PASS" : "FAIL") . ": friends='' -> [] как и раньше, получено " . var_export($result2, true) . "\n";

echo "=== Test 3: friends — обычная CSV-строка (штатный путь, не должен сломаться фиксом) ===\n";
$fakeUdb3 = new FakeUdbMutual();
$bosses3 = new Bosses(['uid' => $myUid, 'udb' => $fakeUdb3, 'utb' => 'users']);
$result3 = invokePrivate($bosses3, '_friendIds', [['friends' => '111,999']]);
echo ($result3 === [111] ? "PASS" : "FAIL") . ": friends='111,999' (CSV) + взаимная дружба с 111 -> [111], получено " . var_export($result3, true) . "\n";

echo "=== Test 4 (защита в глубину): friends пришло НЕПУСТЫМ массивом (гипотетический trueJSON-кейс) ===\n";
$fakeUdb4 = new FakeUdbMutual();
$bosses4 = new Bosses(['uid' => $myUid, 'udb' => $fakeUdb4, 'utb' => 'users']);
$result4 = invokePrivate($bosses4, '_friendIds', [['friends' => [111, 999]]]);
echo ($result4 === [111] ? "PASS" : "FAIL") . ": friends=[111,999] (массив) обрабатывается так же, как CSV-строка -> [111], получено " . var_export($result4, true) . "\n";

<?php
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/raznaryadka.php';
require __DIR__ . '/../../server/core/controllers/zanachki.php';
require __DIR__ . '/../../server/core/controllers/users.php';

// Duck-typed замена $registry['tools'] — реальный Tools::error() пишет HTTP-ответ, здесь
// достаточно зафиксировать, что он реально был вызван с кодом 403 (это и есть наблюдаемый
// эффект "доступ запрещён", который проверяют тесты ниже).
class StubTools {
    public $lastErrorCode = null;
    function error($code){ $this->lastErrorCode = $code; }
}

function invokePrivate($obj, $method, $args = []) {
    $ref = new ReflectionMethod($obj, $method);
    return $ref->invokeArgs($obj, $args);
}

echo "=== Test 1: Raznaryadka — все 7 dev-permits блокируют НЕ-dev uid (29.10.2026, находка #1 аудита) ===\n";
$devMethods = ['devCompleteToday','devFailDay','devSeedMonth','devSkipDay','devResetDaySkip','devForceLaunchMonth','devRevertToRealMonth'];
foreach($devMethods as $m){
    $tools = new StubTools();
    $rz = new Raznaryadka(['uid' => '999999999', 'tools' => $tools]);
    $rz->$m();
    echo ($tools->lastErrorCode === 403 ? "PASS" : "FAIL") . ": $m() с НЕ-dev uid -> error(403), получено " . var_export($tools->lastErrorCode, true) . "\n";
}

echo "=== Test 2: Raznaryadka._isDevUser() пропускает оба известных dev uid ===\n";
foreach(['1113977365', '382448269'] as $devUid){
    $rz = new Raznaryadka(['uid' => $devUid]);
    $isDev = invokePrivate($rz, '_isDevUser');
    echo ($isDev === true ? "PASS" : "FAIL") . ": uid=$devUid распознан как dev, получено " . var_export($isDev, true) . "\n";
}
$rzStranger = new Raznaryadka(['uid' => '1']);
$isDevStranger = invokePrivate($rzStranger, '_isDevUser');
echo ($isDevStranger === false ? "PASS" : "FAIL") . ": произвольный uid='1' НЕ распознан как dev\n";

echo "=== Test 3: Zanachki.devGrantAll блокирует НЕ-dev uid (находка #4 аудита) ===\n";
$tools3 = new StubTools();
$za = new Zanachki(['uid' => '999999999', 'tools' => $tools3]);
$za->devGrantAll();
echo ($tools3->lastErrorCode === 403 ? "PASS" : "FAIL") . ": devGrantAll() с НЕ-dev uid -> error(403), получено " . var_export($tools3->lastErrorCode, true) . "\n";

$zaDev = new Zanachki(['uid' => '382448269']);
$isDevZa = invokePrivate($zaDev, '_isDevUser');
echo ($isDevZa === true ? "PASS" : "FAIL") . ": Zanachki._isDevUser() пропускает известный dev uid\n";

echo "=== Test 4: Users._sanitizeStashData() — отклоняет рост count, разрешает совпадение/снижение (находка #3 аудита) ===\n";
$users = new Users([]);
$current = ['1' => ['1' => 2, '2' => 0], '3' => ['1' => 1]];

$sameVal = invokePrivate($users, '_sanitizeStashData', [$current, $current]);
echo ($sameVal === $current ? "PASS" : "FAIL") . ": то же самое значение (idempotent autosave) -> разрешено\n";

$decreased = ['1' => ['1' => 1, '2' => 0], '3' => ['1' => 0]];
$decRes = invokePrivate($users, '_sanitizeStashData', [$current, $decreased]);
echo ($decRes === $decreased ? "PASS" : "FAIL") . ": легитимное снижение count (claimCollection списал карты) -> разрешено\n";

$attack = ['1' => ['1' => 999, '2' => 0], '3' => ['1' => 1]];
$attackRes = invokePrivate($users, '_sanitizeStashData', [$current, $attack]);
echo ($attackRes === null ? "PASS" : "FAIL") . ": РЕГРЕСС-ПРУФ — подделанный рост count (поз.1 коллекции 1: 2->999) -> отклонено (null), получено " . var_export($attackRes, true) . "\n";

$freshAccountAttack = invokePrivate($users, '_sanitizeStashData', [null, ['5' => ['3' => 10]]]);
echo ($freshAccountAttack === null ? "PASS" : "FAIL") . ": свежий аккаунт без stash_data в БД, попытка сразу выставить count=10 -> отклонено (null)\n";

$partialAttack = ['1' => ['1' => 2, '2' => 50], '3' => ['1' => 1]];
$partialRes = invokePrivate($users, '_sanitizeStashData', [$current, $partialAttack]);
echo ($partialRes === null ? "PASS" : "FAIL") . ": рост ОДНОЙ позиции (кол.1 поз.2: 0->50) при честных остальных -> весь блоб всё равно отклонён\n";

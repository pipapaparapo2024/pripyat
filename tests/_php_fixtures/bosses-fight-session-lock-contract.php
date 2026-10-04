<?php
// 04.10.2026: контрактный тест на фикс гонки boss_fight_session (_syncFightSessionLocked() +
// _commitFightSession(), см. большой комментарий над _syncFightSessionLocked() в bosses.php).
//
// ЧЕСТНОЕ ОГРАНИЧЕНИЕ этого теста: он НЕ воспроизводит настоящую многопоточную гонку —
// PHP CLI здесь однопоточный, а fake $link — один объект в памяти, а не два реальных
// mysqli-соединения, спорящих за SELECT...FOR UPDATE на уровне СУБД. Такую гонку можно поймать
// только живым нагрузочным тестом с параллельными HTTP-запросами к реальному серверу — вне
// объёма того, что можно проверить локальным PHP-скриптом.
//
// Что ПРОВЕРЯЕТСЯ здесь — контракт, от которого зависит сам фикс: КАЖДЫЙ вызов
// _syncFightSessionLocked() обязан читать boss_fight_session ЗАНОВО из $link (через SELECT...FOR
// UPDATE), а не из какого-то переданного/закэшированного состояния — то есть несколько
// ПОСЛЕДОВАТЕЛЬНЫХ циклов "read-under-lock → мутировать hp → _commitFightSession()" на одном и
// том же $uid должны КОРРЕКТНО КОМПОНОВАТЬСЯ (кумулятивно), а не терять промежуточные правки. Если
// бы _syncFightSessionLocked() читал не из $link, а продолжал бы использовать значение,
// загруженное РАНЬШЕ обычным Gameops::loadUser() (старый баг) — второй и третий вызов в этом тесте
// увидели бы устаревший hp=500 вместо актуального, и итоговый урон потерялся бы. Именно эту
// регрессию (не саму гонку, а то, что СЛОМАЛОСЬ БЫ при возврате к старому паттерну) тест и ловит.
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/bosses.php';

function invokePrivate($obj, $method, $args) {
    $ref = new ReflectionMethod($obj, $method);
    return $ref->invokeArgs($obj, $args);
}

class FakeLockLink {
    public $storedJson;
    public $beginCount = 0; public $commitCount = 0; public $selectForUpdateCount = 0;
    function __construct($initialSession){ $this->storedJson = json_encode($initialSession); }
    function begin_transaction(){ $this->beginCount++; return true; }
    function commit(){ $this->commitCount++; return true; }
    function real_escape_string($s){ return addslashes($s); }
    function query($sql){
        if(strpos($sql, 'FOR UPDATE') !== false){
            $this->selectForUpdateCount++;
            return new FakeLockResult(['boss_fight_session' => $this->storedJson]);
        }
        if(strpos($sql, 'UPDATE `users`') !== false){
            // Эмулирует реальный UPDATE ... SET `boss_fight_session`='...' WHERE `id`=N —
            // вытаскиваем ИМЕННО то значение, что _commitFightSession() реально сериализовал.
            if(preg_match("/SET `boss_fight_session`='(.*)' WHERE/s", $sql, $m)){
                $this->storedJson = stripslashes($m[1]);
            }
            return new FakeLockResult(['affected' => 1]);
        }
        // SELECT MAX(id) ... — только если $matches=false (сессия не совпала); в этом тесте
        // сессия всегда совпадает (bossId/diffIdx/startMs фиксированы), сюда не попадаем.
        return new FakeLockResult(['maxId' => 0]);
    }
}
class FakeLockResult {
    private $row;
    function __construct($row){ $this->row = $row; }
    public $num_rows = 1;
    function fetch_assoc(){ $r = $this->row; return $r; }
}

$registry = ['utb' => 'users'];
$bosses = new Bosses($registry);

$initialSession = ['bossId' => 0, 'diffIdx' => 3, 'startMs' => 1000, 'hp' => 500, 'cursorId' => 10];
$link = new FakeLockLink($initialSession);

echo "=== Test 1: три последовательных read-lock→мутировать→commit цикла — урон КОМПОНУЕТСЯ, не теряется ===\n";
// Цикл 1 — имитирует attack() с собственным уроном 50.
$s1 = invokePrivate($bosses, '_syncFightSessionLocked', [$link, 777, 3, 0, 1000, []]);
echo ($s1['hp'] === 500 ? "PASS" : "FAIL") . ": цикл 1 читает актуальный (начальный) hp=500 из \$link, получено " . var_export($s1['hp'], true) . "\n";
$s1['hp'] = max(0, $s1['hp'] - 50);
invokePrivate($bosses, '_commitFightSession', [$link, 777, $s1]);

// Цикл 2 — имитирует НЕЗАВИСИМЫЙ второй запрос (например friendsDamage()), прилетевший ПОСЛЕ
// коммита цикла 1 (лок это гарантирует — вызов не мог начаться раньше, чем предыдущий закончился).
$s2 = invokePrivate($bosses, '_syncFightSessionLocked', [$link, 777, 3, 0, 1000, []]);
echo ($s2['hp'] === 450 ? "PASS" : "FAIL") . ": цикл 2 видит РЕЗУЛЬТАТ цикла 1 (450), а не устаревший снимок (500) — именно это чинит фикс, получено " . var_export($s2['hp'], true) . "\n";
$s2['hp'] = max(0, $s2['hp'] - 30); // своя мутация (ещё один удар)
invokePrivate($bosses, '_commitFightSession', [$link, 777, $s2]);

// Цикл 3 — третий запрос, должен увидеть кумулятивный результат двух предыдущих.
$s3 = invokePrivate($bosses, '_syncFightSessionLocked', [$link, 777, 3, 0, 1000, []]);
echo ($s3['hp'] === 420 ? "PASS" : "FAIL") . ": цикл 3 видит кумулятивный результат 500-50-30=420 (ни одна правка не потеряна), получено " . var_export($s3['hp'], true) . "\n";
invokePrivate($bosses, '_commitFightSession', [$link, 777, $s3]); // закрывает транзакцию цикла 3 (без мутации — просто подтверждает прочитанное)

echo "=== Test 2: дисциплина транзакций — каждый lock-цикл реально проходит FOR UPDATE + commit, без утечек ===\n";
echo ($link->selectForUpdateCount === 3 ? "PASS" : "FAIL") . ": ровно 3 SELECT...FOR UPDATE (один на цикл), получено " . $link->selectForUpdateCount . "\n";
echo ($link->commitCount === 3 ? "PASS" : "FAIL") . ": ровно 3 commit() (каждый цикл реально снял свою блокировку), получено " . $link->commitCount . "\n";
echo ($link->beginCount === $link->commitCount ? "PASS" : "FAIL") . ": begin_transaction()==commit() по количеству — ни одна транзакция не осталась висеть незакоммиченной\n";

echo "=== Test 3: bossId/diffIdx/startMs сохраняются через цикл commit→lock (кэш не 'забывает' свою попытку) ===\n";
echo ($s3['bossId'] === 0 && $s3['diffIdx'] === 3 && $s3['startMs'] === 1000 ? "PASS" : "FAIL")
    . ": метаданные попытки не потерялись между коммитами, получено " . var_export(['bossId'=>$s3['bossId'],'diffIdx'=>$s3['diffIdx'],'startMs'=>$s3['startMs']], true) . "\n";

<?php
// 04.10.2026: регресс-тест на "урон Седого не должен попадать в рейтинг/попап результата боя
// (ни свой, ни тем более — друга)". Исходная задача была живым smoke-тестом (как уже есть для
// attack()/rating() в smoke_test_vk.js), но useSedoy() требует sedoy_dmg_left > 0, которое
// НЕЛЬЗЯ выставить ни через users.save (поле убрано из whitelist 26.09.2026), ни через
// существующие dev-эндпоинты (devGrantCurrency поддерживает только coins/stew/cigarettes) — его
// можно получить только через полный цикл habar.buy()+habar.collectDay() с реальной покупкой и
// кулдауном, что раздувает тест далеко за рамки того, что он проверяет. Вместо этого — реальное
// исполнение _ratingTop() (и транзитивно _damageSumSince()/_friendsDamagePerUserSince()) через
// fake $link, который ЗАПИСЫВАЕТ реальный SQL, что PHP фактически построил, и проверяет
// присутствие фильтра `is_sedoy`=0 в НАСТОЯЩЕМ сгенерированном запросе — а не в тексте исходника
// (это и есть разница между "работает" и "текст совпадает", см. разговор от 04.10.2026 про
// регекс-тесты).
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/bosses.php';

function invokePrivate($obj, $method, $args) {
    $ref = new ReflectionMethod($obj, $method);
    return $ref->invokeArgs($obj, $args);
}

class FakeResultSingle {
    private $row;
    function __construct($row){ $this->row = $row; }
    function fetch_assoc(){ $r = $this->row; $this->row = null; return $r; }
}
class FakeResultMulti {
    private $rows;
    function __construct($rows){ $this->rows = $rows; }
    function fetch_assoc(){ return array_shift($this->rows); }
}
class FakeLink {
    public $queries = [];
    private $mineDmg; private $friendRows;
    function __construct($mineDmg, $friendRows){ $this->mineDmg = $mineDmg; $this->friendRows = $friendRows; }
    function query($sql){
        $this->queries[] = $sql;
        if(strpos($sql, 'GROUP BY') !== false){
            $rows = [];
            foreach($this->friendRows as $uid => $dmg) $rows[] = ['uid' => $uid, 'dmg' => $dmg];
            return new FakeResultMulti($rows);
        }
        if(strpos($sql, 'SUM(`damage`) AS s') !== false){
            return new FakeResultSingle(['s' => $this->mineDmg]);
        }
        return new FakeResultSingle(['s' => 0]);
    }
}
class FakeUdb {
    function getData($tb, $cols, $cond, $multi = false){
        return [['id' => 555, 'nick' => 'Друг555']];
    }
}

$registry = ['utb' => 'users', 'udb' => new FakeUdb()];
$bosses = new Bosses($registry);

echo "=== Test 1: _ratingTop() с другом — Седой исключён из ОБОИХ запросов (мой + друзья), сортировка верна ===\n";
$myData = ['bossStartMs' => [[1000000,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]]];
$friendsSince = [555 => 900000];
$link1 = new FakeLink(100, [555 => 50]);
$entries = invokePrivate($bosses, '_ratingTop', [$link1, 777, 'Тестер', 0, 0, $myData, $friendsSince]);

echo (count($entries) === 2 ? "PASS" : "FAIL") . ": два участника (я + друг), получено " . count($entries) . "\n";
echo (isset($entries[0]) && $entries[0]['id'] === 777 && $entries[0]['damage'] === 100 ? "PASS" : "FAIL")
    . ": моя строка первая (100 урона), получено " . var_export($entries[0] ?? null, true) . "\n";
echo (isset($entries[1]) && $entries[1]['id'] === 555 && $entries[1]['damage'] === 50 ? "PASS" : "FAIL")
    . ": строка друга вторая (50 урона, nick подтянут через udb), получено " . var_export($entries[1] ?? null, true) . "\n";

$sedoyFilteredQueries = array_filter($link1->queries, function($q){ return strpos($q, 'is_sedoy`=0') !== false; });
echo (count($sedoyFilteredQueries) >= 2 ? "PASS" : "FAIL")
    . ": РЕГРЕСС-ПРУФ — РЕАЛЬНО сгенерированный SQL (не текст исходника) содержит `is_sedoy`=0 хотя бы в 2 запросах (мой урон + урон друга), найдено: " . count($sedoyFilteredQueries) . " из " . count($link1->queries) . "\n";

echo "=== Test 2: Соло (diffIdx=3) — друзья ВООБЩЕ не участвуют в рейтинге, даже если friendsSince не пуст ===\n";
$myDataSolo = ['bossStartMs' => [[0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [500000,0,0,0,0,0,0,0]]];
$link2 = new FakeLink(100, [555 => 999999]); // огромный урон друга — если бы просочился, легко увидеть в выводе
$entriesSolo = invokePrivate($bosses, '_ratingTop', [$link2, 777, 'Тестер', 0, 3, $myDataSolo, $friendsSince]);

echo (count($entriesSolo) === 1 && $entriesSolo[0]['id'] === 777 ? "PASS" : "FAIL")
    . ": Соло — только своя строка, друг не просочился, получено " . var_export($entriesSolo, true) . "\n";
$groupByQueries = array_filter($link2->queries, function($q){ return strpos($q, 'GROUP BY') !== false; });
echo (count($groupByQueries) === 0 ? "PASS" : "FAIL")
    . ": Соло — запрос урона друзей вообще НЕ выполнялся (gate diffIdx!==3 сработал до SQL, не после), запросов с GROUP BY: " . count($groupByQueries) . "\n";

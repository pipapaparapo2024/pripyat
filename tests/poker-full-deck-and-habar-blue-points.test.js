/**
 * Test: батч 19.09.2026 (по прямому указанию, после уточнения пользователем) —
 *
 *  1) "В покере не выпадают карты 2,3,4,5(,6)" — ранее считалось намеренным сужением колоды
 *     до 8 рангов (семёрка-туз), НО пользователь прислал 4 папки с полными 13-ранговыми
 *     колодами (двойка-туз) для всех мастей, и проверка SFTP-листингом подтвердила, что все
 *     52 файла УЖЕ лежат на сервере (папки images/покер масть - все 4 масти) —
 *     то есть баг был не в отсутствии картинок, а в том, что poker_config.json.ranks и
 *     server/core/controllers/poker.php._generateHandForCombo() были жёстко ограничены 8
 *     рангами (индексы 0..7 захардкожены в нескольких местах). Колода расширена до полных 13
 *     рангов; вся индексная арифметика в poker.php переведена с хардкода на count($RANKS) —
 *     чтобы больше не наступать на те же грабли при следующем изменении колоды.
 *  2) "У последних двух хабаров на референсе есть синие поинты, а в игре их нет" — habar.js
 *     контейнеры "Авторитетный"/"Элитный" уже выдавали dice_points (красная иконка), но
 *     blue_points (синяя иконка, тот же дизайн-референс) в их rewards[] не было вообще — не
 *     баг рендера (иконка в ICON_MAP уже была), просто отсутствующая запись в награде.
 *
 * Run: node tests/poker-full-deck-and-habar-blue-points.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const pokerConfig   = JSON.parse(readSrc('server/json/poker_config.json'));
const pokerPhp      = readSrc('server/core/controllers/poker.php');
const pokerJs       = readSrc('_client/src/game/dvor/dvor-poker.js');
const pokerGameJs   = readSrc('_client/src/game/dvor/dvor-poker-game.js');
const pokerTrimJs   = readSrc('_client/src/game/dvor/dvor-poker-card-trim.js');
const habarJs       = readSrc('_client/src/game/habar.js');

const FULL_RANKS = ['двойка','тройка','четверка','пятерка','шестерка','семерка','восьмерка','девятка','десятка','валет','дама','король','туз'];

console.log('\nTest 1: poker_config.json — колода расширена до полных 13 рангов (двойка..туз)');
{
    assert(pokerConfig.ranks.length === 13, 'ranks содержит ровно 13 элементов');
    assert(JSON.stringify(pokerConfig.ranks) === JSON.stringify(FULL_RANKS), 'ranks в правильном возрастающем порядке (важно для стрит/рояль-детекции)');
}

console.log('\nTest 2: dvor-poker.js._getCardImgPath — RM содержит новые ранги 2-6');
{
    const m = pokerJs.match(/const RM = \{([^}]*)\};/);
    const body = m ? m[1] : '';
    assert(/двойка:'2'/.test(body) && /тройка:'3'/.test(body) && /четверка:'4'/.test(body) && /пятерка:'5'/.test(body) && /шестерка:'6'/.test(body),
        'RM содержит маппинг двойка..шестерка → 2..6 (имя файла карты)');
}

console.log('\nTest 3: dvor-poker-game.js — косметическая анимация тасовки использует полную колоду динамически');
{
    const m = pokerGameJs.match(/const _prks = \[([^\]]*)\];/);
    assert(!!m && m[1].split(',').length === 13, '_prks содержит все 13 рангов');
    assert(/_prks\[Math\.floor\(Math\.random\(\)\*_prks\.length\)\]/.test(pokerGameJs),
        'индекс берётся от _prks.length, а не от захардкоженного *8 (не сломается при следующем изменении колоды)');
}

console.log('\nTest 4: dvor-poker-card-trim.js — прогрев кэша обрезки покрывает все 13×4=52 карты');
{
    const m = pokerTrimJs.match(/const _ALL_RANKS = \[([^\]]*)\];/);
    assert(!!m && m[1].split(',').length === 13, '_ALL_RANKS содержит все 13 рангов (иначе новые карты 2-6 не прогреются заранее)');
}

console.log('\nTest 5: poker.php._evaluateHand — рояль-флеш определяется динамически (count($order)-5), не хардкодом 3');
{
    const start = pokerPhp.indexOf('private function _evaluateHand($catalog, $hand){');
    const end   = pokerPhp.indexOf('\n        }', pokerPhp.indexOf("return 'high_card';", start));
    const body  = pokerPhp.slice(start, end);
    assert(/\$n = count\(\$order\);/.test(body), 'вычисляет $n = count($order) вместо магического числа');
    assert(/\$sorted\[0\] === \$n - 5\) return 'royal_flush';/.test(body),
        'проверка рояль-флеша использует $n-5 (старшие 5 рангов ЛЮБОЙ длины колоды), не хардкод индекса 3');
}

console.log('\nTest 6: poker.php._generateHandForCombo — вся индексная арифметика через count($RANKS), не хардкод под 8 карт');
{
    const start = pokerPhp.indexOf('private function _generateHandForCombo($catalog, $comboKey){');
    const end = pokerPhp.indexOf('function deal(){', start);
    assert(start >= 0 && end > start, 'границы генератора комбинаций найдены');
    const body  = pokerPhp.slice(start, end);
    assert(/\$n = count\(\$RANKS\);/.test(body), 'вычисляет $n = count($RANKS)');
    assert(/\$idxAll = range\(0, \$n - 1\);/.test(body), 'idxAll строится динамически через range(0, $n-1), не хардкод [0..7]');
    assert(/\$topIdxs = array_slice\(\$idxAll, -5\);/.test(body), 'royal_flush берёт старшие 5 индексов динамически (array_slice -5)');
    assert(/\$start = \$this->_pick\(range\(0, \$n - 6\)\);/.test(body), 'straight_flush исключает старт, совпадающий с рояль-флешем, по формуле $n-6');
    assert(/\$start = \$this->_pick\(range\(0, \$n - 5\)\);/.test(body), 'straight выбирает старт из полного диапазона возможных стритов по формуле $n-5');
    assert(!/\[0,1,2,3,4,5,6,7\]/.test(body), 'старый хардкод индексов [0..7] полностью убран');
}

console.log('\nTest 7: habar.js — контейнеры "Авторитетный"/"Элитный" выдают blue_points (по референсу с синей иконкой)');
{
    const start = habarJs.indexOf('this.containers = [');
    const end   = habarJs.indexOf('\n        ];', start);
    const body  = habarJs.slice(start, end);
    const authStart = body.indexOf("id:2, name:'Авторитетный'");
    const eliteStart = body.indexOf("id:3, name:'Элитный'");
    const authEnd   = eliteStart;
    const eliteEnd   = body.length;
    assert(/\{type:'blue_points',\s*amount:2\}/.test(body.slice(authStart, authEnd)), 'Авторитетный (id:2) выдаёт blue_points: 2 (столько же, сколько dice_points у него же)');
    assert(/\{type:'blue_points',\s*amount:4\}/.test(body.slice(eliteStart, eliteEnd)), 'Элитный (id:3) выдаёт blue_points: 4 (столько же, сколько dice_points у него же)');
}

console.log('\nTest 8: habar.php.collectDay/buy — реально начисляет blue_points через Gameops (не только объявлен в rewards каталоге)');
{
    // 24.09.2026 (перенос экономики хабара на сервер): клиентский switch/case, который сам
    // прибавлял r.amount к udata[...], убран целиком — habar.js больше НЕ считает награды сам,
    // только применяет res.patch/res.rewards от сервера. Начисление blue_points (и остальных
    // типов) теперь делает habar.php через общий $ops->add() по whitelist разрешённых валют.
    const habarPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'habar.php'), 'utf-8');
    assert(!/case 'blue_points':/.test(habarJs), 'клиентский switch/case для наград полностью убран из habar.js (сервер начисляет сам)');
    assert(/in_array\(\$type, \['coins','cigarettes','dice_points','blue_points','poker_chips'\], true\)/.test(habarPhp),
        "habar.php разрешает 'blue_points' в списке типов, которые начисляются через \$ops->add()");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

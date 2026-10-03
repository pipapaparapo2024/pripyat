/**
 * Test: 27.09.2026 (по прямому указанию, скриншоты — "1 и 2 картинка кол-во голубых спичек
 * видимо не синхронизированно" — экран покера показывал 2200, а сумка ("СУМКА ЗА СПИЧКИ",
 * открывается прямо с экрана покера) показывала 60 и требовала 150).
 *
 * Причина — НЕ рассинхронизация отображения, а реальное расхождение валют на сервере.
 * poker.php.resolve() честно начисляет udata['poker_spichki'] за покерные комбинации
 * (straight/three_of_a_kind/high_card, см. poker_config.json) — та же валюта, что с 27.09.2026
 * (см. poker-spichki-counter-wrong-currency-field.test.js) показывает счётчик "ГОЛУБЫЕ СПИЧКИ"
 * на самом экране покера. Но poker.php.openBag() (стоимость сумки, введено 22.09.2026) по
 * ошибке проверяла и списывала ЧУЖУЮ валюту udata['roulette_spichki'] (спички РУЛЕТКИ — тратятся
 * на кейс рулетки, dvor-roulette-buy.js/dvor-roulette-screen.js) — почти всегда маленький,
 * не связанный с игрой в покер остаток. Игрок гриндил покер, накапливал тысячи poker_spichki,
 * но сумка требовала другие 150 спичек рулетки, которых у него почти не было.
 *
 * Фикс — по аналогии с рулеткой (свой кейс тратит свои spichki), у покерной сумки теперь тоже
 * своя валюта: poker.php.openBag() и dvor-poker-bag.js (клиентские display/проверки ДО запроса
 * к серверу — реальное списание всегда решает сервер) переведены на poker_spichki.
 *
 * Run: node tests/poker-bag-currency-matches-poker-spichki.test.js
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

const pokerPhp = readSrc('server/core/controllers/poker.php');
const bagJs    = readSrc('_client/src/game/dvor/dvor-poker-bag.js');

console.log('\nTest 1: сервер (poker.php.openBag) списывает poker_spichki, а не roulette_spichki');
{
    assert(/if\(!\$this->ops->deduct\(\$user, 'poker_spichki', \$cost\)\) return \$this->ops->fail\(50\);/.test(pokerPhp),
        'deduct() читает и списывает poker_spichki (валюта покера)');
    assert(!/deduct\(\$user, 'roulette_spichki', \$cost\)/.test(pokerPhp),
        'больше не списывает roulette_spichki (чужая валюта — спички рулетки)');
}

console.log('\nTest 2: patch ответа openBag() возвращает актуальный баланс poker_spichki');
{
    assert(/patchCurrencies\(\$user, \['poker_spichki', 'exp', 'cigarettes', 'stash_count', 'coins', 'coins_earned', 'shmot'/.test(pokerPhp),
        'patchCurrencies включает poker_spichki (клиент должен увидеть остаток именно этой валюты после списания)');
}

console.log('\nTest 3: клиентский экран сумки (dvor-poker-bag.js) отображает и проверяет ту же валюту, что и сервер');
{
    const activeLines = bagJs.split('\n').filter(l => !l.trim().startsWith('//'));
    const pokerSpichkiReads = activeLines.filter(l => l.includes("udata['poker_spichki']")).length;
    assert(pokerSpichkiReads >= 3,
        'все 3 места (текст счётчика, флаг доступности кнопки, проверка при клике) читают udata[\'poker_spichki\'], нашлось: ' + pokerSpichkiReads);
    assert(!activeLines.some(l => l.includes("udata['roulette_spichki']")),
        'ни одна активная строка сумки покера не читает udata[\'roulette_spichki\'] — это валюта другой игры (рулетки), не задета фиксом');
}

console.log('\nTest 4: серверная валюта и клиентская валюта (проверка ДО запроса) теперь СОВПАДАЮТ');
{
    const serverUsesPokerSpichki = /deduct\(\$user, 'poker_spichki', \$cost\)/.test(pokerPhp);
    const clientUsesPokerSpichki = bagJs.split('\n').filter(l => !l.trim().startsWith('//'))
        .every(l => !l.includes("udata['roulette_spichki']"));
    assert(serverUsesPokerSpichki && clientUsesPokerSpichki,
        'счётчик на экране покера, дисплей сумки и реальное списание на сервере смотрят в одно и то же поле (poker_spichki) — картинки 1 и 2 из репорта больше не разойдутся');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

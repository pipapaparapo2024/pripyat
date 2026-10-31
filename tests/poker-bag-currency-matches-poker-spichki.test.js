/**
 * Test: 27.09.2026 (по прямому указанию, скриншоты — "1 и 2 картинка кол-во голубых спичек
 * видимо не синхронизированно" — экран покера показывал 2200, а сумка ("СУМКА ЗА СПИЧКИ",
 * открывается прямо с экрана покера) показывала 60 и требовала 150).
 *
 * Тогда причина была найдена в реальном расхождении ДВУХ валют на сервере: poker.php.resolve()
 * начислял udata['poker_spichki'], а poker.php.openBag() по ошибке списывал ЧУЖУЮ
 * udata['roulette_spichki'] — фикс развёл их: у покерной сумки стала своя валюта poker_spichki
 * (по аналогии с рулеткой, у которой свой кейс тратит свои spichki).
 *
 * 20.10.2026 (по прямому указанию — "это должны быть одинаковые спички, исправь"): решение
 * пересмотрено — poker_spichki и roulette_spichki ОБЪЕДИНЕНЫ в одну общую валюту "голубые
 * спички", общую для покера и рулетки. Канонический столбец — roulette_spichki (у него больше
 * мест начисления, см. roulette.php) — poker.php.openBag()/resolve() и клиентские
 * dvor-poker-bag.js/dvor-poker-screen.js переведены читать/писать именно его. poker_spichki
 * больше нигде не пишется (мёртвое поле в БД, старый баланс переносится одноразовой миграцией
 * tests/_fixtures/schema-history/migrate49.php.txt, не трогаем структуру таблицы — ПРАВИЛО №3).
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

console.log('\nTest 1: сервер (poker.php.openBag) списывает roulette_spichki (общая валюта), не poker_spichki');
{
    assert(/if\(!\$this->ops->deduct\(\$user, 'roulette_spichki', \$cost\)\) return \$this->ops->fail\(50\);/.test(pokerPhp),
        'deduct() читает и списывает roulette_spichki (общая валюта с рулеткой)');
    assert(!/deduct\(\$user, 'poker_spichki', \$cost\)/.test(pokerPhp),
        'больше не списывает отдельную poker_spichki — поле мёртвое, см. tests/_fixtures/schema-history/migrate49.php.txt');
}

console.log('\nTest 2: patch ответа openBag() возвращает актуальный баланс roulette_spichki');
{
    // 26.10.2026: 'stash_data' добавлен в список рядом со stash_count (фича "Заначки").
    assert(/patchCurrencies\(\$user, \['roulette_spichki', 'exp', 'cigarettes', 'stash_count', 'stash_data', 'coins', 'coins_earned', 'shmot'/.test(pokerPhp),
        'patchCurrencies включает roulette_spichki (клиент должен увидеть остаток именно этой общей валюты после списания)');
}

console.log('\nTest 3: клиентский экран сумки (dvor-poker-bag.js) отображает и проверяет ту же валюту, что и сервер');
{
    const activeLines = bagJs.split('\n').filter(l => !l.trim().startsWith('//'));
    const rouletteSpichkiReads = activeLines.filter(l => l.includes("udata['roulette_spichki']")).length;
    assert(rouletteSpichkiReads >= 3,
        'все 3 места (текст счётчика, флаг доступности кнопки, проверка при клике) читают udata[\'roulette_spichki\'], нашлось: ' + rouletteSpichkiReads);
    assert(!activeLines.some(l => l.includes("udata['poker_spichki']")),
        'ни одна активная строка сумки покера не читает мёртвое поле udata[\'poker_spichki\']');
}

console.log('\nTest 4: серверная валюта и клиентская валюта (проверка ДО запроса) совпадают — теперь намеренно, не по ошибке');
{
    const serverUsesRouletteSpichki = /deduct\(\$user, 'roulette_spichki', \$cost\)/.test(pokerPhp);
    const clientUsesRouletteSpichki = bagJs.split('\n').filter(l => !l.trim().startsWith('//'))
        .every(l => !l.includes("udata['poker_spichki']"));
    assert(serverUsesRouletteSpichki && clientUsesRouletteSpichki,
        'счётчик на экране покера, дисплей сумки и реальное списание на сервере смотрят в одно и то же поле (roulette_spichki) — та же общая валюта, что у рулетки');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

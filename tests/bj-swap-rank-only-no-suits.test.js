/**
 * Test: смена карты в блэкджеке иногда "срабатывала" (счётчик смен тратился), но картинка
 * визуально не менялась — репорт "смена карты как бы срабатывает, тратится, но карта не
 * меняется". Причина: старая проверка sameCard(cand, oldCard) сравнивала И ранг, И масть, а
 * отображается на экране ТОЛЬКО ранг (масть нигде не рисуется, ни при раздаче, ни при свапе).
 * Если новая карта выпадала с тем же рангом, но другой мастью — код считал её "другой", свап
 * тратился, а текстура спрайта не менялась.
 *
 * По прямому уточнению пользователя ("в блэкджеке нет других мастей вообще") масть при свапе
 * убрана полностью — работа идёт чисто по рангу (RANKS), никакого pick(SUITS) в свапе.
 *
 * 18.09.2026 (перенос Блэкджека на сервер, см. tests/blackjack-server-authoritative.test.js для
 * полной проверки): сам подбор нового ранга переехал в server/core/controllers/blackjack.php —
 * читер мог иначе подделать pity/раздачу через консоль. Rank-only принцип (без масти вообще)
 * сохранён 1-в-1 на сервере — там просто больше нет объекта suit, только строка ранга.
 *
 * Run: node tests/bj-swap-rank-only-no-suits.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8'
);
const phpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8'
);

console.log('\nTest 1: blackjack.php.swap() работает чисто по рангу, без масти (сервер, после переноса)');
{
    const start = phpSrc.indexOf('function swap(){');
    const end   = phpSrc.indexOf('\n        }', phpSrc.indexOf('$this->ops->ok', start));
    const body  = phpSrc.slice(start, end);

    assert(!!body, 'swap() найден');
    assert(/\$oldRank\s*=\s*\$active\['hand'\]\[\$handIdx\];/.test(body), 'берёт старый РАНГ (не всю карту с мастью — масти у сервера вообще нет)');
    assert(/\$otherRank\s*=\s*\$active\['hand'\]\[\$otherIdx\];/.test(body), 'берёт ранг другого слота (для проверки чужой премиум-пары)');
    assert(!/SUITS/.test(phpSrc), 'сервер вообще не оперирует мастями (SUITS нет ни в каталоге, ни в контроллере) — масть не используется вовсе');
    // 23.09.2026: инструментация добавила промежуточные $rejectOld/$rejectMatch переменные и
    // swapTrace[] вместо однострочного "if(...) continue;" — сама гарантия (старый ранг
    // отбраковывается) не изменилась, см. также batch-21-09-...-positions.test.js.
    assert(/\$rejectOld\s*=\s*\(\$rank === \$oldRank\);/.test(body) && /if\(\$rejectOld\) continue;/.test(body),
        'новый ранг обязан отличаться от старого — гарантирует видимую смену');
    assert(/foreach\(\$RANKS as \$r\) if\(\$r !== \$oldRank\)\{ \$newRank = \$r; break; \}/.test(body), 'фолбэк после 50 попыток тоже гарантированно отличается от старого ранга');
    assert(/\$active\['hand'\]\[\$handIdx\] = \$newRank;/.test(body), 'новая карта в руке — просто строка ранга, масти как поля вообще нет');

    // 24.09.2026 (репорт "карты пропадают" при смене): клиент больше не доверяет только
    // res.rank для СВОЕГО слота — перерисовывает ОБА слота (2 и 3) из полной res.hand
    // (с фолбэком на res.rank для затронутого слота, если res.hand не пришёл) — устраняет
    // рассинхронизацию, если предыдущая смена сохранилась, а локальный слот отстал.
    assert(/const authoritativeHand = Array\.isArray\(res\.hand\) && res\.hand\.length === 2/.test(src),
        'клиент перерисовывает оба слота из полной серверной руки (res.hand), не только затронутый идентификатором idx');
    assert(/this\._bjHand\[realIdx\] = \{rank: rank, suit: null\};/.test(src), 'клиент хранит {rank, suit:null} — новая карта в руке по рангу из ответа сервера');
    assert(/spr\.texture = PIXI\.Texture\.from\('\.\/images\/' \+ rank \+ '\.png\?v=221'\);/.test(src),
        'текстура ставится по рангу из ответа сервера — визуальная смена гарантирована');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

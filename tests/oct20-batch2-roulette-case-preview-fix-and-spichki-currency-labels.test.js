/**
 * Test: батч 20.10.2026 (вторая часть дня, по прямому указанию) —
 *
 *  1) dvor-roulette-buy.js._openRouletteCaseOpenedScreen(): dev-кнопка "Кейс рулетки (шмотка
 *     выпала)" (dev_panel.js, hasTatu=true) открывала СТАРЫЙ файл "рулетка открытый кейс с
 *     тату.png" (с августа, никогда не обновлялся) вместо актуального "двор рулетка кейс
 *     открытый содержимое.png" (17.10.2026, используется в ветке hasTatu=false). Тату-дроп
 *     отключён (шанс 0% в бете) — hasTatu=true в проде недостижим, единственный живой путь к
 *     этой ветке — именно dev-превью. Фон унифицирован на один файл для обеих веток.
 *
 *  2) Репорт "в покере 250 спичек, в рулетке 30, не могу открыть кейс — это не визуальный баг":
 *     ПЕРВЫЙ заход (та же дата, раньше по времени) решил, что poker_spichki и roulette_spichki
 *     действительно разные валюты, и просто уточнил подписи ("спичек покера"/"спичек рулетки").
 *     Пользователь поправил: "так погоди это должны быть одинаковые спички исправь" — решение
 *     пересмотрено ВТОРЫМ заходом (см. tests/poker-bag-currency-matches-poker-spichki.test.js
 *     для полной проверки объединения) — обе валюты ОБЪЕДИНЕНЫ в одну общую ("голубые спички"),
 *     канонический столбец roulette_spichki. Подписи здесь возвращены к общему "голубых
 *     спичек" (без уточнения игры — это теперь буквально одна и та же валюта).
 *
 * Run: node tests/oct20-batch2-roulette-case-preview-fix-and-spichki-currency-labels.test.js
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

const roulBuySrc   = readSrc('_client/src/game/dvor/dvor-roulette-buy.js');
const pokerBagSrc  = readSrc('_client/src/game/dvor/dvor-poker-bag.js');

console.log('\nTest 1: dvor-roulette-buy.js — открытый кейс рулетки использует ОДИН актуальный файл фона для обеих веток hasTatu');
{
    const start = roulBuySrc.indexOf('proto._openRouletteCaseOpenedScreen = function');
    const end   = roulBuySrc.indexOf('\n    };', start);
    const body  = roulBuySrc.slice(start, end);

    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'двор рулетка кейс открытый содержимое\.png'\)\);/.test(body),
        'фон — единственный спрайт на "двор рулетка кейс открытый содержимое.png" (актуальный файл 17.10.2026)');
    assert(/bg\.x = 178; bg\.y = 62;/.test(body), 'позиция фона — x:178,y:62 (натуральный размер, без растяжки)');
    assert(!/PIXI\.Texture\.from\(BASE \+ 'рулетка открытый кейс с тату\.png'\)/.test(roulBuySrc),
        'старый файл "рулетка открытый кейс с тату.png" (с августа, не обновлялся) больше нигде не загружается как текстура (упоминание в пояснительном комментарии — не в счёт)');
    assert(!/if\(hasTatu\)\{\s*\n\s*bg = /.test(body),
        'ветвление фона по hasTatu убрано целиком (баннер результата по hasTatu — отдельный элемент ниже, не трогали)');
}

console.log('\nTest 2: dvor-roulette-buy.js — подпись возвращена к общему "голубых спичек" (валюты объединены)');
{
    assert(/Недостаточно голубых спичек!/.test(roulBuySrc), 'ошибка нехватки баланса — общий текст, без уточнения игры');
    assert(/Открыть кейс за ' \+ cost \+ ' голубых спичек\?'/.test(roulBuySrc), 'подтверждение стоимости — общий текст');
    assert(!/'Недостаточно спичек рулетки!'/.test(roulBuySrc) && !/спичек рулетки\?'/.test(roulBuySrc),
        'уточнение "спичек рулетки" (первый, пересмотренный заход) убрано из пользовательских текстов (упоминание в пояснительном комментарии — не в счёт)');
}

console.log('\nTest 3: dvor-poker-bag.js — подпись возвращена к общему "голубых спичек" (валюты объединены)');
{
    assert(/Недостаточно голубых спичек!/.test(pokerBagSrc), 'ошибка нехватки баланса — общий текст, без уточнения игры');
    assert(/Открыть сумку за ' \+ cost \+ ' голубых спичек\?'/.test(pokerBagSrc), 'подтверждение стоимости — общий текст');
    assert(!/спичек покера/.test(pokerBagSrc), 'уточнение "спичек покера" (первый, пересмотренный заход) убрано из пользовательских текстов');
}

console.log('\nTest 4: обе игры реально читают ОДНО И ТО ЖЕ поле udata (roulette_spichki) — валюты объединены');
{
    assert(/const have = parseInt\(udata\['roulette_spichki'\]\|\|0\);/.test(roulBuySrc),
        'dvor-roulette-buy.js читает roulette_spichki');
    assert(/const _spichkiNow = parseInt\(udata\['roulette_spichki'\]\|\|0\);/.test(pokerBagSrc) &&
           /const have = parseInt\(udata\['roulette_spichki'\]\|\|0\);/.test(pokerBagSrc),
        'dvor-poker-bag.js тоже читает roulette_spichki (общий столбец) — обе проверки (кнопка активна / реальное списание)');
    assert(!/udata\['poker_spichki'\]/.test(pokerBagSrc), 'dvor-poker-bag.js больше не читает мёртвое поле poker_spichki');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

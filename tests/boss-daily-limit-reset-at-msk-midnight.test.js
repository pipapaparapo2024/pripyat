/**
 * Test: 29.09.2026, по прямому указанию — уточнение того же дневного лимита, что чинили
 * 28.09.2026. Тогда пользователь попросил "лимит на боссов должен сбрасываться в 12 по МСК",
 * и это реализовали как 12:00 ДНЯ (полдень) — Gameops::mskDailyDate() сдвигала эпоху на -9
 * часов, разворот в 09:00 UTC = 12:00 МСК. Сегодня пользователь уточнил: "когда я говорил
 * сбросить в 12, я имел в виду 12 ночи, и все ожидали, что поспят и с утра лимиты уже будут
 * свежими" — то есть изначально имелась в виду ПОЛНОЧЬ (00:00 МСК), а не полдень.
 *
 * Фикс: Gameops::mskDailyDate()/mskNextResetMs() (server/core/models/gameops.php) и клиентское
 * зеркало bosses.js._today() переведены с формулы "-9ч → 09:00 UTC = 12:00 МСК" на формулу
 * "+3ч → 21:00 UTC = 00:00 МСК". Это ЕДИНАЯ точка для ВСЕХ дневных лимитов игры (боссы/покер/
 * блэкджек/задания — все зовут именно эти две функции, см. tests/boss-daily-reset-msk-and-
 * free-weapon-shared-cd.test.js) — правка автоматически применяется ко всем ним разом, без
 * необходимости трогать каждый контроллер по отдельности.
 *
 * Run: node tests/boss-daily-limit-reset-at-msk-midnight.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const gameopsPhp = read('server/core/models/gameops.php');
const bossesJs   = read('_client/src/game/bosses.js');

console.log('\n1) Gameops::mskDailyDate() — сдвиг +3 часа (МСК-полночь), не -9 (МСК-полдень)');
{
    const start = gameopsPhp.indexOf('function mskDailyDate(');
    const end   = gameopsPhp.indexOf('\n    }', start);
    const body  = gameopsPhp.slice(start, end);
    assert(/return gmdate\('Y-m-d', \$now \+ 3 \* 3600\);/.test(body), 'формула — gmdate($now + 3*3600), разворот ровно в 21:00 UTC = 00:00 МСК');
    assert(!/\$now - 9 \* 3600/.test(body), 'старая формула МСК-полдня (-9ч) не осталась');
}

console.log('\n2) Gameops::mskNextResetMs() — 00:00 МСК СЛЕДУЮЩЕГО дня, БЕЗ лишних +86400');
{
    const start = gameopsPhp.indexOf('function mskNextResetMs(');
    const end   = gameopsPhp.indexOf('\n    }', start);
    const body  = gameopsPhp.slice(start, end);
    assert(/return strtotime\(\$today \. ' 21:00:00 UTC'\) \* 1000;/.test(body),
        'формула — strtotime($today." 21:00:00 UTC")*1000, БЕЗ +86400 (см. вывод в комментарии — при сдвиге +3ч это уже будущая граница)');
    assert(!/\+ 86400/.test(body), 'старый +86400 (нужный только для формулы -9ч) убран');
    assert(!/09:00:00 UTC/.test(body), 'старая граница 09:00 UTC (12:00 МСК) не осталась');
}

console.log('\n3) bosses.js._today() — клиент зеркалит ТУ ЖЕ формулу (+3ч), что и сервер');
{
    const start = bossesJs.indexOf('_today(){');
    const end   = bossesJs.indexOf('\n    }', start);
    const body  = bossesJs.slice(start, end);
    assert(/Date\.now\(\) \+ 3 \* 60 \* 60 \* 1000/.test(body), 'клиент использует +3ч (не -9ч)');
    assert(/getUTCFullYear\(\)/.test(body) && /getUTCMonth\(\)/.test(body) && /getUTCDate\(\)/.test(body),
        'по-прежнему UTC-геттеры, не локальные часы устройства игрока');
}

console.log('\n4) Реальный прогон формулы — разворот происходит РОВНО в 21:00 UTC, ни секундой раньше/позже');
{
    // Порт формулы 1-в-1 на JS (Date.UTC вместо gmdate) — проверяет РЕАЛЬНОЕ поведение,
    // не просто наличие нужных чисел в тексте файла.
    function mskDailyDate(nowMs){
        const d = new Date(nowMs + 3 * 60 * 60 * 1000);
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    }

    const base = Date.UTC(2026, 8, 29, 0, 0, 0); // 2026-09-29 00:00:00 UTC
    assert(mskDailyDate(base) === '2026-09-29', 'в полночь UTC (03:00 МСК) — всё ещё тот же календарный день по МСК');
    assert(mskDailyDate(base + 20 * 3600 * 1000) === '2026-09-29', '20:59 UTC (23:59 МСК) — ещё вчерашний МСК-день (граница не пройдена)');
    assert(mskDailyDate(base + 20 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000) === '2026-09-29', '20:59:59 UTC — последняя секунда старого МСК-дня');
    assert(mskDailyDate(base + 21 * 3600 * 1000) === '2026-09-30', 'РОВНО 21:00:00 UTC (00:00:00 МСК) — уже новый МСК-день, лимиты сброшены');
    assert(mskDailyDate(base + 21 * 3600 * 1000 + 1000) === '2026-09-30', '21:00:01 UTC — новый день продолжается');

    // 28.09.2026 для сравнения — прошлая (полуденная) формула не должна давать тот же результат
    // в 21:00 UTC (граница была совсем другая, 09:00 UTC) — регресс-гвард, что мы точно поменяли
    // формулу, а не просто переставили комментарий.
    function oldNoonMskDailyDate(nowMs){
        const d = new Date(nowMs - 9 * 60 * 60 * 1000);
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    }
    assert(oldNoonMskDailyDate(base + 21 * 3600 * 1000) === '2026-09-29',
        'регресс-гвард: старая (полуденная) формула В ЭТОТ ЖЕ момент ещё НЕ развернула бы день — подтверждает, что поведение реально изменилось, а не совпадает случайно');
}

console.log('\n5) Реальный прогон mskNextResetMs — обратный отсчёт указывает на ближайшую БУДУЩУЮ полночь МСК, а не в прошлое');
{
    function mskDailyDate(nowMs){
        const d = new Date(nowMs + 3 * 60 * 60 * 1000);
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    }
    function mskNextResetMs(nowMs){
        const today = mskDailyDate(nowMs);
        return Date.parse(today + 'T21:00:00Z');
    }

    const case1 = Date.UTC(2026, 8, 29, 10, 0, 0); // 13:00 МСК 29.09 — за 8ч до полуночи
    assert(mskNextResetMs(case1) === Date.UTC(2026, 8, 29, 21, 0, 0), 'в середине дня — следующая граница сегодня в 21:00 UTC');
    assert(mskNextResetMs(case1) > case1, 'граница строго в будущем относительно now');

    const case2 = Date.UTC(2026, 8, 29, 22, 0, 0); // 01:00 МСК 30.09 — только что наступила полночь
    assert(mskNextResetMs(case2) === Date.UTC(2026, 8, 30, 21, 0, 0), 'сразу после полуночи — следующая граница уже ЗАВТРА в 21:00 UTC (не сегодня повторно)');
    assert(mskNextResetMs(case2) > case2, 'граница строго в будущем и в этом случае — регресс на "забытый +86400" был бы виден здесь как граница в прошлом');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

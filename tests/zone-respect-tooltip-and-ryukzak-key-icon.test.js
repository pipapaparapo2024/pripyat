/**
 * Test: 28.09.2026, по прямому указанию — два репорта одним заходом.
 *
 * 1) "Уважение за зачистку зоны на каждой Зоны показывает общее за все Зоны, а должно
 *    индивидуально показывать на каждой" — тултип короны в попапе локации (zone-popup.js)
 *    читал ГЛОБАЛЬНЫЙ udata['respect'] вместо счётчика конкретной зоны
 *    udata['loc_respect_<locIdx>'], который сервер уже считает и присылает отдельно
 *    (zone.php: fillCheckpoint/collectIncome/captureLocation пишут loc_respect_<locIdx>).
 *
 * 2) "В рюкзаке отображается шмотка в награде, так не должно быть" — попап награды
 *    (reward.js ICON_MAP) мапил обобщённые boss_keys (рюкзак выдаёт их с 5 уровня, поле shmot
 *    при этом вообще не трогается — см. ryukzak.php) на ТУ ЖЕ иконку, что и настоящая шмотка
 *    (shmot). Заменено на одну из 7 существующих именных иконок ключей боссов.
 *
 *    02.10.2026 (ОБНОВЛЕНО): единое поле boss_keys заменено на 7 именных полей boss_key_1..7
 *    (по одному на каждого босса, не только 4) — каждое с собственной иконкой
 *    "попап награда ключ <имя босса>.png" и записью в KEY_BOSS_NAMES. Тест переписан под
 *    актуальную схему (см. ICON_MAP/KEY_BOSS_NAMES в reward.js).
 *
 * Run: node tests/zone-respect-tooltip-and-ryukzak-key-icon.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zonePopupJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'zone', 'zone-popup.js'), 'utf-8');
const rewardJs     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'reward.js'), 'utf-8');

console.log('\nTest 1: тултип короны в попапе локации читает уважение КОНКРЕТНОЙ зоны, не глобальное');
{
    const start = zonePopupJs.indexOf("_locNagradaKoronaSpr.on('pointerover'");
    const end   = zonePopupJs.indexOf("_locNagradaKoronaSpr.on('pointerout'", start);
    const body  = zonePopupJs.slice(start, end);
    assert(/udata\['loc_respect_' \+ this\._locPopupIdx\]/.test(body),
        "total читается из udata['loc_respect_' + this._locPopupIdx]");
    assert(!/parseInt\(udata\['respect'\] \|\| 0\)/.test(body),
        'глобальный udata[\'respect\'] в этом обработчике больше не используется');
}

console.log('\nTest 2: попап награды рюкзака (boss_key_1..7) больше не переиспользует иконку шмотки');
{
    const start = rewardJs.indexOf('const ICON_MAP');
    const end   = rewardJs.indexOf('const KEY_BOSS_NAMES', start);
    const body  = rewardJs.slice(start, end);
    const shmotLine = body.match(/shmot:\s*'([^']+)'/);
    assert(!!shmotLine, "запись shmot в ICON_MAP найдена (иконка настоящей шмотки не менялась)");
    assert(!/boss_keys:\s*'/.test(body), 'старое обобщённое поле boss_keys в ICON_MAP отсутствует (заменено именными полями)');

    const BOSS_NAME_BY_KEY = {
        boss_key_1: 'счастливчик', boss_key_2: 'ястреб', boss_key_3: 'меченный', boss_key_4: 'крыс',
        boss_key_5: 'баркут', boss_key_6: 'борода', boss_key_7: 'жгут',
    };
    const iconFiles = new Set();
    for(const [key, name] of Object.entries(BOSS_NAME_BY_KEY)){
        const m = body.match(new RegExp(key + ":\\s*'([^']+)'"));
        assert(!!m, 'запись ' + key + ' в ICON_MAP найдена');
        if(!m) continue;
        iconFiles.add(m[1]);
        assert(m[1] !== shmotLine[1], key + ' указывает на файл, ОТЛИЧНЫЙ от иконки shmot (не показывает шмотку в награде за ключ)');
        assert(m[1] === 'попап награда ключ ' + name + '.png', key + ' указывает на именную иконку "попап награда ключ ' + name + '.png"');
    }
    assert(iconFiles.size === Object.keys(BOSS_NAME_BY_KEY).length, 'у всех 7 ключей боссов — РАЗНЫЕ иконки (не склеены на одну)');

    const namesStart = rewardJs.indexOf('const KEY_BOSS_NAMES');
    const namesEnd   = rewardJs.indexOf('const BASE', namesStart);
    const namesBody  = rewardJs.slice(namesStart, namesEnd);
    for(const key of Object.keys(BOSS_NAME_BY_KEY)){
        assert(new RegExp(key + ":\\s*'").test(namesBody), 'KEY_BOSS_NAMES содержит запись для ' + key);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

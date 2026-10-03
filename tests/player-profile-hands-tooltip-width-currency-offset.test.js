/**
 * Test: батч 19.09.2026 —
 *  1) player_profile.js: у ЧУЖОГО игрока не рисовались кисти рук/фаланги вообще (репорт
 *     "почему-то не отображаются руки при переходе к другому игроку") — home.js рисует их
 *     отдельными спрайтами поверх персонажа, player_profile.js их не создавал совсем.
 *  2) player_profile.js: поиск надетого предмета по catalog[i] (порядковый индекс в
 *     shmot.items) вместо catalog.find(it=>it.id===i) — расходится с id начиная с id 24
 *     (тот же класс бага, что был исправлен в shmot.js._saveToUdata/_loadFromUdata тем же
 *     числом) — "шмотки другого игрока не отображаются".
 *  3) interface.js: тултип уровня/опыта имел жёстко зашитую ширину 260px независимо от
 *     длины текста — теперь считается от фактической ширины текста.
 *  4) interface-panels.js: облачко валюты (тушёнка/рубли/сигареты) сдвинуто на +40px вправо.
 *  5) boss_result.js: суммы наград — чёрным шрифтом (#1a1208), ТОП УРОНА получил диагностику
 *     длины top[] (прочерк для пустых строк заменён 22.09.2026 на условный показ по числу
 *     реальных участников — см. boss-result-popup-hp-text-placeholder-avatars-and-conditional-
 *     top-list.test.js).
 *
 * Run: node tests/player-profile-hands-tooltip-width-currency-offset.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const profileSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf-8');
const ifaceSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface.js'), 'utf-8');
const panelsSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-panels.js'), 'utf-8');
const bossResultSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

console.log('\nTest 1: player_profile.js рисует кисти рук + фаланги (те же файлы/координаты, что home.js)');
{
    assert(/фаланги правой руки\.png/.test(profileSrc), 'фаланги правой руки — спрайт создан');
    assert(/phalanxSpr\.x = 634; phalanxSpr\.y = 441;/.test(profileSrc), 'фаланги — те же координаты, что home.js');
    assert(/правая рука\.png/.test(profileSrc) && /rightHandSpr\.x = 630; rightHandSpr\.y = 369;/.test(profileSrc),
        'правая рука — тот же файл/координаты, что home.js');
    assert(/левая рука\.png/.test(profileSrc) && /leftHandSpr\.x = 534; leftHandSpr\.y = 385;/.test(profileSrc),
        'левая рука — тот же файл/координаты, что home.js');
}

console.log('\nTest 2: player_profile.js ищет надетый предмет по item.id, а не по порядковой позиции в catalog');
{
    assert(!/const def = catalog\[i\];/.test(profileSrc), 'больше нет catalog[i] (позиционный баг)');
    assert(!/const def = catalog\[equippedIdx\];/.test(profileSrc), 'больше нет catalog[equippedIdx] (тот же позиционный баг)');
    assert((profileSrc.match(/catalog\.find\(it => it\.id === i\)/g) || []).length >= 1,
        'поиск по id внутри findIndex: catalog.find(it => it.id === i)');
    assert(/catalog\.find\(it => it\.id === equippedIdx\)/.test(profileSrc),
        'финальный поиск определения предмета тоже по id: catalog.find(it => it.id === equippedIdx)');
}

console.log('\nTest 3: interface.js — тултип уровня/опыта авто-ширины, не хардкод 260px');
{
    assert(!/bg\.drawRoundedRect\(0, 0, 260, 50, 6\);/.test(ifaceSrc), 'больше нет захардкоженной ширины 260px');
    assert(/const tipW = Math\.max\(MIN_W, t1\.width \+ PAD_X \* 2, t2\.width \+ PAD_X \* 2\);/.test(ifaceSrc),
        'ширина считается от фактической ширины текста (t1/t2.width) + паддинг');
    assert(/bg\.drawRoundedRect\(0, 0, tipW, 50, 6\);/.test(ifaceSrc), 'фон рисуется с динамической tipW');
}

console.log('\nTest 4: interface-panels.js — облачко валюты сдвинуто на +40px');
{
    assert(/const gx = Math\.round\(\(this\.up\.x \|\| 0\) \+ bx \+ bw \/ 2 - 130 \+ 50 \+ 40\);/.test(panelsSrc),
        'формула gx включает +40 (тушёнка/рубли/сигареты — единая формула для всех трёх)');
}

console.log('\nTest 5: boss_result.js — суммы наград чёрным шрифтом, ТОП УРОНА с диагностикой длины top[]');
{
    assert(/fill:\s*'#1a1208',\s*\n\s*dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,\s*\n\s*\}\);\s*\n\s*t\.anchor\.set\(0, 0\.5\);/.test(bossResultSrc),
        'подпись суммы награды — чёрный цвет #1a1208 (было светло-бежевым)');
    // 22.09.2026 (баг "попап победы пустой", см. boss-victory-popup-top-and-double-kill-count-
    // fix.test.js): лог теперь выводится в общей _applyRatingTop() — работает и для top из
    // opts (claimKill), и для fallback-запроса bosses.rating() (поражение/таймаут).
    assert(/console\.log\('\[boss_result\] top участников боя:'/.test(bossResultSrc),
        'добавлено диагностическое логирование длины top[] (свежая формулировка после рефакторинга в _applyRatingTop)');
    // 22.09.2026: безусловный прочерк "N. —" для пустых мест заменён на условный показ строки
    // только при достаточном числе реальных участников (rank <= top.length) — см. отдельный
    // тест-файл boss-result-popup-hp-text-placeholder-avatars-and-conditional-top-list.test.js.
    assert(!/rank \+ '\. —'/.test(bossResultSrc),
        'старый безусловный прочерк "N. —" для пустых мест убран (заменён условной видимостью строки)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

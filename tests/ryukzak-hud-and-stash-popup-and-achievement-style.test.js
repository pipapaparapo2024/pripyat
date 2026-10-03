/**
 * Test: батч 16.09.2026 —
 *  1) ryukzak.js — после попапа "недостаточно очков" нижний HUD больше не остаётся видимым
 *     (notify.showResult безусловно вызывает iface.restoreHud() — теперь явно скрываем
 *     this.down обратно, как уже сделано в yashik.js для того же паттерна).
 *  2) zone.js — попап прогресса заначки ("«X» N/M (ещё K)") убран (теперь есть плавающая
 *     иконка "+1"), иконка заначки уменьшена до размера иконок наград локации (~40px).
 *  3) achievement.js — новые позиции/масштаб 4 текстов + единый цвет шрифта #c3bcb4.
 *  4) bosses_select.js — счётчик "N КЛЮЧЕЙ" перенесён в блок к иконке связки.
 *
 * Run: node tests/ryukzak-hud-and-stash-popup-and-achievement-style.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const ryukSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');
const zoneSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'zone.js'), 'utf-8');
const achSrc  = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'achievement.js'), 'utf-8');
const bossSelSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8');

console.log('\nTest 1: ryukzak.js — оба HUD остаются под затемнением после попапа ошибки (21.09.2026: гейт !canClaim заменён на серверную ошибку "нет тушёнки")');
{
    const idx = ryukSrc.indexOf("err && err.code === 46");
    assert(idx !== -1, 'ветка обработки ошибки сервера (код 46 — недостаточно тушёнки) найдена');
    const body = ryukSrc.slice(idx, idx + 400);
    assert(/notify\.showResult\(/.test(body), 'попап ошибки показывается');
    // 24.09.2026: явный повторный вызов после notify больше не нужен — декларативный стек
    // (pushHud('ryukzak', ...) вызванный при открытии) переживает ЛЮБОЙ сторонний restoreHud()
    // (в т.ч. тот, что notify.showResult дёргает сама), пока 'ryukzak' не снят через popHud —
    // см. declarative-hud-refactor.test.js.
    assert(!/placeHudUnderRyukzak\(\);/.test(body),
        'старый явный повторный вызов placeHudUnderRyukzak() после notify убран — декларативный стек сам переживает сторонний restoreHud()');
}

console.log('\nTest 2: zone.js — попап прогресса заначки (не завершённой) убран');
{
    assert(!/iface\._showRewardPopup\(\['«' \+ stash\.name \+ '»', prog\.cards \+ '\/' \+ stash\.total/.test(zoneSrc),
        'старый вызов попапа "«X» N/M (ещё K)" удалён');
    assert(!/notify\.showResult\(\{text:'«' \+ stash\.name \+ '»: ' \+ prog\.cards/.test(zoneSrc),
        'fallback-текст того же попапа тоже удалён');
    // 25.09.2026 (регресс найден повторным прогоном тестов): классификация/награда нычек
    // убраны целиком (по прямому указанию, до релиза арта) — попап "заначка СОБРАНА" вместе
    // с наградой (сигареты+опыт) убран тоже, находка теперь только "+1" через _showStashPickup().
    assert(!/iface\._showRewardPopup\(\['Заначка «' \+ stash\.name \+ '» собрана!'/.test(zoneSrc),
        'попап "заначка СОБРАНА" (с наградой) тоже убран — награды по типам больше нет вообще');
}

console.log('\nTest 3: zone.js — иконка заначки уменьшена до размера иконок наград локации');
{
    const idx = zoneSrc.indexOf('_showStashPickup(){');
    assert(idx !== -1, '_showStashPickup найден');
    const body = zoneSrc.slice(idx, idx + 900);
    assert(/bagIcon\.width = 40; bagIcon\.height = 40;/.test(body),
        'bagIcon приведён к ~40px (масштаб сиги/уважение эмблем), было 100×100 нативно');
}

console.log('\nTest 4: achievement.js — новые позиции/масштаб текстов + единый цвет #c3bcb4');
{
    assert(/const ACH_FONT_COLOR = '#c3bcb4';/.test(achSrc), 'единая цветовая константа заведена');
    assert(/fill:ACH_FONT_COLOR/.test(achSrc), 'fill ссылается на константу (не разные хардкод-цвета)');
    assert(!/fill:'#ffcc44'/.test(achSrc) && !/fill:'#e8dcc8'/.test(achSrc) && !/fill:'#aaddff'/.test(achSrc),
        'старые разные цвета (жёлтый/бежевый/голубой) убраны');
    // 18.09.2026 (позже этого батча): все три текста (title/desc/score) центрируются по ОДНОЙ
    // общей константе TEXT_CENTER_X=262 (не по разным X 194/165/151 каждый) — единообразие плюс
    // wordWrap/align:center сделали ручной scale.set() ненужным, он убран у обоих текстов, где
    // раньше был. Полная проверка этого — tests/achievement-popup.test.js Test 1 (уже актуален).
    // Y-координаты (61/81/105) и totalTxt (400/75) не менялись — проверяем их здесь по-прежнему.
    assert(/const TEXT_CENTER_X = 262;/.test(achSrc), 'единая X-константа для title/desc/score заведена');
    assert(/titleTxt\.x = TEXT_CENTER_X; titleTxt\.y = 61;/.test(achSrc), 'titleTxt: центрирован по TEXT_CENTER_X, y=61 не менялся');
    assert(!/titleTxt\.scale\.set\(/.test(achSrc), 'ручной scale.set() для titleTxt убран (центрирование решило проблему без него)');
    assert(/descTxt\.x = TEXT_CENTER_X; descTxt\.y = 81;/.test(achSrc), 'descTxt: центрирован по TEXT_CENTER_X, y=81 не менялся');
    assert(/scoreTxt\.x = TEXT_CENTER_X; scoreTxt\.y = 105;/.test(achSrc), 'scoreTxt: центрирован по TEXT_CENTER_X, y=105 не менялся');
    assert(!/scoreTxt\.scale\.set\(/.test(achSrc), 'ручной scale.set() для scoreTxt убран');
    assert(/totalTxt\.x = 400; totalTxt\.y = 75;/.test(achSrc), 'totalTxt: позиция 400/75 не менялась');
}

console.log('\nTest 5: bosses_select.js — число ключей центрируется внутри блока связки');
{
    assert(/const KEY_TEXT_X_BY_DIGITS = \{ 1: 296, 2: 293, 3: 286 \};/.test(bossSelSrc), 'X задан для 1/2/3 цифр');
    assert(/keysTxt\.y = cardY \+ 20;/.test(bossSelSrc), 'keysTxt.y = cardY+20');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

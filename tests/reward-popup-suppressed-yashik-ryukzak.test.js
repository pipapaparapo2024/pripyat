/**
 * Test: 17.10.2026, по прямому указанию — "поп-ап награды не нужен в двух случаях: кнопка
 * ЗАБРАТЬ в ящике, и кнопка ЗАБРАТЬ в сумке/рюкзаке". Уточнено в диалоге — "сумка" это рюкзак
 * (ryukzak.js), открывается ТОЛЬКО из Сидоровича (sidorovich.js bagHit) — НЕ сумка покера
 * (dvor-poker-bag.js, проверено grep — там _showRewardPopup остался нетронутым, это другой,
 * не затронутый этим запросом экран).
 *
 * yashik.js: collectReward() общая для крестика И кнопки ЗАБРАТЬ — крестик должен продолжать
 * показывать попап (не трогали), только ЗАБРАТЬ передаёт suppressPopup=true.
 * ryukzak.js: раньше this._showRewardPopup(rewards, onClose) — теперь попап не показывается,
 * но вся логика onClose (сброс уровня рюкзака, честное превью) выполняется напрямую и сразу.
 *
 * Run: node tests/reward-popup-suppressed-yashik-poker-bag.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const yashik  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8');
const ryukzak = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');
const pokerBag = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-bag.js'), 'utf-8');

console.log('\nTest 1: yashik.js — collectReward принимает suppressPopup и оборачивает показ попапа условием');
{
    assert(/const collectReward = \(suppressPopup\) => \{/.test(yashik), 'collectReward принимает параметр suppressPopup');
    assert(/if\(!suppressPopup\) iface\._showRewardPopup\(_items\);/.test(yashik), 'показ попапа условный — только если НЕ suppressPopup');
}

console.log('\nTest 2: yashik.js — крестик (xCloseBtn) зовёт collectReward() БЕЗ true (попап остаётся)');
{
    const xIdx = yashik.indexOf("xCloseBtn.on('pointerdown'");
    const xBlock = yashik.slice(xIdx, xIdx + 200);
    assert(/collectReward\(\);/.test(xBlock), 'крестик вызывает collectReward() без аргумента — попап как раньше');
}

console.log('\nTest 3: yashik.js — кнопка ЗАБРАТЬ (zabratBtn) зовёт collectReward(true) — попап подавлен');
{
    const zIdx = yashik.indexOf("zabratBtn.on('pointerdown'");
    const zBlock = yashik.slice(zIdx, zIdx + 300);
    assert(/collectReward\(true\)/.test(zBlock), 'ЗАБРАТЬ вызывает collectReward(true) — suppressPopup включён');
}

console.log('\nTest 4: ryukzak.js — this._showRewardPopup(...) для награды рюкзака удалён, onClose-логика вызывается напрямую');
{
    const openIdx = ryukzak.indexOf('proto._openRyukzakReward');
    const fnEndIdx = ryukzak.indexOf('if(window.iface){ iface.updateUp(); iface.updateNick(); }', openIdx);
    const fnBody = ryukzak.slice(openIdx, fnEndIdx !== -1 ? fnEndIdx : openIdx + 18000);
    assert(!/this\._showRewardPopup\(rewards/.test(fnBody), 'this._showRewardPopup(rewards, ...) для получения награды рюкзака больше не вызывается');
    assert(/const _afterRewardClaimed = \(\) => \{/.test(fnBody), 'onClose-логика вынесена в отдельную функцию _afterRewardClaimed');
    assert(/_afterRewardClaimed\(\);/.test(fnBody), '_afterRewardClaimed вызывается напрямую вместо показа попапа');
    assert(/_ryukzakLevelFromPoints\(pointsAfter\)/.test(fnBody), 'сброс уровня рюкзака (ключевая часть старого onClose) сохранён');
    assert(/_fetchHonestPreview\(\);/.test(fnBody), 'честное превью с сервера всё ещё запрашивается после сброса');
}

console.log('\nTest 5: dvor-poker-bag.js — НЕ затронут (это другая "сумка", не из этого запроса)');
{
    const tIdx = pokerBag.indexOf("takeBtn.on('pointerdown'");
    const tBlock = pokerBag.slice(tIdx, pokerBag.indexOf("win.addChild(takeBtn)", tIdx));
    assert(/_showRewardPopup\(rewards\)/.test(tBlock), 'сумка покера продолжает показывать попап награды как раньше — не трогали');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

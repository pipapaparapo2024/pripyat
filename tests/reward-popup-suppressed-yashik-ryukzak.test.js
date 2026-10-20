/**
 * Test: 17.10.2026, по прямому указанию — "поп-ап награды не нужен в двух случаях: кнопка
 * ЗАБРАТЬ в ящике, и кнопка ЗАБРАТЬ в сумке/рюкзаке". Уточнено в диалоге — "сумка" это рюкзак
 * (ryukzak.js), открывается ТОЛЬКО из Сидоровича (sidorovich.js bagHit) — НЕ сумка покера
 * (dvor-poker-bag.js) — изначально оставлена нетронутой (Test 5 ниже проверял, что попап там
 * ПРОДОЛЖАЕТ показываться).
 *
 * 20.10.2026 (по прямому указанию, скриншот открытой сумки покера — "после нажатия ЗАБРАТЬ не
 * вылезал попап награды"): решение пересмотрено, тот же баг-класс добрался и до сумки покера —
 * экран УЖЕ показывает все награды инлайн (_addAmt рисует exp/cig/stash/coins/шмотку прямо на
 * фоне), отдельный popups/reward.js поверх был дублем. Test 5 переписан наоборот — теперь
 * проверяет ОТСУТСТВИЕ попапа в сумке покера.
 *
 * yashik.js: collectReward() общая для крестика И кнопки ЗАБРАТЬ. Изначально только ЗАБРАТЬ
 * передавал suppressPopup=true, крестик оставляли как был (показывал попап) — по прямому
 * указанию пользователя тем же днём это решение пересмотрено по факту тестирования (попап
 * всё равно вылезал при выходе крестиком): теперь оба пути передают suppressPopup=true.
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

console.log('\nTest 2: yashik.js — крестик (xCloseBtn) ТОЖЕ зовёт collectReward(true) (17.10.2026, решение пересмотрено)');
{
    const xIdx = yashik.indexOf("const xCloseBtn = new PIXI.Sprite");
    const xBlock = yashik.slice(xIdx, xIdx + 500);
    assert(/collectReward\(true\);/.test(xBlock), 'крестик вызывает collectReward(true) — suppressPopup включён, попап не показывается');
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

console.log('\nTest 5: dvor-poker-bag.js — попап награды при ЗАБРАТЬ больше не показывается (20.10.2026, тот же баг-класс)');
{
    const tIdx = pokerBag.indexOf("takeBtn.on('pointerdown'");
    const tBlock = pokerBag.slice(tIdx, pokerBag.indexOf("win.addChild(takeBtn)", tIdx));
    assert(!/_showRewardPopup/.test(tBlock), 'iface._showRewardPopup больше не вызывается — экран сумки уже показывает награды инлайн');
    assert(/if\(win\.parent\) win\.parent\.removeChild\(win\);/.test(tBlock), 'ЗАБРАТЬ по-прежнему закрывает экран сумки');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

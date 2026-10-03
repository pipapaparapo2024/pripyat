/**
 * Test: 28.09.2026 (репорт — «на мобильном не видно, какая шмотка выпала после победы над
 * боссом») — boss_result.js, тултип рамки с выпавшей шмоткой.
 *
 * Корень: тултип (рамка + картинка предмета + карточка описания) показывался ТОЛЬКО через
 * pointerover/pointerout на иконке шмотки (26.09.2026, финальное решение того дня после двух
 * прямых указаний — сначала ввели клик-тумблер, затем в тот же день вернули обратно на
 * наведение, см. tests/boss-result-shmot-hover-frame-end-to-end.test.js). Проблема: в PIXI
 * события pointerover/pointerout на тач-устройствах не срабатывают вообще (нет курсора,
 * который может "войти"/"выйти" без клика) — на мобильном тултип был физически недостижим,
 * а не просто менее удобен, чем на десктопе.
 *
 * Фикс: десктопное поведение (pointerover/pointerout) НЕ тронуто — это отдельное явное решение
 * от 26.09.2026, менять его не просили. Добавлена ОТДЕЛЬНАЯ ветка только для window.isMobile —
 * тап по иконке переключает видимость тултипа (pointerdown, без риска конфликта со свайпом:
 * иконка не часть прокручиваемого списка).
 *
 * Run: node tests/boss-result-shmot-tooltip-mobile-tap.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const resultSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

console.log('\nTest 1: показ/скрытие тултипа вынесены в переиспользуемые showTip()/hideTip(), общие для десктопа и мобильного');
{
    const showIdx = resultSrc.indexOf('const showTip = () => {');
    const hideIdx = resultSrc.indexOf('const hideTip = () => {');
    assert(showIdx !== -1, 'showTip() определён');
    assert(hideIdx !== -1, 'hideTip() определён');
    assert(showIdx < hideIdx, 'showTip() определён раньше hideTip()');
    const showBody = resultSrc.slice(showIdx, hideIdx);
    assert(/frame\.visible = true;/.test(showBody) && /itemImg\.visible = true;/.test(showBody) && /descCard\.visible = true;/.test(showBody),
        'showTip() включает рамку/картинку/карточку описания');
    assert(/notObtainedOverlay\.visible = !isObtained;/.test(showBody),
        'showTip() сохраняет условие isObtained для оверлея "не получено" (26.09.2026: не показывать его на целой вещи)');
}

console.log('\nTest 2: десктоп (window.isMobile falsy) — остаётся на pointerover/pointerout, поведение 26.09.2026 не менялось');
{
    const elseIdx = resultSrc.indexOf('} else {\n                        shmotIcon.on(\'pointerover\'');
    assert(elseIdx !== -1, 'ветка else (не-мобильные) найдена');
    const elseBlock = resultSrc.slice(elseIdx, elseIdx + 200);
    assert(/shmotIcon\.on\('pointerover', showTip\);/.test(elseBlock), 'десктоп: pointerover → showTip');
    assert(/shmotIcon\.on\('pointerout',\s*hideTip\);/.test(elseBlock), 'десктоп: pointerout → hideTip');
}

console.log('\nTest 3: мобильный (window.isMobile) — новая ветка с тап-тумблером, десктопные слушатели НЕ регистрируются вместе с ней (if/else, не два независимых if)');
{
    const ifIdx = resultSrc.indexOf('if(window.isMobile){\n                        let tipShown = false;');
    assert(ifIdx !== -1, 'мобильная ветка найдена сразу после определения showTip/hideTip');
    const block = resultSrc.slice(ifIdx, ifIdx + 400);
    assert(/let tipShown = false;/.test(block), 'локальный флаг переключения объявлен');
    assert(/shmotIcon\.on\('pointerdown', \(\) => \{/.test(block), 'мобильный: слушатель pointerdown зарегистрирован');
    assert(/tipShown = !tipShown;/.test(block), 'тап инвертирует текущее состояние (тумблер, не однократный показ)');
    assert(/if\(tipShown\) showTip\(\); else hideTip\(\);/.test(block), 'по флагу вызывается showTip() или hideTip()');
    // if/else, а не два отдельных if — иначе на мобильном заодно повесились бы и pointerover/
    // pointerout (безвредно сами по себе, но избыточно и маскирует намерение кода).
    assert(/\}\s*else\s*\{\s*\n\s*shmotIcon\.on\('pointerover'/.test(resultSrc),
        'мобильная и десктопная ветки — взаимоисключающий if/else, не два независимых if');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

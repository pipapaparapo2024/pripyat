/**
 * Test: 25.09.2026, по прямому указанию (редактор позиций + цветовая палитра #F0F0F0) —
 * имя босса и таймер боя на экране бой-с-боссом переставлены на новые координаты/масштаб,
 * перекрашены в единый светлый цвет #F0F0F0 (десятое присланное изображение) и получили
 * шрифт чуть тоньше (fontWeight bold → normal — точной цифры толщины не прислали, это
 * ближайшее однозначное изменение, доступное в PIXI.TextStyle).
 *
 * Run: node tests/boss-name-timer-reposition-color.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const fightSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);

console.log('\nTest 1: имя босса (bossNameTxt) — центр x:137.5,y:95, цвет #f0f0f0, шрифт normal');
{
    const start = fightSrc.indexOf("const bossNameTxt = new PIXI.Text('', {");
    assert(start !== -1, 'bossNameTxt найден');
    const chunk = fightSrc.slice(start, start + 350);
    assert(/fill:'#f0f0f0'/.test(chunk), "цвет #f0f0f0 (было #ffffff)");
    assert(/fontWeight:'normal'/.test(chunk), "шрифт normal (было bold — 'чуть тоньше')");
    // 08.10.2026 (фикс пикселизации текста): fontSize:24×scale(1.404) заменены на итоговый
    // fontSize:34 без scale. Текст центрируется anchor=0.5 в фактической точке 137.5,95.
    assert(/fontSize:34,/.test(chunk), 'fontSize увеличен напрямую до 34 (= 24×1.404), не через scale');
    assert(/bossNameTxt\.anchor\.set\(0\.5, 0\);/.test(chunk) && /bossNameTxt\.x = 137\.5; bossNameTxt\.y = 95;/.test(chunk) && !/bossNameTxt\.scale\.set\(/.test(chunk),
        'центр x:137.5 y:95 через anchor 0.5, без scale');
}

console.log('\nTest 2: таймер боя (timerTxt) — координаты x:80,y:203, цвет #f0f0f0, шрифт normal');
{
    const start = fightSrc.indexOf("const timerTxt = new PIXI.Text('09:00:00', {");
    assert(start !== -1, 'timerTxt найден');
    const chunk = fightSrc.slice(start, start + 500);
    assert(/fill:'#f0f0f0'/.test(chunk), "цвет #f0f0f0 (было #ffffff)");
    assert(/fontWeight:'normal'/.test(chunk), "шрифт normal (было bold — 'чуть тоньше')");
    // 08.10.2026 (по прямому указанию дизайнера — "шрифт расплющил, пошёл пикселями, нужно
    // было поменять размер шрифта, не растягивать scale'ом"): fontSize:24+scale:1.624 (бывший
    // способ задать видимый размер ~39px) заменён на fontSize:39+без scale — PIXI рендерит
    // текст сразу в нужном разрешении, не размывая уже готовый маленький bitmap. Позиция x/y
    // не изменилась — сравни tests/rewardlinks-weapon-ammo-sync.test.js по духу: тут тоже сам
    // фикс в способе, не в видимом результате.
    assert(/fontSize:39,/.test(chunk), 'fontSize увеличен напрямую до 39 (= старые 24×1.624), не через scale');
    assert(!/timerTxt\.scale\.set\(/.test(chunk), 'scale.set() для timerTxt больше не вызывается — текст не растягивается после рендера');
    assert(/timerTxt\.x = 80; timerTxt\.y = 203;/.test(chunk),
        'позиция x:80 y:203 (сама позиция не менялась, менялся только способ задания размера)');
}

console.log('\nTest 3: старые координаты/цвет/толщина шрифта нигде не остались (регресс-гвард)');
{
    assert(!/bossNameTxt\.x = 92; bossNameTxt\.y = 95; bossNameTxt\.scale\.set\(1\.250\);/.test(fightSrc),
        'старая масштабируемая позиция имени босса (92,95,1.250) не осталась');
    assert(!/timerTxt\.x = 94; timerTxt\.y = 204;/.test(fightSrc),
        'старая позиция таймера (94,204) не осталась');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

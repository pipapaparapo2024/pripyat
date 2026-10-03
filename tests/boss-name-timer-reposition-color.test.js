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

console.log('\nTest 1: имя босса (bossNameTxt) — новые координаты x:92,y:92,scale:1.404, цвет #f0f0f0, шрифт normal');
{
    const start = fightSrc.indexOf("const bossNameTxt = new PIXI.Text('', {");
    assert(start !== -1, 'bossNameTxt найден');
    const chunk = fightSrc.slice(start, start + 350);
    assert(/fill:'#f0f0f0'/.test(chunk), "цвет #f0f0f0 (было #ffffff)");
    assert(/fontWeight:'normal'/.test(chunk), "шрифт normal (было bold — 'чуть тоньше')");
    assert(/bossNameTxt\.x = 92; bossNameTxt\.y = 92; bossNameTxt\.scale\.set\(1\.404\);/.test(chunk),
        'позиция x:92 y:92 scale:1.404 (было x:92 y:95 scale:1.250)');
}

console.log('\nTest 2: таймер боя (timerTxt) — новые координаты x:80,y:203,scale:1.624, цвет #f0f0f0, шрифт normal');
{
    const start = fightSrc.indexOf("const timerTxt = new PIXI.Text('09:00:00', {");
    assert(start !== -1, 'timerTxt найден');
    const chunk = fightSrc.slice(start, start + 350);
    assert(/fill:'#f0f0f0'/.test(chunk), "цвет #f0f0f0 (было #ffffff)");
    assert(/fontWeight:'normal'/.test(chunk), "шрифт normal (было bold — 'чуть тоньше')");
    assert(/timerTxt\.x = 80; timerTxt\.y = 203; timerTxt\.scale\.set\(1\.624\);/.test(chunk),
        'позиция x:80 y:203 scale:1.624 (было x:94 y:204 scale:1.219)');
}

console.log('\nTest 3: старые координаты/цвет/толщина шрифта нигде не остались (регресс-гвард)');
{
    assert(!/bossNameTxt\.x = 92; bossNameTxt\.y = 95; bossNameTxt\.scale\.set\(1\.250\);/.test(fightSrc),
        'старая позиция имени босса (92,95,1.250) не осталась');
    assert(!/timerTxt\.x = 94; timerTxt\.y = 204; timerTxt\.scale\.set\(1\.219\);/.test(fightSrc),
        'старая позиция таймера (94,204,1.219) не осталась');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

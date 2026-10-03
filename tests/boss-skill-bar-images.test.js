/**
 * Test: 25.09.2026, по прямому указанию — полоска прогресса скиллов на экране боя с боссом
 * (позиция 972,583, та же, что и раньше — "изображение семь" с координатами подтвердило
 * позицию, не поменяло её) переведена с однотонной Graphics-заливки (0xff9400) на присланные
 * PNG: "боевка скилл полоса пустая.png" (фон) + "боевка скилл полоса заполнения.png"
 * (заполнение, ширина обрезается по проценту прогресса — та же техника, что у полоски ХП).
 * В отличие от ХП — здесь ОДИН цвет без порогов ("здесь один цвет, он никак не меняется,
 * главное чтобы полоска заполнения работала нормально").
 *
 * Run: node tests/boss-skill-bar-images.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const fightSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');

console.log('\nTest 1: 2 файла скопированы в development/images под неймспейсенными именами');
{
    const files = ['боевка скилл полоса пустая.png', 'боевка скилл полоса заполнения.png'];
    for (const f of files) {
        const p = path.join(root, '_client', 'development', 'images', f);
        assert(fs.existsSync(p), `файл существует: ${f}`);
        if (fs.existsSync(p)) assert(fs.statSync(p).size > 0, `файл не пустой: ${f}`);
    }
}

console.log('\nTest 2: progBg (фон) — Sprite с "полоса пустая", позиция не изменилась (972,583)');
{
    const idx = fightSrc.indexOf("const progBg = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка скилл полоса пустая.png'));");
    assert(idx !== -1, 'progBg создан как Sprite с боевка скилл полоса пустая.png');
    const chunk = fightSrc.slice(idx, idx + 200);
    assert(/progBg\.x = 972; progBg\.y = 583;/.test(chunk), 'позиция не изменилась (972,583)');
}

console.log('\nTest 3: progBar (заполнение) — Sprite с "полоса заполнения", высота 24px зафиксирована');
{
    const idx = fightSrc.indexOf("const progBar = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка скилл полоса заполнения.png'));");
    assert(idx !== -1, 'progBar создан как Sprite с боевка скилл полоса заполнения.png');
    const chunk = fightSrc.slice(idx, idx + 300);
    assert(/progBar\.x = 972; progBar\.y = 583; progBar\.height = 24;/.test(chunk), 'позиция (972,583), высота 24px зафиксирована');
    assert(/this\._bossFightProgBar = progBar;/.test(chunk), 'ссылка сохранена в this._bossFightProgBar');
}

console.log('\nTest 4: обновление UI — ширина по %, БЕЗ смены текстуры/цвета по порогам (в отличие от ХП)');
{
    const start = fightSrc.indexOf('if(window.skills && this._bossFightProgBar && this._bossFightProgTxt){');
    const end   = fightSrc.indexOf('\n        }', start);
    const body  = fightSrc.slice(start, end);
    assert(!/beginFill|drawRect|\.clear\(\)/.test(body), 'старая Graphics-заливка (beginFill/drawRect/clear) убрана целиком');
    assert(/this\._bossFightProgBar\.width = Math\.max\(2, Math\.floor\(287 \* pct\)\);/.test(body),
        'ширина = 287*pct (как раньше у Graphics.drawRect, минимум 2px)');
    assert(/this\._bossFightProgBar\.height = 24;/.test(body), 'высота 24px фиксируется на каждом обновлении');
    assert(/this\._bossFightProgBar\.visible = false;/.test(body), 'полоска скрывается при pct<=0');
    assert(!/_hpTexture|texture =/.test(body), 'текстура НЕ переключается по порогам — один цвет всегда');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

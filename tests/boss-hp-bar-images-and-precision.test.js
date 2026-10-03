/**
 * Test: 25.09.2026, по прямому указанию (4 присланных файла + скриншот боя с "ЖГУТ") —
 *
 * 1) Полоска ХП босса переведена с цветового градиента (Graphics.beginFill с интерполяцией
 *    RGB) на присланные PNG: "боевка хп прогрессия.png" (фон, всегда лежит снизу, 248×28),
 *    поверх него — "боевка хп фулл.png" (зелёный, >50% ХП), "боевка хп половина.png"
 *    (оранжевый, 20-50%), "боевка хп конец.png" (красный, <20%) — ширина верхнего слоя
 *    обрезается по проценту оставшегося ХП, та же техника, что была у Graphics.drawRect().
 *    Пороги 50%/20% — разумное значение по умолчанию (в сообщении не продиктованы точным
 *    числом), вынесены в именованные константы для лёгкой правки.
 *
 * 2) bosses.js._fmt() — баг "нанёс 100к урона, а ХП не изменилось": числа ≥10кк (напр. Жгут,
 *    30кк) округлялись до целого (toFixed(0)) вместо одного знака после запятой — 29.9кк
 *    показывались как те же "30кк". Ветка n>=1e7 убрана, единая формула для любого n>=1e6.
 *
 * Run: node tests/boss-hp-bar-images-and-precision.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const fightSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const bossesSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses.js'), 'utf-8');

console.log('\nTest 1: 4 файла скопированы в development/images под неймспейсенными именами');
{
    const files = [
        'боевка хп прогрессия.png',
        'боевка хп фулл.png',
        'боевка хп половина.png',
        'боевка хп конец.png',
    ];
    for (const f of files) {
        const p = path.join(root, '_client', 'development', 'images', f);
        assert(fs.existsSync(p), `файл существует: ${f}`);
        if (fs.existsSync(p)) assert(fs.statSync(p).size > 0, `файл не пустой: ${f}`);
    }
}

console.log('\nTest 2: фон полоски ХП (hpBarBg) — Sprite с "прогрессия", лежит на прежней позиции (12,142)');
{
    const idx = fightSrc.indexOf("const hpBarBg = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка хп прогрессия.png'));");
    assert(idx !== -1, 'hpBarBg создан как Sprite с боевка хп прогрессия.png');
    const chunk = fightSrc.slice(idx, idx + 200);
    assert(/hpBarBg\.x = 12; hpBarBg\.y = 142;/.test(chunk), 'позиция не изменилась (12,142) — совпадает с присланным редактором координат');
}

console.log('\nTest 3: сама полоска ХП (hpBar) — Sprite, изначально "фулл", высота 28px фиксирована');
{
    const idx = fightSrc.indexOf("const hpBar = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка хп фулл.png'));");
    assert(idx !== -1, 'hpBar создан как Sprite (не Graphics)');
    const chunk = fightSrc.slice(idx, idx + 300);
    assert(/hpBar\.x = 12; hpBar\.y = 142; hpBar\.height = 28;/.test(chunk), 'позиция (12,142), высота 28px зафиксирована');
    assert(/this\._bossFightHpBar = hpBar;/.test(chunk), 'ссылка сохранена в this._bossFightHpBar');
}

console.log('\nTest 4: _hpTexture(pct) — три текстуры по порогам, без continuous-градиента');
{
    assert(/const HP_HALF_THRESHOLD = 0\.5;/.test(fightSrc), 'порог "половина" вынесен в константу');
    assert(/const HP_END_THRESHOLD\s*= 0\.2;/.test(fightSrc), 'порог "конец" вынесен в константу');
    const start = fightSrc.indexOf('function _hpTexture(pct){');
    assert(start !== -1, '_hpTexture() определена');
    const end = fightSrc.indexOf('\n}', start);
    const body = fightSrc.slice(start, end);
    assert(/if\(pct > HP_HALF_THRESHOLD\) return 'боевка хп фулл\.png';/.test(body), '>50% → фулл (зелёный)');
    assert(/if\(pct > HP_END_THRESHOLD\)\s*return 'боевка хп половина\.png';/.test(body), '20-50% → половина (оранжевый)');
    assert(/return 'боевка хп конец\.png';/.test(body), '<20% → конец (красный), как фолбэк-ветка');
    assert(!/_hpColor/.test(fightSrc), 'старая функция цветового градиента _hpColor() удалена целиком');
}

console.log('\nTest 5: _updateBossFightHpDisplay — ширина полоски пересчитывается по % ХП, текстура выбирается по _hpTexture');
{
    const start = fightSrc.indexOf('proto._updateBossFightHpDisplay = function(){');
    const end   = fightSrc.indexOf('\n    };', start);
    const body  = fightSrc.slice(start, end);
    assert(/this\._bossFightHpBar\.texture = PIXI\.Texture\.from\('\.\/images\/' \+ _hpTexture\(pct\)\);/.test(body),
        'текстура полоски меняется по _hpTexture(pct)');
    assert(/this\._bossFightHpBar\.width = Math\.max\(2, Math\.floor\(248 \* pct\)\);/.test(body),
        'ширина = 248*pct (как раньше у Graphics.drawRect, минимум 2px)');
    assert(/this\._bossFightHpBar\.visible = false;/.test(body), 'полоска скрывается при pct<=0 (ХП обнулилось)');
}

console.log('\nTest 6: bosses.js._fmt() — точность до 1 знака после запятой для ЛЮБОГО числа ≥1кк (не только <10кк)');
{
    const start = bossesSrc.indexOf('_fmt(n){');
    const end   = bossesSrc.indexOf('\n    }', start);
    const body  = bossesSrc.slice(start, end);
    assert(!/n >= 1e7/.test(body), 'ветка n>=1e7 (округление до целого) убрана целиком');
    assert(/if\(n >= 1e6\)\s*return \(n\/1e6\)\.toFixed\(1\)\.replace\('\.0',''\)\+'кк';/.test(body),
        'единая формула toFixed(1) для n>=1e6, круглые числа (30.0→30) по-прежнему без ".0"');

    // Прогон формулы напрямую (как в реальном _fmt) — воспроизводим баг-репорт буквально:
    // Жгут 30кк, нанесено 100к урона → должно остаться заметно на индикаторе.
    function fmt(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'кк';
        if (n >= 1e4) return (n / 1e3).toFixed(0) + 'к';
        return n.toLocaleString('ru');
    }
    assert(fmt(30000000) === '30кк', 'полное ХП Жгута (30000000) форматируется как "30кк" (без .0)');
    assert(fmt(29900000) === '29.9кк', 'после 100к урона (29900000) форматируется как "29.9кк" — урон теперь виден');
    assert(fmt(30000000) !== fmt(29900000), 'до и после 100к урона строки РАЗНЫЕ (баг-репорт: раньше совпадали)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

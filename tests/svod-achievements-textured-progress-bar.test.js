/**
 * Test: батч 22.09.2026 (по прямому указанию, новый файл «прогресс заполнения достижений.png») —
 * прогресс-бар тира внутри развёрнутой темы («Мои достижения») больше не рисуется сплошной
 * Graphics-заливкой (жёлтый/зелёный прямоугольник), а показывает НОВУЮ текстуру, раскрытую
 * маской слева направо на долю frac (current/target) — та же формула ширины, что была у
 * старого Graphics-варианта, только применяется как маска поверх спрайта, а не заливка.
 *
 * Run: node tests/svod-achievements-textured-progress-bar.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

console.log('\nTest 1: файл-ассет реально скопирован рядом с остальными картинками Сводки');
{
    const filePath = path.join(root, '_client', 'development', 'images', 'прогресс заполнения достижений.png');
    assert(fs.existsSync(filePath), 'прогресс заполнения достижений.png существует в _client/development/images/');
}

console.log('\nTest 2: bar — теперь Container (трек + текстурный fill + маска), не голый Graphics');
{
    assert(/const bar = new PIXI\.Container\(\);/.test(src), 'bar — PIXI.Container (было PIXI.Graphics)');
    assert(/const barTrack = new PIXI\.Graphics\(\);/.test(src), 'barTrack — пустой фон бара, статичная Graphics-подложка');
    assert(/const barFill = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'прогресс заполнения достижений\.png'\)\);/.test(src),
        'barFill — спрайт из НОВОГО файла прогресса');
    assert(/barFill\.width = PROGRESS_BAR_W; barFill\.height = PROGRESS_BAR_H;/.test(src),
        'barFill растянут на те же PROGRESS_BAR_W/H, что и раньше занимал Graphics-бар целиком');
    assert(/const barFillMask = new PIXI\.Graphics\(\);/.test(src), 'barFillMask — Graphics-маска для раскрытия доли прогресса');
    assert(/barFill\.mask = barFillMask;/.test(src), 'маска применена именно к текстурному спрайту');
}

console.log('\nTest 3: co (пул-объект карточки) хранит barFillMask, чтобы _fillCard мог её перерисовывать');
{
    assert(/const co = \{ card, iconTxt, nameTxt, descTxt, ptsTxt, checkMark, starsGotBadge, bar, barFillMask, fracTxt, star, starFill, starFillMask,/.test(src),
        'barFillMask сохранён в co наравне с остальными полями карточки');
}

console.log('\nTest 4: _fillCard — заполнение считает ТУ ЖЕ формулу ширины (frac), что и раньше, но рисует маску, не заливку');
{
    // 25.09.2026: условие переименовано isTierRow -> showBar (базовая карточка темы тоже может
    // показываться в режиме бара, см. tests/svod-achievements-tier-vs-summary-progress-bar.test.js)
    // — сама формула заполнения маски внутри ветки не менялась.
    const start = src.indexOf('if(showBar){');
    const end   = src.indexOf('} else {', start);
    const body  = src.slice(start, end);
    assert(/c\.barFillMask\.clear\(\);/.test(body), 'маска очищается перед перерисовкой');
    assert(/c\.barFillMask\.beginFill\(0xffffff\);/.test(body), 'маска рисуется сплошным цветом (для Graphics-маски цвет не важен, важна форма/альфа)');
    // 26.09.2026 (по скриншоту — "красный минимум виден даже на 0%-достижениях"): безусловный
    // Math.max держал минимальную ширину-"таблетку" ДАЖЕ при frac===0 — вынесено в отдельную
    // fillW с явным guard'ом (frac>0 ? Math.max(...) : 0), честный 0% теперь = 0px.
    assert(/const fillW = frac > 0 \? Math\.max\(PROGRESS_BAR_H, PROGRESS_BAR_W \* frac\) : 0;/.test(body),
        'ширина маски вычисляется через fillW с guard\'ом frac>0 — честный 0% = 0px, иначе та же формула-"таблетка"');
    assert(/c\.barFillMask\.drawRoundedRect\(0, 0, fillW, PROGRESS_BAR_H, PROGRESS_BAR_H \/ 2\);/.test(body),
        'маска рисуется по fillW, не инлайн-формулой');
    assert(!/c\.bar\.beginFill\(done \? 0x3fae4a : 0xffcc44\)/.test(body),
        'старая зелёная/жёлтая заливка по done-статусу убрана — теперь всегда текстура');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 20.10.2026, по прямому указанию — "почему-то в покере есть серое такое окошко, я так
 * понимаю это раньше был старый уровень, убери это, не хватало просто файлов рамка/заливка
 * чёрная".
 *
 * Причина: шкала уровня покера (dvor-poker-screen.js) уже давно переведена на текстурную жёлтую
 * заливку ("заливка желтыя уровень покера.png", растущая маска — см. 04.10.2026 в истории
 * файла), но ПОД ней по-прежнему рисовалась старая плоская серая Graphics-подложка (barBg,
 * 0x333333/0.85, drawRoundedRect) — реальных файлов рамки/чёрной базы для неё никогда не
 * присылали, поэтому использовали временную заглушку. Теперь присланы оба файла, заглушка
 * убрана.
 *
 * Run: node tests/poker-level-bar-frame-and-black-fill-assets.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8');
const imagesDir = path.join(root, '_client', 'development', 'images');

console.log('\nTest 1: старая серая Graphics-заглушка (barBg) убрана целиком');
{
    assert(!/const barBg = new PIXI\.Graphics\(\);/.test(src), 'barBg больше не создаётся');
    assert(!/barBg\.beginFill\(0x333333/.test(src), 'плоская серая заливка 0x333333 больше не рисуется');
    assert(!/barBg\.drawRoundedRect/.test(src), 'barBg.drawRoundedRect больше не вызывается');
}

console.log('\nTest 2: новые файлы рамка/чёрная заливка подключены на заданных координатах');
{
    assert(/const levelFrame = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/покер рамка уровень\.png'\)\);/.test(src),
        'levelFrame грузит "покер рамка уровень.png"');
    assert(/levelFrame\.x = 508; levelFrame\.y = 108;/.test(src), 'levelFrame: x=508,y=108');
    assert(/const levelBlackFill = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/покер заливка черная уровень\.png'\)\);/.test(src),
        'levelBlackFill грузит "покер заливка черная уровень.png"');
    assert(/levelBlackFill\.x = 510; levelBlackFill\.y = 111;/.test(src), 'levelBlackFill: x=510,y=111');

    // Порядок addChild: рамка и чёрная база должны лежать ПОД жёлтой текстурной заливкой
    // (barFillImg) — иначе прогресс-бар будет скрыт под новыми слоями.
    const frameIdx     = src.indexOf('const levelFrame = ');
    const blackIdx     = src.indexOf('const levelBlackFill = ');
    const yellowIdx    = src.indexOf("const barFillImg = new PIXI.Sprite(PIXI.Texture.from('./images/заливка желтыя уровень покера.png'));");
    assert(frameIdx > -1 && blackIdx > -1 && yellowIdx > -1 && frameIdx < blackIdx && blackIdx < yellowIdx,
        'порядок в файле: рамка → чёрная база → жёлтая заливка (прогресс рисуется поверх)');
}

console.log('\nTest 3: оба новых файла физически существуют локально (с .webp-твином)');
{
    for (const name of ['покер рамка уровень.png', 'покер заливка черная уровень.png']) {
        const p = path.join(imagesDir, name);
        assert(fs.existsSync(p) && fs.statSync(p).size > 0, `${name} существует и не пустой`);
        assert(fs.existsSync(p + '.webp'), `${name}.webp существует (lossless-твин)`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

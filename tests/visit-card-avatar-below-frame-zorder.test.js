/**
 * Test: 28.10.2026, по прямому указанию (скриншот) — "иконку игрока сделай по z-index меньше
 * чем файл визитка у игрока.png, чтобы иконка было под этим файлом". На скрине фото игрока
 * визуально вылезало НАД декоративной рамкой визитки вместо того, чтобы прятаться под её краями.
 *
 * Корень: в player_profile.js._buildVisitCard bg ("визитка у игрока.png") добавлялся в `card`
 * ПЕРВЫМ, ДО avatarSpr/avatarMask — в PIXI ребёнок, добавленный позже, рисуется ПОВЕРХ раньше
 * добавленного, то есть avatarSpr (добавлен позже bg) оказывался СВЕРХУ рамки, а не под ней.
 *
 * Фикс: bg теперь создаётся и добавляется ПОСЛЕДНИМ из трёх (после avatarSpr и avatarMask) —
 * рамка рисуется поверх аватарки, её непрозрачные края аккуратно перекрывают края фото.
 *
 * Run: node tests/visit-card-avatar-below-frame-zorder.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const src = readSrc('_client/src/game/shell/overlays/player_profile.js');

console.log('\nTest 1: bg ("визитка у игрока.png") добавляется ПОСЛЕ avatarSpr/avatarMask — рамка рисуется поверх аватарки');
{
    const buildStart = src.indexOf('proto._buildVisitCard = function');
    assert(buildStart !== -1, '_buildVisitCard найден в исходнике');

    const avatarSprAddIdx = src.indexOf('card.addChild(avatarSpr);', buildStart);
    const avatarMaskAddIdx = src.indexOf('card.addChild(avatarMask);', buildStart);
    const bgDeclIdx = src.indexOf("const bg = new PIXI.Sprite(PIXI.Texture.from('./images/визитка у игрока.png'));", buildStart);
    const bgAddIdx = src.indexOf('card.addChild(bg);', buildStart);

    assert(avatarSprAddIdx !== -1 && avatarMaskAddIdx !== -1 && bgAddIdx !== -1,
        'все три addChild (avatarSpr, avatarMask, bg) найдены внутри _buildVisitCard');

    assert(avatarSprAddIdx < bgAddIdx, 'avatarSpr добавляется ДО bg (значит bg рисуется поверх, не наоборот)');
    assert(avatarMaskAddIdx < bgAddIdx, 'avatarMask добавляется ДО bg');
    assert(bgDeclIdx > avatarMaskAddIdx, 'bg создаётся уже ПОСЛЕ блока аватарки (а не в начале функции, как было)');

    // Относительный порядок avatarSpr/avatarMask друг к другу не должен был измениться —
    // это не часть запрошенной правки, трогать его не нужно (mask по-прежнему сразу после спрайта).
    assert(avatarSprAddIdx < avatarMaskAddIdx, 'avatarSpr по-прежнему добавляется до avatarMask (порядок этой пары не менялся)');
}

console.log('\nTest 2: bg по-прежнему создаётся ровно один раз в функции (не задвоен копипастой при переносе)');
{
    const buildStart = src.indexOf('proto._buildVisitCard = function');
    const nextFnIdx = src.indexOf('\n    proto.', buildStart + 10);
    const body = src.slice(buildStart, nextFnIdx === -1 ? src.length : nextFnIdx);
    const bgDeclMatches = body.match(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/визитка у игрока\.png'\)\);/g) || [];
    assert(bgDeclMatches.length === 1, 'ровно одно объявление bg внутри _buildVisitCard (было бы ошибкой "Identifier bg has already been declared" при двух)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

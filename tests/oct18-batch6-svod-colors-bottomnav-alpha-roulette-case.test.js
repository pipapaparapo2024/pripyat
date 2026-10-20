/**
 * Test: батч 18.10.2026 (шестой за день, по прямому указанию) —
 *
 *  1) svod-leaderboard.js — место игрока (placeTxt) получило отдельный цвет #b9a693 (снято
 *     пипеткой с картинки 2); имя/уровень/значение (nameTxt/levelTxt/valTxt) — #c5c5c5 (снято
 *     пипеткой с картинки 1), раньше были разные цвета (#ffffff/#ffcc44).
 *  2) interface-bottom-nav.js — кнопки нижнего HUD больше НЕ растут при наведении
 *     (_addHoverGlow убран), вместо этого новый общий хелпер _addHoverAlpha — только
 *     прозрачность, без масштаба/смещения.
 *  3) dvor-roulette-buy.js — кейс рулетки: закрытый кейс на натуральном размере (957×510,
 *     было растянуто на всю ширину канваса), кнопка "открыть" -8px по y, кнопка "забрать"
 *     в открытом кейсе — новый файл на новых координатах (заменяет старый).
 *  4) dev_panel.js — кнопка превью "кейс рулетки (шмотка выпала)", открывает экран открытого
 *     кейса с hasTatu=true и мок-наградой, минуя сервер.
 *
 * Run: node tests/oct18-batch6-svod-colors-bottomnav-alpha-roulette-case.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const lbSrc   = read('_client/src/game/svod/svod-leaderboard.js');
const kitSrc  = read('_client/src/game/shell/ui_kit.js');
const navSrc  = read('_client/src/game/interface/interface-bottom-nav.js');
const roulSrc = read('_client/src/game/dvor/dvor-roulette-buy.js');
const devSrc  = read('_client/src/game/shell/overlays/dev_panel.js');
const bootSrc = read('_client/src/game/game-boot.js');

console.log('\n1) svod-leaderboard.js — место #b9a693, имя/уровень/значение #c5c5c5');
{
    assert(/const placeTxt = new PIXI\.Text\('', \{ fontFamily:'Southbank LT', fontSize:19, fill:'#b9a693' \}\);/.test(lbSrc),
        'placeTxt — #b9a693');
    assert(/fontFamily:'Southbank LT', fontSize:12, fill:'#c5c5c5',/.test(lbSrc), 'nameTxt — #c5c5c5');
    assert(/const levelTxt = new PIXI\.Text\('', \{ fontFamily:'Southbank LT', fontSize:15, fill:'#c5c5c5' \}\);/.test(lbSrc), 'levelTxt — #c5c5c5');
    assert(/const valTxt = new PIXI\.Text\('', \{ fontFamily:'Southbank LT', fontSize:16, fill:'#c5c5c5' \}\);/.test(lbSrc), 'valTxt — #c5c5c5 (было #ffcc44)');
}

console.log('\n2) ui_kit.js / interface-bottom-nav.js — hover нижнего HUD только alpha, без масштаба');
{
    assert(/proto\._addHoverAlpha = function\(btn, targetAlpha\)\{/.test(kitSrc), '_addHoverAlpha определён');
    assert(/btn\.on\('pointerover', \(\)=>\{ btn\.alpha = targetAlpha; \}\);/.test(kitSrc), 'pointerover меняет только alpha');
    assert(!/window\._scHover/.test(kitSrc.slice(kitSrc.indexOf('proto._addHoverAlpha'))), '_addHoverAlpha не использует _scHover (без роста/смещения)');
    assert(/if\(typeof this\._addHoverAlpha === 'function'\) this\._addHoverAlpha\(spr\);/.test(navSrc),
        'interface-bottom-nav.js вызывает _addHoverAlpha');
    assert(!/this\._addHoverGlow\(spr\);/.test(navSrc), 'interface-bottom-nav.js больше НЕ вызывает _addHoverGlow (масштаб)');
}

console.log('\n3) dvor-roulette-buy.js — кейс рулетки на новых координатах');
{
    assert(/bg\.x = 145; bg\.y = 92; bg\.scale\.set\(1\.000\);/.test(roulSrc), 'закрытый кейс — натуральный размер, x:145,y:92');
    // Растяжка на всю ширину убрана ТОЛЬКО у закрытого кейса — у открытого кейса "с тату"
    // (отдельная ветка _openRouletteCaseOpenedScreen, другой bg) такой правки не было.
    const closedCaseBlock = roulSrc.slice(roulSrc.indexOf("'двор рулетка кейс закрытый.png'"), roulSrc.indexOf('const exitBtn'));
    assert(!/bg\.width = 1280; bg\.scale\.y = bg\.scale\.x;/.test(closedCaseBlock), 'растяжка на всю ширину канваса убрана у закрытого кейса');
    assert(/openBtn\.x = 640; openBtn\.y = 459;/.test(roulSrc), 'кнопка "открыть" — y:459 (было 467)');
    assert(/const takeBtn = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'кнопка забрать кейс рулетка\.png'\)\);/.test(roulSrc),
        'кнопка "забрать" — новый файл');
    assert(/takeBtn\.x = 621; takeBtn\.y = 470;/.test(roulSrc), 'кнопка "забрать" — x:621,y:470');
    assert(/'кнопка забрать кейс рулетка\.png'/.test(bootSrc), 'новый файл есть в прелоаде game-boot.js');
}

console.log('\n4) dev_panel.js — превью кейса рулетки с выпавшей шмоткой');
{
    assert(/_row\('Кейс рулетки \(шмотка выпала\)', \[/.test(devSrc), 'кнопка dev-превью добавлена');
    // 20.10.2026: сигнатура выросла до (hasTatu, reward, clientRewards, shmotItemId) — dev-кнопка
    // передаёт undefined (реального id нет, источник 'roulette' в каталоге шмоток пока пуст).
    assert(/dvor\._openRouletteCaseOpenedScreen\(true, \{ exp: 500, cig: 1000, stash: 2, coins: 20 \}, \[\], undefined\);/.test(devSrc),
        'вызывает _openRouletteCaseOpenedScreen(true, mockReward, [], undefined) напрямую');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

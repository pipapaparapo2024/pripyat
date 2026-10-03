/**
 * Test: 26.09.2026, по прямому указанию — три правки экрана суперигры "9 стаканчиков"
 * (dvor-roulette-minigame.js):
 *  1. Задний фон суперигры выводится в НАТУРАЛЬНОМ размере (файл 1280×533), раньше растягивался
 *     до 1280×720 (искажение по вертикали).
 *  2. На экране джекпота (выбор стаканчика) теперь показывается верхний и нижний HUD — раньше
 *     не добавлялся вовсе.
 *  3. Экран "Утешительный приз" больше не показывает инлайн-текст типа/суммы награды — вместо
 *     этого по клику ЗАБРАТЬ открывается стандартный попап награды (iface._showRewardPopup) с
 *     той же наградой.
 *
 * Run: node tests/roulette-minigame-natural-bg-hud-and-consolation-reward-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-minigame.js'), 'utf-8');

console.log('\nTest 1: задний фон суперигры без принудительного 1280×720 (натуральный размер)');
{
    const start = src.indexOf('proto._buildRouletteMinigameWin');
    const end   = src.indexOf('const blocker', start);
    const body  = src.slice(start, end);

    assert(/const superBg = new PIXI\.Sprite/.test(body), 'superBg создаётся');
    assert(!/superBg\.width\s*=\s*1280/.test(body), 'superBg.width больше НЕ задаётся принудительно (был width=1280)');
    assert(!/superBg\.height\s*=\s*720/.test(body), 'superBg.height больше НЕ задаётся принудительно (был height=720, искажал пропорции)');
}

console.log('\nTest 2: HUD (iface.up/iface.down) добавляется на экране джекпота (выбор стаканчика)');
{
    const start = src.indexOf('proto._buildRouletteMinigameWin');
    const end   = src.indexOf('proto._openConsolationPrize', start);
    const body  = src.slice(start, end);

    assert(/if\(window\.iface\)\{/.test(body), 'проверяет наличие iface перед добавлением HUD');
    assert(/if\(iface\.up\)\s*root\.layer2_mc\.addChild\(iface\.up\);/.test(body), 'добавляет верхний HUD (iface.up)');
    assert(/if\(iface\.down\)\s*root\.layer2_mc\.addChild\(iface\.down\);/.test(body), 'добавляет нижний HUD (iface.down)');
}

console.log('\nTest 3: "Утешительный приз" — инлайн-текст убран, ЗАБРАТЬ открывает попап награды');
{
    const start = src.indexOf('proto._openConsolationPrize');
    const end   = src.indexOf('proto._openJackpotPrize', start);
    const body  = src.slice(start, end);

    assert(!/const lblTxt/.test(body), 'текст типа награды (lblTxt) убран');
    assert(!/const amtTxt/.test(body), 'текст суммы награды (amtTxt) убран');
    assert(/if\(window\.iface\) iface\._showRewardPopup\(\[\{type, amount: amt\}\]\);/.test(body),
        'по клику ЗАБРАТЬ вызывается стандартный попап награды с типом/суммой утешительного приза');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 24.09.2026 (по прямому указанию, после бага "на Хабаре не видно нижнего ХУДа") —
 * переход restoreHud() с ручной цепочки проверок конкретных окон (bossOverlayOpen ||
 * locationOpen || zoneScreenOpen, forceDownHud = ryukzakOpen || weaponsOpen || habarOpen) на
 * декларативный стек: каждый экран сам заявляет своё требование к ХУДу при открытии
 * (iface.pushHud(id, {up,down})) и снимает его при закрытии (iface.popHud(id)) —
 * restoreHud() просто применяет верхушку стека, ничего не угадывая по конкретным окнам.
 * Полный опрос пользователя по всем страницам игры — см. историю сессии; итог: низ ХУДа
 * скрыт только в 4 боевых/зональных экранах (Зона/Список боссов/Подготовка/Бой), Рюкзак
 * скрывает ОБА (по прямому указанию 22.09/24.09 — "на заднем фоне Сидорович со своими
 * ХУДами"), Ящик остался с дефолтом (баг — раньше прятал оба целиком, исправлено), везде
 * остальное — дефолт (оба видны, пустой стек).
 *
 * Run: node tests/declarative-hud-refactor.test.js
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

const ifaceSrc   = readSrc('_client/src/game/interface.js');
const panelsSrc  = readSrc('_client/src/game/interface/interface-panels.js');
const zoneSrc    = readSrc('_client/src/game/shell/overlays/zone_screen.js');
const selectSrc  = readSrc('_client/src/game/shell/overlays/bosses_select.js');
const prefightSrc= readSrc('_client/src/game/shell/overlays/bosses_prefight.js');
const fightSrc   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const skillsSrc  = readSrc('_client/src/game/shell/overlays/bosses_skills.js');
const ryukzakSrc = readSrc('_client/src/game/shell/overlays/ryukzak.js');
const weaponsSrc = readSrc('_client/src/game/weapons.js');
const habarSrc   = readSrc('_client/src/game/habar.js');
const yashikSrc  = readSrc('_client/src/game/shell/overlays/yashik.js');
const shmotSrc   = readSrc('_client/src/game/shell/overlays/shmot_shop.js');
const dvorSrc    = readSrc('_client/src/game/dvor.js');
const svodSrc    = readSrc('_client/src/game/svod.js');

console.log('\nTest 1: Interface — pushHud/popHud/restoreHud() существуют, старая ручная цепочка проверок убрана');
{
    assert(/this\._hudStack = \[\];/.test(ifaceSrc), 'this._hudStack инициализирован в конструкторе');
    assert(/pushHud\(id, opts\)\{/.test(ifaceSrc), 'pushHud(id, opts) определён');
    assert(/popHud\(id\)\{/.test(ifaceSrc), 'popHud(id) определён');
    assert(/const top = this\._hudStack\.length \? this\._hudStack\[this\._hudStack\.length - 1\] : \{ up: true, down: true \};/.test(ifaceSrc),
        'restoreHud() берёт верхушку стека, пустой стек = дефолт (оба видны)');
    // 24.09.2026: старые имена оставлены в ИСТОРИЧЕСКОМ комментарии конструктора (объясняет,
    // ЧТО заменил декларативный стек) — проверяем их отсутствие именно в КОДЕ restoreHud(),
    // не по всему файлу (иначе тест ложно падает на собственном объясняющем комментарии).
    const restoreHudMatch = ifaceSrc.match(/restoreHud\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!restoreHudMatch, 'restoreHud() найден');
    const restoreHudBody = restoreHudMatch ? restoreHudMatch[1] : '';
    assert(!/bossOverlayOpen/.test(restoreHudBody), 'restoreHud() больше не проверяет bossOverlayOpen');
    assert(!/ryukzakOpen/.test(restoreHudBody), 'restoreHud() больше не проверяет ryukzakOpen');
    assert(!/weaponsOpen/.test(restoreHudBody), 'restoreHud() больше не проверяет weaponsOpen');
    assert(!/habarOpen/.test(restoreHudBody), 'restoreHud() больше не проверяет habarOpen');
    assert(!/locationOpen/.test(restoreHudBody), 'restoreHud() больше не проверяет locationOpen');
}

console.log('\nTest 2: Зона — pushHud("zone",{down:false}) при открытии, popHud при выходе (и через exitBtn, и через _closeAllPanels)');
{
    assert(/this\.pushHud\('zone', \{ down: false \}\);/.test(zoneSrc), 'открытие Зоны регистрирует down:false');
    assert(/this\.popHud\('zone'\);/.test(zoneSrc), 'кнопка выхода из Зоны снимает регистрацию');
    assert(/this\.popHud\('zone'\);/.test(panelsSrc), '_closeAllPanels() тоже снимает регистрацию Зоны (не только её собственная кнопка выхода)');
}

console.log('\nTest 3: Список боссов / подготовка / бой / скилы — все четыре регистрируют down:false, снимают при закрытии');
{
    assert(/this\.pushHud\('bossSelect', \{ down: false \}\);/.test(selectSrc), 'список боссов регистрирует down:false');
    assert(/this\.popHud\('bossSelect'\);/.test(selectSrc), 'список боссов снимает при своём exitBtn');
    assert(/this\.popHud\('bossSelect'\);/.test(panelsSrc), '_closeAllPanels() тоже снимает регистрацию списка боссов');
    assert(/this\.popHud\('bossSelect'\);/.test(fightSrc), 'прямой переход список→бой (минуя exitBtn) тоже снимает регистрацию списка боссов');

    assert(/this\.pushHud\('bossPrefight', \{ down: false \}\);/.test(prefightSrc), 'подготовка к бою регистрирует down:false');
    assert(/this\.popHud\('bossPrefight'\);/.test(prefightSrc), 'подготовка к бою снимает регистрацию при закрытии');

    assert(/this\.pushHud\('bossFight', \{ down: false \}\);/.test(fightSrc), 'экран боя регистрирует down:false');
    assert(/this\.popHud\('bossFight'\);/.test(fightSrc), 'экран боя снимает регистрацию при закрытии');

    assert(/this\.pushHud\('bossSkills', \{ down: false \}\);/.test(skillsSrc), 'экран скиллов (поверх боя) регистрирует down:false');
    assert(/this\.popHud\('bossSkills'\);/.test(skillsSrc), 'экран скиллов снимает регистрацию при закрытии');
}

console.log('\nTest 4: Рюкзак — открывается просто поверх текущего экрана, ХУД не трогает (25.09.2026: "теряется нижний ХУД, должно быть просто поверх Сидоровича")');
{
    // 25.09.2026 (по прямому указанию, скриншот): {up:false,down:false} от 24.09.2026 прятало
    // ОБА ХУДа целиком — теперь просто накладываемся сверху, тот же паттерн, что sidorovich.js
    // (pushHud('sidorovich', {})). См. tests/ryukzak-hud-and-birka-zorder.test.js.
    assert(/this\.pushHud\('ryukzak', \{\}\);/.test(ryukzakSrc), "Рюкзак регистрируется через pushHud('ryukzak', {}) — ХУД не прячется");
    assert(/this\.popHud\('ryukzak'\);/.test(ryukzakSrc), 'Рюкзак снимает регистрацию по кнопке НАЗАД');
    // Sidorovich (задний фон) не должен закрываться при открытии Рюкзака — попап просто
    // накладывается поверх (root.layer2_mc.addChild(win) без removeChild сидоровичевского окна).
    assert(!/_sidorovichWin[\s\S]{0,40}removeChild/.test(ryukzakSrc), 'Рюкзак не закрывает окно Сидоровича — оно остаётся видно на фоне');
}

console.log('\nTest 5: Оружейка и Хабар держат низ принудительно видимым (down:true), даже поверх боя с боссом');
{
    assert(/iface\.pushHud\('weapons', \{ down: true \}\);/.test(weaponsSrc), 'Оружейка регистрирует down:true');
    assert(/iface\.popHud\('weapons'\);/.test(weaponsSrc), 'Оружейка снимает регистрацию при закрытии');
    assert(!/iface\._bossFightWin/.test(weaponsSrc), 'старый ручной хак через iface._bossFightWin в close() убран');

    assert(/iface\.pushHud\('habar', \{ down: true \}\);/.test(habarSrc), 'Хабар регистрирует down:true');
    assert(/iface\.popHud\('habar'\);/.test(habarSrc), 'Хабар снимает регистрацию при закрытии');
}

console.log('\nTest 6: Ящик — баг "прятал оба ХУДа целиком" исправлен, теперь дефолт (оба видны) на всём протяжении экрана');
{
    assert(/this\.pushHud\('yashik', \{\}\);/.test(yashikSrc), 'Ящик регистрирует себя (пустые opts = оба видны по умолчанию pushHud)');
    assert(/this\.popHud\('yashik'\);/.test(yashikSrc), 'Ящик снимает регистрацию по кнопке выхода');
    assert(!/if\(this\.up\)\s*this\.up\.visible\s*=\s*false/.test(yashikSrc), 'старое ручное скрытие верхнего ХУДа в Ящике убрано');
    assert(!/if\(this\.down\)\s*this\.down\.visible\s*=\s*false/.test(yashikSrc), 'старое ручное скрытие нижнего ХУДа в Ящике убрано');
}

console.log('\nTest 7: Магазин шмоток / Двор / Свод — 29.09.2026 (репорт "бой с боссом → оружейка → шмотки открылись без нижнего ХУДа"): эти три экрана раньше звали только iface.restoreHud() без своего pushHud(id,{}), из-за чего наследовали чужую запись (например down:false от боя с боссом), оставшуюся на верхушке стека, а не свой дефолт (оба ХУДа видны)');
{
    assert(/iface\.pushHud\('shmot', \{\}\);/.test(shmotSrc), "Магазин шмоток регистрируется через pushHud('shmot', {})");
    assert(/iface\.popHud\('shmot'\);/.test(shmotSrc), 'Магазин шмоток снимает регистрацию по кнопке выхода');
    assert(!/if\(iface\.up\)\s*\{\s*iface\.up\.visible = true;\s*root\.addChild\(iface\.up\);\s*\}/.test(shmotSrc),
        'старый ручной форс-показ ХУДа в кнопке выхода магазина шмоток убран');
    assert(/this\.popHud\('shmot'\);/.test(panelsSrc), '_closeAllPanels() тоже снимает регистрацию магазина шмоток (переключение вкладки, не свой крестик)');

    assert(/iface\.pushHud\('dvor', \{\}\);/.test(dvorSrc), "Двор регистрируется через pushHud('dvor', {})");
    assert(/iface\.popHud\('dvor'\);/.test(dvorSrc), 'Двор снимает регистрацию в close()');
    assert(!/root\.addChild\(iface\.up\)/.test(dvorSrc), 'старый ручной форс-показ верхнего ХУДа в close() Двора убран');

    assert(/iface\.pushHud\('svod', \{\}\);/.test(svodSrc), "Свод регистрируется через pushHud('svod', {})");
    assert(/iface\.popHud\('svod'\);/.test(svodSrc), 'Свод снимает регистрацию в close() (раньше close() вообще не трогал ХУД)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

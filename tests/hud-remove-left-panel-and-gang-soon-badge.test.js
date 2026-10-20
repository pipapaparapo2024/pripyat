/**
 * Test: батч 21.09.2026 (по прямому указанию, 3 картинки) —
 *
 *  1) Левая PNG-панель HUD (Скряга/Бот/Пропуск) убрана целиком — эти 3 раздела ещё не готовы
 *     к бета-тесту, простое затемнение кнопок (alpha=0.45 + interactive=false) не давало
 *     игроку понять, что раздела в принципе нет. Модули (hapuga.js/bot.js/battlepass.js) и их
 *     серверная блокировка BETA_LOCKED НЕ трогались — убран только вход в них с HUD.
 *  2) Кнопка "Банда" (butt_gangs, уже была затемнена ранее) получила плашку "СКОРО"
 *     (скоро банда.png, сверено по MD5 с присланным пользователем скоро.png) на позиции
 *     X:465 Y:620, снятой через универсальный редактор позиций.
 *
 * Run: node tests/hud-remove-left-panel-and-gang-soon-badge.test.js
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const panelsSrc = readSrc('_client/src/game/interface/interface-panels.js');
const hataSrc   = readSrc('_client/src/game/shell/overlays/hata.js');
const IMAGES_DIR = path.join(root, '_client', 'development', 'images');

console.log('\nTest 1: левая панель (скряга/бот/пропуск) полностью убрана из кода');
{
    assert(!/leftCfg/.test(panelsSrc), 'массив leftCfg (скряга/бот/пропуск) удалён');
    assert(!/const leftPanel/.test(panelsSrc), 'контейнер leftPanel больше не создаётся');
    assert(!/PANEL_X_LEFT|PANEL_Y_LEFT/.test(panelsSrc), 'константы позиции левой панели удалены (не осталось мёртвого кода)');
    assert(!/this\._pngLeftPanel = leftPanel;/.test(panelsSrc), 'iface._pngLeftPanel больше не присваивается');
    assert(/const PANEL_X_RIGHT = 1042;/.test(panelsSrc), 'правая панель (двор/база/хабар/сводка/задания) не тронута');
}

console.log('\nTest 2: hata.js по-прежнему безопасен без _pngLeftPanel (защитные проверки не убирали)');
{
    const openGuard  = /if\(iface\._pngLeftPanel\)\s+root\.layer2_mc\.addChild\(iface\._pngLeftPanel\);/.test(hataSrc);
    const closeGuard = /if\(iface\._pngLeftPanel\)\s+root\.layer1_mc\.addChild\(iface\._pngLeftPanel\);/.test(hataSrc);
    assert(openGuard && closeGuard, 'hata.js всё ещё оборачивает обращения к _pngLeftPanel в if() — не упадёт, когда его нет');
}

console.log('\nTest 3: старая плашка "СКОРО" (interface-panels.js) УБРАНА — задваивалась с новой');
{
    // 18.10.2026 (баг найден по прямому указанию, снимок редактора позиций — "скоро банда.png
    // задвоился, один убери"): нижний HUD пересобран 17.10.2026 (батч замены сигарет на сухари,
    // interface-bottom-nav.js) и получил СВОЮ плашку "СКОРО" поверх новой кнопки "Банда"
    // (_bottomNavSoonBadge) — старая копия здесь, в interface-panels.js, больше не нужна и
    // убрана, иначе на экране было два значка одновременно. Кнопка по-прежнему некликабельна.
    const start = panelsSrc.indexOf('if(this.down.butt_gangs){');
    const end   = panelsSrc.indexOf('\n        }', start);
    const block = panelsSrc.slice(start, end);
    assert(/this\.down\.butt_gangs\.interactive = false;/.test(block), 'кнопка банды по-прежнему некликабельна (не тронуто)');
    assert(!/new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/скоро банда\.png'\)\)/.test(block),
        'старая плашка "скоро банда.png" больше НЕ создаётся в этом блоке (interface-panels.js)');
    assert(!/gangSoonBadge/.test(panelsSrc), 'переменная gangSoonBadge нигде в файле не осталась (мёртвый код не оставлен)');
}

console.log('\nTest 3b: новая (единственная) плашка "СКОРО" — в interface-bottom-nav.js, центрирована над кнопкой "Банда"');
{
    const navSrc = readSrc('_client/src/game/interface/interface-bottom-nav.js');
    assert(/const soonBadge = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'скоро банда\.png'\)\);/.test(navSrc),
        'плашка создаётся в interface-bottom-nav.js');
    assert(/soonBadge\.x = sprites\.banda\.x;\s*soonBadge\.y = sprites\.banda\.y;/.test(navSrc),
        'позиция плашки берётся динамически от кнопки "Банда" (не захардкожена отдельно — не разъедется при следующей правке координат банды)');
}

console.log('\nTest 4: файл-ассет "скоро банда.png" на месте и совпадает с присланным пользователем скоро.png (MD5)');
{
    const badgePath = path.join(IMAGES_DIR, 'скоро банда.png');
    assert(fs.existsSync(badgePath), 'файл скоро банда.png существует в _client/development/images/');
    const sourcePath = path.join(root, '..', '..', 'скоро.png');
    if(fs.existsSync(sourcePath)){
        const md5 = p => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
        assert(md5(badgePath) === md5(sourcePath), 'скопированный файл побайтово совпадает с присланным скоро.png (не подменён/не искажён при копировании)');
    } else {
        console.log('  ⚠️  исходный C:\\Users\\HONOR\\Desktop\\vk_game\\скоро.png недоступен из окружения теста — пропускаем сверку MD5');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

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

console.log('\nTest 3: кнопка "Банда" получила плашку "СКОРО" на явно заданной позиции (X:465 Y:620)');
{
    const start = panelsSrc.indexOf('if(this.down.butt_gangs){');
    const end   = panelsSrc.indexOf('\n        }', start);
    const block = panelsSrc.slice(start, end);
    assert(/this\.down\.butt_gangs\.interactive = false;/.test(block), 'кнопка банды по-прежнему некликабельна (уже было)');
    assert(/PIXI\.Texture\.from\('\.\/images\/скоро банда\.png'\)/.test(block), 'плашка "скоро банда.png" создаётся именно в блоке butt_gangs');
    // 22.09.2026 (баг найден — "файл СКОРО не отображается"): Y=620 был абсолютной координатой
    // канваса, но gangSoonBadge — ребёнок this.down (this.down.y=596), итоговый рендер уезжал
    // на 596+620=1216 — за пределы холста (720px). Переведено в локальные координаты (620-596=24).
    assert(/gangSoonBadge\.x = 465; gangSoonBadge\.y = 620 - 596;/.test(block),
        'позиция плашки — X:465 (без изменений), Y переведён в локальные координаты this.down (620-596=24)');
    assert(!/gangSoonBadge\.width|gangSoonBadge\.height|gangSoonBadge\.scale/.test(block), 'плашка вставлена в нативном размере, без растяжения (правило проекта)');
    assert(/this\.down\.addChild\(gangSoonBadge\);/.test(block), 'плашка добавляется в тот же контейнер (this.down), где лежит сама кнопка');
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

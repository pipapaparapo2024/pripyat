/**
 * Test: атмосферные звуки Зоны (24.09.2026, по прямому указанию) — 5 звуков по кругу
 * (1→2→3→4→5→1...), проигрываются периодически (с паузой, не подряд, в отличие от
 * dvor-music.js) пока открыт экран Зоны, останавливаются при закрытии — оба пути закрытия
 * (крестик самого экрана и общий _closeAllPanels()).
 *
 * Run: node tests/zone-ambient-sounds-cycle.test.js
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

const ambientSrc = readSrc('_client/src/game/shell/overlays/zone-ambient.js');
const screenSrc  = readSrc('_client/src/game/shell/overlays/zone_screen.js');
const panelsSrc  = readSrc('_client/src/game/interface/interface-panels.js');
const ifaceSrc   = readSrc('_client/src/game/interface.js');

console.log('\nTest: плейлист содержит все 5 звуков в правильном порядке (1,2,3,аномалии 1,2)');
{
    const i1 = ambientSrc.indexOf('звуки зона 1 .mp3');
    const i2 = ambientSrc.indexOf('звуки зона 2.mp3');
    const i3 = ambientSrc.indexOf('звуки зона 3 .mp3');
    const i4 = ambientSrc.indexOf('звуки зона аномалии 1.mp3');
    const i5 = ambientSrc.indexOf('звуки зона аномалии 2 .mp3');
    assert([i1,i2,i3,i4,i5].every(i => i !== -1), 'все 5 файлов присутствуют в TRACKS');
    assert(i1 < i2 && i2 < i3 && i3 < i4 && i4 < i5, 'порядок треков: 1,2,3, аномалии 1, аномалии 2');
}

console.log('\nTest: плейлист зацикливается по модулю длины массива');
{
    assert(/idx\s*=\s*this\._zoneAmbientTrackIdx\s*%\s*TRACKS\.length/.test(ambientSrc),
        'текущий индекс берётся по модулю длины массива — после 5-го звука снова 0 (1-й)');
}

console.log('\nTest: звуки проигрываются С ПАУЗОЙ между собой (через setTimeout), а не подряд как музыка Двора');
{
    assert(/const INTERVAL_MS = 45000;/.test(ambientSrc), 'задан интервал между звуками (45с по умолчанию)');
    assert(/this\._zoneAmbientTimer = setTimeout\(\(\) => this\._playNextZoneAmbient\(\), INTERVAL_MS\);/.test(ambientSrc),
        'следующий звук планируется через setTimeout(INTERVAL_MS), а не запускается сразу по complete');
}

console.log('\nTest: ошибки логируются и не блокируют цикл (error-событие, ошибка загрузки, исключение при play)');
{
    assert(/console\.error\('\[zone-ambient\._playNextZoneAmbient\] не удалось загрузить звук/.test(ambientSrc), 'ошибка загрузки логируется');
    assert(/console\.error\('\[zone-ambient\._playNextZoneAmbient\] ошибка воспроизведения звука/.test(ambientSrc), 'ошибка воспроизведения логируется');
    assert(/console\.error\('\[zone-ambient\._startZoneAmbient\] PIXI\.sound недоступен/.test(ambientSrc), 'отсутствие PIXI.sound логируется явно');
}

console.log('\nTest: экран Зоны запускает атмосферу при открытии и останавливает при закрытии (оба пути)');
{
    const openIdx = screenSrc.indexOf('proto._openZoneScreen = function');
    const openChunk = screenSrc.slice(openIdx, openIdx + 300);
    assert(/this\._startZoneAmbient\(\);/.test(openChunk), '_openZoneScreen() запускает атмосферу');

    const exitIdx = screenSrc.indexOf("exitBtn.on('pointerdown'");
    const exitChunk = screenSrc.slice(exitIdx, exitIdx + 250);
    assert(/this\._stopZoneAmbient\(\);/.test(exitChunk), 'крестик экрана Зоны останавливает атмосферу');

    const closeAllIdx = panelsSrc.indexOf('if(this._zoneWin && this._zoneWin.visible){');
    const closeAllChunk = panelsSrc.slice(closeAllIdx, closeAllIdx + 280);
    assert(/this\._stopZoneAmbient\(\);/.test(closeAllChunk), '_closeAllPanels() тоже останавливает атмосферу при закрытии Зоны через общий путь');
}

console.log('\nTest: interface.js подключает и вызывает attachZoneAmbient');
{
    assert(/import \{ attachZoneAmbient \} from '\.\/shell\/overlays\/zone-ambient\.js';/.test(ifaceSrc), 'import attachZoneAmbient добавлен');
    assert(/attachZoneAmbient\(Interface\.prototype\);/.test(ifaceSrc), 'attachZoneAmbient(Interface.prototype) вызван');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

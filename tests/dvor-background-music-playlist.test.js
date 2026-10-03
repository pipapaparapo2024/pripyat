/**
 * Test: фоновая музыка Двора (24.09.2026, по прямому указанию) — 3 трека по кругу
 * (1→2→3→1→2→3...), запускается при входе в Двор (dvor.open()), останавливается при выходе
 * (dvor.close()). Подробное логирование (ПРАВИЛО №8 CLAUDE.md) на каждом шаге и на каждой
 * ошибке загрузки/воспроизведения, чтобы сбой был виден в консоли, а не тихо обрывал плейлист.
 *
 * Run: node tests/dvor-background-music-playlist.test.js
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

const musicSrc = readSrc('_client/src/game/dvor/dvor-music.js');
const dvorSrc  = readSrc('_client/src/game/dvor.js');

console.log('\nTest: плейлист содержит ровно 3 трека в правильном порядке (1,2,3)');
{
    const idx1 = musicSrc.indexOf('звуки двор 1.mp3');
    const idx2 = musicSrc.indexOf('звуки двор 2.mp3');
    const idx3 = musicSrc.indexOf('звуки двор 3.mp3');
    assert(idx1 !== -1 && idx2 !== -1 && idx3 !== -1, 'все 3 файла присутствуют в списке TRACKS');
    assert(idx1 < idx2 && idx2 < idx3, 'порядок треков в массиве: 1, затем 2, затем 3');
}

console.log('\nTest: плейлист зацикливается по модулю длины массива (1→2→3→1...)');
{
    assert(/idx\s*=\s*this\._dvorMusicTrackIdx\s*%\s*TRACKS\.length/.test(musicSrc),
        'текущий индекс трека берётся по модулю длины массива — после трека 3 снова будет 0 (трек 1)');
}

console.log('\nTest: по завершении трека (complete) плейлист переходит к следующему треку, а не останавливается');
{
    const start = musicSrc.indexOf('proto._playNextDvorTrack = function');
    const end   = musicSrc.indexOf('\n    };', start);
    const body  = musicSrc.slice(start, end);
    assert(!!body && start !== -1, '_playNextDvorTrack() найден');
    assert(/complete:\s*\(\)\s*=>\s*\{/.test(body), 'опция complete передаётся в PIXI.sound.play()');
    assert(/_advance\(\)/.test(body), 'по завершении трека вызывается переход к следующему (_advance)');
}

console.log('\nTest: _startDvorMusic()/_stopDvorMusic() не запускают плейлист повторно и не падают при повторном вызове');
{
    const startFn = musicSrc.slice(musicSrc.indexOf('proto._startDvorMusic = function'), musicSrc.indexOf('proto._stopDvorMusic = function'));
    assert(/if\(this\._dvorMusicPlaying\)\{/.test(startFn), '_startDvorMusic() не перезапускает уже играющий плейлист');
    const stopFn = musicSrc.slice(musicSrc.indexOf('proto._stopDvorMusic = function'), musicSrc.indexOf('proto._playNextDvorTrack = function'));
    assert(/if\(!this\._dvorMusicPlaying\)\{/.test(stopFn), '_stopDvorMusic() безопасен при повторном вызове (музыка уже остановлена)');
}

console.log('\nTest: логирование ошибок — загрузка и воспроизведение обёрнуты try/catch или проверкой err, с console.error');
{
    assert(/console\.error\('\[dvor-music\._playNextDvorTrack\] не удалось загрузить трек/.test(musicSrc),
        'ошибка загрузки трека логируется через console.error');
    assert(/console\.error\('\[dvor-music\._playNextDvorTrack\] ошибка воспроизведения трека/.test(musicSrc),
        'ошибка воспроизведения (исключение) логируется через console.error');
    assert(/console\.error\('\[dvor-music\._startDvorMusic\] PIXI\.sound недоступен/.test(musicSrc),
        'отсутствие PIXI.sound (библиотека не загрузилась) логируется явной ошибкой, а не тихим no-op');
}

console.log('\nTest: ошибка одного трека не блокирует весь плейлист (переходит дальше, не останавливается)');
{
    const loadedCb = musicSrc.slice(musicSrc.indexOf('loaded: (err) => {'), musicSrc.indexOf('});', musicSrc.indexOf('loaded: (err) => {')));
    assert(/if\(err\)\{[\s\S]*?_advance\(\);[\s\S]*?return;/.test(loadedCb),
        'при ошибке загрузки трека вызывается _advance() (переход к следующему), а не return без продолжения плейлиста');
}

console.log('\nTest: музыка использует громкость музыки из настроек (window._musVol), а не звуковых эффектов');
{
    // 24.09.2026 (по прямому указанию, тот же день, другой разговор): пользователь явно
    // разделил категории — "звуки" (Двор/Зона, переключатель ЗВУКИ) vs "музыка" (глобальный
    // плейлист modules/background-music.js, переключатель МУЗЫКА). Несмотря на название файла
    // ("звуки двор *.mp3"), он слушал _musVol — исправлено на _sndVol, см.
    // global-background-music-and-sound-vol-split.test.js для полного покрытия.
    assert(/window\._sndVol/.test(musicSrc), 'громкость читается из window._sndVol (категория "звуки", не "музыка")');
}

console.log('\nTest: dvor.js подключает и вызывает музыку в open()/close()');
{
    assert(/import \{ attachDvorMusic \} from '\.\/dvor\/dvor-music\.js';/.test(dvorSrc), 'import attachDvorMusic добавлен');
    assert(/attachDvorMusic\(Dvor\.prototype\);/.test(dvorSrc), 'attachDvorMusic(Dvor.prototype) вызван');

    const openStart = dvorSrc.indexOf('open(){');
    const openEnd   = dvorSrc.indexOf('\n    close(){', openStart);
    const openBody  = dvorSrc.slice(openStart, openEnd);
    assert(/this\._startDvorMusic\(\);/.test(openBody), 'open() запускает музыку');

    const closeStart = dvorSrc.indexOf('close(){');
    const closeBody  = dvorSrc.slice(closeStart, closeStart + 200);
    assert(/this\._stopDvorMusic\(\);/.test(closeBody), 'close() останавливает музыку');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

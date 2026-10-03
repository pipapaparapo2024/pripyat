/**
 * Test: 25.09.2026, по прямому указанию (жалоба — "музыка на заднем фоне почему-то
 * перемешалась, цикл (1→2→1→2...) сломался; кажется, это связано с тем, что я выключил звук в
 * настройках, подождал, потом включил обратно") —
 *
 * Расследование нашло реальную гонку в ТРЁХ плейлист-модулях (background-music.js,
 * dvor-music.js, zone-ambient.js): watchdog-таймер (или, для zone-ambient — просто
 * задержка-расписание) и НАСТОЯЩИЙ complete/error одного и того же трека могут сработать ОБА,
 * если вкладка какое-то время была в фоне (браузер придушивает таймеры/аудио — типичный триггер
 * именно "выключил/подождал/включил"): первое срабатывание продвигает плейлист на следующий
 * трек, а ВТОРОЕ прилетает ПОЗЖЕ от уже устаревшего трека и либо продвигает плейлист ЕЩЁ РАЗ
 * (задваивая advance — один трек из цикла пропускается), либо (для watchdog) гасит таймер уже
 * СЛЕДУЮЩЕГО легитимно играющего трека, снимая с него защиту от зависания.
 *
 * dvor-music.js уже содержал комментарий "музыка почему-то остановилась" (24.09.2026) —
 * предыдущая попытка почини́ть добавила watchdog как полумеру, не устранив саму гонку (watchdog
 * сам и был второй половиной бага).
 *
 * Фикс — токен поколения (_gen / this._dvorMusicGen / this._zoneAmbientGen): каждый вызов
 * _playNextTrack()/_playNextDvorTrack()/_playNextZoneAmbient() бьёт новый номер СРАЗУ (до
 * загрузки/проигрывания), все closures (complete/error/watchdog/_advance/_scheduleNext)
 * сверяют своё захваченное поколение с текущим глобальным — устаревший вызов молча игнорируется
 * вместо порчи состояния плейлиста.
 *
 * Run: node tests/music-playlist-generation-guard-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bgSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'background-music.js'), 'utf-8');
const dvorSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-music.js'), 'utf-8');
const zoneSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone-ambient.js'), 'utf-8');

console.log('\nTest 1: background-music.js — поколение объявлено, занимается в начале _playNextTrack, ДО complete/error/watchdog');
{
    assert(/let _gen = 0;/.test(bgSrc), '_gen объявлен на уровне модуля');
    const fnStart = bgSrc.indexOf('function _playNextTrack(){');
    const genIdx  = bgSrc.indexOf('const myGen = ++_gen;', fnStart);
    const advIdx  = bgSrc.indexOf('const _advance = ()', fnStart);
    assert(genIdx !== -1 && genIdx < advIdx, 'myGen занимается ДО объявления _advance (значит и до complete/error/watchdog)');
}

console.log('\nTest 2: background-music.js — все три ловушки (complete/error/watchdog) сверяют gen и игнорируют устаревший вызов');
{
    const completeIdx = bgSrc.indexOf('complete: () => {');
    const completeBody = bgSrc.slice(completeIdx, bgSrc.indexOf('},', completeIdx));
    assert(/if\(myGen !== _gen\)\{/.test(completeBody), 'complete проверяет myGen !== _gen');

    const errorIdx = bgSrc.indexOf("_instance.on('error'");
    const errorBody = bgSrc.slice(errorIdx, errorIdx + 400);
    assert(/if\(myGen !== _gen\)\{/.test(errorBody), 'error проверяет myGen !== _gen');

    const wdIdx = bgSrc.indexOf('_watchdog = setTimeout(() => {');
    const wdBody = bgSrc.slice(wdIdx, wdIdx + 400);
    assert(/if\(myGen !== _gen\)\{/.test(wdBody), 'watchdog проверяет myGen !== _gen');

    const advBody = bgSrc.slice(bgSrc.indexOf('const _advance = () => {'), bgSrc.indexOf('};', bgSrc.indexOf('const _advance = () => {')));
    assert(/if\(myGen !== _gen\)\{/.test(advBody), '_advance тоже проверяет myGen !== _gen (защита в глубине, не только у вызывающих)');
}

console.log('\nTest 3: dvor-music.js — то же самое поколение per-instance (this._dvorMusicGen), не модульная переменная (несколько экранов Двора не должны делить состояние)');
{
    assert(/const myGen = \(this\._dvorMusicGen = \(this\._dvorMusicGen \|\| 0\) \+ 1\);/.test(dvorSrc),
        'myGen читает/пишет this._dvorMusicGen (per-instance, не глобальная переменная модуля)');
    const completeIdx = dvorSrc.indexOf('complete: () => {');
    const completeBody = dvorSrc.slice(completeIdx, dvorSrc.indexOf('},', completeIdx));
    assert(/if\(myGen !== this\._dvorMusicGen\)\{/.test(completeBody), 'complete проверяет this._dvorMusicGen');
    const wdIdx = dvorSrc.indexOf('this._dvorMusicWatchdog = setTimeout(() => {');
    const wdBody = dvorSrc.slice(wdIdx, wdIdx + 400);
    assert(/if\(myGen !== this\._dvorMusicGen\)\{/.test(wdBody), 'watchdog проверяет this._dvorMusicGen');
}

console.log('\nTest 4: zone-ambient.js — то же поколение (this._zoneAmbientGen), _scheduleNext тоже защищён (нет watchdog, но есть та же гонка через complete/error)');
{
    assert(/const myGen = \(this\._zoneAmbientGen = \(this\._zoneAmbientGen \|\| 0\) \+ 1\);/.test(zoneSrc),
        'myGen читает/пишет this._zoneAmbientGen');
    const schedBody = zoneSrc.slice(zoneSrc.indexOf('const _scheduleNext = () => {'), zoneSrc.indexOf('};', zoneSrc.indexOf('const _scheduleNext = () => {')));
    assert(/if\(myGen !== this\._zoneAmbientGen\)\{/.test(schedBody), '_scheduleNext проверяет this._zoneAmbientGen');
    const completeIdx = zoneSrc.indexOf('complete: () => {');
    const completeBody = zoneSrc.slice(completeIdx, zoneSrc.indexOf('},', completeIdx));
    assert(/if\(myGen !== this\._zoneAmbientGen\)\{/.test(completeBody), 'complete проверяет this._zoneAmbientGen');
}

console.log('\nTest 5: регресс-гвард — старая функциональность (2/3/5 треков по кругу, fade-in звука зоны, применение громкости) не тронута');
{
    assert(/'\.\/sounds\/музыка задний фон 1\.mp3',/.test(bgSrc) && /'\.\/sounds\/музыка задний фон 2\.mp3',/.test(bgSrc), 'background-music.js — оба трека на месте');
    assert(/'\.\/sounds\/звуки двор 1\.mp3',/.test(dvorSrc) && /'\.\/sounds\/звуки двор 3\.mp3',/.test(dvorSrc), 'dvor-music.js — все 3 трека на месте');
    assert(/const FADE_IN_TRACK_IDX = 2;/.test(zoneSrc) && /const FADE_IN_DURATION_MS = 30000;/.test(zoneSrc), 'zone-ambient.js — fade-in звука idx=2 не тронут');
    assert(/applyAudioVolumes\(\);/.test(bgSrc), 'applyAudioVolumes() по-прежнему вызывается перед проигрыванием (background-music.js)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

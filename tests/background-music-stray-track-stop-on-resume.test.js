/**
 * Test: батч 17.10.2026 — повторный репорт "музыка двоится" ПОСЛЕ фикса 06.10.2026 (тот фикс
 * закрыл гонку watchdog'а, тикающего по wall-clock, пока приложение свёрнуто — см.
 * комментарий у pauseBackgroundMusicWatchdog()/_pauseApp в app-lifecycle.js). Репорт пришёл
 * снова на том же сценарии ("зашёл в игру, свернул вкладку, зашёл обратно") — значит, остаётся
 * ДРУГОЙ путь к тому же симптому: обычный complete ТЕКУЩЕГО трека может долететь, пока вкладка
 * ещё в фоне (WebAudio-события не так жёстко заморожены браузером, как setTimeout) — _advance()
 * легитимно запускает СЛЕДУЮЩИЙ трек ещё в фоне, а когда вкладка возвращается,
 * PIXI.sound.resumeAll() снимает паузу с ОБОИХ Sound-объектов разом (resumeAll глобальный, не
 * завязан на то, какой алиас сейчас "актуальный" по мнению _trackIdx/_dvorMusicTrackIdx) —
 * старый трек оживает ПАРАЛЛЕЛЬНО с новым.
 *
 * Фикс — не разбирать внутренности pixi-sound (3rd-party, минифицирован), а подстраховаться на
 * уровне приложения: в момент возврата из фона (resumeBackgroundMusicWatchdog() /
 * _resumeDvorMusicWatchdog(), которые и так вызываются ИМЕННО в этот момент из app-lifecycle.js)
 * явно останавливать Sound-объект КАЖДОГО алиаса плейлиста, который не является текущим и при
 * этом сам считает себя играющим (sound.isPlaying) — убивает симптом независимо от того, какой
 * именно внутренний путь гонки его вызвал. В норме посторонних играющих алиасов нет — функция
 * тогда ничего не делает, обычное поведение не меняется.
 *
 * Применено к обоим "плейлист без пауз" каналам — global background-music.js (2 трека) и
 * dvor-music.js (3 трека). zone-ambient.js НЕ тронут — там между звуками всегда пауза
 * (INTERVAL_MS=45с), то же состояние гонки там намного менее вероятно физически (complete
 * одного трека и старт следующего разделены интервалом, а не идут подряд), и отдельного
 * репорта по Зоне не было — если он появится, тот же приём применяется по аналогии.
 *
 * Run: node tests/background-music-stray-track-stop-on-resume.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bgSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'background-music.js'), 'utf-8');
const dvorSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-music.js'), 'utf-8');

console.log('\nTest 1: background-music.js — _stopStrayTracks существует, проверяет isPlaying, не трогает активный индекс');
{
    const start = bgSrc.indexOf('function _stopStrayTracks(activeIdx){');
    const end   = bgSrc.indexOf('\nexport function resumeBackgroundMusicWatchdog', start);
    assert(start !== -1, '_stopStrayTracks определена');
    const body = bgSrc.slice(start, end);
    assert(/if\(i === activeIdx\) continue;/.test(body), 'активный индекс пропускается — не останавливает сам себя');
    assert(/const alias = 'bg_music_' \+ i;/.test(body), 'перебирает алиасы по тому же паттерну именования, что и обычный плейлист');
    assert(/PIXI\.sound\.exists\(alias\)/.test(body), 'проверяет exists() перед find() — алиас может быть ещё не зарегистрирован (трек ни разу не играл)');
    assert(/stray && stray\.isPlaying/.test(body), 'останавливает ТОЛЬКО если чужой Sound реально считает себя играющим (не трогает молчащие/ещё не загруженные алиасы)');
    assert(/stray\.stop\(\);/.test(body), 'вызывает stop() на найденном дублирующемся треке');
}

console.log('\nTest 2: resumeBackgroundMusicWatchdog вызывает _stopStrayTracks ДО перевзведения сторож-таймера');
{
    const start = bgSrc.indexOf('export function resumeBackgroundMusicWatchdog(){');
    const end   = bgSrc.indexOf('\nexport function stopBackgroundMusic', start);
    const body  = bgSrc.slice(start, end);
    const callIdx  = body.indexOf('_stopStrayTracks(idx);');
    const watchIdx = body.indexOf('_watchdog = setTimeout');
    assert(callIdx !== -1, '_stopStrayTracks(idx) вызывается внутри resumeBackgroundMusicWatchdog');
    assert(callIdx !== -1 && watchIdx !== -1 && callIdx < watchIdx, '_stopStrayTracks вызывается ДО перевзведения watchdog-таймера');
}

console.log('\nTest 3: dvor-music.js — тот же приём, те же гарантии (3 трека вместо 2)');
{
    const start = dvorSrc.indexOf('const _stopStrayDvorTracks = (activeIdx) => {');
    const end   = dvorSrc.indexOf('\n    proto._resumeDvorMusicWatchdog', start);
    assert(start !== -1, '_stopStrayDvorTracks определена');
    const body = dvorSrc.slice(start, end);
    assert(/if\(i === activeIdx\) continue;/.test(body), 'активный индекс плейлиста Двора пропускается');
    assert(/const alias = 'dvor_music_' \+ i;/.test(body), 'перебирает алиасы dvor_music_* (не bg_music_* — отдельный независимый плейлист)');
    assert(/stray && stray\.isPlaying/.test(body), 'останавливает только реально играющий чужой трек');
    assert(/stray\.stop\(\);/.test(body), 'вызывает stop() на дублирующемся треке Двора');

    const resumeStart = dvorSrc.indexOf('proto._resumeDvorMusicWatchdog = function(){');
    const resumeEnd   = dvorSrc.indexOf('\n    proto._stopDvorMusic', resumeStart);
    const resumeBody  = dvorSrc.slice(resumeStart, resumeEnd);
    const callIdx  = resumeBody.indexOf('_stopStrayDvorTracks(idx);');
    const watchIdx = resumeBody.indexOf('this._dvorMusicWatchdog = setTimeout');
    assert(callIdx !== -1 && watchIdx !== -1 && callIdx < watchIdx, '_stopStrayDvorTracks вызывается ДО перевзведения watchdog-таймера Двора');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 24.10.2026 (по прямому указанию — два репорта в один день):
 *
 * 1) "При обучении предыдущий MP3-файл не останавливается при переходе на новый шаг."
 *    Корень (прочитан живьём в _client/development/libs/pixi-sound.js): Sound.prototype.play()
 *    возвращает Promise (не реальный инстанс с .stop()), если alias ещё не isLoaded. Это
 *    происходит в onboarding.js._playNarration() при ПОВТОРНОМ вызове с ТЕМ ЖЕ alias, пока
 *    первая загрузка этого же mp3 ещё не завершилась (PIXI.sound.exists(alias) уже true —
 *    alias зарегистрирован, но isLoaded ещё false) — например ONBOARDING_EXTRA_SOUNDS.idle,
 *    переигрываемый таймером простоя, или быстрый повторный клик по шагу с тем же звуком.
 *    _stopNarration() проверял typeof this._narrationInstance.stop === 'function' — у Promise
 *    такого метода нет, проверка тихо пропускала стоп, а сам звук потом стартовал сам (autoPlay),
 *    без всякой связи с this._narrationInstance — остановить было нечем.
 *    Фикс: остановка идёт через САМ объект Sound по alias (PIXI.sound.find(alias).stop()) —
 *    его stop() корректно обрабатывает оба случая (ещё грузится → снимает autoPlay; уже играет →
 *    останавливает все инстансы), подтверждено чтением исходника библиотеки. Тот же приём, что
 *    modules/background-music.js._stopStrayTracks().
 *
 * 2) "Регулирую громкость — озвучка обучения не реагирует."
 *    Корень: onboarding.js._playNarration() слал жёстко volume:1 в PIXI.sound.play(), игнорируя
 *    слайдеры "звук"/"музыка" (window._sndVol/_musVol). modules/audio-volumes.js.
 *    applyAudioVolumes() (вызывается слайдером в реальном времени на каждое перетаскивание —
 *    это само по себе работает корректно для bg_music_/dvor_music_/zone_ambient_, см. другие
 *    звуковые каналы) вообще не знал про озвучку обучения — её alias'ы динамические
 *    ('onboarding_' + url файла), их нельзя перечислить фиксированным count, как остальные 3
 *    группы. Фикс: _playNarration() берёт текущий _sndVol при каждом play(); applyAudioVolumes()
 *    дополнительно проходит по PIXI.sound._sounds и применяет _sndVol ко всем alias'ам с
 *    префиксом 'onboarding_' — живое обновление громкости работает и во время уже играющей
 *    реплики.
 *
 * Run: node tests/oct24-onboarding-sound-stop-and-volume-slider.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = (p) => fs.readFileSync(p, 'utf-8');

console.log('\nTest 1: onboarding.js — _narrationAlias отслеживается наравне с _narrationInstance');
{
    const src = norm(path.join(root, '_client/src/game/onboarding.js'));
    assert(/this\._narrationInstance = null;\s*\n\s*this\._narrationAlias = null;\s*\n\s*this\._narrationUrl = null;\s*\n\s*this\._pendingIdleNarration = false;/.test(src),
        'constructor инициализирует this._narrationAlias = null рядом с _narrationInstance/_narrationUrl');
    assert(/this\._narrationAlias = alias;/.test(src), '_playNarration() сохраняет alias в this._narrationAlias');
}

console.log('\nTest 2: onboarding.js — _stopNarration() останавливает по alias через PIXI.sound.find(), не через возможно-Promise this._narrationInstance');
{
    const src = norm(path.join(root, '_client/src/game/onboarding.js'));
    const start = src.indexOf('_stopNarration(){');
    const body = src.slice(start, src.indexOf('\n    }\n', start));
    assert(!/this\._narrationInstance && typeof this\._narrationInstance\.stop === 'function'/.test(body),
        'старая проверка typeof(...).stop === \'function\' на this._narrationInstance убрана (не ловила Promise-случай)');
    assert(/if\(this\._narrationAlias && PIXI\.sound\.exists\(this\._narrationAlias\)\)\{/.test(body),
        'проверяет наличие alias в PIXI.sound перед остановкой');
    assert(/PIXI\.sound\.find\(this\._narrationAlias\)\.stop\(\);/.test(body),
        'останавливает через сам объект Sound (PIXI.sound.find(alias).stop()) — корректно обрабатывает и "ещё грузится", и "уже играет"');
    assert(/this\._narrationAlias = null;/.test(body), '_stopNarration() сбрасывает this._narrationAlias');
}

console.log('\nTest 3: onboarding.js — _playNarration() больше не шлёт захардкоженную volume:1, читает текущий _sndVol');
{
    const src = norm(path.join(root, '_client/src/game/onboarding.js'));
    const start = src.indexOf('_playNarration(url, onComplete){');
    const body = src.slice(start, src.indexOf('\n    }\n', start));
    assert(!/volume:\s*1,/.test(body), 'захардкоженная volume:1 убрана из тела _playNarration()');
    assert(/const vol = window\._sndVol !== undefined \? window\._sndVol : 0\.7;/.test(body),
        'volume читается из window._sndVol (с тем же дефолтом 0.7, что и слайдер "звук" в sound.js)');
    assert(/volume: vol,/.test(body), 'PIXI.sound.play() получает текущий vol, не константу');
}

console.log('\nTest 4: modules/audio-volumes.js — applyAudioVolumes() теперь покрывает динамические onboarding_*-alias\'ы');
{
    const src = norm(path.join(root, '_client/src/modules/audio-volumes.js'));
    assert(/const sndVol = window\._sndVol !== undefined \? window\._sndVol : 0\.7;/.test(src),
        'sndVol вынесен в переменную (переиспользуется и для dvor/zone, и для onboarding)');
    assert(/if\(PIXI\.sound\._sounds\)\{/.test(src), 'проверяет наличие внутренней карты PIXI.sound._sounds перед обходом');
    assert(/Object\.keys\(PIXI\.sound\._sounds\)\.forEach\(\(alias\) => \{/.test(src), 'перебирает ВСЕ зарегистрированные alias\'ы (не фиксированный список, как остальные 3 группы)');
    assert(/if\(alias\.indexOf\('onboarding_'\) === 0\) PIXI\.sound\.find\(alias\)\.volume = sndVol;/.test(src),
        'применяет sndVol ко всем alias\'ам с префиксом onboarding_ (та же группа "звук", что dvor/zone)');
}

console.log('\nTest 5: modules/audio-volumes.js — старые 3 группы (bg_music_/dvor_music_/zone_ambient_) не regression-сломаны переносом на sndVol-переменную');
{
    const src = norm(path.join(root, '_client/src/modules/audio-volumes.js'));
    assert(/\['bg_music_', 2, window\._musVol !== undefined \? window\._musVol : 0\.5\],/.test(src), 'bg_music_ по-прежнему слушает _musVol, не sndVol');
    assert(/\['dvor_music_', 3, sndVol\],/.test(src), 'dvor_music_ теперь ссылается на переменную sndVol (эквивалент прежнего inline-выражения)');
    assert(/\['zone_ambient_', 5, sndVol\],/.test(src), 'zone_ambient_ теперь ссылается на переменную sndVol (эквивалент прежнего inline-выражения)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

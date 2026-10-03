/**
 * Test: батч 24.09.2026 (по прямому указанию — "закинь музыка задний фон 1/2.mp3 на сервер,
 * играй зациклено 1→2→1→2..., везде, с момента открытия главного экрана").
 *
 * Пользователь пояснил архитектуру: "музыка" (music slider, window._musVol) и "звуки" (sound
 * slider, window._sndVol) — два разных канала. dvor-music.js ("звуки двор *.mp3") и
 * zone-ambient.js (эмбиент Зоны) концептуально относятся к "звукам", но слушали _musVol —
 * баг, найден при разборе. Новый глобальный плейлист (modules/background-music.js) — это
 * настоящая "музыка", слушает _musVol, запускается один раз из game-boot.js._finishLoading()
 * (момент, когда главный экран реально становится виден игроку) и играет непрерывно везде.
 *
 * Run: node tests/global-background-music-and-sound-vol-split.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const musicSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'background-music.js'), 'utf-8');
const bootSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf-8');
const dvorMusicSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-music.js'), 'utf-8');
const zoneAmbientSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone-ambient.js'), 'utf-8');

console.log('\nTest 1: background-music.js — плейлист из 2 треков в правильном порядке, слушает _musVol');
{
    assert(/'\.\/sounds\/музыка задний фон 1\.mp3',\s*\n\s*'\.\/sounds\/музыка задний фон 2\.mp3',/.test(musicSrc),
        'TRACKS = [трек1, трек2] в правильном порядке');
    assert(/const vol   = window\._musVol !== undefined \? window\._musVol : 0\.5;/.test(musicSrc),
        'КРИТИЧНО: слушает _musVol (регулятор МУЗЫКИ), не _sndVol — это музыка, а не звук');
    assert(/idx\s*=\s*_trackIdx % TRACKS\.length/.test(musicSrc), 'зацикливание по модулю длины плейлиста (1→2→1→2...)');
    assert(/export function startBackgroundMusic\(\)/.test(musicSrc) && /export function stopBackgroundMusic\(\)/.test(musicSrc),
        'экспортирует start/stop');
}

console.log('\nTest 2: game-boot.js запускает startBackgroundMusic() в _finishLoading() (момент реального появления главного экрана)');
{
    assert(/import \{ startBackgroundMusic \} from '\.\.\/modules\/background-music\.js';/.test(bootSrc), 'импортирует startBackgroundMusic');
    const m = bootSrc.match(/const _finishLoading = \(\) => \{([\s\S]*?)\n        \};/);
    assert(!!m, '_finishLoading найдена');
    const body = m ? m[1] : '';
    assert(/startBackgroundMusic\(\);/.test(body), 'КРИТИЧНО: вызывает startBackgroundMusic() внутри _finishLoading');
    const clonHideIdx = body.indexOf("_clo.style.display = 'none';");
    const musicIdx = body.indexOf('startBackgroundMusic();');
    assert(clonHideIdx !== -1 && musicIdx !== -1 && musicIdx > clonHideIdx,
        'запуск музыки идёт ПОСЛЕ скрытия компаса/прелоадера — тот самый момент появления главного экрана');
}

console.log('\nTest 3: dvor-music.js и zone-ambient.js теперь слушают _sndVol (звуки), а не _musVol (музыка)');
{
    assert(/const vol   = window\._sndVol !== undefined \? window\._sndVol : 0\.7;/.test(dvorMusicSrc),
        'dvor-music.js слушает _sndVol');
    assert(!/const vol   = window\._musVol/.test(dvorMusicSrc), 'dvor-music.js регресс-гвард: больше не слушает _musVol');

    assert(/const vol   = window\._sndVol !== undefined \? window\._sndVol : 0\.7;/.test(zoneAmbientSrc),
        'zone-ambient.js слушает _sndVol');
    assert(!/const vol   = window\._musVol/.test(zoneAmbientSrc), 'zone-ambient.js регресс-гвард: больше не слушает _musVol');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

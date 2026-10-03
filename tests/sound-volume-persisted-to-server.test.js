/**
 * Test: 24.09.2026, по прямому указанию — "настройки звука/музыки (попап настройки звука) не
 * сохраняются после перезагрузки". Раньше window._sndVol/_musVol были ЧИСТО оперативной
 * памятью вкладки (sound.js) — нигде не писались в udata, поэтому общий 500мс-дебаунс
 * автосейва их не подхватывал, и после reload громкость всегда откатывалась к дефолтам.
 *
 * Фикс: новые обычные (не server-only) поля udata — snd_vol/mus_vol. sound.js пишет их при
 * любом изменении ползунка (реал-тайм drag, ПОДТВЕРДИТЬ, откат по ОТМЕНА) — обычный автосейв
 * подхватывает и шлёт на сервер. preloader.js.onGetUserInfo() восстанавливает
 * window._sndVol/_musVol из udata['snd_vol']/udata['mus_vol'] сразу как реальные данные
 * приходят с сервера. Миграция — server/migrate31.php (ALTER TABLE ADD COLUMN).
 *
 * Run: node tests/sound-volume-persisted-to-server.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const soundSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'sound.js'), 'utf-8');
const preloaderSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'preloader.js'), 'utf-8');
const usersPhpSrc   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const migrationSrc  = fs.readFileSync(path.join(root, 'server', 'migrate31.php'), 'utf-8');

console.log('\nTest 1: snd_vol/mus_vol в client-writable whitelist $allowed users.php');
{
    assert(/'snd_vol', 'mus_vol',/.test(usersPhpSrc), 'snd_vol и mus_vol добавлены в whitelist');
}

console.log('\nTest 2: миграция 31 добавляет обе колонки с разумными дефолтами');
{
    assert(/'snd_vol'\s*=>\s*"VARCHAR\(8\) DEFAULT '0\.7'"/.test(migrationSrc), 'snd_vol: VARCHAR(8) DEFAULT 0.7 (тот же дефолт, что уже был в JS-фолбэке)');
    assert(/'mus_vol'\s*=>\s*"VARCHAR\(8\) DEFAULT '0\.5'"/.test(migrationSrc), 'mus_vol: VARCHAR(8) DEFAULT 0.5');
    assert(/stalker_migrate31_2026/.test(migrationSrc), 'миграция защищена секретным ключом (тот же паттерн, что migrate19-21)');
}

console.log('\nTest 3: sound.js пишет udata[snd_vol]/udata[mus_vol] в реальном времени (setVol) и при откате (ОТМЕНА)');
{
    const setVolIdx = soundSrc.indexOf('const setVol = (idx, gx) => {');
    const setVolEnd = soundSrc.indexOf('\n\t\t};', setVolIdx);
    const setVolBody = soundSrc.slice(setVolIdx, setVolEnd);
    assert(/udata\['snd_vol'\] = String\(soundVol\); udata\['mus_vol'\] = String\(musicVol\);/.test(setVolBody),
        'setVol() пишет оба поля в udata на каждое движение ползунка (подхватит общий автосейв)');

    const otmenaIdx = soundSrc.indexOf("otmenaHit.on('pointerup'");
    const otmenaEnd = soundSrc.indexOf('});', otmenaIdx);
    const otmenaBody = soundSrc.slice(otmenaIdx, otmenaEnd);
    assert(/udata\['snd_vol'\] = String\(soundVol\); udata\['mus_vol'\] = String\(musicVol\);/.test(otmenaBody),
        'ОТМЕНА тоже пишет откаченные значения в udata (иначе следующая перезагрузка вернула бы отменённое значение)');
}

console.log('\nTest 4: preloader.js восстанавливает window._sndVol/_musVol из udata при первом получении реальных данных');
{
    const m = preloaderSrc.match(/onGetUserInfo\(data\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'onGetUserInfo найдена');
    const body = m ? m[1] : '';
    const udataSetIdx = body.indexOf('window.udata = window.wrapPlayerData(_raw);');
    const sndReadIdx  = body.indexOf("if(udata['snd_vol'] !== undefined) window._sndVol = parseFloat(udata['snd_vol']);");
    const musReadIdx  = body.indexOf("if(udata['mus_vol'] !== undefined) window._musVol = parseFloat(udata['mus_vol']);");
    assert(sndReadIdx !== -1 && sndReadIdx > udataSetIdx, 'window._sndVol восстанавливается ПОСЛЕ того, как udata стал реальным объектом');
    assert(musReadIdx !== -1 && musReadIdx > udataSetIdx, 'window._musVol восстанавливается аналогично');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

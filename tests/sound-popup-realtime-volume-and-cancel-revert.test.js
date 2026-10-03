/**
 * Test: 24.09.2026, по прямому указанию — "звук/музыка должны менять своё звучание в реальном
 * времени, а не после 'применить'" (попап настроек звука/музыки, sound.js).
 *
 * Разбор показал: setVol() (вызывается и при перетаскивании бегунка, и при клике по дорожке)
 * раньше только двигала визуальный бегунок и перерисовывала заливку — window._sndVol/_musVol
 * (реальные значения, которые читает PIXI.sound через applyAudioVolumes()) менялись ТОЛЬКО
 * внутри обработчика кнопки «ПОДТВЕРДИТЬ». Играющая музыка/звуки никак не реагировали на
 * перетаскивание ползунка, пока не нажата «ПОДТВЕРДИТЬ».
 *
 * Фикс: setVol() применяет громкость сразу (window._sndVol/_musVol + applyAudioVolumes()).
 * Из-за этого «ОТМЕНА» перестала быть no-op'ом (раньше она ничего не трогала, т.к. глобальные
 * переменные ещё не были тронуты) — теперь она обязана явно ОТКАТИТЬ громкость назад к
 * значению НА МОМЕНТ ОТКРЫТИЯ попапа. Это значение хранится как win._openedSoundVol/
 * win._openedMusicVol (свойство на объекте окна, не const в замыкании) — важно, что попап
 * кэшируется (открытие #2+ просто выставляет visible=true, не пересобирая), поэтому снимок
 * должен обновляться КАЖДЫЙ раз при открытии, а не только при первой сборке — иначе «ОТМЕНА»
 * при втором открытии откатывала бы к значениям с самого первого открытия вообще.
 *
 * Run: node tests/sound-popup-realtime-volume-and-cancel-revert.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'sound.js'), 'utf-8'
);

console.log('\nTest 1: setVol() применяет громкость сразу (не дожидаясь ПОДТВЕРДИТЬ)');
{
    const m = src.match(/const setVol = \(idx, gx\) => \{([\s\S]*?)\n\t\t\};/);
    assert(!!m, 'setVol найдена');
    const body = m ? m[1] : '';
    assert(/window\._sndVol = soundVol;/.test(body), 'setVol пишет window._sndVol сразу при движении ползунка');
    assert(/window\._musVol = musicVol;/.test(body), 'setVol пишет window._musVol сразу при движении ползунка');
    assert(/if\(window\.PIXI && PIXI\.sound\) applyAudioVolumes\(\);/.test(body), 'setVol зовёт applyAudioVolumes() сразу — играющий звук/музыка реально меняют громкость на лету');
}

console.log('\nTest 2: снимок "на момент открытия" хранится на win (не в const замыкания) — переживает кэшированное повторное открытие');
{
    assert(/win\._openedSoundVol = soundVol;/.test(src), 'снимок звука пишется как свойство win, не const');
    assert(/win\._openedMusicVol = musicVol;/.test(src), 'снимок музыки пишется как свойство win, не const');
    // Ранний return (попап уже собран, просто показываем) тоже обязан обновить снимок —
    // иначе второе открытие отменяло бы к значениям с САМОГО ПЕРВОГО открытия.
    const earlyReturnIdx = src.indexOf('if(this._soundWin){');
    const earlyReturnEnd = src.indexOf('return;', earlyReturnIdx);
    const earlyReturnBody = src.slice(earlyReturnIdx, earlyReturnEnd);
    assert(/this\._soundWin\._openedSoundVol = window\._sndVol/.test(earlyReturnBody),
        'ранний return (кэшированный попап) тоже обновляет _openedSoundVol свежим значением при каждом открытии');
    assert(/this\._soundWin\._openedMusicVol = window\._musVol/.test(earlyReturnBody),
        'ранний return тоже обновляет _openedMusicVol');
}

console.log('\nTest 3: ОТМЕНА реально откатывает громкость назад (раньше была no-op, т.к. глобалы ещё не менялись до подтверждения)');
{
    const otmenaIdx = src.indexOf("otmenaHit.on('pointerup'");
    const otmenaEnd = src.indexOf('});', otmenaIdx);
    const body = src.slice(otmenaIdx, otmenaEnd);
    assert(/window\._sndVol = win\._openedSoundVol;/.test(body), 'ОТМЕНА возвращает window._sndVol к значению на момент открытия');
    assert(/window\._musVol = win\._openedMusicVol;/.test(body), 'ОТМЕНА возвращает window._musVol к значению на момент открытия');
    assert(/if\(window\.PIXI && PIXI\.sound\) applyAudioVolumes\(\);/.test(body), 'ОТМЕНА зовёт applyAudioVolumes() — откат реально слышен, а не только в памяти');
    assert(/handles\[0\]\.x = TRK_X \+ Math\.round\(soundVol \* TRK_W\);/.test(body), 'ОТМЕНА визуально откатывает бегунок звука назад');
    assert(/handles\[1\]\.x = TRK_X \+ Math\.round\(musicVol \* TRK_W\);/.test(body), 'ОТМЕНА визуально откатывает бегунок музыки назад');
}

console.log('\nTest 4: регресс-гвард — ПОДТВЕРДИТЬ по-прежнему применяет и закрывает (безвредно дублирует то, что setVol уже применил)');
{
    const potvIdx = src.indexOf("potvHit.on('pointerup'");
    const potvEnd = src.indexOf('});', potvIdx);
    const body = src.slice(potvIdx, potvEnd);
    assert(/window\._sndVol = soundVol;/.test(body) && /window\._musVol = musicVol;/.test(body),
        'ПОДТВЕРДИТЬ всё ещё пишет актуальные значения (не сломан)');
    assert(/win\.visible = false;/.test(body), 'ПОДТВЕРДИТЬ закрывает попап');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

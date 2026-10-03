/**
 * Test: батч 24.09.2026 (по прямому указанию — "сделай прелоадер анимацию зацикленной чтобы
 * она повторялась когда заканчивается").
 *
 * Раньше (22.09.2026, тоже по прямому указанию) ролик preloader.mp4 по окончании прятался
 * (display:none) и вместо него показывался статичный компас загрузки (#_clo), пока игра не
 * готова. Новая явная просьба напрямую отменяет это — ролик должен зацикленно повторяться
 * (не нативным vid.loop, а перезапуском в 'ended', чтобы убрать прелоадер точно на чистой
 * границе цикла после готовности игры, а не разорвать посередине кадра).
 *
 * Run: node tests/preloader-video-loops-until-game-ready.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'preloader-visual.js'), 'utf-8');

console.log('\nTest 1: обработчик \'ended\' перезапускает ролик, пока игра не готова (а не прячет видео/показывает компас)');
{
    const m = src.match(/vid\.addEventListener\('ended', \(\) => \{([\s\S]*?)\n    \}\);/);
    assert(!!m, 'обработчик ended найден');
    const body = m ? m[1] : '';
    assert(/vid\.currentTime = 0;/.test(body), 'КРИТИЧНО: перематывает ролик на начало для повтора');
    assert(/vid\.play\(\)\.catch/.test(body), 'КРИТИЧНО: снова запускает воспроизведение (цикл)');
    assert(!/vid\.style\.display = 'none';/.test(body), 'регресс-гвард: видео больше НЕ прячется по окончании клипа');
    assert(!/_showCompass\(\)/.test(body), 'регресс-гвард: статичный компас загрузки больше не подменяет видео');
}

console.log('\nTest 2: прелоадер всё ещё убирается, когда игра готова (на границе цикла, не обрывая ролик)');
{
    const m = src.match(/vid\.addEventListener\('ended', \(\) => \{([\s\S]*?)\n    \}\);/);
    const body = m ? m[1] : '';
    assert(/if\(_gameDone\)\{/.test(body), 'проверяет готовность игры при каждом завершении цикла');
    assert(/_remove\(\);/.test(body), 'вызывает удаление прелоадера, когда игра готова');
}

console.log('\nTest 3: window._preloaderVideoReady() больше не пытается убрать прелоадер немедленно — ждёт следующей границы цикла ролика');
{
    const m = src.match(/window\._preloaderVideoReady = \(\) => \{([^}]*)\};/);
    assert(!!m, 'window._preloaderVideoReady найден');
    const body = m ? m[1] : '';
    assert(/_gameDone = true;/.test(body), 'выставляет флаг готовности');
    assert(!/_tryRemove\(\)|_remove\(\)/.test(body), 'НЕ дёргает удаление сразу — иначе видео обрывалось бы посередине кадра вместо чистой границы цикла');
}

console.log('\nTest 4: диагностический таймер 30с существует, но БОЛЬШЕ НЕ обрывает цикл принудительно');
// 27.09.2026 (баг по прямому указанию — "анимация играет пару раз и гаснет, хотя данные ещё
// грузятся"): раньше этот таймер после 30с ПРИНУДИТЕЛЬНО вызывал _remove() независимо от
// готовности игры — на медленной сети реальная загрузка (VK API + текстуры + фоновые модули)
// легко превышает 30с, а короткий ролик успевал отыграть цикл несколько раз ("пара раз") до
// этого момента → таймер обрывал видео до готовности игры, оставляя чёрный экран. Теперь
// таймер только пишет диагностику в консоль, цикл 'ended' продолжает крутить ролик, пока
// window._preloaderVideoReady() реально не выставит _gameDone.
{
    assert(/30000/.test(src), 'диагностический таймер на 30000мс присутствует');
    const m = src.match(/const _failsafeTid = setTimeout\(\(\) => \{([\s\S]*?)\n    \}, 30000\);/);
    assert(!!m, 'тело таймера 30000мс найдено');
    const body = m ? m[1] : '';
    assert(!/_remove\(\);/.test(body), 'КРИТИЧНО: таймер больше НЕ вызывает _remove() — прелоадер не должен гаснуть по таймеру, только по реальной готовности игры');
    assert(/console\.warn/.test(body), 'таймер оставляет диагностику в консоли вместо принудительного скрытия');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

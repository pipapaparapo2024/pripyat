/**
 * Test: батч 24.09.2026 (по прямому указанию — "сделай прелоадер анимацию зацикленной чтобы
 * она повторялась когда заканчивается").
 *
 * Раньше (22.09.2026, тоже по прямому указанию) ролик preloader.mp4 по окончании прятался
 * (display:none) и вместо него показывался статичный компас загрузки (#_clo), пока игра не
 * готова. Новая явная просьба напрямую отменяет это — прелоадер должен зацикленно повторяться
 * и убираться точно на чистой границе цикла после готовности игры, а не разорвать посередине.
 *
 * 08.10.2026 (по прямому указанию — "замени прелоадер на новый, который тебе скинули, не
 * зацикливай старый"): video (preloader.mp4) заменён на Spine-анимацию (Preloader.atlas/.webp +
 * preloader.json, см. preloader-visual.js). Механизм зацикливания изменился — Spine сам крутит
 * анимацию в цикле (AnimationState.setAnimation(0, name, true), третий аргумент loop=true), не
 * нужен ручной перезапуск, как было с vid.currentTime=0+play() на 'ended'. Но КОНТРАКТ "не
 * убирать прелоадер, пока игра не готова, и только на чистой границе цикла" — тот же: вместо
 * видео-события 'ended' используется Spine-событие 'complete' у AnimationState (стреляет на
 * каждой чистой границе цикла, даже при loop:true).
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

console.log('\nTest 1: анимация зациклена Spine-ом напрямую (loop=true), без ручного перезапуска — регресс-гвард на старую видео-логику');
{
    assert(/state\.setAnimation\(0, animName, true\);/.test(src), 'КРИТИЧНО: loop=true передан третьим аргументом setAnimation — Spine сам повторяет цикл');
    assert(!/vid\.currentTime = 0;/.test(src), 'регресс-гвард: старая ручная перемотка видео убрана целиком');
    assert(!/vid\.style\.display = 'none';/.test(src), 'регресс-гвард: видео больше НЕ прячется по окончании клипа (старая механика)');
    assert(!/<video/.test(src) && !/document\.createElement\('video'\)/.test(src), 'регресс-гвард: <video> элемент больше не создаётся — заменён на <canvas>');
}

// 08.10.2026 (тем же днём, ВТОРОЙ Spine-экспорт — см. preloader-visual-remove-on-ready.test.js
// за полный разбор): ожидание чистой границы цикла через Spine-событие 'complete' САМО оказалось
// багом — "любая заминка внутри Spine-рантайма держала бы прелоадер на экране бесконечно, даже
// когда игра давно готова". Контракт "не убирать прелоадер раньше готовности" остался, но
// "именно на границе цикла" — сознательно убрано; обрыв на произвольном кадре не заметен
// визуально благодаря fade 0.5s в _remove().
console.log('\nTest 2: прелоадер убирается СРАЗУ по готовности игры, не дожидаясь границы цикла — ожидание \'complete\' убрано как источник зависания');
{
    assert(!/complete: \(\) => \{/.test(src),
        "обработчик 'complete' у state.addListener убран — реальное удаление больше не ждёт границы цикла анимации");
    assert(!/_gameDone\s*=|if\s*\(_gameDone\)|let _gameDone/.test(src),
        'флаг _gameDone как переменная убран из исполняемого кода (слово может остаться только в тексте комментария про СТАРЫЙ подход)');
}

console.log('\nTest 3: window._preloaderVisualReady() убирает прелоадер НАПРЯМУЮ и немедленно, без промежуточного флага');
{
    assert(/window\._preloaderVisualReady = \(\) => \{ _remove\(\); \};/.test(src),
        'window._preloaderVisualReady() (переименован из _preloaderVideoReady) вызывает _remove() сразу');
}

console.log('\nTest 4: диагностический таймер 30с существует, но БОЛЬШЕ НЕ обрывает цикл принудительно');
// 27.09.2026 (баг по прямому указанию — "анимация играет пару раз и гаснет, хотя данные ещё
// грузятся"): раньше этот таймер после 30с ПРИНУДИТЕЛЬНО вызывал _remove() независимо от
// готовности игры — на медленной сети реальная загрузка (VK API + текстуры + фоновые модули)
// легко превышает 30с. Тот же принцип перенесён без изменений на Spine-версию 08.10.2026: таймер
// только пишет диагностику в консоль, цикл продолжает крутиться, пока
// window._preloaderVisualReady() реально не выставит _gameDone.
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

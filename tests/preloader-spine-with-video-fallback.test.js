/**
 * Test: батч 22.09.2026 (по прямому указанию — "верни видеоанимацию, которая была раньше") —
 * Spine-анимация на загрузочном экране (Preloader.atlas/Preloader.webp/preloader.json) убрана
 * ПОЛНОСТЬЮ, не оставлена мёртвым кодом. Прелоадер снова всегда показывает preloader.mp4,
 * с зацикливанием последних TAIL_SEC секунд, если ролик доигрался, а игра ещё не готова.
 *
 * Run: node tests/preloader-spine-with-video-fallback.test.js
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

const indexSrc      = readSrc('_client/src/index.js');
const preloaderSrc  = readSrc('_client/src/modules/preloader-visual.js');

console.log('\nTest 1: index.js делегирует визуал прелоадера в отдельный модуль, старый inline-video убран');
{
    assert(/import \{ startPreloaderVisual \} from '\.\/modules\/preloader-visual\.js';/.test(indexSrc),
        'index.js импортирует startPreloaderVisual()');
    assert(/startPreloaderVisual\(\);/.test(indexSrc), 'index.js вызывает startPreloaderVisual()');
    assert(!/const vid = document\.createElement\('video'\);/.test(indexSrc),
        'старый inline video-код убран из index.js (перенесён в модуль)');
}

console.log('\nTest 2: preloader-visual.js — Spine убран полностью, не оставлен мёртвым кодом');
{
    assert(!/_startSpinePreloader/.test(preloaderSrc), 'ни определения, ни вызовов _startSpinePreloader() не осталось');
    assert(!/window\.spine/.test(preloaderSrc), 'обращений к window.spine (Spine runtime) больше нет');
    assert(!/TextureAtlas|SkeletonJson|AnimationStateData|SkeletonRenderer/.test(preloaderSrc),
        'spine-ts API (TextureAtlas/SkeletonJson/AnimationStateData/SkeletonRenderer) в файле не встречается');
    assert(!/_preloader_spine/.test(preloaderSrc), 'canvas-элемент #_preloader_spine больше не создаётся');
}

console.log('\nTest 3: preloader-visual.js — видео запускается сразу и безусловно, а не как фолбэк из spine-ветки');
{
    assert(/export function startPreloaderVisual\(\)\{/.test(preloaderSrc), 'startPreloaderVisual() определена');
    assert(/const vid = document\.createElement\('video'\);/.test(preloaderSrc), 'video-элемент создаётся прямо в теле startPreloaderVisual()');
    assert(/vid\.src = '\.\/preloader\.mp4';/.test(preloaderSrc), 'источник — preloader.mp4');
    assert(/document\.body\.appendChild\(vid\);/.test(preloaderSrc), 'video добавляется в DOM без каких-либо условий/попыток spine до него');
}

// 22.09.2026 (повторная правка того же дня, по прямому указанию — "видео зациклено, сделай
// так чтобы в конце был просто чёрный экран и компас загрузки"): зацикливание хвоста (TAIL_SEC)
// убрано целиком — вместо него видео пряталось, а вместо него показывался обычный компас
// загрузки (#_clo), пока игра не станет готова.
//
// 24.09.2026 (тот же день, другой разговор, по прямому указанию — "сделай прелоадер анимацию
// зацикленной чтобы она повторялась когда заканчивается"): компас-фолбэк из абзаца выше
// убран — ролик снова зацикливается (полным повтором, не только хвостом TAIL_SEC), пока игра
// не готова, и только тогда убирается на чистой границе цикла. См.
// preloader-video-loops-until-game-ready.test.js для полного покрытия актуального поведения.
console.log('\nTest 4: preloader-visual.js — ролик зациклен полным повтором (не нативным loop, не TAIL_SEC-хвостом)');
{
    assert(!/vid\.loop\s*=\s*true;/.test(preloaderSrc), 'нативный loop=true НЕ используется (нужно событие ended для чистой границы убирания)');
    assert(!/const TAIL_SEC/.test(preloaderSrc), 'константа TAIL_SEC (код зацикливания только хвоста) отсутствует — зацикливается ролик целиком');
    assert(!/vid\.currentTime = Math\.max\(0, vid\.duration/.test(preloaderSrc), 'перемотка на ХВОСТ ролика (старый TAIL_SEC-приём) не используется');
    assert(/vid\.currentTime = 0;/.test(preloaderSrc), 'вместо этого — перемотка на САМОЕ НАЧАЛО (полный повтор)');
}

console.log('\nTest 5: preloader-visual.js — по окончании ролика без готовой игры повторяет ролик (компас-фолбэк убран)');
{
    const start = preloaderSrc.indexOf("vid.addEventListener('ended', () => {");
    const end   = preloaderSrc.indexOf('\n    });', start);
    const body  = preloaderSrc.slice(start, end);
    assert(/if\(_gameDone\)\{/.test(body), 'если игра уже готова — убирает прелоадер на этой чистой границе цикла');
    assert(/vid\.currentTime = 0;/.test(body) && /vid\.play\(\)\.catch/.test(body),
        'если игра ещё не готова — перематывает на начало и снова запускает воспроизведение (цикл)');
    assert(!/vid\.style\.display = 'none';/.test(body), 'видео больше НЕ прячется по окончании клипа — оно продолжает играть');
    assert(!/_showCompass\(\);/.test(body), 'компас-фолбэк по окончании клипа убран — ролик просто повторяется');

    assert(!/const _showCompass = /.test(preloaderSrc), '_showCompass() удалена целиком — этому файлу компас больше не нужен');
    assert(!/const _hideCompass = /.test(preloaderSrc), '_hideCompass() удалена целиком — та же причина');
}

// 24.09.2026: убирание прелоадера больше не завязано на отдельный флаг "ролик доиграл"
// (_videoEnded убран целиком) — раз ролик теперь ЗАЦИКЛЕН, "доиграл ли он" перестало быть
// осмысленным вопросом. Вместо этого window._preloaderVideoReady() просто выставляет
// _gameDone, а реальное убирание (_remove()) происходит на СЛЕДУЮЩЕЙ чистой границе цикла
// (внутри обработчика 'ended', Test 5 выше) — тот же принцип "не обрывать кадр посередине".
console.log('\nTest 6: preloader-visual.js — window._preloaderVideoReady() только выставляет флаг готовности, не убирает прелоадер сразу');
{
    assert(/window\._preloaderVideoReady = \(\) => \{ _gameDone = true; \};/.test(preloaderSrc),
        'window._preloaderVideoReady() только выставляет _gameDone — реальное убирание ждёт границы цикла');
    assert(!/_videoEnded/.test(preloaderSrc), 'отдельный флаг _videoEnded убран целиком — зацикленному ролику он не нужен');
    assert(/function _remove\(\)\{\s*\n\s*if\(_removed\) return;/.test(preloaderSrc),
        '_remove() (была _tryRemove()) теперь требует только !_removed — условие "ролик доиграл" сняли за ненадобностью');
    assert(/vid\.addEventListener\('error', \(\) => \{ _remove\(\); \}\);/.test(preloaderSrc),
        'ошибка воспроизведения видео сразу убирает прелоадер — не виснет молча');
}

// 27.09.2026 (баг по прямому указанию — "анимация прелоадера играет пару раз и гаснет, хотя
// данные ещё грузятся"): 30-секундный таймер раньше форсировал _remove() независимо от
// готовности игры. На медленной сети (полная цепочка VK API + JSON + текстуры + 16 фоновых
// модулей, см. game-boot.js) реальная загрузка легко превышает 30с, а короткий ролик успевал
// отыграть цикл несколько раз ("пара раз") до этого момента — таймер обрывал видео ДО
// готовности игры, оставляя чёрный экран посреди загрузки. Прямое указание: прелоадер обязан
// крутиться бесконечно и скрываться ТОЛЬКО по реальной готовности данных — без стороннего
// условия остановки. Таймер больше не убирает прелоадер, только пишет диагностику в консоль
// (см. preloader-video-loops-until-game-ready.test.js Test 4 для полного покрытия).
console.log('\nTest 7: preloader-visual.js — диагностический таймер 30с БОЛЬШЕ НЕ форсирует убирание прелоадера');
{
    const m = preloaderSrc.match(/const _failsafeTid = setTimeout\(\(\) => \{([\s\S]*?)\n    \}, 30000\);/);
    assert(!!m, 'таймер на 30000мс найден');
    const body = m ? m[1] : '';
    assert(!/_remove\(\);/.test(body), 'КРИТИЧНО: таймер больше НЕ вызывает _remove() — прелоадер не гаснет по таймеру, только по реальной готовности игры');
    assert(/console\.warn/.test(body), 'таймер оставляет диагностику в консоли вместо принудительного скрытия');
    assert(!/\}, 9000\);/.test(preloaderSrc), 'старый 9-секундный таймаут не остался нигде в файле');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

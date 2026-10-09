/**
 * Test: батч 22.09.2026 (по прямому указанию — "верни видеоанимацию, которая была раньше") —
 * Spine-анимация на загрузочном экране была убрана ПОЛНОСТЬЮ в пользу video (preloader.mp4).
 *
 * 08.10.2026 (по прямому указанию — "замени прелоадер на новый, который тебе скинули, не
 * зацикливай старый"): РЕШЕНИЕ ОТ 22.09.2026 ЯВНО ОТМЕНЕНО. Пользователь прислал НОВУЮ
 * Spine-анимацию прелоадера (обновлённый preloader.json поверх уже существовавших
 * Preloader.atlas/.webp) и прямо попросил использовать именно её вместо video. video-ветка
 * теперь убрана целиком (тем же способом, каким раньше убирали Spine-ветку) — этот файл
 * проверяет ОБРАТНОЕ исходному названию: что video отсутствует, а Spine — основной и
 * единственный механизм. Имя файла сохранено ради истории/git blame, не переименовано.
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

console.log('\nTest 1: index.js делегирует визуал прелоадера в отдельный модуль, подключение не изменилось');
{
    assert(/import \{ startPreloaderVisual \} from '\.\/modules\/preloader-visual\.js';/.test(indexSrc),
        'index.js импортирует startPreloaderVisual()');
    assert(/startPreloaderVisual\(\);/.test(indexSrc), 'index.js вызывает startPreloaderVisual()');
}

console.log('\nTest 2: preloader-visual.js — video (preloader.mp4) убран полностью, не оставлен мёртвым кодом');
{
    assert(!/document\.createElement\('video'\)/.test(preloaderSrc), '<video>-элемент больше не создаётся');
    // preloader.mp4 упоминается только в историческом докблоке файла (что заменили и почему) —
    // не в исполняемом коде, поэтому не проверяем полное отсутствие строки в файле целиком.
    assert(!/vid\.currentTime|vid\.play\(\)|vid\.loop/.test(preloaderSrc), 'video-специфичный API (currentTime/play/loop) не встречается');
    assert(!/addEventListener\('ended'/.test(preloaderSrc), "видео-событие 'ended' убрано — у Spine свой 'complete'");
}

console.log('\nTest 3: preloader-visual.js — Spine запускается сразу и безусловно (основной механизм, не фолбэк)');
{
    assert(/export function startPreloaderVisual\(\)\{/.test(preloaderSrc), 'startPreloaderVisual() определена');
    assert(/const cv = document\.createElement\('canvas'\);/.test(preloaderSrc), 'canvas-элемент создаётся прямо в теле startPreloaderVisual()');
    assert(/document\.body\.appendChild\(cv\);/.test(preloaderSrc), 'canvas добавляется в DOM без условий');
    assert(/window\.spine/.test(preloaderSrc), 'обращение к window.spine (Spine runtime, libs/spine-canvas.js) присутствует');
    assert(/TextureAtlas|SkeletonJson|AnimationStateData|SkeletonRenderer/.test(preloaderSrc),
        'spine-ts API (TextureAtlas/SkeletonJson/AnimationStateData/SkeletonRenderer) используется');
    assert(/SPINE_DIR = '\.\/spine\/';/.test(preloaderSrc), "путь './spine/' — тот же, что у прелоадера в AGENTS.md (Spine-анимации боссов)");
    assert(/'Preloader_v2\.atlas'/.test(preloaderSrc) && /'preloader_v2\.json'/.test(preloaderSrc),
        'грузит именно второй присланный экспорт: Preloader_v2.atlas + preloader_v2.json');
}

console.log('\nTest 4: preloader-visual.js — анимация зациклена через Spine loop=true (не ручным перезапуском, как было у видео)');
{
    assert(/state\.setAnimation\(0, animName, true\);/.test(preloaderSrc), 'loop=true передан Spine напрямую — повтор цикла не требует ручного кода');
}

// 08.10.2026 (тем же днём, ВТОРОЙ Spine-экспорт — см. preloader-visual-remove-on-ready.test.js
// за полный докблок): ожидание Spine-события 'complete' (чистая граница цикла) оказалось багом —
// "держала бы прелоадер на экране бесконечно", если внутри рантайма случится заминка/ошибка на
// каждый кадр. Заменено на немедленное удаление по сигналу готовности, без ожидания границы цикла
// (обрыв анимации на произвольном кадре визуально не заметен — у _remove() есть fade 0.5s).
console.log('\nTest 5: preloader-visual.js — НЕТ больше ожидания границы цикла (Spine-событие complete) — убрано как источник зависания прелоадера');
{
    assert(!/complete: \(\) => \{/.test(preloaderSrc),
        "обработчик complete у state.addListener убран — реальное удаление больше не ждёт границы цикла анимации");
    assert(!/_gameDone\s*=|if\s*\(_gameDone\)|let _gameDone/.test(preloaderSrc),
        'флаг _gameDone как переменная убран из исполняемого кода (слово может остаться только в тексте комментария про СТАРЫЙ подход)');
}

console.log('\nTest 6: preloader-visual.js — window._preloaderVisualReady() убирает прелоадер НАПРЯМУЮ и немедленно');
{
    assert(/window\._preloaderVisualReady\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,300}?_remove\(\);/.test(preloaderSrc),
        'window._preloaderVisualReady() вызывает _remove() сразу, без промежуточного флага/ожидания цикла');
    assert(/function _remove\(\)\{\s*\n\s*if\(_removed\) return;/.test(preloaderSrc),
        '_remove() требует только !_removed');
    assert(/img\.onerror = \(\) => \{[\s\S]*?_remove\(\);/.test(preloaderSrc),
        'ошибка загрузки Spine-текстуры сразу убирает прелоадер — не виснет молча (тот же принцип, что раньше был у video error)');
}

// 27.09.2026 (баг по прямому указанию — "анимация прелоадера играет пару раз и гаснет, хотя
// данные ещё грузятся"): 30-секундный таймер раньше форсировал _remove() независимо от
// готовности игры. Принцип перенесён без изменений на Spine-версию 08.10.2026.
console.log('\nTest 7: preloader-visual.js — диагностический таймер 30с БОЛЬШЕ НЕ форсирует убирание прелоадера');
{
    const m = preloaderSrc.match(/const _failsafeTid = setTimeout\(\(\) => \{([\s\S]*?)\n    \}, 30000\);/);
    assert(!!m, 'таймер на 30000мс найден');
    const body = m ? m[1] : '';
    assert(!/_remove\(\);/.test(body), 'КРИТИЧНО: таймер больше НЕ вызывает _remove() — прелоадер не гаснет по таймеру, только по реальной готовности игры');
    assert(/console\.warn/.test(body), 'таймер оставляет диагностику в консоли вместо принудительного скрытия');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

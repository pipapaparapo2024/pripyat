/**
 * Test: репорт 08.10.2026 — "если загрузка прошла, прелоадер должен заканчиваться, а не висеть
 * чёрным экраном". Раньше window._preloaderVisualReady() только выставляла флаг _gameDone,
 * а реальное скрытие (_remove()) ждало события 'complete' от Spine AnimationState (границы
 * цикла looping-анимации). Любая заминка внутри самого Spine-рантайма (ошибка в update/apply/
 * draw, которая каждый кадр ловится try/catch и просто логируется, не останавливая requestAnimationFrame,
 * но и не давая 'complete' сработать) держала бы прелоадер на экране бесконечно, даже когда игра
 * давно готова. Фикс — убирать сразу по сигналу готовности, не дожидаясь границы цикла анимации.
 *
 * Run: node tests/preloader-visual-remove-on-ready.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'modules', 'preloader-visual.js'), 'utf-8'
);

console.log('\nTest 1: window._preloaderVisualReady вызывает _remove() напрямую, не просто флаг');
{
    assert(/window\._preloaderVisualReady\s*=\s*\(\)\s*=>\s*\{\s*_remove\(\);\s*\}/.test(src),
        'window._preloaderVisualReady = () => { _remove(); } — немедленное скрытие по сигналу готовности');
    assert(!/let _gameDone/.test(src),
        'переменная _gameDone убрана целиком (больше не нужна — _remove() не ждёт флага)');
}

console.log('\nTest 2: скрытие БОЛЬШЕ НЕ зависит от события \'complete\' AnimationState');
{
    assert(!/complete:\s*\(\)\s*=>/.test(src),
        'listener на событие complete убран — _remove() не ждёт границы цикла анимации');
    assert(!/addListener/.test(src),
        'state.addListener(...) не используется вовсе');
}

console.log('\nTest 3: _remove() по-прежнему делает плавный fade и сигналит _onPreloaderHidden (контракт с index.js не сломан)');
{
    assert(/function _remove\(\)/.test(src), '_remove() определена');
    assert(/cv\.style\.opacity\s*=\s*'0'/.test(src), 'плавный fade (opacity→0) сохранён — обрыв анимации на произвольном кадре визуально не заметен');
    assert(/window\._onPreloaderHidden/.test(src), 'window._onPreloaderHidden() по-прежнему вызывается из _remove()');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

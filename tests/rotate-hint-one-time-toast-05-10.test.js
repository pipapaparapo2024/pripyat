/**
 * Test: 05.10.2026, по прямому указанию ("сообщение перевернуть телефон для начала игры"),
 * уточнено в разговоре: НЕ блокирующий экран — CSS-автоповорот (modules/forced-landscape.js,
 * 03.10.2026) остаётся как был, добавляется только одноразовая подсказка-тост при первом
 * обнаружении портретной ориентации на мобильном (modules/rotate-hint.js).
 *
 * Платформа (ВК/ОК/другая): пользователь прямо спросил, нужны ли отдельные тесты под ОК для
 * мобильной адаптации — ЗДЕСЬ НЕТ, подсказка завязана ТОЛЬКО на window.isMobile (UA/touch, см.
 * modules/mobile-viewport.js) и vp.portrait (реальная ориентация устройства) — ни то ни другое
 * не зависит от площадки (VK/ОК рендерят один и тот же бандл в iframe, площадка определяется
 * отдельным модулем modules/platform.js, который rotate-hint.js не импортирует и не вызывает
 * вообще, см. Test 3). Это тот редкий случай, когда тесты ДЕЙСТВИТЕЛЬНО одинаковы для всех
 * площадок, потому что код ни разу не ветвится по платформе.
 *
 * Run: node tests/rotate-hint-one-time-toast-05-10.test.js
 */
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

// Минимальный мок DOM — ровно то, что реально использует rotate-hint.js (createElement/
// appendChild/getElementById/querySelector не нужен). Каждый созданный элемент — простой
// объект с .style (plain object, не CSSStyleDeclaration) и .children-трекингом через parentNode.
function makeFakeDocument(){
    const created = [];
    function makeEl(){
        const el = {
            style: {},
            children: [],
            parentNode: null,
            appendChild(child){ child.parentNode = el; el.children.push(child); },
            removeChild(child){ el.children = el.children.filter(c => c !== child); child.parentNode = null; },
        };
        Object.defineProperty(el, 'innerHTML', { get(){ return el._html || ''; }, set(v){ el._html = v; } });
        return el;
    }
    const body = makeEl();
    const head = makeEl();
    return {
        createElement(){ const el = makeEl(); created.push(el); return el; },
        body, head,
        getElementById(id){ return created.find(e => e.id === id && e.parentNode) || null; },
        _created: created,
    };
}

function makeCtx(){
    const doc = makeFakeDocument();
    const timers = [];
    const rafQueue = [];
    const ctx = {
        document: doc,
        console,
        setTimeout: (fn, ms) => { const id = timers.length; timers.push({ fn, ms, id }); return id; },
        clearTimeout: (id) => { const t = timers.find(t => t.id === id); if(t) t.fn = null; },
        requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    };
    vm.createContext(ctx);
    return { ctx, doc, timers, rafQueue };
}

const src = read('_client/src/modules/rotate-hint.js')
    .replace(/^export (function|const)/gm, '$1')
    .replace(/^import .*$/gm, '');

console.log('\nTest 1: showRotateHintOnce() реально создаёт тост в document.body при первом вызове');
{
    const { ctx, doc } = makeCtx();
    vm.runInContext(src, ctx);
    assert(doc.body.children.length === 0, 'до вызова тоста в body нет');
    ctx.showRotateHintOnce();
    assert(doc.body.children.length === 1, 'после вызова ровно один элемент добавлен в body');
    const el = doc.body.children[0];
    assert(el.id === '_rotateHint', 'у тоста ожидаемый id (для getElementById/_resetRotateHintForTests)');
    assert(/горизонтальное положение/.test(el.innerHTML), 'текст подсказки реально про горизонтальное положение, не заглушка');
    assert(/можно играть и так/.test(el.innerHTML), 'текст явно говорит, что игра играбельна и без поворота (не звучит как требование/блокер)');
}

console.log('\nTest 2: повторные вызовы showRotateHintOnce() в той же сессии — НИЧЕГО не делают (resize() вызывается много раз подряд)');
{
    const { ctx, doc } = makeCtx();
    vm.runInContext(src, ctx);
    ctx.showRotateHintOnce();
    ctx.showRotateHintOnce();
    ctx.showRotateHintOnce();
    assert(doc.body.children.length === 1, 'тост создан РОВНО один раз, несмотря на 3 вызова подряд');
}

console.log('\nTest 3: rotate-hint.js НЕ зависит от площадки (ВК/ОК/другая) — нет импорта platform.js, нет isOk()/isVk()');
{
    assert(!/platform\.js/.test(src), 'модуль platform.js не импортируется');
    assert(!/isOk\(\)|isVk\(\)/.test(src), 'нет платформенного ветвления — поведение одинаково для всех площадок');
}

console.log('\nTest 4: _resetRotateHintForTests() реально снимает одноразовый флаг (сам тест-хелпер работает)');
{
    const { ctx, doc } = makeCtx();
    vm.runInContext(src, ctx);
    ctx.showRotateHintOnce();
    assert(doc.body.children.length === 1, 'первый показ создал тост');
    ctx._resetRotateHintForTests();
    ctx.showRotateHintOnce();
    assert(doc.body.children.filter(e => e.id === '_rotateHint').length === 1,
        'после сброса флага новый вызов снова создаёт тост (не залипает в "уже показано" навсегда)');
}

console.log('\nTest 5: index.js — showRotateHintOnce() вызывается именно внутри ветки needsRotate (мобильный + портрет), не всегда');
{
    const indexSrc = read('_client/src/index.js');
    assert(/import \{ showRotateHintOnce \} from '\.\/modules\/rotate-hint\.js';/.test(indexSrc),
        'index.js импортирует showRotateHintOnce()');
    const start = indexSrc.indexOf('if(needsRotate){');
    const end = indexSrc.indexOf('} else {', start);
    const body = indexSrc.slice(start, end);
    assert(/showRotateHintOnce\(\);/.test(body), 'вызов находится внутри if(needsRotate){...} — не в else-ветке и не снаружи resize()');
    assert(/applyRotatedCanvasStyle\(canv, vp\)/.test(body), 'CSS-автоповорот (forced-landscape.js) остаётся в той же ветке без изменений — подсказка ДОПОЛНЯЕТ его, не заменяет');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

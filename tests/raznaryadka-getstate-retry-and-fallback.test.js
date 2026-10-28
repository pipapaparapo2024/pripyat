/**
 * Test: 28.10.2026, по прямому указанию — "надписи выполнения (ВЫПОЛНИ N ЗАДАНИЙ) и суммы наград
 * пропадают при форсировании ноября". Расследование (код + SSH-логи тестового сервера) не
 * подтвердило точную причину отказа raznaryadka.getState в момент репродукции — ни серверный лог,
 * ни присланная консоль браузера не содержали релевантной ошибки. Корень: весь статичный попап
 * (фон/календарь/кнопка выхода) строится в _build() независимо от сервера, а суммы/подписи наград
 * заполняются ТОЛЬКО в _render(), вызываемом из успешного колбэка _fetchState() — при ЛЮБОМ отказе
 * getState попап оставался на экране, но все динамические тексты так и оставались пустыми, без
 * единой подсказки игроку.
 *
 * Фикс (пока первопричина не поймана живьём) — один автоматический повтор через 1.5с, и если
 * повтор тоже не удался — видимый fallback-текст в самом попапе с возможностью повторить по клику
 * (вместо вечной тишины). Реальное исполнение (vm) — не просто текстовый grep.
 *
 * Run: node tests/raznaryadka-getstate-retry-and-fallback.test.js
 */
const fs  = require('fs');
const path = require('path');
const vm  = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nTest 1: регресс-гвард по тексту — retry/fallback-механизм на месте');
{
    const src = readSrc('_client/src/game/shell/overlays/raznaryadka.js');
    assert(/_fetchState\(isRetry\)\{/.test(src), '_fetchState принимает isRetry');
    assert(/_onFetchStateFail\(isRetry\)\{/.test(src), '_onFetchStateFail(isRetry) определён');
    assert(/setTimeout\(\(\) => \{ if\(this\._win\) this\._fetchState\(true\); \}, 1500\);/.test(src),
        'первая неудача планирует ОДИН повтор через 1.5с, с проверкой что попап ещё открыт');
    assert(/this\._showFetchFailText\(\);/.test(src), 'повторная неудача показывает fallback-текст');
    assert(/this\._hideFetchFailText\(\);/.test(src), 'успешный ответ прячет fallback-текст');
    assert(/fetchFailTxt\.on\('pointerdown', \(\) => \{ this\._hideFetchFailText\(\); this\._fetchState\(\); \}\);/.test(src),
        'клик по fallback-тексту прячет его и запускает НОВУЮ попытку (isRetry сбрасывается — повторный цикл retry разрешён заново)');
}

console.log('\nTest 2: реальное исполнение (vm) — первая неудача НЕ показывает fallback сразу, планирует повтор');
console.log('Test 3: вторая (повторная) неудача показывает fallback-текст и уведомление');
console.log('Test 4: клик по fallback-тексту скрывает его и триггерит новый запрос; успешный ответ рендерит состояние без исключений');
{
    let src = readSrc('_client/src/game/shell/overlays/raznaryadka.js');
    src = src.replace(/^import .*$\n?/gm, '');
    src = src.replace('export default class Raznaryadka', 'class Raznaryadka');
    src += '\nmodule.exports = Raznaryadka;\n';

    function makeNode(){
        const n = {
            x: 0, y: 0, alpha: 1, visible: true, interactive: false, buttonMode: false,
            scale: { set(){} }, width: 10, height: 10,
            texture: { width: 10, height: 10, once(){} },
            anchor: { set(){} },
            children: [],
            _handlers: {},
            on(evt, fn){ this._handlers[evt] = fn; return this; },
            addChild(...kids){ this.children.push(...kids); return kids[0]; },
            removeChild(k){ this.children = this.children.filter(x => x !== k); },
            beginFill(){ return this; }, endFill(){ return this; }, lineStyle(){ return this; },
            drawRect(){ return this; }, drawRoundedRect(){ return this; }, clear(){ return this; },
        };
        return n;
    }
    const PIXI = {
        Container: function(){ return makeNode(); },
        Graphics: function(){ return makeNode(); },
        Sprite: function(tex){ const s = makeNode(); s.texture = tex || s.texture; return s; },
        Text: function(text, style){ const t = makeNode(); t.text = text; t.style = Object.assign({}, style); return t; },
        Texture: { from: (url) => ({ url, width: 10, height: 10 }) },
    };

    let getStateCalls = [];
    const TS = {
        php(method, params, onOk, onErr){
            if(method !== 'raznaryadka.getState') return;
            getStateCalls.push({ onOk, onErr });
        },
    };
    let applyPatchCalls = 0;
    function applyPatch(){ applyPatchCalls++; }
    let notifyCalls = [];
    const notify = { showResult(opts){ notifyCalls.push(opts); } };
    let scheduled = [];
    function fakeSetTimeout(fn, ms){ scheduled.push({ fn, ms }); return scheduled.length; }
    const root2 = { layer2_mc: { addChild(){} } };
    const helper = { touchPad(){} };

    const sandbox = {
        console, PIXI, TS, applyPatch, notify, helper,
        window: { isMobile: false, notify, iface: null },
        root: root2,
        setTimeout: fakeSetTimeout,
        setInterval: () => 0, clearInterval(){}, clearTimeout(){},
        module: { exports: {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const Raznaryadka = sandbox.module.exports;

    const inst = new Raznaryadka();
    inst._build();
    assert(!!inst._fetchFailTxt, 'fetchFailTxt создан в _build()');
    assert(inst._fetchFailTxt.visible === false, 'fetchFailTxt изначально скрыт');

    // Первый вызов (из open(), здесь зовём напрямую) — сервер отвечает ошибкой.
    inst._fetchState();
    assert(getStateCalls.length === 1, 'первый запрос getState ушёл');
    getStateCalls[0].onErr({ code: 99 });
    assert(inst._fetchFailTxt.visible === false, 'ПОСЛЕ ПЕРВОЙ неудачи fallback-текст ещё НЕ показан (сначала тихий повтор)');
    assert(scheduled.length === 1 && scheduled[0].ms === 1500, 'повтор запланирован ровно через 1.5с');
    assert(notifyCalls.length === 0, 'уведомление об ошибке ещё не показано на первой неудаче');

    // Срабатывает запланированный повтор — сервер ОПЯТЬ отвечает ошибкой.
    scheduled[0].fn();
    assert(getStateCalls.length === 2, 'повторный запрос getState реально ушёл (isRetry=true)');
    getStateCalls[1].onErr({ code: 99 });
    assert(inst._fetchFailTxt.visible === true, 'ПОСЛЕ ВТОРОЙ (повторной) неудачи fallback-текст показан');
    assert(notifyCalls.length === 1 && /недоступен/.test(notifyCalls[0].text), 'уведомление показано один раз на повторной неудаче');

    // Игрок кликает по fallback-тексту — текст скрывается, уходит НОВЫЙ запрос (не isRetry).
    inst._fetchFailTxt._handlers.pointerdown();
    assert(inst._fetchFailTxt.visible === false, 'клик по fallback-тексту скрывает его немедленно');
    assert(getStateCalls.length === 3, 'клик по fallback-тексту запускает новый запрос getState');

    // На этот раз сервер отвечает успешно — _render() отрабатывает без исключений.
    const fakeState = {
        patch: {}, month: '2026-11', day_today: 5, days_in_month: 30,
        days: { 5: { status: 'pending' } }, today: { label: 'Задание', need: 1, prog: 0, done: false },
        done_count: 2, pay_costs: {}, reset_in_ms: 1000, pre_launch: false,
        reward_tiers: [
            { need: 2, icon: 'coins', amt: 30, eligible: true, claimed: false },
            { need: 30, icon: 'chest', amt: 130, eligible: false, claimed: false },
        ],
    };
    let threw = null;
    try { getStateCalls[2].onOk(fakeState); } catch(e){ threw = e; }
    assert(threw === null, 'успешный ответ после fallback обрабатывается без исключений (_render реально отрабатывает на 31 плитке + 2 строках наград)');
    assert(applyPatchCalls === 1, 'applyPatch вызван с патчем успешного ответа');
    assert(inst._fetchFailTxt.visible === false, 'fallback-текст скрыт после успешного ответа (_hideFetchFailText)');
    assert(inst._doneHeaderTxt.text === 'ВЫПОЛНЕНО ЗАДАНИЙ 2/30', 'реальные данные реально дошли до рендера (не осталась пустая строка)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

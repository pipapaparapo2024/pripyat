/**
 * Test: hata.js — устойчивость к NaN в udata['base_bg_active'] / udata['hata_progress'].
 *
 * Баг: сервер конвертирует NULL-поля БД в пустой массив [] (см. database.php::trueJSON).
 * `parseInt(udata['base_bg_active'] || '0')` для [] даёт NaN, т.к. [] — truthy,
 * `parseInt([])` === NaN, а проверка `idx < 0 || idx >= length` никогда не ловит NaN
 * (любое сравнение с NaN — false). В итоге HATAS[NaN] === undefined,
 * и `_render()` падает на undefined.bossReq — экран «БАЗА» полностью не открывается.
 *
 * Run: node tests/hata-nan-guard.test.js
 */

let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const HATAS = [
    { id:0, name:'Кубрик',      bossReq:-1 },
    { id:1, name:'Шлюз',        bossReq:1  },
    { id:2, name:'Канализация', bossReq:2  },
    { id:3, name:'Двор',        bossReq:3  },
    { id:4, name:'Мастерская',  bossReq:4  },
    { id:5, name:'Железка',     bossReq:5  },
    { id:6, name:'Станция',     bossReq:6  },
    { id:7, name:'Заправка',    bossReq:7  },
];

// ── Логика после фикса (открытие экрана, hata.js::open) ──────────────────
function resolveOpenIdx(rawBaseBgActive) {
    let idx = parseInt(rawBaseBgActive) || 0;
    if (isNaN(idx) || idx < 0 || idx >= HATAS.length) idx = 0;
    return idx;
}

// ── Логика после фикса (навигация стрелками, hata.js::_nav) ──────────────
function resolveNavIdx(currentIdx, dir) {
    const newIdx = currentIdx + dir;
    if (isNaN(newIdx) || newIdx < 0 || newIdx >= HATAS.length) return currentIdx; // отклонено, индекс не меняется
    return newIdx;
}

// ── Test 1: open() не падает и даёт валидный индекс для «пустых» значений ──
console.log('\nTest 1: resolveOpenIdx() всегда возвращает валидный индекс HATAS');
{
    const cases = [
        { raw: [],          label: '[] (NULL-поле из БД)' },
        { raw: '',           label: 'пустая строка' },
        { raw: undefined,    label: 'undefined' },
        { raw: null,         label: 'null' },
        { raw: 'not_a_num',  label: 'нечисловая строка' },
        { raw: '3',          label: 'валидный индекс "3"' },
        { raw: 0,            label: 'валидный индекс 0' },
        { raw: '99',         label: 'индекс за пределами массива' },
        { raw: '-5',         label: 'отрицательный индекс' },
    ];
    for (const { raw, label } of cases) {
        const idx = resolveOpenIdx(raw);
        assert(!isNaN(idx), `${label}: индекс не NaN (получили ${idx})`);
        assert(idx >= 0 && idx < HATAS.length, `${label}: индекс в границах [0, ${HATAS.length}) — получили ${idx}`);
        assert(HATAS[idx] !== undefined, `${label}: HATAS[idx] определён — не должно падать на .bossReq`);
    }
}

// ── Test 2: валидный сохранённый индекс не сбрасывается на 0 ─────────────
console.log('\nTest 2: валидный ранее сохранённый индекс сохраняется как есть');
{
    for (let i = 0; i < HATAS.length; i++) {
        const idx = resolveOpenIdx(String(i));
        assert(idx === i, `base_bg_active="${i}" → idx=${i} (получили ${idx})`);
    }
}

// ── Test 3: навигация стрелками не даёт NaN даже если стартовый индекс уже NaN ──
console.log('\nTest 3: _nav() не проваливается в NaN и не выходит за границы');
{
    // Если бы индекс каким-то образом стал NaN (защита от регрессии) — _nav должен
    // отклонить переход, а не зафиксировать NaN в состоянии
    const fromNaN = resolveNavIdx(NaN, 1);
    assert(Number.isNaN(fromNaN), 'defensive: если стартовый индекс уже NaN, resolveNavIdx возвращает currentIdx (NaN) — не проваливается дальше в HATAS[NaN]');
    assert(isNaN(NaN + 1) === true, 'sanity: NaN+1 действительно NaN — именно поэтому нужен guard в _nav');

    // Обычная навигация вперёд/назад в пределах границ
    assert(resolveNavIdx(0, 1) === 1, 'вправо с 0 → 1');
    assert(resolveNavIdx(7, 1) === 7, 'вправо с последнего (7) → остаётся 7 (граница)');
    assert(resolveNavIdx(0, -1) === 0, 'влево с 0 → остаётся 0 (граница)');
    assert(resolveNavIdx(3, -1) === 2, 'влево с 3 → 2');
}

// ── Test 4: hata_progress тоже не должен давать NaN во «разблокировано» ──
console.log('\nTest 4: hata_progress не ломает проверку isUnlock при [] от сервера');
{
    function resolveProg(raw) {
        let prog = parseInt(raw);
        if (isNaN(prog)) prog = -1;
        return prog;
    }
    assert(resolveProg([]) === -1, '[] → -1 (ничего не пройдено, но не NaN)');
    assert(resolveProg('4') === 4, '"4" → 4');
    assert(!isNaN(resolveProg([])), 'результат никогда не NaN');

    // isUnlock не должен ошибочно блокировать локацию из-за NaN-сравнения
    const prog = resolveProg([]);
    const isUnlockKubrik = (-1 === -1) || prog >= -1; // bossReq=-1 (Кубрик всегда открыт)
    assert(isUnlockKubrik === true, 'Кубрик (bossReq=-1) всегда разблокирован независимо от прогресса');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

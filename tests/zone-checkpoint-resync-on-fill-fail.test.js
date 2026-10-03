/**
 * Test: батч 27.09.2026 (репорт со скриншотом — "в локациях при попытке пройти чекпоинт
 * выскакивает ОШИБКА, попробуйте ещё раз", без дальнейших деталей воспроизведения).
 *
 * Разбор кода показал: zone.js._attack() (клик по ячейке/кнопке ВЫПОЛНИТЬ) раньше топил ЛЮБУЮ
 * ошибку сервера (zone.fillCheckpoint) в один неинформативный текст без какого-либо действия —
 * включая код 55 ("ячейка уже заполнена" — сервер и клиент разошлись во мнении о cp.filled) и
 * код 56 ("не хватает энергии" — сервер и TIMERS на клиенте разошлись в расчёте энергии).
 * Оба кода означают рассинхрон локального состояния с БД — тот же класс бага, что уже чинили
 * для captureLocation()/fail(61) (см. zone-checkpoint-resync-on-capture-fail.test.js), просто
 * на другом эндпоинте. Раньше самоисцеление (_resyncFromServer) было заведено только на код 61,
 * из-за чего повторный клик после кода 55/56 бил в ту же стену бесконечно — фикс распространяет
 * тот же приём на fillCheckpoint. Заодно _resyncFromServer() теперь подтягивает и энергию, не
 * только zone-прогресс — иначе TIMERS остаётся со старым значением и код 56 может повториться
 * даже после ресинка.
 *
 * Run: node tests/zone-checkpoint-resync-on-fill-fail.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zoneSrc = fs.readFileSync(path.join(root, '_client/src/game/zone.js'), 'utf-8');

const attackStart = zoneSrc.indexOf('_attack(locIdx, cpIdx){');
const attackEnd   = zoneSrc.indexOf('_showCpReward(xp, cig, resp){');
const attackBody  = zoneSrc.slice(attackStart, attackEnd);

console.log('\nTest 1: _attack() различает коды ошибки вместо одного текста на всё подряд');
{
    assert(/const code = err && err\.code;/.test(attackBody), 'читает err.code из ответа сервера');
    assert(/if\(code === 55 \|\| code === 56\)\{/.test(attackBody),
        'коды 55 (ячейка уже заполнена) и 56 (не хватает энергии) обрабатываются отдельной веткой');
}

console.log('\nTest 2: на коды 55/56 запускается самоисцеляющийся ресинк, а не тупик');
{
    const branchStart = attackBody.indexOf('if(code === 55 || code === 56){');
    const branchEnd    = attackBody.indexOf('} else {', branchStart);
    const branch = attackBody.slice(branchStart, branchEnd);
    assert(/this\._resyncFromServer\(locIdx\);/.test(branch),
        'вызывает _resyncFromServer(locIdx) — подтягивает правду с сервера, не оставляет клиента со старым состоянием');
}

console.log('\nTest 3: прочие коды ошибок (не 55/56) по-прежнему показывают старое сообщение без ресинка');
{
    const elseStart = attackBody.indexOf('} else {', attackBody.indexOf('if(code === 55 || code === 56){'));
    const elseEnd   = attackBody.indexOf('});', elseStart);
    const elseBranch = attackBody.slice(elseStart, elseEnd);
    assert(/Не удалось выполнить действие\. Попробуйте ещё раз/.test(elseBranch),
        'общий fallback-текст сохранён для неизвестных/непредвиденных ошибок сервера');
    assert(!/_resyncFromServer/.test(elseBranch), 'для прочих кодов ресинк НЕ вызывается (не универсальное лекарство)');
}

console.log('\nTest 4: логирование ошибки расширено контекстом (Правило №8 проекта)');
{
    assert(/cp\.filled на клиенте:/.test(attackBody) && /энергия на клиенте:/.test(attackBody),
        'console.error включает клиентское cp.filled и TIMERS.getEnergy() для диагностики следующего репорта');
}

console.log('\nTest 5: _resyncFromServer() теперь синхронизирует и энергию, не только zone-прогресс');
{
    const start = zoneSrc.indexOf('_resyncFromServer(locIdx){');
    const end   = zoneSrc.indexOf('\n    }', start);
    const body  = zoneSrc.slice(start, end);

    assert(/if\(window\.TIMERS && fresh\.energy !== undefined\)\{/.test(body),
        'подтягивает fresh.energy из свежего users.get, если он есть в ответе');
    // 28.09.2026: обновлено под централизованную формулу регенерации (см. energy-time-bootstrap-
    // on-login.test.js и большой коммент в timers.js у syncFromPatch()) — раньше здесь стояло
    // прямое присваивание TIMERS.current_energy=fresh.energy + TIMERS.energy_base_time=Date.now(),
    // которое (как и старый _resyncFromServer) не учитывало energy_time с сервера и теряло остаток
    // прогресса до следующей единицы энергии при каждом ресинке. syncFromPatch(fresh.energy,
    // fresh.energy_time) — тот же приём, что и в patch.js.applyPatch(), единая точка правды.
    assert(/TIMERS\.syncFromPatch\(fresh\.energy, fresh\.energy_time\);/.test(body),
        'синхронизирует энергию через TIMERS.syncFromPatch(fresh.energy, fresh.energy_time) — с учётом анкера регенерации, не жёстким присваиванием');
    assert(/if\(window\.iface\) iface\.updateEnergy\(\);/.test(body),
        'обновляет HUD-индикатор энергии сразу после ресинка');
}

console.log('\nTest 6: старое поведение для code===61 (captureLocation) не сломано этой правкой');
{
    const captureStart = zoneSrc.indexOf('_capture(locIdx){');
    const captureEnd   = zoneSrc.indexOf('_resyncFromServer(locIdx){');
    const captureBody  = zoneSrc.slice(captureStart, captureEnd);
    assert(/if\(err && err\.code === 61\)\{/.test(captureBody), 'ветка кода 61 в _capture() сохранена как была');
    assert(/this\._resyncFromServer\(locIdx\);/.test(captureBody), '_capture() по-прежнему зовёт тот же общий _resyncFromServer()');
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

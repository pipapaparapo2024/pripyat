/**
 * Test: при каждой победе над боссом клиент сообщает серверу (bosses.recordKill) кто и
 * какого именно босса убил — нужно для глобального (не только среди друзей) «УБИВШЕГО»
 * на карточке боссов (bosses_select.js, боевка). Без этого вызова таблица boss_last_kill
 * на сервере никогда бы не заполнялась.
 *
 * 29.09.2026 (по прямому указанию, репорт со скриншотом попапа "ТЫ ПОБЕДИЛ" — "я хочу чтобы
 * последним убившим был человек который последний вышел с попапа победы над боссом"): раньше
 * (17.09.2026-28.09.2026) recordKill() вызывался в САМОМ НАЧАЛЕ _onDefeat() — сразу при
 * hp<=0 в ответе bosses.attack(), ДО того, как claimKill() вообще подтвердил победу, и ДО
 * того, как игрок хоть раз увидел попап результата боя. Из-за гонки таймаута боя с claimKill()
 * (см. tests/boss-timeout-vs-claimkill-race-fix.test.js) recordKill мог зафиксировать игрока
 * как "убившего", хотя его claimKill() позже отказывал и бой засчитывался как ПОРАЖЕНИЕ —
 * "УБИВШИЙ" на карточке боссов показывал того, кто фактически не выиграл.
 *
 * Фикс: recordKill() перенесён в _doRedirect() — единственную общую точку ВЫХОДА из уже
 * показанного попапа результата боя (boss_result.js зовёт opts.onClose на ВСЕХ путях закрытия:
 * ЕЩЁ РАЗ, кнопка выхода, отказ ЕЩЁ РАЗ по лимиту/ключам). Теперь recordKill фиксирует именно
 * того, кто (а) реально получил подтверждённую сервером победу (claimKill() уже успешно
 * отработал к этому моменту — _doRedirect объявлен ВНУТРИ его success-колбэка) и (б) последним
 * вышел из попапа — ровно то поведение, которое описал пользователь ("кто последний это
 * сделал — тот последний убил", ON DUPLICATE KEY UPDATE в bosses.php.recordKill).
 *
 * Run: node tests/boss-record-kill-on-defeat.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);

console.log('\nTest 1: recordKill() больше НЕ вызывается в начале _onDefeat(), до claimKill()');
{
    const m = src.match(/proto\._onDefeat = function\(idx\)\{([\s\S]*?)TS\.php\('bosses\.claimKill'/);
    assert(!!m, 'начало _onDefeat до claimKill найдено');
    if (m) {
        const body = m[1];
        assert(!/TS\.php\('bosses\.recordKill'/.test(body),
            'старое место вызова (ДО claimKill, сразу при hp<=0) больше не встречается — recordKill убран отсюда');
    }
}

console.log('\nTest 2: recordKill() вызывается внутри _doRedirect() — единственной общей точки выхода из попапа результата боя');
{
    const redirectStart = src.indexOf('const _doRedirect = ()=>{');
    assert(redirectStart !== -1, '_doRedirect() найден');
    // 30.09.2026 (прогон перед деплоем — тест починен): наивный indexOf('};', redirectStart)
    // ловил ПЕРВОЕ вхождение этой подстроки, а с 29.09.2026 внутри тела раньше искомой строки
    // появилась `this._lastOwnKill = this._lastOwnKill || {};` — сама содержит "};", обрезая
    // body до того, как в него попадала строка с recordKill. Ищем конец ПОСЛЕ самого вызова.
    const recordKillIdx = src.indexOf("TS.php('bosses.recordKill'", redirectStart);
    const redirectEnd = src.indexOf('};', recordKillIdx);
    const body = src.slice(redirectStart, redirectEnd);

    assert(/if\(window\.TS\) TS\.php\('bosses\.recordKill', \{boss_id: idx\}, null, null\);/.test(body),
        'recordKill вызывается fire-and-forget внутри _doRedirect (idx того же боя, что и весь _onDefeat)');
}

console.log('\nTest 3: _doRedirect защищён от повторного вызова (гвард _redirected) — recordKill не задвоится, даже если onClose дёрнут дважды');
{
    const redirectStart = src.indexOf('const _doRedirect = ()=>{');
    const redirectEnd = src.indexOf('};', redirectStart);
    const body = src.slice(redirectStart, redirectEnd);
    assert(/if\(_redirected\) return; _redirected = true;/.test(body),
        'ранний return по _redirected стоит ПЕРВОЙ строкой тела _doRedirect — recordKill физически не может выполниться дважды за один показ попапа');
}

console.log('\nTest 4: обе ветки показа попапа победы (штатный iface._showBossResultPopup и текстовый notify.showResult-фолбэк) используют один и тот же _doRedirect как onClose — recordKill сработает в любом случае');
{
    assert(/onClose: _doRedirect,/.test(src), 'iface._showBossResultPopup получает onClose: _doRedirect');
    assert(/notify\.showResult\(\{text:'Босс '\+d\.name\+' повержен!.*\}, 1, _doRedirect\);/.test(src),
        'фолбэк notify.showResult (когда iface._showBossResultPopup недоступен) тоже передаёт _doRedirect колбэком закрытия');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

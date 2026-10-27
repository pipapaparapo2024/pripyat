/**
 * Test: 26.10.2026 — репорт "нажимаю на кнопку НА НОЯБРЬ в dev-панели, ничего не происходит".
 * Разбор лога сервера показал: raznaryadka.devForceLaunchMonth реально отрабатывал (запись
 * "[Raznaryadka.devForceLaunchMonth] uid=... месяц переключён на 2026-11" в php_errors.log),
 * проблема была чисто клиентская — _fetchState() вызывался ТОЛЬКО если экран Разнарядки уже
 * был открыт (`if(raznaryadka._win && raznaryadka._win.parent)`), а ничто не открывало его
 * само. Если игрок жал кнопку при ЗАКРЫТОМ экране — визуально не менялось вообще ничего,
 * кроме легко пропускаемого тоста, хотя состояние на сервере менялось корректно.
 *
 * Фикс — общий хелпер _openOrRefreshRazn(): открывает экран, если он закрыт, иначе просто
 * обновляет уже открытый. Применён ко всем 3 dev-кнопкам этого класса (НА НОЯБРЬ, ПРОПУСТИТЬ
 * ДЕНЬ, СБРОСИТЬ) — та же причина молчаливого no-op была у всех трёх.
 *
 * Run: node tests/dev-panel-raznaryadka-buttons-open-screen.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const devPanel = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: _openOrRefreshRazn() — открывает экран, если закрыт, иначе обновляет (не toggle-закрывает уже открытый)');
{
    const start = devPanel.indexOf('const _openOrRefreshRazn = () => {');
    assert(start !== -1, '_openOrRefreshRazn найден');
    const end = devPanel.indexOf('};', start);
    const body = devPanel.slice(start, end);

    assert(/if\(raznaryadka\._win && raznaryadka\._win\.parent\) raznaryadka\._fetchState\(\);/.test(body),
        'если экран уже открыт — просто перечитывает состояние (_fetchState)');
    assert(/else raznaryadka\.open\(\);/.test(body),
        'если экран закрыт — открывает его (НЕ raznaryadka.open() вызванный вслепую: raznaryadka.open() сам toggle-закрывает, если уже открыт — поэтому ветка else обязательна)');
}

console.log('\nTest 2: все 3 кнопки класса "dev-инструменты Разнарядки" используют _openOrRefreshRazn(), не старый молчаливый if-без-else');
{
    const BUTTONS = [
        { name: 'НА НОЯБРЬ (devForceLaunchMonth)', marker: "TS.php('raznaryadka.devForceLaunchMonth'" },
        { name: 'ПРОПУСТИТЬ ДЕНЬ (devSkipDay)', marker: "TS.php('raznaryadka.devSkipDay'" },
        { name: 'СБРОСИТЬ (devResetDaySkip)', marker: "TS.php('raznaryadka.devResetDaySkip'" },
    ];
    BUTTONS.forEach(({ name, marker }) => {
        const idx = devPanel.indexOf(marker);
        assert(idx !== -1, `${name}: вызов найден`);
        if(idx === -1) return;
        const window_ = devPanel.slice(idx, idx + 400);
        assert(/_openOrRefreshRazn\(\);/.test(window_), `${name}: зовёт _openOrRefreshRazn() в колбэке успеха`);
        assert(!/if\(window\.raznaryadka && raznaryadka\._win && raznaryadka\._win\.parent\) raznaryadka\._fetchState\(\);/.test(window_),
            `${name}: старый молчаливый if-без-else (no-op при закрытом экране) убран`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

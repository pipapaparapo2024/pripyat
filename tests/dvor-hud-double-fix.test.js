/**
 * История вопроса: изначально казалось, что нижний HUD (Сидорович...Зона) дублируется
 * поверх экранов Двора, и restoreHud() пытались чинить, скрывая this.down при открытом
 * Дворе — сначала по dvor._dvorWrap (контейнер ЛОББИ), потом по 4 игровым контейнерам
 * (_pokerWin/_diceWin/_roulWin/_blackjackWin). ОБЕ версии проверены вживую и обе оказались
 * неверны: в обоих случаях общий нижний HUD просто пропадал без всякой замены — ни лобби,
 * ни игровые экраны Двора своего нижнего бара не рисуют.
 *
 * 24.09.2026: restoreHud() целиком переехал на декларативный стек (iface.pushHud/popHud,
 * см. declarative-hud-refactor.test.js) — но принцип тот же: ХУД Двора никогда не решается
 * угадыванием по конкретным окнам (dvor._dvorWrap/_pokerWin/_diceWin/_roulWin/_blackjackWin) —
 * restoreHud() просто применяет верхушку стека.
 *
 * 29.09.2026 (репорт — "бой с боссом → оружейка → шмотки открылись без нижнего ХУДа", тот же
 * класс бага задел и Двор, см. declarative-hud-refactor.test.js Test 7): раньше Двор ВООБЩЕ не
 * регистрировал требование в стек (только звал restoreHud() без своего pushHud) — из-за этого
 * при открытии Двора ПОВЕРХ экрана, скрывающего низ ХУДа (например боя с боссом, если туда как-то
 * попасть в обход обычной навигации), Двор наследовал чужую запись вместо своего дефолта.
 * Теперь Двор САМ заявляет pushHud('dvor', {}) (оба ХУДа видны — обычный экран нижней панели) и
 * снимает её popHud('dvor') в close() — тот же результат по умолчанию, что и раньше (пустой
 * стек тоже давал оба видимых ХУДа), но больше не зависит от того, что стек случайно пуст.
 *
 * Run: node tests/dvor-hud-double-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const ifaceSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'interface.js'), 'utf-8'
);
const dvorSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor.js'), 'utf-8'
);

console.log('\nTest 1: restoreHud() НЕ содержит проверок конкретных окон Двора (декларативный стек, не угадывание)');
{
    const m = ifaceSrc.match(/restoreHud\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'restoreHud() найден');
    if (m) {
        const body = m[1];
        assert(!/dvor\._dvorWrap/.test(body), 'не проверяет dvor._dvorWrap (лобби)');
        assert(!/dvor\._pokerWin/.test(body), 'не проверяет dvor._pokerWin (экран покера)');
        assert(!/dvor\._diceWin/.test(body), 'не проверяет dvor._diceWin (экран зариков)');
        assert(!/dvor\._roulWin/.test(body), 'не проверяет dvor._roulWin (экран рулетки)');
        assert(!/dvor\._blackjackWin/.test(body), 'не проверяет dvor._blackjackWin (экран блэкджека)');
        assert(/const top = this\._hudStack\.length \? this\._hudStack\[this\._hudStack\.length - 1\] : \{ up: true, down: true \};/.test(body),
            'restoreHud() берёт верхушку декларативного стека, пустой стек = дефолт (оба видны)');
    }
}

console.log('\nTest 2: dvor.js регистрирует своё требование к HUD дефолтом (оба видны) и снимает его при закрытии — не наследует чужую запись со стека');
{
    assert(/iface\.pushHud\('dvor', \{\}\);/.test(dvorSrc), "dvor.js.open() регистрирует pushHud('dvor', {}) — дефолт, оба HUD видны");
    assert(/iface\.popHud\('dvor'\);/.test(dvorSrc), "dvor.js.close() снимает регистрацию popHud('dvor')");
    assert(!/root\.addChild\(iface\.up\)/.test(dvorSrc), 'старый ручной форс-показ верхнего ХУДа в close() убран (заменён на popHud)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

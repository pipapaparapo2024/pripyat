/**
 * Test: батч 22.09.2026 (по прямому указанию, живой репорт — "снизу что-то перекрывает
 * карточку локации, совпадает по размеру с нижним ХУДом, но объекта на этом месте нет") —
 *
 * Корень: interface.js.restoreHud() при открытых играх Двора СОЗНАТЕЛЬНО держит this.down
 * (нижний HUD) видимым И переносит его в root.layer2_mc (см. явный комментарий там — попытки
 * скрывать HUD в Двор дважды ломали навигацию, решение отменили). Если пользователь перед этим
 * был в Дворе, this.down остаётся ребёнком layer2_mc — слоя ВЫШЕ, чем окно Зоны (layer1_mc).
 * Простого this.down.visible=false в zone_screen.js было недостаточно: если этот флаг где-то
 * откатится обратно на true (restoreHud() вызывается из многих мест по всей игре), HUD окажется
 * НАД Зоной, а не под ней, и будет визуально резать карточки снизу — без единого "объекта" в
 * этом месте, который можно было бы найти кликом (сам HUD либо есть целиком, либо его нет).
 *
 * Фикс: _openZoneScreen() явно возвращает this.down в root.layer1_mc (не только visible=false) —
 * даже случайный откат видимости больше не перекроет контент Зоны, т.к. HUD снова окажется
 * НИЖЕ окна Зоны в z-порядке.
 *
 * Run: node tests/zone-down-hud-reparent-layer-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zoneSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');
const ifaceSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface.js'), 'utf-8');

console.log('\nTest 1: restoreHud() действительно переносит this.down в layer2_mc, когда HUD показывается (подтверждает механизм бага)');
{
    assert(/this\.down\.visible = true;\s*\n\s*root\.layer2_mc\.addChild\(this\.down\);/.test(ifaceSrc),
        'restoreHud() re-parent-ит this.down в root.layer2_mc при показе (не оставляет в исходном layer1_mc)');
}

console.log('\nTest 2: zone_screen.js явно возвращает this.down в root.layer1_mc при открытии, не только прячет');
{
    const start = zoneSrc.indexOf('this._zoneWin = win;');
    const end   = zoneSrc.indexOf('if(typeof targetLocIdx', start);
    const body  = zoneSrc.slice(start, end);
    assert(/if\(this\.down\)\{ this\.down\.visible = false; root\.layer1_mc\.addChild\(this\.down\); \}/.test(body),
        '_openZoneScreen() и прячет HUD, и явно возвращает его в layer1_mc (ниже окна Зоны)');
    assert(!/if\(this\.down\) this\.down\.visible = false;\s*\n\s*if\(this\.up\)/.test(body),
        'старая версия (только visible=false, без re-parent) больше не осталась');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

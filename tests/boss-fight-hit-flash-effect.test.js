/**
 * Test: 25.09.2026 (по прямому указанию, референс со скриншота похожей игры — "при ударе
 * экран немного краснеет"): полноэкранная красная вспышка при своём успешном ударе по боссу —
 * непрозрачность ~65% сразу, быстро (300мс) уходит в 0. Чисто визуальный эффект (не пишет на
 * сервер/БД — подтверждено, экономику не трогает).
 *
 * Run: node tests/boss-fight-hit-flash-effect.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) bosses_fight.js — оверлей-вспышка создан и не перехватывает клики');
{
    const src = read('_client/src/game/shell/overlays/bosses_fight.js');
    assert(/const hitFlash = new PIXI\.Graphics\(\);/.test(src), 'оверлей — Graphics-прямоугольник');
    assert(/hitFlash\.beginFill\(0xcc0000, 1\);/.test(src), 'цвет — красный');
    assert(/hitFlash\.alpha = 0;/.test(src), 'изначально невидим (alpha 0)');
    assert(/win\.addChild\(hitFlash\);/.test(src), 'добавлен последним ребёнком — рендерится поверх всего экрана боя');
    assert(!/hitFlash\.interactive = true/.test(src), 'НЕ интерактивен — клики проходят сквозь него');
    assert(/this\._bossHitFlashOverlay = hitFlash;/.test(src), 'сохранён для последующего вызова из _flashBossHitScreen');
}

console.log('\n2) bosses_fight.js — proto._flashBossHitScreen() анимирует alpha 0.65→0 за 300мс');
{
    const src = read('_client/src/game/shell/overlays/bosses_fight.js');
    assert(/proto\._flashBossHitScreen = function\(\)\{/.test(src), 'метод определён');
    assert(/const FLASH_START_ALPHA = 0\.65;/.test(src), 'стартовая непрозрачность — 65% (в запрошенном диапазоне 60-70%)');
    assert(/const FLASH_DURATION_MS = 300;/.test(src), 'быстрое угасание — 300мс');
    assert(/overlay\.alpha = FLASH_START_ALPHA \* \(1 - t\);/.test(src), 'угасает линейно до 0');
    assert(/if\(!overlay\.parent\) return;/.test(src), 'анимация останавливается, если экран боя уже закрыт (не гоняет rAF вхолостую)');
}

console.log('\n3) bosses-combat.js — вспышка вызывается сразу после успешного своего удара');
{
    const src = read('_client/src/game/bosses/bosses-combat.js');
    const attackIdx = src.indexOf('proto._attack = function(){');
    const onDefeatIdx = src.indexOf("if(res.hp <= 0) this._onDefeat(idx);");
    const chunk = src.slice(attackIdx, onDefeatIdx);
    assert(/iface\._flashBossHitScreen\(\);/.test(chunk), 'вызов внутри success-колбэка bosses.attack(), до обработки поражения босса');
}

console.log('\n4) Чисто визуальный эффект — никаких новых полей на сервере/в БД');
{
    const bossesPhp = read('server/core/controllers/bosses.php');
    assert(!/hitFlash|flashBossHit/i.test(bossesPhp), 'сервер ничего не знает про вспышку — не требуется (чисто клиентский UI-эффект)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

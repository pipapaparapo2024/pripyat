/**
 * Test: карточка «убившего» босса (bosses_select.js) молча пропускала отрисовку в ДВУХ случаях —
 * (а) у резолвленного игрока не было фото, и (б) игрок вообще не резолвился через _resolveVkUsers
 * (users.get не вернул запись — деактивирован/недоступен/ошибка VK API) — репорт: убийца боссу
 * достоверно известен (bosses.killers вернул запись), а фрейм "УБИВШИЙ" пустой.
 * Теперь: плейсхолдер-кружок рисуется в ОБОИХ случаях вместо полного пропуска, плюс подробный
 * лог для диагностики (killers вернул 0 записей vs резолв не удался vs фото отсутствует —
 * три разных причины одного и того же симптома).
 *
 * Run: node tests/bosses-select-killer-fallback.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8'
);

console.log('\nTest 1: не пропускает карточку целиком ни из-за отсутствия фото, ни из-за нерезолвленного игрока');
{
    const m = src.match(/bosses\._resolveVkUsers\(killers\.map\(k=>k\.id\), \(users\)=>\{([\s\S]*?)\n\t\t\t\t\}\);/);
    assert(!!m, 'колбэк _resolveVkUsers найден');
    if (m) {
        const body = m[1];
        assert(!/if\(!u\) return;/.test(body), 'больше НЕ пропускает карточку, если игрок вообще не резолвлен');
        assert(!/if\(!u \|\| !u\.photo\) return;/.test(body), 'старая проверка (пропуск и без фото тоже) убрана');
        assert(/if\(u && u\.photo\)\{/.test(body), 'при наличии резолвленного пользователя и фото — обычный Sprite');
        assert(/spr = new PIXI\.Graphics\(\);/.test(body), 'без фото (или без резолва вообще) — Graphics-плейсхолдер (кружок), не пустое место');
    }
}

console.log('\nTest 2: диагностическое логирование резолва killer (для отладки "почему пусто")');
{
    assert(/console\.log\('\[bosses_select\] killer boss='\+k\.boss_id\+' id='\+k\.id\+' resolved:'/.test(src),
        'логирует результат резолва для каждого killer-id (виден ли, есть ли фото)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

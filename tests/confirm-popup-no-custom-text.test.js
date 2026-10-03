/**
 * Test: найдено 24.09.2026 по живому указанию (скриншот попапа "ОТКРЫТЬ СУМКУ ЗА 150 ГОЛУБЫХ
 * СПИЧЕК? ПОДТВЕРДИТЬ ДЕЙСТВИЕ? ЭТО ДЕЙСТВИЕ БУДЕТ НЕВОЗМОЖНО ОТМЕНИТЬ") — реверс правки
 * 22.09.2026. popup_confirm.png уже содержит собственный вшитый универсальный текст
 * ("ПОДТВЕРДИТЬ ДЕЙСТВИЕ?..."), поэтому _showConfirmPopup() больше не рисует свой текст
 * поверх него ни для одного из вызовов (dvor-poker-bag.js/dvor-roulette-buy.js/
 * dev_panel.js/yashik.js) — параметр text остаётся в сигнатуре, но игнорируется.
 *
 * Run: node tests/confirm-popup-no-custom-text.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client/src/game/shell/popups/confirm.js'), 'utf-8');

console.log('\nTest: _showConfirmPopup() больше не создаёт PIXI.Text из параметра text');
{
    const start = src.indexOf('proto._showConfirmPopup = function');
    const end   = src.indexOf('\n\t}', start);
    const body  = src.slice(start, end);
    assert(!!body && start !== -1, '_showConfirmPopup() найден');
    assert(!/new PIXI\.Text\(text/.test(body), 'больше не рендерит PIXI.Text(text, ...) поверх popup_confirm.png');
    assert(body.includes("function(text, onYes, onNo)"), 'сигнатура (text, onYes, onNo) сохранена — вызовы не нужно менять');
    assert(body.includes("popup_confirm.png"), 'фон с уже вшитым текстом подтверждения по-прежнему используется');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 25.09.2026, dev-панель — интеграция dev_panel_casino_force.js (по прямому указанию —
 * "хочу тестировать все азартные игры, добавь во вкладки покер/рулетка/блэкджек/зарики кнопку
 * 100% около каждой комбинации") была написана, но НЕ подключена в interface.js.
 *
 * 30.09.2026 (по прямому указанию, прогон перед деплоем — обнаружено прямое противоречие с
 * tests/dev-panel-key-popup-and-hover.test.js, который требует ОТСУТСТВИЯ этой фичи): решение —
 * убрать debug-кнопку "100%" из dev-панели полностью, НЕ подключать attachDevPanelCasinoForce.
 * Файл dev_panel_casino_force.js остаётся на диске (не удалён — серверная инфраструктура
 * users.setDevCombo используется другими путями и не тронута), но больше нигде не
 * импортируется/не вызывается — это ОБРАТНОЕ утверждение прежней версии этого теста.
 *
 * Run: node tests/dev-panel-casino-force-wiring-and-sections.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const ifaceSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface.js'), 'utf-8');
const panelSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: interface.js — НЕ импортирует и НЕ подключает attachDevPanelCasinoForce (фича убрана из dev-панели)');
{
    assert(!/attachDevPanelCasinoForce/.test(ifaceSrc), 'ни импорта, ни вызова attachDevPanelCasinoForce в interface.js нет');
}

console.log('\nTest 2: dev_panel.js — НЕ вызывает _buildCasinoForceSections (секции "100%" не рендерятся)');
{
    assert(!/this\._buildCasinoForceSections\(/.test(panelSrc), '_buildCasinoForceSections нигде не вызывается в dev_panel.js');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

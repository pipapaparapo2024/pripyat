/**
 * Test: 26.09.2026, по прямому указанию (скриншот "ТОП УРОНА" с повторяющимися
 * "КАРНАЧЕВ А. - 50K" на местах 4-6) —
 *
 * boss_result.js._applyRatingTop() раньше дополнял места 4-9 синтетическими записями
 * {nick:'Карначев А.', damage:50000}, если udata.dev_force_drops === '1'. Этот флаг —
 * личный dev-переключатель "100% дроп шмота с боссов" (dev_panel.js/bosses.php), никак не
 * связанный с рейтингом урона. Пока флаг включён (например, для тестирования шмоток) —
 * КАЖДЫЙ реальный бой молча показывал фейковый топ урона вместо настоящего.
 *
 * Фикс: заглушка убрана целиком — rankedLen/rest6 всегда строятся из настоящего top,
 * пришедшего от сервера. Мок для визуальной проверки раскладки теперь возможен только через
 * явную dev-кнопку "Попап награды (мок, 10 участников)" (opts.top передаётся напрямую в
 * _showBossResultPopup, без побочного эффекта чужого флага).
 *
 * Run: node tests/boss-result-mock-data-leak-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const resultSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');
const devPanelSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: boss_result.js — dev_force_drops больше не подменяет ТОП УРОНА фейковыми записями');
{
    assert(!/const devTest = String\(udata && udata\['dev_force_drops'\]\) === '1';/.test(resultSrc),
        'проверка dev_force_drops в _applyRatingTop() убрана целиком');
    assert(!/nick:\s*'Карначев А\.'/.test(resultSrc),
        'захардкоженная запись "Карначев А." больше не встречается в файле');
    assert(!/damage:\s*50000/.test(resultSrc),
        'захардкоженный урон 50000 (тестовая заглушка) убран');
}

console.log('\nTest 2: boss_result.js — rankedLen/rest6 строятся напрямую из top, без ветвления по флагу');
{
    assert(/const topThree = top\.slice\(0, 3\);/.test(resultSrc), 'topThree — первые 3 места из настоящего top');
    assert(/const rest6\s*=\s*top\.slice\(3, 9\);/.test(resultSrc), 'rest6 — константа (let → const), не переприсваивается веткой devTest');
    assert(/const rankedLen = top\.length;/.test(resultSrc), 'rankedLen считается напрямую от top.length, без условия на dev-флаг');
}

console.log('\nTest 3: dev_panel.js — mock-кнопка (задача #50) по-прежнему передаёт top ЯВНО через opts, не через флаг');
{
    assert(/const mockTop = \[\];/.test(devPanelSrc), 'dev-кнопка мок-попапа сохранена');
    assert(/iface\._showBossResultPopup\(\{/.test(devPanelSrc), 'мок вызывается через прямой opts.top, а не побочный эффект udata.dev_force_drops');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

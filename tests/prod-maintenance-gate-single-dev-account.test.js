/**
 * Test: 28.10.2026, по прямому указанию — перед супер деплоем теста на прод пользователь
 * попросил временно скрыть прод ото всех, кроме своего dev-аккаунта (vk_user_id=382448269),
 * чтобы проверить итоговый результат вживую до того, как его увидят реальные игроки.
 *
 * Реализовано тем же hostname-паттерном, что window.debug_mode/window.hide_unreleased_features
 * (см. hide-unreleased-features-on-prod-28-10.test.js) — один и тот же бандл деплоится байтово
 * идентичным на test-pripyat-game.ru и pripyat-game.ru, флаг window.__maintenanceGateActive
 * включался ТОЛЬКО на реальном проде И только если vk_user_id не совпадает с dev-аккаунтом. При
 * активном флаге поверх страницы ставился непрозрачный оверлей "идут технические работы".
 *
 * 28.10.2026 (тем же днём, по прямому указанию — "для всех игроков его отключи"): дев-
 * предпросмотр завершён, прод открыт всем игрокам. window.__maintenanceGateActive жёстко
 * = false — hostname/vk_user_id-условие оставлено закомментировано рядом в index.js (не
 * удалено), чтобы при необходимости снова закрыть прод на предпросмотр не восстанавливать
 * логику с нуля. Этот тест теперь фиксирует ОБРАТНОЕ — что гейт снят, а защитный код (оверлей/
 * DOMContentLoaded guard) физически остался в файле на случай отката.
 *
 * Run: node tests/prod-maintenance-gate-single-dev-account.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(root, '_client', 'src', 'index.js'), 'utf-8');

console.log('\nTest 1: window.__maintenanceGateActive жёстко выключен (false) для ВСЕХ игроков на ВСЕХ доменах');
{
    assert(/window\.__maintenanceGateActive = false;/.test(indexSrc),
        'флаг захардкожен в false — ни hostname, ни vk_user_id больше не влияют на гейт');
    assert(!/window\.__maintenanceGateActive = \(typeof location/.test(indexSrc),
        'старое hostname/vk_user_id-условие больше НЕ присваивается напрямую флагу (отключено, не просто дополнено)');
}

console.log('\nTest 2: старое условие и оверлей оставлены в файле закомментированными/недостижимыми — не удалены, можно быстро откатить');
{
    assert(/\/\/ const _maintenanceCondition = \(typeof location !== 'undefined' && location\.hostname === 'pripyat-game\.ru'/.test(indexSrc),
        'исходное условие сохранено как комментарий рядом с флагом (не потеряно при отключении)');
    assert(/&& String\(userDataVk\['vk_user_id'\]\) !== '382448269'\);/.test(indexSrc),
        'dev-аккаунт в закомментированном условии — тот же ID, что и раньше (382448269)');
    const gateStart = indexSrc.indexOf('if(window.__maintenanceGateActive){');
    assert(gateStart !== -1, 'блок if(__maintenanceGateActive) с оверлеем всё ещё физически в файле (код не удалён, просто недостижим при false)');
    const gateEnd = indexSrc.indexOf('\n}', gateStart);
    const gateBody = indexSrc.slice(gateStart, gateEnd);
    assert(/Идут технические работы/.test(gateBody), 'текст оверлея сохранён на случай повторного включения');
}

console.log('\nTest 3: hide_unreleased_features выключен — 2048, Разнарядка и Заначки открыты всем игрокам');
{
    assert(/window\.hide_unreleased_features = false;/.test(indexSrc),
        'скрытие функций отключено: оно не зависит ни от hostname, ни от VK ID игрока');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

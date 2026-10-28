/**
 * Test: 28.10.2026, по прямому указанию — перед супер деплоем теста на прод пользователь
 * попросил временно скрыть прод ото всех, кроме своего dev-аккаунта (vk_user_id=382448269),
 * чтобы проверить итоговый результат вживую до того, как его увидят реальные игроки.
 *
 * Реализовано тем же hostname-паттерном, что window.debug_mode/window.hide_unreleased_features
 * (см. hide-unreleased-features-on-prod-28-10.test.js) — один и тот же бандл деплоится байтово
 * идентичным на test-pripyat-game.ru и pripyat-game.ru, флаг window.__maintenanceGateActive
 * включается ТОЛЬКО на реальном проде И только если vk_user_id не совпадает с dev-аккаунтом.
 * При активном флаге поверх страницы ставится непрозрачный оверлей "идут технические работы" —
 * тот же текст/стиль, что maintenance.html в корне проекта. Игровой бандл технически продолжает
 * грузиться в фоне (сознательный компромисс — переписывать всю цепочку загрузки index.js прямо
 * перед деплоем на прод было бы рискованнее, чем эта точечная правка), но заблокированный игрок
 * не может ничего увидеть или нажать — оверлей перехватывает все клики и перекрывает канвас
 * целиком, z-index максимальный.
 *
 * Это ВРЕМЕННАЯ мера — должна быть снята (удалён блок/значение ALLOWED_DEV_VK_UID), когда прод
 * готов открыться всем. Тест фиксирует ТЕКУЩЕЕ состояние (гейт активен), чтобы не забыть про
 * него и легко найти место правки при снятии.
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

console.log('\nTest 1: window.__maintenanceGateActive — тот же hostname-паттерн, что debug_mode/hide_unreleased_features, плюс сверка vk_user_id с dev-аккаунтом');
{
    assert(/window\.__maintenanceGateActive = \(typeof location !== 'undefined' && location\.hostname === 'pripyat-game\.ru'/.test(indexSrc),
        'активируется только на реальном hostname прода (pripyat-game.ru), не на тесте');
    assert(/&& String\(userDataVk\['vk_user_id'\]\) !== '382448269'\);/.test(indexSrc),
        'выключен ТОЛЬКО для одного конкретного vk_user_id (382448269) — исключение единичное, не диапазон/список');
    assert(indexSrc.indexOf('window.vk_params = userDataVk;') < indexSrc.indexOf('window.__maintenanceGateActive'),
        'проверка идёт ПОСЛЕ того, как userDataVk уже распарсен из query-параметров страницы');
}

console.log('\nTest 2: активный гейт рисует полноэкранный непрозрачный оверлей поверх канваса, а не просто текст');
{
    const gateStart = indexSrc.indexOf('if(window.__maintenanceGateActive){');
    assert(gateStart !== -1, 'блок if(__maintenanceGateActive) найден');
    const gateEnd = indexSrc.indexOf('\n}', gateStart);
    const gateBody = indexSrc.slice(gateStart, gateEnd);
    assert(/position:fixed;top:0;left:0;width:100%;height:100%;/.test(gateBody), 'оверлей — fixed, перекрывает весь вьюпорт (не часть обычного DOM-потока)');
    assert(/z-index:2147483647;/.test(gateBody), 'z-index максимально возможный (2^31-1) — гарантированно выше канваса и HUD');
    assert(/Идут технические работы/.test(gateBody), 'тот же текст, что в maintenance.html');
}

console.log('\nTest 3: оверлей добавляется в DOM независимо от момента готовности document.body (defensive guard, как preloader-visual.js)');
{
    const gateStart = indexSrc.indexOf('if(window.__maintenanceGateActive){');
    const gateEnd = indexSrc.indexOf('\n}', gateStart);
    const gateBody = indexSrc.slice(gateStart, gateEnd);
    assert(/if\(document\.body\) _attachGateOverlay\(\); else document\.addEventListener\('DOMContentLoaded', _attachGateOverlay\);/.test(gateBody),
        'если document.body ещё не готов — ждём DOMContentLoaded, не падаем на appendChild(null)');
}

console.log('\nTest 4: гейт не трогает тестовый домен — на test-pripyat-game.ru поведение не меняется ни для кого');
{
    assert(!/location\.hostname === 'test-pripyat-game\.ru'[\s\S]{0,80}__maintenanceGateActive/.test(indexSrc),
        'флаг не завязан на test-hostname — активируется только на реальном проде');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

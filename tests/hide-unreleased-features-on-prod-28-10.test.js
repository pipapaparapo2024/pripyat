/**
 * Test: 28.10.2026, по прямому указанию пользователя после живого инцидента.
 *
 * Случайный полный супер деплой (v691) вынес на прод три недоделанные фичи — "2048",
 * "Разнарядка" (ежедневные задания), "Заначки" — хотя ранее в этой же сессии было явное
 * правило "кидай на прод только хабар, остальное не трогай". Реальные игроки на
 * pripyat-game.ru увидели 404 на недостающих картинках (заначки/2048/разнарядка никогда не
 * заливались в images/ прода) и получили доступ к фичам, которые ещё не готовы к запуску.
 *
 * Фикс — тот же hostname-паттерн, что уже используется для window.debug_mode/window.my_server
 * (см. my-server-hostname-gated-no-cross-origin-cors.test.js): один и тот же бандл деплоится
 * байтово идентичным на test-pripyat-game.ru и pripyat-game.ru (см. AGENTS.md, "супер деплой"),
 * новый флаг window.hide_unreleased_features только переключает ВИДИМОСТЬ точек входа трёх
 * фич в зависимости от домена — сам код/картинки остаются в сборке, ничего не удалено, значит
 * на тесте (и в самой VK/ОК площадке, где hostname реального прод-хостинга тоже pripyat-game.ru
 * согласно boss_result.js — ВАЖНО: это значит флаг равен true и для настоящих игроков тоже,
 * что и требуется) поведение для каждой фичи переключается централизованно одним флагом.
 *
 * Картинки отсутствующих файлов (271 шт.) уже СКОПИРОВАНЫ на прод вручную (server-side copy,
 * см. чат) как отдельная, более быстрая мера против 404 — этот тест её не проверяет (не часть
 * репозитория), а проверяет именно код скрытия точек входа.
 *
 * Run: node tests/hide-unreleased-features-on-prod-28-10.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel) { return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const indexSrc      = readSrc('_client/src/index.js');
const dvorSrc        = readSrc('_client/src/game/dvor.js');
const svodSrc        = readSrc('_client/src/game/svod.js');
const panelsSrc      = readSrc('_client/src/game/interface/interface-panels.js');

console.log('\nTest 1: window.hide_unreleased_features определён в index.js, тот же паттерн, что window.debug_mode');
{
    // 28.10.2026 (повторное указание тем же днём — "хочу всё заранее проверить"): флаг теперь
    // ТАКЖЕ исключает dev-аккаунт (vk_user_id=382448269), иначе предпросмотр прода не показал бы
    // самому разработчику Заначки/Разнарядку/2048, которые были предметом сессии. Объявление
    // переехало ниже по файлу (после парсинга userDataVk) — см. Test 1b ниже.
    assert(/window\.hide_unreleased_features = \(typeof location !== 'undefined' && location\.hostname === 'pripyat-game\.ru'$/m.test(indexSrc),
        'флаг true именно на pripyat-game.ru (реальный хостинг прода и VK/ОК-iframe одновременно)');
    // Флаг должен быть объявлен ПОСЛЕ window.debug_mode (та же область файла, та же логика) —
    // не строго обязательно по порядку, но так же читаемо/рядом, как и было задумано.
    assert(indexSrc.indexOf('window.debug_mode') < indexSrc.indexOf('window.hide_unreleased_features'),
        'флаг объявлен рядом с debug_mode, тем же паттерном');
}

console.log('\nTest 1b: window.hide_unreleased_features — dev-аккаунт (vk_user_id=382448269) исключён, объявлен после парсинга userDataVk');
{
    assert(/&& String\(userDataVk\['vk_user_id'\]\) !== '382448269'\);/.test(indexSrc),
        'флаг исключает dev-аккаунт vk_user_id=382448269 — тот же ID, что у __maintenanceGateActive');
    assert(indexSrc.indexOf('window.hide_unreleased_features =') < indexSrc.indexOf('window.__maintenanceGateActive ='),
        'hide_unreleased_features объявлен рядом с __maintenanceGateActive (оба после парсинга userDataVk)');
    assert(indexSrc.indexOf("partsData[i].split('=')") < indexSrc.indexOf('window.hide_unreleased_features ='),
        'объявление флага идёт ПОСЛЕ разбора query-строки в userDataVk (иначе vk_user_id ещё не существовал бы)');
}

console.log('\nTest 2: dvor.js — картинки 2048 ("ящик"/"нажать на игру") ВСЕГДА в сцене (тест и прод), кликабельна только "нажать на игру", и только когда hide_unreleased_features=false');
{
    // 28.10.2026 (повторное указание тем же днём — "верни картинки на прод, но сделай
    // некликабельными"): раньше ОБА спрайта вообще не добавлялись в сцену на проде. Теперь
    // видимость безусловна — скрывается только интерактивность "нажать на игру" (единственного
    // по-настоящему кликабельного элемента, "ящик" и так чисто декоративный).
    const yashikStart = dvorSrc.indexOf("if(!this._game2048YashikSpr){");
    assert(yashikStart > -1, 'блок создания "ящика" найден');
    const yashikAddChildIdx = dvorSrc.indexOf('w.addChild(this._game2048YashikSpr);', yashikStart);
    assert(yashikAddChildIdx > -1, '"ящик" добавляется в сцену');
    const yashikBlock = dvorSrc.slice(yashikStart, yashikAddChildIdx);
    assert(!/hide_unreleased_features/.test(yashikBlock),
        '"ящик" (создание + addChild) НЕ находится внутри hide_unreleased_features guard — виден всегда');

    const pressStart = dvorSrc.indexOf("if(!this._game2048PressSpr){");
    assert(pressStart > -1, 'блок создания "нажать на игру" найден');
    const pressAddChildIdx = dvorSrc.indexOf('w.addChild(this._game2048PressSpr);', pressStart);
    assert(pressAddChildIdx > -1, '"нажать на игру" добавляется в сцену');
    const pressBody = dvorSrc.slice(pressStart, pressAddChildIdx);
    assert(/if\(!window\.hide_unreleased_features\)\{/.test(pressBody),
        'интерактивность "нажать на игру" обёрнута в guard — скрыта на pripyat-game.ru');
    assert(/spr\.interactive = true; spr\.buttonMode = true;/.test(pressBody),
        'на тесте (флаг=false) "нажать на игру" остаётся интерактивной');
}

console.log('\nTest 3: svod.js — вкладка "Заначки" убирается из MAIN_TABS, если hide_unreleased_features=true');
{
    assert(/\]\.filter\(t => t\.key !== 'zanachki' \|\| !window\.hide_unreleased_features\);/.test(svodSrc),
        'MAIN_TABS отфильтрован по zanachki+hide_unreleased_features ПЕРЕД циклом рендера кнопок (не дыра в сетке)');
    // Дефолтная вкладка при первом открытии — 'respect', не 'zanachki' (баг 27.10.2026, см.
    // соседний коммент в svod.js) — значит скрытие zanachki не ломает open() по умолчанию.
    assert(/this\._selectMainTab\('respect'\);/.test(svodSrc), 'дефолтная вкладка остаётся respect, не zanachki');
}

console.log('\nTest 4: interface-panels.js — кнопка "Разнарядка" не добавляется в правую панель, если hide_unreleased_features=true');
{
    const start = panelsSrc.indexOf("const raznYOff = rightCfg.length");
    assert(start > -1, 'блок создания кнопки Разнарядки найден');
    const guardStart = panelsSrc.lastIndexOf('if(!window.hide_unreleased_features){', start);
    assert(guardStart > -1 && guardStart < start, 'блок обёрнут в if(!window.hide_unreleased_features)');
    assert(/rightPanel\.addChild\(raznNorm, raznHov, raznHit\);\s*\n\s*\}/.test(panelsSrc),
        'addChild кнопки Разнарядки закрывается внутри guard-блока');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.error(`❌ ${failed} test(s) failed, ${passed} passed`); process.exit(1); }

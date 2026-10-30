/**
 * Test: 30.10.2026 — выпуск 2048, ежедневных заданий и Заначек для всех игроков.
 *
 * Случайный полный супер деплой (v691) вынес на прод три недоделанные фичи — "2048",
 * "Разнарядка" (ежедневные задания), "Заначки" — хотя ранее в этой же сессии было явное
 * правило "кидай на прод только хабар, остальное не трогай". Реальные игроки на
 * pripyat-game.ru увидели 404 на недостающих картинках (заначки/2048/разнарядка никогда не
 * заливались в images/ прода) и получили доступ к фичам, которые ещё не готовы к запуску.
 *
 * Временное ограничение снято: флаг window.hide_unreleased_features должен быть false для
 * любого домена и любого VK ID. Сами точки входа сохраняют общий guard, но при false он
 * всегда пропускает игрока к функции.
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

console.log('\nTest 1: window.hide_unreleased_features выключен для всех игроков');
{
    assert(/window\.hide_unreleased_features = false;/.test(indexSrc),
        'флаг выключен: 2048, Разнарядка и Заначки доступны на проде всем игрокам');
    assert(!/hide_unreleased_features\s*=\s*\([\s\S]*?382448269/.test(indexSrc),
        'видимость функций больше не зависит от VK ID разработчика');
}

console.log('\nTest 2: вход в 2048 доступен всем при выключенном флаге');
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
        'интерактивность использует единый флаг, который теперь выключен для всех');
    assert(/spr\.interactive = true; spr\.buttonMode = true;/.test(pressBody),
        '"нажать на игру" становится интерактивной при флаге=false');
}

console.log('\nTest 3: вкладка "Заначки" отображается всем при выключенном флаге');
{
    assert(/\]\.filter\(t => t\.key !== 'zanachki' \|\| !window\.hide_unreleased_features\);/.test(svodSrc),
        'MAIN_TABS использует единый флаг, который теперь выключен для всех');
    // Дефолтная вкладка при первом открытии — 'respect', не 'zanachki' (баг 27.10.2026, см.
    // соседний коммент в svod.js) — значит скрытие zanachki не ломает open() по умолчанию.
    assert(/this\._selectMainTab\('respect'\);/.test(svodSrc), 'дефолтная вкладка остаётся respect, не zanachki');
}

console.log('\nTest 4: кнопка "Разнарядка" отображается всем при выключенном флаге');
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

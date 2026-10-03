/**
 * Test: 30.09.2026, по прямому указанию (репорт по живому тесту обучения) — два независимых
 * бага:
 *
 * 1) Мигание подсветки ресурсов (тушёнка/рубли/сигареты) на попапе "про валюту" было слишком
 *    частым — уменьшена частота вдвое (см. onboarding-popup.js._buildCurrencyHighlights).
 *
 * 2) "Открываю вкладку Шмотки в туре — указатель сразу перескакивает на Сидоровича": шаг тура
 *    'shmot' продвигался мгновенно на клик по подсвеченной вкладке, минуя и открытие экрана, и
 *    озвучку. Корень — interface-panels.js._closeAllPanels() проверял `shmot._shopWin.parent`
 *    как признак "магазин шмоток сейчас открыт", но shmot_shop.js.exitBtn никогда не убирает
 *    _shopWin из родителя (тот же паттерн, что zone/sidorovich/yashik/bossSelect — только
 *    visible=false) — .parent остаётся правдивым НАВСЕГДА после первого открытия за сессию.
 *    При повторном прохождении шага 'shmot' (типичный сценарий — тестирование через кнопку
 *    dev-панели "Проиграть обучение заново" без перезагрузки страницы) САМ клик по подсвеченной
 *    вкладке вызывал openModule('shmot') → _closeAllPanels() ПЕРВОЙ строкой → guard видел старый
 *    truthy .parent → мгновенно popHud('shmot') → onboarding-tour.js._hookScreenClose видел
 *    совпадение с активным шагом → _advanceTour('shmot') → тур скакал на 'sidorovich' раньше,
 *    чем shmot.open() вообще успевал реально открыть экран. Тот же класс бага, что уже чинили
 *    для Хабара (см. коммит "Обучение: фикс бага с Хабаром").
 *
 * Run: node tests/onboarding-blink-rate-and-shmot-tour-skip.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf-8');

const popupSrc = read('_client/src/game/onboarding/onboarding-popup.js');
const panelsSrc = read('_client/src/game/interface/interface-panels.js');

console.log('\n1) Мигание ресурсов на попапе про валюту замедлено вдвое');
{
    const body = popupSrc.slice(popupSrc.indexOf('_buildCurrencyHighlights = function'), popupSrc.indexOf('_destroyCurrencyHighlights = function'));
    assert(/t \+= 0\.06;/.test(body), 'приращение t уменьшено с 0.12 до 0.06 — вдвое реже мигание');
    assert(!/t \+= 0\.12;/.test(body), 'старое (быстрое) приращение 0.12 не осталось рядом');
    assert(/0\.55 \+ 0\.45 \* Math\.sin\(t \* 3\)/.test(body), 'амплитуда/множитель синуса не тронуты — меняется только скорость');
}

console.log('\n2) _closeAllPanels(): guard магазина шмоток проверяет .visible, а не .parent (иначе никогда не сбрасывается)');
{
    assert(/if\(window\.shmot && shmot\._shopWin && shmot\._shopWin\.visible\)\{ shmot\._shopWin\.visible = false; this\.popHud\('shmot'\); \}/.test(panelsSrc),
        '_closeAllPanels() снимает popHud(\'shmot\') только если экран РЕАЛЬНО виден сейчас (.visible), не просто "когда-то был создан" (.parent)');
    assert(!/shmot\._shopWin && shmot\._shopWin\.parent\)\{ shmot\._shopWin\.visible = false;/.test(panelsSrc),
        'старая проверка по .parent убрана целиком');
}

console.log('\n3) openModule(): reallyOpen для shmot тоже проверяет .visible (согласованность с fix #2, чинит заодно "Шмотки не открываются повторно после выхода крестиком")');
{
    const openModuleBody = panelsSrc.slice(panelsSrc.indexOf('proto.openModule = function'), panelsSrc.indexOf('proto._closeAllPanels'));
    assert(/\(m\._shopWin\s+&& m\._shopWin\.visible\)/.test(openModuleBody),
        'reallyOpen-проверка модуля "shmot" использует .visible, согласованно с _closeAllPanels()');
    assert(!/\(m\._shopWin\s+&& m\._shopWin\.parent\)/.test(openModuleBody),
        'старая проверка reallyOpen по .parent для shmot убрана');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

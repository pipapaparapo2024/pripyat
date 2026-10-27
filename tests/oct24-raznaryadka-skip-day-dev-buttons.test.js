/**
 * Test: 24.10.2026 (по прямому указанию — "кнопки, при нажатии на которые можно будет
 * пропускать день"): дев-панель Разнарядки получила кнопку "ПРОПУСТИТЬ ДЕНЬ" (+ "СБРОСИТЬ").
 *
 * Настоящего перевода системных часов сервера нет и не будет — это задело бы вообще все
 * остальные server-authoritative таймеры/кулдауны проекта (energy_time, dvor_daily, кулдауны
 * оружия и т.д.), которые тоже считают "сегодня" от того же реального времени. Вместо этого —
 * локальный для Разнарядки сдвиг (raznaryadka_data.dev_day_offset, НЕ whitelist, server-only
 * поле), который читает новый RaznaryadkaProgress::effectiveDay($data) ВМЕСТО голого mskDay()
 * везде, где раньше было "сегодня" внутри фичи: getState()/payDay()/devCompleteToday()/
 * devFailDay()/devSeedMonth() (контроллер) и report() (модель, критично — иначе реальное
 * игровое действие после "пропуска" засчиталось бы в РЕАЛЬНЫЙ сегодняшний день, а не в тот,
 * который админ пришёл тестировать).
 *
 * Реальное исполнение логики effectiveDay()/report() с offset — в
 * tests/_php_fixtures/raznaryadka-core.php (Test 12/13, через raznaryadka-php-real-exec.test.js).
 * Этот файл — регрессия по ТЕКСТУ (все call site'ы/проводка кнопок), её 23.09.2026-прецедент —
 * `hide-uid-from-leaderboards.test.js`.
 *
 * Run: node tests/oct24-raznaryadka-skip-day-dev-buttons.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = (p) => fs.readFileSync(p, 'utf-8');

console.log('\nTest 1: raznaryadkaprogress.php — effectiveDay() определён и подключён в report()');
{
    const src = norm(path.join(root, 'server/core/models/raznaryadkaprogress.php'));
    assert(/static function effectiveDay\(\$data\)\{/.test(src), 'effectiveDay($data) определён');
    assert(/\$offset = max\(0, intval\(\$data\['dev_day_offset'\] \?\? 0\)\);/.test(src), 'отрицательный offset игнорируется (max(0,...))');
    // 27.10.2026 (баг найден по прямому указанию — "форснул на ноябрь, показывается 27 ноября
    // вместо 1"): формула переписана на baseDay($data) (1, если месяц форснут вперёд реального;
    // иначе mskDay()) + daysInMonthFor($month) (дни ЦЕЛЕВОГО месяца, не обязательно реального
    // текущего) — см. docблок baseDay()/daysInMonthFor() в raznaryadkaprogress.php.
    assert(/return min\(self::baseDay\(\$data\) \+ \$offset, self::daysInMonthFor\(\$month\)\);/.test(src), 'капается на daysInMonthFor($month) от baseDay($data) (не от голого mskDay(), не от daysInMskMonth())');
    assert(/\$dayKey = strval\(self::effectiveDay\(\$data\)\);/.test(src), 'report() использует effectiveDay($data), не голый mskDay()');
    assert(!/\$dayKey = strval\(self::mskDay\(\)\);/.test(src), 'старый вызов mskDay() для $dayKey убран');
}

console.log('\nTest 2: raznaryadka.php — ВСЕ 5 мест "today" переведены на effectiveDay($data) (getState/payDay/devCompleteToday/devFailDay/devSeedMonth)');
{
    const src = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    const matches = src.match(/\$today = RaznaryadkaProgress::effectiveDay\(\$data\);/g) || [];
    assert(matches.length === 5, `ровно 5 мест используют effectiveDay($data), найдено ${matches.length}`);
    assert(!/RaznaryadkaProgress::mskDay\(\)/.test(src.replace(/function devSkipDay[\s\S]*?\n        \}/, '').replace(/\$realToday = RaznaryadkaProgress::mskDay\(\);/, '')),
        'вне devSkipDay() сырой mskDay() для "сегодня" не остался (единственное легитимное использование — вычисление maxOffset в devSkipDay())');
}

console.log('\nTest 3: raznaryadka.php — devSkipDay()/devResetDaySkip() определены, в permits, капают offset на границе месяца');
{
    const src = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    // 25.10.2026: массив permits больше не заканчивается литералом сразу после этих двух — следом
    // добавлен 'devForceLaunchMonth' (кнопка "на ноябрь" в dev-панели), а 27.10.2026 — ещё и
    // 'devRevertToRealMonth' (кнопка "назад") — проверяем присутствие ключей в permits, не точный
    // хвост массива.
    assert(/'devSkipDay', 'devResetDaySkip', 'devForceLaunchMonth', 'devRevertToRealMonth'\];/.test(src), 'оба новых + оба month-permit-а добавлены в $this->permits');
    assert(/function devSkipDay\(\)\{/.test(src), 'devSkipDay() определён');
    assert(/function devResetDaySkip\(\)\{/.test(src), 'devResetDaySkip() определён');
    const start = src.indexOf('function devSkipDay(){');
    const body = src.slice(start, src.indexOf('\n        }\n', start));
    // 27.10.2026: maxOffset теперь считается от baseDay($data) (не голого mskDay()) и от
    // daysInMonthFor($data['month']) (не daysInMskMonth()) — см. тот же баг/фикс, что в Test 1.
    assert(/\$maxOffset = max\(0, \$daysInMonth - \$base\);/.test(body), 'devSkipDay() считает maxOffset от baseDay($data) (не от уже сдвинутого effectiveDay)');
    assert(/\$offset = min\(intval\(\$data\['dev_day_offset'\] \?\? 0\) \+ 1, \$maxOffset\);/.test(body), 'каждый клик — +1 к offset, не абсолютное значение (повторные клики докручивают)');
    const resetStart = src.indexOf('function devResetDaySkip(){');
    const resetBody = src.slice(resetStart, src.indexOf('\n        }\n', resetStart));
    assert(/\$data\['dev_day_offset'\] = 0;/.test(resetBody), 'devResetDaySkip() обнуляет offset');
}

console.log('\nTest 4: dev_panel.js — кнопки "ПРОПУСТИТЬ ДЕНЬ"/"СБРОСИТЬ" вызывают новые permit-ы');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/dev_panel.js'));
    assert(/_row\('Текущий день \(тест\)', \[/.test(src), 'новый ряд "Текущий день (тест)" добавлен в секцию РАЗНАРЯДКА');
    assert(/label:'ПРОПУСТИТЬ ДЕНЬ'/.test(src), 'кнопка "ПРОПУСТИТЬ ДЕНЬ" присутствует');
    assert(/TS\.php\('raznaryadka\.devSkipDay', \{\}, \(e\)=>\{/.test(src), 'кнопка вызывает raznaryadka.devSkipDay');
    assert(/label:'СБРОСИТЬ'/.test(src), 'кнопка "СБРОСИТЬ" присутствует');
    assert(/TS\.php\('raznaryadka\.devResetDaySkip', \{\}, \(e\)=>\{/.test(src), 'кнопка вызывает raznaryadka.devResetDaySkip');
    // Обе кнопки должны обновлять экран (открывать, если закрыт, иначе обновлять уже открытый —
    // см. _openOrRefreshRazn(), 26.10.2026) и применять patch — тот же паттерн, что у уже
    // существующих кнопок ВЫПОЛНИТЬ/ПРОВАЛИТЬ/ЗАСЕЯТЬ СЛУЧАЙНО этой же секции.
    assert(/const _openOrRefreshRazn = \(\) => \{/.test(src), '_openOrRefreshRazn() определён (общий хелпер открыть/обновить экран)');
    assert(/if\(raznaryadka\._win && raznaryadka\._win\.parent\) raznaryadka\._fetchState\(\);\s*\n\s*else raznaryadka\.open\(\);/.test(src),
        '_openOrRefreshRazn(): обновляет уже открытый экран ИЛИ открывает закрытый (не молчаливый no-op)');
    const start = src.indexOf("_row('Текущий день (тест)', [");
    const block = src.slice(start, src.indexOf("]);", start) + 3);
    assert((block.match(/if\(e && e\.patch\) applyPatch\(e\.patch\);/g) || []).length === 2, 'обе кнопки применяют patch через applyPatch()');
    assert((block.match(/_openOrRefreshRazn\(\);/g) || []).length === 2, 'обе кнопки зовут _openOrRefreshRazn() (открыть/обновить экран Разнарядки)');
}

console.log('\nTest 5: dev_panel.js/raznaryadka.php — кнопка "НА НОЯБРЬ" (devForceLaunchMonth) проведена от клиента до сервера');
{
    const panelSrc = norm(path.join(root, '_client/src/game/shell/overlays/dev_panel.js'));
    assert(/_row\('Месяц \(тест старта фичи\)', \[/.test(panelSrc), 'новый ряд "Месяц (тест старта фичи)" добавлен в секцию РАЗНАРЯДКА');
    // 27.10.2026: метка получила суффикс "(live)" — рядом появилась вторая кнопка "НАЗАД
    // (pre-launch)" в той же строке (см. Test 6), оба состояния теперь явно различимы по подписи.
    assert(/label:'НА НОЯБРЬ \(live\)'/.test(panelSrc), 'кнопка "НА НОЯБРЬ (live)" присутствует');
    assert(/TS\.php\('raznaryadka\.devForceLaunchMonth', \{\}, \(e\)=>\{/.test(panelSrc), 'кнопка вызывает raznaryadka.devForceLaunchMonth');
    const novStart = panelSrc.indexOf("_row('Месяц (тест старта фичи)', [");
    const novBlock = panelSrc.slice(novStart, panelSrc.indexOf("]);", novStart) + 3);
    assert(/if\(e && e\.patch\) applyPatch\(e\.patch\);/.test(novBlock), 'кнопка применяет patch через applyPatch()');
    assert(/_openOrRefreshRazn\(\);/.test(novBlock), 'кнопка зовёт _openOrRefreshRazn() (открывает экран, если закрыт, иначе обновляет)');

    const ctrlSrc = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    assert(/function devForceLaunchMonth\(\)\{/.test(ctrlSrc), 'devForceLaunchMonth() определён в контроллере');
    const ctrlStart = ctrlSrc.indexOf('function devForceLaunchMonth(){');
    const ctrlBody = ctrlSrc.slice(ctrlStart, ctrlSrc.indexOf('\n        }\n', ctrlStart));
    assert(/\$data = RaznaryadkaProgress::devForceLaunchMonth\(\$this->ops, \$user\);/.test(ctrlBody),
        'контроллер делегирует в RaznaryadkaProgress::devForceLaunchMonth()');
    assert(/if\(\$data === null\) return \$this->ops->fail\(54\);/.test(ctrlBody),
        'отсутствие launch_month в конфиге отдаёт fail(54), не падает');

    const modelSrc = norm(path.join(root, 'server/core/models/raznaryadkaprogress.php'));
    assert(/static function devForceLaunchMonth\(\$ops, &\$user\)\{/.test(modelSrc), 'devForceLaunchMonth() определён в модели');
    assert(/static function _closeMonthAndStartNew\(\$ops, &\$user, \$data, \$config, \$newMonth\)\{/.test(modelSrc),
        'закрытие месяца вынесено в переиспользуемый _closeMonthAndStartNew() (общий код с _rollover())');
    assert(/return self::_closeMonthAndStartNew\(\$ops, \$user, \$data, \$config, \$curMonth\);/.test(modelSrc),
        '_rollover() теперь делегирует в _closeMonthAndStartNew() — не дублирует логику автосбора');
}

console.log('\nTest 6: dev_panel.js/raznaryadka.php — кнопка "НАЗАД" (devRevertToRealMonth) проведена от клиента до сервера');
{
    // 27.10.2026 (по прямому указанию — "добавь кнопку вернуть как должно быть, нужно чтобы
    // было два таких состояния, я мог их проверять"): обратная операция к "НА НОЯБРЬ" — в ТОМ ЖЕ
    // ряду dev-панели, второй кнопкой.
    const panelSrc = norm(path.join(root, '_client/src/game/shell/overlays/dev_panel.js'));
    assert(/label:'НАЗАД \(pre-launch\)'/.test(panelSrc), 'кнопка "НАЗАД (pre-launch)" присутствует');
    assert(/TS\.php\('raznaryadka\.devRevertToRealMonth', \{\}, \(e\)=>\{/.test(panelSrc), 'кнопка вызывает raznaryadka.devRevertToRealMonth');
    const novStart = panelSrc.indexOf("_row('Месяц (тест старта фичи)', [");
    const novBlock = panelSrc.slice(novStart, panelSrc.indexOf("]);", novStart) + 3);
    assert((novBlock.match(/if\(e && e\.patch\) applyPatch\(e\.patch\);/g) || []).length === 2, 'обе кнопки ряда применяют patch через applyPatch()');
    assert((novBlock.match(/_openOrRefreshRazn\(\);/g) || []).length === 2, 'обе кнопки ряда зовут _openOrRefreshRazn()');

    const ctrlSrc = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    assert(/'devForceLaunchMonth', 'devRevertToRealMonth'\];/.test(ctrlSrc), 'devRevertToRealMonth добавлен в $this->permits');
    assert(/function devRevertToRealMonth\(\)\{/.test(ctrlSrc), 'devRevertToRealMonth() определён в контроллере');
    const ctrlStart = ctrlSrc.indexOf('function devRevertToRealMonth(){');
    const ctrlBody = ctrlSrc.slice(ctrlStart, ctrlSrc.indexOf('\n        }\n', ctrlStart));
    assert(/\$data = RaznaryadkaProgress::devRevertToRealMonth\(\$this->ops, \$user\);/.test(ctrlBody),
        'контроллер делегирует в RaznaryadkaProgress::devRevertToRealMonth()');

    const modelSrc = norm(path.join(root, 'server/core/models/raznaryadkaprogress.php'));
    assert(/static function devRevertToRealMonth\(\$ops, &\$user\)\{/.test(modelSrc), 'devRevertToRealMonth() определён в модели');
    assert(/return self::_closeMonthAndStartNew\(\$ops, \$user, \$data, \$config, self::mskMonthKey\(\)\);/.test(modelSrc),
        'devRevertToRealMonth() закрывает текущий месяц и стартует РЕАЛЬНЫЙ текущий mskMonthKey() (не launch_month)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

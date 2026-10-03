/**
 * Test: 26.09.2026, по прямому указанию — "переход по ссылке с сайта не даёт награду"
 * + "должна быть возможность удалить ссылку принудительно".
 *
 * Расследование показало: сайт/index.php (генератор) уже строит ссылку как hash-фрагмент
 * (#reward=CODE, фикс от 25.09.2026), но:
 *  1) сайт/logs.php (страница логов получений) забыли обновить — она всё ещё строила ссылку
 *     в СТАРОМ query-формате (?reward=CODE). Если админ копирует и повторно раздаёт ссылку
 *     ИМЕННО с этой страницы — она снова ломается тем же способом (VK Mini Apps не пробрасывает
 *     произвольные query-параметры из публичной vk.com/app<id>?... в iframe, см. комментарий в
 *     index.php).
 *  2) На БОЕВОМ сервере (/var/www/stalker/rewards-admin/index.php, залито 25.09.2026 20:13)
 *     всё ещё лежала СТАРАЯ версия с ?reward= — то есть реальный корневой баг ("не работает
 *     СЕЙЧАС") был именно в том, что фикс от 25.09 не долетел до продакшена этого отдельного
 *     сайта (в отличие от игрового клиента, который уже был задеплоен с hash-парсингом).
 *     Этот тест проверяет только ЛОКАЛЬНЫЙ исходник (единственный источник правды перед
 *     деплоем) — сам факт "залито на прод или нет" тестом не ловится, для этого нужен деплой.
 *
 * Также добавлена кнопка принудительного отключения ссылки (soft-delete через active=0 —
 * реальное DELETE сломало бы JOIN логов получений в logs.php), т.к. до этого в коде НЕ было
 * ни одного способа отключить/удалить уже созданную ссылку — только read-only таблица.
 *
 * Run: node tests/rewards-admin-hash-format-and-delete-link.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const siteRoot = path.join(__dirname, '..', '..', '..', 'сайт');
const indexSrc = fs.readFileSync(path.join(siteRoot, 'index.php'), 'utf-8');
const logsSrc  = fs.readFileSync(path.join(siteRoot, 'logs.php'), 'utf-8');
const cssSrc   = fs.readFileSync(path.join(siteRoot, 'style.css'), 'utf-8');

console.log('\nTest 1: index.php — генерация и листинг ссылок используют hash-фрагмент (#reward=), не query (?reward=)');
{
    assert(/VK_APP_LINK \. '#reward=' \. urlencode\(\$code\)/.test(indexSrc), 'генерация новой ссылки — #reward=');
    assert(/VK_APP_LINK \. '#reward=' \. urlencode\(\$r\['code'\]\)/.test(indexSrc), 'ссылка в таблице "Последние ссылки" — #reward=');
    assert(!/VK_APP_LINK \. '\?reward='/.test(indexSrc), 'в index.php не осталось старого ?reward=');
}

console.log('\nTest 2: logs.php — фикс той же ошибки (ссылка в логах получений тоже была ?reward=, теперь #reward=)');
{
    assert(/VK_APP_LINK \. '#reward=' \. urlencode\(\$r\['code'\]\)/.test(logsSrc), 'ссылка на странице логов получений — #reward=');
    assert(!/VK_APP_LINK \. '\?reward='/.test(logsSrc), 'в logs.php не осталось старого ?reward=');
}

console.log('\nTest 3: index.php — новый обработчик принудительного отключения ссылки (action=deactivate)');
{
    const start = indexSrc.indexOf("\$_POST['action'] === 'deactivate'");
    assert(start !== -1, 'обработчик action=deactivate присутствует');
    const body = indexSrc.slice(start, start + 500);
    assert(/UPDATE reward_links SET active = 0 WHERE id = \?/.test(body), 'отключает ссылку через active=0 (не DELETE — не ломает JOIN истории получений в logs.php)');
    assert(/bind_param\('i', \$delId\)/.test(body), 'id ссылки биндится как int (защита от SQL-инъекции)');
    assert(/header\('Location: index\.php'\);/.test(body), 'редирект после действия (Post-Redirect-Get, без повторной отправки формы при обновлении страницы)');
}

console.log('\nTest 4: index.php — CSRF-защищённая форма-кнопка "Удалить" появляется у каждой активной ссылки');
{
    assert(/<th>Действие<\/th>/.test(indexSrc), 'колонка "Действие" добавлена в шапку таблицы');
    const formStart = indexSrc.indexOf('name="action" value="deactivate"');
    assert(formStart !== -1, 'форма отправляет action=deactivate');
    const formBlock = indexSrc.slice(formStart - 300, formStart + 300);
    assert(/name="csrf" value="<\?= htmlspecialchars\(\$_SESSION\['csrf'\]\) \?>"/.test(formBlock), 'форма удаления несёт тот же CSRF-токен, что и форма создания (глобальная проверка в config.php)');
    assert(/name="id" value="<\?= intval\(\$r\['id'\]\) \?>"/.test(formBlock), 'форма передаёт id конкретной строки (intval — защита от SQL-инъекции на входе)');
    assert(/onsubmit="return confirm\(/.test(formBlock), 'подтверждение перед необратимым действием (принудительное отключение)');
    assert(/if\(intval\(\$r\['active'\]\)\)/.test(indexSrc), 'кнопка показывается только для ещё активных ссылок (уже выключенную нечего выключать повторно)');
}

console.log('\nTest 5: colspan таблицы обновлён с 7 на 8 (добавилась колонка "Действие")');
{
    assert(/<td colspan="8">Ссылок пока нет<\/td>/.test(indexSrc), 'colspan пустой таблицы = 8 (было 7 до добавления колонки "Действие")');
}

console.log('\nTest 6: style.css — стиль для компактной кнопки удаления в таблице (не как большая кнопка "Сгенерировать")');
{
    assert(/\.btn-del\s*\{/.test(cssSrc), 'класс .btn-del добавлен');
}

console.log('\nTest 7: 27.09.2026, по прямому указанию — "убери из ссылки на игру id Володи" — VK_APP_LINK в index.php и logs.php больше не содержит личный id (_438953352), только app_id');
{
    assert(/const VK_APP_LINK = 'https:\/\/vk\.com\/app54574178';/.test(indexSrc), 'index.php: VK_APP_LINK === https://vk.com/app54574178 (без суффикса)');
    assert(/const VK_APP_LINK = 'https:\/\/vk\.com\/app54574178';/.test(logsSrc), 'logs.php: VK_APP_LINK === https://vk.com/app54574178 (без суффикса, своя копия константы)');
    // Пояснительный комментарий у самой правки в index.php сам называет убранное число
    // (438953352) — это ожидаемо и не регрессия, поэтому проверяем только АКТИВНЫЙ код,
    // не комментарии (то же самое, что и с VK_APP_LINK-строкой выше).
    const indexActive = indexSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    const logsActive  = logsSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert(!indexActive.includes('438953352'), 'index.php: активный код не содержит личный id 438953352 (комментарии не в счёт)');
    assert(!logsActive.includes('438953352'), 'logs.php: активный код не содержит личный id 438953352 (комментарии не в счёт)');
    // Регресс-гвард на сам формат ссылки (Test 1/2 выше) — после удаления id формат
    // #reward=CODE не должен был сломаться, конкатенация та же самая.
    assert(/VK_APP_LINK \. '#reward=' \. urlencode\(\$code\)/.test(indexSrc), 'генерация ссылки в index.php всё ещё через VK_APP_LINK + #reward= (формат не пострадал)');
    assert(/VK_APP_LINK \. '#reward=' \. urlencode\(\$r\['code'\]\)/.test(logsSrc), 'ссылка в logs.php всё ещё через VK_APP_LINK + #reward= (формат не пострадал)');
}

console.log('\nTest 8: 27.09.2026, по прямому указанию — "перешёл по ссылке два раза, появилась вторая ссылка" — action=create теперь тоже Post-Redirect-Get (как и action=deactivate), F5 после генерации больше не создаёт дубль');
{
    const createStart = indexSrc.indexOf("\$_POST['action'] === 'create'");
    const insertIdx = indexSrc.indexOf('INSERT INTO reward_links', createStart);
    assert(insertIdx !== -1 && insertIdx > createStart, 'INSERT в reward_links найден внутри обработчика action=create');
    const afterInsert = indexSrc.slice(insertIdx, insertIdx + 1500);
    assert(/\$_SESSION\['reward_link_generated'\] = VK_APP_LINK \. '#reward=' \. urlencode\(\$code\);/.test(afterInsert),
        'успешный код передаётся через $_SESSION, а не рендерится сразу в том же ответе');
    assert(/header\('Location: index\.php'\);/.test(afterInsert), 'редирект после INSERT — повторный F5 браузера шлёт GET, а не тот же POST с новым INSERT');
    assert(/exit;/.test(afterInsert), 'exit после redirect — код ниже не выполняется в том же запросе');
    assert(!/\$generatedUrl = VK_APP_LINK \. '#reward=' \. urlencode\(\$code\);\s*\n\s*\}\s*\n\}/.test(indexSrc),
        'старый путь (рендер в том же ответе без редиректа) не остался рядом как мёртвая альтернативная ветка');
    assert(/if\(isset\(\$_SESSION\['reward_link_generated'\]\)\)\{/.test(indexSrc), 'после редиректа $generatedUrl читается из $_SESSION (одноразово)');
    assert(/unset\(\$_SESSION\['reward_link_generated'\]\);/.test(indexSrc), 'флаг из сессии удаляется сразу после чтения — повторный обычный F5 GET-страницы не показывает старую ссылку снова');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

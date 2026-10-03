/**
 * Test: 03.10.2026 (репорт игрока — "урон от друга засчитан (HP упало), но его иконка в
 * рейтинге урона боя с боссом не прогружается, хотя подсказка про помощь друзей была").
 *
 * Корень: window.VK_token не персистится между перезагрузками страницы (живёт только в памяти
 * текущей вкладки) — preloader._scheduleFriendsScopePrompt() тихо восстанавливает его ОДИН РАЗ
 * при старте игры для уже согласившихся игроков (friends_scope_granted='1' в БД), но это
 * best-effort: если игрок открывает бой/рейтинг раньше, чем та попытка долетела до ответа, или
 * сам bridge-запрос один раз сбоит без ретраев, VK_token так и остаётся undefined до конца
 * сессии — bosses._resolveVkUsers() молча отдавала пустые фото ВСЕМ в рейтинге, включая друзей,
 * которые реально помогли с боссом (их имя из entry.nick всё ещё показывалось, фото — нет).
 *
 * Фикс: _resolveVkUsers() теперь, обнаружив отсутствие VK_token при непустом согласии в БД,
 * лениво дозапрашивает токен через pre_control._requestFriendsScope() (глобальный синглтон
 * Preloader, см. index.js) ПРЯМО В МОМЕНТ резолва, и только потом продолжает batch-запрос фото
 * — вместо того чтобы полагаться только на один ранний best-effort запрос при старте.
 *
 * Run: node tests/resolve-vk-users-lazy-token-retry.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');

const start = src.indexOf('proto._resolveVkUsers = function(ids, callback){');
const end   = src.indexOf('\n    };', src.indexOf('_doBatchFetch();', start));
const body  = src.slice(start, end);

console.log('\nTest 1: batch-запрос вынесен в отдельную _doBatchFetch(), чтобы его можно было вызвать и сразу, и после дозапроса токена');
{
    assert(/const _doBatchFetch = \(\) => \{/.test(body), '_doBatchFetch объявлена как отдельная функция внутри _resolveVkUsers');
    assert(/if\(!rest\.length \|\| !window\.bridge \|\| !window\.VK_token\)\{/.test(body), 'старая проверка (нет rest/bridge/token → вернуть out как есть) сохранена внутри _doBatchFetch');
}

console.log('\nTest 2: при отсутствии VK_token, но подтверждённом в БД согласии — лениво дозапрашивается токен перед batch-запросом');
{
    assert(/!window\.VK_token &&\s*\n\s*window\.udata && String\(udata\['friends_scope_granted'\] \|\| '0'\) === '1' &&/.test(body),
        'условие проверяет отсутствие VK_token И friends_scope_granted==="1" в БД');
    assert(/window\.pre_control && typeof pre_control\._requestFriendsScope === 'function' &&\s*\n\s*!pre_control\._friendsScopeRequestPending\)\{/.test(body),
        'используется глобальный синглтон pre_control, не дублирует уже идущий запрос (_friendsScopeRequestPending)');
    assert(/pre_control\._requestFriendsScope\(\(\) => _doBatchFetch\(\)\);/.test(body),
        'после получения токена batch-запрос фото реально выполняется (_doBatchFetch вызывается в колбэке)');
    assert(/return;\s*\n\s*\}\s*\n\s*_doBatchFetch\(\);/.test(body),
        'если ленивый дозапрос не нужен (токен уже есть / запрос уже идёт / согласия нет) — batch идёт сразу, без лишней задержки');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

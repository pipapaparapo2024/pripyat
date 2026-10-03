/**
 * Test: 18.09.2026 — две новые фичи по прямому указанию пользователя.
 *
 * 1) Клик по фото/нику ЛЮБОГО игрока (рамка "УБИВШИЙ" у боссов, рейтинг урона в бою, рамка
 *    уважения в Зоне, топы Сводки по авторитету/урону/достижениям) открывает его публичный
 *    профиль — персонаж с надетыми ИМ шмотками, тот же визуал, что на главном экране, но
 *    read-only и для чужого игрока. Данные — новый server-authoritative эндпоинт
 *    users.getProfile (id → nick/exp/respect/shmot/bosses_killed/total_damage), специально
 *    БЕЗ coins/stew/inventory/weapons — сразу построено server-authoritative, чтобы не
 *    пришлось потом переносить логику с клиента на PHP отдельным шагом.
 *
 * 2) Попап "ЗАЧИСТИ <Локация>!" (недоступен босс — локация не зачищена) теперь при нажатии
 *    ПОНЯТНО сразу открывает Зону на странице с этой локацией — раньше просто закрывался,
 *    игрок должен был сам искать нужную карточку среди 5.
 *
 * Run: node tests/player-profile-and-zone-navigation.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const usersPhp       = readSrc('server/core/controllers/users.php');
const profileJs       = readSrc('_client/src/game/shell/overlays/player_profile.js');
const interfaceJs     = readSrc('_client/src/game/interface.js');
const zoneScreenJs    = readSrc('_client/src/game/shell/overlays/zone_screen.js');
const bossesCombatJs  = readSrc('_client/src/game/bosses/bosses-combat.js');
const bossesSelectJs  = readSrc('_client/src/game/shell/overlays/bosses_select.js');
const bossesPrefightJs = readSrc('_client/src/game/shell/overlays/bosses_prefight.js');
const bossesFightJs   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const svodLeaderboard = readSrc('_client/src/game/svod/svod-leaderboard.js');

console.log('\nTest 1: сервер — users.getProfile зарегистрирован и отдаёт ТОЛЬКО безопасный публичный срез');
{
    // 18.09.2026: следом добавлен 'resetSession' (reset-account-session-fields batch) — проверяем
    // наличие 'getProfile' в permits, не точное совпадение всего массива целиком.
    const permitsMatch = usersPhp.match(/\$this->permits = \[([^\]]*)\];/);
    assert(!!permitsMatch, '$this->permits найден в users.php');
    assert(/'getProfile'/.test(permitsMatch ? permitsMatch[1] : ''), "'getProfile' добавлен в permits Users");
    const start = usersPhp.indexOf('function getProfile(){');
    const end   = usersPhp.indexOf('\n        }', usersPhp.indexOf('$this->registry[\'tools\']->output(', start));
    const body  = usersPhp.slice(start, end);
    assert(!!body && start !== -1, 'getProfile() найден');
    assert(/if\(\$id <= 0\) return \$this->registry\['tools'\]->error\(54\);/.test(body), 'валидирует id (не 0/отрицательный)');
    // 19.09.2026: список расширен полями визитки игрока (gang_id/str_xp_total/achievement_stars/
    // skills_levels/habar_bought/create_time) — по-прежнему явный список, не array('*').
    assert(/\['id', 'nick', 'exp', 'respect', 'shmot', 'bosses_killed', 'total_damage',/.test(body) &&
        /'gang_id', 'str_xp_total', 'achievement_stars', 'skills_levels', 'habar_bought', 'create_time'\]/.test(body),
        'запрашивает у БД явный безопасный список полей (включая поля визитки) — не array(\'*\')');
    ['coins', 'stew', 'cigarettes', 'inventory', 'weapons', 'ammo_'].forEach(dangerous => {
        assert(!body.includes("'" + dangerous), 'НЕ включает опасное/личное поле "' + dangerous + '" в выборку/ответ');
    });
    assert(/'shmot'\s*=>\s*\$shmot,/.test(body), 'отдаёт shmot (декодированный массив) — нужен для отрисовки персонажа');
}

console.log('\nTest 2: клиент player_profile.js — открывает экран ЧЕРЕЗ сервер, не рисует по локальным данным чужого игрока (их и не может быть)');
{
    assert(/proto\._openPlayerProfile = function\(targetId, fallbackNick\)\{/.test(profileJs), '_openPlayerProfile определён');
    assert(/TS\.php\('users\.getProfile', \{id: id\}/.test(profileJs), 'шлёт id на сервер (users.getProfile), не выдумывает данные локально');
    assert(/proto\._buildPlayerProfileScreen = function\(profile, fallbackNick\)\{/.test(profileJs), '_buildPlayerProfileScreen определён');
    assert(/const theirShmot = Array\.isArray\(profile\.shmot\) \? profile\.shmot : \[\];/.test(profileJs),
        'использует ЧУЖОЙ profile.shmot из ответа сервера, а не window.shmot.items (свой инвентарь)');
    assert(/const catalog = \(window\.shmot && Array\.isArray\(shmot\.items\)\) \? shmot\.items : \[\];/.test(profileJs),
        'визуальные метаданные предмета (manDx/manDy/imgFile) берёт из локального СТАТИЧНОГО каталога — он одинаков у всех игроков, тянуть с сервера не нужно');
    assert(/proto\._closePlayerProfile = function\(\)\{/.test(profileJs), '_closePlayerProfile определён (можно закрыть экран)');
}

console.log('\nTest 3: player_profile.js зарегистрирован на Interface.prototype (тот же паттерн, что у остальных оверлеев)');
{
    assert(/import \{ attachPlayerProfile \} from '\.\/shell\/overlays\/player_profile\.js';/.test(interfaceJs), 'импортирован в interface.js');
    assert(/attachPlayerProfile\(Interface\.prototype\);/.test(interfaceJs), 'подключён к Interface.prototype');
}

console.log('\nTest 4: клик открывает профиль в 4 местах — боссы (УБИВШИЙ/рейтинг), Зона (рамка уважения), топы Сводки');
{
    // 28.09.2026 (адаптив под мобильные): фото лежит внутри прокручиваемого списка боссов и
    // переведено с pointerdown на helper.onTap — иначе свайп по списку, начатый с фото, открывал
    // чужой профиль вместо прокрутки. Поведение клика не изменилось.
    assert(/helper\.onTap\(spr, \(\)=>\{ if\(window\.iface\) iface\._openPlayerProfile\(k\.id, u && u\.name\); \}\);/.test(bossesSelectJs),
        'bosses_select.js: фото "УБИВШИЙ" кликабельно, открывает профиль по k.id');
    assert(/rowHit\.on\('pointerdown', \(\)=>\{ if\(rowObj\.id && window\.iface\) iface\._openPlayerProfile\(rowObj\.id, rowObj\.nick\); \}\);/.test(bossesFightJs),
        'bosses_fight.js: строка рейтинга урона кликабельна, открывает профиль по актуальному id строки');
    // 04.10.2026: id/nick теперь выставляются синхронно из top (не ждут VK-резолва, см.
    // incident про зависающий _resolveVkUsers) — row.nick берёт только entry.nick (VK-имя как
    // замена nick для клика по профилю не нужно, nick используется лишь как подпись).
    assert(/row\.id = entry\.id; row\.nick = entry\.nick \|\| null;/.test(bossesFightJs),
        'bosses_fight.js: id/nick строки обновляются при каждом обновлении рейтинга (не залипают на старом игроке)');
    assert(/photoSpr\.on\('pointerdown', \(\)=>\{ if\(window\.iface\) iface\._openPlayerProfile\(l\.id, u && u\.name\); \}\);/.test(zoneScreenJs),
        'zone_screen.js: фото рекордсмена уважения кликабельно, открывает профиль по l.id');
    // 28.09.2026 (адаптив под мобильные): строка топа переведена с pointerdown на helper.onTap —
    // открытие профиля в момент КАСАНИЯ делало свайп-прокрутку топа невозможной (палец всегда
    // начинает свайп с какой-то строки). Поведение клика не изменилось.
    assert(/helper\.onTap\(row, \(\)=>\{ if\(row\._playerId && window\.iface\) iface\._openPlayerProfile\(row\._playerId, row\._playerNick\); \}\);/.test(svodLeaderboard),
        'svod-leaderboard.js: вся строка топа кликабельна, открывает профиль по _playerId');
    assert(/r\.row\._playerId = entry\.id;/.test(svodLeaderboard) && /r\.row\._playerNick = entry\.nick \|\| \(u && u\.name\) \|\| null;/.test(svodLeaderboard),
        'svod-leaderboard.js: _playerId/_playerNick проставляются при обновлении списка (ветка с VK-резолвом)');
}

console.log('\nTest 5: зона — переход на нужную локацию по locIdx');
{
    assert(/proto\._openZoneScreen = function\(targetLocIdx\)\{/.test(zoneScreenJs), '_openZoneScreen принимает необязательный targetLocIdx');
    // 21.09.2026: карусель локаций (см. zone-locations-carousel-slide.test.js) — больше нет
    // деления на страницы по 2, targetLocIdx применяется НАПРЯМУЮ как индекс, но зажимается в
    // MAX_LOC_INDEX (окно показа теперь пара карточек — последний индекс TOTAL_LOCS-2, чтобы
    // последняя локация всегда показывалась частью полной пары, не "повисшей" одна).
    assert(/if\(typeof targetLocIdx === 'number' && targetLocIdx >= 0 && targetLocIdx <= 4\)\{\s*\n[\s\S]*?this\._zoneLocIndex = Math\.min\(targetLocIdx, MAX_LOC_INDEX\);/.test(zoneScreenJs),
        'targetLocIdx применяется как индекс локации (без деления на 2 — страниц больше нет), зажатый в MAX_LOC_INDEX, ДО первой отрисовки');
}

console.log('\nTest 6: "ЗАЧИСТИ X!" — ПОНЯТНО ведёт в Зону на нужную локацию (оба места: атака и предбой)');
{
    const attackStart = bossesCombatJs.indexOf("if(!this._isLocCleared(d.boss_loc)){");
    const attackEnd   = bossesCombatJs.indexOf('\n        }', attackStart);
    const attackBody  = bossesCombatJs.slice(attackStart, attackEnd);
    assert(/notify\.showResult\(\{text:'Зачисти '\+\(locNames\[d\.boss_loc\]\|\|'локацию'\)\+' для доступа!'\}, 0, \(\) => \{/.test(attackBody),
        'bosses-combat.js._attack(): showResult получил onClose-колбэк (3-й аргумент)');
    assert(/iface\._openZoneScreen\(d\.boss_loc\);/.test(attackBody), 'колбэк открывает Зону именно на d.boss_loc');

    // 27.09.2026 (по прямому указанию): проверка лимита/ключей/локации переехала с маленькой
    // кнопки карточки боссов (bosses_select.js) на большую кнопку "Напасть" экрана предпросмотра
    // (bosses_prefight.js.napBtn) — см. комментарий в самом файле. Смотреть тут.
    const prefightStart = bossesPrefightJs.indexOf("if(locIdx >= 0 && window.zone && !zone.getCleared(locIdx)){");
    const prefightEnd   = bossesPrefightJs.indexOf('\n                }', prefightStart);
    const prefightBody  = bossesPrefightJs.slice(prefightStart, prefightEnd);
    assert(/notify\.showResult\(\{text:'Зачисти ' \+ \(LOC_NAMES\[locIdx\] \|\| 'локацию'\) \+ '!'\}, 0, \(\) => \{/.test(prefightBody),
        'bosses_prefight.js: showResult получил onClose-колбэк (3-й аргумент)');
    assert(/iface\._openZoneScreen\(locIdx\);/.test(prefightBody), 'колбэк открывает Зону именно на locIdx');
}

console.log('\nTest 7: sanity — notify.showResult() действительно поддерживает onClose-колбэк для ошибок (random_num=0), иначе Test 6 бессмыслен');
{
    const notifySrc = readSrc('_client/src/game/notifications.js');
    assert(/showResult\(data, random_num = 0, onClose = null\)\{/.test(notifySrc), 'showResult принимает onClose третьим параметром');
    assert(/if\(random_num === 0\) this\._showErrorSprite\(data\['text'\] \|\| data, onClose\);/.test(notifySrc),
        'random_num=0 (ошибка, тот же попап "ЗАЧИСТИ X!") прокидывает onClose дальше');
    const errStart = notifySrc.indexOf('_showErrorSprite(text, onClose){');
    const errEnd   = notifySrc.indexOf('\n\t}', errStart);
    const errBody  = notifySrc.slice(errStart, errEnd);
    assert(/if\(this\._onCloseCallback\)\{ const cb = this\._onCloseCallback; this\._onCloseCallback = null; cb\(\); \}/.test(errBody),
        'кнопка ПОНЯТНО (okBtn) реально вызывает onClose при закрытии попапа');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

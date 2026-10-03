/**
 * Test: 04.10.2026, по прямому указанию (повторный репорт по достижениям + 2 новых трюка).
 *
 * 1) "Пригласи друзей" → "Имей друзей" — чисто текстовая правка, логика (friendsCount — реальное
 *    число друзей, не инвайты) уже была верной.
 *
 * 2) "Победи в pvp... зашел в базу к игроку, нажал зарубиться, если выиграл — засчитано" —
 *    zaruba.php.fight() был read-only (ничего не писал), категория 'pvp' в движке достижений
 *    существовала с 15.09.2026, но pvp_wins никто не инкрементировал. Теперь при победе
 *    зарубе пишется pvp_wins, patch уходит клиенту, клиент после победы зовёт _checkAll().
 *
 * 3) "«Сходи в качалку», оно выполняет за позыв через базу игрока в качалку «позвать в
 *    качалку»" — cat 'gym' переключена с личных тренировок (trainCount) на приглашения,
 *    отправленные игроком (gymInvitesSent, растёт у ИНИЦИАТОРА в zaruba.php.pump(), не у
 *    цели — Сила цели по-прежнему считается отдельно).
 *
 * 4) "1 картинка почему-то достижения выполнены, но звёздочка не фулл и не написано кол-во
 *    очков" — прогресс-бар карточки живёт от live udata (мгновенно 100%), звезда/очки/галочка —
 *    от window.achievements.earned (обновляется только ПОСЛЕ ответа сервера). Если "Мои
 *    достижения" уже открыты в момент ответа — экран не перерисовывался сам. Добавлен
 *    Svod.refreshOpenAchievements(), вызывается из achievements.js._syncWithServer().
 *
 * Run: node tests/achievements-pvp-gym-friends-semantics-and-svod-live-refresh.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf-8');

const ifaceAch   = read('_client', 'src', 'game', 'interface', 'interface-achievements.js');
const achList    = read('_client', 'src', 'game', 'achievements.js');
const zaruba     = read('server', 'core', 'controllers', 'zaruba.php');
const engine     = read('server', 'core', 'models', 'achievementengine.php');
const profile    = read('_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js');
const svod       = read('_client', 'src', 'game', 'svod.js');
const migration  = read('server', 'migrate46.php');
const config     = JSON.parse(read('server', 'json', 'achievements_config.json'));

console.log('\nTest 1: "Пригласи друзей" заменено на "Имей друзей", логика friendsCount не тронута');
{
    assert(ifaceAch.includes("friends:      n => `Имей ${_fmtAchNum(n)} друзей в игре`,"), 'новый текст описания');
    assert(!ifaceAch.includes('Пригласи'), 'старый текст "Пригласи" убран');
    assert(achList.includes('statPath:["friendsCount"]'), 'statPath достижений друзей не менялся (уже был верным)');
}

console.log('\nTest 2: zaruba.php.fight() инкрементирует pvp_wins при победе и отдаёт patch');
{
    const start = zaruba.indexOf('function fight(){');
    const end   = zaruba.indexOf('\n        }', zaruba.indexOf('$this->ops->ok(', start));
    const body  = zaruba.slice(start, end);
    assert(/if\(\$won\)\{\s*\n\s*\$user\['pvp_wins'\] = \$this->ops->i\(\$user, 'pvp_wins'\) \+ 1;/.test(body),
        'pvp_wins инкрементируется только при won===true');
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(body), 'saveUser() вызывается для сохранения pvp_wins');
    assert(/\$patch = \$won \? \$this->ops->patchCurrencies\(\$user, \['pvp_wins'\]\) : \[\];/.test(body), 'patch содержит pvp_wins только при победе');
    assert(/'patch'\s*=>\s*\$patch,/.test(body), 'patch уходит в ответе клиенту');
}

console.log('\nTest 3: клиент проверяет достижения после победы в Зарубе');
{
    const start = profile.indexOf('proto._startZaruba');
    const end   = profile.indexOf('};', profile.indexOf('_buildZarubaResultScreen(win, res);', start));
    const body  = profile.slice(start, end);
    assert(/applyPatch\(res\.patch\);/.test(body), 'patch применяется');
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(body), '_checkAll() вызывается после применения patch');
}

console.log('\nTest 4: категория pvp в achievements.js больше не помечена "спящей"');
{
    assert(!achList.includes('СПЯЩАЯ'), 'комментарий "СПЯЩАЯ категория" убран');
    assert(achList.includes("pvpWins:      parseInt(udata['pvp_wins']      || 0),"), '_state() по-прежнему читает pvp_wins (без изменений в логике чтения)');
}

console.log('\nTest 5: zaruba.php.pump() инкрементирует gym_invites_sent у ИНИЦИАТОРА, не у цели');
{
    const start = zaruba.indexOf('function pump(){');
    const body  = zaruba.slice(start);
    assert(/\$user\['gym_invites_sent'\] = \$this->ops->i\(\$user, 'gym_invites_sent'\) \+ 1;/.test(body),
        'счётчик инкрементируется у $user (визитёр), не у $targetRow (цель)');
    assert(/\$patch = \$this->ops->patchCurrencies\(\$user, \['gym_pump_cooldowns', 'gym_invites_sent'\]\);/.test(body),
        'gym_invites_sent включён в patch клиенту');
}

console.log('\nTest 6: клиент проверяет достижения после "позвать в качалку"');
{
    const start = profile.indexOf('proto._startGymPump');
    const end   = profile.indexOf('};', profile.indexOf('_showGymPumpBanner();', start));
    const body  = profile.slice(start, end);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(body), '_checkAll() вызывается после применения patch');
}

console.log('\nTest 7: cat gym в achievements.js/interface-achievements.js переключена на gymInvitesSent');
{
    assert((achList.match(/statPath:\["gymInvitesSent"\]/g) || []).length === 6, 'все 6 тиров gym_* используют gymInvitesSent');
    assert(!achList.includes('statPath:["trainCount"]'), 'старый statPath trainCount для gym убран целиком');
    assert(achList.includes("gymInvitesSent: parseInt(udata['gym_invites_sent'] || 0),"), '_state() читает новое поле');
    assert(ifaceAch.includes('gym:          n => `Позови в качалку ${_fmtAchNum(n)} раз`,'), 'описание "Позови в качалку", не "Сходи в качалку"');
}

console.log('\nTest 8: achievementengine.php (сервер) строит gymInvitesSent из gym_invites_sent');
{
    assert(engine.includes("'gymInvitesSent' => \$ops->i(\$user, 'gym_invites_sent'),"), 'buildState() читает новое поле');
}

console.log('\nTest 9: achievements_config.json — все 6 gym_* тиров используют gymInvitesSent, trainCount не используется нигде');
{
    const gymEntries = config.filter(a => a.cat === 'gym');
    assert(gymEntries.length === 6, 'ровно 6 записей cat=gym в каталоге');
    assert(gymEntries.every(a => JSON.stringify(a.statPath) === '["gymInvitesSent"]'), 'у всех statPath === ["gymInvitesSent"]');
    assert(!config.some(a => JSON.stringify(a.statPath) === '["trainCount"]'), 'trainCount нигде в каталоге больше не используется');
}

console.log('\nTest 10: миграция 46 добавляет pvp_wins и gym_invites_sent');
{
    assert(migration.includes("stalker_migrate46_2026"), 'уникальный ключ миграции');
    assert(/foreach\(\['pvp_wins', 'gym_invites_sent'\] as \$col\)/.test(migration), 'добавляет обе колонки в одном проходе');
    assert(migration.includes("VARCHAR(64) DEFAULT '0'"), 'тип колонки — VARCHAR(64) DEFAULT \'0\', как у остальных server-only счётчиков');
}

console.log('\nTest 11: pvp_wins/gym_invites_sent НЕ в клиентском whitelist users.save (server-only)');
{
    const usersPhp = read('server', 'core', 'controllers', 'users.php');
    assert(!usersPhp.includes("'pvp_wins'"), 'pvp_wins не в whitelist — подделать через users.save нельзя');
    assert(!usersPhp.includes("'gym_invites_sent'"), 'gym_invites_sent не в whitelist — подделать через users.save нельзя');
}

console.log('\nTest 12: Svod.refreshOpenAchievements() обновляет открытый экран "Мои достижения"');
{
    assert(/refreshOpenAchievements\(\)\{/.test(svod), 'метод объявлен в классе Svod');
    const start = svod.indexOf('refreshOpenAchievements(){');
    const end   = svod.indexOf('\n    }', start);
    const body  = svod.slice(start, end);
    assert(/this\._svodPanels\['ach'\]/.test(body), 'читает панель именно по ключу \'ach\'');
    assert(/achPanel\.visible/.test(body), 'перерисовывает, только если панель реально видима сейчас');
    assert(/achPanel\._svodRefreshAchievements\(\);/.test(body), 'вызывает штатный refresh панели');
}

console.log('\nTest 13: achievements.js вызывает refreshOpenAchievements() сразу после _loadFromUdata()');
{
    // achList содержит ДВА вызова _loadFromUdata() (первый — при старте в start(), нас
    // интересует именно тот, что внутри _syncWithServer) — берём последний.
    const idx1 = achList.lastIndexOf('this._loadFromUdata();');
    const idx2 = achList.indexOf('svod.refreshOpenAchievements();');
    assert(idx1 > -1 && idx2 > -1 && idx2 > idx1 && idx2 - idx1 < 400,
        'вызов идёт сразу после _loadFromUdata() (локальный earned уже синхронизирован к этому моменту)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

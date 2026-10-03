/**
 * Test: батч 17.09.2026 — «рейтинг урона» (бой с боссом) должен показывать ИСКЛЮЧИТЕЛЬНО
 * друзей, и логика кнопки ПЕРЕЗАГРУЗКА (подтягивание урона друзей + обновление рейтинга)
 * теперь включается автоматически при каждом ударе игрока, не только по ручному клику.
 *
 *  - server/core/controllers/bosses.php.rating() — раньше глобальный топ-3 (был явно сделан
 *    таким в прошлой сессии из-за жалобы "сильный игрок пропадал из рейтинга друзей"), теперь
 *    снова ограничен друзьями (тот же список, что friendsDamage() уже использует).
 *  - bosses-combat.js._attack() — добавлен дебаунсированный (800мс) автовызов
 *    _syncFriendsDamage(), обновляющий HP/статы/рейтинг экрана боя через iface, если он ещё
 *    открыт на том же боссе к моменту ответа сервера.
 *  - friendDmgApplied (счётчик уже применённой помощи друзей) продолжает обнуляться по
 *    окончании боя (и по таймауту, и по победе) — рейтинг помощи не переживает между боями,
 *    это уже было корректно реализовано раньше, просто дополнительно закреплено тестом.
 *
 * Run: node tests/boss-friends-damage-auto-sync-and-rating-scope.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
const combatSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');

// 18.09.2026: парсинг id друзей вынесен в общий private-хелпер _friendIds($user) (используется
// и friendsDamage(), и rating() — не дублируется инлайн в каждом методе). Суть проверки та же:
// rating() ограничен друзьями + собой, не глобальный топ.
console.log('\nTest 1: bosses.php.rating() ограничен друзьями (не глобальный топ) — 22.09.2026, читает свою строку напрямую');
{
    // 22.09.2026 (второй раз, отдельный батч — попап победы над боссом): rating() дальше
    // разбит на общий _ratingTop(), переиспользуемый claimKill() (см.
    // boss-victory-popup-top-and-double-kill-count-fix.test.js). Окно расширено на обе функции.
    const start = bossesPhp.indexOf('private function _ratingTop(');
    const end   = bossesPhp.indexOf('function killers()');
    const body  = bossesPhp.slice(start, end);

    // Механика переехала на derived-HP/boss_damage_log (см. большой комментарий в bosses.php
    // над _derivedHp()) — своя строка больше не строится через $ids=[uid]+merge, а читается
    // напрямую одним getData(), но суть "друзья, не глобальный топ" не изменилась.
    // 04.10.2026: 'friends_since' добавлен в список полей (нужен rating() для honest-карты
    // $friendsSince через _friendsSinceMap() — фикс бага "друзья бьют, в рейтинге их нет", см.
    // tests/boss-friendssince-map-all-call-sites.test.js, Test 7/8).
    assert(/\$me = \$this->registry\['udb'\]->getData\(\$this->registry\['utb'\], array\('bosses_data', 'friends', 'friends_since', 'nick'\), 'id='\.\$this->registry\['uid'\]\);/.test(body),
        'rating() читает СВОЮ строку (включая friends/friends_since) одним запросом');
    // 22.09.2026: friendIds теперь дополнительно гейтится diffIdx!==3 прямо в этом же
    // выражении (раньше проверка была отдельным блоком ниже) — суть (общий хелпер _friendIds())
    // не изменилась.
    assert(/\$friendIds = \(!isset\(\$me\['error'\]\) && \$diffIdx !== 3\) \? \$this->_friendIds\(\$me\) : \[\];/.test(body),
        'парсит id друзей через общий хелпер _friendIds() (тот же, что использует friendsDamage())');
    assert(/private function _friendIds\(\$user\)\{/.test(bossesPhp), '_friendIds() определён как общий приватный хелпер');
    // 24.09.2026: маркер конца сдвинут на следующую функцию по факту ('private function
    // _isLocCleared' определена РАНЬШЕ _friendIds() в файле — indexOf() находил её первое,
    // более раннее вхождение, из-за чего срез получался пустым (known cosmetic false-negative,
    // не реальный баг) — теперь берём то, что реально следует за _friendIds() по тексту файла.
    const friendIdsBody = bossesPhp.slice(bossesPhp.indexOf('private function _friendIds($user){'), bossesPhp.indexOf('// ── КЭШ HP'));
    assert(/foreach\(explode\(',', \$user\['friends'\]\) as \$fid\)/.test(friendIdsBody), '_friendIds() парсит id из explode по полю friends');

    // 04.10.2026 (по прямому указанию — "может быть такое что я не попаду в топ"): своя строка
    // больше не идёт в общий $entries наравне с друзьями (где её мог вытеснить array_slice) —
    // теперь отдельная $myEntry, гарантированно домёрживаемая в итоговый список ниже, см.
    // tests/boss-damage-rating.test.js.
    assert(/\$myEntry = \$myDmg > 0 \? \['id' => \$uid, 'damage' => \$myDmg, 'nick' => \$nick\] : null;/.test(body),
        'свой id тоже входит в выборку (иначе игрок не увидит себя в собственном рейтинге друзей) — теперь гарантированно, не только при удачном array_slice');
    // 23.09.2026 (по прямому указанию, AskUserQuestion): фильтр boss_id добавлен только для
    // СВОЕГО урона (_damageSumSince) — friends-функции сознательно оставлены кросс-боссовыми,
    // см. boss-rating-hp-scoped-by-boss-id.test.js.
    // 29.09.2026: вызов получил ещё excludeSedoy=true (см. tests/boss-sedoy-excluded-from-
    // friend-rating.test.js) — сам friendIds-скоуп (не boss_id) не изменился.
    // 30.09.2026 (прогон перед деплоем): _friendsDamagePerUserSince() отрефакторили на приём
    // готовой карты $friendsSince вместо отдельных $friendIds+$startMs — сигнатура 3-аргументная.
    assert(/\$perUser = \$this->_friendsDamagePerUserSince\(\$link, \$friendsSince, true\);/.test(body),
        'урон друзей выбирается ТОЛЬКО по своему списку друзей (через карту friendsSince) — не выбирает всех игроков; кросс-боссовая помощь сознательно сохранена');
}

console.log('\nTest 2: урон от друзей виден сразу на каждый удар — 22.09.2026, встроено прямо в ответ bosses.attack(), без отдельного шага синхронизации');
{
    // _syncFriendsDamageSoon()/отдельный вызов после каждого удара убраны целиком — ответ
    // bosses.attack() САМ содержит уже готовый производный HP (мой урон + урон друзей
    // суммируются в ОДНОМ запросе, см. bosses.php._derivedHp), задержка теперь буквально 0 —
    // это тот же результат, что раньше давал _syncFriendsDamageSoon (обновить HP/статы/рейтинг
    // сразу на удар), просто без отдельного шага и без дебаунса.
    assert(combatSrc.indexOf('proto._syncFriendsDamageSoon') === -1, '_syncFriendsDamageSoon убран — его роль теперь выполняет сам ответ bosses.attack()');
    const attackStart = combatSrc.indexOf('proto._attack = function');
    const attackEnd   = combatSrc.indexOf('\n    };', attackStart);
    const attackBody  = combatSrc.slice(attackStart, attackEnd);
    assert(/this\._setHp\(idx, res\.hp\);/.test(attackBody), '_attack() выставляет HP из ответа сервера на каждый удар — уже включает урон друзей на этот момент');
    assert(/det\.hp_bar\.setPercent\(res\.hp \/ this\._maxHp\(idx\)\);/.test(attackBody), 'HP-бар обновляется сразу в том же колбэке, без отдельного запроса рейтинга/статов');
}

console.log('\nTest 3: помощь друзей (friendDmgApplied) не переживает окончание боя — сбрасывается и по таймауту, и по победе');
{
    const timeoutStart = combatSrc.indexOf('proto._onFightTimeout = function(idx){');
    const timeoutEnd   = combatSrc.indexOf('};', timeoutStart);
    assert(/this\.friendDmgApplied\[this\._diffIdx\]\[idx\] = 0;/.test(combatSrc.slice(timeoutStart, timeoutEnd)),
        'friendDmgApplied обнуляется при истечении таймера боя');

    // Та же строка сброса встречается и в _onFightTimeout (уже проверено выше) — ищем
    // ВТОРОЕ вхождение, начиная поиск после конца блока таймаута, чтобы попасть именно в _onDefeat.
    // 18.09.2026: после переноса награды на сервер (claimKill) _onDefeat сбрасывает
    // friendDmgApplied/_curCycleDmg ДВАЖДЫ — один раз в success-колбэке (обычный путь), один раз
    // в error-колбэке (сервер отказал, напр. дневной лимит — игрок всё равно не должен
    // застревать с "залипшим" состоянием боя), оба раза используют локальную diffIdx, не this._diffIdx.
    const defeatStart = combatSrc.indexOf("if(Array.isArray(this._curCycleDmg)) this._curCycleDmg[idx] = 0;", timeoutEnd);
    const nearDefeat = combatSrc.slice(defeatStart, defeatStart + 200);
    assert(/this\.friendDmgApplied\[diffIdx\]\[idx\] = 0;/.test(nearDefeat),
        'friendDmgApplied обнуляется и при победе над боссом (рядом со сбросом _curCycleDmg)');
    const occurrences = (combatSrc.match(/this\.friendDmgApplied\[diffIdx\]\[idx\] = 0;/g) || []).length;
    assert(occurrences === 2, `сброс происходит и в success-, и в error-колбэке claimKill (найдено ${occurrences} раза)`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

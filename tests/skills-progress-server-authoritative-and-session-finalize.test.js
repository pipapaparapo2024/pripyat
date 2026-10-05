/**
 * Test: батч 22.09.2026 (по прямому указанию — "читеры могут делать себе огромное кол-во очков
 * скиллов через консоль") —
 *
 * Было: skillsDmgSpent (сколько урона накоплено на следующее очко скилла) жил в
 * client-writable udata['skills_data'] — читер мог одним users.save выставить
 * skillsDmgSpent=999999999, мгновенно "заработать" сотни очков и тут же прокачать ими реальные
 * уровни через (уже server-authoritative) skills.upgrade() — то есть единственная реальная
 * проверка ("хватает ли очков") была бесполезна против подделанного ВХОДНОГО числа.
 *
 * Стало: skillsDmgSpent переехал в server-only skills_levels (вместе с levels) —
 * {levels, dmgSpent, sessionStartPoints}. Растёт ТОЛЬКО внутри bosses.php.attack(), на
 * реальный, только что посчитанный сервером урон. Существующим игрокам прогресс не обнуляется
 * — сервер один раз подхватывает то, что уже накопил клиент (тот же приём, что раньше уже был
 * применён к levels при переносе 18.09.2026).
 *
 * "Сессия" (попытка боя) по-прежнему считается сервером: sessionStartPoints фиксируется в
 * startFight() на реальном старте новой попытки, и если за попытку не был получен ни один
 * новый уровень — весь накопленный за неё прогресс откатывается до пола текущего уровня. Это
 * теперь делает claimKill() (победа) и новый bosses.endFightSession() (таймаут/форфейт/крестик)
 * — тот же принцип, что раньше был целиком на клиенте (skills.js._endSession()).
 *
 * Run: node tests/skills-progress-server-authoritative-and-session-finalize.test.js
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

const bossesPhp = readSrc('server/core/controllers/bosses.php');
const skillsPhp = readSrc('server/core/controllers/skills.php');
const combatJs  = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightJs   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const skillsJs  = readSrc('_client/src/game/skills.js');

console.log('\nTest 1: bosses.php — permits содержит endFightSession, _loadSkillsState/_finalizeSkillSession определены');
{
    assert(/\$this->permits = \[.*'endFightSession'.*\];/.test(bossesPhp), "'endFightSession' добавлен в permits");
    assert(bossesPhp.indexOf('private function _loadSkillsState($user){') !== -1, '_loadSkillsState() определена');
    // 04.10.2026 (стале-пин, не регрессия): сигнатура сменилась с "(&$user)" на "($user)" —
    // см. tests/boss-finalize-skill-session-pass-by-reference-fix.test.js.
    assert(bossesPhp.indexOf('private function _finalizeSkillSession($user){') !== -1, '_finalizeSkillSession() определена');
    assert(bossesPhp.indexOf('function endFightSession(){') !== -1, 'endFightSession() определена');
}

console.log('\nTest 2: bosses.php._loadSkillsState() мигрирует dmgSpent из старого client-writable skills_data ровно один раз');
{
    const start = bossesPhp.indexOf('private function _loadSkillsState($user){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/if\(!isset\(\$state\['dmgSpent'\]\)\)\{/.test(body), 'миграция срабатывает ТОЛЬКО если dmgSpent ещё не существует в skills_levels (один раз)');
    assert(/\$oldSkillsData = \$this->ops->j\(\$user, 'skills_data', \[\]\);/.test(body), 'читает старый прогресс из client-writable skills_data для миграции');
    assert(/if\(!isset\(\$state\['sessionStartPoints'\]\)\) \$state\['sessionStartPoints'\] = 0;/.test(body), 'sessionStartPoints по умолчанию 0, если ещё не заморожен');
}

console.log('\nTest 3: bosses.php.attack() копит dmgSpent на реальный урон, с капом на total_points');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$skillsState = \$this->_loadSkillsState\(\$user\);/.test(body), 'attack() читает состояние скиллов через _loadSkillsState()');
    assert(/if\(\$this->_skillEarnedPoints\(\$sCatalog, intval\(\$skillsState\['dmgSpent'\]\)\) < intval\(\$sCatalog\['total_points'\]\)\)\{/.test(body),
        'копит dmgSpent, только если ещё не выбит потолок очков (460) — тот же кап, что был у skills.js.addFightDamage()');
    // 24.09.2026 (баг "убил босса с 50 HP ударом на 950, шкала опыта заполнилась на 1150
    // вместо 1000", по прямому указанию): было $damage (сырой расчётный урон удара, на
    // добивающем ударе почти всегда больше остатка HP) — заменено на $dealt (фактический
    // урон, ДОШЕДШИЙ до босса, тот же, что пишется в boss_damage_log/total_damage) — сумма
    // за весь бой теперь всегда равна ровно maxHp, не больше.
    // 26.09.2026 (по прямому указанию — "в очки скиллов придёт только урон который ты ударил,
    // похуй на хп босса"): реверс — dmgSpent растёт на полный $damage удара, не обрезанный
    // остатком HP босса (тот же принцип теперь у всех пожизненных метрик в attack()).
    assert(/\$skillsState\['dmgSpent'\] = intval\(\$skillsState\['dmgSpent'\]\) \+ \$damage;/.test(body),
        'dmgSpent растёт на полный $damage удара (не обрезанный остатком HP)');
    assert(/\$patchKeys = \['total_damage', 'bosses_data', 'skills_levels'\];/.test(body), 'skills_levels включён в patch — клиент сразу видит свежий прогресс');
}

console.log('\nTest 4: bosses.php.startFight() замораживает sessionStartPoints на реальном старте НОВОЙ попытки');
{
    const start = bossesPhp.indexOf('function startFight(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.indexOf('$this->ops->ok([\'patch\' => $patch, \'bossStartMs\' => $activeStartMs', start));
    const body  = bossesPhp.slice(start, end);
    assert(/\$skillsState\['sessionStartPoints'\] = \$this->_skillEarnedPoints\(\$this->ops->catalog\('skills_config'\), intval\(\$skillsState\['dmgSpent'\]\)\);/.test(body),
        'sessionStartPoints = earnedPoints НА МОМЕНТ старта — та же роль, что client-side skills.beginSession() раньше играл сам');
    assert(/\$patch = \$this->ops->patchCurrencies\(\$user, \['bosses_data', 'skills_levels'\]\);/.test(body),
        'skills_levels включён в patch ответа startFight()');
}

console.log('\nTest 5: bosses.php._finalizeSkillSession() откатывает прогресс до пола уровня БЕЗУСЛОВНО (22.09.2026: было "только если левелапа не было", убрано по прямому указанию — см. skills-always-reset-progress-on-new-fight.test.js)');
{
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): сигнатура сменилась с
    // "(&$user)" на "($user)" (функция сама лочит строку и возвращает {json,locked}, см.
    // tests/boss-finalize-skill-session-pass-by-reference-fix.test.js). Безусловный откат
    // теперь встречается ДВАЖДЫ (залоченная + фолбэк ветки) — проверяем хотя бы одно совпадение.
    const start = bossesPhp.indexOf('private function _finalizeSkillSession($user){');
    const end   = bossesPhp.indexOf('\n        }\n\n        // Фиксирует ИСТИННОЕ окончание боя', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$earned = \$this->_skillEarnedPoints\(\$sCatalog, intval\(\$state\['dmgSpent'\]\)\);/.test(body), 'earned считается по ТЕКУЩЕМУ dmgSpent');
    assert(!/\$sessionStart = intval\(\$state\['sessionStartPoints'\]\);/.test(body), 'sessionStart больше не читается здесь — условная проверка левелапа убрана');
    assert(!/if\(\$earned <= \$sessionStart\)\{/.test(body), 'условный откат убран — теперь безусловный');
    assert(/\$state\['dmgSpent'\] = \$this->_skillTotalDmgForPoints\(\$sCatalog, \$earned\);/.test(body),
        'безусловно откатывает dmgSpent до пола ТЕКУЩЕГО уровня после каждой попытки — полное обнуление прогресса до следующего очка, даже если очко получено');
}

console.log('\nTest 6: _finalizeSkillSession() вызывается из claimKill() (победа) и из endFightSession() (таймаут/форфейт/крестик)');
{
    const claimStart = bossesPhp.indexOf('function claimKill(){');
    const claimEnd   = bossesPhp.indexOf('\n        }', bossesPhp.lastIndexOf('function claimKill('));
    const claimBody  = bossesPhp.slice(claimStart, bossesPhp.indexOf('\n\t}', claimStart));
    assert(/\$this->_finalizeSkillSession\(\$user\);/.test(claimBody), 'claimKill() (победа) финализирует сессию скиллов');
    assert(/'ryukzak_points','hata_progress','bosses_data','skills_levels',/.test(bossesPhp), 'claimKill() включает skills_levels в возвращаемый patch');

    const endStart = bossesPhp.indexOf('function endFightSession(){');
    const endEnd   = bossesPhp.indexOf('\n        }', endStart);
    const endBody  = bossesPhp.slice(endStart, endEnd);
    assert(/\$this->_finalizeSkillSession\(\$user\);/.test(endBody), 'endFightSession() тоже финализирует сессию скиллов — та же логика для НЕ-победных концовок');
    // 24.09.2026: $patchKeys расширен (условно добавляет 'bosses_data', если boss_id/diff_idx
    // переданы и bossStartMs реально сбрасывается — см. boss-defeat-popup-fresh-rating-top-no-race.test.js) —
    // 'skills_levels' остаётся В ЛЮБОМ случае базовым элементом массива.
    assert(/\$patchKeys = \['skills_levels'\];/.test(endBody), 'endFightSession() всегда включает skills_levels в базовый набор patchKeys');
    assert(/\$patch = \$this->ops->patchCurrencies\(\$user, \$patchKeys\);/.test(endBody), 'endFightSession() возвращает свежий skills_levels (и, если применимо, bosses_data) в patch');
}

console.log('\nTest 7: skills.php.upgrade() читает dmgSpent из server-only skills_levels (не из client-writable skills_data), сохраняет dmgSpent/sessionStartPoints при записи levels');
{
    assert(skillsPhp.indexOf('private function _loadState($user){') !== -1, '_loadState() определена (объединила levels+dmgSpent+sessionStartPoints)');
    const upStart = skillsPhp.indexOf('function upgrade(){');
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): наивная граница
    // "\n        }" находила ЗАКРЫВАЮЩУЮ скобку одного из новых if-блоков лока (rollback/
    // close), а не конец самой upgrade() — функция стала длиннее. Используем конец файла
    // (upgrade() — последний метод класса) как надёжную границу.
    const upEnd   = skillsPhp.indexOf('\n    }\n?>', upStart);
    const upBody  = skillsPhp.slice(upStart, upEnd);
    assert(/\$state  = \$this->_loadState\(\$userForState\);/.test(upBody), 'upgrade() читает единое состояние через _loadState() (теперь из $userForState — локального снимка под локом/фолбэком, не из исходного $user напрямую, см. tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js)');
    // 25.09.2026: earned больше не считается прямо в upgrade() — переехал внутрь
    // _syncSkillPoints() (persist points-баланс, см. tests/skills-server-authoritative.test.js
    // Test 10), но по-прежнему читает server-only state.dmgSpent — подделать нечем.
    assert(/this->_syncSkillPoints\(\$state, \$catalog\);/.test(upBody), 'upgrade() синхронизирует баланс очков через _syncSkillPoints() перед тратой');
    const syncStart = skillsPhp.indexOf('private function _syncSkillPoints(&$state, $catalog){');
    const syncEnd   = skillsPhp.indexOf('\n        }', syncStart);
    const syncBody  = skillsPhp.slice(syncStart, syncEnd);
    assert(/\$earned = \$this->_calcPoints\(\$catalog, intval\(\$state\['dmgSpent'\] \?\? 0\)\);/.test(syncBody),
        'earned считается по server-only state.dmgSpent — подделать через users.save/skills_data больше нельзя');
    assert(!/\$this->_skillsDmgSpent\(\$user\)/.test(upBody), 'старый вызов _skillsDmgSpent(), читавший client-writable skills_data, убран');
    // 04.10.2026 (стале-пин, не регрессия): итог теперь кодируется в $finalSkillsJson (пишется
    // отдельным UPDATE под локом или напрямую в $user в фолбэк-ветке), а не прямым
    // "$user['skills_levels'] = json_encode($state)" — см. tests/race-conditions-skills-
    // weapons-ryukzak-casino-04-10.test.js. Сохранение levels ВНУТРИ того же state-объекта
    // (не отдельным полем) не менялось.
    assert(/\$state\['levels'\] = \$levels;\s*\n\s*\$finalSkillsJson = json_encode\(\$state\);/.test(upBody),
        'сохраняет levels ВНУТРИ того же state-объекта — dmgSpent/sessionStartPoints не перезаписываются нулём при апгрейде');
}

console.log('\nTest 8: клиент — _attack()/claimKill()/endFightSession() перечитывают skills_levels через _loadLevelsFromUdata(), а не считают сами');
{
    assert(!/if\(window\.skills\) skills\.addFightDamage\(/.test(combatJs), 'skills.addFightDamage() больше не вызывается из bosses-combat.js — сервер сам копит dmgSpent');

    const attackStart = combatJs.indexOf('proto._attack = function');
    const attackEnd   = combatJs.indexOf('\n    };', attackStart);
    assert(/if\(window\.skills\) skills\._loadLevelsFromUdata\(\);/.test(combatJs.slice(attackStart, attackEnd)),
        '_attack() синхронизирует прогресс скиллов из свежего patch после каждого удара');

    const defeatStart = combatJs.indexOf('proto._onDefeat = function');
    const defeatEnd   = combatJs.indexOf('\n    };', defeatStart);
    assert(/if\(window\.skills\) skills\._loadLevelsFromUdata\(\);/.test(combatJs.slice(defeatStart, defeatEnd)),
        '_onDefeat() (победа) синхронизирует прогресс скиллов после claimKill()');

    const timeoutStart = combatJs.indexOf('proto._onFightTimeout = function');
    const timeoutEnd   = combatJs.indexOf('\n    };', timeoutStart);
    const timeoutBody  = combatJs.slice(timeoutStart, timeoutEnd);
    // 24.09.2026: сигнатура расширена ({boss_id, diff_idx} вместо {}) — endFightSession()
    // теперь сам считает top рейтинга до сброса bossStartMs, см. boss-defeat-popup-fresh-rating-top-no-race.test.js.
    assert(/TS\.php\('bosses\.endFightSession', \{boss_id: idx, diff_idx: diffIdxAtLoss\}, \(res\) => \{/.test(timeoutBody), '_onFightTimeout() вызывает bosses.endFightSession() — таймаут теперь финализируется на сервере');
    assert(/if\(window\.skills\) skills\._loadLevelsFromUdata\(\);/.test(timeoutBody), '_onFightTimeout() синхронизирует прогресс после ответа endFightSession()');
}

console.log('\nTest 9: bosses_fight.js._forfeitBossFight() тоже вызывает endFightSession()');
{
    const start = fightJs.indexOf('proto._forfeitBossFight = function');
    const end   = fightJs.indexOf('\n    };', start);
    const body  = fightJs.slice(start, end);
    assert(/TS\.php\('bosses\.endFightSession', \{boss_id: idx, diff_idx: diffIdx\}, \(res\) => \{/.test(body), 'форфейт («ВЫЙТИ ИЗ БОЯ») вызывает bosses.endFightSession()');
    assert(/applyPatch\(res\.patch\);/.test(body) && /if\(window\.skills\) skills\._loadLevelsFromUdata\(\);/.test(body),
        'применяет патч и синхронизирует прогресс скиллов после ответа');
}

console.log('\nTest 10: skills.js._loadLevelsFromUdata() теперь читает dmgSpent/sessionStartPoints, не только levels');
{
    const start = skillsJs.indexOf('_loadLevelsFromUdata(){');
    const end   = skillsJs.indexOf('\n\t}', start);
    const body  = skillsJs.slice(start, end);
    assert(/if\(s\.dmgSpent !== undefined\) this\.skillsDmgSpent = parseInt\(s\.dmgSpent\) \|\| 0;/.test(body), 'читает dmgSpent из skills_levels');
    assert(/if\(s\.sessionStartPoints !== undefined\) this\._sessionStartPoints = parseInt\(s\.sessionStartPoints\) \|\| 0;/.test(body), 'читает sessionStartPoints из skills_levels');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

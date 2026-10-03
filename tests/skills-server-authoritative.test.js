/**
 * Test: 18.09.2026 — SERVER-AUTHORITATIVE СКИЛЛЫ. Раньше levels[20] (реальная прокачка
 * каждого скилла) хранился ВНУТРИ udata['skills_data'] — поля, которое ВСЕГДА было в
 * client-writable whitelist users.php (это нужно для skillsDmgSpent, который остаётся
 * client-reported, как и сам урон по боссам). Значит игрок мог одним users.save с
 * поддельным skills_data (levels: Array(20).fill(100)) мгновенно прокачать ВСЕ 20 скиллов
 * до максимума бесплатно — клиентская проверка availablePoints в upgrade() для такого
 * читера никогда даже не вызывалась бы. Теперь levels хранятся в НОВОМ служебном поле
 * skills_levels (НЕ в whitelist, как dice_session/yashik_session/roulette_cups) — клиент
 * физически не может подделать его через users.save.
 *
 * Run: node tests/skills-server-authoritative.test.js
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

const skillsSrc   = readSrc('_client/src/game/skills.js');
const skillsPhp   = readSrc('server/core/controllers/skills.php');
const registrySrc = readSrc('server/core/models/registry.php');
const usersPhp    = readSrc('server/core/controllers/users.php');
const migrate19   = readSrc('server/migrate19.php');
const catalogJson = JSON.parse(readSrc('server/json/skills_config.json'));

console.log('\nTest 1: сервер — контроллер Skills зарегистрирован и реализует upgrade()');
{
    assert(/'classes'\s*=>\s*array\([^)]*'skills'/.test(registrySrc.replace(/\n/g, '')),
        "'skills' добавлен в registry.php classes (иначе universal.php отклонит метод как невалидный класс)");
    assert(/permits\s*=\s*\['upgrade'\]/.test(skillsPhp), 'Skills.permits — только upgrade');
    assert(/function upgrade\(\)/.test(skillsPhp), 'метод upgrade() существует');
}

console.log('\nTest 2: skills_levels НЕ в client-writable whitelist (ключевая защита от чита)');
{
    // 19.09.2026: сужено до массива $allowed — 'skills_levels' легитимно упоминается ещё и в
    // users.resetSession() ('skills_levels' => null), проверка по всему файлу стала ложно-отрицательной.
    const allowedMatch = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    assert(!/'skills_levels'/.test(allowedMatch ? allowedMatch[1] : ''),
        "'skills_levels' сознательно НЕ добавлен в \$allowed users.php — клиент не может подделать через users.save");
    assert(/'skills_data'/.test(usersPhp),
        "'skills_data' остаётся в whitelist (skillsDmgSpent там же, тот же уровень доверия, что урон по боссам)");
}

console.log('\nTest 3: миграция 19 создаёт служебное поле skills_levels');
{
    assert(/\$col = 'skills_levels';/.test(migrate19), 'миграция нацелена на колонку skills_levels');
    assert(/ALTER TABLE `\{\$registry\['utb'\]\}` ADD COLUMN `\$col` \$def/.test(migrate19), 'использует ALTER TABLE ADD COLUMN (тот же паттерн, что migrate17/18)');
    assert(/TEXT DEFAULT NULL/.test(migrate19), 'тип TEXT (JSON-блоб, как dice_session/yashik_session)');
}

console.log('\nTest 4: каталог skills_config.json совпадает построчно с клиентскими данными (maxLvl × 20, формула очков)');
{
    const clientMaxLvl = [10,20,10,10,10,10,10,10,10,50,30,5,8,7,10,60,70,10,10,100];
    assert(JSON.stringify(catalogJson.max_lvl) === JSON.stringify(clientMaxLvl),
        'max_lvl — все 20 значений совпадают 1-в-1 с maxLvl в skills.js this.list[]');
    assert(catalogJson.total_points === 460, 'total_points === 460 (клиент: "20 скиллов — суммарно 460 очков")');
    assert(catalogJson.point_base_cost === 1000 && catalogJson.point_cost_step === 185,
        'формула стоимости очка (1000 + (N-1)*185) совпадает с клиентской _pointCost()');
}

console.log('\nTest 5: skills.php.upgrade() — та же арифметика очков, что клиент (earned/spent/available)');
{
    const start = skillsPhp.indexOf('function upgrade(){');
    const end   = skillsPhp.indexOf('\n        }', skillsPhp.indexOf('$this->ops->ok', start));
    const body  = skillsPhp.slice(start, end);

    assert(/if\(\$sid < 0 \|\| \$sid > 19\) return \$this->ops->fail\(76\);/.test(body), 'отклоняет id вне диапазона 0-19');
    assert(/if\(intval\(\$levels\[\$sid\]\) >= \$maxLvl\) return \$this->ops->fail\(77\);/.test(body),
        'отклоняет апгрейд сверх maxLvl этого конкретного скилла (у каждого свой потолок, не общий)');
    assert(!/usedFreeFirstSkill/.test(body), '18.09.2026: льгота "первый уровень скилла 0 бесплатно" удалена целиком — usedFreeFirstSkill не встречается');
    // 25.09.2026: доступные очки читаются из персистентного $state['points'] (см. Test 10),
    // не пересчитываются earned-spent на лету — сама проверка "минимум 1" осталась.
    assert(/if\(intval\(\$state\['points'\] \?\? 0\) < 1\) return \$this->ops->fail\(78\);/.test(body),
        'требует минимум 1 доступное очко БЕЗУСЛОВНО, для любого skill_id, включая 0');

    // Сверяем формулу spentPoints (18.09.2026: льготы больше нет, все уровни считаются одинаково).
    const spentStart = skillsPhp.indexOf('private function _spentPoints($levels){');
    const spentEnd   = skillsPhp.indexOf('\n        }', spentStart);
    const spentBody  = skillsPhp.slice(spentStart, spentEnd);
    assert(/foreach\(\$levels as \$v\) \$spent \+= intval\(\$v\);/.test(spentBody),
        'spentPoints: суммирует ВСЕ уровни одинаково, включая первый уровень скилла 0 — как в клиентском геттере');
}

console.log('\nTest 6: миграция существующих игроков — сервер подхватывает СТАРЫЙ прогресс из skills_data, если skills_levels ещё пуст');
{
    // 22.09.2026: _loadLevels($user) объединена с _skillsDmgSpent($user) в единый _loadState()
    // — теперь мигрирует ОБА поля (levels И dmgSpent) одним и тем же приёмом, см. большой
    // комментарий в skills.php над _loadState().
    const start = skillsPhp.indexOf('private function _loadState($user){');
    assert(start !== -1, '_loadState() определена (объединила _loadLevels()/_skillsDmgSpent())');
    const end   = skillsPhp.indexOf('\n        }', start);
    const body  = skillsPhp.slice(start, end);
    assert(/\$oldData = \$this->ops->j\(\$user, 'skills_data', \[\]\);/.test(body),
        'при отсутствии levels в skills_levels — сервер читает старый прогресс из skills_data ОДИН РАЗ, не обнуляя существующим игрокам прокачку');
    assert(/\$oldSkillsData = \$this->ops->j\(\$user, 'skills_data', \[\]\);/.test(body),
        'при отсутствии dmgSpent в skills_levels — сервер ТОЖЕ подхватывает его из skills_data один раз (22.09.2026, закрывает консольный чит очков)');
}

console.log('\nTest 7: клиент skills.js — upgrade() асинхронный, зовёт сервер, не считает сам');
{
    assert(skillsSrc.includes("import { applyPatch } from '../modules/patch.js';"), 'импортирует applyPatch');

    const start = skillsSrc.indexOf('upgrade(idx, onDone){');
    const end   = skillsSrc.indexOf('\n\t}', skillsSrc.indexOf("TS.php('skills.upgrade'", start));
    const body  = skillsSrc.slice(start, end);
    assert(start !== -1, 'upgrade(idx, onDone) найден (сигнатура с необязательным колбэком для внешних вызывающих мест)');
    assert(/TS\.php\('skills\.upgrade', \{skill_id: idx\}/.test(body), 'шлёт skill_id на сервер');
    assert(!/this\.levels\[idx\]\+\+;/.test(body), 'больше НЕ инкрементирует levels[idx] локально (это делает сервер)');
    assert(!/usedFreeFirstSkill/.test(body), 'льготы для скилла 0 больше нет — usedFreeFirstSkill нигде не упоминается');
    assert(/applyPatch\(res\.patch\)/.test(body), 'применяет патч сервера');
    assert(/this\._loadLevelsFromUdata\(\)/.test(body), 'перечитывает levels из обновлённого skills_levels после патча');
    assert(/err && err\.code === 78/.test(body), 'отдельно обрабатывает код 78 (недостаточно очков) — показывает попап');
    assert(/err && err\.code === 77/.test(body), 'отдельно обрабатывает код 77 (уже максимум)');
}

console.log('\nTest 8: оба места вызова upgrade() (кнопка ПРОКАЧАТЬ и +1 уровень) больше не ветвятся по возврату — вся UI-логика внутри upgrade()');
{
    const occurrences = (skillsSrc.match(/this\.upgrade\((i|realIdx)\);/g) || []).length;
    assert(occurrences === 2, 'оба вызывающих места используют fire-and-forget this.upgrade(...) — найдено ' + occurrences);
    assert(!/if\(this\.upgrade\(/.test(skillsSrc), 'нигде не осталось старого "if(this.upgrade(...))" (синхронный возврат больше не используется)');
}

console.log('\nTest 9: _saveToUdata()/_loadFromUdata() — skillsDmgSpent всё ещё пишется в skills_data, но это больше НЕ источник истины');
{
    // 22.09.2026: skillsDmgSpent переехал в server-only skills_levels.dmgSpent (см.
    // skills.php._loadState()) — эта запись в client-writable skills_data осталась исключительно
    // как легаси/резерв для одноразовой миграции (skills.php читает её только пока
    // skills_levels.dmgSpent ещё не существует), сервер больше НИКОГДА её не перечитывает
    // после первого захвата, так что переписать что-то реальное этим уже нельзя.
    const saveStart = skillsSrc.indexOf('_saveToUdata(){');
    const saveEnd   = skillsSrc.indexOf('\n\t}', saveStart);
    const saveBody  = skillsSrc.slice(saveStart, saveEnd);
    assert(/skillsDmgSpent: this\.skillsDmgSpent/.test(saveBody), 'skillsDmgSpent по-прежнему пишется в skills_data — легаси-эхо, сервер больше не доверяет этому значению после миграции');
    assert(!/levels: this\.levels/.test(saveBody), 'levels больше НЕ пишется в skills_data (это больше не источник истины)');
    assert(!/usedFreeFirstSkill: this\.usedFreeFirstSkill/.test(saveBody), 'usedFreeFirstSkill больше НЕ пишется в skills_data');
}

console.log('\nTest 10: 25.09.2026 (по прямому указанию — "может будем сохранять отдельным полем") — персистентный баланс очков (points/earnedBaseline)');
{
    const bossesPhp = readSrc('server/core/controllers/bosses.php');

    // skills.php._syncSkillPoints
    const s1 = skillsPhp.indexOf('private function _syncSkillPoints(&$state, $catalog){');
    const e1 = skillsPhp.indexOf('\n        }', s1);
    assert(s1 !== -1, 'skills.php._syncSkillPoints() определена');
    const b1 = skillsPhp.slice(s1, e1);
    assert(/if\(!isset\(\$state\['earnedBaseline'\]\)\)\{/.test(b1), 'мигрирует существующих игроков (earnedBaseline ещё не существует) — считает points = earned - spent один раз');
    assert(/\$delta = \$earned - intval\(\$state\['earnedBaseline'\]\);/.test(b1), 'иначе начисляет только ДЕЛЬТУ новых очков, не earned целиком');
    assert(/\$state\['points'\] = intval\(\$state\['points'\] \?\? 0\) \+ \$delta;/.test(b1), 'дельта добавляется к уже накопленному балансу, не заменяет его');

    // skills.php.upgrade() тратит points напрямую
    const s2 = skillsPhp.indexOf('function upgrade(){');
    const e2 = skillsPhp.indexOf('\n        }', skillsPhp.indexOf('$this->ops->ok', s2));
    const b2 = skillsPhp.slice(s2, e2);
    assert(/this->_syncSkillPoints\(\$state, \$catalog\);/.test(b2), 'upgrade() синхронизирует баланс перед тратой (подхватывает очки, накопленные с прошлой синхронизации)');
    assert(/\$state\['points'\] = intval\(\$state\['points'\]\) - 1;/.test(b2), 'тратит ровно 1 очко из персистентного баланса');

    // bosses.php._syncSkillPoints — тот же дублированный хелпер, что и в skills.php
    const s3 = bossesPhp.indexOf('private function _syncSkillPoints(&$state, $catalog){');
    assert(s3 !== -1, 'bosses.php._syncSkillPoints() определена (дублирована по тому же принципу, что остальные skill-хелперы)');

    // bosses.php.attack() пополняет баланс сразу на реальный урон
    const s4 = bossesPhp.indexOf('function attack(){');
    const e4 = bossesPhp.indexOf('\n        }', bossesPhp.indexOf('$this->ops->ok', s4));
    const b4 = bossesPhp.slice(s4, e4);
    assert(/this->_syncSkillPoints\(\$skillsState, \$sCatalog\);/.test(b4),
        'attack() синхронизирует points сразу после роста dmgSpent — баланс актуален уже к следующему upgrade(), без лишнего похода за earned-spent');

    // Клиент читает готовый баланс, не пересчитывает earned-spent
    const s5 = skillsSrc.indexOf('get availablePoints(){');
    const e5 = skillsSrc.indexOf('\n\t}', s5);
    const b5 = skillsSrc.slice(s5, e5);
    assert(/this\._skillPoints !== undefined \? this\._skillPoints/.test(b5),
        'availablePoints возвращает серверный баланс this._skillPoints, если он уже синхронизирован');
    assert(/if\(s\.points !== undefined\) this\._skillPoints = parseInt\(s\.points\) \|\| 0;/.test(skillsSrc),
        '_loadLevelsFromUdata() читает points из skills_levels в this._skillPoints');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

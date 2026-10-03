/**
 * Test: батч 22.09.2026 (по прямому указанию — "все (или почти все) шмотки достаются с
 * боссов, то что на сервере не совпадает с тем что должно быть") —
 *
 * До этого батча персональные вещи боссов (id 41+ в game/shmot.js, каждая со своим полем
 * source/set/fragments) существовали ТОЛЬКО как клиентские данные — реального механизма их
 * получения не было вообще (owned всегда false, недостижимо). Добавлен server-authoritative
 * дроп: НЕЗАВИСИМЫЙ от общего дропа (id0-40) второй блок в bosses.php.claimKill() — свой пул
 * на пару (bossId, режим), заданный в bosses_config.json.boss_shmot_drop_pool (сверен построчно
 * с source-полями в game/shmot.js).
 *
 * 22.09.2026 (тот же день, уточнение шансов по прямому указанию):
 *  - соло-вещи (любой босс) — 100%, 1 килл = 1 вещь, пока не собрана.
 *  - фрагменты сета "ссср" (обычный режим Охотника/Счастливчика/Ястреба, fragment_items=20) —
 *    100%, +1 часть за КАЖДОЕ убийство (не по шансу).
 *  - остальные "цельные" вещи обычного режима (Меченный/Крыс/Баркут/Борода/Жгут) —
 *    boss_shmot_normal_chance_pct (50%) за убийство.
 *  - dev_force_drops (личный флаг аккаунта, дев-панель) форсирует 100% на всё выше сразу.
 * Прогресс фрагментов — server-only поле shmot_fragments (users.php — НЕ в whitelist, клиент
 * не может подделать).
 *
 * Run: node tests/boss-personal-shmot-drop-pool.test.js
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
const bossesCfg = JSON.parse(readSrc('server/json/bosses_config.json'));
const usersPhp  = readSrc('server/core/controllers/users.php');
const shmotJs   = readSrc('_client/src/game/shmot.js');

console.log('\nTest 1: bosses_config.json — boss_shmot_drop_pool сверен построчно с source-полями в game/shmot.js (8 боссов, normal+solo)');
{
    const pool = bossesCfg.boss_shmot_drop_pool;
    assert(!!pool, 'boss_shmot_drop_pool присутствует в каталоге');
    for(let bossId = 0; bossId <= 7; bossId++){
        assert(!!pool[String(bossId)], `bossId ${bossId} есть в пуле`);
        assert(Array.isArray(pool[String(bossId)].normal), `bossId ${bossId}.normal — массив`);
        assert(Array.isArray(pool[String(bossId)].solo), `bossId ${bossId}.solo — массив`);
    }

    // Извлекаем this.items из shmot.js и сверяем каждый id пула с реальным source в каталоге —
    // "обычный режим" → normal[], "соло" → solo[], имя босса из source должно совпадать с
    // bosses_config.json.bosses[bossId].name.
    const itemsBlockMatch = shmotJs.match(/this\.items = \[([\s\S]*?)\n\t\t\];/);
    const itemsBlock = itemsBlockMatch ? itemsBlockMatch[1] : '';
    const items = [];
    for(const line of itemsBlock.split('\n')){
        const idM = line.match(/\{id:(\d+),/);
        const sourceM = line.match(/source:'([^']*)'/);
        if(idM && sourceM) items.push({ id: +idM[1], source: sourceM[1] });
    }

    const bossByName = {};
    bossesCfg.bosses.forEach(b => { bossByName[b.name] = b.id; });

    for(const it of items){
        const normalM = it.source.match(/^(.+) \(обычный режим\)$/);
        const soloM   = it.source.match(/^(.+) \(соло\)$/);
        if(normalM){
            const bossId = bossByName[normalM[1]];
            assert(bossId !== undefined, `id${it.id}: source "${it.source}" — босс "${normalM[1]}" найден в bosses_config.json`);
            if(bossId !== undefined){
                assert(pool[String(bossId)].normal.includes(it.id),
                    `id${it.id} (${it.source}) присутствует в boss_shmot_drop_pool[${bossId}].normal`);
            }
        } else if(soloM){
            const bossId = bossByName[soloM[1]];
            assert(bossId !== undefined, `id${it.id}: source "${it.source}" — босс "${soloM[1]}" найден в bosses_config.json`);
            if(bossId !== undefined){
                assert(pool[String(bossId)].solo.includes(it.id),
                    `id${it.id} (${it.source}) присутствует в boss_shmot_drop_pool[${bossId}].solo`);
            }
        }
    }
}

console.log('\nTest 2: bosses_config.json — fragment_items совпадает с fragments:20 в game/shmot.js (ровно id 41, 42, 43)');
{
    const frag = bossesCfg.fragment_items;
    assert(!!frag, 'fragment_items присутствует в каталоге');
    assert(Object.keys(frag).length === 3, 'ровно 3 предмета с фрагментной сборкой, получили ' + Object.keys(frag).length);
    for(const id of [41, 42, 43]){
        assert(frag[String(id)] === 20, `fragment_items[${id}] === 20`);
    }
    // Обратная проверка — в game/shmot.js ТОЛЬКО эти 3 id имеют fragments:20, остальные — null.
    const fragMatches = [...shmotJs.matchAll(/\{id:(\d+),[^}]*fragments:20,/g)].map(m => +m[1]);
    assert(fragMatches.length === 3 && [41,42,43].every(id => fragMatches.includes(id)),
        'в game/shmot.js fragments:20 стоит ровно у id41/42/43, получили: ' + fragMatches.join(','));
}

console.log('\nTest 3: claimKill() — второй, независимый блок дропа персональных вещей боссов');
{
    const start = bossesPhp.indexOf('// 22.09.2026 (по прямому указанию, финальная сверка полного присланного списка');
    const end   = bossesPhp.indexOf('// Сброс состояния боя', start);
    assert(start !== -1 && end !== -1 && end > start, 'блок найден');
    const body = bossesPhp.slice(start, end);

    assert(/if\(\$diffIdx === 0 \|\| \$diffIdx === 3\)\{/.test(body),
        'блок обрабатывается только для играбельных режимов (0=обычный, 3=соло)');
    assert(/\$modeKey\s*=\s*\$diffIdx === 0 \? 'normal' : 'solo';/.test(body), 'режим боя транслируется в ключ пула normal/solo');
    assert(/\$bossPool = \$catalog\['boss_shmot_drop_pool'\]\[strval\(\$bossId\)\]\[\$modeKey\] \?\? \[\];/.test(body),
        'пул берётся из каталога по конкретному bossId+режиму, не общий id0-40');
    assert(/if\(empty\(\$bossShmotState\[\$iid\]\['owned'\]\)\) \$available\[\] = \$iid;/.test(body),
        'кандидаты — только ещё не полученные вещи ЭТОГО пула (владение проверяется по актуальному $user[\'shmot\'], включая изменения первого блока дропа этого же убийства)');
    assert(/\$needFrag = intval\(\$fragmentItems\[strval\(\$wonId\)\] \?\? 0\);/.test(body), 'читает нужное число частей из fragment_items (0 = вещь цельная, без сборки)');

    // 22.09.2026 (уточнение шансов, тот же день): соло и фрагменты — 100% (без броска),
    // "цельные" вещи обычного режима — по проценту boss_shmot_normal_chance_pct (50%), либо
    // мгновенно при включённом dev_force_drops.
    assert(/\$isSolo = \$diffIdx === 3;/.test(body), 'явно вычисляет "это соло-убийство?"');
    // 23.09.2026: бросок вынесен в отдельную $normalRoll переменную (логируется в debug-ответе
    // как claimDebug.bossPersonalPoolDrop) — сама формула/порядок условий не изменились.
    assert(/\$normalRoll = mt_rand\(1, 100\);/.test(body) &&
        /\$roll = \$isSolo \|\| \$needFrag > 0 \|\| \$devForceDrops\s*\n\s*\|\| \$normalRoll <= intval\(\$catalog\['boss_shmot_normal_chance_pct'\] \?\? 100\);/.test(body),
        'соло ИЛИ фрагмент ИЛИ dev-флаг — гарантированно (100%); иначе — по проценту boss_shmot_normal_chance_pct');

    assert(/\$have = intval\(\$fragState\[strval\(\$wonId\)\] \?\? 0\) \+ 1;/.test(body), 'фрагментная вещь: +1 к накопленному прогрессу за срабатывание (гарантированному, не по шансу)');
    assert(/if\(\$have >= \$needFrag\)\{/.test(body), 'при достижении нужного числа частей — вещь становится owned=true');
    assert(/unset\(\$fragState\[strval\(\$wonId\)\]\);/.test(body), 'после сборки прогресс по этой вещи очищается (не остаётся "20/20" мусором)');
    assert(/\$user\['shmot_fragments'\] = json_encode\(\$fragState\);/.test(body), 'обновлённый прогресс сохраняется в $user перед saveUser()');
    assert(/if\(\$bossShmotItemId !== null\)\{\s*\n\s*\$shmotAmount\+\+;/.test(body),
        'полная вещь из этого пула увеличивает общий shmotAmount (тот же счётчик, что общий пул выше — попап не различает источник)');
}

console.log('\nTest 3b: bosses_config.json — boss_shmot_normal_chance_pct задан (50%, шанс на "цельную" вещь обычного режима)');
{
    assert(bossesCfg.boss_shmot_normal_chance_pct === 50, 'boss_shmot_normal_chance_pct === 50, получили ' + bossesCfg.boss_shmot_normal_chance_pct);
}

console.log('\nTest 3c: claimKill() — dev_force_drops форсирует 100% на персональном (боссовом) пуле');
{
    // 01.10.2026 (ревизия политики выдачи одежды казино/боссов, см.
    // tests/casino-loot-policy.test.js и tests/boss-shmot-drop-in-claim-kill.test.js): общий пул
    // (id0-40, shmot_drop_chance_pct/commonDropRoll/commonDropHit) убран из claimKill() целиком
    // как класс механики — dev_force_drops с тех пор форсирует ТОЛЬКО персональный боссовый
    // пул (Test 3 выше — $roll = $isSolo || $needFrag > 0 || $devForceDrops || ...), общего
    // пула для форсирования больше не существует.
    const generalStart = bossesPhp.indexOf('$devForceDrops = !empty($user[\'dev_force_drops\']);');
    assert(generalStart !== -1, '$devForceDrops вычисляется один раз в начале блока дропа');
    assert(!/commonDropRoll/.test(bossesPhp) && !/commonDropHit/.test(bossesPhp) && !/shmot_drop_chance_pct/.test(bossesPhp),
        'общий пул (id0-40) и его отдельный бросок не существуют — удалены ревизией 01.10.2026, не только замаскированы');
    assert(/\$roll = \$isSolo \|\| \$needFrag > 0 \|\| \$devForceDrops\s*\n\s*\|\| \$normalRoll <= intval\(\$catalog\['boss_shmot_normal_chance_pct'\] \?\? 100\);/.test(bossesPhp),
        'персональный (боссовый) пул: dev_force_drops в OR перед обычным броском — форсирует 100% без изменения формулы шанса');
}

console.log('\nTest 4: shmot_fragments — server-only поле (НЕ в whitelist users.php.save, но чистится при resetSession)');
{
    const allowedStart = usersPhp.indexOf('$allowed = [');
    const allowedEnd   = usersPhp.indexOf('];', allowedStart);
    const allowedBody  = usersPhp.slice(allowedStart, allowedEnd);
    assert(!/'shmot_fragments'/.test(allowedBody), 'shmot_fragments отсутствует в whitelist $allowed — клиент не может подделать прогресс сборки через users.save');

    const resetStart = usersPhp.indexOf('function resetSession(){');
    const resetEnd    = usersPhp.indexOf('\n        }', resetStart);
    const resetBody   = usersPhp.slice(resetStart, resetEnd);
    assert(/'shmot_fragments'\s*=> null,/.test(resetBody), 'полный сброс аккаунта обнуляет shmot_fragments (не остаётся частичного прогресса после сброса)');
}

console.log('\nTest 5: claimKill() возвращает bossShmotItemId/bossShmotFragment клиенту, shmot_fragments включён в patch');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.lastIndexOf('$this->ops->ok([');
    const okStart = bossesPhp.indexOf('$this->ops->ok([', end);
    const okEnd   = bossesPhp.indexOf(']);', okStart);
    const okBody  = bossesPhp.slice(okStart, okEnd);

    assert(/'bossShmotItemId' => \$bossShmotItemId,/.test(okBody), 'ответ содержит bossShmotItemId (id собранной именно сейчас вещи, или null)');
    assert(/'bossShmotFragment' => \$bossShmotFragment,/.test(okBody), 'ответ содержит bossShmotFragment ({id,have,need} или null)');

    // bosses.php содержит НЕСКОЛЬКО вызовов patchCurrencies($user, [...]) в разных методах —
    // ищем именно тот, что внутри claimKill() (start/end этой функции уже вычислены выше).
    const claimKillBody = bossesPhp.slice(start, okEnd);
    const patchStart = claimKillBody.indexOf('$patch = $this->ops->patchCurrencies($user, [');
    const patchEnd   = claimKillBody.indexOf(']);', patchStart);
    assert(patchStart !== -1, 'вызов patchCurrencies найден именно внутри claimKill()');
    const patchBody  = claimKillBody.slice(patchStart, patchEnd);
    assert(/'shmot_fragments',/.test(patchBody), 'shmot_fragments включён в patchCurrencies — клиент видит прогресс сборки через applyPatch');
}

console.log('\nTest 6: клиент (bosses-combat.js) резолвит bossShmotItemId/bossShmotFragment по своему каталогу и показывает тост');
{
    const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');
    assert(/if\(res\.bossShmotItemId != null\)\{/.test(combatSrc), 'проверяет полную вещь, собранную именно в этом убийстве');
    assert(/const wonIt = shmot\.items\.find\(x => x\.id === res\.bossShmotItemId\);/.test(combatSrc),
        'название резолвится по window.shmot.items (id — общий источник правды с сервером)');
    assert(/else if\(res\.bossShmotFragment && res\.bossShmotFragment\.id != null\)\{/.test(combatSrc), 'иначе проверяет частичный прогресс фрагмента');
}

console.log('\nTest 7: shmot.js читает shmot_fragments из udata и хранит прогресс на инстансе (для тултипа магазина)');
{
    const start = shmotJs.indexOf('_loadFromUdata(){');
    const end   = shmotJs.indexOf('\n\t}', start);
    const body  = shmotJs.slice(start, end);
    assert(/this\.fragmentsProgress = \{\};/.test(body), 'инициализирует fragmentsProgress при каждой загрузке (не копит устаревшее между аккаунтами/сбросами)');
    assert(/helper\.safeParseJSON\(udata\['shmot_fragments'\], null\)/.test(body), 'парсит udata[\'shmot_fragments\'] (приходит через applyPatch из claimKill) — safeParseJSON, переживает и строку, и уже раскодированный объект от Database::trueJSON()');
}

console.log('\nTest 8: тултип магазина шмоток показывает реальный прогресс сборки для фрагментных вещей');
{
    const shopSrc = readSrc('_client/src/game/shell/overlays/shmot_shop.js');
    const start = shopSrc.indexOf('proto._showShopTip = function');
    const end   = shopSrc.indexOf('\n    };', start);
    const body  = shopSrc.slice(start, end);
    assert(/if\(item\.fragments && !item\.owned\)\{/.test(body), 'проверяет именно фрагментные ещё-не-собранные вещи');
    // 25.09.2026 (регресс найден повторным прогоном тестов): тултип переделан со списка строк
    // (lines.push) на светлую карточку-референс — прогресс сборки теперь дописывается в
    // reqText ("Требования:" карточки), тем же текстом "Собрано частей: N/20".
    assert(/reqText \+= '\\nСобрано частей: ' \+ have \+ '\/' \+ item\.fragments;/.test(body), 'показывает "N/20 частей" (теперь в блоке "Требования:" карточки)');
}

console.log('\nTest 9: миграция БД для новой колонки shmot_fragments существует');
{
    const migSrc = readSrc('server/migrate25.php');
    assert(/\$col = 'shmot_fragments';/.test(migSrc), 'migrate25.php добавляет колонку shmot_fragments');
    assert(/TEXT DEFAULT NULL/.test(migSrc), 'тип колонки — TEXT (JSON-блоб, как shmot/bosses_data и другие server-only поля)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 22.09.2026 (по прямому указанию) — три связанные фичи одного сообщения:
 *
 *  1) "Потерянный тайник" — pity-счётчик открытий ящика (yashik.openBox). 15 предметов
 *     (3 сета × 5, сталкер→спортик2.0→тинейджер) выдаются каждый требует свой случайный порог
 *     100-150 открытий (новый ролл при переходе к следующему предмету, НЕ общий счётчик на
 *     все 15). Server-only поле lost_stash_pity {idx,count,threshold} — НЕ в whitelist
 *     users.php. Выдаётся СРАЗУ в openBox() (не через yashik_session/collect — редкая награда
 *     не должна сгорать от случайного "НАЗАД" после 100+ открытий).
 *
 *     02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов — редизайн внутри
 *     каждого сета, не только что было): внутри ТЕКУЩЕГО сета порядок больше не строгий
 *     голова→тело→штаны→обувь→рука — первые четыре предмета выдаются СЛУЧАЙНО (из недостающих
 *     в $set['items']), предмет руки ($set['hand']) выдаётся гарантированно последним, только
 *     когда остальные четыре уже собраны. Катало́г хранит это как lost_stash_sets (массив из 3
 *     {items:[4 id], hand:id}), а не плоский lost_stash_sequence из 15 id — сами 15 id и их
 *     cat/set-метаданные в game/shmot.js не изменились, изменилась только серверная формула
 *     ВЫБОРА следующего предмета внутри сета (см. casino-loot-policy.test.js "Тайник содержит
 *     три сета: 4 обычные вещи и руку" / "Первые четыре вещи текущего сета выбираются случайно"
 *     — независимое подтверждение того же дизайна).
 *
 *  2) Личный dev-флаг dev_force_drops ("100% дропа шмоток отовсюду", кнопка в дев-панели) —
 *     форсирует гарантированный дроп на известных RNG-источниках шмота: боссовый пул (id41+),
 *     Потерянный тайник.
 *
 *     02.10.2026 (ОБНОВЛЕНО): "общий пул bosses.php/yashik.php (id0-40)" из абзаца выше —
 *     отдельным редизайном (shmot_chance_bp убран из yashik_config.json целиком) у обычной
 *     награды ящика вообще отключили случайную одежду — см. casino-loot-policy.test.js
 *     "Обычный ящик не выдаёт случайную одежду". dev_force_drops на yashik.php теперь форсирует
 *     только Потерянный тайник (общего 7%-пула, который раньше форсировался тем же флагом,
 *     больше не существует — форсировать нечего).
 *
 *  3) Попутный баг-фикс (по прямому указанию — "всё что делаешь сразу делай на сервер"):
 *     yashik.php.collect() раньше только СООБЩАЛ id выпавшей из общего пула вещи
 *     (shmotGranted), но не писал owned=true в БД сам — рассчитывал, что это сделает клиент
 *     через users.save(), который тот же самый анти-чит guard (_sanitizeShmot) должен был
 *     отклонить (запрещает owned:false→true). Теперь collect() пишет владение напрямую.
 *
 * Run: node tests/yashik-lost-stash-and-dev-force-drops.test.js
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

const yashikPhp = readSrc('server/core/controllers/yashik.php');
const yashikCfg = JSON.parse(readSrc('server/json/yashik_config.json'));
const usersPhp  = readSrc('server/core/controllers/users.php');
const shmotJs   = readSrc('_client/src/game/shmot.js');
const yashikJs  = readSrc('_client/src/game/shell/overlays/yashik.js');
const devPanel  = readSrc('_client/src/game/shell/overlays/dev_panel.js');

console.log('\nTest 1: yashik_config.json — lost_stash_sets сверен построчно с сетами сталкер/спортик 2.0/тинейджер в game/shmot.js (4 обычных предмета + рука на сет)');
{
    const sets = yashikCfg.lost_stash_sets;
    assert(Array.isArray(sets) && sets.length === 3, 'lost_stash_sets — 3 сета, получили ' + (sets && sets.length));
    assert(yashikCfg.lost_stash_pity_min === 100 && yashikCfg.lost_stash_pity_max === 150,
        'порог pity — диапазон 100-150');

    // Извлекаем this.items из shmot.js: id, cat (0=голова..6=рука), set, source==='Потерянный тайник'.
    const itemsBlockMatch = shmotJs.match(/this\.items = \[([\s\S]*?)\n\t\t\];/);
    const itemsBlock = itemsBlockMatch ? itemsBlockMatch[1] : '';
    const items = [];
    for(const line of itemsBlock.split('\n')){
        const idM = line.match(/\{id:(\d+),\s*cat:(\d+),/);
        const setM = line.match(/set:'([^']*)'/);
        const sourceM = line.match(/source:'([^']*)'/);
        if(idM && setM && sourceM) items.push({ id: +idM[1], cat: +idM[2], set: setM[1], source: sourceM[1] });
    }
    const tainikItems = items.filter(i => i.source === 'Потерянный тайник');
    assert(tainikItems.length === 15, 'ровно 15 предметов с source="Потерянный тайник" в game/shmot.js, получили ' + tainikItems.length);

    // Ожидаемый состав сетов (cat: 0=голова,1=тело,2=штаны,3=обувь — "items", 6=рука — "hand").
    const CAT_ORDER = [0, 1, 2, 3];
    const SET_ORDER = ['сталкер', 'спортик 2.0', 'тинейджер'];
    SET_ORDER.forEach((setName, i) => {
        const setItems = tainikItems.filter(it => it.set === setName);
        assert(setItems.length === 5, `сет "${setName}" — 5 предметов, получили ${setItems.length}`);
        const expectedItems = CAT_ORDER.map(cat => {
            const it = setItems.find(x => x.cat === cat);
            assert(!!it, `сет "${setName}": предмет категории ${cat} найден`);
            return it ? it.id : null;
        });
        const handItem = setItems.find(x => x.cat === 6);
        assert(!!handItem, `сет "${setName}": предмет руки (cat:6) найден`);

        const got = sets[i] || {};
        assert(JSON.stringify(got.items) === JSON.stringify(expectedItems),
            `сет "${setName}": lost_stash_sets[${i}].items совпадает с каталогом (голова/тело/штаны/обувь): ожидали ${JSON.stringify(expectedItems)}, получили ${JSON.stringify(got.items)}`);
        assert(handItem && got.hand === handItem.id,
            `сет "${setName}": lost_stash_sets[${i}].hand совпадает с каталогом: ожидали ${handItem && handItem.id}, получили ${got.hand}`);
    });
}

console.log('\nTest 2: yashik.php.openBox() — Потерянный тайник: pity per ТЕКУЩИЙ СЕТ, первые четыре предмета случайны, рука выдаётся последней');
{
    const start = yashikPhp.indexOf('$lostStashItemId = null;');
    const end   = yashikPhp.indexOf('if(!$this->ops->saveUser($user)) return $this->ops->fail(99);', start);
    assert(start !== -1 && end !== -1, 'блок Потерянного тайника найден в openBox()');
    const body = yashikPhp.slice(start, end);

    assert(/\$sets = \$catalog\['lost_stash_sets'\] \?\? \[\];/.test(body), 'читает lost_stash_sets из каталога (не плоскую lost_stash_sequence)');
    // 05.10.2026 (стале-пин, не регрессия — yashik.php получил SELECT...FOR UPDATE, $lockedUser вместо $user).
    assert(/\$pity = \$this->ops->j\(\$lockedUser, 'lost_stash_pity', \[\]\);/.test(body), 'читает server-only поле lost_stash_pity');
    assert(/\$idx = intval\(\$pity\['idx'\] \?\? 0\);/.test(body), 'idx — индекс ТЕКУЩЕГО СЕТА (не отдельного предмета)');
    assert(/if\(\$idx < count\(\$sets\)\)\{/.test(body), 'ничего не делает, если все 3 сета уже собраны (idx вышел за пределы sets)');
    assert(/if\(empty\(\$pity\['threshold'\]\)\)\{/.test(body), 'если для текущего сета порог ещё не рождён — рождает новый');
    assert(/\$pity\['threshold'\] = rand\(intval\(\$catalog\['lost_stash_pity_min'\] \?\? 100\), intval\(\$catalog\['lost_stash_pity_max'\] \?\? 150\)\);/.test(body),
        'порог — случайный rand(100,150) из каталога, не хардкод');
    assert(/\$pity\['count'\] = intval\(\$pity\['count'\] \?\? 0\) \+ 1;/.test(body), 'КАЖДОЕ открытие увеличивает счётчик на 1 — независимо от обычной награды выше');
    assert(/if\(\$devForceDrops \|\| \$pity\['count'\] >= intval\(\$pity\['threshold'\]\)\)\{/.test(body),
        'выдача — либо по достижении порога, либо мгновенно при dev_force_drops');
    assert(/if\(empty\(\$shmotArr\[\$itemId\]\['owned'\]\)\) \$available\[\] = \$itemId;/.test(body),
        'собирает НЕ владеемые предметы текущего сета (из четырёх "items")');
    assert(/\$lostStashItemId = !empty\(\$available\)\s*\n\s*\? \$available\[array_rand\(\$available\)\]\s*\n\s*: intval\(\$set\['hand'\]\);/.test(body),
        'пока есть недостающие из четырёх — выбор случайный; рука выдаётся только когда все четыре уже собраны');
    assert(/\$shmotArr\[\$lostStashItemId\]\['owned'\] = true;/.test(body), 'вещь выдаётся НАПРЯМУЮ (owned=true) в этом же openBox(), не откладывается в yashik_session');
    assert(/if\(\$lostStashItemId === intval\(\$set\['hand'\]\)\) \$idx\+\+;/.test(body), 'переход к следующему сету — строго после выдачи руки, не раньше');
    assert(/\$pity\['count'\] = 0;/.test(body), 'счётчик обнуляется для следующего предмета/сета');
    assert(/\$pity\['threshold'\] = \$idx < count\(\$sets\)/.test(body), 'новый случайный порог рождается (не переиспользует старый), обнуляется в 0 когда все сеты собраны');
}

console.log('\nTest 3: dev_force_drops — форсирует мгновенную выдачу на Потерянном тайнике');
{
    // 02.10.2026: "общий пул yashik (id0-40)", который раньше тоже форсировался этим флагом —
    // убран отдельным редизайном (см. casino-loot-policy.test.js "Обычный ящик не выдаёт
    // случайную одежду"), форсировать там больше нечего. dev_force_drops на yashik.php теперь
    // влияет только на Потерянный тайник.
    assert(/\$devForceDrops = !empty\(\$user\['dev_force_drops'\]\);/.test(yashikPhp), 'openBox() читает личный флаг аккаунта');
    assert(/if\(\$devForceDrops \|\| \$pity\['count'\] >= intval\(\$pity\['threshold'\]\)\)\{/.test(yashikPhp),
        'Потерянный тайник: dev_force_drops в OR перед порогом pity — форсирует мгновенную выдачу');
    assert(!/shmot_chance_bp/.test(yashikPhp),
        'общий 7%-пул обычной награды убран из yashik.php целиком (редизайн — см. casino-loot-policy.test.js)');
}

console.log('\nTest 4: yashik.php.collect() — исправлен баг: владение общим (id0-40) предметом теперь пишется НАПРЯМУЮ сервером, не оставлено клиенту');
{
    const start = yashikPhp.indexOf('function collect(){');
    const end   = yashikPhp.indexOf('\n        }', yashikPhp.indexOf('shmotGranted'));
    const body  = yashikPhp.slice(start, end);
    assert(/if\(\$shmotGranted !== null\)\{/.test(body), 'проверяет наличие выпавшей вещи перед записью');
    assert(/\$shmotArr\[\$shmotGranted\]\['owned'\] = true;/.test(body), 'выставляет owned=true напрямую через Gameops::saveUser (в обход whitelist-guard, тот же паттерн, что bosses.php.claimKill())');
    // 05.10.2026 (стале-пин, не регрессия — collect() получил SELECT...FOR UPDATE, пишет на
    // залоченную копию $lockedUser; синхронизация в $user происходит ПОСЛЕ saveUser()).
    assert(/\$lockedUser\['shmot'\] = json_encode\(\$shmotArr\);/.test(body), 'обновлённый shmot сохраняется в $lockedUser перед записью в БД под локом');

    const patchStart = body.indexOf('$patch = $this->ops->patchCurrencies($user, [');
    const patchEnd   = body.indexOf(']);', patchStart);
    const patchBody  = body.slice(patchStart, patchEnd);
    assert(/'shmot'/.test(patchBody), 'shmot включён в patchCurrencies — клиент увидит новое владение сразу через applyPatch');
}

console.log('\nTest 5: users.php — dev_force_drops server-only (НЕ в whitelist, чистится при resetSession), permit setDevFlag добавлен и валидирует имя флага');
{
    const allowedStart = usersPhp.indexOf('$allowed = [');
    const allowedEnd   = usersPhp.indexOf('];', allowedStart);
    assert(!/'dev_force_drops'/.test(usersPhp.slice(allowedStart, allowedEnd)),
        'dev_force_drops отсутствует в whitelist $allowed — обычный users.save его не тронет');

    const resetStart = usersPhp.indexOf('function resetSession(){');
    const resetEnd    = usersPhp.indexOf('\n        }', resetStart);
    assert(/'dev_force_drops'\s*=> 0,/.test(usersPhp.slice(resetStart, resetEnd)), 'сброс аккаунта выключает флаг (0)');
    assert(/'lost_stash_pity'\s*=> null,/.test(usersPhp.slice(resetStart, resetEnd)), 'сброс аккаунта также обнуляет прогресс Потерянного тайника');

    assert(/'setDevFlag'/.test(usersPhp), 'setDevFlag зарегистрирован в $this->permits');
    const fnStart = usersPhp.indexOf('function setDevFlag(){');
    const fnEnd   = usersPhp.indexOf('\n        }', fnStart);
    assert(fnStart !== -1, 'метод setDevFlag() найден');
    const fnBody = usersPhp.slice(fnStart, fnEnd);
    // 25.09.2026 (регресс найден повторным прогоном тестов): список расширен вторым флагом
    // (dev_force_jackpot, см. tests/roulette-dev-force-jackpot.test.js) — по-прежнему явный
    // белый список, просто из двух элементов вместо одного.
    assert(/\$allowedFlags = \['dev_force_drops', 'dev_force_jackpot'\];/.test(fnBody), 'валидирует имя флага против явного списка — нельзя записать произвольное поле через этот permit');
    assert(/if\(!in_array\(\$flag, \$allowedFlags, true\)\) return \$this->registry\['tools'\]->error\(54\);/.test(fnBody), 'отклоняет неизвестные имена флагов');
}

console.log('\nTest 6: dev_panel.js — кнопка "Дроп шмота 100%" вызывает users.setDevFlag');
{
    assert(/_row\('Дроп шмота 100%', \[/.test(devPanel), 'строка с кнопками добавлена в секцию ШМОТ');
    assert(/action:\(\)=>this\._setDevForceDrops\(true\)/.test(devPanel), 'кнопка ВКЛ вызывает _setDevForceDrops(true)');
    assert(/action:\(\)=>this\._setDevForceDrops\(false\)/.test(devPanel), 'кнопка ВЫКЛ вызывает _setDevForceDrops(false)');

    const fnStart = devPanel.indexOf('proto._setDevForceDrops = function');
    const fnEnd   = devPanel.indexOf('\n    };', fnStart);
    const fnBody  = devPanel.slice(fnStart, fnEnd);
    assert(/TS\.php\('users\.setDevFlag', \{flag: 'dev_force_drops', value: on \? 1 : 0\}/.test(fnBody),
        'отправляет правильное имя флага и value на сервер');
}

console.log('\nTest 7: yashik.js — обрабатывает lostStashItemId из ответа openBox (название резолвится по каталогу, owned выставляется локально сразу)');
{
    assert(/if\(res\.lostStashItemId != null && window\.shmot && Array\.isArray\(shmot\.items\)\)\{/.test(yashikJs),
        'проверяет lostStashItemId в ответе сервера');
    assert(/const it = shmot\.items\.find\(x => x\.id === res\.lostStashItemId\);/.test(yashikJs), 'резолвит предмет по локальному каталогу');
    assert(/it\.owned = true;/.test(yashikJs), 'выставляет owned=true локально сразу (не дожидаясь перезагрузки страницы)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

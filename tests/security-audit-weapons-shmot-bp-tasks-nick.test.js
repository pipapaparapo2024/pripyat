/**
 * Test: 18.09.2026 — аудит безопасности по прямому запросу пользователя ("максимальная ли у
 * нас защита от читеров и от дюперства?"). Найдены и закрыты 4 отдельные дыры:
 *
 * 1) weapons/shmot оставались в whitelist users.save БЕЗ проверки содержимого — у обоих полей
 *    уже есть выделенные, провалидированные по цене эндпоинты (weapons.buy/upgrade, shmot.buy),
 *    но читер мог одним users.save подставить owned:true/upg:20/qty:999999 всем слотам сразу,
 *    полностью в обход цены. ammo_auto/ammo_gun/ammo_machete (легаси-поля патронов) давали ТОТ
 *    ЖЕ эксплойт ещё проще — weapons.js._loadFromUdata() поднимает qty оружия до значения этих
 *    полей, если оно больше. Закрыто добавлением content-валидации: JSON-блобы разрешают
 *    только СНИЖЕНИЕ owned/upg/qty (плюс свободное переключение equipped), ammo_* — только
 *    монотонное снижение (расход патронов), рост через users.save отклоняется.
 *
 *    25.09.2026 (следующий шаг того же направления, по прямому указанию — живой репорт
 *    "шмотки не сохраняются"/"урон без шмоток"): 'shmot' убран из whitelist ПОЛНОСТЬЮ (не
 *    просто content-guard, как в 2018.09) — единственные писатели теперь shmot.php.buy()/
 *    equip() (см. tests/shmot-equip-server-authoritative.test.js) и users.devGrantShmot()
 *    (dev-кнопки/выдачи казино). _sanitizeShmot() удалена как мёртвый код — 'weapons' здесь
 *    остаётся (у него другая природа — патроны легитимно расходуются на клиенте между
 *    боями, content-guard там по-прежнему нужен), см. Test 1/2/4 ниже (без shmot).
 *
 * 2) bp.claim()/tasks.claim() валидируют право на награду, ЧИТАЯ ЭТИ ЖЕ ПОЛЯ (bp_level,
 *    zadaniya.prog/need/reward_val) ИЗ КЛИЕНТ-WRITABLE whitelist — читер мог users.save
 *    bp_level:500 или zadaniya с любым reward_val и забрать любую награду. Обе фичи ("задания"
 *    и Боевой пропуск) отключены в UI — убраны из whitelist целиком, легитимного пути записи
 *    не существовало.
 *
 * 3) dvor-cards.js (СОРВИ КУШ, старая FLA-панель) — недостижима через UI, но вызываема из
 *    консоли (dvor._playCards()), считала RNG/pity/выплату ПРЯМО В БРАУЗЕРЕ, деля счётчик
 *    this._data.cards.aa/kk/qq с уже серверным Блэкджеком. Удалена как мёртвый эксплойт.
 *
 * 4) database.php.trueJSON() — старое исправление ("ник в рейтинге показывает ARRAY") закрыло
 *    только null/пустую строку → []. Но nick.js не ограничивает символы ника (maxLength=15
 *    без фильтрации), значит игрок мог легитимно назвать себя "[]"/"{}" (валидный JSON) — и
 *    ПОЗДНЕЙШИЙ безусловный блок `if(is_array($value)) $array[$key]=$value;` подменял ник
 *    массивом заново, БЕЗ проверки имени поля. strval() от массива в PHP возвращает "Array" —
 *    тот же баг возвращался для этого класса ников. Закрыто: исключение nick/nickname/
 *    name/balabol применено и к этому блоку тоже.
 *
 * Run: node tests/security-audit-weapons-shmot-bp-tasks-nick.test.js
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

const usersPhp    = readSrc('server/core/controllers/users.php');
const databasePhp = readSrc('server/core/models/database.php');
const bjPhp       = readSrc('server/core/controllers/bp.php');
const tasksPhp    = readSrc('server/core/controllers/tasks.php');
const dvorCardsJs = readSrc('_client/src/game/dvor/dvor-cards.js');
const dvorJs      = readSrc('_client/src/game/dvor.js');
const nickJs      = readSrc('_client/src/game/shell/popups/nick.js');

console.log('\nTest 1: weapons остаётся в whitelist с content-валидацией; shmot убран из whitelist ПОЛНОСТЬЮ (25.09.2026, шаг дальше)');
{
    // 04.10.2026: было /'gang_id','gang_data','weapons','inventory',/ — 'gang_id' убран из
    // этой же строки в том же аудите (own dedicated test: users-php-real-exec-save-whitelist-
    // holes-closed.test.js), regex ломался на изменившемся соседстве, а не на реальном
    // отсутствии 'weapons' (оно всё ещё здесь, просто без 'gang_id' перед собой).
    assert(/'gang_data','weapons','inventory',/.test(usersPhp), 'weapons всё ещё в $allowed (нужен для легитимного расхода патронов)');
    assert(!/'weapons','shmot'/.test(usersPhp.replace(/\s+/g,'')), "'shmot' больше НЕ рядом с weapons в whitelist — убран целиком");
    // 09.10.2026: третья запись ('bosses_data' => '_sanitizeBossesData') добавлена позже тем же
    // приёмом — см. tests/users-php-real-exec-sanitize-bosses-data-currency-guard.test.js.
    assert(/\$jsonBlobGuards\s*=\s*\['weapons' => '_sanitizeWeapons', 'inventory' => '_sanitizeInventory', 'bosses_data' => '_sanitizeBossesData'\];/.test(usersPhp),
        'jsonBlobGuards содержит weapons и inventory — запись для shmot убрана вместе с самим полем');
    assert(/function _sanitizeWeapons\(\$currentRaw, \$incomingRaw\)\{/.test(usersPhp), '_sanitizeWeapons() определён (weapons остаётся client-writable)');
    assert(!/function _sanitizeShmot/.test(usersPhp), '_sanitizeShmot() удалена — shmot больше не проходит через users.save вообще, guard не нужен');
}

console.log('\nTest 2: _sanitizeWeapons() — блокирует рост owned/upg/qty, разрешает снижение и equipped');
{
    const start = usersPhp.indexOf('function _sanitizeWeapons(');
    const end   = usersPhp.indexOf('\n        }', usersPhp.indexOf('return $incoming;', start));
    const body  = usersPhp.slice(start, end);
    assert(/if\(\(\$newOwned && !\$curOwned\) \|\| \$newUpg > \$curUpg \|\| \$newQty > \$curQty\) return null;/.test(body),
        'эскалация ЛЮБОГО из трёх (owned/upg/qty) хоть в одном слоте — отклоняет ВЕСЬ блоб (null)');
    assert(!/equipped/.test(body), 'equipped вообще не проверяется в guard — переключение свободно, экономического риска нет');
}

console.log('\nTest 3: shmot больше не читается из $incoming вообще (не только guard убран — само поле не в $allowed) — см. shmot-equip-server-authoritative.test.js для полной проверки замены');
{
    const saveIdx = usersPhp.indexOf('function save(){');
    const saveEnd = usersPhp.indexOf('\n        }', usersPhp.indexOf('foreach($allowed as $key){', saveIdx));
    const saveBody = usersPhp.slice(saveIdx, saveEnd);
    assert(!/isset\(\$incoming\['shmot'\]\)/.test(saveBody), "save() больше не проверяет isset(\$incoming['shmot']) — нечего проверять, поля нет в \$allowed");
}

console.log('\nTest 4: ammo_auto/ammo_gun/ammo_machete — монотонное снижение через users.save, рост отклоняется');
{
    assert(/\$monotonicFields = \['ammo_auto', 'ammo_gun', 'ammo_machete'\];/.test(usersPhp), 'список монотонных полей объявлен');
    assert(!/'ammo_auto', 'ammo_gun', 'ammo_machete'/.test(usersPhp.match(/\$strictNumericFields = \[[\s\S]*?\];/)[0]),
        'ammo_* убраны из $strictNumericFields (простого потолка недостаточно — там нужна монотонность, не диапазон)');
    const start = usersPhp.indexOf("} else if(in_array($key, $monotonicFields, true)){");
    const end   = usersPhp.indexOf('\n                } else if(isset($jsonBlobGuards', start);
    const body  = usersPhp.slice(start, end);
    assert(/if\(\$num < 0 \|\| \$num > \$curNum\)/.test(body), 'отклоняет значение выше текущего в БД (рост запрещён) и отрицательные');
}

console.log('\nTest 5: weapons.js._loadFromUdata() легаси-фолбэк (эксплойт через ammo_*) теперь бессилен — сервер режет ammo_* раньше, чем он сработает');
{
    const weaponsJs = readSrc('_client/src/game/weapons.js');
    assert(/legacyAmmo\[i\] > \(parseInt\(this\.data\[i\]\.qty\) \|\| 0\)/.test(weaponsJs),
        'sanity: легаси-фолбэк действительно существует на клиенте (не удалялся — он легитимно нужен для чтения старых сохранений)');
    // Сам фолбэк на клиенте не тронут (он безобиден для ЧЕСТНОГО ammo_auto, пришедшего через
    // патч сервера) — эксплойт закрыт на СЕРВЕРЕ (Test 4 выше): подделанный ammo_auto просто
    // никогда не долетит до БД, а значит и не вернётся клиенту как "легитимно возросший".
}

console.log('\nTest 6: bp_level/bp_xp/bp_xp_next/bp_claimed/zadaniya/zadaniya_day убраны из whitelist');
{
    ['bp_level','bp_xp','bp_xp_next','bp_claimed','zadaniya','zadaniya_day'].forEach(key => {
        const allowedBlock = usersPhp.slice(usersPhp.indexOf('$allowed = ['), usersPhp.indexOf('\n            ];'));
        assert(!allowedBlock.includes("'" + key + "'"), "'" + key + "' отсутствует в \$allowed");
    });
}

console.log('\nTest 7: bp.php/tasks.php сохранили свою внутреннюю проверку (защита не полагается только на whitelist)');
{
    assert(/if\(\$lv > \$bpLevel\) return \$this->ops->fail\(53\);/.test(bjPhp), 'bp.claim() по-прежнему проверяет lv <= bpLevel из БД');
    // 23.09.2026: tasks.php полностью переписан (перенос генерации/прогресса заданий на сервер,
    // см. коммент в шапке файла) — prog теперь считается СВЕЖИМ значением прямо из полей $user
    // (_statValue), need — из каталога zadaniya_config.json (через $def), а не из старого,
    // никогда не заполнявшегося клиентом session-блоба {prog,need}.
    assert(/\$prog = \$this->_statValue\(\$user, \$def\['key'\]\);/.test(tasksPhp), 'tasks.claim() считает prog свежим значением из $user, не доверяя клиенту');
    assert(/if\(\$prog < intval\(\$def\['need'\]\)\) return \$this->ops->fail\(53\);/.test(tasksPhp),
        'tasks.claim() по-прежнему проверяет prog >= need — оба значения из БД/каталога, не из клиента');
}

console.log('\nTest 8: dvor-cards.js (СОРВИ КУШ) — мёртвый эксплойт удалён, dvor.js зачищен');
{
    assert(!/proto\._playCards\s*=/.test(dvorCardsJs), '_playCards удалена');
    assert(!/proto\._resolveCards\s*=/.test(dvorCardsJs), '_resolveCards удалена');
    assert(!/this\.\_data\.cards\.aa\+\+/.test(dvorCardsJs), 'RNG/pity-инкременты убраны вместе с функциями');
    assert(!/this\._playCards\(\)/.test(dvorJs), 'dvor.js._bindGamePanels() больше не привязывает удалённую _playCards()');
}

console.log('\nTest 9: database.php.trueJSON() — nick/nickname/name/balabol защищены от превращения в массив ПОЛНОСТЬЮ (оба места)');
{
    const start = databasePhp.indexOf('function trueJSON($array){');
    const end   = databasePhp.indexOf('\n\t\t\treturn $array;', start);
    const body  = databasePhp.slice(start, end);

    assert(/\$isStringField = \$keys\[\$i\] === 'name' \|\| \$keys\[\$i\] === 'balabol'/.test(body),
        'единый флаг $isStringField вычисляется один раз для обеих проверок');
    assert(/if \(\$array\[\$keys\[\$i\]\] == null and !\$isStringField\) \$array\[\$keys\[\$i\]\] = \[\];/.test(body),
        'null/пустая строка не подменяется на [] для строковых полей (старое исправление сохранено)');
    assert(/if \(is_array\(\$value\) and !\$isStringField\) \{/.test(body),
        'НОВОЕ: безусловный блок is_array($value) тоже исключает строковые поля — ник, легитимно совпавший с валидным JSON ("[]", "{}", "[1,2]"), больше не подменяется массивом');
}

console.log('\nTest 10: sanity — nick.js действительно не ограничивает содержимое ника (только длину), поэтому Test 9 не гипотетический');
{
    assert(/inp\.maxLength = 15;/.test(nickJs), 'единственное ограничение — maxLength=15, без фильтрации символов');
    assert(!/replace\(|regex|pattern|allowedChars/i.test(nickJs), 'нет посимвольной валидации — игрок может ввести "[]"/"{}" как реальный ник');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

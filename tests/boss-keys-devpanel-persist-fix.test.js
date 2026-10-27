/**
 * Test: 26.10.2026 — репорт с тестового сервера: "в dev-панели выдал ключи боссу, перезагрузил
 * игру — ключи не остались. При этом сразу напасть на босса нельзя — ошибка 'проверьте ключи и
 * зачистку локации'".
 *
 * Корень: dev_panel.js._addKey(i, amt) мутировал bosses.keys[i] на клиенте и сохранял через
 * ОБЩИЙ, generic saveDevChanges() → TS.php('users.save', ...). Server-side
 * users.php._sanitizeBossesData() требует ТОЧНОГО совпадения keys[]/dailyKills[]/killsTotal[]/
 * medalKills[] с текущим значением в БД — при любом расхождении отклоняет ВЕСЬ bosses_data
 * целиком (не точечно) — это тот же анти-чит, что не даёт обычному читеру накрутить себе ключи
 * тем же users.save, поэтому его нельзя ослаблять. Итог: выданные dev-панелью ключи никогда
 * реально не долетали до БД, а bosses.php.startFight() (строка ~819, fail(64) "не хватает
 * ключей") сразу отклонял попытку атаки, так как на сервере ключей и не было — оба репортнутых
 * симптома объясняются ОДНИМ и тем же багом, не двумя разными.
 *
 * Та же категория, что уже чинили для оружия/шмоток/валюты (devGrantWeapons/devGrantShmot/
 * devGrantCurrency в users.php, см. их комментарии) — "МИЛЛИОН ВСЕГО" (dev_panel.js._giveMillion)
 * страдал тем же багом для ВСЕХ 8 ключей разом (bosses.keys = Array(8).fill(1000000) + тот же
 * сломанный users.save), найдено и исправлено в рамках того же батча.
 *
 * Фикс — узкий dev-only permit bosses.devGrantKeys() (bosses.php, тот же приём, что уже
 * существующий devResetDailyLimits()): пишет ТОЛЬКО keys[] напрямую через Gameops::saveUser(),
 * в обход whitelist-санитайзера, только для своего uid. Принимает либо {idx, amt} (точечная
 * кнопка +1/+3/+5 по одному боссу), либо {all_amt} (МИЛЛИОН ВСЕГО — разом всем 8).
 *
 * Run: node tests/boss-keys-devpanel-persist-fix.test.js
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
const usersPhp  = readSrc('server/core/controllers/users.php');
const devPanel  = readSrc('_client/src/game/shell/overlays/dev_panel.js');

console.log('\nTest 1: сервер — devGrantKeys() зарегистрирован в $this->permits (bosses.php)');
{
    const permitsMatch = bossesPhp.match(/\$this->permits = \[([^\]]*)\];/);
    assert(!!permitsMatch, '$this->permits найден');
    assert(permitsMatch && permitsMatch[1].includes("'devGrantKeys'"), "'devGrantKeys' присутствует в $this->permits");
}

console.log('\nTest 2: сервер — devGrantKeys() требует dev-гейт, пишет напрямую через Gameops, в обход whitelist-санитайзера');
{
    const start = bossesPhp.indexOf('function devGrantKeys(){');
    assert(start !== -1, 'метод devGrantKeys() найден');
    const end = bossesPhp.indexOf('\n        private function _catalog(){', start);
    const body = bossesPhp.slice(start, end);

    assert(/if\(!\$this->_requireDevUser\(\)\) return;/.test(body), 'есть проверка _requireDevUser() (та же защита, что у devResetDailyLimits)');
    assert(/\$user = \$this->ops->loadUser\(\);/.test(body), 'читает полную строку через Gameops::loadUser()');
    assert(/\$user\['bosses_data'\] = json_encode\(\$data\);/.test(body), 'пишет bosses_data напрямую в $user (не через обычный users.save)');
    assert(/\$this->ops->saveUser\(\$user\)/.test(body), 'сохраняет через Gameops::saveUser() — в обход users.php._sanitizeBossesData()');
}

console.log('\nTest 3: сервер — devGrantKeys() поддерживает обе ветки: точечная (idx/amt) и массовая (all_amt), с max(0, ...) защитой от отрицательных');
{
    const start = bossesPhp.indexOf('function devGrantKeys(){');
    const end = bossesPhp.indexOf('\n        private function _catalog(){', start);
    const body = bossesPhp.slice(start, end);

    assert(/isset\(\$this->registry\['user_params'\]\['all_amt'\]\)/.test(body), 'ветка all_amt для МИЛЛИОН ВСЕГО (все 8 ключей разом)');
    assert(/for\(\$i = 0; \$i < 8; \$i\+\+\) \$data\['keys'\]\[\$i\] = max\(0, intval\(\$data\['keys'\]\[\$i\]\) \+ \$allAmt\);/.test(body),
        'all_amt применяется ко всем 8 индексам с max(0, ...) клампом');
    assert(/\$idx = intval\(\$this->registry\['user_params'\]\['idx'\] \?\? -1\);/.test(body), 'ветка idx/amt для точечной кнопки +1/+3/+5');
    assert(/\$data\['keys'\]\[\$idx\] = max\(0, intval\(\$data\['keys'\]\[\$idx\]\) \+ \$amt\);/.test(body),
        'idx/amt применяется с max(0, ...) клампом (нельзя увести ключ в минус)');
    assert(/if\(\$idx < 0 \|\| \$idx > 7\) return \$this->ops->fail\(54\);/.test(body), 'idx валидируется диапазоном 0..7');
}

console.log('\nTest 4: сервер — анти-чит _sanitizeBossesData() НЕ ослаблен этим фиксом (защита для обычных игроков осталась как была)');
{
    const start = usersPhp.indexOf('function _sanitizeBossesData(');
    assert(start !== -1, '_sanitizeBossesData() всё ещё присутствует в users.php');
    const end = usersPhp.indexOf('\n        function ', start + 10);
    const body = usersPhp.slice(start, end);

    assert(/\$lockedFields = \['keys', 'dailyKills', 'killsTotal', 'medalKills'\];/.test(body),
        'все 4 поля (включая keys) по-прежнему заморожены против расхождения с БД — обычный users.save() для читеров остаётся заблокирован');
    assert(/if\(intval\(\$newArr\[\$i\] \?\? 0\) !== intval\(\$curArr\[\$i\] \?\? 0\)\) return null;/.test(body),
        'строгое сравнение по индексам сохранено (не точечная правка одного элемента)');
}

console.log('\nTest 5: сервер — startFight() всё ещё проверяет ключи перед атакой (fail 64) — не трогали этой правкой');
{
    assert(/return \$this->ops->fail\(64\); \/\/ не хватает ключей/.test(bossesPhp),
        'проверка "не хватает ключей" (fail 64) в startFight() осталась нетронутой — объясняет симптом "сразу напасть нельзя"');
}

console.log('\nTest 6: клиент — _addKey(i, amt) больше не пишет bosses.keys напрямую + saveDevChanges(), а зовёт bosses.devGrantKeys');
{
    const start = devPanel.indexOf('const _addKey = (i, amt) => {');
    assert(start !== -1, '_addKey найден');
    const end = devPanel.indexOf('// Цвета кнопок', start); // CRLF в файле — не завязываемся на \n\n
    const body = devPanel.slice(start, end);

    assert(!/bosses\.keys\[i\] = \(parseInt\(bosses\.keys\[i\]\|\|0\) \+ amt\);/.test(body),
        'старая прямая мутация bosses.keys[i] на клиенте убрана');
    assert(!/saveDevChanges\(\);/.test(body), 'больше не вызывает общий saveDevChanges() (который шёл через guarded users.save)');
    assert(/TS\.php\('bosses\.devGrantKeys',\s*\{idx:\s*i,\s*amt:\s*amt\}/.test(body), "реально вызывает TS.php('bosses.devGrantKeys', {idx: i, amt: amt}, ...)");
    assert(/applyPatch\(res\.patch\)/.test(body), 'применяет patch из ответа сервера');
    assert(/bosses\._loadFromUdata\(\)/.test(body), 'перечитывает актуальный keys[] из udata после ответа сервера');
}

console.log('\nTest 7: клиент — _giveMillion() ("МИЛЛИОН ВСЕГО") тоже переведён на devGrantKeys (тот же баг-класс для всех 8 ключей разом)');
{
    assert(!/bosses\.keys = new Array\(8\)\.fill\(1000000\); bosses\._saveToUdata\(\);/.test(devPanel),
        'старая прямая мутация bosses.keys = Array(8).fill(1000000) убрана из _giveMillion()');
    assert(/TS\.php\('bosses\.devGrantKeys',\s*\{all_amt:\s*1000000\}/.test(devPanel),
        "МИЛЛИОН ВСЕГО зовёт TS.php('bosses.devGrantKeys', {all_amt: 1000000}, ...)");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

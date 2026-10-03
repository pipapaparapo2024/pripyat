/**
 * Test: экипировка шмоток переехала на сервер (25.09.2026, по прямому указанию, живой репорт —
 * "шмотки не сохраняются" + "урон без шмоток").
 *
 * Корень (оба репорта — ОДИН и тот же баг): equipped переключался ЛОКАЛЬНО в JS
 * (game/shmot.js._onWear()) и уходил на сервер только генерик debounce-автосейвом
 * (udata['shmot'] в client-writable whitelist users.php $allowed). Тот же класс гонки, что уже
 * чинили для skills/weapons/achievements — bosses.php.attack() мог прочитать СТАРОЕ equipped
 * ровно в момент, когда клиент уже визуально считал бонус НОВОГО надетого предмета
 * (weapons.js.computeModifiedDamage()) — отсюда "мачете 60 на бейдже, 50 реально наносится".
 * Плюс сама generic-запись не гарантировала "один предмет на категорию" — отдельный вектор
 * стака бонусов.
 *
 * Фикс: новый эндпоинт shmot.php.equip() — честный запрос→ответ (тот же паттерн, что
 * shmot.buy()/weapons.js._buy()), сервер сам проверяет owned, снимает ВСЕ предметы той же
 * категории, пишет через Gameops::saveUser() (в обход whitelist). 'shmot' убран из
 * client-writable $allowed в users.php — единственные писатели теперь shmot.php.buy()/equip()
 * и users.devGrantShmot() (dev-кнопки/выдачи казино, см. Test 5/6).
 *
 * Run: node tests/shmot-equip-server-authoritative.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const shmotPhp  = read('server/core/controllers/shmot.php');
const usersPhp  = read('server/core/controllers/users.php');
const shmotJs   = read('_client/src/game/shmot.js');
const devPanel  = read('_client/src/game/shell/overlays/dev_panel.js');

console.log('\nTest 1: shmot.php — equip() зарегистрирован в permits, проверяет owned, поддерживает toggle');
{
    assert(/\$this->permits = \['buy', 'equip'\];/.test(shmotPhp), "'equip' добавлен в permits");
    const m = shmotPhp.match(/function equip\(\)\{([\s\S]*?)\r?\n    \}\r?\n\}/);
    assert(!!m, 'equip() найдена');
    if(m){
        const body = m[1];
        assert(/if\(empty\(\$shmot\[\$item_id\]\['owned'\]\)\)/.test(body), 'проверяет owned перед выдачей права надеть — нельзя надеть невыбитый предмет');
        assert(/\$wasEquipped = !empty\(\$shmot\[\$item_id\]\['equipped'\]\);/.test(body), 'читает текущее состояние для toggle-логики');
        assert(/if\(!\$wasEquipped\) \$shmot\[\$item_id\]\['equipped'\] = true;/.test(body), 'toggle: если не было надето — надевает; если было — просто снимает (см. Test 2)');
    }
}

console.log('\nTest 2: shmot.php.equip() — сервер сам гарантирует "один предмет на категорию", не доверяя клиенту');
{
    const m = shmotPhp.match(/function equip\(\)\{([\s\S]*?)\r?\n    \}\r?\n\}/);
    const body = m ? m[1] : '';
    // 26.09.2026 (повторный живой репорт — "три футболки разных сетов надеты одновременно"):
    // промежуточная версия этой проверки сравнивала 'bk' (тип бонуса), из-за чего предметы
    // одной категории с РАЗНЫМИ бонусами друг друга не снимали — настоящий фикс сравнивает
    // 'cat' (реальный слот экипировки), теперь присутствующий в shmot_items.json для всех
    // живых предметов (см. shmot-equip-cat-field-bug-and-inventory-reset-fix.test.js).
    assert(/intval\(\$it\['cat'\]\)\s*!==\s*intval\(\$item\['cat'\]\)\) continue;/.test(body),
        'фильтрует каталог по cat (реальному слоту экипировки) экипируемого предмета');
    assert(/\$shmot\[\$iid\]\['equipped'\] = false;/.test(body),
        'снимает ВСЕ предметы той же категории (включая сам экипируемый — потом переустанавливается ниже, если это надевание)');
}

console.log('\nTest 3: users.php — \'shmot\' убран из client-writable $allowed, _sanitizeShmot() удалена как мёртвый код');
{
    const allowedIdx = usersPhp.indexOf('$allowed = [');
    const allowedEnd = usersPhp.indexOf('];', allowedIdx);
    const allowedBlock = usersPhp.slice(allowedIdx, allowedEnd);
    assert(!/'gang_id','gang_data','weapons','shmot','inventory',/.test(allowedBlock),
        "'shmot' убран из строки whitelist (была вместе с gang_id/weapons/inventory)");
    assert(!/,'shmot',/.test(allowedBlock.replace(/\/\/[^\n]*/g, '')) && !/,'shmot'\]/.test(allowedBlock),
        "'shmot' не встречается больше нигде в $allowed вне комментариев");
    assert(!/function _sanitizeShmot/.test(usersPhp), '_sanitizeShmot() полностью удалена (была мёртвым кодом — единственный вызывающий убран)');
    // 26.09.2026: jsonBlobGuards с тех пор обзавёлся отдельной записью 'inventory' (не
    // связано с этой правкой) — проверяем только то, что важно ЗДЕСЬ: записи 'shmot' там нет.
    assert(/\$jsonBlobGuards\s*=\s*\[[^\]]*\];/.test(usersPhp) && !/\$jsonBlobGuards\s*=\s*\[[^\]]*'shmot'[^\]]*\];/.test(usersPhp),
        'jsonBlobGuards больше не содержит запись для shmot');
}

console.log('\nTest 4: users.php — devGrantShmot() (обновлено 28.09.2026: через Gameops, не сырой saveData)');
{
    assert(/'devGrantShmot'/.test(usersPhp), "'devGrantShmot' зарегистрирован в permits");
    const m = usersPhp.match(/function devGrantShmot\(\)\{([\s\S]*?)\n        \}/);
    assert(!!m, 'devGrantShmot() найдена');
    if(m){
        const body = m[1];
        assert(/\$shmotJson = \$this->registry\['user_params'\]\['shmot_json'\] \?\? null;/.test(body), 'читает shmot_json параметр');
        // 28.09.2026: переписана на Gameops::loadUser()/saveUser() — заодно материализует
        // energy-бонус (applyShmotOwnBonus) при переходе конкретной вещи not-owned→owned,
        // которого раньше (при сыром saveData в обход whitelist) не было вовсе — dev-выдача
        // вещи с бонусом на max_energy молча НЕ начисляла его. Требует $this->ops
        // инициализированным в конструкторе (см. Test 0-подобную проверку в другом файле —
        // energy-time-bootstrap-on-login.test.js — эта же правка чинит смежный энергобаг).
        assert(/\$user = \$this->ops->loadUser\(\);/.test(body), 'читает пользователя через Gameops::loadUser(), не сырой SQL');
        assert(/\$this->ops->applyShmotOwnBonus\(\$user, intval\(\$id\)\);/.test(body),
            'материализует energy-бонус для каждой вещи, переходящей not-owned→owned (раньше при сыром saveData этого не было)');
        assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->registry\['tools'\]->error\(99\);/.test(body),
            'сохраняет через Gameops::saveUser(), не через прямой saveData в обход whitelist');
    }
}

console.log('\nTest 5: shmot.js — _onWear() зовёт shmot.equip на сервер честным запросом, локально ничего не меняет до ответа');
{
    const m = shmotJs.match(/_onWear\(itemId\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_onWear найден');
    if(m){
        const body = m[1];
        assert(/TS\.php\('shmot\.equip', \{item_id: itemId\}, \(res\) => \{/.test(body), 'зовёт shmot.equip с item_id');
        assert(/applyPatch\(res\.patch\);/.test(body), 'применяет патч сервера');
        assert(/this\._loadFromUdata\(\);/.test(body), 'перечитывает this.items из свежего udata (серверная истина), не доверяет локальной мутации');
        assert(!/item\.equipped = false;\n\s*\} else \{/.test(body), 'старая локальная мутация item.equipped ДО ответа сервера убрана');
    }
    // Дохлый код: _saveToUdata() (generic-путь) полностью удалена из shmot.js.
    assert(!/_saveToUdata\(\)\{/.test(shmotJs), '_saveToUdata() удалена из shmot.js (была единственным путём записи equipped, теперь мёртвый код)');
}

// 02.10.2026 (ОБНОВЛЕНО повторным прогоном полного каталога тестов): "живой путь" этого теста
// (roulette.php clientRewards типа shmot → shmot.giveRandom() на клиенте) сам оказался дырой —
// клиент мог выставить owned=true себе локально. Вместо миграции giveRandom() на
// devGrantShmot — её убрали целиком, а решение/запись для тату из кейса рулетки переехали на
// сервер напрямую (roulette.php.openCase(), тот же grantShmotFromSource(), что у боссов).
// Независимое подтверждение — casino-loot-policy.test.js "Клиент не способен случайно выдать
// одежду" и gambling-tz-audit-round1.test.js Test 1 (обновлён тем же прогоном).
console.log('\nTest 6: shmot.js.giveRandom() убрана целиком — живой путь (тату из кейса рулетки) решается и сохраняется сервером, не клиентом');
{
    assert(!/giveRandom\(n\)\{/.test(shmotJs), 'giveRandom() удалена из shmot.js (была единственным клиентским путём случайной выдачи одежды)');
    const roulettePhp = read('server/core/controllers/roulette.php');
    assert(/\$tatuItemId = \(mt_rand\(1, 100\) <= \$tatuChancePct\) \? \$this->ops->grantShmotFromSource\(\$user, 'roulette'\) : null;/.test(roulettePhp),
        'roulette.php.openCase() сам решает и записывает тату через grantShmotFromSource() до ответа клиенту (шанс сейчас 0% — дроп тату отключён в бете, выдача уже безопасна)');
}

console.log('\nTest 7: dev_panel.js — _unlockAllShmot()/_resetAccount() тоже переведены на devGrantShmot (иначе dev-кнопки молча перестали бы сохраняться)');
{
    const unlockM = devPanel.match(/proto\._unlockAllShmot = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!unlockM, '_unlockAllShmot найден');
    if(unlockM) assert(/TS\.php\('users\.devGrantShmot'/.test(unlockM[1]), '_unlockAllShmot() зовёт users.devGrantShmot вместо shmot._saveToUdata()');

    assert(/TS\.php\('users\.devGrantShmot', \{shmot_json: '\[\]'\}/.test(devPanel),
        '_resetAccount() отдельно шлёт users.devGrantShmot({shmot_json:\'[]\'}) — shmot:\'[]\' в общем объекте reset больше не сохранился бы через обычный users.save');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

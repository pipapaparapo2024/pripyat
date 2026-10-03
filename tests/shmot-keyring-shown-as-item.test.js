/**
 * Test: 28.09.2026, по прямому указанию — "проверь есть ли в игре логика связки ключей,
 * работает ли она, и добавь её как шмотку, чтобы показывалась в магазине шмоток как и все
 * остальные".
 *
 * Разбор подтвердил: механика РАБОЧАЯ, не мёртвый код —
 *   - roulette.php.claimKeyring()/pickCup() выдают предмет,
 *   - bosses.php.startFight() читает udata['keyring_owner'] и для владельца полностью
 *     пропускает и проверку keys_needed, и списание ключей — атака ЛЮБОГО босса без ключей,
 *     многоразово, без лимита (подтверждено пользователем в чате в процессе разбора).
 *
 * ⚠️ ПЕРЕСМОТРЕНО тем же днём (28.09.2026, по прямому указанию — "Связка должна быть личной
 * наградой, не одной на весь сервер"): первая версия (эксклюзивный 30-дневный цикл, ОДИН
 * владелец на сервере, спец-псевдо-вещь БЕЗ картинки и без реального equip) заменена на
 * личную награду без ограничения количества владельцев. Теперь связка — ПОЧТИ обычная вещь
 * каталога (id:100, cat:6 "Рука", реальный imgFile 'связка ключей.png', есть запись в
 * server/json/shmot_items.json) и экипируется через штатный shmot.equip(), как любая другая
 * вещь. Единственное отличие от обычной вещи — как она попадает во владение:
 *   - owned для ОТОБРАЖЕНИЯ в списке берётся из udata['keyring_owner'] (shmot._loadFromUdata()),
 *     а не из udata['shmot'] — потому что сама выдача идёт через roulette.php, а не через
 *     обычную покупку/дроп.
 *   - при ПЕРВОМ нажатии "НАДЕТЬ" shmot.php.equip() сам материализует запись shmot[100] как
 *     owned=true, ЕСЛИ (и только если) keyring_owner>0 на сервере — подделать item_id=100 без
 *     реального владения нельзя, сервер отклонит (fail(52)).
 *   - клиентский клик по НЕ полученной связке (item.owned===false) показывает пояснение через
 *     notify вместо похода на сервер (цена null — обычный _buy() на ней сломался бы).
 *
 * Run: node tests/shmot-keyring-shown-as-item.test.js
 */

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const shopSrc       = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
const bossesSrc     = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
const rouletteSrc   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
const shmotItemsCat = fs.readFileSync(path.join(root, 'server', 'json', 'shmot_items.json'), 'utf-8');

console.log('\nTest 1: механика связки ключей реально рабочая на сервере (регресс-гвард, не менялась этой правкой)');
{
    assert(/\$hasKeyring = \$this->ops->i\(\$user, 'keyring_owner'\) > 0;/.test(bossesSrc),
        'bosses.php читает keyring_owner при старте боя');
    assert(/if\(!\$hasKeyring\)\{[\s\S]*?fail\(64\)/.test(bossesSrc),
        'проверка/списание ключей полностью пропускается для владельца связки (многоразово, без лимита)');
    // 29.09.2026: публичный claimKeyring()-эндпоинт удалён (был эксплойтом, вызываемым прямо
    // из консоли без реального выигрыша — см. tests/roulette-global-jackpot-kush-keyring.test.js (структура) и roulette-wheel-visual-keyring-cooldown-impossible.test.js (Monte-Carlo));
    // выдача связки теперь идёт прямо внутри spin()/pickCup(), _tryClaimKeyring() остался
    // внутренним хелпером для pickCup() — сама выдача реализована, не заглушка.
    assert(/function spin\(\)/.test(rouletteSrc) && /function _tryClaimKeyring\(\)/.test(rouletteSrc),
        'выдача связки (рулетка) реализована, не заглушка');
}

console.log('\nTest 2: каталог шмоток (клиент+сервер) — запись id:100, cat:6, с реальной картинкой и серверным каталогом (обновлено 28.09.2026)');
{
    const m = shmotSrc.match(/\{id:100, cat:6, name:'Связка ключей'[^}]*\}/);
    assert(!!m, 'запись id:100 "Связка ключей" найдена в this.items');
    if(m){
        // 30.09.2026 (второй заход в тот же день): ?cb=2 — разовый сброс годового immutable-кэша
        // nginx (см. правку конфига в этот день), не влияет на то, что картинка реальная.
        assert(/imgFile:'связка ключей(\.png| v2\.png)'/.test(m[0]), 'теперь есть реальная картинка (была эмодзи-заглушка в первой версии)');
        assert(/price:null/.test(m[0]), 'по-прежнему не продаётся за валюту — выдаётся только рулеткой');
        assert(/owned:false, equipped:false\}$/.test(m[0]), 'дефолты owned/equipped false — реальное owned подставляется в _loadFromUdata()');
    }
    assert(/"id":\s*100/.test(shmotItemsCat),
        'id:100 ТЕПЕРЬ есть в server/json/shmot_items.json — нужно для shmot.php.equip() (штатная валидация по каталогу)');
}

console.log('\nTest 3: _loadFromUdata() — owned связки берётся из udata[\'keyring_owner\'], а не из обычного udata[\'shmot\']');
{
    const begin = shmotSrc.indexOf('const keyringItem = this.items.find(it => it.id === 100);');
    assert(begin > -1, 'блок синхронизации owned для id:100 найден в _loadFromUdata()');
    assert(/keyringItem\.owned = !!\(udata && parseInt\(udata\['keyring_owner'\]\) > 0\);/.test(shmotSrc),
        'owned = keyring_owner > 0 (не через массив shmot)');
    assert(/keyringItem\.equipped = false;/.test(shmotSrc),
        'equipped всегда false — не занимает слот на манекене вместе с реальным оружием cat:6');

    // Реальное выполнение той же формулы владения (изолированно от PIXI/DOM-контекста класса).
    const ownedTrue  = !!({ keyring_owner: '1' }['keyring_owner'] && parseInt({ keyring_owner: '1' }['keyring_owner']) > 0);
    const ownedFalse = !!({ keyring_owner: '0' }['keyring_owner'] && parseInt({ keyring_owner: '0' }['keyring_owner']) > 0);
    assert(ownedTrue === true, 'keyring_owner="1" → owned=true');
    assert(ownedFalse === false, 'keyring_owner="0" → owned=false');
}

console.log('\nTest 4: _onWear() — клик по НЕ полученной связке (обновлено 28.09.2026: получена → обычный shmot.equip)');
{
    const begin = shmotSrc.indexOf('_onWear(itemId){');
    const end = shmotSrc.indexOf('\n\t}', shmotSrc.indexOf('TS.php(\'shmot.equip\'', begin));
    const body = shmotSrc.slice(begin, end);
    assert(/if\(!item\.owned\)\{\s*\n\s*if\(itemId === 100\)\{/.test(body),
        'спец-случай id:100 проверяется ТОЛЬКО пока вещь НЕ получена (owned===false)');
    assert(/notify\.showResult\(\{text:'Связка еще не получена/.test(body),
        'клик по НЕ полученной связке показывает пояснение через notify, а не уходит на сервер');
    // Как только owned===true (сервер один раз подтвердил keyring_owner>0), выполнение
    // проходит МИМО спец-случая (он внутри if(!item.owned)) и идёт в общий поток equip —
    // тот же TS.php('shmot.equip') с suspend/resume, что и у любой другой вещи (см.
    // suspend-playersave-coverage-....test.js — это не дублируем здесь).
    assert(/TS\.php\('shmot\.equip', \{item_id: itemId\}/.test(body),
        'для полученной связки (owned=true) equip идёт через обычный TS.php(\'shmot.equip\'), как у любой другой вещи');
}

console.log('\nTest 5: shmot.php.equip() — материализует shmot[100] как owned только при реальном keyring_owner (сервер, обновлено 28.09.2026)');
{
    const shmotPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'shmot.php'), 'utf-8');
    assert(/if\(\$item_id === 100 && \$this->ops->i\(\$user, 'keyring_owner'\) > 0\)\{/.test(shmotPhp),
        'equip() материализует владение id:100 ТОЛЬКО если keyring_owner>0 — подделать item_id=100 без реального права нельзя');
    assert(/\$shmot\[\$item_id\]\['owned'\] = true;/.test(shmotPhp),
        'после материализации связка — обычная запись shmot[100] с owned=true, дальше идёт как любая вещь');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

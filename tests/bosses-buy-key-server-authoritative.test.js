/**
 * Test: 29.09.2026 (по прямому указанию) — покупка ключей за рубли (Счастливчик/id1/3р,
 * Ястреб/id2/6р, Меченный/id3/18р) РАЗБЛОКИРОВАНА и получила полноценный попап с ассетами.
 *
 * История: 26.09.2026 логика покупки была реализована правильно и безопасно на сервере
 * (bosses.php.buyKey(), Gameops-паттерн — деньги списываются через Gameops::deduct(), ключи
 * пишутся в тот же формат bosses_data.keys[], что startFight()/claimKill()), но ОДНОВРЕМЕННО
 * заблокирована на будущее (private $BUY_KEY_LOCKED = true на сервере, ранний return-заглушка
 * "Покупка ключей пока недоступна" на клиенте) — фичи не было в плане/дизайне игры. См. бывший
 * tests/bosses-buy-key-server-authoritative-locked.test.js (заменён этим файлом).
 *
 * 29.09.2026: фича утверждена и разблокирована с обеих сторон. Добавлен попап «Купить ключ»
 * (buy_key_popup.js, по прямому указанию — новые ассеты "попап купить ключ.png"/"кнопка купить
 * ключи.png"/3 иконки ключей, координаты и стиль подписи "Купить за N" переиспользуют попап
 * перезарядки бесплатного оружия). Три места, где раньше показывалась голая ошибка "Нужно N
 * ключей!" (bosses-combat.js._attack(), bosses_fight.js._openBossesFight(),
 * bosses_prefight.js — кнопка НАПАСТЬ), теперь открывают этот попап ВМЕСТО текста — но ТОЛЬКО
 * для боссов, которые продают ключи (buy_key>0); для остальных (Крыс/Баркут/Борода/Жгут)
 * поведение не изменилось.
 *
 * Server-authoritative паттерн покупки (Gameops::deduct, fail-коды, формат bosses_data.keys[])
 * НЕ менялся этой правкой — снят только флаг блокировки, сама логика buyKey() остаётся
 * идентичной уже проверенной ранее.
 *
 * Run: node tests/bosses-buy-key-server-authoritative.test.js
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

const bossesJs   = readSrc('_client/src/game/bosses.js');
const bossesPhp  = readSrc('server/core/controllers/bosses.php');
const combatSrc  = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightSrc   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const prefightSrc = readSrc('_client/src/game/shell/overlays/bosses_prefight.js');
const popupSrc   = readSrc('_client/src/game/shell/overlays/buy_key_popup.js');

console.log('\nTest 1: сервер — BUY_KEY_LOCKED снят (false), buyKey() дальше не блокируется');
{
    assert(/private \$BUY_KEY_LOCKED = false;/.test(bossesPhp), 'private $BUY_KEY_LOCKED = false; — фича разблокирована');
    assert(!/private \$BUY_KEY_LOCKED = true;/.test(bossesPhp), 'старое значение true нигде не осталось');
}

console.log('\nTest 2: сервер — buyKey() всё ещё server-authoritative (Gameops::deduct, не прямая запись coins), таблица стоимости не менялась');
{
    const start = bossesPhp.indexOf('function buyKey(){');
    assert(start !== -1, 'метод buyKey() найден');
    const end = bossesPhp.indexOf('\n        // Тот же формат [{owned,equipped,upg,qty}, ×6]', start);
    const body = bossesPhp.slice(start, end);

    assert(/if\(\$this->BUY_KEY_LOCKED\) return \$this->ops->fail\(56\);/.test(body), 'проверка BUY_KEY_LOCKED физически осталась в коде (флаг просто false — не удалять сам гейт)');
    assert(/\[0,\s*3,\s*6,\s*18,\s*0,\s*0,\s*0,\s*0\]/.test(body), 'таблица стоимости ключа: id1=3 (Счастливчик), id2=6 (Ястреб), id3=18 (Меченный), остальные=0');
    assert(/\$this->ops->deduct\(\$user,\s*'coins',\s*\$cost\)/.test(body), 'списание рублей всё ещё через Gameops::deduct(), не напрямую');
    assert(!/\$user\['coins'\]\s*=/.test(body), 'нет прямой записи $user[\'coins\'] = ... в обход deduct()');
}

console.log('\nTest 3: сервер — permit \'buyKey\' по-прежнему зарегистрирован');
{
    const permitsMatch = bossesPhp.match(/\$this->permits = \[([^\]]*)\];/);
    assert(!!permitsMatch, 'массив $this->permits найден');
    assert(permitsMatch && permitsMatch[1].includes("'buyKey'"), "'buyKey' присутствует в $this->permits");
}

console.log('\nTest 4: клиент — bosses.js._buyKey(idx) больше не заглушен ранним return, реально шлёт запрос на сервер');
{
    const start = bossesJs.indexOf('    _buyKey(idx){');
    assert(start !== -1, 'метод _buyKey(idx) найден в bosses.js');
    const end = bossesJs.indexOf('\n    cycleMultiplier(){', start);
    const body = bossesJs.slice(start, end);

    assert(!/notify\.showResult\(\{text:'Покупка ключей пока недоступна'\}, 0\);\s*\n\s*return;/.test(body),
        'старая заглушка "Покупка ключей пока недоступна" + безусловный return убраны');
    assert(/TS\.php\('bosses\.buyKey',\s*\{boss_id:\s*idx\}/.test(body), 'TS.php(\'bosses.buyKey\', {boss_id: idx}, ...) реально вызывается (не мёртвый код после return)');
    assert(/applyPatch\(res\.patch\)/.test(body), 'applyPatch(res.patch) применяет ответ сервера');
    assert(/this\._loadFromUdata\(\)/.test(body), '_loadFromUdata() перечитывает keys[] из свежего bosses_data');
    assert(/if\(typeof this\._closeBuyKeyPopup === 'function'\) this\._closeBuyKeyPopup\(\);/.test(body),
        'успешная покупка закрывает попап (_closeBuyKeyPopup), если он открыт');
}

console.log('\nTest 5: клиент — buy_key_popup.js существует, экспортирует attachBuyKeyPopup, подключён в bosses.js');
{
    assert(/export function attachBuyKeyPopup\(proto\)\{/.test(popupSrc), 'attachBuyKeyPopup(proto) экспортирован');
    assert(/import \{ attachBuyKeyPopup \} from '\.\/shell\/overlays\/buy_key_popup\.js';/.test(bossesJs), 'import attachBuyKeyPopup найден в bosses.js');
    assert(/attachBuyKeyPopup\(Bosses\.prototype\);/.test(bossesJs), 'attachBuyKeyPopup(Bosses.prototype) вызван');
}

console.log('\nTest 6: попап — координаты фона/кнопки/иконки ключа точно совпадают с заданными пользователем');
{
    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'попап купить ключ\.png'\)\);\s*\n\s*bg\.x = 405; bg\.y = 175;/.test(popupSrc),
        'фон "попап купить ключ.png" на x=405 y=175');
    assert(/const buyBtn = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'кнопка купить ключи\.png'\)\);\s*\n\s*buyBtn\.x = 707; buyBtn\.y = 392;/.test(popupSrc),
        'кнопка "кнопка купить ключи.png" на x=707 y=392');
    // 30.09.2026 (прогон перед деплоем — тест обновлён под позднейшую правку позиции):
    // положение иконки ключа было дополнительно скорректировано редактором позиций.
    assert(/keyIcon\.x = 662; keyIcon\.y = 350;/.test(popupSrc), 'иконка ключа на x=662 y=350');
}

console.log('\nTest 7: попап — иконка ключа масштабируется фиксированным scale (у всех 3 ключей схожие природные размеры — общий scale проще и не хуже per-texture расчёта)');
{
    // 30.09.2026 (прогон перед деплоем): динамический расчёт от ширины текстуры заменён на
    // фиксированный KEY_ICON_SCALE=0.184 (нативно даёт 50×67px) — три файла ключей одного
    // размера, отдельный расчёт на каждый не нужен.
    assert(/const KEY_ICON_SCALE = 0\.184;/.test(popupSrc), 'целевой scale ключа — константа 0.184');
    assert(/this\._buyKeyWin\.keyIcon\.scale\.set\(KEY_ICON_SCALE\);/.test(popupSrc),
        'scale ставится напрямую константой (одинаков по X и Y — пропорции сохранены)');
    assert(!/keyIcon\.width\s*=/.test(popupSrc) && !/keyIcon\.height\s*=/.test(popupSrc),
        'нет жёсткой установки width/height по отдельности (только scale, чтобы сохранить пропорции)');
}

console.log('\nTest 8: попап — три иконки ключей заведены для правильных boss_id (1=Счастливчик, 2=Ястреб, 3=Меченный)');
{
    assert(/1:\s*BASE \+ 'ключ счастливчик\.png'/.test(popupSrc), 'boss_id 1 → ключ счастливчик.png');
    assert(/2:\s*BASE \+ 'ключ ястреб\.png'/.test(popupSrc), 'boss_id 2 → ключ ястреб.png');
    assert(/3:\s*BASE \+ 'ключ меченный\.png'/.test(popupSrc), 'boss_id 3 → ключ меченный.png');
}

console.log('\nTest 9: попап — подпись "Купить за"/цена используют ТЕ ЖЕ координаты и стиль, что "Ускорить за"/цена в попапе перезарядки оружия');
{
    const weaponPopupSrc = readSrc('_client/src/game/shell/overlays/weapon_reload_popup.js');

    assert(/rushLabelTxt\.x = 541; rushLabelTxt\.y = 415;/.test(weaponPopupSrc), 'sanity: весовой ориентир — "Ускорить за" в weapon_reload_popup.js стоит на 541/415');
    // 30.09.2026 (прогон перед деплоем): x подписи довели редактором позиций до 559 (y и стиль
    // остались теми же, что у "Ускорить за") — costTxt/coinIcon рядом по-прежнему совпадают.
    assert(/buyLabelTxt\.x = 559; buyLabelTxt\.y = 415;/.test(popupSrc), '"Купить за" в buy_key_popup.js — скорректированные координаты 559/415');

    assert(/costTxt\.x = 671; costTxt\.y = 415;/.test(weaponPopupSrc), 'sanity: цена в weapon_reload_popup.js стоит на 671/415');
    assert(/costTxt\.x = 671; costTxt\.y = 415;/.test(popupSrc), 'цена в buy_key_popup.js — те же координаты 671/415');

    assert(/fontFamily: 'Southbank LT', fontSize: 20, fontWeight: 'normal', fill: '#ffee88'/.test(popupSrc),
        'тот же шрифт/цвет, что у подписи "Ускорить за"/цены в попапе перезарядки');
}

console.log('\nTest 10: интеграция — все три места "Нужно N ключей" открывают попап покупки ТОЛЬКО для боссов с buy_key>0, иначе поведение не меняется');
{
    // bosses-combat.js._attack()
    {
        const start = combatSrc.indexOf('proto._attack = function(){');
        const end   = combatSrc.indexOf('const now = Date.now();', start);
        const body  = combatSrc.slice(start, end);
        assert(/if\(d\.buy_key > 0\) this\._openBuyKeyPopup\(idx\);/.test(body), '_attack(): buy_key>0 → _openBuyKeyPopup(idx)');
        assert(/else if\(window\.iface\) iface\._openSidorovichError\('Нужно '\+d\.keys_needed\+' ключей!'/.test(body),
            '_attack(): иначе (buy_key===0) старая текстовая ошибка сохранена');
    }
    // bosses_fight.js._openBossesFight()
    {
        const start = fightSrc.indexOf('proto._openBossesFight = function(bossIdx, diffIdx){');
        const end   = fightSrc.indexOf('console.log(\'[bosses_fight._openBossesFight] новый бой', start);
        const body  = fightSrc.slice(start, end);
        assert(/if\(data\.buy_key > 0\) bosses\._openBuyKeyPopup\(bossIdx\);/.test(body), '_openBossesFight(): buy_key>0 → bosses._openBuyKeyPopup(bossIdx)');
        assert(/else this\._openSidorovichError\('Нужно '\+need\+' ключей!'\);/.test(body), '_openBossesFight(): иначе старая текстовая ошибка сохранена');
    }
    // bosses_prefight.js (кнопка НАПАСТЬ)
    {
        const start = prefightSrc.indexOf('// Ключи');
        assert(start !== -1, 'блок проверки ключей найден в bosses_prefight.js');
        const end = prefightSrc.indexOf('// Зачистка локации', start);
        const body = prefightSrc.slice(start, end);
        assert(/if\(bData && bData\.buy_key > 0\) bosses\._openBuyKeyPopup\(bossIdx\);/.test(body), 'НАПАСТЬ: buy_key>0 → bosses._openBuyKeyPopup(bossIdx)');
        assert(/else if\(window\.iface\) iface\._openSidorovichError\('Нужно '\+keysNeed\+' ключей!'/.test(body), 'НАПАСТЬ: иначе старая текстовая ошибка сохранена');
    }
}

console.log('\nTest 11: инлайн-кнопка "Купить ключ" в детейле босса теперь открывает попап, а не покупает мгновенно');
{
    assert(/det\.butt_buy_key\.on\('pointerdown', \(\)=>this\._openBuyKeyPopup\(idx\)\);/.test(bossesJs),
        '_renderBuyKey(): кнопка открывает _openBuyKeyPopup(idx)');
    assert(!/det\.butt_buy_key\.on\('pointerdown', \(\)=>this\._buyKey\(idx\)\);/.test(bossesJs),
        'старый прямой вызов _buyKey(idx) с этой кнопки убран');
}

console.log('\nTest 12: sanity — методы боя (startFight/attack/claimKill/endFightSession) не тронуты этой правкой');
{
    assert(/function startFight\(\)\{/.test(bossesPhp), 'startFight() присутствует');
    assert(/function attack\(\)\{/.test(bossesPhp), 'attack() присутствует');
    assert(/function claimKill\(\)\{/.test(bossesPhp), 'claimKill() присутствует');
    assert(/function endFightSession\(\)\{/.test(bossesPhp), 'endFightSession() присутствует');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

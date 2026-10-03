/**
 * Test: батч 21.09.2026 (продолжение) —
 *
 *  1) Полный аудит мест начисления валют без вызова achievements._checkAll() (репорт "достижения
 *     появляются пачкой после перезахода, а не сразу — нужен аудит, а не только safety-net").
 *     Найдено агентом-аудитором: bank.js.successDonat() (3 ветки), habar.js._collectDay(),
 *     zadaniya.js._claimTask(), yashik.js (collect), ryukzak.js (open), vassilich.js._openLoot(),
 *     zone.js.collectLocIncome() (сбор прибыли бизнеса), dvor.js._collectCig() + общий _give()
 *     (закрывает разом джекпот рулетки и мини-игру "9 стаканчиков"), battlepass.js._claimLevel(),
 *     bosses.js._buyKey(), bosses-combat.js.resetFreeWeaponCd(). Каждое место теперь зовёт
 *     achievements._checkAll() сразу после начисления.
 *
 *  2) Универсальный редактор позиций — "текст-бокс": по прямому указанию (идея пользователя),
 *     кнопка создаёт перетаскиваемый/растяжимый прямоугольник с текстом-образцом, который сам
 *     держится по центру бокса при любом перемещении/ресайзе/повороте — визуальный аналог
 *     window._centerTextIn(text, box) прямо в редакторе, без ручного создания подложек-блоков
 *     каждый раз в коде. 📋 КОПИРОВАТЬ для бокса отдаёт готовый {x,y,w,h}.
 *
 * Run: node tests/achievements-trigger-audit-and-pos-editor-textbox.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, '_client/src', rel), 'utf-8'); }

console.log('\nTest 1: bank.js.successDonat() — все 3 ветки доната (тушёнка/монеты/сигареты) проверяют достижения');
{
    // 26.09.2026 (фикс двойного начисления доната, см. комментарий над _refreshBalanceAfterPurchase()
    // в bank.js): тушёнка/монеты/сигареты раньше начисляли валюту ЛОКАЛЬНО в каждой из 3 веток и
    // каждая сама звала achievements._checkAll() сразу после начисления. Это убрали — теперь все 3
    // ветки лишь запрашивают у сервера актуальный баланс через this._refreshBalanceAfterPurchase(currency),
    // а achievements._checkAll() вызывается ОДИН раз внутри неё, уже после того как баланс реально
    // пришёл с сервера (иначе достижения проверялись бы по ещё не обновлённым данным). Тест обновлён
    // под эту структуру: 3 вызова _refreshBalanceAfterPurchase() в ветках + 1 _checkAll() внутри неё.
    const src = readSrc('game/bank.js');
    const start = src.indexOf('// Тушенка (item0..7)');
    const end   = src.indexOf('} else {', src.indexOf('ветка СИГАРЕТЫ'));
    const body  = src.slice(start, end);
    const n = (body.match(/this\._refreshBalanceAfterPurchase\(/g) || []).length;
    assert(n === 3, 'найдено 3 вызова _refreshBalanceAfterPurchase() — по одному на тушёнку/монеты/сигареты (нашли ' + n + ')');

    const refreshStart = src.indexOf('_refreshBalanceAfterPurchase(currency, expectedCount){');
    const refreshEnd   = src.indexOf('\n\thideBank', refreshStart);
    assert(refreshStart !== -1 && refreshEnd !== -1, '_refreshBalanceAfterPurchase(currency) найден в bank.js');
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(refreshStart, refreshEnd)),
        'вызов _checkAll() найден внутри _refreshBalanceAfterPurchase(), после обновления баланса с сервера');
}

console.log('\nTest 2: habar.js._collectDay() проверяет достижения после начисления всех наград дня');
{
    const src = readSrc('game/habar.js');
    const start = src.indexOf('_collectDay(){');
    // 'this._updateHabarTimer();' встречается ДВАЖДЫ внутри _collectDay() — первый раз в
    // ранней guard-ветке кулдауна (indexOf находил именно её), из-за чего окно обрезалось
    // ДО настоящего конца функции, где реально стоит вызов achievements. Используем сам
    // вызов achievements как правую границу (плюс запас), а не более раннюю landmark-строку.
    const end   = src.indexOf('achievements._checkAll();', start) + 200;
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(start, end)), 'вызов найден внутри _collectDay()');
}

console.log('\nTest 3: zadaniya.js._claimTask() проверяет достижения');
{
    // 23.09.2026: zadaniya.js переписан на server-authoritative (tasks.claim, см.
    // server/core/controllers/tasks.php) — награда больше не применяется оптимистично ДО
    // ответа сервера, поэтому achievements._checkAll() теперь вызывается ВНУТРИ успешного
    // колбэка (после applyPatch), а не синхронно до самого TS.php-вызова, как было раньше.
    const src = readSrc('game/zadaniya.js');
    const start = src.indexOf("TS.php('tasks.claim'");
    const end   = src.indexOf('}, (err)=>{', start);
    assert(start !== -1 && end !== -1, "колбэк TS.php('tasks.claim', ...) найден");
    const body = src.slice(start, end);
    assert(/applyPatch\(e\.patch\);/.test(body), 'applyPatch(e.patch) вызывается в успешном колбэке');
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(body), 'вызов _checkAll() найден внутри успешного колбэка, после applyPatch');
}

console.log('\nTest 4: yashik.js — collectReward() (crestик/ЗАБРАТЬ) проверяет достижения после applyPatch');
{
    const src = readSrc('game/shell/overlays/yashik.js');
    const start = src.indexOf("TS.php('yashik.collect'");
    const end   = src.indexOf("}, (err)=>{", start);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(start, end)), 'вызов найден внутри success-колбэка yashik.collect');
}

console.log('\nTest 5: ryukzak.js — open() success проверяет достижения после applyPatch');
{
    const src = readSrc('game/shell/overlays/ryukzak.js');
    const start = src.indexOf("TS.php('ryukzak.open'");
    const end   = src.indexOf("}, (err) => {", start);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(start, end)), 'вызов найден внутри success-колбэка ryukzak.open');
}

console.log('\nTest 6: vassilich.js._openLoot() проверяет достижения (в отличие от _buy(), раньше не проверял)');
{
    // 27.09.2026: _openLoot() переписан на честный запрос→ответ (см.
    // purchase-confirm-vassilich-race-fix.test.js) — клиент больше не катает RNG и не
    // применяет эффект ЛОКАЛЬНО до ответа сервера, achievements._checkAll() теперь вызывается
    // ВНУТРИ success-колбэка vassilich.open_loot (тот же паттерн, что и у yashik.collect/
    // ryukzak.open выше), а не сразу в начале функции.
    const src = readSrc('game/vassilich.js');
    const start = src.indexOf("TS.php('vassilich.open_loot'");
    const end   = src.indexOf('}, (err)=>{', start);
    assert(start >= 0, 'TS.php(\'vassilich.open_loot\' найден в _openLoot()');
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(start, end)), 'вызов найден внутри success-колбэка vassilich.open_loot');
}

console.log('\nTest 7: zone.js.collectLocIncome() — сбор прибыли бизнеса проверяет достижения после applyPatch');
{
    const src = readSrc('game/zone.js');
    const start = src.indexOf('collectLocIncome(locIdx, onDone){');
    const end   = src.indexOf('const rewardItems = [];', start);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(start, end)), 'вызов найден сразу после applyPatch(res.patch) в collectLocIncome()');
}

console.log('\nTest 8: dvor.js — _collectCig() (облачка сигарет) и общий _give() (джекпот рулетки, все казино-награды) проверяют достижения');
{
    const src = readSrc('game/dvor.js');
    // 26.09.2026 (обновлено вслед за переносом _collectCig() на сервер, см.
    // tests/dvor-collect-cig-server-authoritative.test.js): achievements._checkAll() теперь
    // вызывается ВНУТРИ колбэка TS.php('dvor.collectCig', ...), уже ПОСЛЕ applyPatch(e.patch) —
    // до ответа сервера клиент не знает актуальное cigarettes, поэтому сам вызов текстуально
    // находится дальше, чем this._showFloatingCig() (тот вызывается раньше, как немедленный
    // визуальный фидбек). Граница среза расширена до начала следующего метода.
    const collectStart = src.indexOf('_collectCig(idx, spr){');
    const collectEnd   = src.indexOf('\n    _showFloatingText', collectStart);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(collectStart, collectEnd)), '_collectCig() проверяет достижения (в колбэке TS.php, после applyPatch)');

    const giveStart = src.indexOf('_give(type, amount){');
    const giveEnd   = src.indexOf('\n    }', src.indexOf("udata['dvor_games']", giveStart));
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(giveStart, giveEnd)),
        '_give() проверяет достижения безусловно для ЛЮБОГО типа награды (закрывает разом джекпот рулетки и приз мини-игры "9 стаканчиков", которые оба идут через _give)');
}

console.log('\nTest 9: battlepass.js._claimLevel() проверяет достижения');
{
    const src = readSrc('game/battlepass.js');
    const start = src.indexOf('_claimLevel(lv){');
    const end   = src.indexOf('this._saveToUdata();', start);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(src.slice(start, end)), 'вызов найден внутри _claimLevel()');
}

console.log('\nTest 10: bosses.js._buyKey() и bosses-combat.js.resetFreeWeaponCd() проверяют достижения (Group B — трата рублей)');
{
    const bossesSrc = readSrc('game/bosses.js');
    const bStart = bossesSrc.indexOf('_buyKey(idx){');
    const bEnd   = bossesSrc.indexOf('this._showDetail(idx);', bStart);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(bossesSrc.slice(bStart, bEnd)), '_buyKey() проверяет достижения');

    // 26.09.2026: resetFreeWeaponCd() перестал сам тратить рубли на клиенте (см.
    // incident_permits_must_be_public — читер мог вызвать её из консоли и сбросить КД бесплатно)
    // и теперь лишь делегирует в серверный _rushFreeWeaponCd() (bosses.rushFreeWeapon),
    // achievements._checkAll() вызывается там же, в success-колбэке, после applyPatch.
    const combatSrc = readSrc('game/bosses/bosses-combat.js');
    const rStart = combatSrc.indexOf('proto.resetFreeWeaponCd = function');
    const rEnd   = combatSrc.indexOf('\n    };', rStart);
    assert(/this\._rushFreeWeaponCd\(eqWpn\.id\);/.test(combatSrc.slice(rStart, rEnd)), 'resetFreeWeaponCd() делегирует в _rushFreeWeaponCd()');

    const pStart = combatSrc.indexOf('proto._rushFreeWeaponCd = function');
    const pEnd   = combatSrc.indexOf("}, (err) => {", pStart);
    assert(pStart !== -1 && pEnd !== -1, '_rushFreeWeaponCd() найден');
    assert(/applyPatch\(res\.patch\);/.test(combatSrc.slice(pStart, pEnd)), '_rushFreeWeaponCd() применяет patch от сервера');
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(combatSrc.slice(pStart, pEnd)), '_rushFreeWeaponCd() проверяет достижения в success-колбэке (после applyPatch)');
}

console.log('\nTest 11: universal_pos_editor.js — кнопка "текст-бокс" создаёт бокс с самоцентрирующимся текстом');
{
    const src = readSrc('game/shell/overlays/universal_pos_editor.js');
    assert(/proto\._uCreateTextBox = function\(\)\{/.test(src), '_uCreateTextBox определён');
    assert(/box\._uDraggable = true;/.test(src) && /box\._uIsTextBox = true;/.test(src),
        'бокс помечен _uDraggable (ловится общим хит-тестом) и _uIsTextBox (для readout/Delete/копирования)');
    assert(/label\._uIsCenterTextLabel = true;/.test(src),
        'текст-образец помечен и исключён из общего хит-теста — двигается только вместе с боксом, не сам по себе');
    assert(/box\._uOnTransform = \(\) => \{/.test(src), '_uOnTransform определён — пересчитывает позицию текста по getBounds() бокса');
}

console.log('\nTest 12: _uOnTransform реально вызывается из ВСЕХ путей изменения объекта — драг мышью, resize за ручки, стрелки/Q-E/PageUp-Down');
{
    const src = readSrc('game/shell/overlays/universal_pos_editor.js');
    const calls = (src.match(/if\(typeof (?:obj|this\._uSelected)\._uOnTransform === 'function'\) (?:obj|this\._uSelected)\._uOnTransform\(\);/g) || []).length;
    assert(calls === 3, 'найдено 3 точки вызова _uOnTransform — drag(onMove), _uApplyResize, клавиатурный обработчик (нашли ' + calls + ')');
}

console.log('\nTest 13: Delete/Backspace удаляет ТОЛЬКО текст-бокс (не обычные игровые объекты) — бокс и его текст убираются вместе');
{
    const src = readSrc('game/shell/overlays/universal_pos_editor.js');
    assert(/\(e\.key === 'Delete' \|\| e\.key === 'Backspace'\) && this\._uSelected\._uIsTextBox\)\{/.test(src),
        'Delete/Backspace гейтится флагом _uIsTextBox — обычные спрайты/тексты игры не удаляются');
    const start = src.indexOf('proto._uDeleteTextBox = function');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(/box\._uCenterText && box\._uCenterText\.parent/.test(body) && /box\.parent\) box\.parent\.removeChild\(box\)/.test(body),
        '_uDeleteTextBox убирает и текст-образец, и сам бокс');
}

console.log('\nTest 14: все текст-боксы очищаются при выключении режима редактора (не остаются "призраками")');
{
    const src = readSrc('game/shell/overlays/universal_pos_editor.js');
    const start = src.indexOf('proto._disableUniversalEdit = function');
    const end   = src.indexOf('\n    }\n}', start);
    const body  = src.slice(start, end);
    assert(/this\._uTextBoxes\.forEach\(box => \{/.test(body), '_disableUniversalEdit проходит по всем this._uTextBoxes');
    assert(/this\._uTextBoxes = \[\];/.test(body), 'массив обнуляется после очистки');
}

console.log('\nTest 15: 📋 КОПИРОВАТЬ для текст-бокса отдаёт {x,y,w,h} (готовую форму для window._centerTextIn)');
{
    const src = readSrc('game/shell/overlays/universal_pos_editor.js');
    const start = src.indexOf('proto._uCopySelected = function');
    const end   = src.indexOf('\n    };', start);
    assert(/s\._uIsTextBox\s*\n\s*\? '\{x: ' \+ Math\.round\(s\.x\) \+ ', y: ' \+ Math\.round\(s\.y\) \+ ', w: ' \+ Math\.round\(s\.width\) \+ ', h: ' \+ Math\.round\(s\.height\) \+ '\}'/.test(src.slice(start, end)),
        'ветка text-box собирает строку в формате {x,y,w,h}');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 27.09.2026 (по прямому указанию, репорт игрока — "После попытки снова напасть, нижний
 * худ пропадает, в бой не заходит", сразу после сообщения "Зашел снова в бой, победу засчитало").
 *
 * Расследование цепочки экранов при клике НАПАСТЬ → бой:
 *  1. bosses_select.js._onNapastClick() → iface._openBossPreFight(i) — экран выбора оружия,
 *     pushHud('bossPrefight', {down:false}).
 *  2. Клик по кнопке НАПАСТЬ на этом экране (bosses_prefight.js, ~строка 375-394):
 *     this._closeBossPreFight() (popHud('bossPrefight')) → this._bossWin.visible = false
 *     (тот САМЫЙ экран выбора боссов, скрыт ЗАРАНЕЕ, ДО того, как известен результат) →
 *     iface._openBossesFight(bossIdx, selectedDiff).
 *  3. bosses_fight.js._openBossesFight() для генуинно нового боя шлёт bosses.startFight на
 *     сервер. При УСПЕХЕ колбэк вызывает _reallyOpenBossesFight(), которая делает
 *     popHud('bossSelect') и pushHud('bossFight', {down:false}) — экран боя строится, ХУД
 *     корректен.
 *
 * Баг — в ветке ОШИБКИ startFight() (код 62 "дневной лимит исчерпан" — ожидаемо СРАЗУ после
 * победы, которая как раз этот лимит и заполнила; либо код 63/64/99 по другой причине). Этот
 * колбэк раньше только показывал попап ошибки. Экран выбора боссов (bosses_select.js) К ЭТОМУ
 * МОМЕНТУ уже скрыт шагом 2 (win.visible=false, ДО отправки запроса), а HUD-стек (iface.
 * _hudStack, см. interface.js.restoreHud() — "последний открытый экран побеждает") всё ещё
 * хранит СТАРУЮ запись 'bossSelect' (down:false) — popHud('bossSelect') снимается ТОЛЬКО внутри
 * _reallyOpenBossesFight(), которая при отказе сервера так и не вызывается. Итог: попап ошибки
 * закрывается игроком, а под ним навсегда остаётся СКРЫТЫЙ экран боссов и нижний ХУД, всё ещё
 * подчиняющийся протухшей записи 'bossSelect' — ровно "нижний ХУД пропадает, в бой не заходит".
 *
 * Фикс: колбэк ошибки startFight() сразу пересобирает экран выбора боссов
 * (iface._openBossesPopup()) — свежий видимый _bossWin и корректный HUD-стек — попап ошибки
 * просто рисуется поверх него, как и раньше.
 *
 * Run: node tests/boss-startfight-error-restores-select-screen.test.js
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

const fightSrc    = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const prefightSrc = readSrc('_client/src/game/shell/overlays/bosses_prefight.js');
const interfaceSrc = readSrc('_client/src/game/interface.js');

console.log('\nsanity: причина существования бага — restoreHud() решает ТОЛЬКО по верхушке стека');
{
    const s = interfaceSrc.indexOf('restoreHud(){');
    const e = interfaceSrc.indexOf('\n\t}', s);
    const body = interfaceSrc.slice(s, e);
    assert(/const top = this\._hudStack\.length \? this\._hudStack\[this\._hudStack\.length - 1\] : \{ up: true, down: true \};/.test(body),
        'restoreHud() применяет ТОЛЬКО последнюю запись стека — забытый pop где-то ниже по цепочке экранов навсегда перекрывает дефолт');
}

console.log('\nsanity: bosses_prefight.js скрывает экран выбора боссов ДО того, как известен результат startFight()');
{
    const s = prefightSrc.indexOf("napBtn.on('pointerdown', ()=>{");
    const e = prefightSrc.indexOf('win.addChild(napBtn);', s);
    const body = prefightSrc.slice(s, e);
    assert(/this\._closeBossPreFight\(\);/.test(body), 'закрывает экран выбора оружия (popHud(\'bossPrefight\'))');
    assert(/if\(this\._bossWin\) this\._bossWin\.visible = false;/.test(body),
        'подтверждено: экран выбора боссов скрывается ОПТИМИСТИЧНО, до ответа сервера — если startFight() откажет, скрытие остаётся висеть');
    assert(/if\(window\.iface\) iface\._openBossesFight\(bossIdx, selectedDiff\);/.test(body), 'дальше зовёт _openBossesFight — асинхронный запрос к серверу');
}

console.log('\nTest 1: ошибка startFight() пересобирает экран выбора боссов (iface._openBossesPopup())');
{
    const cbStart = fightSrc.indexOf("TS.php('bosses.startFight'");
    const errStart = fightSrc.indexOf('}, (err) => {', cbStart);
    const errEnd   = fightSrc.indexOf('});', errStart);
    assert(errStart !== -1 && errEnd !== -1, 'колбэк ошибки startFight() найден');
    const body = fightSrc.slice(errStart, errEnd);

    assert(/if\(window\.iface && typeof iface\._openBossesPopup === 'function'\) iface\._openBossesPopup\(\);/.test(body),
        'КРИТИЧНО: колбэк ошибки пересобирает экран выбора боссов — снимает протухшую запись \'bossSelect\' из HUD-стека и возвращает видимый _bossWin');
}

console.log('\nTest 2: пересборка происходит ДО показа попапа ошибки (попап должен рисоваться ПОВЕРХ уже видимого экрана, не наоборот)');
{
    const cbStart = fightSrc.indexOf("TS.php('bosses.startFight'");
    const errStart = fightSrc.indexOf('}, (err) => {', cbStart);
    const errEnd   = fightSrc.indexOf('});', errStart);
    const body = fightSrc.slice(errStart, errEnd);

    const restorePos = body.indexOf('iface._openBossesPopup();');
    const limitMsgPos = body.indexOf("notify.showResult({text: 'Лимит ");
    const genericErrPos = body.indexOf("this._openSidorovichError('Не удалось начать бой'");
    assert(restorePos !== -1 && limitMsgPos !== -1 && genericErrPos !== -1, 'все три фрагмента найдены в теле колбэка');
    assert(restorePos < limitMsgPos && restorePos < genericErrPos,
        '_openBossesPopup() вызывается РАНЬШЕ обоих вариантов попапа ошибки (лимит / общий) — попап всегда поверх свежего экрана');
}

console.log('\nTest 3: регресс-гвард — существующая обработка кода 62 (точное сообщение о лимите) и общий фолбэк не удалены');
{
    const cbStart = fightSrc.indexOf("TS.php('bosses.startFight'");
    const errStart = fightSrc.indexOf('}, (err) => {', cbStart);
    const errEnd   = fightSrc.indexOf('});', errStart);
    const body = fightSrc.slice(errStart, errEnd);
    assert(/if\(err && err\.code === 62\)\{/.test(body), 'проверка кода 62 (дневной лимит) на месте');
    // 29.09.2026: текст сменился с "убийств" на "попыток" — см.
    // tests/boss-daily-attempt-spent-on-any-outcome.test.js (лимит тратится за любой исход).
    assert(/notify\.showResult\(\{text: 'Лимит ' \+ limit \+ ' попыток на сегодня исчерпан!'\}, 0\);/.test(body), 'точное сообщение о лимите на месте');
    assert(/this\._openSidorovichError\('Не удалось начать бой', 'Проверьте ключи и зачистку локации'\);/.test(body), 'общий фолбэк для остальных кодов на месте');
}

console.log('\nTest 4: регресс-гвард — успешный путь startFight() НЕ тронут (popHud(\'bossSelect\')/pushHud(\'bossFight\') по-прежнему только там)');
{
    const cbStart = fightSrc.indexOf("TS.php('bosses.startFight'");
    const successEnd = fightSrc.indexOf('}, (err) => {', cbStart);
    const successBody = fightSrc.slice(cbStart, successEnd);
    assert(/this\._reallyOpenBossesFight\(bossIdx\);/.test(successBody), 'успешный путь по-прежнему строит экран боя через _reallyOpenBossesFight()');
    assert(!/iface\._openBossesPopup\(\);/.test(successBody), 'фикс добавлен ТОЛЬКО в ветку ошибки — успешный путь не вызывает лишнюю пересборку экрана выбора боссов');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

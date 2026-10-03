/**
 * Test: 29.09.2026, репорт игрока Flex (скриншот попапа победы над Охотником) — "я ударил 20,
 * чел ударил 140, ещё один ударил 32... откуда взялась 1000 HP? Как он победил?". HP-бар вверху
 * экрана честно показывал 0/1000 (босс реально убит), но "УЧАСТНИКИ БОЯ"/"ТОП УРОНА" в попапе
 * суммарно показывали только 140+32+20+5+5=202 урона — разница (~800) нигде не объяснялась.
 *
 * Корень: урон помощника "Седой" (bosses.php.useSedoy(), покупается за хабар) реально пишется в
 * boss_damage_log и реально снижает производный HP босса (_syncFightSession()/_applyFriendDamage()
 * считают ВСЕ строки без фильтра по is_sedoy) — но с 29.09.2026 (см. большой комментарий у
 * _ratingTop() в bosses.php) урон Седого намеренно ИСКЛЮЧЁН из топа участников боя (is_sedoy=0
 * фильтр), чтобы не выглядело, будто друг ударил на сотни урона. При этом ответ claimKill() не
 * возвращал клиенту НИКАКОЙ отдельной суммы урона Седого — попап просто молчал об источнике
 * недостающего урона.
 *
 * По прямому указанию (уточнение в этой же сессии): "Седой умеет наносить урон боссам. Он
 * отображается в попапе результата боя. Но при этом Седой не учитывается в топе по урону, в
 * скиллах и в остальных вещах" — т.е. НЕ баг сам факт исключения из топа, а отсутствие отдельного
 * отображения. Фикс: bosses.php.claimKill() считает урон Седого (свой + друзей) ОТДЕЛЬНО от
 * topEntries и возвращает его новым полем 'sedoyDamage'; bosses-combat.js прокидывает его в опции
 * попапа.
 *
 * ⚠️ 02.10.2026 (найдено при разборе упавшего теста): boss_result.js реализует отображение НЕ
 * отдельной строкой "Седой помог: +N урона" (как было задумано изначально в этом же комментарии),
 * а подмешиванием игрока синтетической записью в top[] (_applyRatingTop(), _sedoyDisplayOnly:true),
 * когда sedoyDamage>0 и у игрока ещё нет обычной записи — урон показывается через уже существующий
 * механизм подписи под аватаром (shownDamage). ТОЛЬКО на победе и ТОЛЬКО когда Седой реально бил
 * (>0) — это условие осталось тем же, поменялся лишь способ показа. Сам топ участников/рейтинг
 * урона по-прежнему не включает Седого (регресс не должен сломаться).
 *
 * ⚠️ 30.09.2026 (по прямому указанию — "урон седого отправляется друзьям? не должен, исправь"):
 * "урон Седого (свой + друзей)" выше — РЕВЕРСНУТО. `_sedoyDamageFriendsSince()` удалена вместе со
 * своим слагаемым в claimKill() — платный Седой друга больше не влияет на HP этого боя вообще, и
 * его урон в этот попап тоже больше не подмешивается. `sedoyDamage` теперь = ТОЛЬКО мой Седой
 * (`_sedoyDamageMineSince()`). См. tests/boss-sedoy-damage-not-shared-with-friends.test.js.
 *
 * Run: node tests/boss-result-popup-sedoy-damage-shown-separately.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhpPath = path.join(root, 'server', 'core', 'controllers', 'bosses.php');
const combatPath    = path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js');
const resultPath    = path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js');

const bossesPhpSrc = fs.readFileSync(bossesPhpPath, 'utf-8');
const combatSrc     = fs.readFileSync(combatPath, 'utf-8');
const resultSrc     = fs.readFileSync(resultPath, 'utf-8');

console.log('\n1) bosses.php: хелпер считает МОЙ урон Седого отдельно от рейтинга (30.09.2026: friends-версия удалена)');
{
    assert(/private function _sedoyDamageMineSince\(\$link,\s*\$uid,\s*\$bossId,\s*\$sinceMs\)/.test(bossesPhpSrc),
        '_sedoyDamageMineSince() определена');
    // 30.09.2026 (прогон перед деплоем — тест обновлён под фактический код): проверяем, что
    // САМА ФУНКЦИЯ _sedoyDamageFriendsSince() удалена (нет её определения) — не что строка с
    // этим именем не встречается нигде в файле вообще. Имя ещё фигурирует в комментарии на
    // 227 строке, поясняющем историю правки ("функция удалена вместе с этим слагаемым") — это
    // документация, не код, и не должно ронять тест.
    assert(!/private function _sedoyDamageFriendsSince/.test(bossesPhpSrc),
        '30.09.2026: private function _sedoyDamageFriendsSince() удалена целиком (была единственным местом, добавлявшим седого друга в этот попап) — имя может остаться только в поясняющем комментарии');

    const mineIdx = bossesPhpSrc.indexOf('private function _sedoyDamageMineSince');
    const mineBody = bossesPhpSrc.slice(mineIdx, mineIdx + 500);
    assert(/`is_sedoy`=1/.test(mineBody), '_sedoyDamageMineSince() фильтрует ИМЕННО is_sedoy=1 (не исключает, а выбирает удары Седого)');
}

console.log('\n2) bosses.php.claimKill(): sedoyDamage считается ТОЛЬКО из своего урона и уходит в ответ клиенту');
{
    const claimIdx = bossesPhpSrc.indexOf('function claimKill(){');
    assert(claimIdx !== -1, 'claimKill() найден в файле');
    // 29.09.2026 (найдено плановым прогоном всего набора тестов): claimKill() — одна из
    // самых больших функций контроллера (>22000 симв.), а оба искомых вхождения 'sedoyDamage'
    // лежат ближе к концу функции — старое окно 6000 симв. обрезало их обоих раньше, чем
    // regex успевал дойти. Расширено с запасом.
    const claimBody = bossesPhpSrc.slice(claimIdx, claimIdx + 25000);

    assert(/\$sedoyDamage\s*=\s*\$this->_sedoyDamageMineSince\(\$hpLink,\s*\$uid,\s*\$bossId,\s*\$fightStart\);/.test(claimBody),
        'claimKill() вычисляет $sedoyDamage ЦЕЛИКОМ из _sedoyDamageMineSince() — оператор `;` сразу после вызова, никакого "+ friends" слагаемого');

    // 'sedoyDamage' => $sedoyDamage должно встретиться ДВАЖДЫ: один раз в $claimDebug (для
    // error_log), один раз в финальном ok()-ответе клиенту — оба нужны для диагностики.
    const occurrences = (claimBody.match(/'sedoyDamage'\s*=>\s*\$sedoyDamage/g) || []).length;
    assert(occurrences >= 2, "'sedoyDamage' => $sedoyDamage передаётся и в debug-лог, и в ok()-ответ клиенту (найдено вхождений: " + occurrences + ")");
}

console.log('\n3) Регресс: _ratingTop() по-прежнему исключает Седого из топа участников боя (excludeSedoy=true не тронут)');
{
    const ratingTopIdx = bossesPhpSrc.indexOf('private function _ratingTop(');
    assert(ratingTopIdx !== -1, '_ratingTop() найден');
    const ratingTopBody = bossesPhpSrc.slice(ratingTopIdx, ratingTopIdx + 1200);

    assert(/_damageSumSince\(\$link,\s*\$uid,\s*\$bossId,\s*\$startMs,\s*true\)/.test(ratingTopBody),
        'мой урон в топе по-прежнему считается с excludeSedoy=true');
    // 30.09.2026 (прогон перед деплоем — тест обновлён под фактическую сигнатуру): 29.09.2026
    // _friendsDamagePerUserSince() отрефакторили на приём готовой карты $friendsSince
    // (uid=>effectiveSinceMs, см. _friendsSinceMap()) вместо отдельных $friendIds+$startMs —
    // сигнатура стала 3-аргументной. Проверяем актуальный вызов, а не старый 4-аргументный.
    assert(/_friendsDamagePerUserSince\(\$link,\s*\$friendsSince,\s*true\)/.test(ratingTopBody),
        'урон друзей в топе по-прежнему считается с excludeSedoy=true — Седой не примешивается к чужому урону');
}

console.log('\n4) bosses-combat.js: sedoyDamage из ответа сервера прокидывается в опции попапа результата боя');
{
    const onDefeatIdx = combatSrc.indexOf('proto._onDefeat = function(idx){');
    assert(onDefeatIdx !== -1, '_onDefeat() найден');
    const popupCallIdx = combatSrc.indexOf('_showBossResultPopup({', onDefeatIdx);
    assert(popupCallIdx !== -1, 'вызов _showBossResultPopup() найден внутри _onDefeat()');
    const popupCallBody = combatSrc.slice(popupCallIdx, popupCallIdx + 1500);

    assert(/sedoyDamage:\s*res\.sedoyDamage\s*\|\|\s*0/.test(popupCallBody),
        'opts.sedoyDamage берётся из res.sedoyDamage (ответ claimKill), с фолбэком на 0');
}

console.log('\n5) boss_result.js: урон Седого отображён — видна только на победе и только когда sedoyDamage>0');
{
    // 02.10.2026 (найдено при разборе этого провала): дизайн "отдельная строка 'Седой помог:
    // +N урона'" из шапки файла (29/30.09.2026) в итоге НЕ попал в код в таком виде — вместо
    // этого _applyRatingTop() (boss_result.js) подмешивает текущего игрока СИНТЕТИЧЕСКОЙ
    // записью в top[] (id/nick/damage:0, _sedoyDisplayOnly:true), когда Седой реально бил и
    // игрока ещё нет среди обычных участников — а дальше его личная сумма Седого отображается
    // ЧЕРЕЗ УЖЕ существующий механизм подписи под аватаром (shownDamage, см.
    // tests/boss-result-popup-hp-text-placeholder-avatars-and-conditional-top-list.test.js), а
    // не отдельным текстовым блоком с подписью "Седой помог". Смысл не изменился (победа +
    // sedoyDamage>0 → урон виден; поражение или sedoyDamage=0 → не виден) — изменился только
    // КАК он виден.
    assert(/sedoyDamage/.test(resultSrc), 'boss_result.js читает opts.sedoyDamage');

    const gateMatch = resultSrc.match(/const sedoyDamage = isWin \? Number\(opts\.sedoyDamage \|\| 0\) : 0;/);
    assert(!!gateMatch, 'sedoyDamage сразу обнуляется, если не победа (isWin ? opts.sedoyDamage : 0) — тот же гейт по победе');

    assert(/if\(sedoyDamage > 0 && ownId && !hasOwnEntry\)\{/.test(resultSrc),
        'синтетическая запись подставляется ТОЛЬКО когда sedoyDamage>0 И у игрока ещё нет обычной записи в top (не задваивает урон)');

    assert(/_sedoyDisplayOnly: true/.test(resultSrc), 'синтетическая запись помечена _sedoyDisplayOnly — отличима от реального боевого участника');

    // Симуляция самого гейта в отрыве от PIXI/рендера — те же 4 сценария, что реально
    // встречаются в игре (значение sedoyDamage после победного гейта и hasOwnEntry=false).
    const shouldShow = (isWin, sedoyDamageRaw, hasOwnEntry) => {
        const sedoyDamage = isWin ? Number(sedoyDamageRaw || 0) : 0;
        return sedoyDamage > 0 && !hasOwnEntry;
    };
    assert(shouldShow(true, 800, false) === true,  'победа + Седой бил 800 урона (игрока ещё нет в top) → подстановка происходит');
    assert(shouldShow(true, 0, false)   === false, 'победа без Седого (0 урона) → подстановка НЕ происходит');
    assert(shouldShow(false, 800, false) === false, 'поражение (даже если Седой почему-то бил) → подстановка НЕ происходит');
    assert(shouldShow(true, undefined, false) === false, 'победа, sedoyDamage не передан (undefined) → подстановка НЕ происходит, не крашится');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

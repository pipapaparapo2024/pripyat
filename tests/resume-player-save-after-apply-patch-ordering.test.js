/**
 * Test: батч 25.09.2026 (по прямому указанию + скриншот "сброс КД бесплатного оружия всё ещё
 * не работает" + логи сервера) — найден корень: логи подтвердили, что сервер (bosses.php.
 * claimKill/endFightSession) КОРРЕКТНО пишет freeWpnCdMs:[] и sessionVerifiedFromDbAfterSave
 * это подтверждает. Но КЛИЕНТ во всех успешных колбэках server-authoritative запросов вызывал
 * resumePlayerSave() ДО applyPatch() — если во время полёта запроса что-либо ещё поставило
 * автосейв в очередь (pendingFlushOnResume=true, player-save.js — например тик регенерации
 * энергии), resumePlayerSave() немедленно шлёт flushPlayerSave() СО СТАРЫМ udata (ещё БЕЗ
 * applyPatch), users.save тут же затирает обратно то, что сервер только что записал напрямую
 * (freeWpnCdMs, ключи, patron/poker_session и т.д.). Тот же класс гонки, что уже чинили для
 * bossStartMs/keys 24.09.2026 (см. suspendPlayerSave) — просто с более тонкой ошибкой порядка
 * ВНУТРИ самой защиты.
 *
 * Фикс — единый для всех мест: applyPatch(res.patch) ВСЕГДА идёт ДО resumePlayerSave() в
 * успешном колбэке (в error-колбэке порядок не важен — патча нет).
 *
 * Run: node tests/resume-player-save-after-apply-patch-ordering.test.js
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

const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightSrc  = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const pokerSrc  = readSrc('_client/src/game/dvor/dvor-poker-game.js');

// Ищем именно КОД (закавыченный reason строкового литерала звонка), не голую подстроку
// 'resumePlayerSave(' — она попадается и в пояснительных комментариях ВЫШЕ реальной строки
// кода (эти комментарии сами упоминают "resumePlayerSave()" как часть объяснения фикса).
function assertApplyBeforeResume(src, startMarker, endMarker, reason, label){
    const s = src.indexOf(startMarker);
    if(s === -1){ console.error('    ✗ маркер начала не найден для ' + label + ': ' + startMarker); failed++; return; }
    const e = src.indexOf(endMarker, s);
    const body = src.slice(s, e === -1 ? s + 4000 : e);
    const applyIdx  = body.indexOf('applyPatch(res.patch);');
    const resumeCall = "resumePlayerSave('" + reason + "');";
    // lastIndexOf — некоторые функции (_onDefeat/poker.deal/poker.resolve) ДОПОЛНИТЕЛЬНО зовут
    // resumePlayerSave() в РАННЕМ return (невалидный ответ сервера, патча ещё нет — там порядок
    // не важен, патчить нечего). Нас интересует вызов на "счастливом" пути, после applyPatch —
    // он всегда ПОСЛЕДНИЙ в теле успешного колбэка.
    const resumeIdx = body.lastIndexOf(resumeCall);
    assert(applyIdx !== -1, label + ': applyPatch(res.patch) найден');
    assert(resumeIdx !== -1, label + ': ' + resumeCall + ' найден');
    assert(applyIdx !== -1 && resumeIdx !== -1 && applyIdx < resumeIdx,
        label + ': applyPatch() идёт ДО ' + resumeCall + ' (иначе отложенный автосейв уйдёт со старым udata)');
}

console.log('\nTest 1: bosses-combat.js._attack — applyPatch до resumePlayerSave(\'boss_attack\')');
assertApplyBeforeResume(combatSrc, "TS.php('bosses.attack',", "}, (err) => {", 'boss_attack', '_attack');

console.log('\nTest 2: bosses-combat.js._onFightTimeout — applyPatch до resumePlayerSave(\'boss_end_fight_timeout\')');
assertApplyBeforeResume(combatSrc, "TS.php('bosses.endFightSession', {boss_id: idx, diff_idx: diffIdxAtLoss}", "}, (err) => {", 'boss_end_fight_timeout', '_onFightTimeout');

console.log('\nTest 3: bosses-combat.js._onDefeat — applyPatch до resumePlayerSave(\'boss_claim_kill\')');
assertApplyBeforeResume(combatSrc, "TS.php('bosses.claimKill',", "}, (err) => {", 'boss_claim_kill', '_onDefeat');

console.log('\nTest 4: bosses_fight.js — startFight — applyPatch до resumePlayerSave(\'boss_start_fight\')');
assertApplyBeforeResume(fightSrc, "TS.php('bosses.startFight',", "}, (err) => {", 'boss_start_fight', 'startFight');

console.log('\nTest 5: bosses_fight.js._forfeitBossFight — applyPatch до resumePlayerSave(\'boss_end_fight_forfeit\')');
assertApplyBeforeResume(fightSrc, "TS.php('bosses.endFightSession', {boss_id: idx, diff_idx: diffIdx}", "}, (err) => {", 'boss_end_fight_forfeit', '_forfeitBossFight');

console.log('\nTest 6: dvor-poker-game.js — poker.deal — applyPatch до resumePlayerSave(\'poker_deal\')');
assertApplyBeforeResume(pokerSrc, "TS.php('poker.deal',", "}, (err) => {", 'poker_deal', 'poker.deal');

console.log('\nTest 7: dvor-poker-game.js — poker.resolve — applyPatch до resumePlayerSave(\'poker_resolve\')');
assertApplyBeforeResume(pokerSrc, "TS.php('poker.resolve',", "}, (err) => {", 'poker_resolve', 'poker.resolve');

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

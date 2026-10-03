/**
 * Test: найден 24.09.2026 по живому репорту ("не сохраняются ключи/лимиты боссов, последний
 * убийца тоже") — ПОДТВЕРЖДЕНО логами прод-сервера (/var/log/php_errors.log):
 * `[bosses.claimKill] {"uid":382448269,...,"saveVerifyMismatch":true}` — сервер записал
 * bosses_data (ключи/дневной лимит), но при контрольном перечитывании из БД получил ДРУГОЕ
 * значение. Причина: bosses.startFight()/attack()/claimKill() пишут bosses_data НАПРЯМУЮ
 * через Gameops::saveUser(), в обход обычного клиентского автосейва (player-save.js,
 * 500мс-дебаунс) — если НЕЗАВИСИМАЯ мутация udata (например, тик регенерации энергии)
 * планирует и запускает автосейв РОВНО в окне "запрос отправлен → ответ применён", он шлёт
 * СТАРЫЙ снимок udata (ещё без applyPatch от этого запроса), и если его ответ приходит
 * ПОСЛЕ прямой записи сервера — тихо затирает её.
 *
 * Существовавший flushPlayerSave('boss_start_fight'/'boss_claim_kill', ...) ПЕРЕД запросом
 * защищал только от УЖЕ стоявшего в очереди сейва — не от НОВОГО, запланированного, пока сам
 * критичный запрос летит туда-обратно. Фикс: suspendPlayerSave()/resumePlayerSave()
 * (player-save.js) перекрывают всё окно запроса — ни один автосейв не может сработать, пока
 * ответ startFight/attack/claimKill не применён.
 *
 * Run: node tests/bosses-save-race-suspend-resume.test.js
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

const saveSrc   = readSrc('_client/src/modules/player-save.js');
const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightSrc  = readSrc('_client/src/game/shell/overlays/bosses_fight.js');

console.log('\nTest: player-save.js экспортирует suspendPlayerSave()/resumePlayerSave() и регистрирует их на window');
{
    assert(/export function suspendPlayerSave\(/.test(saveSrc), 'suspendPlayerSave() экспортирован');
    assert(/export function resumePlayerSave\(/.test(saveSrc), 'resumePlayerSave() экспортирован');
    assert(/window\.suspendPlayerSave = suspendPlayerSave;/.test(saveSrc), 'suspendPlayerSave зарегистрирован на window (как flushPlayerSave/queuePlayerSave)');
    assert(/window\.resumePlayerSave = resumePlayerSave;/.test(saveSrc), 'resumePlayerSave зарегистрирован на window');
}

console.log('\nTest: suspendPlayerSave() — счётчик (поддерживает вложенные/параллельные критичные запросы)');
{
    const start = saveSrc.indexOf('export function suspendPlayerSave(');
    const end   = saveSrc.indexOf('\n}', start);
    const body  = saveSrc.slice(start, end);
    assert(/saveSuspended\+\+/.test(body), 'suspendPlayerSave() инкрементирует счётчик, а не ставит булев флаг');
    assert(/clearTimeout\(saveTimer\)/.test(body), 'suspendPlayerSave() отменяет уже запланированный debounce-таймер');
}

console.log('\nTest: resumePlayerSave() не снимает приостановку раньше времени при вложенных вызовах, и досылает отложенный сейв');
{
    const start = saveSrc.indexOf('export function resumePlayerSave(');
    const end   = saveSrc.indexOf('\n}', start);
    const body  = saveSrc.slice(start, end);
    assert(/if\(saveSuspended > 0\) saveSuspended--;/.test(body), 'декремент счётчика');
    assert(/if\(saveSuspended > 0\) return;/.test(body), 'при вложенном suspend (счётчик всё ещё > 0) resumePlayerSave() ничего не отправляет');
    assert(/pendingFlushOnResume/.test(body), 'учитывает отложенный во время приостановки флаш (pendingFlushOnResume)');
}

console.log('\nTest: flushPlayerSave() не отправляет сохранение, пока saveSuspended > 0 (сама гонка)');
{
    const start = saveSrc.indexOf('export function flushPlayerSave(');
    const end   = saveSrc.indexOf('\n}', start);
    const body  = saveSrc.slice(start, end);
    const suspendCheckIdx = body.indexOf('if(saveSuspended > 0){');
    const sendIdx = body.indexOf("window.TS.php('users.save'");
    assert(suspendCheckIdx !== -1, 'flushPlayerSave() проверяет saveSuspended');
    assert(suspendCheckIdx !== -1 && sendIdx !== -1 && suspendCheckIdx < sendIdx,
        'проверка saveSuspended стоит РАНЬШЕ фактической отправки users.save — блокирует её, а не просто логирует');
    assert(/pendingFlushOnResume = true;/.test(body), 'запоминает, что сохранить всё равно нужно, когда закончится приостановка');
}

console.log('\nTest: bosses.attack (bosses-combat.js) теперь тоже приостанавливает автосейв на время запроса (раньше не было вообще никакой защиты)');
{
    const start = combatSrc.indexOf("TS.php('bosses.attack'");
    const ctxBefore = combatSrc.slice(Math.max(0, start - 400), start);
    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('boss_attack'\);/.test(ctxBefore),
        'suspendPlayerSave вызывается непосредственно перед TS.php(\'bosses.attack\', ...)');

    // 25.09.2026 (найден дальнейший баг по прямому указанию + логам сервера — "сброс КД
    // бесплатного оружия всё ещё не работает"): resumePlayerSave() ДОЛЖЕН идти ПОСЛЕ
    // applyPatch(res.patch), а не "в начале колбэка" (как было раньше) — иначе отложенный
    // автосейв (pendingFlushOnResume), сработавший СРАЗУ по выходу из suspend, уходит со
    // СТАРЫМ udata (patch ещё не применён) и затирает то, что сервер только что записал
    // напрямую. См. tests/resume-player-save-after-apply-patch-ordering.test.js.
    const successStart = start;
    const successEnd   = combatSrc.indexOf('}, (err) => {', successStart);
    const successChunk = combatSrc.slice(successStart, successEnd);
    const applyIdx  = successChunk.indexOf('applyPatch(res.patch);');
    const resumeIdx = successChunk.indexOf("resumePlayerSave('boss_attack');");
    assert(applyIdx !== -1 && resumeIdx !== -1 && applyIdx < resumeIdx,
        'resumePlayerSave вызывается в успешном колбэке bosses.attack, ПОСЛЕ applyPatch(res.patch)');

    const errStart = combatSrc.indexOf("console.error('[bosses-combat._attack] ← ошибка сервера:'");
    const errCtxBefore = combatSrc.slice(Math.max(0, errStart - 200), errStart);
    assert(/if\(window\.resumePlayerSave\) resumePlayerSave\('boss_attack'\);/.test(errCtxBefore),
        'resumePlayerSave вызывается и в колбэке ошибки bosses.attack (иначе автосейв замрёт навсегда при сетевой ошибке)');
}

console.log('\nTest: bosses.claimKill (bosses-combat.js._onDefeat) приостанавливает автосейв на всё время запроса');
{
    const flushIdx    = combatSrc.indexOf("flushPlayerSave('boss_claim_kill', () => {");
    const suspendIdx  = combatSrc.indexOf("suspendPlayerSave('boss_claim_kill');", flushIdx);
    const claimCallIdx = combatSrc.indexOf("TS.php('bosses.claimKill'", flushIdx);
    assert(flushIdx !== -1 && suspendIdx !== -1 && claimCallIdx !== -1 && suspendIdx < claimCallIdx,
        'suspendPlayerSave вызывается внутри колбэка flushPlayerSave, ДО отправки claimKill');

    // 25.09.2026: resumePlayerSave() теперь ПОСЛЕ applyPatch() на "счастливом" пути (см.
    // tests/resume-player-save-after-apply-patch-ordering.test.js) — в раннем return
    // (невалидный ответ) по-прежнему вызывается сразу, там патчить нечего.
    const successEnd   = combatSrc.indexOf('}, (err) => {', claimCallIdx);
    const successChunk = combatSrc.slice(claimCallIdx, successEnd);
    const applyIdx  = successChunk.indexOf('applyPatch(res.patch);');
    const resumeIdx = successChunk.lastIndexOf("resumePlayerSave('boss_claim_kill');");
    assert(applyIdx !== -1 && resumeIdx !== -1 && applyIdx < resumeIdx,
        'resumePlayerSave вызывается в успешном колбэке claimKill, ПОСЛЕ applyPatch(res.patch)');

    const errStart = combatSrc.indexOf("}, (err) => {", claimCallIdx);
    const errChunk = combatSrc.slice(errStart, errStart + 200);
    assert(/if\(window\.resumePlayerSave\) resumePlayerSave\('boss_claim_kill'\);/.test(errChunk),
        'resumePlayerSave вызывается и в колбэке ошибки claimKill');
}

console.log('\nTest: bosses.startFight (bosses_fight.js._openBossesFight) приостанавливает автосейв на всё время запроса');
{
    const flushIdx   = fightSrc.indexOf("flushPlayerSave('boss_start_fight', () => {");
    const suspendIdx = fightSrc.indexOf("suspendPlayerSave('boss_start_fight');", flushIdx);
    const startCallIdx = fightSrc.indexOf("TS.php('bosses.startFight'", flushIdx);
    assert(flushIdx !== -1 && suspendIdx !== -1 && startCallIdx !== -1 && suspendIdx < startCallIdx,
        'suspendPlayerSave вызывается внутри колбэка flushPlayerSave, ДО отправки startFight');

    // 25.09.2026: resumePlayerSave() теперь ПОСЛЕ applyPatch() (см. tests/resume-player-save-
    // after-apply-patch-ordering.test.js).
    const successEnd   = fightSrc.indexOf('}, (err) => {', startCallIdx);
    const successChunk = fightSrc.slice(startCallIdx, successEnd);
    const applyIdx  = successChunk.indexOf('applyPatch(res.patch);');
    const resumeIdx = successChunk.indexOf("resumePlayerSave('boss_start_fight');");
    assert(applyIdx !== -1 && resumeIdx !== -1 && applyIdx < resumeIdx,
        'resumePlayerSave вызывается в успешном колбэке startFight, ПОСЛЕ applyPatch(res.patch)');

    const errStart = fightSrc.indexOf("}, (err) => {", startCallIdx);
    const errChunk = fightSrc.slice(errStart, errStart + 200);
    assert(/if\(window\.resumePlayerSave\) resumePlayerSave\('boss_start_fight'\);/.test(errChunk),
        'resumePlayerSave вызывается и в колбэке ошибки startFight');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

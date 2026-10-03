/**
 * Test: найдено 24.09.2026 по живому репорту ("выбил пару в покере, но не дали 20 рублей") —
 * ПОДТВЕРЖДЕНО консолью пользователя — при активной игре в покер почти КАЖДЫЙ deal/swap/resolve
 * печатал "!!! записанное и прочитанное обратно значение разошлись !!!" (saveVerifyMismatch).
 * Та же природа гонки, что уже чинили для боссов (см. bosses-save-race-suspend-resume.test.js
 * и большой коммент в player-save.js) — poker.deal/swap/resolve пишут poker_session НАПРЯМУЮ
 * через Gameops::saveUser(), в обход обычного автосейва. В покере воспроизводимость намного
 * выше, чем у боссов, — клики идут заметно чаще (deal→swap→swap→swap→resolve за секунды),
 * поэтому 500мс-окно автосейва почти всегда перекрывалось со следующим запросом.
 *
 * Run: node tests/poker-save-race-suspend-resume.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client/src/game/dvor/dvor-poker-game.js'), 'utf-8');

// 25.09.2026 (найден дальнейший баг по прямому указанию + логам сервера — "сброс КД
// бесплатного оружия всё ещё не работает", тот же класс гонки в покере): для запросов, которые
// применяют applyPatch() (deal/resolve), resumePlayerSave() теперь ДОЛЖЕН идти ПОСЛЕ него —
// иначе отложенный автосейв (pendingFlushOnResume), сработавший СРАЗУ по выходу из suspend,
// уходит со СТАРЫМ udata. poker.swap() applyPatch() вообще не вызывает (нет патча в ответе) —
// для него порядок не важен, просто ищем resumePlayerSave в разумном окне, как раньше.
// См. tests/resume-player-save-after-apply-patch-ordering.test.js.
function checkCall(label, callMarker, suspendTag, expectApplyPatch){
    console.log(`\nTest: ${label} приостанавливает автосейв на всё время запроса`);
    const callIdx = src.indexOf(callMarker);
    assert(callIdx !== -1, `вызов ${callMarker} найден`);

    const before = src.slice(Math.max(0, callIdx - 300), callIdx);
    assert(before.includes(`suspendPlayerSave('${suspendTag}')`),
        `suspendPlayerSave('${suspendTag}') вызывается непосредственно перед запросом`);

    const successEnd   = src.indexOf('}, (err) => {', callIdx);
    const successChunk = src.slice(callIdx, successEnd);
    if(expectApplyPatch){
        const applyIdx  = successChunk.indexOf('applyPatch(res.patch);');
        const resumeIdx = successChunk.lastIndexOf(`resumePlayerSave('${suspendTag}');`);
        assert(applyIdx !== -1 && resumeIdx !== -1 && applyIdx < resumeIdx,
            `resumePlayerSave('${suspendTag}') вызывается в успешном колбэке, ПОСЛЕ applyPatch(res.patch)`);
    } else {
        assert(successChunk.includes(`resumePlayerSave('${suspendTag}')`),
            `resumePlayerSave('${suspendTag}') вызывается в успешном колбэке`);
    }

    const errStart = successEnd;
    const errChunk = src.slice(errStart, errStart + 250);
    assert(errChunk.includes(`resumePlayerSave('${suspendTag}')`),
        `resumePlayerSave('${suspendTag}') вызывается и в колбэке ошибки (иначе автосейв замрёт навсегда при сбое сети)`);
}

checkCall('poker.deal', "TS.php('poker.deal'", 'poker_deal', true);
checkCall('poker.swap', "TS.php('poker.swap'", 'poker_swap', false);
checkCall('poker.resolve', "TS.php('poker.resolve'", 'poker_resolve', true);

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

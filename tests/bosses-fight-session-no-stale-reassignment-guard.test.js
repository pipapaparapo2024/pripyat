/**
 * Test: 04.10.2026 — статический guard на КЛАСС бага, который уже ловился вручную 4 раза при
 * переводе boss_fight_session на блокировку строки (_syncFightSessionLocked()/
 * _commitFightSession(), см. большой комментарий над ними в bosses.php): если поле реально
 * записано атомарным raw UPDATE через _commitFightSession() (в обход Gameops::saveUser()), но
 * функция ПОЗЖЕ всё равно зовёт обычный saveUser($user) для других полей — любое
 * `$user['boss_fight_session'] = ...` между этими двумя точками тихо затирает только что
 * закоммиченное значение устаревшим снимком (saveUser пишет ТОЛЬКО то, что реально лежит в
 * $user, а $user так и не узнал про атомарную правку).
 *
 * Это ОСОЗНАННО обычный regex-тест по тексту файла, не real-execution — но здесь это уместно:
 * проверяемое свойство ("нет такой-то строки МЕЖДУ двумя другими строками в тексте функции") —
 * структурный факт исходного кода, а не поведение во время исполнения, поэтому текстовый анализ
 * бьёт точно по сути бага (в отличие от регекс-тестов на "правильное число" — см. разговор
 * 04.10.2026 про слабость таких тестов).
 *
 * Проверяет ВЕСЬ файл (не только 4 известных сейчас места: friendsDamage/startFight/attack/
 * useSedoy) — если появится 5-е место, вызывающее _commitFightSession(), оно автоматически
 * попадёт под ту же проверку, без ручного добавления сюда.
 *
 * Run: node tests/bosses-fight-session-no-stale-reassignment-guard.test.js
 */
const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php');
const src = fs.readFileSync(SRC_PATH, 'utf-8');

let passed = 0, failed = 0;
function check(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else { console.error('  ❌ FAIL:', msg); failed++; }
}

// Извлекает тела функций верхнего уровня класса — от `function name(...){` до СВОЕЙ закрывающей
// `}` (с учётом вложенных скобок), без regex на весь файл сразу (вложенность brace-counting
// regex не осилит надёжно).
function extractFunctionBodies(text) {
    const bodies = [];
    const fnStart = /(?:private\s+|public\s+|protected\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = fnStart.exec(text)) !== null) {
        const name = m[1];
        let depth = 1;
        let i = fnStart.lastIndex;
        const bodyStart = i;
        while (depth > 0 && i < text.length) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') depth--;
            i++;
        }
        bodies.push({ name, body: text.slice(bodyStart, i - 1) });
    }
    return bodies;
}

const functions = extractFunctionBodies(src);
console.log(`Найдено функций в bosses.php: ${functions.length}`);

const COMMIT_CALL = /_commitFightSession\s*\(/g;
const SAVEUSER_CALL = /\bsaveUser\s*\(\s*\$user\s*\)/g;
const STALE_ASSIGN = /\$user\s*\[\s*['"]boss_fight_session['"]\s*\]\s*=/;

let totalCommitSites = 0;
let checkedFns = 0;

for (const { name, body } of functions) {
    const commitMatches = [...body.matchAll(COMMIT_CALL)];
    if (commitMatches.length === 0) continue;
    checkedFns++;
    totalCommitSites += commitMatches.length;

    const saveUserMatches = [...body.matchAll(SAVEUSER_CALL)];

    for (const commitMatch of commitMatches) {
        const commitIdx = commitMatch.index;
        const nextSaveUser = saveUserMatches.find(s => s.index > commitIdx);
        if (!nextSaveUser) {
            // Эта функция коммитит сессию, но вообще не зовёт обычный saveUser($user) после —
            // безопасно по определению (нечему затирать значение).
            check(true, `${name}(): _commitFightSession() без последующего saveUser($user) в этой же функции — ничего затирать`);
            continue;
        }
        const between = body.slice(commitIdx, nextSaveUser.index);
        check(!STALE_ASSIGN.test(between),
            `${name}(): между _commitFightSession() и следующим saveUser($user) нет $user['boss_fight_session']=... (значение не будет затёрто устаревшим снимком)`);
    }
}

check(checkedFns >= 4, `найдено минимум 4 функции, вызывающие _commitFightSession() (известные: friendsDamage/startFight/attack/useSedoy), получено ${checkedFns}`);
check(totalCommitSites >= 4, `минимум 4 места вызова _commitFightSession() в файле, получено ${totalCommitSites}`);

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

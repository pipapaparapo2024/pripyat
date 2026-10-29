/**
 * Test: 29.10.2026 — фикс 4 критичных находок фонового аудита безопасности контроллеров
 * (server/core/controllers/*.php), по прямому указанию пользователя ("чини критичные 1-4").
 *
 * Находка #1 (raznaryadka.php): все 7 dev*-пермитов (devCompleteToday/devFailDay/devSeedMonth/
 * devSkipDay/devResetDaySkip/devForceLaunchMonth/devRevertToRealMonth) были защищены ТОЛЬКО
 * отсутствием кнопки в UI — любой игрок мог из консоли вызвать devSeedMonth+devSkipDay по кругу
 * и получить полный набор наград месяца без единого реального действия. Фикс — тот же гейт
 * _isDevUser()/_requireDevUser(), что уже есть в bosses.php/game2048.php/users.php.
 *
 * Находка #4 (zanachki.php): devGrantAll — тот же класс дыры (+100 всех 105 карточек одним
 * вызовом), тот же фикс.
 *
 * Находка #3 (users.php): stash_data был в whitelist $allowed БЕЗ guard'а в $jsonBlobGuards —
 * игрок мог users.save() подделать себе полные коллекции "Заначек" и бесконечно гонять
 * zanachki.claimCollection. Фикс — новый _sanitizeStashData() (тот же принцип, что уже есть у
 * _sanitizeWeapons/_sanitizeInventory/_sanitizeBossesData — запрещает РОСТ относительно уже
 * сохранённого в БД).
 *
 * Находка #2 (blackjack.php): deal()/swap()/resolve() читали-мутировали-писали blackjack_session
 * без лока строки (в отличие от соседнего poker.php, уже защищённого _withUserLock()) — два
 * почти одновременных resolve() на выигрышной руке могли оба начислить награду. Фикс — тот же
 * _withUserLock()/_rawLink() паттерн, что в poker.php/zone.php.
 *
 * Части 1-3 (чистая логика авторизации/санитайзера, без DB) — РЕАЛЬНОЕ исполнение PHP через
 * Reflection (см. tests/_php_bin.js и докблок там же про стратегию "без реальных DB-коннектов").
 * Часть 4 (blackjack-лок) — структурная проверка исходника (GET_LOCK требует настоящую MySQL,
 * которую эти тесты намеренно не поднимают) — тот же класс "brace/scope-scanner", что
 * tests/boss-result-shmot-hover-scope-crash-fix.test.js: ловит, что _withUserLock(function
 * РЕАЛЬНО оборачивает тело каждой из трёх функций (не просто упомянут где-то в файле).
 *
 * Run: node tests/oct29-security-audit-fixes.test.js
 */
const fs = require('fs');
const path = require('path');
const { findPhpBin } = require('./_php_bin.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;
function check(cond, msg){
    if(cond){ console.log('  ✅', msg); passed++; }
    else     { console.error('  ❌ FAIL:', msg); failed++; }
}

// ── Части 1-3: реальное исполнение PHP (dev-гейты + sanitizer) ──
const phpBin = findPhpBin();
if(!phpBin){
    console.log('⚠️  PHP не найден локально — часть теста (реальное исполнение) пропущена, см. tests/_php_bin.js.');
} else {
    const fixture = path.join(__dirname, '_php_fixtures', 'oct29-security-audit-devgate-stashdata.php');
    let stdout;
    try {
        stdout = execFileSync(phpBin, ['-d', 'display_errors=stderr', fixture], { encoding: 'utf-8', timeout: 15000 });
    } catch(e){
        console.error('❌ PHP-скрипт упал (фатальная ошибка):');
        console.error(e.stderr || e.message);
        process.exit(1);
    }
    stdout.trim().split('\n').forEach(line => {
        if(line.startsWith('PASS:')){ console.log('  ✅', line.slice(6)); passed++; }
        else if(line.startsWith('FAIL:')){ console.error('  ❌ FAIL:', line.slice(6)); failed++; }
        else if(line.startsWith('===')) console.log('\n' + line.replace(/=== | ===/g, ''));
        else if(line.trim()) console.log('  ', line);
    });
}

// ── Часть 4: структурная проверка блокировки в blackjack.php ──
console.log('\nBlackjack — _withUserLock реально оборачивает deal()/swap()/resolve()');
const bjSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');

check(/private function _rawLink\(\)/.test(bjSrc), 'blackjack.php содержит _rawLink() (отдельное подключение для лока, как в poker.php)');
check(/private function _withUserLock\(callable \$fn\)/.test(bjSrc), 'blackjack.php содержит _withUserLock(callable $fn)');
check(/GET_LOCK/.test(bjSrc) && /RELEASE_LOCK/.test(bjSrc), 'blackjack.php использует GET_LOCK/RELEASE_LOCK (advisory-лок на строку игрока)');

// Для каждой функции: вырезаем блок от "function X(){" до следующего "function "/конца класса
// на том же уровне отступа (8 пробелов — уровень методов класса) и проверяем, что
// "_withUserLock(function" встречается СРАЗУ после объявления (до первого ops->loadUser()),
// а не просто где-то в файле — иначе легко было бы пройти регекс, обернув только часть кода.
function extractFunctionBody(src, name){
    const startIdx = src.indexOf('function ' + name + '(){');
    if(startIdx === -1) return null;
    const nextFnIdx = src.indexOf('\n        function ', startIdx + 1);
    return src.slice(startIdx, nextFnIdx === -1 ? src.length : nextFnIdx);
}
['deal', 'swap', 'resolve'].forEach(fnName => {
    const body = extractFunctionBody(bjSrc, fnName);
    check(!!body, `${fnName}() найдена в blackjack.php`);
    if(!body) return;
    const lockIdx = body.indexOf('_withUserLock(function');
    const loadUserIdx = body.indexOf('$this->ops->loadUser()');
    check(lockIdx !== -1 && lockIdx < loadUserIdx,
        `${fnName}(): _withUserLock(function...) оборачивает тело ДО первого loadUser() (не просто упомянут в файле)`);
    // Закрывающая "});" лока должна идти ПОСЛЕ последнего $this->ops->ok(...) в теле той же
    // функции — иначе лок закрылся бы раньше, чем функция реально отпустила строку.
    const lastOkIdx = body.lastIndexOf('$this->ops->ok(');
    const closeLockIdx = body.indexOf('\n            });', lastOkIdx);
    check(lastOkIdx !== -1 && closeLockIdx !== -1 && closeLockIdx > lastOkIdx,
        `${fnName}(): закрытие лока "});" стоит ПОСЛЕ последнего ok()-ответа, не раньше`);
});

console.log(`\n${'─'.repeat(60)}`);
if(failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

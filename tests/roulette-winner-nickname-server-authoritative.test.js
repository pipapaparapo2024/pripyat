/**
 * Test: 25.09.2026, по прямому указанию (2 скриншота — ник победителя рулетки показывается
 * повреждённым текстом вида "U0442U0430U043B..." или дефолтным "СТАЛКЕР" вместо реального ника) —
 *
 * Расследование нашло РЕАЛЬНУЮ причину повреждения (не там, где предполагалось): roulette_winner
 * хранит JSON-строку {"name":...,"amount":...} — database.php.trueJSON() (читает КАЖДУЮ строку
 * users-таблицы) успешно json_decode()-ил её как "похожую на JSON-блоб" и подменял на PHP-массив
 * (тот же баг-класс, что уже чинили для nick/nickname 18.09.2026 — см. комментарий в самом
 * database.php), а trueStrings() (пишет КАЖДУЮ строку обратно) перекодировал этот массив через
 * голый json_encode() БЕЗ JSON_UNESCAPED_UNICODE — кириллица превращалась в \uXXXX-escape.
 *
 * Плюс отдельная логическая проблема: запись `roulette_winner` раньше срабатывала ПОЛНОСТЬЮ на
 * клиенте (dvor-roulette-screen.js), ещё ДО того, как игрок решил забрать 500р или рискнуть в
 * суперигре — "победитель" фиксировался даже если игрок в итоге ничего не забрал, а имя бралось
 * из сиюминутного udata['nickname'] (могло быть пустым/устаревшим на момент выигрыша).
 *
 * Фикс:
 *  1) database.php — 'roulette_winner' добавлен в исключение $isStringField (как nick/nickname) —
 *     больше никогда не проходит JSON-автопарсинг туда-обратно.
 *  2) roulette.php.claimPrize() — теперь САМ пишет roulette_winner (было полностью на клиенте),
 *     только в момент реального ЗАБРАТЬ 500р, читая настоящий сохранённый $user['nick'], с явным
 *     JSON_UNESCAPED_UNICODE.
 *  3) users.php — 'roulette_winner' убран из client-writable $allowed whitelist (клиент больше не
 *     может подделать его через users.save).
 *  4) dvor-roulette-screen.js — клиентская запись убрана целиком.
 *
 * Run: node tests/roulette-winner-nickname-server-authoritative.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const dbSrc      = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'database.php'), 'utf-8');
const rouletteSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
const usersSrc   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const screenSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');

console.log('\nTest 1: database.php — roulette_winner исключён из JSON-автопарсинга (как nick/nickname)');
{
    const start = dbSrc.indexOf('$isStringField = $keys[$i]');
    assert(start !== -1, '$isStringField найден');
    const line = dbSrc.slice(start, dbSrc.indexOf(';', start) + 1);
    assert(/\$keys\[\$i\] === 'nick'/.test(line), "'nick' по-прежнему в исключении (регресс-гвард)");
    assert(/\$keys\[\$i\] === 'nickname'/.test(line), "'nickname' по-прежнему в исключении (регресс-гвард)");
    assert(/\$keys\[\$i\] === 'roulette_winner'/.test(line), "'roulette_winner' добавлен в исключение");
}

console.log('\nTest 2: roulette.php.claimPrize() — пишет roulette_winner на сервере, с реальным ником и JSON_UNESCAPED_UNICODE');
{
    const start = rouletteSrc.indexOf('function claimPrize(){');
    const end   = rouletteSrc.indexOf('\n    }', rouletteSrc.indexOf("\$this->ops->ok(['patch'=>\$patch, 'amount'=>500", start));
    const body  = rouletteSrc.slice(start, end);
    assert(/\$nick = trim\(strval\(\$user\['nick'\] \?\? ''\)\);/.test(body), 'читает РЕАЛЬНЫЙ сохранённый ник из серверной строки игрока ($user[\'nick\'])');
    assert(/'name' => \(\$nick !== '' \? \$nick : 'Сталкер'\), 'amount' => 500, 'id' => abs\(intval\(\$this->registry\['uid'\]\)\)/.test(body),
        'формирует winner-объект с name/amount/id (фолбэк "Сталкер" — только для реально пустого ника)');
    assert(/\$user\['roulette_winner'\] = json_encode\(\$winner, JSON_UNESCAPED_UNICODE\);/.test(body),
        'кодирует ЯВНО с JSON_UNESCAPED_UNICODE (та же защита, что poker.php/blackjack.php)');
    assert(/patchCurrencies\(\$user, \['coins', 'coins_earned', 'roulette_winner'\]\)/.test(body),
        "'roulette_winner' добавлен в patch — клиент узнаёт обновлённое значение через applyPatch()");
    // Запись победителя должна произойти ДО saveUser() (в одной транзакции с начислением 500р),
    // не отдельным запросом.
    const winnerIdx = body.indexOf("\$user['roulette_winner']");
    const saveIdx   = body.indexOf('saveUser($user)');
    assert(winnerIdx !== -1 && saveIdx !== -1 && winnerIdx < saveIdx, 'roulette_winner выставляется ДО saveUser() — одна атомарная запись');
}

console.log('\nTest 3: users.php — roulette_winner убран из client-writable whitelist');
{
    const allowedBlock = usersSrc.match(/\$allowed = \[[\s\S]*?\];/)[0];
    // Ищем именно ЭЛЕМЕНТ массива ('roulette_winner', с запятой) — не упоминание в explanatory
    // комментарии рядом (там же поясняется, что поле убрано — комментарий не в счёт, известная
    // ловушка регекса, см. CLAUDE.md).
    assert(!/'roulette_winner',/.test(allowedBlock),
        "'roulette_winner' отсутствует СРЕДИ ЭЛЕМЕНТОВ \$allowed (клиент не может подделать его через users.save) — упоминание в пояснительном комментарии не в счёт");
    assert(/'stash_data','stash_count',/.test(allowedBlock), 'соседние поля stash_data/stash_count остались на месте (регресс-гвард)');
}

console.log('\nTest 4: dvor-roulette-screen.js — клиент больше не пишет roulette_winner напрямую');
{
    assert(!/udata\['roulette_winner'\] = JSON\.stringify/.test(screenSrc),
        'прямая запись udata[\'roulette_winner\'] = JSON.stringify(...) удалена целиком');
    assert(!/const winner = \{ name: \(udata\['nickname'\]/.test(screenSrc),
        'клиентский объект winner (с сиюминутным udata[\'nickname\']) удалён');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

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
 * 12.10.2026 (РЕВЕРТ пункта 2 по прямому указанию, живой репорт — "забрал гарантированные 500р,
 * а отобразило, что сорвал джекпот на 500р"): логическая ошибка пережила сам фикс кодировки —
 * claimPrize() ЭТО ВЕТКА ГАРАНТИРОВАННЫХ 500р (игрок сознательно отказался рисковать, Куш не
 * выбивал), но именно она писала публичного "победителя джекпота", который видят ВСЕ игроки на
 * экране рулетки. Реальный выигрыш Куша (pickCup(), ветка $reward==='kush') при этом вообще не
 * трогал roulette_winner — доска объявляла джекпот тем, кто его не выигрывал, и молчала про
 * настоящих победителей. Запись перенесена из claimPrize() В pickCup() (ветка kush), сумма —
 * $this->KUSH_AMOUNT (реальный размер Куша), а не захардкоженные 500. claimPrize() больше НЕ
 * трогает roulette_winner вовсе — см. Test 2 (переписан) и Test 5 (новый).
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

console.log('\nTest 2: 12.10.2026 (РЕВЕРТ) — roulette.php.claimPrize() (гарантированные 500р) БОЛЬШЕ НЕ пишет roulette_winner — игрок тут не выиграл джекпот');
{
    const start = rouletteSrc.indexOf('function claimPrize(){');
    const end   = rouletteSrc.indexOf('\n    }', rouletteSrc.indexOf("\$this->ops->ok(['patch'=>\$patch, 'amount'=>500", start));
    const body  = rouletteSrc.slice(start, end);
    // Исключаем строки-комментарии (объясняющие ИСТОРИЮ переноса и законно упоминающие имя
    // поля) перед проверкой — иначе regex ложно падает на пояснительном тексте, а не на коде.
    const codeOnly = body.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
    assert(!/roulette_winner/.test(codeOnly), 'claimPrize() НИГДЕ в коде не упоминает roulette_winner (ни записи, ни в patch; упоминания в explanatory-комментариях не в счёт) — гарантированное утешение не объявляется публично как выигрыш джекпота');
    assert(/patchCurrencies\(\$user, \['coins', 'coins_earned'\]\)/.test(body), "patch сузился до coins/coins_earned (roulette_winner убран)");
    assert(/\$this->ops->add\(\$user, 'coins', 500\);/.test(body), 'сами 500р по-прежнему начисляются (экономика этой ветки не тронута)');
}

console.log('\nTest 5: 12.10.2026 (ВТОРАЯ правка, живой репорт — "выбил куш, дали 50 тысяч, а должны дать джекпот") — pickCup(), ветка реального Куша читает ЖИВОЙ jackpot_pool, платит ИМ (не $this->KUSH_AMOUNT), и ТОЛЬКО тут сбрасывает пул на 3000');
{
    const kushStart = rouletteSrc.indexOf("if(\$reward === 'kush'){");
    assert(kushStart !== -1, 'ветка $reward===\'kush\' найдена в pickCup()');
    const kushEnd = rouletteSrc.indexOf('\n        }', rouletteSrc.indexOf("'kush' => true,", kushStart));
    const body = rouletteSrc.slice(kushStart, kushEnd);

    // Живое чтение пула — не захардкоженная сумма и не параметр, пришедший из более ранней части
    // функции (там он мог устареть на несколько спинов других игроков).
    assert(/\$jackpotPool = \$this->KUSH_AMOUNT;/.test(body), '$this->KUSH_AMOUNT используется ТОЛЬКО как фолбэк по умолчанию (на случай недоступности БД)');
    assert(/SELECT `jackpot_pool` FROM `roulette_state` WHERE `id`=1 FOR UPDATE/.test(body), 'читает АКТУАЛЬНОЕ значение пула прямо в момент выигрыша');
    // 27.10.2026 (баг найден по прямому указанию — "Николай Седенко сорвал джекпот, но сам
    // джекпот не упал и сумма не обнулилась"): переменная переименована $row→$poolRow (рядом
    // появился второй лок — $lockRow на строку игрока, см. Test 5a ниже) и обёрнута в FOR UPDATE
    // + транзакцию — старое "if($row) $jackpotPool = ..." в одну строку стало блоком, внутри
    // которого же теперь читается/начисляется/сбрасывается ВСЁ атомарно.
    assert(/if\(\$poolRow !== null\)\{/.test(body), 'строка roulette_state реально лочится (FOR UPDATE) перед чтением — поэтому $poolRow, не голый $row');
    assert(/\$jackpotPool = intval\(\$poolRow\['jackpot_pool'\]\);/.test(body), 'перезаписывает фолбэк реальным значением, если чтение удалось');

    assert(/\$this->ops->add\(\$user, 'coins', \$jackpotPool\);/.test(body), 'начисляет игроку именно $jackpotPool (живой пул), не фиксированную сумму');
    assert(/\$user\['coins_earned'\] = \$this->ops->i\(\$user, 'coins_earned'\) \+ \$jackpotPool;/.test(body), 'coins_earned тоже растёт на реальный $jackpotPool');

    assert(/\$nick = trim\(strval\(\$user\['nick'\] \?\? ''\)\);/.test(body), 'читает РЕАЛЬНЫЙ сохранённый ник из серверной строки игрока ($user[\'nick\'])');
    assert(/'name' => \(\$nick !== '' \? \$nick : 'Сталкер'\), 'amount' => \$jackpotPool, 'id' => abs\(intval\(\$this->registry\['uid'\]\)\)/.test(body),
        'winner-объект объявляет РЕАЛЬНУЮ выплаченную сумму ($jackpotPool), не захардкоженные 500 (ошибка claimPrize()) и не плейсхолдер 50000');
    assert(/\$user\['roulette_winner'\] = json_encode\(\$winner, JSON_UNESCAPED_UNICODE\);/.test(body),
        'кодирует ЯВНО с JSON_UNESCAPED_UNICODE (та же защита, что была у claimPrize())');
    assert(/patchCurrencies\(\$user, \['coins','coins_earned','roulette_winner'\]\)/.test(body),
        "'roulette_winner' добавлен в patch kush-ответа — клиент узнаёт обновлённое значение через applyPatch()");
    assert(/'amt' => \$jackpotPool, 'kush' => true,/.test(body), "ответ клиенту ('amt') — тоже живой $jackpotPool, не захардкоженная сумма");

    // Сброс пула — в ТОЙ ЖЕ UPDATE-операции, что и kush_counter/kush_threshold, и ТОЛЬКО здесь
    // (не в spin(), см. roulette-real-jackpot-pool.test.js Test 1). 26.10.2026 (по прямому
    // указанию — "джекпот должен начинаться с нуля и копиться постепенно, не от 3000"):
    // сброс на 0, не на старую хардкоженную стартовую сумму 3000.
    assert(/UPDATE `roulette_state` SET `kush_counter`=0, `kush_threshold`=\$newT, `jackpot_pool`=0 WHERE `id`=1/.test(body),
        'сброс kush_counter/kush_threshold/jackpot_pool(=0) — одной атомарной операцией');

    // Запись победителя должна произойти ДО saveUser() этой ветки (одна атомарная запись вместе
    // с начислением Куша), не отдельным запросом.
    const winnerIdx = body.indexOf("\$user['roulette_winner']");
    const saveIdx   = body.indexOf('saveUser($user)');
    assert(winnerIdx !== -1 && saveIdx !== -1 && winnerIdx < saveIdx, 'roulette_winner выставляется ДО saveUser() — одна атомарная запись вместе с начислением Куша');
}

console.log('\nTest 5a (27.10.2026, баг найден по прямому указанию — живой репорт "Николай Седенко сорвал джекпот, но сам джекпот не упал и сумма не обнулилась", подтверждено записью в /var/log/php_errors.log с jackpotPoolPaid=12380): выплата Куша и сброс общего пула — в ОДНОЙ транзакции с FOR UPDATE на обе строки, без молчаливого продолжения при сбое');
{
    const kushStart = rouletteSrc.indexOf("if(\$reward === 'kush'){");
    const kushEnd = rouletteSrc.indexOf('\n        }', rouletteSrc.indexOf("'kush' => true,", kushStart));
    const body = rouletteSrc.slice(kushStart, kushEnd);

    // Корень бага: раньше SELECT+UPDATE на roulette_state шли БЕЗ лока и без проверки результата
    // — если UPDATE по любой причине не применялся (конфликт блокировок, таймаут), код всё равно
    // продолжал как при успехе: пул не обнулялся, а награда игроку начислялась отдельным,
    // независимым saveUser()-циклом поверх того же $user (тот же класс гонки "затёртого
    // начисления", что уже чинили в других местах проекта, см. AGENTS.md про _checkAll→flush).
    assert(/\$link->begin_transaction\(\);/.test(body), 'транзакция реально открывается перед чтением roulette_state');
    assert(/FOR UPDATE/.test(body), 'строка roulette_state (id=1) лочится FOR UPDATE — конкурентный выигрыш другого игрока не может прочитать устаревший пул между чтением и сбросом');
    assert(/SELECT \$colList FROM `\{\$this->registry\['utb'\]\}` WHERE `id`=" \. intval\(\$this->registry\['uid'\]\) \. " FOR UPDATE/.test(body),
        'строка САМОГО игрока (coins/coins_earned/roulette_winner) тоже лочится FOR UPDATE в ТОЙ ЖЕ транзакции — защита от параллельного автосейва, затирающего начисление');

    assert(/\$okPool = \$link->query\("UPDATE `roulette_state`/.test(body), 'результат UPDATE пула сохраняется в переменную (раньше не проверялся вообще)');
    assert(/\$okUser = \$link->query\("UPDATE `\{\$this->registry\['utb'\]\}`/.test(body), 'результат UPDATE строки игрока тоже проверяется');
    assert(/if\(\$okPool && \$okUser\)\{/.test(body), 'commit() только если ОБА запроса реально применились — не "один из двух"');
    assert(/\$link->commit\(\);/.test(body) && /\$link->rollback\(\);/.test(body), 'есть явный commit() на успех И rollback() на любой сбой (раньше не было ни того, ни другого)');

    assert(/if\(!\$kushPaid\)\{/.test(body), 'если транзакция не прошла — отдельная явная проверка перед тем, как хоть что-то сказать клиенту');
    assert(/return \$this->ops->fail\(99\);/.test(body), 'при неудаче — честная ошибка клиенту (НЕ "ты выиграл" без реальной выдачи, как было в баге)');
    assert(/error_log\('\[roulette\.pickCup\] !!! КУШ НЕ ВЫПЛАЧЕН/.test(body), 'сбой атомарной выплаты громко логируется отдельной строкой (не теряется молча)');

    // Поля, уже записанные внутри транзакции напрямую (raw SQL), не должны переписываться
    // повторно обычным saveUser() ниже — иначе второй UPDATE мог бы затереть их устаревшим
    // в-памяти значением (та же защита, что уже есть в openCase() этого же файла).
    assert(/foreach\(\$kushLockFields as \$col\) unset\(\$user\[\$col\]\);/.test(body),
        'закоммиченные в транзакции поля удаляются из $user — финальный saveUser() их не перезаписывает');
}

console.log('\nTest 3: users.php — roulette_winner убран из client-writable whitelist');
{
    const allowedBlock = usersSrc.match(/\$allowed = \[[\s\S]*?\];/)[0];
    // Ищем именно ЭЛЕМЕНТ массива ('roulette_winner', с запятой) — не упоминание в explanatory
    // комментарии рядом (там же поясняется, что поле убрано — комментарий не в счёт, известная
    // ловушка регекса, см. CLAUDE.md).
    assert(!/'roulette_winner',/.test(allowedBlock),
        "'roulette_winner' отсутствует СРЕДИ ЭЛЕМЕНТОВ \$allowed (клиент не может подделать его через users.save) — упоминание в пояснительном комментарии не в счёт");
    // 19.10.2026: 'stash_count' убран из $allowed той же причине, что 'exp' (см. большой
    // коммент там, расследование "Антикризиса") — был в whitelist ДВАЖДЫ и параллельно писался
    // сервером (zone.php/poker.php/roulette.php). 'stash_data' (соседнее, но другое поле —
    // JSON-объект тайника, не счётчик) остаётся не затронутым этим аудитом.
    assert(!/'stash_data',/.test(allowedBlock), "'stash_data' теперь серверное: автосохранение не меняет карточки");
    assert(!/'stash_count',/.test(allowedBlock), "'stash_count' УБРАНО из whitelist (19.10.2026, тот же класс дыры, что у 'exp')");
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

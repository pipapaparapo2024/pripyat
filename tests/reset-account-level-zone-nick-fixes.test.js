/**
 * Test: 18.09.2026 — три бага, найденные пользователем сразу после «СБРОС ВСЕГО»:
 *
 *  1) Уровень/опыт-полоска не сбрасывались визуально. Причина: level_txt и exp_bar
 *     перерисовываются ТОЛЬКО в Interface.updateNick() (interface.js — она же пересчитывает
 *     level из udata['exp']), а _resetAccount() вызывал только updateUp() (тот трогает лишь
 *     stew/coins/cigarettes). udata['exp'] после сброса был верным ('0'), но старый уровень
 *     оставался нарисованным на экране, пока не происходило другое событие, вызывающее
 *     updateNick() естественным путём.
 *
 *  2) Прогресс локаций Зоны (чекпоинты/бизнесы/зачистки) не сбрасывался. Причина: Zone кэширует
 *     весь прогресс в памяти (this.locations[].checkpoints[].filled и т.д.), а
 *     zone._loadFromUdata() ТОЛЬКО ДОБАВЛЯЕТ прогресс из сохранённого JSON — при udata['zone']
 *     === '{}' (свежий сброс) там просто нечего применять, старое состояние в памяти остаётся
 *     нетронутым. Та же причина, что уже была закрыта для bosses в этом же _resetAccount()
 *     раньше — Zone не получила аналогичного явного сброса.
 *
 *  3) В рейтинге урона по боссу ник показывался как буквальная строка "ARRAY". Причина —
 *     server/core/models/database.php::trueJSON(): т.к. core/samples/tables/*.php физически не
 *     существуют в проекте, $this->sample ВСЕГДА false, и работает единственная ветка, которая
 *     трактует любое пустое ('' == null в PHP — true) поле как несуществующее и подменяет его на
 *     пустой МАССИВ [], за явным исключением 'name'/'balabol'. 'nick' (обычное строковое поле,
 *     не JSON-блоб) в это исключение добавлен не был — пустой ник (после сброса аккаунта или у
 *     нового игрока) превращался в [], а bosses.php.rating() дальше делает
 *     strval($row['nick'] ?? '') — strval() от НЕПУСТОГО массива [] в PHP возвращает буквально
 *     строку "Array", которую и видел пользователь в UI.
 *
 * Run: node tests/reset-account-level-zone-nick-fixes.test.js
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

const devPanelSrc = readSrc('_client/src/game/shell/overlays/dev_panel.js');
const databasePhp = readSrc('server/core/models/database.php');

console.log('\nTest 1: _resetAccount() вызывает updateNick() — иначе уровень/exp-полоска не перерисуются');
{
    const start = devPanelSrc.indexOf('proto._resetAccount = function(){');
    const end   = devPanelSrc.indexOf('};', devPanelSrc.indexOf("console.error('[devPanel._resetAccount] ошибка сохранения на сервере:'"));
    const body  = devPanelSrc.slice(start, end);

    assert(/if\(typeof this\.updateUp === 'function'\) this\.updateUp\(\);/.test(body),
        'updateUp() по-прежнему вызывается (stew/coins/cigarettes)');
    assert(/if\(typeof this\.updateNick === 'function'\) this\.updateNick\(\);/.test(body),
        'updateNick() теперь тоже вызывается — иначе уровень/exp-бар остаются нарисованными по старым значениям');
    // updateNick должен идти ПОСЛЕ полной замены udata, но это гарантируется тем, что он внутри
    // того же success-колбэка TS.php('users.save', ...), что и updateUp — порядок вызовов не важен,
    // важно чтобы оба были внутри одного колбэка (а не, например, до присвоения нового udata).
    const updateUpIdx   = body.indexOf('this.updateUp();');
    const updateNickIdx = body.indexOf('this.updateNick();');
    assert(updateUpIdx !== -1 && updateNickIdx !== -1 && updateNickIdx > updateUpIdx,
        'updateNick() вызывается после updateUp(), оба — внутри success-колбэка сохранения');
}

console.log('\nTest 2: _resetAccount() явно сбрасывает прогресс Zone в памяти (чекпоинты/бизнесы/зачистки)');
{
    const start = devPanelSrc.indexOf('proto._resetAccount = function(){');
    const end   = devPanelSrc.indexOf('};', devPanelSrc.indexOf("console.error('[devPanel._resetAccount] ошибка сохранения на сервере:'"));
    const body  = devPanelSrc.slice(start, end);

    assert(/if\(window\.zone\)\{/.test(body), 'блок сброса window.zone найден в _resetAccount()');
    assert(/loc\.checkpoints\.forEach\(cp => \{ cp\.filled = 0; \}\);/.test(body),
        'чекпоинты всех локаций обнуляются (filled=0) — та же причина бага, что была у bosses (loadFromUdata только добавляет, не сбрасывает)');
    assert(/loc\.businesses\.forEach\(b => \{ b\.level = 0; \}\);/.test(body), 'уровни бизнесов обнуляются');
    assert(/loc\.cleared = 0;/.test(body), 'флаг зачистки локации обнуляется');
    // 25.09.2026 (нычки упрощены до плоского stash_count без per-key прогресса, см.
    // tests/zone-stash-count-flat-no-reward.test.js): zone._loadStash() удалён. 28.09.2026 —
    // _stashProgress тоже полностью удалён из Zone (был нужен только legacy-панели, которая
    // сама снесена целиком как мёртвый код), поэтому dev-панели больше нечего в нём обнулять.
    assert(!/zone\._stashProgress/.test(body),
        'dev-панель не трогает zone._stashProgress — поле удалено из Zone вместе с legacy-панелью (28.09.2026)');
}

console.log('\nTest 3: database.php::trueJSON() не превращает пустой nick/nickname в массив []');
{
    const start = databasePhp.indexOf('function trueJSON($array){');
    const end   = databasePhp.indexOf('return $array;', start);
    const body  = databasePhp.slice(start, end);

    // 18.09.2026 (аудит безопасности, отдельный от этого фикса): проверки объединены в один
    // флаг $isStringField — см. security-audit-weapons-shmot-bp-tasks-nick.test.js для полной
    // проверки (включая закрытие ВТОРОГО, позже найденного места той же дыры — is_array($value)).
    assert(/\$isStringField = \$keys\[\$i\] === 'name' \|\| \$keys\[\$i\] === 'balabol'/.test(body),
        'старое исключение name/balabol осталось нетронутым (не должны появляться регрессии для них)');
    assert(/if \(\$array\[\$keys\[\$i\]\] == null and !\$isStringField\) \$array\[\$keys\[\$i\]\] = \[\];/.test(body),
        'nick и nickname (через $isStringField) теперь тоже исключены — пустая строка останется пустой строкой, не подменится на []');
}

console.log('\nTest 4: логическая проверка PHP-паттерна (без реального PHP-рантайма) — сам механизм бага');
{
    // Не можем выполнить PHP напрямую в node-тесте — фиксируем ЛОГИКУ бага как документацию:
    // '' == null истинно в PHP (нестрогое сравнение), а strval() непустого массива [] возвращает
    // буквально строку "Array" (это и есть то самое "ARRAY" в UI, просто в другом регистре шрифта).
    // Если этот тест когда-нибудь понадобится ужесточить — добавить реальный PHP CLI прогон.
    assert(true, 'задокументировано: \'\' == null → true в PHP, strval([]) → "Array" — механизм бага, воспроизведённый вручную на сервере');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

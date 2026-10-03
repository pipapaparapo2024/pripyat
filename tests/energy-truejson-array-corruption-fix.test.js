/**
 * Test: 27.09.2026, по прямому репорту пользователя — "энергия копится, но её использовать
 * нельзя, то есть она визуально есть. А когда перезагружаешь игру, она снова до 50
 * восстанавливается, но тратить её нельзя."
 *
 * Root cause (тот же класс бага, что уже чинили для dev_force_N/nick/roulette_winner
 * 18-26.09.2026, см. соседние тесты dev-force-N, roulette-devforce-array-corruption-fix) —
 * Database::trueJSON() (server/core/models/database.php): для ЛЮБОГО поля, не входящего в
 * список-исключение $isStringField, значение из БД, для которого `$value == null` истинно,
 * молча подменяется на пустой МАССИВ [] прямо при чтении строки игрока.
 *
 * 'energy'/'max_energy'/'energy_time'/'energy_spent' хранятся как VARCHAR (см. карту udata в
 * CLAUDE.md) — когда игрок реально тратит всю энергию в ноль, в БД лежит буквально строка "0".
 * В PHP `"0" == null` истинно (bool/null-сравнение приводит ОБЕ стороны к bool — "0" и null оба
 * false), а ни одно из 4 энергетических полей не было в $isStringField — значит ИМЕННО в момент,
 * когда энергия падает до 0 (то есть именно тогда, когда точность поля важнее всего),
 * trueJSON() подменял 'energy' на [].
 *
 * Цепочка на клиенте: udata.energy приходит как [] вместо "0" → timers.js.updateFromUdata()
 * делает `parseInt(udata['energy'])` → `parseInt([])` === NaN (JS: String([]) === '', parseInt('')
 * === NaN) → `if(!isNaN(saved))` не проходит → синхронизация TIMERS.current_energy с сервером
 * молча пропускается → TIMERS.current_energy остаётся на дефолте конструктора
 * (this.current_energy = this.ENERGY_MAX = 50) → HUD показывает полную энергию 50/50 на КАЖДОЙ
 * перезагрузке, независимо от реального остатка.
 *
 * На сервере при этом Gameops::i($user, 'energy', 0) = intval([]) = 0 — сервер корректно видит
 * настоящий ноль и закономерно отклоняет zone.php.fillCheckpoint() с fail(56) ("не хватает
 * энергии") — отсюда и наблюдаемое расхождение "визуально 50, потратить нельзя".
 *
 * Фикс — server/core/models/database.php::trueJSON(): 'energy', 'max_energy', 'energy_time',
 * 'energy_spent' добавлены в $isStringField (сырое значение из БД больше не подменяется на []
 * ни при каком его содержимом, включая "0"/"").
 *
 * Run: node tests/energy-truejson-array-corruption-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root  = path.join(__dirname, '..');
const dbSrc      = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'database.php'), 'utf-8');
const timersSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'timers.js'), 'utf-8');
const zonePhpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'zone.php'), 'utf-8');

console.log('\nTest 1: Database::trueJSON() — все 4 энергетических поля в $isStringField (источник порчи "0"→[] закрыт)');
{
    const start = dbSrc.indexOf('function trueJSON($array){');
    assert(start !== -1, 'trueJSON() найден');
    // 27.09.2026 (фикс собственного теста, найден при полном прогоне tests/ перед деплоем):
    // окно в 5000 символов от начала trueJSON() обрезало проверяемые строки $isStringField
    // прямо посередине (объяснительный комментарий перед ними — больше 5000 символов сам по
    // себе) — ложный FAIL при полностью корректном коде. Срез теперь до конца самой функции
    // (следующее объявление function), с запасом это ~6255 символов.
    const nextFnIdx = dbSrc.indexOf('function ', start + 10);
    const body = dbSrc.slice(start, nextFnIdx !== -1 ? nextFnIdx : start + 7000);
    for (const field of ['energy', 'max_energy', 'energy_time', 'energy_spent']) {
        assert(body.includes(`$keys[$i] === '${field}'`), `'${field}' исключён из null→[] подмены`);
    }
    // Старые исключения (dev_force_*/nick/name/balabol/roulette_winner) не должны быть случайно затёрты правкой.
    for (const field of ['name', 'balabol', 'nick', 'nickname', 'roulette_winner',
                          'dev_force_dice', 'dev_force_poker', 'dev_force_blackjack', 'dev_force_roulette']) {
        assert(body.includes(`'${field}'`), `старое исключение '${field}' на месте`);
    }
}

console.log('\nTest 2: timers.js — формула регенерации не менялась по сути (клиентская сторона уже была корректна, баг был только в БД-слое), теперь централизована в _regenSnapshot()');
{
    // 28.09.2026 (фикс собственного теста после централизации регенерации в _regenSnapshot() —
    // см. tests/energy-regen-preserves-partial-progress-and-offline-catchup.test.js для полного
    // покрытия новой логики): формула больше не инлайнится в updateFromUdata() как `regen`, а
    // живёт в отдельном методе с параметром `ticks`, но суть (max(saved,...), потолок не
    // обрезается регенерацией) не изменилась.
    assert(/let saved = parseInt\(udata\['energy'\]\);/.test(timersSrc), 'читает udata[\'energy\'] через parseInt (уязвим к [] → NaN, если бы БД-слой не был исправлен)');
    assert(/const energy = Math\.max\(saved, Math\.min\(this\.ENERGY_MAX, saved \+ ticks\)\);/.test(timersSrc),
        '_regenSnapshot(): max(saved, min(max, saved+ticks)) — донат-энергия сверх потолка не обрезается регенерацией');
}

console.log('\nTest 3: zone.php.fillCheckpoint() — сервер по-прежнему авторитетно проверяет energy ДО списания (fail(56) при нехватке)');
{
    // 28.09.2026 (фикс собственного теста): прямое сравнение $curEnergy < $energyCost заменено
    // на Gameops::spendEnergy() (сохраняет остаток прогресса регенерации вместо жёсткого сброса
    // energy_time) — сама проверка баланса (и fail(56) при нехватке) осталась внутри spendEnergy().
    assert(/if\(!\$this->ops->spendEnergy\(\$user, \$energyCost\)\) return \$this->ops->fail\(56\);/.test(zonePhpSrc),
        'серверная проверка энергии на месте (через Gameops::spendEnergy()) — фикс trueJSON() не ослабляет анти-чит проверку');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 25.09.2026, по прямому указанию — "хочу видеть сбоку экрана количество игр, которые
 * нужны до выпадения разных комбинаций" (покер/блэкджек/зарики/рулетка).
 *
 * Уточнено через AskUserQuestion (все 3 ответа — "Рекомендуется"):
 *  - Покер БЕЗ счётчика вообще (там нет pity — комбинация каждый раз выбирается чисто по весам,
 *    "до следующего флеш-рояля" физически нечего показывать, это подтверждено в самом коде
 *    poker.php: "у покера НЕТ pity-порога, как у блэкджека/зариков").
 *  - Постоянная узкая боковая панель, обновляется после каждой раздачи/броска/спина.
 *  - В блэкджеке — все 3 счётчика сразу (до AA/KK/QQ), не только ближайший.
 *
 * Серверная часть (эта задача) — довести нужные числа до клиента, ничего не считая заново:
 *  - dice.php.getSession()/resolve() — ПЛАНИРОВАЛОСЬ отдавать pity/pity_t, но 02.10.2026 (по
 *    прямому указанию, после разбора полного прогона tests/) подтверждено: pity-счётчик у
 *    зариков удалён целиком (die_weights + _reducePremiumRoll вместо гарантии) — согласуется с
 *    тем, что панель "До Куша" убрана из HUD ещё 27.09.2026 (dvor-dice-screen.js). Для зариков
 *    этих полей больше нет и не будет — см. Test 1/2 ниже.
 *  - blackjack.php.status() — все 3 счётчика (aa/aa_t/kk/kk_t/qq/qq_t), вызывается на каждом
 *    открытии экрана; blackjack.php.resolve() — обновлённые счётчики после форса/инкремента.
 *  - roulette.php.status()/spin() — spin_counter/spin_threshold ИЗ ГЛОБАЛЬНОЙ таблицы
 *    roulette_state (счётчик джекпота ОБЩИЙ на всех игроков, не персональный, в отличие от
 *    зариков/блэкджека) — spin() отдаёт АКТУАЛЬНЫЕ (уже сброшенные) значения, если джекпот
 *    именно в этом спине выбит, а не устаревшие "до сброса".
 *
 * Run: node tests/casino-games-until-combo-server-fields.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const diceSrc  = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'dice.php'), 'utf-8');
const bjSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');
const rouletteSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');

console.log('\nTest 1: dice.php.getSession() — НЕ отдаёт pity/pity_t (счётчика больше не существует)');
{
    // 02.10.2026 (по прямому указанию, после разбора найденного при полном прогоне tests/):
    // dice.php лишился pity-счётчика целиком (die_weights + _reducePremiumRoll вместо pity-
    // гарантии, см. дата-комментарий в начале dice.php) — подтверждено пользователем как
    // ОСОЗНАННАЯ замена. Это согласуется с тем, что панель "До Куша" (единственный потребитель
    // pity/pity_t для зариков) была убрана из HUD ещё 27.09.2026, см. dvor-dice-screen.js —
    // поля для неё больше не нужны. Задача "счётчик до комбинации" (эта задача, 25.09.2026)
    // для зариков больше неактуальна — остаётся только для блэкджека/рулетки (Test 3-6 ниже).
    const start = diceSrc.indexOf('function getSession(){');
    const end = diceSrc.indexOf('\n        }', start);
    const body = diceSrc.slice(start, end);

    assert(!/pity/.test(body), 'регресс-гвард: getSession() не упоминает pity вообще — счётчика нет');
}

console.log('\nTest 2: dice.php.resolve() — НЕ отдаёт pity/pity_t (счётчика больше не существует)');
{
    const start = diceSrc.indexOf('function resolve(){');
    const body = diceSrc.slice(start);

    assert(!/pity/.test(body), 'регресс-гвард: resolve() не упоминает pity вообще — счётчика нет');
}

console.log('\nTest 3: blackjack.php.status() — все 3 счётчика (aa/kk/qq) в ответе');
{
    const start = bjSrc.indexOf('function status(){');
    const end = bjSrc.indexOf('\n        }', start);
    const body = bjSrc.slice(start, end);
    ['aa', 'kk', 'qq'].forEach(k => {
        assert(new RegExp(`\\$state\\['${k}'\\] = intval\\(\\$session\\['${k}'\\]\\);`).test(body), `status() отдаёт ${k}`);
        assert(new RegExp(`\\$state\\['${k}_t'\\] = intval\\(\\$session\\['${k}_t'\\]\\);`).test(body), `status() отдаёт ${k}_t`);
    });
}

console.log('\nTest 4: blackjack.php.resolve() — отдаёт ОБНОВЛЁННЫЕ счётчики (после форс-сброса/инкремента в этом же вызове)');
{
    const start = bjSrc.indexOf('function resolve(){');
    const body = bjSrc.slice(start, start + 9000);
    ['aa', 'kk', 'qq'].forEach(k => {
        assert(new RegExp(`'${k}' => intval\\(\\$session\\['${k}'\\]\\), '${k}_t' => intval\\(\\$session\\['${k}_t'\\]\\),`).test(body),
            `финальный ok() содержит ${k}/${k}_t`);
    });
    const updateIdx = body.indexOf('$session[$forcedKey] = 0;');
    const outputIdx = body.indexOf("'aa' => intval(\$session['aa']), 'aa_t' => intval(\$session['aa_t']),");
    assert(updateIdx !== -1 && outputIdx !== -1 && updateIdx < outputIdx, 'вывод счётчиков идёт ПОСЛЕ их обновления в этой же функции');
}

console.log('\nTest 5: roulette.php.status() — spin_counter/spin_threshold из ГЛОБАЛЬНОЙ таблицы roulette_state');
{
    const start = rouletteSrc.indexOf('function status(){');
    const end = rouletteSrc.indexOf('\n    }', start);
    const body = rouletteSrc.slice(start, end);
    assert(/SELECT `keyring_cycle_ends_at`, `jackpot_pool`, `spin_counter`, `spin_threshold` FROM `roulette_state`/.test(body),
        'SQL читает spin_counter/spin_threshold из той же таблицы, что и обычный spin()');
    assert(/'spin_counter' => \$spinCounter, 'spin_threshold' => \$spinThreshold/.test(body), 'ответ содержит оба поля');
    assert(/'spin_counter' => 0, 'spin_threshold' => 0/.test(body), 'фолбэк (нет соединения к общей таблице) — безопасные нули, не падает');
}

console.log('\nTest 6: roulette.php.spin() — spin_counter/spin_threshold в обоих путях (успех/fallback), актуальные значения при реальном джекпоте');
{
    assert(/'jackpot_pool' => 3000, 'spin_counter' => 0, 'spin_threshold' => 0, 'debug' => \$debug/.test(rouletteSrc),
        'fallback-ветка (нет _rawLink()) тоже отдаёт spin_counter/spin_threshold');

    const outIdx = rouletteSrc.indexOf('$spinCounterOut   = $realJackpot ? 0 : $counter;');
    assert(outIdx !== -1, 'основной путь считает spinCounterOut/spinThresholdOut с учётом realJackpot');
    const body = rouletteSrc.slice(outIdx, outIdx + 600);
    assert(/\$spinThresholdOut = \$realJackpot \? \$jackpotResetInfo\['newThreshold'\] : \$threshold;/.test(body),
        'при реальном джекпоте отдаётся НОВЫЙ порог (после сброса), не старый');
    assert(/'spin_counter' => \$spinCounterOut, 'spin_threshold' => \$spinThresholdOut, 'debug' => \$debug/.test(body),
        'финальный output() использует именно spinCounterOut/spinThresholdOut, не сырые $counter/$threshold');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

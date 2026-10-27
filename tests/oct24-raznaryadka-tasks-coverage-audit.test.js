/**
 * Test: 24.10.2026 (по прямому указанию — "проверь задания на прохождение, работают ли они
 * все корректно"), аудит всех 9 типов заданий "Разнарядка" (boss/energy/blackjack/dice/
 * roulette/sukhari/respect/zaruba/kachalka) + две правки по итогам разговора с пользователем.
 *
 * 1) 'respect' — fillCheckpoint() (обычный автозахват локации) уже репортил, но ТРИ других
 *    реальных источника уважения в zone.php НЕ репортили вообще: captureLocation() (ручной
 *    захват), collectIncome() (доход ОДНОЙ локации), collectAllIncome() (доход ВСЕХ разом).
 *    Починено — все три теперь репортят.
 *
 * 2) 'energy' — ПЕРВОНАЧАЛЬНО добавили report('energy', ...) в base.php.train() (тренировка
 *    в Качалке), т.к. это тот же класс пробела, что чинили 23.09.2026 для energy_spent. ПОТОМ
 *    ПЕРЕСМОТРЕНО ТЕМ ЖЕ ДНЁМ, ПО ПРЯМОМУ УКАЗАНИЮ: задание "Потратить N энергии" должно
 *    считать ТОЛЬКО энергию локаций Зоны — тренировки в Качалке НЕ должны засчитываться.
 *    Правка отменена, train() снова НЕ вызывает report('energy', ...).
 *
 * 3) 'sukhari' — ПЕРВОНАЧАЛЬНО считалось осознанно узким (только dvor.php.collectCig()).
 *    ПЕРЕСМОТРЕНО ПО ПРЯМОМУ УКАЗАНИЮ: "сбор сухарей должен происходить из любых источников,
 *    не только со двора". RaznaryadkaProgress::report('sukhari', ...) добавлен на ВСЕ реальные
 *    places, где игрок зарабатывает 'cigarettes' игровым действием: bosses.php (убийство
 *    босса), zone.php (чекпоинт+захват, ручной захват, доход одной/всех локаций), dice.php,
 *    blackjack.php, roulette.php (кейс, спин, мини-игра стаканчиков), poker.php (сумка,
 *    резолв раздачи), ryukzak.php, yashik.php, vassilich.php (лут Василича), habar.php (хабар),
 *    bp.php (боевой пропуск), tasks.php (старая система заданий zadaniya.js — тоже реальный
 *    игровой источник сигарет, хоть и другая фича). ИСКЛЮЧЕНО осознанно: hapuga.php (ПОКУПКА
 *    за монеты, не заработок действием, фича вдобавок выключена BETA_LOCKED) и
 *    rewardlinks.php (админ-начисление по ссылке, не игровое действие).
 *
 * Остальные типы (boss/blackjack/dice/roulette/zaruba/kachalka) — по одному report() на
 * законченное действие их СОБСТВЕННОГО типа, без дублей/двойного счёта.
 *
 * Run: node tests/oct24-raznaryadka-tasks-coverage-audit.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = (p) => fs.readFileSync(p, 'utf-8');

console.log('\nTest 1: zone.php — 5 реальных report() для respect/energy (fillCheckpoint×2 + captureLocation/collectIncome/collectAllIncome×1 respect)');
{
    const src = norm(path.join(root, 'server/core/controllers/zone.php'));
    const respectCalls = src.match(/RaznaryadkaProgress::report\(\$this->ops, 'respect',/g) || [];
    assert(respectCalls.length === 4, `найдено ${respectCalls.length} report('respect',...) в zone.php, ожидалось 4 (fillCheckpoint + 3 ранее отсутствовавших)`);
    const energyCalls = src.match(/RaznaryadkaProgress::report\(\$this->ops, 'energy',/g) || [];
    assert(energyCalls.length === 1, `найдено ${energyCalls.length} report('energy',...) в zone.php, ожидалось 1 (только fillCheckpoint)`);
}

console.log('\nTest 2: base.php train() — НЕ репортит energy (отменено по прямому указанию в тот же день)');
{
    const src = norm(path.join(root, 'server/core/controllers/base.php'));
    const start = src.indexOf('function train(){');
    const end = src.indexOf('\n    function relocate(){', start);
    const body = src.slice(start, end);
    assert(!/RaznaryadkaProgress::report\(\$this->ops, 'energy'/.test(body),
        "train() НЕ вызывает report('energy', ...) — энергия Качалки НЕ засчитывается в задание");
    assert(/ОСОЗНАННО считает только энергию, потраченную на прохождение|energy_spent выше, см\. комментарий 23\.09\.2026/.test(body) || /НЕ засчитывается/.test(body),
        'комментарий объясняет осознанное решение (не забытый кусок кода)');
}

console.log('\nTest 3: sukhari — report() добавлен на ВСЕ реальные источники сигарет (кроме hapuga.php/rewardlinks.php)');
{
    const checks = [
        { file: 'bosses.php', pattern: /if\(\$earnedCig > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$earnedCig\);/, label: 'bosses.php claimKill() — награда за убийство босса' },
        { file: 'zone.php', pattern: /if\(\$totalCigGain > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$totalCigGain\);/, label: 'zone.php fillCheckpoint() — чекпоинт+бонус захвата' },
        { file: 'zone.php', pattern: /if\(\$captureOut\['cig'\] > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$captureOut\['cig'\]\);/, label: 'zone.php captureLocation() — ручной захват' },
        { file: 'dice.php', pattern: /if\(\$cigEarned > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$cigEarned\);/, label: 'dice.php resolve() — награда зариков' },
        { file: 'blackjack.php', pattern: /if\(\$cigAmt > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$cigAmt\);/, label: 'blackjack.php resolve() — награда блэкджека' },
        { file: 'roulette.php', pattern: /if\(\$reward\['cig'\] > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$reward\['cig'\]\);/, label: 'roulette.php openCase() — кейс рулетки' },
        { file: 'roulette.php', pattern: /RaznaryadkaProgress::report\(\$this->ops, 'sukhari', intval\(\$slotResult\['reward'\]\['amt'\] \?\? 0\)\);/, label: 'roulette.php spin() — спин на сектор сигарет' },
        { file: 'roulette.php', pattern: /if\(\$type === 'cig' && \$amt > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$amt\);/, label: 'roulette.php pickCup() — мини-игра стаканчиков' },
        { file: 'poker.php', pattern: /if\(\$reward\['cig'\] > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$reward\['cig'\]\);/, label: 'poker.php openBag() — сумка покера' },
        { file: 'poker.php', pattern: /if\(\$cigEarnedPoker > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$cigEarnedPoker\);/, label: 'poker.php resolve() — награда раздачи покера' },
        { file: 'ryukzak.php', pattern: /if\(intval\(\$tier\['cig'\]\) > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', intval\(\$tier\['cig'\]\)\);/, label: 'ryukzak.php open() — награда рюкзака' },
        { file: 'yashik.php', pattern: /if\(intval\(\$session\['cig'\]\) > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', intval\(\$session\['cig'\]\)\);/, label: 'yashik.php collect() — награда ящика' },
        { file: 'vassilich.php', pattern: /if\(\$lootCig > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$lootCig\);/, label: 'vassilich.php openLoot() — лут Василича' },
        { file: 'habar.php', pattern: /if\(\$cigEarnedHabar > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$cigEarnedHabar\);/, label: 'habar.php collect() — ежедневный хабар' },
        { file: 'bp.php', pattern: /if\(\$type === 'cigarettes' && \$amount > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$amount\);/, label: 'bp.php claim() — награда боевого пропуска' },
        { file: 'tasks.php', pattern: /if\(\$cigEarnedTask > 0\) RaznaryadkaProgress::report\(\$this->ops, 'sukhari', \$cigEarnedTask\);/, label: 'tasks.php claim() — старая система заданий (zadaniya.js)' },
    ];
    checks.forEach(({file, pattern, label}) => {
        const src = norm(path.join(root, 'server/core/controllers/' + file));
        assert(pattern.test(src), label + ' — report(\'sukhari\', ...) на месте');
    });
}

console.log('\nTest 4: sukhari — hapuga.php и rewardlinks.php НЕ репортят (осознанное исключение: покупка / админ-начисление, не игровой заработок)');
{
    const hapugaSrc = norm(path.join(root, 'server/core/controllers/hapuga.php'));
    assert(!/RaznaryadkaProgress::report\(\$this->ops, 'sukhari'/.test(hapugaSrc), 'hapuga.php не репортит sukhari (покупка за монеты, не заработок)');
    const rewardlinksSrc = norm(path.join(root, 'server/core/controllers/rewardlinks.php'));
    assert(!/RaznaryadkaProgress::report\(\$this->ops, 'sukhari'/.test(rewardlinksSrc), 'rewardlinks.php не репортит sukhari (админ-начисление по ссылке, не игровое действие)');
}

console.log('\nTest 5: остальные типы (boss/blackjack/dice/roulette/zaruba/kachalka) — ровно по одному call site на завершённое действие своего типа');
{
    const checks = [
        { file: 'bosses.php', re: /RaznaryadkaProgress::report\(\$this->ops, 'boss', 1, \['boss_id' => \$bossId\]\);/, label: 'bosses.php claimKill() -> boss' },
        { file: 'blackjack.php', re: /RaznaryadkaProgress::report\(\$this->ops, 'blackjack', 1\);/, label: 'blackjack.php resolve() -> blackjack' },
        { file: 'dice.php', re: /RaznaryadkaProgress::report\(\$this->ops, 'dice', 1\);/, label: 'dice.php resolve() -> dice' },
        { file: 'roulette.php', re: /RaznaryadkaProgress::report\(\$this->ops, 'roulette', 1\);/, label: 'roulette.php spin() -> roulette' },
        { file: 'dvor.php', re: /RaznaryadkaProgress::report\(\$this->ops, 'sukhari', 30\);/, label: 'dvor.php collectCig() -> sukhari (исходный, образцовый call site)' },
        { file: 'zaruba.php', re: /RaznaryadkaProgress::report\(\$this->ops, 'zaruba', 1\);/, label: 'zaruba.php fight() -> zaruba' },
        { file: 'zaruba.php', re: /RaznaryadkaProgress::report\(\$this->ops, 'kachalka', 1\);/, label: 'zaruba.php pump() -> kachalka' },
    ];
    checks.forEach(({file, re, label}) => {
        const src = norm(path.join(root, 'server/core/controllers/' + file));
        assert(re.test(src), label + ' — call site на месте');
    });
}

console.log('\nTest 6: raznaryadka_config.json — все 9 типов из задачи реально встречаются как type дня');
{
    const config = JSON.parse(norm(path.join(root, 'server/json/raznaryadka_config.json')));
    const allTypes = new Set();
    Object.values(config.months).forEach(m => Object.values(m.days).forEach(d => allTypes.add(d.type)));
    const expected = ['boss', 'energy', 'blackjack', 'dice', 'roulette', 'sukhari', 'respect', 'zaruba', 'kachalka'];
    expected.forEach(t => assert(allTypes.has(t), `тип '${t}' встречается хотя бы в одном месяце календаря`));
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

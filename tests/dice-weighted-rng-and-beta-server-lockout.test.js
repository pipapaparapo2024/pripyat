/**
 * Test: батч 21.09.2026 (продолжение разбора экономического риска зариков + бета-лимиты) —
 *
 *  1) Зарики — по прямому указанию НЕ трогаем ни таблицу наград, ни лимит перебросов. Вместо
 *     этого снижаем вероятность выпадения самих граней 5 и 6 (и на первом броске, и на КАЖДОМ
 *     переброс — проблема именно в прицельных перебросах) через конфигурируемые die_weights
 *     (server/json/dice_config.json), а не хардкод в PHP. Дефолт [19,19,19,19,12,12] из 100 —
 *     5/6 снижены с честных 16.7% до 12%, компенсация поровну ушла на грани 1-4. {6,n:4}
 *     (шмотка) и так уже была недостижима честным путём (зарезервирована под pity) — не
 *     затронута этой правкой, просто подтверждаем, что защита осталась на месте.
 *
 *  2) Скряга (hapuga)/Банда (gangs)/Пропуск (bp) — по прямому указанию блокируются НА СЕРВЕРЕ
 *     (не только приглушённая кнопка на клиенте, которая не мешает вызвать эндпоинт напрямую
 *     из консоли) — единственный способ гарантировать, что игрок никакими путями не выбьет
 *     себе плюшки из ещё не готового раздела. Бот (bot.js) не имеет собственного серверного
 *     permit'а вообще (только оркестрирует уже защищённые действия) — блокировать нечего.
 *
 * Run: node tests/dice-weighted-rng-and-beta-server-lockout.test.js
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

const dicePhp    = readSrc('server/core/controllers/dice.php');
const diceConfig = JSON.parse(fs.readFileSync(path.join(root, 'server/json/dice_config.json'), 'utf-8'));
const errorsJson = JSON.parse(fs.readFileSync(path.join(root, 'server/json/errors.json'), 'utf-8'));
const hapugaPhp  = readSrc('server/core/controllers/hapuga.php');
const gangsPhp   = readSrc('server/core/controllers/gangs.php');
const bpPhp      = readSrc('server/core/controllers/bp.php');

console.log('\nTest 1: dice_config.json — die_weights заведены, ровно 6 значений, сумма 100');
{
    assert(Array.isArray(diceConfig.die_weights) && diceConfig.die_weights.length === 6,
        'die_weights — массив из 6 значений (по одному на грань 1..6)');
    const sum = diceConfig.die_weights.reduce((a,b)=>a+b, 0);
    assert(sum === 100, 'сумма весов ровно 100 (для честной интерпретации как процентов), получили ' + sum);
    assert(JSON.stringify(diceConfig.die_weights) === JSON.stringify([19,19,19,19,12,12]),
        'дефолт [19,19,19,19,12,12] — 5 и 6 снижены с 16.7% до 12%, компенсация на гранях 1-4');
    // Таблицу наград и лимит перебросов явно НЕ трогали — прямое указание пользователя.
    assert(diceConfig.table.find(r => r.v===6 && r.n===3).amt === 100, 'награда за 3×6 не изменена (100₽, как просили не трогать)');
    assert(diceConfig.table.find(r => r.v===5 && r.n===4).amt === 50, 'награда за 4×5 не изменена (50₽)');
    assert(JSON.stringify(diceConfig.swaps_by_level) === JSON.stringify([
        {min_level:100, swaps:3}, {min_level:60, swaps:2}, {min_level:20, swaps:1}, {min_level:0, swaps:0}
    ]), 'лимит перебросов по уровням не изменён');
}

console.log('\nTest 2: dice.php._weightedDie() — читает веса из каталога, честный фолбэк при отсутствии/поломке');
{
    // 23.09.2026: инструментация добавила опциональный &$trace=null параметр (по ссылке,
    // копит attempt-by-attempt лог для debug-ответа) — сигнатура расширилась, сама честная
    // раздача/фолбэк не изменились.
    const start = dicePhp.indexOf('private function _weightedDie($catalog, &$trace = null){');
    const end   = dicePhp.indexOf('\n        }', start);
    const body  = dicePhp.slice(start, end);
    assert(/count\(\$catalog\['die_weights'\]\) === 6/.test(body), 'проверяет, что в каталоге ровно 6 весов');
    assert(/: \[1,1,1,1,1,1\];/.test(body), 'фолбэк — честный кубик (все веса равны), если каталог не задан/повреждён — не ломает игру молча');
    assert(/mt_rand\(1, \$total\)/.test(body), 'использует mt_rand для качественного RNG (не rand())');
}

console.log('\nTest 3: и start() (первый бросок), и reroll() (переброс) используют _weightedDie(), а не честный rand(1,6)');
{
    const startFn = dicePhp.slice(dicePhp.indexOf('function start(){'), dicePhp.indexOf('function reroll(){'));
    // 23.09.2026: вызовы теперь передают второй аргумент $rollTrace (собирает debug-лог) —
    // сама функция/факт использования весов не изменились.
    assert(/\$this->_weightedDie\(\$catalog, \$rollTrace\)/.test(startFn), 'start(): 4 кости при обычном броске берутся через _weightedDie()');
    assert(!/rand\(1,6\)/.test(startFn), 'start(): честный rand(1,6) для костей полностью убран');
    // 02.10.2026 (по прямому указанию, после разбора найденного при полном прогоне tests/):
    // pity-гарантии (форсированных [6,6,6,6]) больше не существует вообще — подтверждено
    // пользователем как осознанная замена, см. дата-комментарий в начале dice.php. 4×6 теперь
    // обычный (хоть и самый редкий) результат весов + _reducePremiumRoll(), без форса.
    assert(!/\[6, 6, 6, 6\]/.test(startFn), 'регресс-гвард: форсированных [6, 6, 6, 6] нет — pity-гарантии больше не существует');
    assert(/\$rolls = \$this->_reducePremiumRoll\(\$rolls, \$catalog, \$rollTrace\);/.test(startFn),
        'start(): единственная защита премиальных (включая джекпот) комбинаций — вероятностная _reducePremiumRoll()');

    const rerollFn = dicePhp.slice(dicePhp.indexOf('function reroll(){'));
    assert(/\$v = \$this->_weightedDie\(\$catalog, \$rollTrace\);/.test(rerollFn), 'reroll(): переброс тоже берётся через _weightedDie() — именно тут была основная проблема (прицельный фарм)');
    assert(!/\$v = rand\(1, 6\);/.test(rerollFn), 'reroll(): честный rand(1,6) полностью убран');
    // 02.10.2026: хард-блок othersAll6 ("не докидать 4×6 переброском") сознательно снят вместе
    // со всей pity-системой — подтверждено пользователем, НЕ возвращается, см.
    // dice-combo-chance-reduced-10pct.test.js и dice-server-authoritative-rng.test.js.
    assert(!/othersAll6/.test(rerollFn), 'регресс-гвард: othersAll6 отсутствует — хард-блок снят сознательно, не регрессия');
}

console.log('\nTest 4: реальный прогон весов (не только regex) — статистика по 20000 бросков близка к заданным процентам');
{
    const weights = diceConfig.die_weights;
    const total = weights.reduce((a,b)=>a+b, 0);
    function weightedDie(){
        const roll = 1 + Math.floor(Math.random() * total);
        let cum = 0;
        for(let i = 0; i < weights.length; i++){
            cum += weights[i];
            if(roll <= cum) return i + 1;
        }
        return 6;
    }
    const N = 20000;
    const counts = [0,0,0,0,0,0];
    for(let i = 0; i < N; i++) counts[weightedDie()-1]++;
    const pct = counts.map(c => (c / N * 100));
    console.log('    наблюдаемые %:', pct.map(p=>p.toFixed(1)).join(', '), '(ожидание: 19,19,19,19,12,12)');
    assert(pct[4] < 15 && pct[4] > 9, 'грань 5 выпадает заметно реже честных 16.7% (наблюдали ' + pct[4].toFixed(1) + '%)');
    assert(pct[5] < 15 && pct[5] > 9, 'грань 6 выпадает заметно реже честных 16.7% (наблюдали ' + pct[5].toFixed(1) + '%)');
    assert(pct[0] > 16 && pct[0] < 22, 'грань 1 выпадает заметно чаще (компенсация), наблюдали ' + pct[0].toFixed(1) + '%');
}

console.log('\nTest 5: errors.json — новый код 56 добавлен ("функция пока недоступна")');
{
    const e = errorsJson.find(x => x.code === 56);
    assert(!!e && /недоступна/.test(e.text), 'код 56 существует и текст осмысленный');
}

console.log('\nTest 6: hapuga.php/gangs.php/bp.php — все permitted-функции блокируются на сервере (BETA_LOCKED)');
{
    const checks = [
        { src: hapugaPhp, name: 'hapuga.php', fns: ['buy'] },
        { src: gangsPhp,  name: 'gangs.php',  fns: ['join', 'donate'] },
        { src: bpPhp,     name: 'bp.php',     fns: ['claim'] },
    ];
    for(const c of checks){
        assert(/private \$BETA_LOCKED = true;/.test(c.src), c.name + ': флаг BETA_LOCKED заведён и включён');
        for(const fn of c.fns){
            const start = c.src.indexOf('function ' + fn + '(){');
            assert(start !== -1, c.name + ': функция ' + fn + '() найдена');
            const body = c.src.slice(start, start + 200);
            assert(/if\(\$this->BETA_LOCKED\) return \$this->ops->fail\(56\);/.test(body),
                c.name + ': ' + fn + '() отклоняет ЛЮБОЙ вызов кодом 56 первой же строкой — до чтения/списания чего-либо у игрока');
        }
    }
}

console.log('\nTest 7: bot.js — не имеет собственных серверных вызовов (оркеструет уже защищённые действия, блокировать на сервере нечего)');
{
    const botSrc = readSrc('_client/src/game/bot.js');
    assert(!/TS\.php\(/.test(botSrc), 'bot.js не делает прямых TS.php() вызовов — весь урон/экономика идёт через УЖЕ мигрированные на сервер эндпоинты других модулей');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

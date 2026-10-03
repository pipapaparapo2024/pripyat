/**
 * Test: изначально писался 29.09.2026 под запрос "уменьши вероятность выпадения всех
 * комбинаций в зариках на 10%, например было 5% стало 4.5%" и проверял реализацию "в лоб" —
 * 10%-й шанс полностью АННУЛИРОВАТЬ уже честно выпавшую комбинацию внутри resolve() (void).
 *
 * 02.10.2026 (по прямому указанию, после находки при разборе полного прогона tests/): та
 * реализация больше не существует в коде — её тихо заменили на другую схему (die_weights +
 * dice.php._reducePremiumRoll()) без дата-комментария, объясняющего замену, из-за чего этот
 * тест разошёлся с реальностью на 7 ассертов. Пользователь подтвердил: это ОСОЗНАННАЯ замена
 * (не регрессия), с двумя уточнениями:
 *   - 10%-е снижение шанса сознательно СУЖЕНО до ценных комбинаций coins/shmot (4 строки из 18
 *     в catalog['table']) — не "все 18", как было в буквальном тексте запроса 29.09.2026.
 *   - Джекпот 4×6 больше не имеет хард-защиты от докидывания переброском — для него действует
 *     та же вероятностная логика (90% шанс остаться), что и у остальных премиальных комбинаций.
 *
 * Переписан под актуальную механику: _reducePremiumRoll($rolls, $catalog, &$trace) вызывается
 * ДО показа костей игроку — и в start(), и в reroll() — и может полностью переброcить уже
 * выпавшую премиальную (coins/shmot) комбинацию с вероятностью 10%. resolve() эту логику
 * больше не содержит вообще — она просто честно читает $rolls из dice_session.
 *
 * Run: node tests/dice-combo-chance-reduced-10pct.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const dicePhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'dice.php'), 'utf-8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'dice_config.json'), 'utf-8'));

console.log('\n1) _isPremiumCombination() — считает ценной ТОЛЬКО coins/shmot, остальные типы игнорирует');
{
    const start = dicePhp.indexOf('private function _isPremiumCombination(');
    const end   = dicePhp.indexOf('\n        }', start);
    const body  = dicePhp.slice(start, end);
    assert(/if\(\(\$row\['type'\] \?\? ''\) !== 'coins' && \(\$row\['type'\] \?\? ''\) !== 'shmot'\) continue;/.test(body),
        'строки таблицы с типом НЕ coins/НЕ shmot пропускаются (cig/exp/auto/gun/machete не считаются премиальными)');

    const premiumRows = catalog.table.filter(r => r.type === 'coins' || r.type === 'shmot');
    assert(premiumRows.length === 4, 'в каталоге ровно 4 из 18 строк имеют тип coins/shmot (осознанное сужение, не "все 18")');
}

console.log('\n2) _reducePremiumRoll() — 10%-й шанс (mt_rand(1,100) > 10 — досрочный выход), только если комбинация премиальная');
{
    const start = dicePhp.indexOf('private function _reducePremiumRoll(');
    const end   = dicePhp.indexOf('\n        }', start);
    const body  = dicePhp.slice(start, end);
    assert(/if\(!\$this->_isPremiumCombination\(\$rolls, \$catalog\) \|\| mt_rand\(1, 100\) > 10\) return \$rolls;/.test(body),
        'непремиальная комбинация или >10% roll — rolls возвращаются без изменений (90% шанс выживания премиальной комбинации)');
    assert(/do \{/.test(body) && /\} while\(\$this->_isPremiumCombination\(\$rolls, \$catalog\)\);/.test(body),
        'при срабатывании 10%-й ветки — переброс ВСЕХ 4 костей через _weightedDie(), пока результат не перестанет быть премиальным');
    assert(!/\$catalog\['jackpot'\]/.test(body), 'джекпот не выделен отдельным случаем внутри этой функции — для него действует та же логика, что и для остальных премиальных строк');
}

console.log('\n3) _reducePremiumRoll() вызывается И в start(), И в reroll() — до сохранения в сессию, т.е. до показа игроку');
{
    const startFn  = dicePhp.slice(dicePhp.indexOf('function start(){'), dicePhp.indexOf('function reroll(){'));
    const rerollFn = dicePhp.slice(dicePhp.indexOf('function reroll(){'), dicePhp.indexOf('function resolve(){'));

    assert(/\$rolls = \$this->_reducePremiumRoll\(\$rolls, \$catalog, \$rollTrace\);/.test(startFn),
        'start(): вызывается после первого честного броска 4 костей, до сохранения active в сессию');
    assert(/\$active\['rolls'\] = \$this->_reducePremiumRoll\(\$active\['rolls'\], \$catalog, \$rollTrace\);/.test(rerollFn),
        'reroll(): вызывается после подстановки нового значения кости idx, до сохранения active в сессию');
}

console.log('\n4) resolve() больше НЕ содержит логики аннулирования/void — rolls применяются как пришли из сессии');
{
    const resolveFn = dicePhp.slice(dicePhp.indexOf('function resolve(){'));
    assert(!/\$void/.test(resolveFn), 'регресс-гвард: переменная $void отсутствует — аннулирование результата после розыгрыша удалено целиком');
    assert(!/\$this->_reducePremiumRoll\(/.test(resolveFn), 'resolve() не вызывает _reducePremiumRoll — снижение шанса уже применено раньше, в start()/reroll()');
    assert(/\$rolls\s*=\s*array_map\('intval', \$active\['rolls'\]\);/.test(resolveFn), 'resolve() просто читает уже финальные rolls из активной сессии');
}

console.log('\n5) dice_config.json — die_weights не тронуты этим механизмом, джекпот/pity-поля НЕ заведены (осознанно)');
{
    assert(JSON.stringify(catalog.die_weights) === JSON.stringify([19, 19, 19, 19, 12, 12]),
        'die_weights в каталоге не изменились — снижение шанса премиальных комбинаций не трогает сам розыгрыш костей');
    assert(catalog.jackpot === undefined, 'catalog.jackpot отсутствует — подтверждено пользователем 02.10.2026: гарантированного джекпота как отдельной награды больше нет');
    assert(catalog.pity_min === undefined && catalog.pity_max === undefined,
        'catalog.pity_min/pity_max отсутствуют — подтверждено пользователем 02.10.2026: pity-счётчика больше нет вообще');
}

console.log('\n6) Реальный прогон логики — при ВСЕГДА честно выпадающей премиальной комбинации итоговая частота "осталась премиальной" ≈90%');
{
    // Мини-модель именно текущей _reducePremiumRoll: премиальная комбинация выживает с
    // вероятностью 90% (mt_rand(1,100) > 10), иначе перебрасывается ПОЛНОСТЬЮ заново (здесь не
    // моделируем do-while до победного "не премиальная" — проверяем только сам факт 90%/10%).
    function reducePremiumRoll(isPremium, rngPct /* 1-100, имитирует mt_rand(1,100) */){
        if(!isPremium || rngPct > 10) return isPremium;
        return false; // 10%-я ветка — пересобрано, do-while гарантирует НЕ премиальный результат
    }

    let staysPremium = 0;
    const TRIALS = 100000;
    for(let i = 0; i < TRIALS; i++){
        const rngPct = 1 + Math.floor(Math.random() * 100);
        if(reducePremiumRoll(true, rngPct)) staysPremium++;
    }
    const rate = staysPremium / TRIALS;
    assert(rate > 0.87 && rate < 0.93, `при ВСЕГДА честно выпадающей премиальной комбинации итоговая частота "осталась премиальной" ≈90% (получено ${(rate*100).toFixed(1)}%, ожидалось ~90%)`);

    // Регресс-гвард: непремиальная комбинация никогда не становится премиальной этой функцией.
    let neverBecomesPremium = true;
    for(let i = 0; i < 1000; i++){
        if(reducePremiumRoll(false, 1 + Math.floor(Math.random() * 100))) neverBecomesPremium = false;
    }
    assert(neverBecomesPremium, 'непремиальная комбинация никогда не становится премиальной — _reducePremiumRoll только понижает, не повышает ценность');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

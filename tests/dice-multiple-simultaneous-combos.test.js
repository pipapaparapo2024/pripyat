/**
 * Test: зарики — награда выдаётся ЗА КАЖДУЮ одновременную комбинацию (напр. бросок 1,1,6,6
 * должен дать И награду за пару 6, И награду за пару 1), а не только за первую найденную
 * (лучшую) комбинацию в таблице. Раньше цикл использовал break на первом совпадении.
 *
 * 18.09.2026 — ОБНОВЛЕНО: перенос экономики на сервер переместил саму логику подбора
 * комбинаций (и начисление) в dice.php.resolve() — подробно проверено в
 * tests/dice-server-authoritative-rng.test.js (Test 4). Этот файл теперь проверяет
 * оставшуюся на клиенте часть: dvor-dice-game.js получает res.rewards от сервера и
 * ПРАВИЛЬНО сопоставляет их со строками таблицы для подсветки (не теряя многокомбо-случай
 * визуально), а dvor-dice-screen.js по-прежнему умеет подсвечивать НЕСКОЛЬКО строк разом.
 *
 * Run: node tests/dice-multiple-simultaneous-combos.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const gameSrc   = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8');
const screenSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const dicePhp   = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'dice.php'), 'utf-8');

console.log('\nTest 1: подбор комбинаций (включая "не более одной награды на значение") теперь на сервере');
{
    const start = dicePhp.indexOf('function resolve(){');
    const end   = dicePhp.lastIndexOf('}');
    const body  = dicePhp.slice(start, end);
    assert(/foreach\(\$catalog\['table'\] as \$row\)\{/.test(body), 'перебирает ВСЮ таблицу (не одну лучшую строку)');
    // 23.09.2026: условие теперь сохраняется в $already для trace-лога перед continue —
    // логика (одна строка на значение) не изменилась.
    assert(/\$already = in_array\(\$row\['v'\], \$takenValues, true\);/.test(body) && /if\(\$already\) continue;/.test(body),
        'на каждое значение кубика берётся только ОДНА (лучшая) строка — не дублируем 4×6 как 3×6 и 2×6 одновременно');
    assert(!/break;\s*\n\s*\}\s*\n\s*if\(empty\(\$rewards\)\)/.test(body),
        'нет break при первом совпадении — иначе бросок 1,1,6,6 засчитал бы только одну пару из двух');
}

console.log('\nTest 2: клиент сопоставляет ВСЕ res.rewards от сервера со строками TABLE (для подсветки), не только первую');
{
    assert(/const hitIndices = \(res\.rewards \|\| \[\]\)/.test(gameSrc), 'hitIndices строится из ВСЕГО массива res.rewards, не res.rewards[0]');
    assert(/\.map\(r => TABLE\.findIndex\(t => t\.v === r\.v && t\.n === r\.n\)\)/.test(gameSrc),
        'каждая награда от сервера сопоставляется со своей строкой таблицы по (v,n)');
    assert(/if\(hitIndices\.length\) this\._diceShowComboHighlight\(hitIndices\);/.test(gameSrc),
        '_diceShowComboHighlight получает весь массив hitIndices (не один индекс) — сохраняет мульти-подсветку');
}

console.log('\nTest 3: симуляция серверной логики на реальном броске 1,1,6,6 — должно быть 2 хита (регресс-гвард)');
{
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'json', 'dice_config.json'), 'utf-8'));
    const rolls = [1, 1, 6, 6];
    const cnt = {};
    rolls.forEach(v => cnt[v] = (cnt[v]||0)+1);

    const takenValues = [];
    const rewards = [];
    for(const row of catalog.table){
        if((cnt[row.v]||0) < row.n) continue;
        if(takenValues.includes(row.v)) continue;
        takenValues.push(row.v);
        rewards.push(row);
    }
    assert(rewards.length === 2, 'бросок 1,1,6,6 даёт РОВНО 2 совпадения (было бы 1 до фикса)');
    const values = rewards.map(r => r.v).sort();
    assert(values[0] === 1 && values[1] === 6, 'совпадения именно по значениям 1 и 6');
    console.log('    → награды:', rewards.map(r => r.type + ':' + r.amt).join(', '));
}

console.log('\nTest 4: _diceShowComboHighlight принимает массив индексов и рисует несколько прямоугольников (не тронуто переносом)');
{
    assert(/const indices = \(Array\.isArray\(rowIndex\) \? rowIndex : \[rowIndex\]\)/.test(screenSrc),
        '_diceShowComboHighlight нормализует вход в массив (число ИЛИ массив)');
    assert(/indices\.forEach\(idx => \{/.test(screenSrc), 'рисует прямоугольник для КАЖДОГО индекса в массиве');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 21.09.2026 — фикс бага "Нанеси 5 суммарного урона боссам" вместо
 * "Нанеси 5кк суммарного урона боссам" (репорт при клике на кнопку «Мои достижения»).
 *
 * Корень бага: achievementThreshold() парсил порог РЕГЭКСПОМ из a.check.toString() —
 * в DEV это работало, но в ПРОДОВОЙ (webpack/terser) сборке числа переписываются в
 * экспоненциальную запись (5000000 → "5e6"), и старый regex /\d+/ матчил только цифры
 * до "e", молча обрубая порядок величины ("5" вместо "5000000").
 *
 * Фикс 1 (data-layer): achievements.js — каждой из 331 записи добавлено explicit поле
 * threshold:N (сгенерировано один раз из ИСХОДНОГО, не минифицированного текста файла).
 * achievementThreshold() теперь читает это поле в первую очередь, regex — только fallback.
 *
 * Фикс 2 (форматирование, по прямому указанию — «нужно использовать букву "к" вместо
 * трёх нулей, например не 5 000 а 5к, не 5 000 000 а 5кк»): interface-achievements.js
 * получил _fmtAchNum(n) и применяет его во ВСЕХ CAT_PHRASE-шаблонах + в ветке zone_clear.
 *
 * Run: node tests/achievements-threshold-field-and-k-formatter.test.js
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

const achievementsSrc = readSrc('_client/src/game/achievements.js');
const tiersSrc         = readSrc('_client/src/modules/achievement-tiers.js');
const ifaceAchSrc      = readSrc('_client/src/game/interface/interface-achievements.js');

console.log('\nTest 1: achievements.js — у КАЖДОЙ записи с check:s=>...>=N есть explicit threshold:N,');
{
    const lines = achievementsSrc.split('\n').filter(l => l.includes('check:s=>'));
    assert(lines.length > 300, 'в файле реально много записей достижений (нашли ' + lines.length + ')');

    let missing = 0, mismatched = [];
    for(const line of lines){
        const thresholdMatch = line.match(/threshold:\s*(\d+)/);
        const checkNumMatch  = line.match(/>=\s*(\d+)/); // в исходнике (не минифицированном) — точное число
        if(!thresholdMatch){ missing++; continue; }
        if(checkNumMatch && parseInt(thresholdMatch[1]) !== parseInt(checkNumMatch[1])){
            mismatched.push(line.trim());
        }
    }
    assert(missing === 0, 'ни одной записи без явного threshold (нашли пропущенных: ' + missing + ')');
    assert(mismatched.length === 0, 'threshold совпадает с реальным числом в check-функции у всех записей (расхождений: ' + mismatched.length + ')');

    // Точечная проверка конкретных проблемных из отчёта пользователя (между threshold и check
    // теперь также есть statPath — см. Test 6, поэтому не привязываемся к точной соседней строке)
    assert(/threshold:5000000,.*check:s=>s\.dmg>=5000000/.test(achievementsSrc), "dmg_5kk: threshold:5000000 (был баг 'Нанеси 5')");
    assert(/threshold:1000,.*check:s=>s\.auto>=1000/.test(achievementsSrc), "auto_1k: threshold:1000 (был баг 'Накопи 1')");
}

console.log('\nTest 2: achievement-tiers.js — achievementThreshold() предпочитает explicit поле, regex — только fallback');
{
    const start = tiersSrc.indexOf('export function achievementThreshold(a){');
    const end   = tiersSrc.indexOf('\n}', start);
    const body  = tiersSrc.slice(start, end);
    assert(/typeof a\.threshold === 'number'/.test(body), 'проверяет typeof a.threshold === "number" первой строкой');
    assert(/return a\.threshold;/.test(body), 'возвращает explicit threshold напрямую, без парсинга');
    assert(/a\.check\.toString\(\)/.test(body), 'regex-fallback на a.check.toString() оставлен для записей без threshold (защита от регресса)');

    // Функциональная проверка самой логики (копия, т.к. ESM-модуль не грузим напрямую в CommonJS-тесте)
    function achievementThreshold(a){
        if(typeof a.threshold === 'number') return a.threshold;
        const m = a.check.toString().match(/>=\s*(\d+)/);
        return m ? parseInt(m[1]) : 0;
    }
    assert(achievementThreshold({threshold: 5000000, check: s=>s.dmg>=5}) === 5000000,
        'explicit threshold побеждает даже если бы check содержал урезанное число (симуляция минифицированного check)');
    assert(achievementThreshold({check: s=>s.dmg>=42}) === 42,
        'fallback на regex всё ещё работает для записи без threshold');
}

console.log('\nTest 3: interface-achievements.js — _fmtAchNum() заведён и применён во всех CAT_PHRASE + zone_clear');
{
    assert(/function _fmtAchNum\(n\)/.test(ifaceAchSrc), '_fmtAchNum(n) определена');

    // Число CAT_PHRASE-строк, использующих ${n} НАПРЯМУЮ (баг) — должно быть 0
    const rawInterp = (ifaceAchSrc.match(/\$\{n\}/g) || []).length;
    assert(rawInterp === 0, 'нигде в шаблонах не осталось сырого ${n} без _fmtAchNum() (нашли: ' + rawInterp + ')');

    const fmtCalls = (ifaceAchSrc.match(/\$\{_fmtAchNum\(n\)\}/g) || []).length;
    assert(fmtCalls >= 24, 'все CAT_PHRASE-шаблоны (23 категории) + ветка zone_clear используют _fmtAchNum(n) (нашли применений: ' + fmtCalls + ')');

    assert(/Зачисти «\$\{locName\}» \$\{_fmtAchNum\(n\)\} раз/.test(ifaceAchSrc), 'ветка zone_clear тоже форматирует число через _fmtAchNum()');
}

console.log('\nTest 4: _fmtAchNum() — реальное поведение форматтера (симуляция, логика скопирована из исходника)');
{
    function _fmtAchNum(n){
        if(n >= 1000000){
            const v = n / 1000000;
            return (v % 1 === 0 ? v : v.toFixed(1)) + 'кк';
        }
        if(n >= 1000){
            const v = n / 1000;
            return (v % 1 === 0 ? v : v.toFixed(1)) + 'к';
        }
        return String(n);
    }

    assert(_fmtAchNum(5000000) === '5кк', "5000000 → '5кк' (баг из отчёта: было 'Нанеси 5')");
    assert(_fmtAchNum(1000) === '1к', "1000 → '1к' (баг из отчёта: было 'Накопи 1')");
    assert(_fmtAchNum(10) === '10', '10 (< 1000) остаётся как есть, без суффикса');
    assert(_fmtAchNum(100) === '100', '100 (< 1000) остаётся как есть');
    assert(_fmtAchNum(10000) === '10к', '10000 → 10к');
    assert(_fmtAchNum(30000000) === '30кк', '30000000 → 30кк (самый крупный порог урона)');

    // Особые случаи — 3 порога НЕ кратные 1000 ровно (найдены проверочным скриптом)
    assert(_fmtAchNum(1500) === '1.5к', "1500 → '1.5к' (особый случай, не кратен 1000)");
    assert(_fmtAchNum(2500) === '2.5к', "2500 → '2.5к' (особый случай, не кратен 1000)");
    assert(_fmtAchNum(3500) === '3.5к', "3500 → '3.5к' (особый случай, не кратен 1000)");
}

console.log('\nTest 5: сверка с реальными порогами из achievements.js — те самые 3 "нечётных" значения существуют и остальные кратны');
{
    const thresholds = [...achievementsSrc.matchAll(/threshold:\s*(\d+)/g)].map(m => parseInt(m[1]));
    assert(thresholds.length > 300, 'извлекли пороги из файла (' + thresholds.length + ' шт.)');

    // Некоторые "нечётные" пороги (напр. 2500) переиспользуются в НЕСКОЛЬКИХ записях (разные
    // локации/категории с одинаковым порогом) — сравниваем УНИКАЛЬНЫЕ значения, не количество вхождений.
    const oddThousands = [...new Set(thresholds.filter(n => n >= 1000 && n < 1000000 && n % 1000 !== 0))];
    assert(JSON.stringify(oddThousands.sort((a,b)=>a-b)) === JSON.stringify([1500, 2500, 3500]),
        'ровно 3 уникальных "нечётных" порога тысячного масштаба: 1500/2500/3500 (нашли: ' + JSON.stringify(oddThousands) + ')');

    const oddMillions = thresholds.filter(n => n >= 1000000 && n % 1000000 !== 0);
    assert(oddMillions.length === 0, 'ни один порог миллионного масштаба не является "нечётным" — все безопасно форматируются как Nкк');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

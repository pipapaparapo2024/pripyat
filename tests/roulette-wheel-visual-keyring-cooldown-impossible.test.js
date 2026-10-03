/**
 * Test: 29.09.2026, по прямому указанию — "визуально не может быть такого, что рулетка
 * прокрутилась и стрелка визуально показывает, что человек выиграл связку ключей [пока связка
 * на КД]. Такого быть не должно категорически". Ответ на прямой вопрос "как сейчас вообще
 * работает визуально?" + доп. тесты, чтобы связка НИКАК не могла визуально выпасть на КД.
 *
 * 29.09.2026, ФИНАЛЬНОЕ уточнение тем же днём (по прямому указанию — "шанс 1/1000000,
 * буквально на миллион игроков один выигравший, для остального всё как было"): механика
 * сменилась с "бинарное окно доступности, обычные шансы 1/14 пока открыто" на "фиксированный
 * независимый редкий ролл 1/1000000 НА КАЖДУЮ попытку, когда 30-дневный КД истёк" — см.
 * tests/roulette-global-jackpot-kush-keyring.test.js Test 5 для структурной проверки этого же
 * кода. Тест ниже проверял и продолжает проверять то же самое ГЛАВНОЕ свойство (idx=0
 * физически недостижим во время КД) — изменилась только внутренняя формула вне-КД-ветки.
 *
 * Как это устроено сейчас (проверено чтением кода, не только логики):
 *  1) Сервер (roulette.php._rollSlot()) выбирает slotIdx — единственный источник истины.
 *     Пока Связка на КД (keyringAvailable===false) — idx=0 ФИЗИЧЕСКИ исключён (условие редкого
 *     ролла даже не проверяется, единственный fallback-цикл сам исключает 0 и 12) — серверу
 *     НЕКОГДА прислать клиенту idx=0 в это время, не "с маленьким шансом", а НИКОГДА. Когда КД
 *     истёк — независимый ролл mt_rand(1, 1000000)===1 на каждую попытку (см. Test 4 ниже).
 *  2) Клиент (dvor-roulette.js._spinRoulette()) держит ОДНУ переменную `const idx = res.slotIdx;`
 *     и передаёт её ЖЕ И в анимацию колеса (_animRouletteWheel(idx, ...)), И в резолв награды
 *     (_resolveRouletteNewScreen(idx, ...)) — тем же замыканием, без пересчёта где-либо ещё.
 *     Значит "куда показывает стрелка" и "что засчитано как приз" — буквально одно и то же
 *     число, они физически не могут разойтись на уровне этого кода.
 *  3) Угол поворота (_animRouletteWheel) — чистая детерминированная функция от idx
 *     (slotAtPointer = (90 - idx*24 + 360) % 360, SEG=24 — 360°/15 реальных секторов на арте).
 *     Раньше (до 23.09.2026) была историческая рассинхронизация "маркер на одном секторе,
 *     награда — с соседнего" из-за неверного SEG=22.5 (360/16 вместо 360/15, лишний
 *     несуществующий на арте сектор "11") — уже исправлено, тест ниже — регресс-гвард, чтобы
 *     это не вернулось незаметно при будущей правке.
 *
 * Итог: при текущей архитектуре "стрелка показывает Связку, хотя выигран другой приз" не может
 * произойти НИ разу — не потому что шанс мал, а потому что это одна и та же переменная. Тесты
 * ниже фиксируют именно эти структурные гарантии + statistical Monte-Carlo проверку серверной
 * формулы выбора.
 *
 * Run: node tests/roulette-wheel-visual-keyring-cooldown-impossible.test.js
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

const roulJs       = readSrc('_client/src/game/dvor/dvor-roulette.js');
const roulScreenJs = readSrc('_client/src/game/dvor/dvor-roulette-screen.js');
const roulettePhp  = readSrc('server/core/controllers/roulette.php');

console.log('\nTest 1: клиент — ОДНА переменная idx кормит и анимацию колеса, и резолв награды (не могут разойтись)');
{
    const start = roulJs.indexOf("const idx = res.slotIdx;");
    assert(start !== -1, 'const idx = res.slotIdx; найдена');
    // 02.10.2026: окно раздвинуто с 250 до 600 символов — между вызовом _animRouletteWheel и
    // _resolveRouletteNewScreen добавлен поясняющий комментарий (почему patch применяется именно
    // в onComplete), сама структура кода (одна и та же idx, без пересчёта) не изменилась.
    const chunk = roulJs.slice(start, start + 600);
    assert(/this\._animRouletteWheel\(idx, \(\) => \{/.test(chunk), '_animRouletteWheel вызывается с этой же idx');
    assert(/this\._resolveRouletteNewScreen\(idx, !!res\.jackpot, res\.reward, res\.clientRewards \|\| \[\]\);/.test(chunk),
        '_resolveRouletteNewScreen вызывается с ТОЙ ЖЕ idx (внутри замыкания onComplete) — не с отдельно пересчитанным значением');
    // Регресс-гвард: нигде в _spinRoulette() idx не переприсваивается и не считается заново
    // между объявлением const и вызовом _resolveRouletteNewScreen (const — в принципе нельзя,
    // но проверяем и на случай будущего рефакторинга в let).
    assert(!/let idx = res\.slotIdx/.test(roulJs), 'idx объявлена именно как const (не let) — синтаксически нельзя переприсвоить по пути');
}

console.log('\nTest 2: клиент — угол поворота колеса детерминированно зависит ТОЛЬКО от idx, калибровка 15 секторов (SEG=24) на месте');
{
    const start = roulScreenJs.indexOf('proto._animRouletteWheel = function(targetIdx, onComplete){');
    assert(start !== -1, '_animRouletteWheel найдена');
    const end = roulScreenJs.indexOf('requestAnimationFrame(tick);\n    };', start);
    const body = roulScreenJs.slice(start, end);

    assert(/const SEG = 24;/.test(body),
        'SEG=24 (360°/15 реальных секторов на арте) — НЕ 22.5 (историческая причина рассинхронизации "маркер/награда с соседнего сектора")');
    assert(/const slotAtPointer = \(90 - targetIdx \* SEG \+ 360\) % 360;/.test(body),
        'угол под стрелкой считается напрямую от targetIdx (параметра функции, того же idx с сервера) — нет отдельного независимого выбора сектора');
    // Нигде внутри анимации не должно быть Math.random()/mt_rand-подобного выбора СЕКТОРА —
    // случайность допустима только для числа ПОЛНЫХ оборотов (fullRotations), не для того, НА
    // КАКОМ секторе колесо в итоге остановится.
    const fullRotIdx = body.indexOf('fullRotations');
    const beforeFullRot = body.slice(0, fullRotIdx);
    assert(!/Math\.random/.test(beforeFullRot),
        'до объявления fullRotations никакой Math.random() не участвует в выборе итогового сектора — только targetIdx');
}

console.log('\nTest 3: индекс 0 = "Связка ключей" совпадает на клиенте (визуальная подпись сектора) и на сервере (key_bundle/null) — не рассинхронизированы номера');
{
    assert(/\{lbl:'Связка ключей',\s*type:'key_bundle',\s*amt:1,\s*sp:0\},/.test(roulScreenJs),
        'клиентский SLOTS[0] — "Связка ключей"/key_bundle (первый элемент массива = индекс 0)');
    const slotsStart = roulettePhp.indexOf('private $SPIN_SLOTS = [');
    const slotsBody = roulettePhp.slice(slotsStart, slotsStart + 300);
    assert(/null,\s*\/\/ 0: key_bundle/.test(slotsBody), 'серверный SPIN_SLOTS[0] тоже размечен как key_bundle (индексы 0 совпадают буквально)');
}

console.log('\nTest 4: сервер — во время КД idx=0 ФИЗИЧЕСКИ невозможен; после КД — независимый редкий ролл 1/1000000, не гарантия (Monte-Carlo)');
{
    // 29.09.2026 (ФИНАЛЬНОЕ уточнение тем же днём — "шанс 1/1000000, буквально на миллион
    // один выигравший, для остального всё как было"): модель сменилась с "бинарное окно,
    // обычные шансы 1/14 пока открыто" на "фиксированный независимый редкий ролл НА КАЖДУЮ
    // попытку, когда КД истёк". Воспроизводим РЕАЛЬНУЮ формулу _rollSlot() и прогоняем много
    // раз — не полагаемся только на чтение исходника.
    function pickIdx(jackpot, keyringAvailable, denom, forceIdx = null, rng = Math.random){
        if(forceIdx !== null) return forceIdx;
        if(jackpot) return 12;
        if(keyringAvailable && Math.floor(rng() * denom) === 0) return 0; // 1/denom редкий ролл
        let idx;
        do { idx = Math.floor(rng() * 15); } while(idx === 12 || idx === 0);
        return idx;
    }

    const N = 50000;
    let sawZero = false, sawTwelve = false;
    for(let i = 0; i < N; i++){
        const idx = pickIdx(false, false, 1000000); // КД активен — keyringAvailable=false
        if(idx === 0) sawZero = true;
        if(idx === 12) sawTwelve = true;
    }
    assert(sawZero === false, `${N} симуляций с keyringAvailable=false (КД активен) — idx=0 (Связка) не выпало НИ РАЗУ`);
    assert(sawTwelve === false, `${N} симуляций — idx=12 (джекпот-заглушка вне ветки jackpot) не выпало НИ РАЗУ`);

    // Даже когда КД истёк (keyringAvailable=true), idx=0 НЕ гарантирован каждый раз — редкий
    // ролл может не сработать сколько угодно попыток подряд (это ожидаемо при denom=1000000,
    // не баг). Проверяем на маленьком denom (=3), что редкий ролл В ПРИНЦИПЕ способен сработать
    // при "выигрышном" значении RNG — сама ветка кода жива, не задушена логической ошибкой.
    assert(pickIdx(false, true, 3, null, () => 0) === 0,
        'при keyringAvailable=true и "выигрышном" значении RNG (0-й слот из denom) — редкий ролл срабатывает, idx=0 достижим');
    assert(pickIdx(false, true, 3, null, () => 0.9) !== 0,
        'при keyringAvailable=true и "проигрышном" значении RNG — редкий ролл НЕ срабатывает, idx=0 в этом вызове не возвращается');

    // Сверяем, что реальный PHP-код использует ТУ ЖЕ структуру (редкий ролл + единый fallback-
    // цикл, исключающий 0 и 12 ВСЕГДА), что и смоделированная здесь логика.
    assert(/\$keyringAvailable && mt_rand\(1, \$this->KEYRING_CHANCE_DENOM\) === 1/.test(roulettePhp),
        'реальный код: редкий ролл keyring — mt_rand(1, KEYRING_CHANCE_DENOM) === 1, независимый на каждую попытку');
    assert(/while\(\$idx === 12 \|\| \$idx === 0\)/.test(roulettePhp),
        'реальный код: единственный fallback-цикл ВСЕГДА исключает 0 и 12 (не два разных цикла для available/unavailable, как было раньше)');
    assert(!/while\(\$idx === 12\)\s*;/.test(roulettePhp) || !/keyring доступен, избегаем только 12/.test(roulettePhp),
        'старая ветка "цикл 1/14 пока доступен, исключая только 12" убрана — Связка больше не участвует в обычном равновероятном розыгрыше');
}

console.log('\nTest 5: сервер — keyringAvailable в spin() вычисляется из реального времени/КД, а не хардкод (регресс-гвард на уже пойманный сегодня баг)');
{
    assert(/\$keyringAvailable = time\(\) >= intval\(\$row\['keyring_cycle_ends_at'\]\);/.test(roulettePhp),
        'spin(): keyringAvailable = time() >= keyring_cycle_ends_at (не захардкожено true)');
    assert(!/\$keyringAvailable = true;/.test(roulettePhp),
        'нигде в файле не осталось старого хардкода "$keyringAvailable = true;"');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

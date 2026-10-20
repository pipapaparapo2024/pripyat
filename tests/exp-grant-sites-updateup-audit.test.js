/**
 * Test: 17.09.2026 (седьмой батч) — полный аудит ВСЕХ мест в игре, где игроку начисляется
 * udata['exp'] (опыт персонажа). Репорт пользователя: "игрок получает опыт очень за многое —
 * за прохождение локации, за победу над боссами, за ящиками — найди все эти моменты и сделай
 * так, чтобы опыт зачислялся нормально сразу же".
 *
 * Причина исходного бага (см. yashik-updateup-and-zone-card-aspect-ratio.test.js) — начисление
 * udata['exp'] без немедленного iface.updateUp() оставляет кэш уровня (_expCur/_expNext,
 * бейдж «УР.N») устаревшим до случайного следующего вызова updateUp() откуда-то ещё в игре.
 *
 * 18.09.2026 — ОБНОВЛЕНО: перенос экономики на сервер (Зона, Боссы, Ящик) убрал прямое
 * присваивание udata['exp'] из соответствующих мест — они теперь применяют applyPatch(res.patch)
 * с сервера, а applyPatch() (modules/patch.js) САМА безусловно вызывает iface.updateUp() в
 * конце — тот же баг закрыт СТРУКТУРНО для всех перенесённых систем разом, отдельная проверка
 * updateUp() на каждом месте начисления для них больше не нужна.
 *
 * Реестр ниже — ПОЛНЫЙ список мест начисления опыта на 18.09.2026 (найдены через
 * grep udata\['exp'\]\s*= по всему _client/src): каждое ОСТАВШЕЕСЯ прямое присваивание обязано
 * вызывать iface.updateUp() сразу после начисления (не перенесённые на сервер системы); каждое
 * ПЕРЕНЕСЁННОЕ — обязано применять applyPatch(). Тест 0 — защита от регрессии реестра: если в
 * будущем появится НОВОЕ место начисления опыта, не описанное здесь, общее число совпадений
 * изменится и тест упадёт — сигнал добавить новую запись в этот файл.
 *
 * Run: node tests/exp-grant-sites-updateup-audit.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const SRC  = path.join(root, '_client', 'src');
function readSrc(rel){ return fs.readFileSync(path.join(SRC, rel), 'utf-8'); }

// Реестр: файл → сколько раз udata['exp'] присваивается НАПРЯМУЮ (НЕ читается, НЕ через
// applyPatch — только прямая запись). Перенесённые на сервер места (bosses-combat.js,
// yashik.js) теперь 0 — начисление там идёт через applyPatch(res.patch), см. Test 3/5 ниже.
const REGISTRY = {
    // 25.09.2026 (регресс найден повторным прогоном тестов): _tryDropStash физически удалён
    // из zone.js (награда/классификация нычек убраны целиком, по прямому указанию) — больше
    // нет ни одного начисления опыта в этом файле.
    'game/zone.js':                              0,
    // 19.10.2026 (расследование "Антикризиса", см. tests/exp-respect-whitelist-console-
    // exploit-fix.test.js): _give('exp', n) УДАЛЁН целиком — grep по всему _client/src
    // подтвердил, что он не вызывался ни одним реальным игровым путём, а был единственным
    // живым способом вызвать dvor._give('exp', N) из консоли браузера любым игроком (поле
    // 'exp' тогда ещё было в client-writable whitelist users.php, теперь убрано).
    'game/dvor.js':                               0,
    'game/bosses/bosses-combat.js':               0, // перенесено на сервер (claimKill) — теперь applyPatch(), см. Test 3
    'game/shell/overlays/ryukzak.js':             0, // 21.09.2026: перенесено на сервер (ryukzak.open) — теперь applyPatch(), см. Test 4
    'game/shell/overlays/yashik.js':              0, // перенесено на сервер (yashik.collect) — теперь applyPatch(), см. Test 5
    // 19.10.2026: GIVE_MILLION()/_giveMillion() больше не пишут udata['exp'] напрямую — 'exp'
    // убран из client-writable whitelist users.php (та же дыра, что была у coins/stew/
    // cigarettes), дев-читы переведены на users.devGrantCurrency() (дельта + applyPatch(e.patch),
    // который сам безусловно зовёт iface.updateUp() — см. modules/patch.js), см. Test 6/7 ниже.
    'game/debug-tools.js':                        0,
    'game/shell/overlays/dev_panel.js':           0,
};

console.log('\nTest 0: реестр полный — новых мест начисления опыта вне реестра не появилось');
{
    Object.entries(REGISTRY).forEach(([file, expectedCount]) => {
        const src = readSrc(file);
        const found = (src.match(/udata\[['"]exp['"]\]\s*=/g) || []).length;
        assert(found === expectedCount,
            file + ': ожидается ' + expectedCount + ' начислени' + (expectedCount===1?'е':'й') +
            ' opыта, найдено ' + found + ' (если добавлено новое место — добавь запись в REGISTRY ' +
            'и проверь, что оно тоже зовёт iface.updateUp() либо применяет applyPatch())');
    });

    // Полный проход по _client/src — сумма по всем файлам реестра должна совпасть с суммой
    // по всему дереву исходников (страхует от начисления опыта в СОВСЕМ новом файле).
    function walk(dir){
        let files = [];
        for(const entry of fs.readdirSync(dir, {withFileTypes:true})){
            const full = path.join(dir, entry.name);
            if(entry.isDirectory()) files = files.concat(walk(full));
            else if(entry.name.endsWith('.js')) files.push(full);
        }
        return files;
    }
    const allFiles = walk(SRC);
    let totalFound = 0;
    allFiles.forEach(f => {
        const src = fs.readFileSync(f, 'utf-8');
        totalFound += (src.match(/udata\[['"]exp['"]\]\s*=/g) || []).length;
    });
    const totalExpected = Object.values(REGISTRY).reduce((a,b)=>a+b, 0);
    assert(totalFound === totalExpected,
        'сумма по всему _client/src (' + totalFound + ') должна совпадать с реестром (' + totalExpected +
        ') — иначе появилось начисление опыта в файле, не входящем в REGISTRY выше');
}

console.log('\nTest 1: zone.js — начисления опыта полностью серверные (applyPatch), прямых присвоений udata[\'exp\'] не осталось');
{
    const src = readSrc('game/zone.js');
    // 25.09.2026: _tryDropStash (последнее прямое клиентское начисление опыта в этом файле)
    // удалён вместе со всей классификацией/наградой нычек — прямых udata['exp']=... присвоений
    // в zone.js больше нет вообще, только applyPatch() от серверных ответов.
    assert(!/udata\['exp'\]\s*=\s*parseInt\(udata\['exp'\]/.test(src),
        'прямое присвоение udata[\'exp\'] (старый _tryDropStash) нигде не осталось');
    assert(/import \{ applyPatch \} from '\.\.\/modules\/patch\.js';/.test(src),
        'применяет applyPatch — перенесённые на сервер начисления опыта проходят через него');
}

console.log('\nTest 2 (обновлено 19.10.2026 — находка закрыта): dvor.js больше не содержит клиентского начисления опыта вообще');
{
    const src = readSrc('game/dvor.js');
    assert(!/_give\(type, amount\)\{/.test(src), '_give(type, amount) больше не определён в dvor.js (удалён как мёртвый код/консольный эксплойт)');
    assert(!/udata\['exp'\]\s*=/.test(src), 'прямого присваивания udata[\'exp\'] в этом файле больше нет вообще');
}

console.log('\nTest 3: bosses-combat.js — награда за убийство босса перенесена на сервер, применяется через applyPatch()');
{
    const src = readSrc('game/bosses/bosses-combat.js');
    assert(/TS\.php\('bosses\.claimKill'/.test(src), '_onDefeat зовёт bosses.claimKill (сервер считает и применяет награду)');
    assert(/applyPatch\(res\.patch\);/.test(src), 'применяет патч сервера — тот же applyPatch(), что безусловно вызывает iface.updateUp()');
    assert(!/udata\['exp'\]\s*=/.test(src), 'прямого присваивания udata[\'exp\'] в этом файле больше нет вообще');
}

console.log('\nTest 4: ryukzak.js — 21.09.2026 перенесено на сервер (ryukzak.open), применяется через applyPatch()');
{
    const src = readSrc('game/shell/overlays/ryukzak.js');
    assert(/TS\.php\('ryukzak\.open', \{\}/.test(src), 'кнопка ЗАБРАТЬ зовёт ryukzak.open (сервер считает и начисляет награду)');
    assert(/applyPatch\(res\.patch\);/.test(src), 'применяет патч сервера — тот же applyPatch(), что безусловно вызывает iface.updateUp()');
    assert(!/udata\['exp'\]\s*=/.test(src), 'прямого присваивания udata[\'exp\'] в этом файле больше нет вообще');
}

console.log('\nTest 5: yashik.js — оба пути открытия ящика (крестик и ЗАБРАТЬ) перенесены на сервер, применяются через applyPatch()');
{
    const src = readSrc('game/shell/overlays/yashik.js');
    assert(/TS\.php\('yashik\.collect', \{\}/.test(src), 'crestик/ЗАБРАТЬ зовут yashik.collect (общий collectReward())');
    assert(/applyPatch\(res\.patch\);/.test(src), 'применяет патч сервера — тот же applyPatch(), что безусловно вызывает iface.updateUp()');
    assert(!/udata\['exp'\]\s*=/.test(src), 'прямого присваивания udata[\'exp\'] в этом файле больше нет вообще');
}

console.log('\nTest 6 (обновлено 19.10.2026 — находка закрыта): debug-tools.js (GIVE_MILLION, дев-чит) обновляет HUD через devGrantCurrency+applyPatch, не прямым updateUp() после сырого присвоения');
{
    const src = readSrc('game/debug-tools.js');
    assert(!/udata\['exp'\]\s*=\s*M;/.test(src), 'нет прямого udata[\'exp\']=M; — exp теперь идёт дельтой через devGrantCurrency');
    assert(/'exp'/.test(src.slice(src.indexOf('currencyDeltas'), src.indexOf('currencyDeltas') + 300)),
        "'exp' добавлен в список currencyDeltas");
    assert(/if\(e && e\.patch\) applyPatch\(e\.patch\);/.test(src),
        'applyPatch(e.patch) вызывается на ответе devGrantCurrency — applyPatch() сам безусловно зовёт iface.updateUp() (modules/patch.js)');
}

console.log('\nTest 7 (обновлено 19.10.2026 — находка закрыта): dev_panel.js (_giveMillion, дев-чит) обновляет HUD через devGrantCurrency+applyPatch, не прямым updateUp() после сырого присвоения');
{
    const src = readSrc('game/shell/overlays/dev_panel.js');
    const start = src.indexOf('proto._giveMillion = function()');
    const body = src.slice(start, start + 5500);
    assert(!/udata\['exp'\]\s*=\s*M;/.test(body), 'нет прямого udata[\'exp\']=M; — exp теперь идёт дельтой через devGrantCurrency');
    assert(/'exp'/.test(body.slice(body.indexOf('currencyDeltas'), body.indexOf('currencyDeltas') + 300)),
        "'exp' добавлен в список currencyDeltas");
    assert(/_grantCurrencyServer\(currencyDeltas, afterCurrency\);/.test(body),
        '_grantCurrencyServer() (обёртка над users.devGrantCurrency) вызывается с currencyDeltas, который содержит exp');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

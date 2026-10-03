/**
 * Test: батч 16.09.2026 (третий) по репортам пользователя:
 *  1) Попап ошибки (_openSidorovichError, общий на 16 мест игры) теперь описывает КОНКРЕТНО
 *     чего не хватает (тушёнка/фишки/рубли/голубые спички/оружие), а не просто "ОШИБКА" —
 *     во всех местах, не только в покере.
 *  2) Кнопка "ПОНЯТНО" этого же попапа сдвинута на -20 по Y (снято через редактор позиций) —
 *     правка в одном месте авто-применяется ко всем 16 вызовам, т.к. компонент общий.
 *  3) Баг "сброс аккаунта не обнуляет энергию/таймер боя с боссом" — прямое следствие
 *     прошлого фикса (убрали location.reload() у _resetAccount): TIMERS и bosses кешируют
 *     состояние в памяти отдельно от udata и не видят простую замену объекта udata. Теперь
 *     _resetAccount форсирует TIMERS.updateFromUdata() и вручную обнуляет bosses в памяти.
 *
 * Run: node tests/error-popup-messages-position-and-reset-energy-boss.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, '_client', 'src', rel), 'utf-8'); }

const yashikSrc      = readSrc('game/shell/overlays/yashik.js');
const pokerSrc       = readSrc('game/dvor/dvor-poker.js');
const pokerGameSrc   = readSrc('game/dvor/dvor-poker-game.js');
const pokerBagSrc    = readSrc('game/dvor/dvor-poker-bag.js');
// 18.09.2026: dvor-blackjack-game.js больше не существует отдельно — логика блэкджека
// (hit/stand/bust) была консолидирована ВНУТРЬ dvor-blackjack.js (экран + оркестратор + игра
// в одном файле). CLAUDE.md всё ещё перечисляет их раздельно — устаревшая запись карты файлов.
const bjSrc          = readSrc('game/dvor/dvor-blackjack.js');
const bjGameSrc       = bjSrc;
const cardsSrc       = readSrc('game/dvor/dvor-cards.js');
const rouletteBuySrc = readSrc('game/dvor/dvor-roulette-buy.js');
const bossesCombatSrc = readSrc('game/bosses/bosses-combat.js');
const devPanelSrc    = readSrc('game/shell/overlays/dev_panel.js');
const timersSrc      = readSrc('modules/timers.js');

console.log('\nTest 1: ни одного "немого" вызова _openSidorovichError() без аргументов не осталось нигде в клиенте');
{
    const allSrcDir = path.join(root, '_client', 'src');
    function walk(dir){
        let out = [];
        for(const f of fs.readdirSync(dir, {withFileTypes:true})){
            const p = path.join(dir, f.name);
            if(f.isDirectory()) out = out.concat(walk(p));
            else if(f.name.endsWith('.js')) out.push(p);
        }
        return out;
    }
    const bareSites = [];
    for(const file of walk(allSrcDir)){
        const src = fs.readFileSync(file, 'utf-8');
        if(/_openSidorovichError\(\)/.test(src)) bareSites.push(path.relative(root, file));
    }
    assert(bareSites.length === 0, 'нет вызовов без title/subtitle (найдено: ' + bareSites.join(', ') + ')');
}

console.log('\nTest 2: каждый ранее "немой" вызов теперь называет конкретный дефицитный ресурс');
{
    // 18.09.2026 (перенос Покера на сервер): старая FLA-панель покера (dvor-poker.js), где
    // раньше была одна из двух проверок "Недостаточно тушёнки!", удалена целиком как мёртвый
    // код (была недостижима — см. dvor-poker.js и dvor.js._bindGamePanels/_initPanel). Списание
    // тушёнки/фишек и его ошибки теперь только на сервере (poker.php, коды 79/80/81);
    // dvor-poker-game.js называет ресурс явно РОВНО один раз — в обработчике kода 81
    // (_pokerPayAndResolve, второе место, тоже было мёртвым кодом, удалено вместе с ним).
    assert((pokerGameSrc.match(/Недостаточно тушёнки!/g) || []).length === 1,
        'dvor-poker-game.js: тушёнка названа явно в обработчике ошибки сервера (код 81)');
    assert(/Недостаточно фишек!/.test(pokerGameSrc), 'dvor-poker-game.js: фишки названы явно (обработчик кода 79)');
    assert(/Недостаточно голубых спичек!/.test(pokerBagSrc), 'dvor-poker-bag.js: голубые спички названы явно');
    assert(/Недостаточно голубых спичек!/.test(rouletteBuySrc), 'dvor-roulette-buy.js: голубые спички названы явно (кейс)');
    assert(/Недостаточно рублей!/.test(bjSrc), 'dvor-blackjack.js: рубли названы явно');
    assert(/Недостаточно рублей!/.test(bjGameSrc), 'dvor-blackjack-game.js: рубли названы явно');
    // 18.09.2026 (аудит безопасности): dvor-cards.js (СОРВИ КУШ) удалён целиком как мёртвый,
    // но вызываемый из консоли эксплойт (RNG/pity/выплата считались прямо в браузере, в обход
    // сервера) — проверка "рубли названы явно" была про ЭТОТ удалённый код, проверять больше
    // нечего (файл теперь пустая заглушка, см. security-audit-weapons-shmot-bp-tasks-nick.test.js).
    assert(!/proto\._playCards\s*=/.test(cardsSrc), 'sanity: dvor-cards.js действительно пуст (_playCards удалена)');
    assert(/Не выбрано оружие!/.test(bossesCombatSrc), 'bosses-combat.js: отсутствие экипированного оружия названо явно');
    // 24.09.2026 (баг "нужно 50, у меня 104"): динамическая цена теперь приходит от сервера
    // (err.need/err.have — реальный остаток на момент отказа), не из локального PATRON_COST.
    assert(/'Нужно: ' \+ need \+ ' • У вас: ' \+ have/.test(yashikSrc),
        'yashik.js (покупка патрона): тушёнка названа явно, цена и остаток — реальные серверные need/have');
}

console.log('\nTest 3: кнопка ПОНЯТНО общего попапа ошибки сдвинута на -20 по Y (единая правка на все 16 мест)');
{
    assert(/okBtn\.x = 364; okBtn\.y = 442;/.test(yashikSrc), 'okBtn.y = 442 (было 462, сдвиг -20 снят пользователем через редактор позиций)');
    assert(!/okBtn\.y = 462/.test(yashikSrc), 'старое значение y=462 нигде не осталось');
}

console.log('\nTest 4: сброс аккаунта форсирует пересчёт энергии и обнуление боевого состояния боссов в памяти');
{
    assert(/TIMERS\.updateFromUdata\(\)/.test(devPanelSrc),
        '_resetAccount вызывает TIMERS.updateFromUdata() — энергия/потолок энергии пересчитываются из уже сброшенного udata');
    assert(/updateFromUdata\(\)/.test(timersSrc), 'sanity: метод updateFromUdata действительно существует в timers.js');

    assert(/bosses\.keys\s*=\s*\[999,0,0,0,0,0,0,0\]/.test(devPanelSrc), '_resetAccount обнуляет bosses.keys (кроме виртуальных 999 у Охотника)');
    assert(/bosses\._bossStartMs\s*=/.test(devPanelSrc), '_resetAccount обнуляет bosses._bossStartMs (таймер боя с боссом)');
    assert(/bosses\.dailyKills\s*=\s*\[0,0,0,0,0,0,0,0\]/.test(devPanelSrc), '_resetAccount обнуляет bosses.dailyKills (дневной лимит убийств)');
    assert(/bosses\.hpByDiff\s*=/.test(devPanelSrc), '_resetAccount пересобирает bosses.hpByDiff из свежего BOSS_HP (полное HP)');

    // Регресс-гварда: bosses._loadFromUdata() специально НЕ используется для этой цели —
    // она no-op на пустой bosses_data (см. bosses-combat.js), обнуление явное.
    const bossesCombatLoadFn = bossesCombatSrc.slice(
        bossesCombatSrc.indexOf('proto._loadFromUdata = function()'),
        bossesCombatSrc.indexOf('proto._ensureExtraButtons')
    );
    assert(/if\(!udata \|\| !udata\['bosses_data'\]\) return;/.test(bossesCombatLoadFn),
        'sanity: _loadFromUdata() действительно no-op на пустой bosses_data — именно поэтому обнуление в dev_panel.js явное, а не через неё');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

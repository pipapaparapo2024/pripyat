/**
 * Test: батч 25.09.2026 (по прямому указанию):
 *
 *  1) Позиции ЯЧЕЕК (магазин шмоток, cellDx/cellDy/cellScale — НЕ manDx/manDy/manScale, это
 *     разные координаты для разных экранов, пользователь явно попросил не перепутать) для 15
 *     предметов — пересчитаны из абсолютных координат редактора позиций минус база сетки
 *     (GRID: col=round((x-77)/157), row=round((y-98)/172), формула сверена с батчем manDx/
 *     manDy того же дня).
 *
 *  2) "Утешительный приз" — попап для обычного (не Куш, не Связка) исхода мини-игры "9
 *     стаканчиков": клиент вместо инлайн-текста на стаканчике показывает полноэкранный попап
 *     (фон/попап/кнопка ЗАБРАТЬ), фон плавно гаснет 100%→0% за 7 секунд. Куш/Связка/
 *     missed_keyring — НЕ тронуты (более редкие исходы).
 *     26.09.2026 (по прямому указанию — откат правки 25.09.2026, "утешительный приз выглядит
 *     иначе"): сервер (roulette.php.pickCup()) СНОВА выдаёт РЕАЛЬНУЮ награду, заранее
 *     разложенную под стаканчиком в openMinigame() (CUP_POOL), вместо всегда фиксированных 50
 *     рублей — попап показывает тип (CUP_LABELS) + фактическую сумму.
 *
 * Run: node tests/shmot-cell-positions-batch2-and-consolation-prize.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) shmot.js — 15 предметов получили пересчитанные cellDx/cellDy/cellScale (позиции ЯЧЕЕК, не персонажа)');
{
    const src = read('_client/src/game/shmot.js');
    function cellDelta(x, y){
        const col = Math.round((x - 77) / 157);
        const row = Math.round((y - 98) / 172);
        return [x - 77 - col * 157, y - 98 - row * 172];
    }
    const DATA = [
        [79, 2, 237, 399, 0.122], [83, 2, 386, 413, 0.114], [85, 2, 73, 584, 0.126],
        [97, 2, 393, 584, 0.128], [88, 2, 230, 584, 0.094],
        [57, 6, 386, 63, 0.203], [58, 6, 72, 234, 0.790], [59, 6, 229, 239, 0.224],
        [61, 6, 386, 238, 0.653], [62, 6, 72, 411, 0.607], [67, 6, 229, 411, 0.220],
        [80, 6, 386, 409, 0.702], [84, 6, 70, 590, 0.213], [91, 6, 230, 582, 0.211],
        [92, 6, 386, 590, 0.411],
    ];
    assert(DATA.length === 15, 'в тесте перечислены все 15 предметов из промпта');
    DATA.forEach(([id, cat, ex, ey, escale]) => {
        const [dx, dy] = cellDelta(ex, ey);
        const scaleStr = escale.toString().replace('.', '\\.');
        const re = new RegExp('\\{id:' + id + ', cat:' + cat + ',[\\s\\S]*?cellDx:' + dx + ', cellDy:' + dy + ', cellScale:' + scaleStr + ',');
        assert(re.test(src), `id=${id} (cat=${cat}): cellDx=${dx} cellDy=${dy} cellScale=${escale}`);
    });
}

console.log('\n2а) roulette.php.pickCup() — обычный исход снова выдаёт реальную награду из CUP_POOL (не фиксированные 50)');
{
    const src = read('server/core/controllers/roulette.php');
    const idx = src.indexOf("if(\$reward === 'keyring'){");
    const tail = src.slice(idx);
    assert(!/\$consolationAmount = 50;/.test(tail), 'фиксированная сумма 50 рублей больше не используется');
    assert(/list\(\$type, \$amt\) = explode\(':', \$reward\);/.test(tail), 'реальный тип+сумма разбираются из $reward (то, что openMinigame() заранее разложил)');
    assert(/\$this->ops->add\(\$user, 'cigarettes', \$amt\);/.test(tail), 'сигареты начисляются напрямую');
    assert(/\$this->ops->add\(\$user, 'roulette_spichki', \$amt\);/.test(tail), 'спички рулетки начисляются напрямую');
    assert(/\$this->ops->add\(\$user, 'exp', \$amt\);/.test(tail), 'опыт начисляется напрямую');
    assert(/\$this->ops->add\(\$user, 'blue_points', \$amt\);/.test(tail), 'синие поинты начисляются напрямую');
    assert(/\$clientRewards\[\] = \['type'=>\$type, 'amt'=>\$amt\];/.test(tail), 'auto/gun/machete уходят клиенту через clientRewards (weapons.grantAmmo)');
    assert(/'consolation' => true/.test(tail), "ответ по-прежнему помечен флагом consolation:true — клиент показывает попап");
    assert(/\$this->ops->ok\(\['type' => \$type, 'amt' => \$amt, 'consolation' => true,/.test(tail),
        'res.type/res.amt в ответе — реальные значения, не всегда coins/50');
}

console.log('\n2а-доп) roulette.php — Куш сбрасывает счётчик только при реальном выигрыше, не при появлении в раскладке');
{
    const src = read('server/core/controllers/roulette.php');
    const openIdx = src.indexOf('function openMinigame()');
    const pickIdx = src.indexOf('function pickCup()');
    const openBody = src.slice(openIdx, pickIdx);
    const pickBody = src.slice(pickIdx);
    assert(!/kush_counter`=0/.test(openBody), 'openMinigame() больше НЕ сбрасывает kush_counter только за то, что Куш выпал в раскладку');
    assert(/`kush_counter`\s*=\s*kush_counter \+ 1/.test(openBody), 'счётчик всё ещё инкрементируется при каждом открытии мини-игры');
    const kushWinIdx = pickBody.indexOf("if(\$reward === 'kush'){");
    const kushWinEnd = pickBody.indexOf('return;', kushWinIdx);
    const kushWinBlock = pickBody.slice(kushWinIdx, kushWinEnd);
    assert(/kush_counter`=0, `kush_threshold`=\$newT/.test(kushWinBlock), 'сброс счётчика/порога происходит именно в ветке реального выигрыша Куша (pickCup)');
    assert(/rand\(6, 8\)/.test(kushWinBlock), 'новый порог — снова случайные 6-8 мини-игр, как в ТЗ');
}

console.log('\n2б) dvor-roulette-minigame.js — попап "Утешительный приз" показывает реальный тип+сумму, фон угасает');
{
    const src = read('_client/src/game/dvor/dvor-roulette-minigame.js');
    assert(/proto\._openConsolationPrize = function\(cupsWin, type, amt\)\{/.test(src), 'метод _openConsolationPrize принимает реальные type/amt');
    assert(/if\(res\.consolation\)\{/.test(src) && /this\._openConsolationPrize\(win, res\.type, res\.amt\);/.test(src),
        'pickCup-колбэк передаёт в попап реальные res.type/res.amt, а не только флаг');
    // 26.09.2026 (по прямому указанию, повторная правка тем же днём — "убери здесь надпись того,
    // что выигрывает игрок, но после нажатия забрать выводи попап награды с наградой"): инлайн-
    // подпись типа/суммы на самом экране убрана — тип+сумма теперь идут ТОЛЬКО в стандартный
    // попап награды по клику ЗАБРАТЬ (см. ниже), не рисуются на самом экране.
    // Скоуп ТОЛЬКО на _openConsolationPrize — у соседнего _openJackpotPrize (Куш) в этом же
    // файле есть своя, ДРУГАЯ переменная amtTxt, которую мы не трогали (regex по всему файлу
    // ловил её и давал ложный FAIL).
    const cpStart = src.indexOf('proto._openConsolationPrize');
    const cpEnd   = src.indexOf('proto._openJackpotPrize', cpStart);
    const cpBody  = src.slice(cpStart, cpEnd);
    assert(!/const lblTxt/.test(cpBody), 'инлайн-текст типа награды на экране убран');
    assert(!/const amtTxt/.test(cpBody), 'инлайн-текст суммы награды на экране убран');
    assert(/if\(window\.iface\) iface\._showRewardPopup\(\[\{type, amount: amt\}\]\);/.test(cpBody),
        'клик ЗАБРАТЬ открывает стандартный попап награды с реальными type/amt');
    assert(/const FADE_DURATION_MS = 7000;/.test(src), 'длительность угасания фона — 7 секунд, как запрошено');
    assert(/'\.\/images\/стаканчики задний фон утешительный приз\.png'/.test(src), 'фон — новый файл');
    assert(/bg\.x = 6; bg\.y = 84;/.test(src), 'позиция фона снята редактором позиций (картинка 6)');
    assert(/'\.\/images\/стаканчики попап утешительный приз\.png'/.test(src), 'попап — новый файл');
    assert(/panel\.x = 113; panel\.y = 0;/.test(src), 'позиция попапа снята редактором позиций (картинка 4)');
    assert(/'\.\/images\/стаканчики кнопка утешительный приз\.png'/.test(src), 'кнопка ЗАБРАТЬ — новый файл');
    assert(/takeBtn\.x = 534; takeBtn\.y = 459;/.test(src), 'позиция кнопки снята редактором позиций (картинка 5)');
    assert(/bg\.alpha = 1 - t;/.test(src), 'угасает именно фон (alpha), не весь попап целиком');
    assert(!/panel\.alpha/.test(src) && !/takeBtn\.alpha\s*=/.test(src),
        'попап и кнопка НЕ участвуют в анимации угасания (остаются полностью непрозрачными)');
}

console.log('\n3) Новые файлы скопированы в _client/development/images/');
{
    const files = [
        'стаканчики задний фон утешительный приз.png',
        'стаканчики попап утешительный приз.png',
        'стаканчики кнопка утешительный приз.png',
    ];
    files.forEach(f => {
        assert(fs.existsSync(path.join(root, '_client', 'development', 'images', f)), `файл существует: ${f}`);
    });
}

console.log('\n4) Аудит ассетов — иконка "монеты эмблема.png" (26.09.2026: убрана целиком из попапа покупки поинтов, см. remove-coin-icon-overlay-points-buy-screens.test.js) — ни правильного, ни старого опечаточного имени в файле больше нет');
{
    const src = read('_client/src/game/dvor/dvor-dice-screen.js');
    assert(!/'\.\/images\/монета эмблема\.png'/.test(src), 'старая (неверная, ед.ч.) ссылка больше не встречается');
    assert(!/'\.\/images\/монеты эмблема\.png'/.test(src), 'иконка (правильное имя) тоже убрана — не просто переименована, а удалена по прямому указанию');
}

console.log('\n5) Аудит ассетов — та же иконка убрана и из попапа докупки поинтов рулетки');
{
    const src = read('_client/src/game/dvor/dvor-roulette-buy.js');
    assert(!/'\.\/images\/монета эмблема\.png'/.test(src), 'dvor-roulette-buy.js: старая (неверная, ед.ч.) ссылка больше не встречается');
    assert(!/'\.\/images\/монеты эмблема\.png'/.test(src), 'dvor-roulette-buy.js: иконка убрана целиком, не просто переименована');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

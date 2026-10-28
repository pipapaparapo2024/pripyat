/**
 * Test: 23.10.2026, по прямому указанию — новая фича "Разнарядка" (месячный календарь
 * ежедневных заданий, см. doc "ежедневные задания.docx"). Логика прогрессии/ранжирования/
 * совпадения задания — покрыта реальным исполнением PHP (raznaryadka-php-real-exec.test.js).
 * Этот файл — структурные/регресс-проверки: все 8 хуков автозачёта реально вызываются в
 * контроллерах-источниках, HUD-кнопка восстановлена, server-only поле защищено, клиентский
 * экран ссылается на правильные файлы/координаты/формулы.
 *
 * Run: node tests/oct23-raznaryadka-feature.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const norm = p => fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');

console.log('\nTest 1: серверные файлы существуют и валидны как JSON/содержат нужные классы');
{
    const configPath = path.join(root, 'server/json/raznaryadka_config.json');
    assert(fs.existsSync(configPath), 'server/json/raznaryadka_config.json существует');
    let config = null;
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch(e){ /* assert ниже упадёт */ }
    assert(config !== null, 'raznaryadka_config.json — валидный JSON');
    if(config){
        assert(Array.isArray(config.pay_progression) && config.pay_progression.join(',') === '2,4,8,16,32,64',
            'pay_progression === [2,4,8,16,32,64] (doc: "по системе х2 до 64 тушёнки")');
        assert(Array.isArray(config.reward_tiers) && config.reward_tiers.length === 5,
            'reward_tiers — ровно 5 порогов (2/5/10/20/финал)');
        const needs = config.reward_tiers.map(t => t.need);
        assert(needs[0] === 2 && needs[1] === 5 && needs[2] === 10 && needs[3] === 20 && needs[4] === -1,
            'пороги [2,5,10,20,-1] (-1 = последний день месяца, резолвится на сервере)');
        assert(Array.isArray(config.boss_names) && config.boss_names.length === 8,
            'boss_names — 8 имён (по числу боссов)');
        // 23.10.2026: тест raznaryadka-php-real-exec.test.js (Test 3) поймал реальный баг —
        // здесь стоял именительный падеж вместо винительного, грамматически ломавший
        // "Победить {boss_name}". Регресс-гвард на уровне JSON (быстрее, чем PHP-прогон).
        assert(config.boss_names[0] === 'Охотника' && config.boss_names[1] === 'Счастливчика',
            'boss_names — винительный падеж ("Охотника", не "Охотник") — см. task_labels.boss шаблон');
        // 23.10.2026: список задач теперь полный рандом (generateMonth(), см.
        // raznaryadkaprogress.php), но количество заданий ВСЕГДА равно числу дней месяца —
        // заказчик публикует список постом в группе ВК заранее (tools/gen_raznaryadka_month.php).
        // Конкретные день->тип больше не пинуются (это и есть смысл "полного рандома") —
        // проверяем только структуру/количество/валидность типов.
        const nov = config.months['2026-11'];
        assert(!!nov, 'календарь на ноябрь 2026 присутствует');
        if(nov) assert(Object.keys(nov.days).length === 30, 'в ноябре 2026 — ровно 30 заданий (30 дней в месяце)');
        const oct = config.months['2026-10'];
        assert(!!oct, 'календарь на текущий месяц (октябрь 2026) тоже подготовлен заранее (иначе "нет задания на сегодня" в живой игре прямо сейчас)');
        if(oct) assert(Object.keys(oct.days).length === 31, 'в октябре 2026 — ровно 31 задание (31 день в месяце)');
        // 23.10.2026 (по прямому указанию — фича официально стартует с 1 ноября 2026): до
        // launch_month конкретные задания игроку не показываются ("Скоро" вместо текста).
        assert(config.launch_month === '2026-11', 'launch_month === "2026-11" (официальный старт фичи)');
        const validTypes = Object.keys(config.task_labels);
        [nov, oct].filter(Boolean).forEach((monthCfg, mi) => {
            const label = mi === 0 ? '2026-11' : '2026-10';
            Object.values(monthCfg.days).forEach(dayCfg => {
                assert(validTypes.includes(dayCfg.type), `${label}: тип "${dayCfg.type}" входит в task_labels`);
                // 23.10.2026 (уточнение): пул ограничен 4 боссами (Охотник/Счастливчик/Ястреб/
                // Меченный, boss_id 0..3) — Крыс/Баркут/Борода/Жгут НЕ входят в присланный список.
                if(dayCfg.type === 'boss') assert(typeof dayCfg.boss_id === 'number' && dayCfg.boss_id >= 0 && dayCfg.boss_id <= 3,
                    `${label}: boss-день содержит boss_id в диапазоне 0..3`);
            });
        });
    }

    const files = [
        'server/core/models/raznaryadkaprogress.php',
        'server/core/controllers/raznaryadka.php',
        'server/migrate51.php',
        '_client/src/game/shell/overlays/raznaryadka.js',
        'tools/gen_raznaryadka_month.php',
        '_client/development/images/задания.png',
        '_client/development/images/задания hover.png',
        '_client/development/fonts/BebasNeueBook.ttf',
    ];
    files.forEach(f => assert(fs.existsSync(path.join(root, f)), `${f} существует`));
}

console.log('\nTest 1b: raznaryadka.php — до launch_month label заменяется на "Скоро" (задания не раскрываются раньше старта)');
{
    const src = norm(path.join(root, 'server/core/controllers/raznaryadka.php'));
    assert(/\$isPreLaunch = isset\(\$config\['launch_month'\]\) && \$data\['month'\] < \$config\['launch_month'\];/.test(src),
        '$isPreLaunch — строковое сравнение текущего месяца с launch_month');
    assert(/'label' => \$isPreLaunch \? 'Скоро' : RaznaryadkaProgress::taskLabel\(\$config, \$todayCfg\),/.test(src),
        'label подменяется на "Скоро" до старта, настоящий текст — после');
    // 23.10.2026 (уточнение по прямому указанию): таймер до старта фичи тоже не тикает —
    // сервер прокидывает pre_launch, клиент статично показывает дату старта.
    assert(/'pre_launch'\s*=> \$isPreLaunch,/.test(src), "getState() возвращает 'pre_launch' => $isPreLaunch");
}

console.log('\nTest 8c: клиент — до старта таймер статично показывает "01.11.2026", не тикает');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'));
    assert(/if\(this\._state\.pre_launch\)\{\s*\n\s*this\._timerTxt\.text = '01\.11\.2026';\s*\n\s*return;\s*\n\s*\}/.test(src),
        '_startTimer(): pre_launch -> статичный текст "01.11.2026", без setInterval');
}

console.log('\nTest 2: registry.php — класс "raznaryadka" добавлен в whitelist (иначе permit-запросы отклоняются кодом 3)');
{
    const src = norm(path.join(root, 'server/core/models/registry.php'));
    assert(/'classes'=>array\([^)]*'raznaryadka'/.test(src), 'raznaryadka присутствует в registry.classes');
}

console.log('\nTest 3: users.php — raznaryadka_data НЕ в whitelist save(), но сбрасывается в resetSession()');
{
    const src = norm(path.join(root, 'server/core/controllers/users.php'));
    const allowedMatch = src.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    if(allowedMatch) assert(!/raznaryadka_data/.test(allowedMatch[1]),
        'raznaryadka_data НЕ в $allowed (клиент не может подделать прогресс через users.save)');
    assert(/'raznaryadka_data'\s*=>\s*null/.test(src), "resetSession() обнуляет raznaryadka_data");
}

console.log('\nTest 4: все 8 хуков RaznaryadkaProgress::report() реально вызываются в контроллерах-источниках');
{
    const HOOKS = [
        { file: 'server/core/controllers/bosses.php',     kind: "'boss'",      note: 'claimKill() — победа над боссом' },
        { file: 'server/core/controllers/zone.php',       kind: "'energy'",    note: 'fillCheckpoint() — трата энергии' },
        { file: 'server/core/controllers/zone.php',       kind: "'respect'",   note: 'fillCheckpoint() — заработок уважения' },
        { file: 'server/core/controllers/dvor.php',       kind: "'sukhari'",   note: 'collectCig() — сбор сухарей' },
        { file: 'server/core/controllers/zaruba.php',     kind: "'zaruba'",    note: 'fight() — зарубиться' },
        { file: 'server/core/controllers/zaruba.php',     kind: "'kachalka'",  note: 'pump() — позвать в качалку' },
        { file: 'server/core/controllers/dice.php',       kind: "'dice'",      note: 'resolve() — сыграть в зарики' },
        { file: 'server/core/controllers/blackjack.php',  kind: "'blackjack'", note: 'resolve() — сыграть в блек-джек' },
        { file: 'server/core/controllers/poker.php',      kind: "'poker'",     note: 'resolve() — сыграть в покер (задел на будущее)' },
        { file: 'server/core/controllers/roulette.php',   kind: "'roulette'",  note: 'spin() — сыграть в рулетку (задел на будущее)' },
    ];
    HOOKS.forEach(h => {
        const src = norm(path.join(root, h.file));
        const re = new RegExp('RaznaryadkaProgress::report\\(\\$this->ops,\\s*' + h.kind);
        assert(re.test(src), `${h.file}: ${h.note} -> RaznaryadkaProgress::report($this->ops, ${h.kind}, ...)`);
    });
}

console.log('\nTest 5: hook в bosses.claimKill() передаёт meta boss_id (иначе "Победить Охотника" засчитает ЛЮБОГО босса)');
{
    const src = norm(path.join(root, 'server/core/controllers/bosses.php'));
    assert(/RaznaryadkaProgress::report\(\$this->ops, 'boss', 1, \['boss_id' => \$bossId\]\);/.test(src),
        "вызов передаёт ['boss_id' => $bossId] третьим аргументом meta");
}

console.log('\nTest 6: хуки вызываются ПОСЛЕ собственного saveUser() вызывающего контроллера (см. докблок RaznaryadkaProgress — иначе риск затереть чужие поля устаревшим снимком)');
{
    const CHECKS = [
        { file: 'server/core/controllers/dvor.php',      hookKind: "'sukhari'" },
        { file: 'server/core/controllers/zaruba.php',     hookKind: "'kachalka'" },
        { file: 'server/core/controllers/dice.php',       hookKind: "'dice'" },
        { file: 'server/core/controllers/blackjack.php',  hookKind: "'blackjack'" },
    ];
    CHECKS.forEach(c => {
        const src = norm(path.join(root, c.file));
        const hookIdx = src.indexOf('RaznaryadkaProgress::report($this->ops, ' + c.hookKind);
        assert(hookIdx > 0, `${c.file}: хук ${c.hookKind} найден`);
        if(hookIdx > 0){
            const before = src.slice(0, hookIdx);
            const lastSave = before.lastIndexOf('saveUser(');
            assert(lastSave > 0 && lastSave < hookIdx, `${c.file}: ближайший saveUser() выше хука ${c.hookKind} (хук звучит ПОСЛЕ сохранения)`);
        }
    });
}

console.log('\nTest 7: HUD-кнопка — настоящие PNG-спрайты (задания.png/hover) в interface-panels.js, module_control.js конструирует window.raznaryadka');
{
    const panelsSrc = norm(path.join(root, '_client/src/game/interface/interface-panels.js'));
    // 23.10.2026: временный Graphics+Text плейсхолдер заменён на настоящие спрайты
    // "задания.png"/"задания hover.png" (присланы пользователем), тот же hover-паттерн
    // norm/hov/hit, что у остальных кнопок этой панели.
    assert(/raznNorm = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'задания\.png'\)\);/.test(panelsSrc),
        'raznNorm — спрайт из "задания.png"');
    assert(/raznHov\s*=\s*new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'задания hover\.png'\)\);/.test(panelsSrc),
        'raznHov — спрайт из "задания hover.png"');
    assert(/raznHit\.on\('pointerdown', \(\) => \{/.test(panelsSrc) && /this\.openModule\('raznaryadka'\);/.test(panelsSrc),
        'кнопка "задания" открывает модуль через openModule(\'raznaryadka\')');
    assert(/raznHit\.on\('pointerover', \(\) => \{ raznNorm\.visible = false; raznHov\.visible = true; \}\);/.test(panelsSrc),
        'hover-эффект — переключение norm/hov (тот же паттерн, что у рюкзака/остальных кнопок панели)');
    assert(/if\(window\.raznaryadka && typeof raznaryadka\.close === 'function' && raznaryadka\._win && raznaryadka\._win\.parent\) raznaryadka\.close\(\);/.test(panelsSrc),
        '_closeAllPanels() закрывает раздел при переключении вкладки (тот же паттерн, что hata/habar/svod)');
    // 26.10.2026: 'game2048' добавлен сразу ПОСЛЕ 'raznaryadka' в этом же массиве (тот же
    // close-hook паттерн, для новой мини-игры "2048") — проверяем наличие 'raznaryadka', не
    // завязываясь на то, что он обязательно последний элемент массива.
    assert(/'bank','raznaryadka'/.test(panelsSrc), "'raznaryadka' добавлен в список _closeCurrentModule()");

    const mcSrc = norm(path.join(root, '_client/src/modules/module_control.js'));
    assert(/import Raznaryadka from '\.\.\/game\/shell\/overlays\/raznaryadka\.js';/.test(mcSrc), 'Raznaryadka импортирован');
    assert(/window\.raznaryadka = new Raznaryadka\(\);/.test(mcSrc), 'window.raznaryadka конструируется (тот же паттерн, что Hata — без FLA)');
}

console.log('\nTest 8: клиентский экран — координаты календаря и шрифт/цвет соответствуют продиктованной спеке');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'));
    assert(/x0:\s*375,\s*y0:\s*227,\s*stepX:\s*41,\s*stepY:\s*42,\s*cols:\s*7/.test(src),
        'сетка дней: x0=375 y0=227, шаг 41×42, 7 колонок (продиктовано пользователем)');
    assert(/bg\.x = 0; bg\.y = 57;/.test(src), 'фон: x=0 (вся ширина), y=57');
    assert(/popup\.x = 243; popup\.y = 59;/.test(src), 'попап: x=243, y=59');
    assert(/dateMazok\.x = 368; dateMazok\.y = 461;/.test(src), '"мазок красный" (ДЕЛО НА...): x=368, y=461');
    assert(/taskPlate\.x = 339; taskPlate\.y = 497;/.test(src), '"плашка серая" (текст задания): x=339, y=497');
    assert(/timerPlate\.x = 782; timerPlate\.y = 510;/.test(src), '"плашка тёмная" (таймер): x=782, y=510');
    assert(/REWARD_ROW_BTN_X = 859/.test(src), 'строка награды/кнопки забрать/собрано — общий x=859');
    // 28.10.2026 (повторная правка тем же днём — "рубли/стволы/автоматы/патроны опусти вниз на
    // 4 пикселя"): первые 4 строки +4, сундук не трогается.
    const rowYs = [...src.matchAll(/rowY:\s*(\d+)/g)].map(m => parseInt(m[1]));
    assert(rowYs.join(',') === '216,277,336,394,450', `5 строк наград Y: 216/277/336/394/450, получено ${rowYs.join(',')}`);
    // 23.10.2026: настоящий присланный файл шрифта подключён (внутреннее имя "Bebas Neue Book",
    // т.е. "BebasNeueBook" как и был изначально запрошен) — заменяет временный "AA Bebas Neue".
    assert(/const FONT = 'Bebas Neue Book';/.test(src), 'шрифт — "Bebas Neue Book" (настоящий присланный BebasNeueBook.ttf)');
    assert(/font-family: 'Bebas Neue Book'/.test(norm(path.join(root, '_client/development/fonts/fonts.css'))),
        '@font-face "Bebas Neue Book" подключён в fonts.css');
    assert(/font-family: 'Bebas Neue Book', 'Bebas Neue Book';/.test(norm(path.join(root, '_client/development/index.html'))),
        'шрифт активирован hidden span в index.html (иначе PIXI.Text не подхватит его надёжно)');
    assert(/const GOLD = '#d8bb9e';/.test(src), 'цвет подписей — #d8bb9e (из присланной палитры)');
    assert(/fontFamily: 'Southbank LT', fontSize: 36, fill: '#000000'/.test(src),
        'таймер — Southbank LT 36pt чёрный (отдельный шрифт/цвет от остального текста экрана)');
    assert(/function ruTasksWord\(n\)/.test(src), 'склонение "задание/задания/заданий" реализовано');

    // 24.10.2026 (по прямому указанию, повторный пересмотр — "крестик это задание, которое
    // игрок не сделал"): крест снова отмечает ПРОВАЛЕННЫЙ день (было отменено 23.10.2026,
    // теперь отменено обратно явным новым уточнением), выполненный день — отдельная галочка.
    assert(/cross\.visible = status === 'failed';/.test(src), 'крест показывается на ПРОВАЛЕННЫЙ день (status===\'failed\')');
    assert(/check\.visible = status === 'done';/.test(src), 'галочка показывается на ВЫПОЛНЕННЫЙ день (status===\'done\')');

    // 23.10.2026 (по прямому указанию): счётчики наград (кроме сундука) — общий X, по центру
    // строки-фона, с "×" перед числом.
    // 24.10.2026 (баг найден по прямому указанию — "справа от иконок награды должно писаться
    // количество, сейчас почему-то ничего не пишется"): чёрная заливка (#000000) сначала
    // (ошибочно) сочли невидимой на тёмном фоне и заменили на GOLD; 24.10.2026 повторный замер
    // пикселя с учётом попап-рамки поверх фона показал светлый бежевый цвет в этой точке —
    // чёрный текст (Bebas Neue Pro Middle, Regular, 24pt — продиктовано по Photoshop-референсу)
    // вернули как корректный и видимый.
    assert(/const REWARD_AMT_X = 819;/.test(src), 'общий X для счётчиков наград — 819 (правый край самой широкой иконки + 12px)');
    assert(/const amtTxt = new PIXI\.Text\('', \{\s*fontFamily: 'Bebas Neue Pro Middle', fontSize: 24, fill: '#000000',\s*\}\);/.test(src), 'счётчик награды — Bebas Neue Pro Middle 24pt чёрным (по Photoshop-референсу, фон в этой точке светлый)');
    // 28.10.2026 (по прямому указанию — "для всех задачек их количество опусти вниз на 7
    // пикселей"): было ровно по центру rowBg, теперь +7 ниже центра.
    // 28.10.2026 (повторное указание тем же днём — "количество (×30 и т.д.) подними вверх на
    // 4 пикселя"): было +7, стало +3 (+7-4).
    assert(/amtTxt\.y = rowBg\.y \+ rowBg\.texture\.height \/ 2 \+ 7 - 4;/.test(src), 'счётчик награды — по центру ПО ВЕРТИКАЛИ относительно rowBg, итого +3px (28.10.2026)');
}

console.log('\nTest 8b: _render() — "×" перед числом для всех наград, последняя (сундук) всегда показывает ×1 (не внутреннее число монет tier.amt)');
{
    const src = norm(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'));
    // 24.10.2026 (баг найден по прямому указанию — "справа от сундука почему-то 130, должно
    // быть ×1"): было last ? String(tier.amt) : ... — показывало 130 (монеты внутри сундука),
    // игрок получает РОВНО ОДИН сундук, не 130 штук чего-либо.
    assert(/el\.amtTxt\.text = last \? '×1' : \('×' \+ tier\.amt\);/.test(src),
        '_render(): last ? ×1 (сундук, фиксировано) : ×tier.amt (остальные 4)');
}

console.log('\nTest 9: ruTasksWord()/dayTilePos() — РЕАЛЬНОЕ исполнение (не просто наличие кода), та же vm-техника, что boss-rating-audio-regressions.test.js');
{
    const vm = require('vm');
    const src = norm(path.join(root, '_client/src/game/shell/overlays/raznaryadka.js'));

    const extract = (name) => {
        const start = src.indexOf('function ' + name);
        if(start < 0) return null;
        let depth = 0, i = src.indexOf('{', start);
        const bodyStart = i;
        for(; i < src.length; i++){
            if(src[i] === '{') depth++;
            else if(src[i] === '}'){ depth--; if(depth === 0) break; }
        }
        return src.slice(start, i + 1);
    };
    const gridConstMatch = src.match(/const DAY_GRID = \{[^}]*\};/);
    const ruWordFn = extract('ruTasksWord');
    const dayTilePosFn = extract('dayTilePos');
    assert(!!ruWordFn, 'ruTasksWord() вырезан из файла для исполнения');
    assert(!!dayTilePosFn && !!gridConstMatch, 'dayTilePos()+DAY_GRID вырезаны из файла для исполнения');

    if(ruWordFn){
        const ctx = {};
        vm.createContext(ctx);
        vm.runInContext(ruWordFn, ctx);
        const cases = { 1: 'задание', 2: 'задания', 5: 'заданий', 10: 'заданий', 11: 'заданий', 20: 'заданий', 21: 'задание', 31: 'задание' };
        for(const [n, expected] of Object.entries(cases)){
            const got = vm.runInContext(`ruTasksWord(${n})`, ctx);
            assert(got === expected, `ruTasksWord(${n}) === '${expected}', получено '${got}'`);
        }
    }

    if(dayTilePosFn && gridConstMatch){
        const ctx = {};
        vm.createContext(ctx);
        vm.runInContext(gridConstMatch[0] + '\n' + dayTilePosFn, ctx);
        const p1  = vm.runInContext('dayTilePos(1)', ctx);
        const p7  = vm.runInContext('dayTilePos(7)', ctx);
        const p8  = vm.runInContext('dayTilePos(8)', ctx);
        const p31 = vm.runInContext('dayTilePos(31)', ctx);
        assert(p1.x === 375 && p1.y === 227, `день 1 -> (375,227), получено (${p1.x},${p1.y})`);
        assert(p7.x === 375 + 6*41 && p7.y === 227, `день 7 (конец 1-й строки) -> (${375+6*41},227), получено (${p7.x},${p7.y})`);
        assert(p8.x === 375 && p8.y === 227 + 42, `день 8 (начало 2-й строки) -> (375,${227+42}), получено (${p8.x},${p8.y})`);
        assert(p31.x === 375 + 2*41 && p31.y === 227 + 4*42, `день 31 (5-я строка, 3-я колонка) -> (${375+2*41},${227+4*42}), получено (${p31.x},${p31.y})`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 25.09.2026, по прямому указанию (продолжение редизайна "9 стаканчиков", Кush/Связка
 * ключей уже реализованы ранее в этой же сессии, см. коммит 44f3db4) —
 *
 * 1) Уточнено расследованием + вопросом пользователю: новая графика стаканчиков
 *    ("стаканчик суперигра.png" закрыт / "стаканчик открытый суперигра.png" открыт, сетка 3×3)
 *    УЖЕ была реализована и задеплоена ранее в этой сессии — файлы на диске побайтово совпадают
 *    с присланными пользователем повторно. Ничего менять не требовалось (регресс-гвард ниже).
 *
 * 2) Анимация переворота: раньше раскрытие стаканчика было МГНОВЕННОЙ сменой картинки
 *    (closedSpr.visible=false → openSpr.visible=true). По прямому указанию добавлена анимация:
 *    закрытый спрайт поворачивается на 90° по часовой стрелке (rotation: Math.PI/2) и
 *    приподнимается на 40px (y -= 40), и только ПОСЛЕ завершения анимации происходит
 *    фактическое раскрытие (смена картинки, применение патча, попапы) — иначе попап немедленно
 *    перекрывал бы саму анимацию.
 *
 * 3) "Шарик" (шарик суперигра.png, ранее — неиспользуемый файл на диске): по прямому ответу
 *    пользователя — чисто визуальный маркер, появляется ПОД/НАД открытым стаканчиком ТОЛЬКО
 *    когда исход — Куш (res.kush). Никакой новой игровой логики — награда за Куш не менялась.
 *
 * 10.10.2026 (по прямому указанию — "когда стаканчик открывается, не заменяй его на другой
 * файл", "все эти файлы стаканчиков опусти вниз на 50 пикселей", "шарик должен находиться за
 * стаканчиком"): три точечных изменения поверх всего вышеописанного —
 *  - CUP_Y 431→481 (весь стаканчик, не только текстура, опущен на 50px).
 *  - openSpr ("стаканчик открытый суперигра.png") убран целиком — он сбрасывал визуальный эффект
 *    gsap-анимации поворота/подъёма, подменяя повёрнутый closedSpr немедленно появляющимся
 *    неповёрнутым открытым спрайтом. Теперь closedSpr остаётся единственным и видимым файлом
 *    постоянно, просто в повёрнутом/поднятом состоянии после анимации.
 *  - ballSpr теперь добавляется В CUP ДО closedSpr (не после openSpr) — рисуется ЗА стаканчиком,
 *    а не поверх.
 *
 * 11.10.2026 (по прямому указанию — "выкатывается влево, такого быть не должно; если куш не
 * выбил — открывается ДРУГОЙ стаканчик, в котором был шарик, и шарик показывается в нём"):
 * укатывание шарика в фиксированную точку (введено и уже отменено 10.10.2026, см. историю выше)
 * убрано целиком. Вместо него — roulette.php.pickCup() ищет 'kush' в оставшихся 8 стаканчиках
 * раскладки (array_search) и, если он там реально есть, отдаёт его индекс как res.otherKushIdx;
 * клиент при его наличии открывает именно ТОТ стаканчик (та же анимация поворота/подъёма, что и
 * у своего собственного) и показывает под ним шарик. Чисто визуальная подсказка — экономику
 * (kush_counter/kush_threshold, саму награду) не трогает.
 *
 * 11.10.2026, тем же днём — ВТОРОЕ уточнение (по живому репорту "попап перекрывает открытие
 * второго стаканчика, игрок не успевает его увидеть" + детальное ТЗ по таймингу):
 *  - Попап награды/приза БОЛЬШЕ НЕ показывается мгновенно в момент onComplete первого стаканчика
 *    (раньше второй стаканчик даже не успевал физически прорисоваться на экране — попап
 *    перекрывал его в тот же тик). Теперь между каждым шагом (подъём своего стаканчика → пауза →
 *    [подъём чужого стаканчика с шариком → пауза] → попап) стоит REVEAL_PAUSE_MS=500мс, чтобы
 *    игрок успел увидеть результат каждого шага.
 *  - Переворот стаканчика вынесен в общий хелпер `_flipCup(spr, onDone)` — используется и для
 *    своего стаканчика, и для чужого (раньше анимация чужого стаканчика была отдельным
 *    копипастом inline-кода внутри _finishReveal).
 *  - `ballSpr.visible = true` для СВОЕГО стаканчика переключается ПЕРЕД стартом `_flipCup()`
 *    (в момент начала подъёма), а не в onComplete (после завершения) — "шарик должен
 *    отрисовываться в момент, когда нажатие на стаканчик произошло"; то же самое для ЧУЖОГО
 *    стаканчика — его ballSpr.visible тоже переключается перед стартом ЕГО _flipCup(), а не
 *    одновременно с запуском анимации (раньше оба — oBall.visible и gsap.to — стояли рядом,
 *    структурно эквивалентно, но теперь это явно оформлено как общее правило через хелпер).
 *  - `_finishReveal` больше НЕ содержит никакой ball-reveal логики (ни res.kush, ни
 *    res.otherKushIdx) — она теперь только применяет патч/clientRewards и показывает
 *    попап/инлайн-текст. Вся ball-reveal логика (обе ветки) живёт СНАРУЖИ, между запуском
 *    собственного `_flipCup()` и финальным `setTimeout(_finishReveal, REVEAL_PAUSE_MS)`.
 *
 * Run: node tests/roulette-minigame-cup-flip-and-ball.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
// .replace(CRLF->LF): файл на диске хранится с CRLF (Windows) — нормализуем перед
// текстовыми exact-match проверками ниже, иначе строки с "\n" в паттерне не находятся.
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-minigame.js'), 'utf-8').replace(/\r\n/g, '\n');

console.log('\nTest 1: графика стаканчиков — закрытый файл по-прежнему используется, открытый (10.10.2026) больше НЕ используется как текстура');
{
    assert(/стаканчик суперигра\.png/.test(src), 'закрытый стаканчик — используется');
    assert(!/Texture\.from\('\.\/images\/стаканчик открытый суперигра\.png'\)/.test(src),
        '10.10.2026 (по прямому указанию "не заменяй файл") — открытый стаканчик больше НЕ загружается как текстура (слово может остаться только в explain-комментариях)');
    assert(!/\bconst openSpr\b/.test(src), 'переменной openSpr в коде больше нет — подмена файла убрана целиком');
    // 10.10.2026 (по прямому указанию — "все эти файлы стаканчиков опусти вниз на 50 пикселей"):
    // CUP_Y 431→481.
    assert(/const CW = 93, CH = 140;/.test(src) && /const START_X = 246, CUP_Y = 481, STEP_X = 93;/.test(src),
        'один ряд из 9 стаканчиков, ячейка 93×140, X=246 (сдвинуто вправо на 30px 10.10.2026), Y=481 (опущено на 50px 10.10.2026)');
    const closedPath = path.join(root, '_client', 'development', 'images', 'стаканчик суперигра.png');
    assert(fs.existsSync(closedPath) && fs.statSync(closedPath).size > 0, 'файл закрытого стаканчика существует и не пустой');
}

console.log('\nTest 2: шарик — файл скопирован, спрайт создан скрытым, добавлен ДО closedSpr (10.10.2026: теперь рисуется ЗА стаканчиком, не поверх)');
{
    const ballPath = path.join(root, '_client', 'development', 'images', 'шарик суперигра.png');
    assert(fs.existsSync(ballPath) && fs.statSync(ballPath).size > 0, 'шарик суперигра.png существует и не пустой');

    const ballDeclIdx = src.indexOf("const ballSpr = new PIXI.Sprite(PIXI.Texture.from('./images/шарик суперигра.png'));");
    const ballAddIdx = src.indexOf('cup.addChild(ballSpr);');
    const closedDeclIdx = src.indexOf("const closedSpr = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчик суперигра.png'));");
    assert(ballDeclIdx !== -1 && ballAddIdx !== -1 && closedDeclIdx !== -1, 'ballSpr и closedSpr созданы и добавлены в контейнер стаканчика');
    assert(ballAddIdx < closedDeclIdx,
        '10.10.2026 (по прямому указанию "шарик должен находиться за стаканчиком") — ballSpr добавлен в cup РАНЬШЕ closedSpr, значит рисуется ЗА ним (PIXI addChild-порядок = z-порядок)');
    const declChunk = src.slice(ballDeclIdx, ballAddIdx + 30);
    assert(/ballSpr\.visible = false;/.test(declChunk), 'шарик скрыт по умолчанию (виден только при Куше)');
}

console.log('\nTest 3: общий хелпер _flipCup — поворот 90° по часовой (Math.PI/2) + подъём на 40px, используется и для своего, и для чужого стаканчика');
{
    const start = src.indexOf('const _flipCup = (spr, onDone) => {');
    assert(start !== -1, '_flipCup определён как общий хелпер (не inline-копипаста для каждого стаканчика)');
    const end = src.indexOf('\n                    };', start);
    const body = src.slice(start, end);
    assert(/gsap\.to\(spr, \{/.test(body), 'анимируется параметр spr (общий для своего/чужого стаканчика), не захардкоженный closedSpr');
    assert(/rotation: Math\.PI \/ 2,/.test(body), 'поворот на 90° по часовой стрелке (Math.PI/2 — положительное значение = по часовой в PIXI)');
    assert(/y: spr\.y - 40,/.test(body), 'подъём на 40px (y уменьшается — "вверх" в экранных координатах)');
    assert(/onComplete: onDone,/.test(body), 'колбэк вызывается ПОСЛЕ завершения анимации, не раньше');
    assert(/\} else \{\s*\n\s*spr\.rotation = Math\.PI \/ 2; spr\.y -= 40;\s*\n\s*onDone\(\);\s*\n\s*\}/.test(body),
        'фолбэк без gsap — мгновенный поворот/подъём + немедленный вызов onDone(), не зависает');

    // Оба вызова (свой стаканчик и чужой) используют именно этот хелпер, а не раздельные
    // gsap.to(...)-копипасты, как было до 11.10.2026.
    assert(/_flipCup\(closedSpr, \(\) => \{/.test(src), 'свой стаканчик поднимается через _flipCup(closedSpr, ...)');
    assert(/if\(oClosed\) _flipCup\(oClosed, \(\) => setTimeout\(_finishReveal, REVEAL_PAUSE_MS\)\);/.test(src),
        'чужой стаканчик поднимается через ТОТ ЖЕ _flipCup(oClosed, ...) — не отдельный inline gsap.to');
}

console.log('\nTest 4: _finishReveal — 11.10.2026: больше НЕ содержит ball-reveal логику (вынесена наружу, см. Test 6), только патч/clientRewards/попап');
{
    const start = src.indexOf('const _finishReveal = () => {');
    const end   = src.indexOf('\n                    };', start);
    const body  = src.slice(start, end);
    assert(!/closedSpr\.visible = false;/.test(body), '10.10.2026 (по прямому указанию "не заменяй файл") — закрытый спрайт больше НЕ скрывается при раскрытии');
    assert(!/openSpr\.visible = true;/.test(body), 'открытый спрайт больше не показывается (его и не существует как переменной)');
    // 11.10.2026 (по прямому репорту "попап перекрывает открытие второго стаканчика"): ball-reveal
    // (и res.kush, и res.otherKushIdx) переехал СНАРУЖИ _finishReveal — сама функция теперь
    // вызывается ТОЛЬКО когда все открытия стаканчиков (с паузами) уже реально доиграли.
    assert(!/ballSpr\.visible/.test(body), '_finishReveal больше не трогает ballSpr.visible своего стаканчика — это сделано заранее, перед стартом анимации');
    assert(!/otherKushIdx/.test(body), '_finishReveal больше не содержит otherKushIdx-ветку — чужой стаканчик уже открыт к моменту её вызова');
    assert(/if\(res\.patch\) applyPatch\(res\.patch\);/.test(body), 'патч сервера по-прежнему применяется (логика награды не тронута)');
    // 27.09.2026 (устаревший тест, найдено плановой чисткой): 26.09.2026 (по прямому указанию —
    // "откат правки 25.09.2026, утешительный приз выглядит иначе") сервер перестал выдавать
    // фиксированные 50 рублей под любым обычным стаканчиком — награда теперь берётся из
    // CUP_POOL (см. roulette.php.pickCup()), поэтому попап должен получить реальный тип/сумму,
    // а не только контейнер win. Вызов расширен до 3 аргументов: win, res.type, res.amt.
    assert(/if\(res\.consolation\)\{[\s\S]*?this\._openConsolationPrize\(win, res\.type, res\.amt\);/.test(body), 'утешительный приз — показывает реальный тип/сумму из CUP_POOL, не захардкоженные 50');
    assert(/if\(res\.kush\)\{[\s\S]*?this\._openJackpotPrize\(win, res\.amt\);/.test(body), 'Куш — прежняя логика (попап "Сорванный джекпот"), не изменена');
}

console.log('\nTest 5: серверная логика Куша/Связки/утешительного приза (roulette.php) — регресс-гвард, что она уже реализована, менять не требовалось');
{
    const rouletteSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
    const start = rouletteSrc.indexOf('function pickCup(){');
    assert(start !== -1, 'pickCup() существует');
    const end = rouletteSrc.indexOf('\n    }\n}', start); // pickCup() — последний метод класса Roulette
    const body = rouletteSrc.slice(start, end);
    assert(/if\(\$reward === 'kush'\)\{/.test(body), 'Куш обрабатывается отдельной веткой');
    assert(/'kush' => true,/.test(body), 'ответ помечает исход флагом kush — именно на него реагирует клиентский шарик');
    // 27.09.2026 (устаревший тест, найдено плановой чисткой): 26.09.2026 (по прямому указанию —
    // "откат правки 25.09.2026") фиксированные 50 рублей убраны — обычный исход снова берёт
    // реальную награду из CUP_POOL (разложенную заранее в openMinigame()), см. комментарий
    // прямо над `list($type, $amt) = explode(':', $reward);` в pickCup().
    assert(/list\(\$type, \$amt\) = explode\(':', \$reward\);/.test(body), 'обычный исход берёт реальную награду из CUP_POOL, а не фиксированные 50 рублей');
}

console.log('\nTest 6: 11.10.2026 — таймированная последовательность реveal\'а: шарик появляется В МОМЕНТ старта подъёма (не после), пауза REVEAL_PAUSE_MS между каждым шагом, попап — только в самом конце');
{
    assert(!/const BALL_ROLL_TARGET/.test(src), 'укатывание в фиксированную точку экрана убрано целиком (отменено ещё 10.10.2026)');
    assert(!/ballSpr\.rotation \+ Math\.PI \* 4/.test(src), 'анимация "качения" шарика убрана вместе с укатыванием');

    assert(/cup\._closedSpr = closedSpr;/.test(src) && /cup\._ballSpr = ballSpr;/.test(src),
        'closedSpr/ballSpr каждого стаканчика сохранены НА cup — нужны снаружи замыкания, чтобы открыть ЧУЖОЙ стаканчик по индексу');

    assert(/const REVEAL_PAUSE_MS = 500;/.test(src),
        'пауза между шагами реveal\'а — 500мс ("хотя бы полсекунды, чтобы игрок понял что произошло")');

    const start = src.indexOf('if(res.kush) ballSpr.visible = true;');
    assert(start !== -1, 'ballSpr.visible своего стаканчика переключается ОТДЕЛЬНОЙ строкой перед стартом анимации');
    const end = src.indexOf('\n                }, ()=>{', start);
    const body = src.slice(start, end);

    // "Шарик должен отрисовываться в момент, когда нажатие на стаканчик произошло" — т.е. ballSpr
    // своего стаканчика переключается ДО вызова _flipCup(), а не в его onDone-колбэке.
    const ballToggleIdx = body.indexOf('if(res.kush) ballSpr.visible = true;');
    const flipCallIdx   = body.indexOf('_flipCup(closedSpr, () => {');
    assert(ballToggleIdx !== -1 && flipCallIdx !== -1 && ballToggleIdx < flipCallIdx,
        'ballSpr.visible своего стаканчика переключается ДО старта _flipCup(), не после его завершения');

    assert(/if\(res\.otherKushIdx !== null && res\.otherKushIdx !== undefined && cups\[res\.otherKushIdx\]\)\{/.test(body),
        'внутри onDone первого стаканчика — ветвление по тому же res.otherKushIdx, что и раньше');

    const otherBranchStart = body.indexOf('setTimeout(() => {\n                                const otherCup');
    assert(otherBranchStart !== -1, 'открытие чужого стаканчика обёрнуто в setTimeout (пауза ПЕРЕД его подъёмом — "тут пусто", дать игроку осознать)');
    const otherBranchEnd = body.indexOf('}, REVEAL_PAUSE_MS);', otherBranchStart) + '}, REVEAL_PAUSE_MS);'.length;
    const otherBranch = body.slice(otherBranchStart, otherBranchEnd);
    assert(/}, REVEAL_PAUSE_MS\);$/.test(otherBranch), 'setTimeout чужого стаканчика использует именно REVEAL_PAUSE_MS, не магическое число');

    assert(/const otherCup = cups\[res\.otherKushIdx\];/.test(otherBranch), 'берётся именно ТОТ стаканчик, индекс которого прислал сервер (не текущий i, не угадывается на клиенте)');
    assert(/const oClosed = otherCup\._closedSpr, oBall = otherCup\._ballSpr;/.test(otherBranch), 'читаются спрайты чужого стаканчика через сохранённые на cup ссылки');
    // Та же логика тайминга, что и для своего стаканчика: шарик чужого стаканчика переключается
    // ДО старта его _flipCup(), не после.
    const oBallToggleIdx = otherBranch.indexOf('if(oBall) oBall.visible = true;');
    const oFlipCallIdx   = otherBranch.indexOf('if(oClosed) _flipCup(oClosed,');
    assert(oBallToggleIdx !== -1 && oFlipCallIdx !== -1 && oBallToggleIdx < oFlipCallIdx,
        'ballSpr.visible чужого стаканчика тоже переключается ДО старта его собственного _flipCup()');
    assert(/if\(oClosed\) _flipCup\(oClosed, \(\) => setTimeout\(_finishReveal, REVEAL_PAUSE_MS\)\);/.test(otherBranch),
        'после подъёма чужого стаканчика — снова пауза REVEAL_PAUSE_MS, и только потом _finishReveal (попап)');
    assert(/else setTimeout\(_finishReveal, REVEAL_PAUSE_MS\);/.test(otherBranch),
        'если по какой-то причине у чужого стаканчика нет closedSpr — fallback всё равно не зависает без попапа');

    // Путь "куш выбит сразу, либо куша в раскладке вообще не было" — тоже пауза перед попапом,
    // не мгновенный показ сразу после подъёма своего стаканчика.
    assert(/\} else \{\s*\n\s*\/\/ Куш выбит сразу, либо куша в этой раскладке не было вовсе[\s\S]*?setTimeout\(_finishReveal, REVEAL_PAUSE_MS\);\s*\n\s*\}/.test(body),
        'если otherKushIdx нет (куш у себя или в раскладке его не было) — всё равно REVEAL_PAUSE_MS перед попапом, не мгновенно');
}

console.log('\nTest 7: roulette.php.pickCup() — otherKushIdx вычисляется сервером (не клиентом) и уходит во ВСЕ не-Куш ветки ответа, экономику не трогает');
{
    const phpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
    const start = phpSrc.indexOf('function pickCup(){');
    const end   = phpSrc.indexOf('\n    }\n}', start);
    const body  = phpSrc.slice(start, end);

    assert(/if\(\$reward !== 'kush'\)\{\s*\n\s*\$foundIdx = array_search\('kush', \$cups, true\);/.test(body),
        'otherKushIdx ищется ТОЛЬКО когда сам игрок куш НЕ выбил (иначе он и так виден на месте)');
    assert(/if\(\$foundIdx !== false\) \$otherKushIdx = intval\(\$foundIdx\);/.test(body),
        'array_search честно может вернуть false (куша в этой раскладке вообще не было) — тогда otherKushIdx остаётся null, клиент ничего лишнего не откроет');

    // otherKushIdx должен попасть во ВСЕ 3 не-Куш ветки ответа (keyring-успех, keyring-провал/
    // missed_keyring, обычное утешение) — ветка самого Куша его не содержит (там кладётся ДО неё,
    // но используется только когда reward !== 'kush', так что в kush-ответе явно не фигурирует).
    // Считаем буквальные вхождения "'otherKushIdx' => $otherKushIdx" (не через [^\]]*, который
    // обрывается на первой же вложенной "]" внутри clientRewards-массивов) — должно быть 4:
    // 1 в $debugBase (для error_log) + 3 в самих ok()-ответах (keyring-успех/missed_keyring/
    // утешение).
    const occurrences = (body.match(/'otherKushIdx' => \$otherKushIdx/g) || []).length;
    assert(occurrences === 4, `otherKushIdx передан клиенту во ВСЕХ 3 не-Куш ветках ответа + попадает в $debugBase (найдено вхождений: ${occurrences}, ожидалось 4)`);

    const kushOkIdx = body.indexOf("'type' => 'coins', 'amt' => \$this->KUSH_AMOUNT, 'kush' => true,");
    assert(kushOkIdx !== -1 && !/otherKushIdx/.test(body.slice(kushOkIdx, kushOkIdx + 150)),
        'Куш-ответ НЕ содержит otherKushIdx (бессмысленно — игрок уже видит шарик на месте)');

    // Экономика не трогается: единственное место, где kush_counter/kush_threshold сбрасываются —
    // ветка реального выигрыша (if($reward === 'kush')); вычисление $otherKushIdx стоит строго ДО
    // неё и ничего там не меняет.
    const kushCounterResetIdx = body.indexOf('`kush_counter`=0, `kush_threshold`=');
    const otherKushCalcIdx    = body.indexOf('$otherKushIdx = null;');
    assert(kushCounterResetIdx !== -1 && otherKushCalcIdx !== -1 && otherKushCalcIdx < kushCounterResetIdx,
        '$otherKushIdx вычисляется ДО ветки сброса kush_counter/kush_threshold — чисто визуальная подсказка, не новый способ выиграть/сбросить куш');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

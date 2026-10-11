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

console.log('\nTest 3: анимация переворота — поворот 90° по часовой (Math.PI/2) + подъём на 40px');
{
    // 10.10.2026: anchor сменён с indexOf('if(window.gsap){') на indexOf('gsap.to(closedSpr'),
    // т.к. теперь ЭТО уже не первое вхождение 'if(window.gsap){' в файле — новая ветка укатывания
    // шарика (см. Test 6) тоже начинается с 'if(window.gsap){', но определена РАНЬШЕ по тексту
    // (внутри _finishReveal, который вызывается через onComplete этой самой анимации).
    const closedAnimIdx = src.indexOf('gsap.to(closedSpr, {');
    assert(closedAnimIdx !== -1, 'анимация переворота закрытого стаканчика найдена');
    const start = src.lastIndexOf('if(window.gsap){', closedAnimIdx);
    assert(start !== -1, 'ветка запуска анимации через gsap найдена');
    const end = src.indexOf('} else {', start);
    const body = src.slice(start, end);
    assert(/gsap\.to\(closedSpr, \{/.test(body), 'анимируется ИМЕННО закрытый спрайт (визуально "опрокидывается")');
    assert(/rotation: Math\.PI \/ 2,/.test(body), 'поворот на 90° по часовой стрелке (Math.PI/2 — положительное значение = по часовой в PIXI)');
    assert(/y: closedSpr\.y - 40,/.test(body), 'подъём на 40px (y уменьшается — "вверх" в экранных координатах)');
    assert(/onComplete: _finishReveal,/.test(body), 'фактическое раскрытие происходит ПОСЛЕ завершения анимации, не раньше');
    // Фолбэк без gsap — на случай если библиотека почему-то не загрузилась, раскрытие всё равно происходит.
    const fallbackIdx = src.indexOf('} else {\n                        _finishReveal();');
    assert(fallbackIdx !== -1, 'без gsap раскрытие происходит немедленно (фолбэк, не зависает)');
}

console.log('\nTest 4: _finishReveal — 10.10.2026: больше НЕ подменяет файл, шарик по-прежнему показывается ТОЛЬКО при res.kush, остальная логика (патч/попапы) не изменилась по сути');
{
    const start = src.indexOf('const _finishReveal = () => {');
    const end   = src.indexOf('\n                    };', start);
    const body  = src.slice(start, end);
    assert(!/closedSpr\.visible = false;/.test(body), '10.10.2026 (по прямому указанию "не заменяй файл") — закрытый спрайт больше НЕ скрывается при раскрытии');
    assert(!/openSpr\.visible = true;/.test(body), 'открытый спрайт больше не показывается (его и не существует как переменной)');
    assert(/if\(res\.kush\)\{\s*\n\s*ballSpr\.visible = true;\s*\n\s*\} else if\(res\.otherKushIdx !== null && res\.otherKushIdx !== undefined && cups\[res\.otherKushIdx\]\)\{/.test(body),
        '11.10.2026: при Куше шарик показывается на месте, иначе (else if) — открывается чужой стаканчик по otherKushIdx, если сервер его прислал (см. Test 6)');
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

console.log('\nTest 6: 11.10.2026 — не-Куш исход БОЛЬШЕ НЕ укатывает шарик за пределы стаканчика, вместо этого открывает ДРУГОЙ стаканчик (res.otherKushIdx), в котором куш реально лежал');
{
    assert(!/const BALL_ROLL_TARGET/.test(src), 'укатывание в фиксированную точку экрана убрано целиком (отменено тем же днём, что и введено)');
    assert(!/ballSpr\.rotation \+ Math\.PI \* 4/.test(src), 'анимация "качения" шарика убрана вместе с укатыванием');

    assert(/cup\._closedSpr = closedSpr;/.test(src) && /cup\._ballSpr = ballSpr;/.test(src),
        'closedSpr/ballSpr каждого стаканчика сохранены НА cup — нужны снаружи замыкания, чтобы открыть ЧУЖОЙ стаканчик по индексу');

    const start = src.indexOf('} else if(res.otherKushIdx !== null');
    assert(start !== -1, 'ветка "иначе, если сервер прислал otherKushIdx" найдена');
    const end = src.indexOf('\n                        }', start);
    const body = src.slice(start, end);

    assert(/const otherCup = cups\[res\.otherKushIdx\];/.test(body), 'берётся именно ТОТ стаканчик, индекс которого прислал сервер (не текущий i, не угадывается на клиенте)');
    assert(/const oClosed = otherCup\._closedSpr, oBall = otherCup\._ballSpr;/.test(body), 'читаются спрайты чужого стаканчика через сохранённые на cup ссылки');
    assert(/if\(oBall\) oBall\.visible = true;/.test(body), 'шарик чужого стаканчика становится видимым');
    assert(/rotation: Math\.PI \/ 2, y: oClosed\.y - 40,/.test(body) && /duration: CUP_FLIP_DURATION, ease: 'power2\.out',/.test(body),
        'чужой стаканчик "опрокидывается" ТОЙ ЖЕ анимацией (поворот+подъём, та же длительность), что и свой собственный при раскрытии');
    assert(/\} else \{\s*\n\s*oClosed\.rotation = Math\.PI \/ 2; oClosed\.y -= 40;\s*\n\s*\}/.test(body),
        'фолбэк без gsap — мгновенный поворот/подъём чужого стаканчика, не зависает без анимации');
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

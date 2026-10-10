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
    assert(/const CW = 93, CH = 140;/.test(src) && /const START_X = 216, CUP_Y = 481, STEP_X = 93;/.test(src),
        'один ряд из 9 стаканчиков, ячейка 93×140, шаг 93px, Y=481 (опущено на 50px 10.10.2026)');
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
    assert(/if\(res\.kush\)\{\s*\n\s*ballSpr\.visible = true;\s*\n\s*\} else \{/.test(body),
        '10.10.2026: шарик теперь виден при ЛЮБОМ исходе — при Куше просто показывается, иначе (else) укатывается (см. Test 6)');
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

console.log('\nTest 6: 10.10.2026 — не-Куш исход укатывает шарик в фиксированную точку экрана (130,540), одну и ту же для всех 9 стаканчиков');
{
    assert(/const BALL_ROLL_TARGET = \{ x: 130, y: 540 \};/.test(src),
        'фиксированная цель укатывания задана один раз, не per-стаканчик (координаты даны пользователем 10.10.2026)');

    const start = src.indexOf('} else {\n                            ballSpr.visible = true;');
    assert(start !== -1, 'ветка "иначе" (не-Куш) с показом+укатыванием шарика найдена');
    const end = src.indexOf('\n                        }', start);
    const body = src.slice(start, end);

    assert(/const rollX = BALL_ROLL_TARGET\.x - x, rollY = BALL_ROLL_TARGET\.y - y;/.test(body),
        'цель переведена из абсолютных координат канваса в локальные координаты cup (вычитание текущих x,y стаканчика) — одна и та же абсолютная точка для ЛЮБОГО из 9 стаканчиков');
    assert(/gsap\.to\(ballSpr, \{/.test(body), 'укатывание анимируется через gsap (не мгновенный телепорт), как и переворот стаканчика выше');
    assert(/x: rollX, y: rollY, rotation: ballSpr\.rotation \+ Math\.PI \* 4,/.test(body),
        'анимация — перемещение в целевую точку + вращение (имитация качения, "шарик ВЫКАТЫВАЕТСЯ")');
    assert(/\} else \{\s*\n\s*ballSpr\.x = rollX; ballSpr\.y = rollY;\s*\n\s*\}/.test(body),
        'фолбэк без gsap — мгновенная телепортация в ту же точку, не зависает без анимации');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

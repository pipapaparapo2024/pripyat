/**
 * Test: батч 16.09.2026 (второй) — 4 отдельных бага, репортнутых пользователем по скринам:
 *  1) Текст ачивки (заголовок/описание/очки) центрировался вручную по x — при другой длине
 *     строки съезжало то влево, то вправо. Теперь все три строки центрируются одинаково
 *     через anchor(0.5,0) + общий x + wordWrap(align:center) — не зависит от длины текста.
 *  2) <title> index.html хранил битую кодировку (UTF-8 → misinterpreted как CP1251 →
 *     повторно сохранён как UTF-8 — классическое двойное кодирование). Именно это летело в
 *     превью при VKWebAppShare (fallback, когда VKWebAppShowWallPostBox недоступен и VK берёт
 *     og:* / title самой страницы). Исправлено + добавлены явные og:title/og:description.
 *     Изначально (16.09.2026) исправленный текст был "Припять: Тест". 26.09.2026 (аудит перед
 *     модерацией VK, см. moderation-title-and-retry-limits-fix.test.js) суффикс ": Тест" убран
 *     из <title>/og:title по чек-листу модерации (п.45 — название/описание должны соответствовать
 *     реально запущенной боевой версии) — текущий эталон "Припять" без суффикса, ниже сверяемся
 *     с ним, а не с текстом 16.09.2026.
 *  3) В попапе покупки патрона для ящика (недостаточно тушёнки) не скрывался нижний HUD —
 *     в отличие от точно такого же попапа в obyskat-хэндлере чуть выше, где скрытие уже было.
 *  4) Вся карточка локации была кликабельна (открывала попап локации по тапу куда угодно) —
 *     теперь только кнопка ЗАХВАТИТЬ. Плюс: новые исходники карточек (16.09.2026) имеют разное
 *     нативное разрешение между собой — добавлен явный width/height, чтобы размер на экране
 *     был одинаковым независимо от разрешения конкретного PNG.
 *
 * Run: node tests/achievement-center-share-encoding-yashik-hud-zone-card.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const achSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'achievement.js'), 'utf-8');
const yashSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8');
const zoneSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');
const htmlBytes = fs.readFileSync(path.join(root, '_client', 'development', 'index.html'));

console.log('\nTest 1: попап ачивки — заголовок/описание/очки центрируются одинаково независимо от длины текста');
{
    assert(/const TEXT_CENTER_X\s*=\s*(\d+)/.test(achSrc), 'найдена общая константа TEXT_CENTER_X');
    const centerX = achSrc.match(/const TEXT_CENTER_X\s*=\s*(\d+)/)[1];

    for (const varName of ['titleTxt', 'descTxt', 'scoreTxt']) {
        const re = new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        assert(re.test(achSrc), `${varName} существует в файле`);
        assert(new RegExp(varName + '\\.anchor\\.set\\(0\\.5,\\s*0\\)').test(achSrc),
            `${varName} использует anchor(0.5, 0) — горизонтальное центрирование`);
        assert(new RegExp(varName + '\\.x\\s*=\\s*TEXT_CENTER_X').test(achSrc),
            `${varName}.x привязан к общей TEXT_CENTER_X=${centerX}, а не к своему числу`);
    }

    // wordWrap+align:center — чтобы перенесённые строки ТОЖЕ центрировались, а не только левый край блока
    const styleBlocksOk = ['titleTxt', 'descTxt', 'scoreTxt'].every(v => {
        const idx = achSrc.indexOf('const ' + v + ' = new PIXI.Text');
        const end = achSrc.indexOf('});', idx);
        const block = achSrc.slice(idx, end);
        return /wordWrap:\s*true/.test(block) && /align:\s*'center'/.test(block);
    });
    assert(styleBlocksOk, 'у всех трёх текстов включены wordWrap:true и align:center');

    // Старые фиксированные per-instance scale() — убраны как ненужный костыль под старую схему
    assert(!/titleTxt\.scale\.set/.test(achSrc), 'ручной scale.set() для titleTxt убран (больше не нужен)');
    assert(!/scoreTxt\.scale\.set/.test(achSrc), 'ручной scale.set() для scoreTxt убран (больше не нужен)');
}

console.log('\nTest 2: <title> index.html — корректная кодировка (не двойной UTF-8/CP1251)');
{
    const titleStart = htmlBytes.indexOf(Buffer.from('<title>'));
    const titleEnd   = htmlBytes.indexOf(Buffer.from('</title>'));
    const titleText  = htmlBytes.slice(titleStart + 7, titleEnd).toString('utf-8');

    assert(titleText === 'Припять', `<title> декодируется в читаемый текст (получено: "${titleText}")`);
    // Классические "маркеры" двойного кодирования UTF-8→CP1251→UTF-8 — их не должно быть нигде в title
    assert(!/Р./.test(titleText.slice(0, 2)) || titleText === 'Припять',
        'нет характерных mojibake-байтов РџС.. в начале title');

    const htmlText = htmlBytes.toString('utf-8');
    assert(/<meta property="og:title" content="[^"]+"\/?>|<meta property="og:title" content="[^"]+">/.test(htmlText),
        'добавлен og:title — превью в VK Share больше не зависит только от <title>');
    assert(/<meta property="og:description" content="[^"]+">/.test(htmlText),
        'добавлен og:description для превью ссылки');
}

console.log('\nTest 3: ящик — нижний HUD не появляется на обоих попапах ошибки (обыск и покупка патрона) — 24.09.2026: декларативный pushHud вместо ручного скрытия/показа');
{
    // 24.09.2026 (декларативный ХУД, см. declarative-hud-refactor.test.js): ручное скрытие
    // this.down после каждого _openSidorovichError больше не нужно — пока экран Ящика открыт,
    // его 'yashik' запись на стеке (pushHud) переживает ЛЮБОЙ сторонний restoreHud(), в т.ч.
    // вызванный изнутри _openSidorovichError. Единственная точка входа/выхода — pushHud/popHud
    // при открытии/закрытии самого экрана Ящика, не при каждом попапе ошибки внутри него.
    assert(yashSrc.includes("this.pushHud('yashik', {});"), 'открытие экрана Ящика регистрирует себя в стеке (пустые opts = дефолт, оба ХУДа видны)');
    assert(!/if\(this\.down\) this\.down\.visible = false;/.test(yashSrc), 'старое ручное скрытие this.down нигде в yashik.js не осталось');

    // Регресс-гварда: единственное место, которое возвращает HUD обратно — кнопка выхода с экрана.
    const exitBlockIdx = yashSrc.indexOf("exitBtn.on('pointerdown'");
    const exitBlock = yashSrc.slice(exitBlockIdx, exitBlockIdx + 200);
    assert(/this\.popHud\('yashik'\);/.test(exitBlock),
        'кнопка выхода из ящика снимает регистрацию через popHud — HUD того, что было под ним, "проступает" сам');
}

console.log('\nTest 4: карточка локации кликабельна только кнопкой ЗАХВАТИТЬ, слот единый на все 5 локаций');
{
    // Блок создания карточки (spr) — от создания текстуры до Кнопки ЗАХВАТИТЬ
    const cardStart = zoneSrc.indexOf('const tex = PIXI.Texture.from(loc.file);');
    const cardEnd   = zoneSrc.indexOf('// Кнопка ЗАХВАТИТЬ');
    const cardBlock = zoneSrc.slice(cardStart, cardEnd);

    assert(!/spr\.interactive\s*=\s*true/.test(cardBlock), 'карточка (spr) больше не interactive');
    assert(!/spr\.on\(.pointerdown./.test(cardBlock), 'у карточки (spr) больше нет обработчика pointerdown');
    // 18.09.2026 (позже этого батча, по прямому указанию): cover-fit+маска сами стали багом —
    // невидимая маска "упиралась в стену" при попытке подвинуть карточку через редактор
    // позиций. Убраны полностью — карточка вставляется в нативном размере файла, точный
    // масштаб/позиция под слот снимаются вручную через мышиный resize в редакторе и
    // задаются именованными константами CARD_OFFSET_X/Y/CARD_SCALE.
    assert(!/cardMask/.test(cardBlock), 'маска (cardMask) полностью убрана');
    // 22.09.2026: единый CARD_SCALE для всех 5 карточек вызывал обрезку Агропром.png (native
    // выше остальных 4) маской карусели — заменено на per-текстурную нормализацию к CARD_TARGET_H
    // (см. zone-card-per-texture-scale-normalization.test.js), не на per-location override-таблицу.
    // 22.09.2026 (повторная правка того же дня, по прямому указанию — "сделай все карточки
    // локаций одним размером"): нормализация только высоты оставляла разную ШИРИНУ (разное
    // соотношение сторон исходников) — заменено на фиксацию width И height (CARD_TARGET_W/H).
    assert(/const _applyCardScale = \(\) => \{ spr\.width = CARD_TARGET_W; spr\.height = CARD_TARGET_H; \};/.test(cardBlock),
        'масштаб — фиксированные width И height (CARD_TARGET_W/H), не пропорциональный scale от одной высоты');

    // Кнопка ЗАХВАТИТЬ — по-прежнему открывает попап локации по клику; 21.09.2026 (карусель
    // по одной локации): interactive теперь ДИНАМИЧЕСКИЙ (только у текущей активной карточки,
    // см. _zoneGoToIndex) — изначально false, не жёстко true, как было при постраничном режиме.
    const btnStart = zoneSrc.indexOf('// Кнопка ЗАХВАТИТЬ');
    const btnEnd   = zoneSrc.indexOf('locGroups.push');
    const btnBlock = zoneSrc.slice(btnStart, btnEnd);
    assert(/capBtn\.interactive = false; capBtn\.buttonMode = false;/.test(btnBlock),
        'кнопка ЗАХВАТИТЬ изначально НЕ interactive (включается точечно для активной карточки в _zoneGoToIndex)');
    assert(/capBtn\.on\(.pointerdown.,[\s\S]*?_openLocationPopup/.test(btnBlock),
        'кнопка ЗАХВАТИТЬ по-прежнему открывает попап локации по клику');
    assert(/g\.capBtn\.interactive = active; g\.capBtn\.buttonMode = active;/.test(zoneSrc),
        '_zoneGoToIndex включает interactive только у капБтБ активного индекса, выключает у остальных');

    // LOCATIONS — 5 локаций, единый слот на всех (нет больше per-location cardW/cardH)
    const locBlock = zoneSrc.slice(zoneSrc.indexOf('const LOCATIONS = ['), zoneSrc.indexOf('const TOTAL_LOCS'));
    const locEntries = [...locBlock.matchAll(/\{ file:[^}]+\}/g)];
    assert(locEntries.length === 5, `в LOCATIONS 5 локаций (найдено ${locEntries.length})`);
    assert(!/cardW/.test(locBlock) && !/cardH/.test(locBlock),
        'LOCATIONS больше не хранит per-location cardW/cardH — слот теперь один общий (SLOT_CARD_W/H)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

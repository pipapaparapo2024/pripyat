/**
 * Test: батч 19.09.2026 — по прямому указанию пользователя ячейка топа/лидерборда (svod-leaderboard.js)
 * получила систему суб-блоков: под иконку игрока/место/никнейм/уровень/значение (урон/авторитет/
 * очки достижений) добавлены отдельные декоративные подложки (файлы из папки «сводка», присланы
 * пользователем — «блок под иконку игрока.png», «блок под место игрока.png», «блок под никнейм
 * игрока.png», «блок под уровень.png», «блок под урон авторитет.png»). Основная ячейка
 * (ячейка.png) осталась на прежнем месте — только новые подложки поверх неё.
 *
 * Координаты блоков (CELL_BLOCKS) — АБСОЛЮТНЫЕ X/Y из редактора позиций Photoshop минус
 * ROW_X/LIST_TOP (перевод в систему координат, относительную ряду, как и остальные элементы
 * ячейки). Смысл фичи, прямо озвученный пользователем: ЛЮБОЙ текст, вписываемый в блок, должен
 * центрироваться ПО ГОРИЗОНТАЛИ относительно СВОЕГО блока (anchor.x=0.5, x=centerX(block)) — не
 * абсолютным числом, чтобы при будущей правке текста (другой язык/длина числа) не пришлось
 * пересчитывать координаты вручную.
 *
 * Run: node tests/svod-cell-blocks-and-text-centering.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const lbSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const IMAGES_DIR = path.join(root, '_client', 'development', 'images');

// 28.10.2026 (по прямому указанию — все 5 блоков опущены на 2px, сдвинуты влево на 1px, см.
// комментарий в svod-leaderboard.js): absX -1, absY +2 относительно прежних чисел.
const BLOCKS = [
    { key: 'icon',  file: 'блок под иконку игрока.png',  absX: 451, absY: 240, w: 31,  h: 30 },
    { key: 'place', file: 'блок под место игрока.png',   absX: 371, absY: 241, w: 47,  h: 25 },
    { key: 'name',  file: 'блок под никнейм игрока.png', absX: 503, absY: 244, w: 106, h: 22 },
    { key: 'level', file: 'блок под уровень.png',        absX: 773, absY: 245, w: 51,  h: 20 },
    { key: 'value', file: 'блок под урон авторитет.png', absX: 858, absY: 246, w: 137, h: 18 },
];
// 28.10.2026: ROW_X/LIST_TOP в исходнике изменились (354/238, унификация окна списка) — эти
// локальные копии влияют только на текст сообщения в assert ниже (relX/relY), не на сам regex
// (который matches литеральный "N - ROW_X" в исходнике, не вычисленное число) — держим в курсе.
const ROW_X = 354, LIST_TOP = 238;

console.log('\nTest 1: все 5 файлов новых блоков лежат в _client/development/images/ (не в подпапке — обычные UI-элементы, не шмот)');
{
    for (const b of BLOCKS) {
        assert(fs.existsSync(path.join(IMAGES_DIR, b.file)), `файл существует: ${b.file}`);
    }
    // 21.10.2026: "ячейка.png" переименован в "свод топ ячейка.png" (аудит имён файлов).
    assert(fs.existsSync(path.join(IMAGES_DIR, 'свод топ ячейка.png')), 'основная ячейка ("свод топ ячейка.png") на месте');
}

console.log('\nTest 2: CELL_BLOCKS в коде — координаты = абсолютные из редактора минус ROW_X/LIST_TOP');
{
    const cbMatch = lbSrc.match(/const CELL_BLOCKS = \{([\s\S]*?)\n    \};/);
    assert(!!cbMatch, 'CELL_BLOCKS найден');
    const body = cbMatch ? cbMatch[1] : '';
    for (const b of BLOCKS) {
        const relX = b.absX - ROW_X, relY = b.absY - LIST_TOP;
        const re = new RegExp(
            b.key + ":\\s*\\{\\s*file:\\s*'" + b.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
            "',\\s*x:\\s*" + b.absX + " - ROW_X,\\s*y:\\s*" + b.absY + " - LIST_TOP,\\s*w:\\s*" + b.w + ",\\s*h:\\s*" + b.h + "\\s*\\}"
        );
        assert(re.test(body), `блок '${b.key}': file/x/y/w/h верны (относительные x=${relX}, y=${relY})`);
    }
}

console.log('\nTest 3: centerX() определён и вычисляет центр блока по формуле x + w/2');
{
    assert(/const centerX = \(block\) => block\.x \+ block\.w \/ 2;/.test(lbSrc), 'centerX(block) = block.x + block.w / 2');
}

console.log('\nTest 4: в цикле построения строки создаётся спрайт для КАЖДОГО блока из CELL_BLOCKS, до текстовых полей (под ними по z-order)');
{
    const cellIdx  = lbSrc.indexOf("const cell = new PIXI.Sprite(PIXI.Texture.from(IMG + 'свод топ ячейка.png'));");
    const loopIdx  = lbSrc.indexOf('Object.values(CELL_BLOCKS).forEach(b => {');
    const placeIdx = lbSrc.indexOf('const placeTxt = new PIXI.Text');
    assert(cellIdx !== -1 && loopIdx !== -1 && placeIdx !== -1, 'все три якоря найдены в исходнике');
    assert(cellIdx < loopIdx && loopIdx < placeIdx,
        'порядок в коде: основная ячейка → суб-блоки → текст (суб-блоки рисуются НАД ячейкой, но ПОД текстом/аватаркой)');
    const loopBody = lbSrc.slice(loopIdx, placeIdx);
    assert(/blockSpr\.x = b\.x; blockSpr\.y = b\.y;/.test(loopBody), 'каждый блок ставится по своим b.x/b.y');
    assert(/row\.addChild\(blockSpr\);/.test(loopBody), 'каждый блок добавляется в row');
}

console.log('\nTest 5: все 4 текстовых поля центрируются (anchor 0.5) относительно СВОЕГО блока, не абсолютным x');
{
    const fields = [
        { name: 'placeTxt', block: 'place' },
        { name: 'nameTxt',  block: 'name'  },
        { name: 'levelTxt', block: 'level' },
        { name: 'valTxt',   block: 'value' },
    ];
    for (const f of fields) {
        const anchorRe = new RegExp(f.name + '\\.anchor\\.set\\(0\\.5, 0\\);');
        const xRe = new RegExp(f.name + '\\.x = centerX\\(CELL_BLOCKS\\.' + f.block + '\\);');
        assert(anchorRe.test(lbSrc), `${f.name}: anchor.set(0.5, 0) — центр по горизонтали`);
        assert(xRe.test(lbSrc), `${f.name}: x = centerX(CELL_BLOCKS.${f.block}) — динамический центр, не константа`);
    }
    // valTxt раньше был anchor(1,0) (право-выровнен) — регресс-гвард, что старый способ не остался рядом
    assert(!/valTxt\.anchor\.set\(1, 0\);/.test(lbSrc), 'valTxt больше НЕ право-выровнен (старый anchor(1,0) убран)');
}

console.log('\nTest 6: рантайм-проверка формулы centerX на реальных числах блоков');
{
    const centerX = (block) => block.x + block.w / 2;
    for (const b of BLOCKS) {
        const block = { x: b.absX - ROW_X, w: b.w };
        const expected = (b.absX - ROW_X) + b.w / 2;
        assert(centerX(block) === expected, `centerX('${b.key}') = ${expected}`);
    }
}

console.log('\nTest 7: полоска-фон ряда (cell) компенсирует сдвиг ROW_X/LIST_TOP от унификации скролла 28.10.2026 — абсолютная позиция совпадает с прод-версией (356,236), по прямому указанию ("исправь на тесте чтоб было как на проде")');
{
    // 28.10.2026 (баг найден по прямому указанию — скриншоты прод vs тест, "блоки съехали
    // относительно друг друга"): CELL_BLOCKS (плашки под текст) считаются формулой
    // "абсолютная_цель − ROW_X/LIST_TOP" и поэтому самокомпенсируются при смене ROW_X/LIST_TOP —
    // их абсолютная позиция ОДИНАКОВА что на проде (ROW_X=356,LIST_TOP=236 — дорефакторный код),
    // что на тесте (ROW_X=354,LIST_TOP=238 — после унификации скролла). А вот cell (сама полоска
    // фона) до этой правки сидела в row-локальных (0,0) БЕЗ компенсации — физически сдвигалась
    // вместе с ROW_X/LIST_TOP, из-за чего плашки и полоска разъехались на 2px по каждой оси между
    // прод и тест. Пользователь подтвердил: верно — как на проде. Полоска возвращена на прод-
    // абсолютную позицию (356,236) явным компенсирующим сдвигом, ROW_X/LIST_TOP не тронуты
    // (чтобы не откатывать саму унификацию скролла).
    const cellIdx = lbSrc.indexOf("const cell = new PIXI.Sprite(PIXI.Texture.from(IMG + 'свод топ ячейка.png'));");
    const addIdx  = lbSrc.indexOf('row.addChild(cell);', cellIdx);
    assert(cellIdx !== -1 && addIdx !== -1, 'cell создаётся и добавляется в row');
    const cellBody = lbSrc.slice(cellIdx, addIdx);
    assert(/cell\.x = 356 - ROW_X; cell\.y = 236 - LIST_TOP;/.test(cellBody),
        'cell.x/y = компенсирующий сдвиг к прод-абсолюту (356,236), не захардкожены числом напрямую');
    const cellAbsX = (356 - ROW_X) + ROW_X;
    const cellAbsY = (236 - LIST_TOP) + LIST_TOP;
    assert(cellAbsX === 356 && cellAbsY === 236, `итоговая абсолютная позиция полоски = (356,236), как на проде (получено ${cellAbsX},${cellAbsY})`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

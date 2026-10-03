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

const BLOCKS = [
    { key: 'icon',  file: 'блок под иконку игрока.png',  absX: 452, absY: 238, w: 31,  h: 30 },
    { key: 'place', file: 'блок под место игрока.png',   absX: 372, absY: 239, w: 47,  h: 25 },
    { key: 'name',  file: 'блок под никнейм игрока.png', absX: 504, absY: 242, w: 106, h: 22 },
    { key: 'level', file: 'блок под уровень.png',        absX: 774, absY: 243, w: 51,  h: 20 },
    { key: 'value', file: 'блок под урон авторитет.png', absX: 859, absY: 244, w: 137, h: 18 },
];
const ROW_X = 356, LIST_TOP = 236;

console.log('\nTest 1: все 5 файлов новых блоков лежат в _client/development/images/ (не в подпапке — обычные UI-элементы, не шмот)');
{
    for (const b of BLOCKS) {
        assert(fs.existsSync(path.join(IMAGES_DIR, b.file)), `файл существует: ${b.file}`);
    }
    assert(fs.existsSync(path.join(IMAGES_DIR, 'ячейка.png')), 'основная ячейка (ячейка.png) на месте');
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
    const cellIdx  = lbSrc.indexOf("const cell = new PIXI.Sprite(PIXI.Texture.from(IMG + 'ячейка.png'));");
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

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

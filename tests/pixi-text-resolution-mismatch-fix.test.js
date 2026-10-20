/**
 * Test: 17.10.2026, по прямому указанию — репорт "буквы в мелком тексте визуально разного
 * размера, особенно П/У/Р". Корень: PIXI.Text рисует текст в канвас ОДИН раз с фиксированной
 * PIXI.settings.RESOLUTION (нигде в проекте раньше не переопределялась → дефолт 1), а
 * scene.renderer.resolution пересчитывается динамически под физический размер канваса и почти
 * никогда не равен 1 (см. index.js.resize()) — GPU растягивает/сжимает уже готовую растровую
 * картинку букв под чужую пиксельную сетку, тонкие буквы страдают заметнее.
 *
 * Этот же симптом уже один раз точечно чинили 08.10.2026 на одной карточке достижений
 * (svod-achievements.js, убрали scale.set(0.965) с текста) — этот тест проверяет системный
 * фикс в index.js, который поднимает базовую resolution ВСЕГО нового текста/Graphics разом,
 * не трогая 222 места создания PIXI.Text по отдельности.
 *
 * Run: node tests/pixi-text-resolution-mismatch-fix.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const indexJs = fs.readFileSync(path.join(root, '_client', 'src', 'index.js'), 'utf-8');

console.log('\nTest 1: PIXI.settings.RESOLUTION выставляется явно, с нижней границей 2 и верхней 3');
{
    assert(/PIXI\.settings\.RESOLUTION\s*=\s*Math\.min\(3,\s*Math\.max\(2,\s*window\.devicePixelRatio \|\| 1\)\)/.test(indexJs),
        'формула клэмпит devicePixelRatio в диапазон [2, 3]');
}

console.log('\nTest 2: статическая строка (подстраховка ДО первого resize()) идёт ПОСЛЕ PIXI.settings.ROUND_PIXELS');
{
    // 19.10.2026 (по прямому указанию, повторный репорт "буквы разного размера" — теперь на
    // НОВОМ контенте, созданном после старта игры): добавлено ВТОРОЕ место — внутри resize()
    // (см. Test 2b ниже), которое синхронизирует RESOLUTION с реальным targetRes при каждом
    // resize, а не только статической догадкой по dpr при загрузке. Эта строка (старая,
    // статическая) по-прежнему остаётся как подстраховка ДО самого первого resize() — ищем её
    // СПЕЦИФИЧНО по формуле с devicePixelRatio, а не просто "первое вхождение" (которое теперь
    // находится в resize(), появляющемся раньше в файле).
    const roundIdx = indexJs.indexOf('PIXI.settings.ROUND_PIXELS = true;');
    const staticResIdx = indexJs.indexOf('PIXI.settings.RESOLUTION = Math.min(3, Math.max(2, window.devicePixelRatio || 1));');
    assert(roundIdx > -1 && staticResIdx > -1 && staticResIdx > roundIdx,
        'статическая RESOLUTION (по devicePixelRatio) выставляется после ROUND_PIXELS в том же файле');
}

console.log('\nTest 2b: внутри resize() RESOLUTION синхронизируется с реальным targetRes (19.10.2026)');
{
    const resizeIdx = indexJs.indexOf('if(window.scene && scene.renderer){');
    const resizeEnd = indexJs.indexOf('\n\t}', resizeIdx);
    const block = indexJs.slice(resizeIdx, resizeEnd);
    assert(/PIXI\.settings\.RESOLUTION = Math\.min\(4, Math\.max\(2, targetRes \+ 0\.5\)\);/.test(block),
        'RESOLUTION пересчитывается от targetRes на каждом resize(), а не только статически при загрузке');
}

console.log('\nTest 3: PIXI.settings.RESOLUTION выставляется РОВНО в двух местах во всём _client/src (статика + resize-синхронизация)');
{
    const gameDir = path.join(root, '_client', 'src');
    function walk(dir) {
        let out = [];
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, f.name);
            if (f.isDirectory()) out = out.concat(walk(p));
            else if (f.name.endsWith('.js')) out.push(p);
        }
        return out;
    }
    let count = 0;
    for (const file of walk(gameDir)) {
        const content = fs.readFileSync(file, 'utf-8');
        const matches = content.match(/PIXI\.settings\.RESOLUTION\s*=/g);
        if (matches) count += matches.length;
    }
    assert(count === 2, `ровно 2 места выставляют PIXI.settings.RESOLUTION — статика + resize() (найдено: ${count})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

/**
 * Test: 18.10.2026 (баг найден по прямому указанию — "в верхнем худе должен быть Bebas Neue
 * Pro Middle, но там скорее всего дефолтные шрифты браузера").
 *
 * Корень: index.html держит специальный скрытый блок `<div class="font_preload">` — набор
 * невидимых <span style="font-family: 'Имя', Имя;"></span> на КАЖДЫЙ кастомный шрифт проекта.
 * Это единственный механизм, который реально заставляет браузер СКАЧАТЬ файл @font-face —
 * PixiJS рисует текст через <canvas>, а не настоящий DOM-текст, поэтому сам по себе canvas.font
 * = "...Имя Шрифта..." браузер не триггерит загрузку: без хотя бы одного настоящего DOM-
 * элемента, реально запросившего семейство шрифта, @font-face может никогда не активироваться,
 * и весь текст молча рисуется дефолтным системным шрифтом — без единой ошибки в консоли.
 *
 * "Bebas Neue Pro Middle" добавлен в fonts.css 18.10.2026 (верхний HUD — ник/уровень/энергия/
 * рубли/тушёнка/сухари), но НЕ был добавлен в font_preload — классический пропуск при
 * добавлении нового элемента в список, который нужно вести параллельно в двух местах
 * (fonts.css и font_preload), а не один раз. Остальные 23 шрифта проекта такую пару уже имеют.
 *
 * Run: node tests/bebas-neue-pro-middle-font-preload-missing.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, '_client', 'development', 'index.html'), 'utf-8');
const fontsCss = fs.readFileSync(path.join(root, '_client', 'development', 'fonts', 'fonts.css'), 'utf-8');

console.log('\nTest 1: "Bebas Neue Pro Middle" объявлен в fonts.css (@font-face)');
{
    assert(/font-family:\s*Bebas Neue Pro Middle;/.test(fontsCss), '@font-face для Bebas Neue Pro Middle присутствует');
    assert(/src:\s*url\(BebasNeuePro-Middle\.ttf\);/.test(fontsCss), 'путь к .ttf-файлу указан');
}

console.log('\nTest 2: "Bebas Neue Pro Middle" присутствует в font_preload index.html (реально триггерит загрузку)');
{
    const divStart = html.indexOf('class="font_preload"');
    assert(divStart > -1, 'блок font_preload найден в index.html');
    const divEnd = html.indexOf('</div>', divStart);
    const divBody = html.slice(divStart, divEnd);
    assert(/font-family:\s*'Bebas Neue Pro Middle',\s*Bebas Neue Pro Middle;/.test(divBody),
        'span с font-family: Bebas Neue Pro Middle есть внутри font_preload — без него @font-face мог не активироваться');
}

console.log('\nTest 3: каждый @font-face из fonts.css имеет парный span в font_preload (регресс-страховка —');
console.log('        не только для Bebas Neue Pro Middle, но и на будущее, если кто-то добавит новый шрифт)');
{
    const fontNames = [...fontsCss.matchAll(/font-family:\s*'?([^;'\n]+?)'?;/g)].map(m => m[1].trim());
    assert(fontNames.length >= 20, `нашли разумное число шрифтов в fonts.css (${fontNames.length})`);

    const divStart = html.indexOf('class="font_preload"');
    const divEnd = html.indexOf('</div>', divStart);
    const divBody = html.slice(divStart, divEnd);

    const missing = fontNames.filter(name => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Второе вхождение имени в span иногда в кавычках ('Имя'), иногда без (Имя) —
        // оба варианта реально существуют в текущем файле, оба валидны для браузера.
        const re = new RegExp(`font-family:\\s*'${escaped}',\\s*'?${escaped}'?`);
        return !re.test(divBody);
    });
    assert(missing.length === 0, missing.length === 0
        ? `все ${fontNames.length} шрифтов из fonts.css имеют span в font_preload`
        : `НЕ хватает span в font_preload для: ${missing.join(', ')}`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 28.10.2026 (по прямому указанию — "проверь во всем проекте есть ли такая же проблема
 * в том что шрифты не успевают загружаться").
 *
 * Два РАЗНЫХ бага одного общего класса ("кастомный шрифт выглядит как системный fallback")
 * уже встречались в проекте:
 *
 * 1. 18.10.2026 — "Bebas Neue Pro Middle" был объявлен в fonts.css (@font-face), но забыли
 *    добавить в <div class="font_preload"> index.html — единственный механизм, реально
 *    заставляющий браузер СКАЧАТЬ файл шрифта (PixiJS рисует текст через <canvas>, не через
 *    настоящий DOM-текст — сам по себе canvas.font не триггерит загрузку @font-face).
 *    См. tests/bebas-neue-pro-middle-font-preload-missing.test.js.
 *
 * 2. 28.10.2026 — обратный случай: 'Bebas Neue Pro' (без суффикса) использовался как
 *    fontFamily в game2048.js/game2048-top-popup.js, но НИКОГДА не был объявлен в fonts.css
 *    вообще — ни @font-face, ни font_preload. Это не гонка загрузки, а опечатка в имени
 *    семейства с момента создания фичи 26.10.2026 (правильное имя — 'Bebas Neue Pro Middle',
 *    уже используется для того же визуального стиля в верхнем HUD). Текст был ОБРЕЧЕН всегда
 *    рисоваться системным fallback — document.fonts.check для несуществующего имени никогда
 *    не становится true, поэтому ошибочно добавленный document.fonts.ready.then(retry) по
 *    этому багу класса 1 зациклился бы НАВСЕГДА, так и не построив экран.
 *
 * Этот файл — автоматический проход по ВСЕМУ проекту сразу по трём направлениям, чтобы
 * ни один из двух багов не мог повториться незамеченным в будущем:
 *   A. fonts.css (@font-face) и font_preload (index.html) содержат ТОЧНО одинаковый набор
 *      имён семейств (ловит баг класса 1 — "объявлен, но не преloaded", и наоборот).
 *   B. Каждое буквальное значение fontFamily, встречающееся в _client/src/**\/*.js, либо
 *      системный шрифт (Arial/Arial Narrow/sans-serif — всегда доступны браузеру, не
 *      требуют @font-face), либо присутствует в наборе fonts.css (ловит баг класса 2 —
 *      "используется, но нигде не зарегистрирован").
 *
 * Run: node tests/font-family-registration-consistency.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const fontsCss = fs.readFileSync(path.join(root, '_client', 'development', 'fonts', 'fonts.css'), 'utf-8');
const html = fs.readFileSync(path.join(root, '_client', 'development', 'index.html'), 'utf-8');

// Системные шрифты браузера — не требуют @font-face/font_preload по определению.
const SYSTEM_SAFE = new Set(['Arial', 'Arial Narrow', 'sans-serif']);

function extractCssFamilies(src) {
    const out = new Set();
    const faceRe = /@font-face\s*\{[^}]*?font-family:\s*'?([^;'"]+?)'?;/gs;
    let m;
    while ((m = faceRe.exec(src))) out.add(m[1].trim());
    return out;
}

function extractPreloadFamilies(src) {
    const start = src.indexOf('font_preload');
    const end = src.indexOf('</div>', start);
    const block = src.slice(start, end);
    const out = new Set();
    const spanRe = /font-family:\s*'([^']+)'/g;
    let m;
    while ((m = spanRe.exec(block))) out.add(m[1].trim());
    return out;
}

function walkJsFiles(dir, out) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walkJsFiles(full, out);
        else if (name.endsWith('.js')) out.push(full);
    }
}

function extractUsedFamilies(files) {
    const out = new Set();
    const litRe = /fontFamily\s*:\s*'([^']+)'/g;
    for (const f of files) {
        const src = fs.readFileSync(f, 'utf-8');
        let m;
        while ((m = litRe.exec(src))) out.add(m[1].trim());
    }
    return out;
}

const cssFamilies = extractCssFamilies(fontsCss);
const preloadFamilies = extractPreloadFamilies(html);

console.log('\nTest A: fonts.css (@font-face) и index.html (font_preload) содержат одинаковый набор имён семейств');
{
    assert(cssFamilies.size > 20, `fonts.css реально распарсился (нашлось ${cssFamilies.size} @font-face, ожидалось > 20)`);
    assert(preloadFamilies.size > 20, `font_preload реально распарсился (нашлось ${preloadFamilies.size} span, ожидалось > 20)`);

    const onlyInCss = [...cssFamilies].filter(f => !preloadFamilies.has(f));
    const onlyInPreload = [...preloadFamilies].filter(f => !cssFamilies.has(f));

    assert(onlyInCss.length === 0,
        `каждый @font-face из fonts.css имеет span в font_preload (иначе шрифт не загрузится до первого использования)` +
        (onlyInCss.length ? ` — ПРОПУЩЕНЫ: ${onlyInCss.join(', ')}` : ''));
    assert(onlyInPreload.length === 0,
        `каждый span font_preload соответствует реальному @font-face в fonts.css (иначе preload бессмыслен)` +
        (onlyInPreload.length ? ` — ЛИШНИЕ: ${onlyInPreload.join(', ')}` : ''));
}

const jsFiles = [];
walkJsFiles(path.join(root, '_client', 'src'), jsFiles);
const usedFamilies = extractUsedFamilies(jsFiles);

console.log(`\nTest B: каждое fontFamily, используемое в коде (_client/src/**/*.js, найдено ${usedFamilies.size} уникальных значений), либо системный шрифт, либо зарегистрировано в fonts.css`);
{
    const unresolved = [...usedFamilies].filter(f => {
        const first = f.split(',')[0].trim();
        if (SYSTEM_SAFE.has(first)) return false;
        return !cssFamilies.has(first);
    });
    assert(unresolved.length === 0,
        'нет fontFamily-значений, ссылающихся на несуществующий @font-face' +
        (unresolved.length ? ` — ОБРЫВ: ${unresolved.join(' | ')}` : ''));

    // Явная защита конкретно от повторения бага 28.10.2026 — "Bebas Neue Pro" без суффикса
    // не должен появиться снова ни в одном файле проекта.
    assert(!usedFamilies.has('Bebas Neue Pro'),
        '"Bebas Neue Pro" (без суффикса Middle/Bold) нигде не используется как fontFamily');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else { console.error(`❌ ${failed} test(s) failed, ${passed} passed`); process.exit(1); }

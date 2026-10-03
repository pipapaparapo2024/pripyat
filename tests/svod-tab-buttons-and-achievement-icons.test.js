/**
 * Test: 18.09.2026 — три правки экрана «Сводка» / вкладки «Топ по достижениям»:
 *
 *  1) Кнопки главных вкладок (топ по урону / топ по достижениям) — активная и пассивная
 *     картинки рисуются ОДНИМ спрайтом с anchor(0.5,0.5) в общей точке (svod.js уже так
 *     делал), но у 'урону' активная была 155×78, пассивная 154×69 (на 9px выше) — при общем
 *     anchor-центре это и давало "прыжок"/лишнее место сверху-снизу при переключении
 *     состояний. Прозрачных полей в файлах НЕ было (bbox = весь холст) — проблема была в
 *     самих физических размерах картинок, а не в позиционировании. Исправлено ресайзом
 *     активной картинки до размера пассивной (лишнего контента не обрезано, только лёгкое
 *     сжатие).
 *
 *  2) Текст на карточках «Мои достижения» — карточка 'кароточка достижений.png' светлый
 *     пергамент, а текст был светлый (#e8d9b8/#b8a888) — почти нечитаем. Цвет #1a1c1c снят
 *     пользователем 18.09.2026 напрямую в Photoshop из достиги.psd.
 *
 *  3) iface._achievementIconFor() — раньше не существовала вообще (эмодзи 🏆-заглушка в
 *     svod-achievements.js). Реализована с маппингом category → файл из присланной папки
 *     картинки достижений (скопированы в _client/development/images/achievements/).
 *
 * Run: node tests/svod-tab-buttons-and-achievement-icons.test.js
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root   = path.join(__dirname, '..');
const IMAGES = path.join(root, '_client', 'development', 'images');
const ACH_DIR = path.join(IMAGES, 'achievements');

function pngSize(file){
    // Читаем ширину/высоту прямо из IHDR-чанка PNG (байты 16-24) — без внешних зависимостей.
    const buf = fs.readFileSync(file);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

console.log('\nTest 1: активная и пассивная картинки главных вкладок теперь одного размера');
{
    const pairs = [
        ['кнопка топ по урону актив.png',      'кнопка топ по урону пассив.png'],
        ['кнопка топ по достижениям актив.png','кнопка топ по достижения пассив.png'],
    ];
    pairs.forEach(([active, passive]) => {
        const a = pngSize(path.join(IMAGES, active));
        const p = pngSize(path.join(IMAGES, passive));
        assert(a.w === p.w && a.h === p.h,
            `${active} (${a.w}x${a.h}) совпадает по размеру с ${passive} (${p.w}x${p.h}) — иначе "прыжок" при anchor-центрировании`);
    });
}

console.log('\nTest 2: текст карточки достижений — тёмный (#1a1c1c) на светлом пергаменте, не старый светлый');
{
    const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');
    assert(!/fill:'#e8d9b8'/.test(src), 'старый светлый цвет названия (#e8d9b8) убран');
    assert(!/fill:'#b8a888'/.test(src), 'старый светлый цвет описания (#b8a888) убран');
    const nameMatch = src.match(/const nameTxt = new PIXI\.Text\(''.\s*\{[^}]*fill:'(#[0-9a-f]+)'/s);
    const descMatch = src.match(/const descTxt = new PIXI\.Text\(''.\s*\{[^}]*fill:'(#[0-9a-f]+)'/s);
    assert(!!nameMatch && nameMatch[1] === '#1a1c1c', 'nameTxt.fill === #1a1c1c (снято из достиги.psd)');
    assert(!!descMatch && descMatch[1] === '#1a1c1c', 'descTxt.fill === #1a1c1c (снято из достиги.psd)');
}

console.log('\nTest 3: iface._achievementIconFor() реализована и покрывает все 28 категорий достижений');
{
    const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-achievements.js'), 'utf-8');
    assert(/proto\._achievementIconFor = function\(a\)\{/.test(src), '_achievementIconFor реализована (раньше отсутствовала)');

    const achSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'achievements.js'), 'utf-8');
    const cats = [...new Set([...achSrc.matchAll(/cat:\s*'([a-z_]+)'/g)].map(m => m[1]))];
    assert(cats.length === 28, 'achievements.js содержит 28 уникальных категорий (регресс-гвард — если стало больше/меньше, ICON_MAP надо пересмотреть)');

    // Каждая категория должна либо иметь запись в ICON_MAP, либо осознанно попадать в фолбэк
    // (bp/stash/meta — см. комментарий в исходнике, для них нет отдельной картинки по смыслу).
    const EXPECTED_FALLBACK = ['bp', 'stash', 'meta'];
    cats.forEach(cat => {
        const re = new RegExp(`\\b${cat}:\\s*'([^']+\\.png)'`);
        const m = src.match(re);
        if(EXPECTED_FALLBACK.includes(cat)){
            assert(!m, `категория "${cat}" осознанно без своей картинки — использует общий фолбэк 'достижения.png'`);
        } else {
            assert(!!m, `категория "${cat}" имеет запись в ICON_MAP`);
        }
    });
}

console.log('\nTest 4: все файлы из ICON_MAP + фолбэк реально существуют в _client/development/images/achievements/');
{
    const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-achievements.js'), 'utf-8');
    const files = [...src.matchAll(/:\s*'([^']+\.png)'/g)].map(m => m[1]);
    const uniqueFiles = [...new Set(files.concat('достижения.png'))];
    assert(uniqueFiles.length >= 25, `найдено достаточно уникальных файлов иконок в ICON_MAP (${uniqueFiles.length})`);
    uniqueFiles.forEach(f => {
        assert(fs.existsSync(path.join(ACH_DIR, f)), `файл существует локально: achievements/${f}`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

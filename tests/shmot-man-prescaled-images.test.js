/**
 * Test: 26.10.2026, по прямому указанию — "для всех шмоток, которые надеваются на персонажа,
 * везде, где персонаж есть... вместо scale теперь заранее прописанная ширина и длина".
 *
 * Контекст: эксперимент на маске "Комбинатор" (A/B справа/слева на главном экране) показал,
 * что PNG, заранее уменьшенный качественным алгоритмом (LANCZOS) до целевого размера показа,
 * выглядит ЧЁТЧЕ, чем тот же большой исходник, уменьшенный на лету через sprite.scale/width —
 * в PixiJS оба способа математически идентичны (один и тот же GPU-семплинг одной и той же
 * текстуры), резкость даёт именно пере-экспортированный с меньшим разрешением файл, а не смена
 * API. Это подтвердилось и независимо: id111 уже был экспериментально переведён на
 * manWidth/manHeight 22.10.2026 — и это НЕ решило жалобы на резкость, пришлось возвращаться к
 * этому эксперименту заново 26.10.2026.
 *
 * Реализация — для КАЖДОГО из 78 предметов каталога shmot.js (всех, которые показываются НА
 * персонаже: home.js/hata.js/shmot_shop.js-манекен/player_profile.js — НЕ иконка в списке
 * магазина, та по-прежнему использует оригинальный imgFile + cellScale):
 *  - сгенерирован manImgFile — копия imgFile, заранее уменьшенная (PIL, LANCZOS) до точного
 *    пиксельного размера round(nativeW*oldManScale) × round(nativeH*oldManScale);
 *  - manScale в каталоге стал 1.000 у ВСЕХ предметов (включая id111 — manWidth/manHeight убраны);
 *  - 4 места рендера персонажа переключены на (eq.manImgFile || eq.imgFile) + manScale(=1.000).
 *
 * Оригинальный imgFile НЕ тронут (нужен для cellScale/иконки в списке — другой экран, другой
 * целевой размер показа, трогать его резкость этим батчем не просили).
 *
 * Run: node tests/shmot-man-prescaled-images.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const SHMOT_DIR = path.join(root, '_client', 'development', 'images', 'shmot');

function pngSize(filePath){
    const buf = fs.readFileSync(filePath);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const itemsBlockMatch = shmotSrc.match(/this\.items = \[([\s\S]*?)\n\t\t\];/);
assert(!!itemsBlockMatch, 'this.items = [ ... ] найден в shmot.js');
const itemsBlock = itemsBlockMatch ? itemsBlockMatch[1] : '';

const lines = itemsBlock.match(/\{id:\d+,.*?\},?(?=\s*(?:\n|\/\/|\/\*|\{id:|$))/gs) || [];
const items = [];
for(const line of lines){
    const idM = line.match(/\{id:(\d+)/);
    if(!idM) continue;
    const imgM = line.match(/imgFile:'([^']*)'/);
    const manScaleM = line.match(/manScale:([\d.]+)/);
    const manImgM = line.match(/manImgFile:'([^']*)'/);
    items.push({
        id: parseInt(idM[1]),
        imgFile: imgM ? imgM[1] : null,
        manScale: manScaleM ? parseFloat(manScaleM[1]) : null,
        manImgFile: manImgM ? manImgM[1] : null,
    });
}

console.log(`\nTest 1: все 78 предметов каталога имеют manScale:1.000 и manImgFile`);
{
    assert(items.length === 78, `в каталоге 78 предметов (нашлось ${items.length})`);
    const missingManImg = items.filter(it => !it.manImgFile);
    assert(missingManImg.length === 0, `у всех предметов задан manImgFile (без него: ${missingManImg.map(i => i.id).join(',') || 'нет'})`);
    // 27.10.2026 (по прямому указанию, редактор позиций на манекене — живые репорты "слишком
    // мелкая/крупная на персонаже"): id62 (Часы Покер)/id80 (Дубинка Зарики)/id92 (Цепь
    // Тинейджер) получили manScale, ОТЛИЧНЫЙ от 1.000 поверх уже предзауменьшенного manImgFile —
    // сам факт наличия manImgFile+pre-shrink не исключает точечную докрутку масштаба, если
    // реальное измерение на манекене показало, что готовый файл всё равно велик/мал. Инвариант
    // "всегда ровно 1.000" был прикидкой общего правила, не строгим архитектурным ограничением.
    // id80 (Дубинка) вернулась к 1.000 27.10.2026 — manImgFile заменён на натуральный 133×121px
    // файл вместо урезанного 44×40px, больше не нужна докрутка под низкое разрешение.
    // 27.10.2026 (по прямому указанию, повторные живые координаты манекена тем же днём): id87
    // (Футболка Тинейджер) 0.992, id112 (Куртка Следопыт)/id118 (Худи белая Исполнительный)
    // 1.004 — та же логика точечной докрутки, что у id62/92 выше.
    const EXCEPTIONS = { 62: 0.880, 92: 0.842, 87: 0.992, 112: 1.004, 118: 1.004 };
    const wrongScale = items.filter(it => it.manScale !== 1.000 && it.manScale !== EXCEPTIONS[it.id]);
    assert(wrongScale.length === 0, `у всех предметов manScale === 1.000, кроме задокументированных исключений (отличается у: ${wrongScale.map(i => i.id + '=' + i.manScale).join(',') || 'нет'})`);
    // manWidth/manHeight — старый эксперимент (22.10.2026, id111) — полностью убран из каталога.
    assert(!/manWidth:/.test(shmotSrc) && !/manHeight:/.test(shmotSrc),
        'manWidth/manHeight нигде не остались в каталоге (мигрированы на manImgFile)');
}

console.log(`\nTest 2: КАЖДЫЙ manImgFile реально существует на диске, намеспейс-имя "уменьшено <imgFile>" (кроме 3 предметов, у которых оригинал УЖЕ рендерился в родном/около-родном разрешении — там manImgFile===imgFile, уменьшать нечего), строго меньше оригинала (где применимо), та же пропорция сторон`);
{
    // 26.10.2026: id52/55/64 — их старый manScale уже был 1.000 (id52/64) или >1.000 (id55,
    // реально МИКРО-апскейл 1.0145×) — для них генерация "уменьшенной" копии либо ничего не
    // давала (копия байт-в-байт того же размера), либо была бы РЕАЛЬНЫМ апскейлом (интерполяция
    // добавляет размытие, а не убирает его) — хуже, чем просто показать оригинал как есть.
    // Для этих 3 manImgFile указывает прямо на imgFile, без отдельного файла.
    const NO_SHRINK_IDS = new Set([52, 55, 64]);
    let checked = 0;
    for(const it of items){
        if(!it.manImgFile || !it.imgFile) continue;
        if(NO_SHRINK_IDS.has(it.id)){
            assert(it.manImgFile === it.imgFile, `id${it.id}: manImgFile === imgFile (оригинал уже в целевом разрешении, уменьшать не нужно)`);
            continue;
        }
        assert(it.manImgFile === 'уменьшено ' + it.imgFile,
            `id${it.id}: manImgFile имеет коллизи-безопасный префикс "уменьшено " + imgFile (получили "${it.manImgFile}")`);

        const origPath = path.join(SHMOT_DIR, it.imgFile);
        const manPath = path.join(SHMOT_DIR, it.manImgFile);
        if(!fs.existsSync(origPath) || !fs.existsSync(manPath)) {
            assert(false, `id${it.id}: оригинал и/или manImgFile существуют на диске (orig=${fs.existsSync(origPath)}, man=${fs.existsSync(manPath)})`);
            continue;
        }
        checked++;
        const orig = pngSize(origPath);
        const man  = pngSize(manPath);
        // 27.10.2026: id80 (Дубинка) — manImgFile заменён на натуральный (не урезанный)
        // источник игрока, который оказался РОВНО того же разрешения, что и cell-иконка
        // imgFile (133×121 оба) — отдельный файл с префиксом "уменьшено " всё ещё нужен
        // (коллизия имён, см. выше), но реального уменьшения в этом случае нет, как у
        // id52/55/64 (NO_SHRINK_IDS), только там manImgFile указывает прямо на imgFile, а
        // здесь — на отдельный, просто одинакового размера файл.
        if(it.id === 80){
            assert(man.w === orig.w && man.h === orig.h,
                `id${it.id} (${it.imgFile} ${orig.w}x${orig.h} → ${it.manImgFile} ${man.w}x${man.h}): натуральный размер, ожидалось точное совпадение с imgFile`);
        } else {
            assert(man.w <= orig.w && man.h <= orig.h && (man.w < orig.w || man.h < orig.h),
                `id${it.id} (${it.imgFile} ${orig.w}x${orig.h} → ${it.manImgFile} ${man.w}x${man.h}): реально уменьшен, не копия 1:1`);
        }

        // Пропорция сохранена (uniform resize, без искажений) — допуск 1.5% на округление до
        // целого пикселя при генерации.
        const origRatio = orig.w / orig.h, manRatio = man.w / man.h;
        const ratioDiff = Math.abs(origRatio - manRatio) / origRatio;
        assert(ratioDiff <= 0.015,
            `id${it.id}: пропорция сторон сохранена при уменьшении (оригинал ${origRatio.toFixed(4)}, уменьшенный ${manRatio.toFixed(4)}, разница ${(ratioDiff*100).toFixed(2)}%)`);
    }
    assert(checked === 75, `проверено 75 пар файлов оригинал/уменьшенный (78 минус 3 no-shrink), получилось ${checked}`);
}

console.log('\nTest 3: 4 экрана персонажа (home/hata/shmot_shop-манекен/player_profile) берут текстуру из (manImgFile || imgFile), не из голого imgFile');
{
    const SCREENS = {
        'home.js': '_client/src/game/home.js',
        'hata.js': '_client/src/game/shell/overlays/hata.js',
        'shmot_shop.js (манекен)': '_client/src/game/shell/overlays/shmot_shop.js',
        'player_profile.js': '_client/src/game/shell/overlays/player_profile.js',
    };
    for(const [name, rel] of Object.entries(SCREENS)){
        const src = fs.readFileSync(path.join(root, rel), 'utf-8');
        assert(/\.manImgFile \|\| (eq|def)\.imgFile\)/.test(src), `${name}: текстура персонажа берётся из (manImgFile || imgFile)`);
    }
}

console.log('\nTest 4: manWidth/manHeight-ветка (эксперимент 22.10.2026) убрана из всех 4 мест рендера — мёртвый код не остался');
{
    const SCREENS = [
        '_client/src/game/home.js',
        '_client/src/game/shell/overlays/hata.js',
        '_client/src/game/shell/overlays/shmot_shop.js',
        '_client/src/game/shell/overlays/player_profile.js',
    ];
    for(const rel of SCREENS){
        const src = fs.readFileSync(path.join(root, rel), 'utf-8');
        assert(!/\.manWidth\b/.test(src) && !/\.manHeight\b/.test(src), `${rel}: manWidth/manHeight нигде не используются`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

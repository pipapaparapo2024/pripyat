/**
 * Test: батч 18.10.2026 (повторный проход тем же днём, после основной замены сигарет на
 * сухари) — покрывает поведенческие/текстовые изменения, не покрытые другими файлами:
 *
 * 1) achievements.js — названия достижений cat 'cig_hoard' ("Сигаретный барон" и т.п.) всё
 *    ещё отсылали к курению, хотя ресурс визуально сухари с 17.10.2026 ("у нас сигарет нет,
 *    у нас сухари" — прямая цитата). Переименованы на сухарную тематику.
 * 2) universal_helper.js — numberEnd('cigarettes') отдавал словоформы "сига"/"сигу"/"сиг"
 *    (тот же класс пропуска, что уже чинили для HUD/достижений/Сидоровича) — используется в
 *    ценниках bank.js.genSlots() и interface-currency-purchase.js, значит ценники в магазине
 *    реально показывали бы "3 сиги" вместо "3 сухаря".
 * 3) svod-achievements.js — иконки 'bp_50' (Трудяга) и 'meta_500' (Вошёл в игру) используют
 *    FALLBACK_ICON (нет своей картинки по категории bp/meta) — по прямому указанию получили
 *    отдельный размер 53×44 вместо общих 46×44, т.к. fallback-картинка другого соотношения
 *    сторон и "квадратный" общий размер её портил.
 * 4) zone_screen.js — 5 новых файлов локаций переименованы с суффиксом "v2" (анти-кеш VK/
 *    браузера на то же имя файла — тот же приём, что "рулетка колесо v2.png"/"блекджек фон
 *    v2.png" в предыдущих батчах).
 *
 * Run: node tests/oct18-batch2-achievements-purchase-zone-locations.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) achievements.js — названия cig_hoard переименованы с сигаретной темы на сухарную');
{
    const src = read('_client/src/game/achievements.js');
    const ids = ['cig_10k','cig_50k','cig_100k','cig_300k','cig_500k','cig_1kk','cig_5kk','cig_10kk'];
    for (const id of ids) {
        const re = new RegExp("id:'" + id + "',\\s*cat:'cig_hoard',\\s*name:'([^']+)'");
        const m = src.match(re);
        assert(!!m, id + ' найден в каталоге достижений');
    }
    assert(!/Первая затяжка|Пыхарь|Закурил конкретно|Дымовая завеса|Сигаретный магнат|Сигаретный барон|Босс по табаку|Легенда курилки/.test(src),
        'ни одно старое (курительное) название не осталось');
    // threshold/statPath/check — экономика НЕ менялась, переименован только текст.
    assert(/name:'Сухарный барон',\s*pts:6,\s*threshold:1000000/.test(src),
        'threshold/pts достижения cig_1kk не изменились при переименовании (только name)');
}

console.log('\n2) universal_helper.js — numberEnd(\'cigarettes\') теперь про сухари, не про курение');
{
    const src = read('_client/src/modules/universal_helper.js');
    assert(/cigarettes:\s*\['сухарь', 'сухаря', 'сухарей'\]/.test(src),
        "словоформы cigarettes → ['сухарь','сухаря','сухарей']");
    assert(!/cigarettes:\s*\['сига', 'сигу', 'сиг'\]/.test(src), 'старые курительные словоформы убраны');
}

console.log('\n3) svod-achievements.js — иконки bp_50/meta_500 используют 53×44, остальные — 46×44');
{
    const src = read('_client/src/game/svod/svod-achievements.js');
    // Размер иконки должен пересчитываться НА КАЖДЫЙ _fillCard (не один раз при создании
    // спрайта в пуле) — иначе переиспользование карточки под другое достижение оставит
    // старый размер. Проверяем, что присвоение width/height НЕ находится внутри блока
    // `if(!c._iconSpr){ ... }` (там создаётся спрайт один раз на весь пул).
    const poolBlockStart = src.indexOf('if(!c._iconSpr){');
    const poolBlockEnd   = src.indexOf('}', src.indexOf('c.card.addChildAt(c._iconSpr, 1);'));
    const poolBlock = src.slice(poolBlockStart, poolBlockEnd);
    assert(!/\.width\s*=\s*46/.test(poolBlock), 'размер иконки больше не фиксируется внутри one-time блока создания спрайта пула');

    // 18.10.2026 (повторное указание тем же днём — "увеличить ширину ещё на 3px"): 53 → 56.
    assert(/_isWideIcon \? 54 : 46;/.test(src),
        "ширина — 56 для bp_50/meta_500, иначе 46 (пересчитывается на каждый вызов _fillCard)");
    assert(/c\._iconSpr\.height\s*=\s*44;/.test(src), 'высота всегда 44 (не менялась для этих двух)');
}

console.log('\n4) zone_screen.js — 5 новых файлов локаций, переименованы под анти-кеш (суффикс v2)');
{
    const src = read('_client/src/game/shell/overlays/zone_screen.js');
    const files = [
        'зона локация кордон v2.png', 'зона локация свалка v2.png', 'зона локация долина v3.png',
        'зона локация агропром v2.png', 'зона локация янтарь v3.png',
    ];
    for (const f of files) {
        assert(src.includes("'" + f + "'") || src.includes("Z + '" + f + "'"), 'LOCATIONS[] использует ' + f);
    }
    assert(!/кордон\.png'(?!\s*,\s*locIdx)/.test(src.replace(/зона локация кордон v2\.png/g, '')),
        'старое короткое имя "кордон.png" (без суффикса v2 / namespace) больше не используется как путь к локации');

    const bootSrc = read('_client/src/game/game-boot.js');
    for (const f of files) {
        assert(bootSrc.includes(f), 'game-boot.js прелоадит ' + f);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

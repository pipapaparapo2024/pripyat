/**
 * Test: 22.10.2026, по прямому указанию — "хочу посмотреть, что именно скомпилировано из FLA,
 * а не нашу логику". Новый дев-экран shell/overlays/fla_gallery.js — листалка (стрелки влево/
 * вправо) по 18 скомпилированным через PIXI.animate FLA-файлам (_elements.min.js + notify +
 * preloader), открывается кнопкой "FLA" слева на главном экране (home.js).
 *
 * Ключевые решения, которые должны остаться в коде (не регрессировать):
 * - Каждый пункт инстанцирует СВЕЖИЙ "new X.lib.X()" (корневой класс документа — тот же, что
 *   X.stage = X.lib.X внутри каждого файла), а НЕ переиспользует modules.names[key] — иначе
 *   PIXI вырвал бы общий объект из настоящего экрана (bosses.js/shmot.js/...) при показе в
 *   галерее, и этот экран сломался бы при следующем обычном открытии игроком.
 * - home_elements.min.js НЕ существует (home.js не использует FLA вообще) — в списке 18
 *   пунктов, не 19, "Главного экрана" там нет.
 * - preloader — особый случай (грузится отдельно в index.js на старте, не через
 *   modules.checkFlags) — key: null, не идёт через обычную загрузку.
 *
 * Run: node tests/oct22-fla-gallery-dev-screen.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const gallerySrc = readSrc('_client/src/game/shell/overlays/fla_gallery.js');
const homeSrc = readSrc('_client/src/game/home.js');

console.log('\nTest 1: ENTRIES — ровно 19 пунктов (18 своих + 1 чужой референс), home_elements отсутствует');
{
    const m = gallerySrc.match(/const ENTRIES = \[([\s\S]*?)\n\];/);
    assert(!!m, 'массив ENTRIES найден');
    if(m){
        const keyMatches = [...m[1].matchAll(/\{ key: /g)];
        // 25.10.2026: 18 → 19 — добавлен изолированный пункт "Интерфейс (референс, другая игра)".
        assert(keyMatches.length === 19, `ровно 19 пунктов (нашлось ${keyMatches.length})`);
        assert(!/home_elements/.test(m[1]), 'home_elements НЕ в списке (такого файла не существует)');
        assert(/fla: 'preloader'/.test(m[1]) && /key: null/.test(m[1]),
            'preloader — особый пункт с key:null (грузится отдельно на старте игры)');
        assert(/fla: 'notify'/.test(m[1]), 'notify присутствует');
        assert(/foreign: true/.test(m[1]) && /foreignGlobalKey: '__fla_foreign_interface_elements'/.test(m[1]),
            'чужой пункт помечен foreign:true с изолированным именем глобала');
    }
}

console.log('\nTest 1b: изоляция чужого файла — не подменяет window.interface_elements (нашу боевую HUD-библиотеку)');
{
    assert(/const before = window\[entry\.fla\];/.test(gallerySrc),
        'перед загрузкой чужого скрипта сохраняется ТЕКУЩЕЕ значение window[entry.fla] (наш модуль, если уже прогружен)');
    assert(/window\[entry\.foreignGlobalKey\] = window\[entry\.fla\];/.test(gallerySrc),
        'после загрузки чужой экспорт переносится под изолированное имя');
    assert(/window\[entry\.fla\] = before;/.test(gallerySrc),
        'исходное имя window[entry.fla] возвращается на место (before) — чужой файл НЕ остаётся висеть под боевым именем');
    assert(/s\.dataset\.flaForeign = entry\.foreignSrc;/.test(gallerySrc),
        'тег скрипта помечен dataset — повторный вызов не плодит дублирующие <script>');
    assert(/const lib = entry\.foreign \? window\[entry\.foreignGlobalKey\] : window\[entry\.fla\];/.test(gallerySrc),
        'рендер читает чужую библиотеку из изолированного имени, не из window[entry.fla]');
}

console.log('\nTest 2: показ создаёт СВЕЖИЙ инстанс (new X.lib.X), не переиспользует modules.names — не ломает реальные экраны');
{
    assert(/const RootClass = lib && lib\.lib && lib\.lib\[entry\.fla\];/.test(gallerySrc),
        'берётся корневой класс X.lib.X по имени файла (тот же паттерн, что X.stage = X.lib.X)');
    assert(/const inst = new RootClass\(\);/.test(gallerySrc), 'создаётся новый инстанс через new');
    assert(!/modules\.names\[entry\.key\]/.test(gallerySrc) && !/modules\.names\[entry\.fla\]/.test(gallerySrc),
        'НЕ переиспользует общий modules.names[...] — иначе вырвал бы объект из настоящего экрана');
}

console.log('\nTest 3: загрузка через modules.checkFlags, с защитой от гонки (перелистнули раньше, чем долетел ответ)');
{
    assert(/modules\.checkFlags\(\[entry\.key\], render\);/.test(gallerySrc), 'загрузка через modules.checkFlags');
    assert(/if\(this\._flaGalleryIdx !== idx\) return;/.test(gallerySrc),
        'защита от гонки — пропускает рендер, если индекс уже сменился, пока грузилось');
}

console.log('\nTest 4: стрелки влево/вправо зациклены (modulo), есть кнопка выхода');
{
    assert(/const next = \(this\._flaGalleryIdx \+ dir \+ ENTRIES\.length\) % ENTRIES\.length;/.test(gallerySrc),
        'шаг листания зациклен через модуль (с -1 на первом пункте переходит на последний)');
    assert(/this\._flaGalleryStep\(-1\)/.test(gallerySrc) && /this\._flaGalleryStep\(1\)/.test(gallerySrc),
        'обе стрелки (влево/вправо) подключены');
    assert(/proto\._closeFlaGallery = function\(\)/.test(gallerySrc), '_closeFlaGallery определён');
    assert(/exitBtn\.on\('pointerdown', \(\) => this\._closeFlaGallery\(\)\);/.test(gallerySrc),
        'кнопка выхода закрывает экран');
}

console.log('\nTest 5: home.js — кнопка "FLA" окончательно убрана из init() (26.10.2026, по прямому указанию — "эта кнопка не нужна")');
{
    // История: добавлена 22.10, скрыта 24.10 (addChild закомментирован), возвращена 25.10,
    // 26.10.2026 кнопка на ГЛАВНОМ ЭКРАНЕ удалена из init() целиком (не просто скрыта в третий
    // раз) — сам модуль fla_gallery.js/_openFlaGallery() НЕ удалён, остаётся подключён к
    // Home.prototype как мёртвый код (на случай, если понадобится вернуть), просто ничто больше
    // не вызывает _openFlaGallery() с главного экрана.
    assert(/import attachFlaGallery from '\.\/shell\/overlays\/fla_gallery\.js';/.test(homeSrc),
        'import attachFlaGallery всё ещё на месте (модуль не удалён, только точка входа)');
    assert(/attachFlaGallery\(Home\.prototype\);/.test(homeSrc), 'attachFlaGallery(Home.prototype) всё ещё подключает метод (мёртвый код, не вызывается)');
    assert(!/this\._flaGalleryBtn\s*=/.test(homeSrc) && !/root\.layer0_mc\.addChild\(this\._flaGalleryBtn\)/.test(homeSrc),
        'кнопка-спрайт больше не создаётся и не добавляется на сцену в init() (упоминание осталось только в объяснительном комментарии)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

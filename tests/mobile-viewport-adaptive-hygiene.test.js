/**
 * Test: 27.09.2026 — адаптив под мобильные и иные устройства, этап "мобильная гигиена".
 *
 * Запрос: "как сделать наш проект адаптивным под мобильные и иные устройства?" — выбранное
 * направление: сначала гигиена вьюпорта + экономия памяти, решение по ориентации экрана
 * (портрет/ландшафт) принимается отдельно и здесь НЕ проверяется.
 *
 * Что закрывает этот батч и проверяется ниже:
 *  1. modules/mobile-viewport.js — единая точка правды о доступной области экрана:
 *     safe-area (вырез камеры/"бровь"/полоса жестов), определение тач-устройства не только по
 *     User-Agent, пересчёт размера на resize + orientationchange + visualViewport с повторами
 *     после поворота (iOS отдаёт актуальные метрики позже самого события).
 *  2. index.js — resize() берёт размеры из этого модуля, а не из window.innerWidth напрямую;
 *     подписка через onViewportChange вместо одиночного addEventListener('resize').
 *  3. index.html — запрет зума страницы, position:fixed body (iOS rubber-band),
 *     overscroll-behavior (pull-to-refresh перезагружал игру), touch-action на канвасе
 *     (иначе браузер задерживает каждое нажатие ~300 мс), safe-area у плашек загрузки.
 *  4. universal_helper.touchPad() — расширение зоны нажатия под палец, применено к 26
 *     стандартным кнопкам выхода (файл 62×58 при scale 0.5 = 9-20 CSS-пикселей на телефоне).
 *  5. Уменьшение нативного размера самых расточительных текстур: 30 файлов cp_art_*.png
 *     (1402×1122 → 480×384 при показе 160×107) и 7 файлов "ключ *.png" (1086×1448 → 272×362
 *     при показе 65×87, вместе с учетверением REWARD_KEY_SCALE 0.060 → 0.240).
 *
 * Run: node tests/mobile-viewport-adaptive-hygiene.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf-8');

const vp      = R('_client', 'src', 'modules', 'mobile-viewport.js');
const index   = R('_client', 'src', 'index.js');
const html    = R('_client', 'development', 'index.html');
const helper  = R('_client', 'src', 'modules', 'universal_helper.js');
const prefight= R('_client', 'src', 'game', 'shell', 'overlays', 'bosses_prefight.js');

console.log('\nTest 1: modules/mobile-viewport.js — safe-area, тач-детект, события пересчёта');
{
    assert(/export function viewportMetrics/.test(vp), 'экспортирует viewportMetrics()');
    assert(/export function onViewportChange/.test(vp), 'экспортирует onViewportChange()');
    assert(/export function installMobileViewport/.test(vp), 'экспортирует installMobileViewport()');
    assert(/export function detectTouch/.test(vp), 'экспортирует detectTouch()');

    assert(/env\(safe-area-inset-top\)/.test(vp) && /env\(safe-area-inset-bottom\)/.test(vp)
        && /env\(safe-area-inset-left\)/.test(vp) && /env\(safe-area-inset-right\)/.test(vp),
        'safe-area читается по всем четырём сторонам (через скрытый элемент-пробник)');
    assert(/getComputedStyle\(_probe\)/.test(vp), 'значения env(*) снимаются из computed style пробника');
    assert(/innerWidth\s*-\s*ins\.left\s*-\s*ins\.right/.test(vp)
        && /innerHeight\s*-\s*ins\.top\s*-\s*ins\.bottom/.test(vp),
        'доступная область = innerWidth/innerHeight МИНУС отступы безопасной зоны');

    assert(/maxTouchPoints/.test(vp) && /pointer:\s*coarse/.test(vp),
        'тач-устройство определяется не только по User-Agent (iPad на iPadOS 13+ отдаёт UA Mac)');

    assert(/addEventListener\('resize'/.test(vp), 'слушает resize');
    assert(/addEventListener\('orientationchange'/.test(vp), 'слушает orientationchange');
    assert(/visualViewport\.addEventListener\('resize'/.test(vp), 'слушает visualViewport.resize');
    assert(/\[120,\s*350,\s*700\]/.test(vp),
        'после поворота экрана есть повторные пересчёты (iOS отдаёт метрики позже события)');
    assert(/requestAnimationFrame/.test(vp), 'пачка событий resize дебаунсится до одного пересчёта за кадр');

    assert(/contextmenu/.test(vp) && /gesturestart/.test(vp),
        'гасятся системное меню по долгому тапу и iOS-жесты масштабирования');
}

console.log('\nTest 2: index.js — размеры канваса из модуля, подписка через onViewportChange');
{
    assert(/import \{[^}]*installMobileViewport[^}]*\} from '\.\/modules\/mobile-viewport\.js'/.test(index),
        'модуль импортирован в точке входа');
    assert(/installMobileViewport\(\);/.test(index), 'installMobileViewport() вызывается при старте');

    assert(!/if\(\/iPhone\|iPad\|iPod\|Android\/i\.test\(navigator\.userAgent\)\)/.test(index),
        'старая UA-проверка isMobile убрана из index.js (переехала в модуль)');

    assert(/const vp = viewportMetrics\(\);/.test(index), 'resize() берёт метрики из viewportMetrics()');
    // 03.10.2026: w/h теперь объявляются один раз (`let w, h;`) выше ветвления needsRotate
    // (форс-ландшафт/обычный letterbox, см. modules/forced-landscape.js) — присвоение `w = vp.w;`
    // осталось только в обычной (неповёрнутой) ветке.
    assert(/let w, h;/.test(index) && /w = vp\.w;/.test(index) && /h = vp\.h;/.test(index),
        'ширина/высота под вписывание берутся из доступной области, а не из window.innerWidth');
    assert(/canv\.style\.left\s*=\s*\(vp\.left \+ \(vp\.w - w\) \/ 2\)/.test(index),
        'центрирование по X учитывает левый отступ безопасной зоны');
    assert(/canv\.style\.top\s*=\s*\(vp\.top\s*\+ \(vp\.h - h\) \/ 2\)/.test(index),
        'центрирование по Y учитывает верхний отступ безопасной зоны');

    assert(/onViewportChange\(resize\);/.test(index), 'пересчёт подписан через onViewportChange');
    // Строки-комментарии выкидываем: в index.js осталось пояснение "было
    // window.addEventListener(...)" — упоминание в комментарии не должно валить проверку.
    const indexCode = index.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert(!/window\.addEventListener\("resize", resize\)/.test(indexCode),
        'одиночный window.addEventListener("resize", resize) больше не вызывается в коде');

    // Пропорции сцены не менялись — это НЕ этап смены ориентации/логического размера.
    assert(/const ratio = 1280 \/ 720;/.test(index), 'логический размер сцены остался 1280×720');
    assert(/scene\.renderer\.resize\(1280, 720\)/.test(index),
        'пересчёт resolution под devicePixelRatio (фикс 18.09.2026) не тронут');
    assert(/plugins\.interaction\.resolution = targetRes/.test(index),
        'синхронизация resolution интеракшна (фикс 18.09.2026) не тронута');

    assert(/env\(safe-area-inset-top\)/.test(index),
        'плашка версии не залезает под "бровь" (top через calc + env)');
}

console.log('\nTest 3: index.html — запрет зума, iOS rubber-band, touch-action, safe-area');
{
    assert(/user-scalable=no/.test(html) && /maximum-scale=1\.0/.test(html),
        'зум страницы запрещён (двойной тап/pinch больше не обрезают игру)');
    assert(/viewport-fit=cover/.test(html), 'viewport-fit=cover сохранён — отступы считает страница');

    assert(/overscroll-behavior:none/.test(html), 'pull-to-refresh отключён');
    assert(/body\{position:fixed/.test(html), 'body position:fixed — iOS не оттягивает страницу пальцем');
    assert(/canvas#stage\{touch-action:none\}/.test(html),
        'touch-action:none на канвасе — нет 300 мс задержки на каждое нажатие');
    assert(/-webkit-tap-highlight-color:transparent/.test(html), 'нет синей подсветки тапа');
    assert(/-webkit-touch-callout:none/.test(html), 'долгий тап не открывает меню "сохранить изображение"');

    assert(/width:min\(320px,80vw\)/.test(html), 'полоса загрузки не шире 80% узкого экрана');
    assert(/bottom:calc\(36px \+ env\(safe-area-inset-bottom\)\)/.test(html),
        'полоса загрузки не попадает под системную полосу жестов');
}

console.log('\nTest 4: helper.touchPad() — зона нажатия под палец');
{
    assert(/touchPad\(obj, minLogical = 72\)\{/.test(helper), 'метод touchPad(obj, minLogical=72) объявлен');
    assert(/obj\.hitArea = new PIXI\.Rectangle\(/.test(helper), 'расширяет именно hitArea (картинку не трогает)');
    assert(/const needW = minLogical \/ sx;/.test(helper) && /const needH = minLogical \/ sy;/.test(helper),
        'минимальный размер задан в логических пикселях и делится на scale (hitArea живёт до scale)');
    assert(/obj\.anchor \? obj\.anchor\.x : 0/.test(helper), 'учитывается anchor объекта');
    assert(/if\(padX === 0 && padY === 0\) return obj;/.test(helper),
        'объектам, которые и так крупнее минимума, hitArea не навязывается');

    // Применение: все 26 стандартных кнопок выхода.
    const walk = (dir, acc = []) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p, acc);
            else if (e.name.endsWith('.js')) acc.push(p);
        }
        return acc;
    };
    const files = walk(path.join(__dirname, '..', '_client', 'src'));
    let scaleSites = 0, padSites = 0;
    for (const f of files) {
        const s = fs.readFileSync(f, 'utf-8');
        // 29.09.2026 (по прямому указанию — "для всех кнопок небольшой hover эффект увеличения
        // scale"): exitBtn теперь получает ВТОРОЙ scale.set(0.5) — как возврат к исходному
        // масштабу внутри pointerout ("_sa(exitBtn, 1); exitBtn.scale.set(0.5); });", всегда
        // сразу перед закрывающей "});" одной строкой) — этот литерал текстово совпадает с
        // ДЕКЛАРАЦИЕЙ (просто "exitBtn.scale.set(0.5);" на своей строке), из-за чего наивный
        // подсчёт задваивался. Считаем ТОЛЬКО декларации — те, что НЕ сразу закрываются "});".
        scaleSites += (s.match(/exitBtn\.scale\.set\(0\.5\);(?!\s*\}\))/g) || []).length;
        padSites   += (s.match(/helper\.touchPad\(exitBtn\)/g)  || []).length;
    }
    assert(scaleSites === 26, 'найдено 26 стандартных кнопок выхода (было столько же до правки), факт: ' + scaleSites);
    assert(padSites === scaleSites,
        'у каждой кнопки выхода расширена зона нажатия, факт: ' + padSites + ' из ' + scaleSites);
}

console.log('\nTest 5: уменьшенные текстуры — реальные файлы на диске и компенсация scale');
{
    const IMG = path.join(__dirname, '..', '_client', 'development', 'images');
    // Размер PNG читается из IHDR: байты 16-24 — ширина и высота big-endian.
    const png = (p) => {
        const b = fs.readFileSync(p).subarray(0, 24);
        return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    };

    const cpDir = path.join(IMG, 'layers', 'popups', 'location', 'cp_art');
    const cps = fs.readdirSync(cpDir).filter(f => /^cp_art_.*\.png$/.test(f));
    assert(cps.length === 30, '30 файлов cp_art_*.png на месте, факт: ' + cps.length);
    const cpBad = cps.filter(f => { const d = png(path.join(cpDir, f)); return d.w !== 480 || d.h !== 384; });
    assert(cpBad.length === 0, 'все cp_art уменьшены до 480×384 (показ 160×107), не уменьшено: ' + cpBad.length);

    const keys = fs.readdirSync(IMG).filter(f => /^ключ .*\.png$/.test(f));
    assert(keys.length === 7, '7 файлов "ключ *.png" на месте, факт: ' + keys.length);
    const keyBad = keys.filter(f => { const d = png(path.join(IMG, f)); return d.w !== 272 || d.h !== 362; });
    assert(keyBad.length === 0, 'все ключи уменьшены до 272×362 (ровно ÷4), не уменьшено: ' + keyBad.length);

    assert(/const REWARD_KEY_SCALE   = 0\.260;/.test(prefight),
        '28.09.2026: REWARD_KEY_SCALE пересчитан под уменьшенный файл (272×362) на новый требуемый размер 71×94 (0.26)');

    // Оригиналы обязаны лежать в бэкапе: без них уменьшение необратимо.
    const bak = path.join(__dirname, '..', '_originals_before_downscale_27_09_2026');
    assert(fs.existsSync(bak), 'папка с оригиналами до уменьшения существует');
    const bakCp = path.join(bak, 'layers', 'popups', 'location', 'cp_art');
    const bakCps = fs.readdirSync(bakCp).filter(f => /^cp_art_.*\.png$/.test(f));
    assert(bakCps.length === 30, 'в бэкапе все 30 оригиналов cp_art, факт: ' + bakCps.length);
    // Исходники не одного размера: 28 файлов 1402×1122 + 2 файла 1536×1024 (на экране это не
    // видно — показываются они всё равно принудительными 160×107). Проверяем не точные числа,
    // а что в бэкапе лежат именно КРУПНЫЕ оригиналы, а не копии уже уменьшенных файлов.
    const bakSmall = bakCps.filter(f => { const d = png(path.join(bakCp, f)); return d.w < 1000 || d.h < 1000; });
    assert(bakSmall.length === 0,
        'в бэкапе крупные оригиналы, а не копии уменьшенных, мелких файлов: ' + bakSmall.length);

    const bakKeys = fs.readdirSync(bak).filter(f => /^ключ .*\.png$/.test(f));
    assert(bakKeys.length === 7, 'в бэкапе все 7 оригиналов ключей, факт: ' + bakKeys.length);
    const keyOrig = png(path.join(bak, 'ключ счастливчик.png'));
    assert(keyOrig.w === 1086 && keyOrig.h === 1448,
        'оригинал ключа в бэкапе — 1086×1448, факт: ' + keyOrig.w + '×' + keyOrig.h);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

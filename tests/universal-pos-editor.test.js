/**
 * Test: universal_pos_editor.js — универсальный редактор позиций.
 *
 * Одна кнопка, всегда поверх абсолютно всего экрана (держится через PIXI.Ticker,
 * а не ручным z-order — надёжнее, т.к. десятки экранов в проекте сами лезут
 * наверх через root.addChild(iface.up) и т.п.). По клику включает режим, в
 * котором любой видимый Sprite/Text на текущем экране можно тащить мышкой —
 * обычные клики (покупки, навигация) в это время подавлены полноэкранным
 * перехватчиком, а не просто "поверх" — иначе клик долетел бы до кнопки под ним.
 *
 * Отдельно: скрытые "активные" состояния попапов (файлы с "актив"/"active" в
 * имени, обычно invisible до hover/нажатия) автоматически становятся видимыми на
 * время редактирования и возвращаются в исходное состояние при выключении.
 *
 * Заменяет ранее убранную панель "ПРЕВЬЮ ПОПАПОВ" (dev_popups.js) — теперь просто
 * открываешь любой экран как обычно и жмёшь эту кнопку прямо на нём.
 *
 * Run: node tests/universal-pos-editor.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
);
const interfaceSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'interface.js'), 'utf-8'
);

// ── Test 1: подключение к Interface.prototype, dev_popups.js удалён ──────────
console.log('\nTest 1: universal_pos_editor подключён в interface.js вместо dev_popups');
{
    assert(/import \{ attachUniversalPosEditor \} from '\.\/shell\/overlays\/universal_pos_editor\.js';/.test(interfaceSrc),
        'импорт attachUniversalPosEditor есть');
    assert(/attachUniversalPosEditor\(Interface\.prototype\);/.test(interfaceSrc),
        'attachUniversalPosEditor подключён к Interface.prototype');
    assert(!/attachDevPopups/.test(interfaceSrc), 'attachDevPopups (старая панель) больше не упоминается');
    assert(!fs.existsSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_popups.js')),
        'файл dev_popups.js физически удалён');
}

// ── Test 2: кнопка создаётся один раз и держится поверх всего через Ticker ────
console.log('\nTest 2: кнопка держится поверх всего через PIXI.Ticker (не через ручной z-order)');
{
    assert(/proto\._ensureEditButton = function\(\)\{/.test(src), '_ensureEditButton определён');
    assert(/if\(this\._editBtn\) return;/.test(src), 'кнопка создаётся один раз (идемпотентно)');
    assert(/PIXI\.Ticker\.shared\.add\(\(\)=>\{ if\(this\._editBtn && this\._editBtn\.parent\) this\._editBtn\.parent\.addChild\(this\._editBtn\); \}\);/.test(src),
        'каждый кадр кнопка перекидывается в конец списка детей своего родителя (топ z-order)');
    assert(/this\._ensureEditButton\(\);/.test(interfaceSrc),
        'interface.js вызывает _ensureEditButton() при инициализации HUD (upInit)');
}

// ── Test 3: toggle включает/выключает режим, обе стороны определены ──────────
console.log('\nTest 3: _toggleUniversalEdit переключает _enableUniversalEdit/_disableUniversalEdit');
{
    assert(/proto\._toggleUniversalEdit = function\(\)\{/.test(src), '_toggleUniversalEdit определён');
    assert(/this\._uEditOn = !this\._uEditOn;/.test(src), 'переключает булев флаг режима');
    assert(/if\(this\._uEditOn\) this\._enableUniversalEdit\(\);/.test(src), 'включает при true');
    assert(/else this\._disableUniversalEdit\(\);/.test(src), 'выключает при false');
}

// ── Test 4: полноэкранный перехватчик кликов подавляет обычные действия ──────
console.log('\nTest 4: полноэкранный capture-слой добавлен поверх всего и глушит клики под собой');
{
    assert(/cap\.drawRect\(0, 0, 1280, 720\);/.test(src), 'capture-слой на весь канвас 1280×720');
    assert(/cap\.interactive = true;/.test(src), 'capture-слой интерактивен (перехватывает клики)');
    assert(/root\.addChild\(cap\);/.test(src), 'capture-слой добавлен в root (топ уровень)');
}

// ── Test 5: кастомный hit-test ищет Sprite/Text, порядок слоёв 2→1→0 ─────────
// 16.09.2026: сам обход дерева переехал из _uFindTopmost в _uCollectAt/_uFindAllAt
// (нужен полный список кандидатов под курсором для Shift+клика по наложенным объектам).
console.log('\nTest 5: _uCollectAt ищет только Sprite/Text; _uFindAllAt проверяет layer2→layer1→layer0');
{
    const m = src.match(/proto\._uCollectAt = function\(node, gx, gy, results\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_uCollectAt найден');
    if (m) {
        const body = m[1];
        assert(/child instanceof PIXI\.Sprite \|\| child instanceof PIXI\.Text/.test(body),
            'выбирает только Sprite/Text ("любой видимый спрайт/текст")');
        assert(/child === this\._uCapture \|\| child === this\._editBtn/.test(body),
            'исключает служебные объекты редактора из hit-теста (capture/кнопку/readout)');
    }

    const m2 = src.match(/proto\._uFindAllAt = function\(gx, gy\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m2, '_uFindAllAt найден');
    if(m2){
        const body2 = m2[1];
        assert(/this\._uCollectAt\(root\.layer2_mc, gx, gy, \[\]\)/.test(body2) &&
               /this\._uCollectAt\(root\.layer1_mc, gx, gy, \[\]\)\.concat\(this\._uCollectAt\(root\.layer0_mc, gx, gy, \[\]\)\)/.test(body2),
            'порядок проверки: layer2 (попапы) → layer1 (HUD) → layer0 (игровой мир)');
    }
}

// ── Test 6: скрытые "активные" состояния попапов авто-показываются и возвращаются ──
console.log('\nTest 6: авто-показ скрытых "актив"/"active" спрайтов + откат при выключении');
{
    assert(/const _looksLikeActiveState = \(spr\) => \{/.test(src), '_looksLikeActiveState определена');
    // 16.09.2026: расширен до "activ" (без конечной "e") — реальные имена файлов
    // Сидоровича (banka_activ.png и т.д.) не матчились ни "актив", ни "active".
    assert(/const re = \/актив\|activ\/i;/.test(src), 'ищет "актив" (кириллица) ИЛИ "activ" (латиница, включая усечённое) без учёта регистра');
    // resource.url не всегда доступен (общий кэш текстур/атлас) — дублирующая проверка
    // по textureCacheIds (см. баг: попап «купить патрон» не находился редактором).
    assert(/textureCacheIds/.test(src), 'дублирует проверку по textureCacheIds, если resource.url недоступен');
    assert(/child\.visible === false && _looksLikeActiveState\(child\)/.test(src),
        'форсирует видимость только у изначально невидимых "активных" спрайтов');
    assert(/this\._uForcedVisible\.push\(child\);/.test(src), 'запоминает изменённые спрайты для отката');
    assert(/this\._uForcedVisible\.forEach\(spr => \{ spr\.visible = false; \}\);/.test(src),
        '_disableUniversalEdit возвращает их обратно в invisible');
}

// ── Test 7: drag — единый набор обработчиков на capture, а не по объекту ─────
console.log('\nTest 7: drag реализован через единый pointerdown/move/up на capture-слое');
{
    assert(/cap\.on\('pointerdown', onDown\);/.test(src), 'pointerdown на capture запускает поиск объекта под курсором');
    assert(/cap\.on\('pointermove', onMove\);/.test(src), 'pointermove двигает выбранный объект');
    assert(/cap\.on\('pointerup', onUp\);/.test(src) && /cap\.on\('pointerupoutside', onUp\);/.test(src),
        'pointerup/pointerupoutside завершают drag');
    assert(/obj\.x = Math\.round\(this\._uDrag\.x0 \+ \(local\.x - this\._uDrag\.startX\)\);/.test(src),
        'позиция объекта — это его this.x/this.y (те же координаты, что и в исходном коде)');
}

// ── Test 8: стрелки — 1px / Shift — 10px, слушатель снимается при выключении ──
console.log('\nTest 8: клавиатурная подгонка и корректная очистка при выключении режима');
{
    assert(/const step = e\.shiftKey \? 10 : 1;/.test(src), 'step = 10 при Shift, иначе 1');
    // capture:true — буквенные клавиши (Q/E) на VK-странице иначе перехватывались
    // сторонним bubble-фазовым обработчиком раньше, чем доходили сюда.
    assert(/window\.addEventListener\('keydown', this\._uKeyHandler, true\);/.test(src), 'keydown регистрируется при включении (capture-фаза)');
    assert(/window\.removeEventListener\('keydown', this\._uKeyHandler, true\);/.test(src), 'keydown снимается при выключении (с тем же capture-флагом)');
    assert(/if\(this\._uCapture\.parent\) this\._uCapture\.parent\.removeChild\(this\._uCapture\);/.test(src),
        'capture-слой удаляется из дерева при выключении (не остаётся невидимым перехватчиком навсегда)');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

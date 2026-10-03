/**
 * Test: батч 21.09.2026 — экран выбора локации Зоны, карусель локаций.
 *
 * Первая версия (по прямому указанию — "можно сделать обычное перелистывание, как стрелки на
 * попапе награды: нажимаю, появляется новая ячейка плавно"): постраничное переключение (2
 * локации разом, мгновенный свап) заменено на плавную карусель по ОДНОЙ локации.
 *
 * Правка того же дня (по прямому указанию, повторный репорт — "должно быть по 2 карточки
 * локации, при нажатии вниз локация сдвигается вниз, система как в попапе с наградой"): показ
 * ОДНОЙ локации был неверной трактовкой запроса. Задумано ОКНО из ДВУХ одновременно видимых
 * карточек (как раньше top/bottom), но со СДВИГОМ НА ОДНУ локацию за клик (не постраничным
 * свапом сразу по 2, как было раньше). Архитектура та же (itemsWrap+маска+gsap, см. reward.js),
 * изменились только числовые константы шага/окна показа:
 *   - PER_LOC_STEP=237 (шаг между соседними локациями = разница центров старых top/bottom слотов)
 *   - VIEW_H = PER_LOC_STEP*2 + 26 (запас показывает низ второй карточки без обрезания)
 *   - MAX_LOC_INDEX = TOTAL_LOCS-2 (последняя видимая пара всегда полная, без "повисшей" 5-й)
 *
 * Run: node tests/zone-locations-carousel-slide.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');

console.log('\nTest 1: LOCATIONS — 5 локаций плоским списком (не сгруппированы по страницам/2 штуки)');
{
    const start = src.indexOf('const LOCATIONS = [');
    const end   = src.indexOf('const TOTAL_LOCS');
    const block = src.slice(start, end);
    const entries = [...block.matchAll(/\{ file: Z \+ '([^']+)',\s*locIdx: (\d+) \}/g)];
    assert(entries.length === 5, 'ровно 5 записей в LOCATIONS (найдено ' + entries.length + ')');
    const expected = ['кордон.png', 'свалка.png', 'долина.png', 'Агропром.png', 'янтарь.png'];
    entries.forEach((m, i) => {
        assert(m[1] === expected[i], 'локация #' + i + ' — файл ' + expected[i] + ' (найдено ' + m[1] + ')');
        assert(parseInt(m[2]) === i, 'локация #' + i + ' — locIdx=' + i);
    });
    assert(/const TOTAL_LOCS = LOCATIONS\.length;/.test(src), 'TOTAL_LOCS выводится из LOCATIONS.length (не захардкожен отдельно)');
}

console.log('\nTest 2: маска + locWrap — окно показа вмещает РОВНО ДВЕ локации одновременно');
{
    assert(/const locWrap = new PIXI\.Container\(\);/.test(src), 'locWrap — общий контейнер всех групп локаций');
    assert(/const maskGfx = new PIXI\.Graphics\(\);/.test(src), 'Graphics-маска заведена (тот же приём, что reward.js.maskGfx)');
    assert(/maskGfx\.drawRect\(0, VIEW_Y, 1280, VIEW_H\);/.test(src), 'маска — прямоугольник на всю область показа окна');
    assert(/locWrap\.mask = maskGfx;/.test(src), 'маска применена к locWrap');
    assert(/group\.y = i \* SLOT_H;/.test(src), 'каждая группа локации сдвинута на i*SLOT_H — стек локаций друг под другом');
    assert(/const PER_LOC_STEP = 237;/.test(src), 'шаг между соседними локациями — 237 (разница центров старых top/bottom слотов)');
    assert(/const VIEW_BOTTOM_PADDING = 26;[\s\S]*?const VIEW_Y = 120, VIEW_H = PER_LOC_STEP \* 2 \+ VIEW_BOTTOM_PADDING;/.test(src), 'маска имеет 26px запас под вторую карточку и не обрезает её низ');
    assert(/const SLOT_H = PER_LOC_STEP;/.test(src), 'шаг сдвига карусели = шагу между локациями (не высоте всего окна, как в первой версии)');
}

console.log('\nTest 3: _zoneGoToIndex — плавный сдвиг через gsap (как в reward.js), мгновенно только при instant=true');
{
    const start = src.indexOf('proto._zoneGoToIndex = function(instant){');
    const end   = src.indexOf('\n\tproto._zoneUpdateCollect', start);
    assert(start !== -1, '_zoneGoToIndex определена');
    const body = src.slice(start, end);

    assert(/const targetY = -idx \* this\._zoneSlotH;/.test(body), 'целевая позиция — минус индекс * шаг слота (текущая локация возвращается на "нормальную" позицию)');
    assert(/if\(!instant && window\.gsap\)\{/.test(body), 'плавный твин только при обычной навигации (не при первом открытии) и если gsap реально загружен');
    assert(/gsap\.to\(this\._zoneLocWrap, \{ y: targetY, duration: 0\.35, ease: 'power2\.out' \}\);/.test(body),
        'использует gsap.to с той же длительностью/easing, что и reward.js (визуальная консистентность стрелок в проекте)');
    assert(/this\._zoneLocWrap\.y = targetY;/.test(body), 'без gsap (или instant=true) — мгновенный сеттинг y, без анимации');
}

console.log('\nTest 4: клик по стрелкам меняет ИНДЕКС ЛОКАЦИИ на ±1, вниз ограничено MAX_LOC_INDEX (не TOTAL_LOCS-1)');
{
    assert(/if\(this\._zoneLocIndex > 0\)\{ this\._zoneLocIndex--; this\._zoneGoToIndex\(\); \}/.test(src),
        'стрелка ВВЕРХ уменьшает индекс локации на 1 и запускает анимацию');
    assert(/if\(this\._zoneLocIndex < this\._zoneMaxLocIndex\)\{ this\._zoneLocIndex\+\+; this\._zoneGoToIndex\(\); \}/.test(src),
        'стрелка ВНИЗ увеличивает индекс локации на 1, ограничена this._zoneMaxLocIndex (не TOTAL_LOCS-1) — последняя пара всегда полная');
    assert(!/this\._zonePage/.test(src), 'старая переменная _zonePage (страницы) полностью убрана — заменена на _zoneLocIndex');
    assert(/const MAX_LOC_INDEX = Math\.max\(0, TOTAL_LOCS - 2\);/.test(src),
        'MAX_LOC_INDEX = TOTAL_LOCS-2 — не даёт докрутить карусель до состояния "одна карточка видна, вторая пустая"');
}

console.log('\nTest 5: кликабельна ПАРА карточек (текущая И следующая) — обе реально видны в окне из двух слотов');
{
    const start = src.indexOf('proto._zoneGoToIndex = function(instant){');
    const body  = src.slice(start, src.indexOf('const Z = ', start));
    assert(/const active = g\.index === idx \|\| g\.index === idx \+ 1;/.test(body),
        'активны ОБЕ карточки — текущая (idx) и следующая (idx+1), обе реально видны в окне из 2 слотов');
    assert(/g\.capBtn\.interactive = active; g\.capBtn\.buttonMode = active;/.test(body),
        'кнопка ЗАХВАТИТЬ каждой карточки ВНЕ пары принудительно теряет interactive/buttonMode (маска не фильтрует хит-тест)');
}

console.log('\nTest 6: стрелки переключают текстуру активная/неактивная по границам [0, MAX_LOC_INDEX]');
{
    const start = src.indexOf('const up   = this._zoneArrowUp;');
    const end   = src.indexOf('\n\t};', start);
    const body  = src.slice(start, end);
    assert(/const canUp = idx > 0;/.test(body), 'стрелка вверх активна только если есть предыдущая локация');
    assert(/const canDown = idx < this\._zoneMaxLocIndex;/.test(body), 'стрелка вниз активна только в пределах MAX_LOC_INDEX (не TOTAL_LOCS-1)');
}

console.log('\nTest 7: первое открытие экрана — БЕЗ анимации (instant=true), targetLocIdx зажимается в допустимый диапазон');
{
    assert(/this\._zoneGoToIndex\(true\); \/\/ мгновенно/.test(src),
        'начальный вызов _zoneGoToIndex(true) — instant, нет смысла анимировать въезд первой локации при открытии экрана');
    assert(/this\._zoneLocIndex = Math\.min\(targetLocIdx, MAX_LOC_INDEX\);/.test(src),
        'targetLocIdx (переход "ЗАЧИСТИ X!") зажимается в MAX_LOC_INDEX — последняя локация (Янтарь) показывается нижней карточкой полной пары, а не как несуществующий отдельный индекс');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 22.09.2026 (по прямому указанию, два скриншота редактора позиций — карточка
 * локации "кордон" и текст "+930" под фото рекордсмена уважения) —
 *
 *  1) "Сделай все карточки локаций одним размером как на 1 картинке": _applyCardScale
 *     (zone_screen.js) раньше нормализовала ТОЛЬКО высоту (scale = CARD_TARGET_H /
 *     texture.height) — у 5 исходников локаций разное соотношение сторон (Агропром 4.0 против
 *     ~4.25-4.35 у кордон/свалка/долина/янтарь), поэтому при равной высоте (220px) итоговая
 *     ширина карточек плавала от ~880 до ~956px. Эталон с картинки пользователя (карточка
 *     "кордон", уже отрендеренная в её текущем виде) — w=936,h=220 — заведён как
 *     CARD_TARGET_W/H, width И height теперь растягиваются НЕЗАВИСИМО у всех 5 карточек.
 *
 *  2) Подпись суммы уважения под фото рекордсмена ("+930" на скриншоте) — убран префикс "+",
 *     цвет — чёрный (было золото #ffdd44), добавлены масштаб 1.125 и поворот -3°, снятые через
 *     редактор позиций с этого же текстового объекта. Горизонтальное центрирование относительно
 *     рамки (anchor 0.5 + x = центр рамки) не менялось — уже было верным.
 *
 * Run: node tests/zone-cards-uniform-size-and-respect-caption-style.test.js
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

console.log('\nTest 1: CARD_TARGET_W добавлена (936, снята с эталонной карточки "кордон" на скриншоте пользователя)');
{
    assert(/const CARD_TARGET_W = 936;/.test(src), 'CARD_TARGET_W === 936');
}

console.log('\nTest 2: _applyCardScale выставляет width И height НЕЗАВИСИМО (не единый пропорциональный scale)');
{
    const start = src.indexOf('const tex = PIXI.Texture.from(loc.file);');
    const end   = src.indexOf('// Кнопка ЗАХВАТИТЬ');
    const body  = src.slice(start, end);
    assert(/const _applyCardScale = \(\) => \{ spr\.width = CARD_TARGET_W; spr\.height = CARD_TARGET_H; \};/.test(body),
        '_applyCardScale устанавливает spr.width/spr.height напрямую в фиксированные константы');
    assert(!/spr\.scale\.set/.test(body), 'внутри блока построения карточки больше нет spr.scale.set (растяжение теперь через width/height)');
}

console.log('\nTest 3: реальные исходники локаций действительно имеют разное соотношение сторон — фикс не чинит несуществующую проблему');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    function pngSize(filePath){
        const buf = fs.readFileSync(filePath);
        return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    const files = ['кордон.png', 'свалка.png', 'долина.png', 'Агропром.png', 'янтарь.png'];
    const aspects = files.map(f => {
        const { w, h } = pngSize(path.join(IMG_DIR, f));
        return { f, w, h, aspect: w / h };
    });
    console.log('    соотношения сторон:', aspects.map(a => a.f + '=' + a.aspect.toFixed(3)).join(', '));
    const minA = Math.min(...aspects.map(a => a.aspect));
    const maxA = Math.max(...aspects.map(a => a.aspect));
    assert(maxA - minA > 0.2, 'разброс соотношений сторон между исходниками достаточно большой (' +
        (maxA - minA).toFixed(3) + '), чтобы вызывать заметную разницу в ширине при нормализации только высоты');

    // При старой (только-высота) формуле, разброс ширины при equal height=220 был бы ощутимым.
    const CARD_TARGET_H = 220;
    const widths = aspects.map(a => Math.round(a.aspect * CARD_TARGET_H));
    const widthSpread = Math.max(...widths) - Math.min(...widths);
    assert(widthSpread > 50, 'без фикса разброс ширины карточек при равной высоте 220px был бы >50px (реально: ' + widthSpread + 'px)');
}

console.log('\nTest 4: подпись суммы уважения — без "+", чёрный текст, масштаб 1.125 и поворот -3° (с редактора позиций)');
{
    const start = src.indexOf("const _renderRespectLeaders = (users) => {");
    const end   = src.indexOf('const _withResolver =', start);
    const body  = src.slice(start, end);

    // 29.09.2026: реальная реализация ушла от formatRewardAmount к простому String(l.amount) —
    // приставки "+" в обоих случаях нет (это и было сутью правки), абревиатура тысяч (formatRewardAmount)
    // для суммы уважения внутри зоны не используется.
    assert(/const amountTxt = new PIXI\.Text\(String\(l\.amount\), \{/.test(body),
        'текст без префикса "+" — голое число');
    assert(/fill:'#000000'/.test(body), 'цвет текста — чёрный (#000000)');
    assert(!/fill:'#ffdd44'/.test(body), 'старый золотой цвет не остался');
    // 03.10.2026: масштаб уточнён редактором позиций повторно — 1.125 → 1.394.
    // 08.10.2026 (фикс пикселизации текста): scale.set(1.394) убран, коэффициент свёрнут в
    // fontSize (16 → 22).
    assert(/fontSize:22, fill:'#000000', fontWeight:'300',/.test(body), 'fontSize=22 (было 16 × scale 1.394) — снят через редактор позиций');
    assert(!/amountTxt\.scale\.set\(/.test(body), 'amountTxt.scale.set() больше не вызывается');
    // 02.10.2026: -3° — подтверждённый пользователем напрямую финальный угол (см. комментарий
    // у константы в zone_screen.js), не трогать без прямого указания.
    assert(/amountTxt\.rotation = RESPECT_AMOUNT_ROTATION_DEG \* Math\.PI \/ 180;/.test(body), 'поворот применяется через RESPECT_AMOUNT_ROTATION_DEG (сейчас -3°)');
}

console.log('\nTest 5: подпись сдвинута на +5px вправо от центра рамки (подтверждено пользователем 02.10.2026)');
{
    const start = src.indexOf("const _renderRespectLeaders = (users) => {");
    const end   = src.indexOf('const _withResolver =', start);
    const body  = src.slice(start, end);
    assert(/amountTxt\.anchor\.set\(0\.5, 0\);/.test(body), 'anchor.x = 0.5 (пивот по горизонтальному центру)');
    assert(/amountTxt\.x = frameSpr\.x \+ RESPECT_FRAME_W \/ 2 \+ 5;/.test(body),
        'x = центр рамки + 5px (frameSpr.x + половина ширины рамки + отступ) — подтверждённый пользователем выбор, не баг');
    // 24.09.2026 (по прямому указанию, редактор позиций): Y уточнён с "низ рамки" на
    // frameSpr.y + RESPECT_AMOUNT_REL_Y (138, было RESPECT_FRAME_H=167 — на 29px выше).
    assert(/amountTxt\.y = frameSpr\.y \+ RESPECT_AMOUNT_REL_Y;/.test(body), 'y = frameSpr.y + RESPECT_AMOUNT_REL_Y (уточнено редактором, было низ рамки)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

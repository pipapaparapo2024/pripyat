/**
 * Test: 24.09.2026, по прямому указанию + скриншот редактора позиций ("Выбрано: Текст '310'
 * x:1011 y:325 scale:1.125 rot:-5°") — три отдельных находки по рекордсмену уважения на карточке
 * локации (zone_screen.js):
 *
 * 1) Позиция/поворот числа уважения уточнены редактором (было frameSpr.y+RESPECT_FRAME_H/-3°,
 *    стало frameSpr.y+RESPECT_AMOUNT_REL_Y(=138)/-5° — X и scale уже совпадали с прежней формулой).
 * 2) Z-индекс: число и фото рекордсмена вставлялись addChildAt(..., frameIdx/frameIdx+1) — ПЕРЕД
 *    рамкой в списке детей группы, то есть НИЖЕ неё по z-порядку (рамка рисовалась поверх них).
 *    Заменено на addChild (конец списка = верх z-порядка).
 * 3) Обновление после выхода из локации: zone-popup.js прятал попап локации, не пересобирая
 *    zone_screen.js — рекордсмен/сумма уважения не подтягивались заново. Логика вынесена в
 *    отдельный proto._refreshZoneRespectLeaders(), вызываемый и при первой сборке экрана, и из
 *    кнопки выхода из локации.
 *
 * Run: node tests/zone-respect-leader-position-zindex-and-refresh.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

const zoneSrc = read('_client/src/game/shell/overlays/zone_screen.js');
const popupSrc = read('_client/src/game/zone/zone-popup.js');

console.log('\nПозиция/поворот числа уважения — уточнены редактором позиций');
assert(/const RESPECT_AMOUNT_REL_Y = 138;/.test(zoneSrc), 'RESPECT_AMOUNT_REL_Y=138 (167-29, снято с y:325)');
// 02.10.2026: -3° — подтверждённый пользователем напрямую финальный угол, не трогать без
// прямого указания (см. комментарий у константы в zone_screen.js).
assert(/const RESPECT_AMOUNT_ROTATION_DEG = -3;/.test(zoneSrc), 'поворот -3° (подтверждено пользователем)');
assert(/amountTxt\.y = frameSpr\.y \+ RESPECT_AMOUNT_REL_Y;/.test(zoneSrc), 'Y применяется через новую константу');
assert(/amountTxt\.rotation = RESPECT_AMOUNT_ROTATION_DEG \* Math\.PI \/ 180;/.test(zoneSrc), 'поворот применяется через новую константу');
assert(/amountTxt\.x = frameSpr\.x \+ RESPECT_FRAME_W \/ 2 \+ 5;/.test(zoneSrc), 'X сдвинут на +5px вправо от центра — подтверждено пользователем');
// 03.10.2026: масштаб уточнён редактором позиций повторно — 1.125 → 1.394.
// 08.10.2026 (фикс пикселизации текста): scale.set(1.394) убран, коэффициент свёрнут в
// fontSize (16 → 22), см. тот же фикс в zone-cards-uniform-size-and-respect-caption-style.test.js.
assert(/fontSize:22, fill:'#000000', fontWeight:'300',/.test(zoneSrc), 'fontSize=22 (было 16 × scale 1.394) — уточнён редактором позиций');
assert(!/amountTxt\.scale\.set\(/.test(zoneSrc), 'amountTxt.scale.set() больше не вызывается');

console.log('\nZ-индекс — фото и число теперь ВЫШЕ рамки (addChild в конец, не addChildAt перед рамкой)');
assert(!/addChildAt\(photoSpr, frameIdx\)/.test(zoneSrc), 'photoSpr больше не вставляется ПЕРЕД рамкой');
assert(!/addChildAt\(amountTxt, frameIdx \+ 1\)/.test(zoneSrc), 'amountTxt больше не вставляется ПЕРЕД рамкой');
assert(/g\.group\.addChild\(photoSpr\);/.test(zoneSrc), 'photoSpr добавляется в конец списка (выше рамки по z)');
assert(/g\.group\.addChild\(amountTxt\);/.test(zoneSrc), 'amountTxt добавляется в конец списка (выше рамки по z)');

console.log('\nОбновление рекордсмена после выхода из локации');
assert(/proto\._refreshZoneRespectLeaders = function\(\)\{/.test(zoneSrc), '_refreshZoneRespectLeaders вынесена в отдельный метод');
assert(/this\._zoneLocGroupsRef = locGroups;/.test(zoneSrc) && /this\._zoneRespectFrameSpritesRef = respectFrameSprites;/.test(zoneSrc),
    '_openZoneScreen сохраняет ссылки на locGroups/respectFrameSprites для повторного вызова без пересборки карточек');
assert(/\(this\._zoneRespectPhotos \|\| \[\]\)\.forEach\(p => \{ if\(p\.spr && p\.spr\.parent\) p\.spr\.parent\.removeChild\(p\.spr\); \}\);/.test(zoneSrc),
    'старые фото/числа удаляются перед повторным рендером (не копятся друг на друге)');
assert(/iface\._refreshZoneRespectLeaders\(\)/.test(popupSrc), 'zone-popup.js вызывает обновление при выходе из попапа локации');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);

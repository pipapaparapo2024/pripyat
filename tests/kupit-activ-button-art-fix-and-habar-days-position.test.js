/**
 * Test: батч 25.09.2026 (по прямому указанию, скриншот) —
 *
 * 1) 'купить актив.png' на сервере оказался старым битым файлом (полноэкранный холст 1280×720
 *    с кнопкой где-то внутри, перепутан с похожим по имени другим файлом) — заменён на верную
 *    вплотную обрезанную кнопку (236×105, из C:\Users\HONOR\Desktop\vk_game\попапы\кнопки для
 *    попапов (актив пассив)\кнопка купить актив.png, залито под тем же именем на сервер, обе
 *    точки использования кода менять не пришлось). Три места, где рисуется подсветка КУПИТЬ,
 *    переведены с "спрайт уже предпозиционирован внутри полноэкранного файла" / хрупкой
 *    top-left компенсации "-10/-32-N" (подобранной под ДРУГОЙ файл, отмена актив.png) на
 *    anchor(0.5,0.5) + явный центр соответствующей hitBuy-зоны — не зависит от внутренних
 *    отступов конкретного PNG.
 * 2) habar.js — счётчик "N/30" (собранные дни хабара) сдвинут: смещение от timer.x было +40,
 *    стало +62 (снято пользователем через редактор позиций: x:1047 y:504 для купленного слота
 *    3/Элитный — было 1025/504).
 *
 * Run: node tests/kupit-activ-button-art-fix-and-habar-days-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const yashikSrc  = readSrc('_client/src/game/shell/overlays/yashik.js');
const weaponsSrc = readSrc('_client/src/game/weapons.js');
const bossesSrc  = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const habarSrc   = readSrc('_client/src/game/habar.js');

console.log('\nTest 1: yashik.js — buyActiv anchor(0.5,0.5), позиция уточнена редактором позиций (564,413)');
{
    const s = yashikSrc.indexOf("const buyActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'купить актив.png'));");
    const e = yashikSrc.indexOf('win.addChild(buyActiv);', s);
    const body = yashikSrc.slice(s, e);
    assert(/buyActiv\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'anchor(0.5,0.5) — центрирует спрайт вокруг заданной точки');
    // 25.09.2026 (уточнение тем же днём, редактор позиций — "купить актив.png x:564 y:413
    // scale:1.000"): формула-центр hitBuy (566,383) была близкой, но неточной оценкой.
    assert(/buyActiv\.x = 564; buyActiv\.y = 413; buyActiv\.scale\.set\(1\.000\);/.test(body),
        'позиция уточнена напрямую редактором позиций (564,413)');
    assert(!/buyActiv\.x = 448 - 10/.test(body), 'старая top-left компенсация "-10/-32-2" убрана');
}

console.log('\nTest 2: weapons.js._buildConfirmWin — купитьActiv anchor(0.5,0.5) + центр hitBuy(430,352,236,105) = (548,404.5)');
{
    const s = weaponsSrc.indexOf("const купитьActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'купить актив.png'));");
    const e = weaponsSrc.indexOf('cw.addChild(купитьActiv);', s);
    const body = weaponsSrc.slice(s, e);
    assert(/купитьActiv\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'anchor(0.5,0.5)');
    assert(/купитьActiv\.x = 430 \+ 236 \/ 2; купитьActiv\.y = 352 \+ 105 \/ 2;/.test(body),
        'позиция = центр hitBuy (430,352,236,105) → (548,404.5) — раньше спрайт вообще не позиционировался (полагался на полноэкранный файл)');
}

console.log('\nTest 3: bosses_fight.js._openNoWeaponPopup — купитьActiv anchor(0.5,0.5), позиция снята редактором позиций отдельно от хитбокса');
{
    const s = bossesSrc.indexOf("const купитьActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'купить актив.png'));");
    const e = bossesSrc.indexOf('win.addChild(купитьActiv);', s);
    const body = bossesSrc.slice(s, e);
    assert(/купитьActiv\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'anchor(0.5,0.5)');
    // 26.09.2026 (по прямому указанию, повторный снимок редактора позиций): кнопка и хитбокс
    // больше не завязаны на одни и те же числа (было "центр hitBuy" 521.5/410.5) — теперь
    // отдельные явные координаты кнопки (548,406) и отдельно хитбокса (см. Test ниже про hitBuy
    // в no-weapon-popup-parallelogram-hitzones.test.js).
    assert(/купитьActiv\.x = 548; купитьActiv\.y = 406;/.test(body), 'позиция кнопки — x:548,y:406 (снято редактором позиций)');
    assert(/купитьActiv\.scale\.set\(1\.000\);/.test(body), 'масштаб кнопки — 1.000 (нативный размер)');
}

console.log('\nTest 4: habar.js — daysTxt смещение от таймера +62 (было +40), Y не менялся');
{
    const s = habarSrc.indexOf("daysTxt.anchor.set(0.5, 0.5);");
    const e = habarSrc.indexOf('daysTxt.interactive = false;', s);
    const body = habarSrc.slice(s, e);
    // 03.10.2026: offset уточнён редактором позиций повторно — +62 → +86 (x:971,y:506 для слота 3).
    assert(/daysTxt\.x = timer\.x \+ 86;/.test(body), 'offset +86 (снято редактором позиций: x:1057 для купленного слота 3)');
    assert(/daysTxt\.y = timer\.y;/.test(body), 'Y не менялся — уже совпадал (504)');
    assert(!/daysTxt\.x = timer\.x \+ 40;/.test(body), 'старое значение +40 убрано');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

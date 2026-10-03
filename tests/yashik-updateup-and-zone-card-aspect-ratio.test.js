/**
 * Test: 17.09.2026 (шестой батч) — два независимых бага, репорт пользователя со скриншотами:
 *
 *  1) Баг «опыт накопился, а уровень не поднялся» (тултип «550/440 XP», «ДО СЛ. УР.: 0», но
 *     бейдж всё ещё «УР.10»). Причина найдена: из ВСЕХ мест начисления udata['exp'] в проекте
 *     (zone.js×4, dvor.js._give, bosses-combat.js, ryukzak.js) только ДВА обработчика открытия
 *     ящика (yashik.js — крестик-закрытие и кнопка ЗАБРАТЬ) начисляли опыт/монеты/сигареты в
 *     udata, но не вызывали iface.updateUp() — кэш _expCur/_expNext (и бейдж уровня) оставался
 *     устаревшим до следующего случайного вызова updateUp() откуда-то ещё.
 *
 *  2) Баг «сжимает картинки» (карточки локаций Тёмная Долина/Агропром/Янтарь и рамка уважения).
 *     Причина: spr.width/spr.height выставлялись НЕЗАВИСИМО друг от друга (cardW/cardH из PSD-
 *     слота), а нативное соотношение сторон исходников (16.09.2026, напр. янтарь.png 1570×400)
 *     отличается от слота (902×196) — получалось неравномерное растяжение (расплющивание).
 *     Исправлено на единый коэффициент масштаба (Math.min по обеим осям) — пропорции сохраняются,
 *     картинка вписывается в слот без искажения (подтверждено пользователем как желаемый вариант).
 *
 * Run: node tests/yashik-updateup-and-zone-card-aspect-ratio.test.js
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

const yashikSrc = readSrc('_client/src/game/shell/overlays/yashik.js');
const zoneScreenSrc = readSrc('_client/src/game/shell/overlays/zone_screen.js');

// 18.09.2026, перенос экономики на сервер: начисление опыта/наград переехало в
// yashik.php.collect() — крестик и ЗАБРАТЬ теперь ОБА вызывают один и тот же клиентский
// collectReward() (TS.php('yashik.collect', ...)), который применяет applyPatch() (обновляет
// udata['exp'] и т.д. из ответа сервера) и вызывает iface.updateUp() — тот же баг («550/440,
// УР.10» — устаревший HUD без updateUp()) закрыт на новом, общем для обеих кнопок пути.
console.log('\nTest 1: ящик (общий collectReward — крестик и ЗАБРАТЬ) — applyPatch + iface.updateUp() после начисления');
{
    const start = yashikSrc.indexOf('const collectReward = () => {');
    const end   = yashikSrc.indexOf('\t\t};', start);
    const body  = yashikSrc.slice(start, end);
    assert(/TS\.php\('yashik\.collect', \{\}/.test(body), 'найден блок начисления награды (общий для крестика и ЗАБРАТЬ)');
    assert(/applyPatch\(res\.patch\);/.test(body), 'блок применяет патч сервера (обновляет udata[\'exp\'] и т.д.)');
    assert(/iface\.updateUp\(\);/.test(body),
        'iface.updateUp() вызывается после начисления — без этого уровень/HUD остаются устаревшими (баг «550/440, УР.10»)');
}

console.log('\nTest 2: ящик — и крестик, и ЗАБРАТЬ используют этот общий collectReward() (не два раздельных пути начисления)');
{
    const xStart = yashikSrc.indexOf("xCloseBtn.on('pointerdown'");
    const xEnd   = yashikSrc.indexOf('win.addChild(xCloseBtn);');
    assert(/collectReward\(\);/.test(yashikSrc.slice(xStart, xEnd)), 'крестик вызывает collectReward()');

    const zStart = yashikSrc.indexOf("zabratBtn.on('pointerdown'");
    const zEnd   = yashikSrc.indexOf('win.addChild(zabratBtn);');
    assert(/collectReward\(\);/.test(yashikSrc.slice(zStart, zEnd)), 'ЗАБРАТЬ вызывает collectReward()');
}

// 17.09.2026 (позже этого батча, отдельное прямое указание): Math.min (contain) заменён на
// Math.max (cover) — у долина.png/янтарь.png нативные пропорции сильно отличались от слота,
// contain оставлял заметный пустой зазор ("странно сжимается"). cover + маска по размеру
// слота (см. следующий блок кода) — тот же принцип единого коэффициента, другое направление.
console.log('\nTest 3: карточки локаций — фиксированный width И height (по прямому указанию 22.09.2026, отменяет прежнее "сохранять пропорции")');
{
    const start = zoneScreenSrc.indexOf('const tex = PIXI.Texture.from(loc.file);');
    const end   = zoneScreenSrc.indexOf('// Кнопка ЗАХВАТИТЬ');
    const body  = zoneScreenSrc.slice(start, end);
    // 18.09.2026 (позже этого батча, по прямому указанию): даже единый cover-fit коэффициент
    // убран — карточки вставляются в нативном размере файла, точный масштаб под слот теперь
    // задаётся снятой через редактор позиций именованной константой CARD_SCALE.
    // 21.09.2026 (карусель по одной локации): единственный слот теперь общий для всех 5
    // локаций — per-location scaleOverride убран вместе со вторым (нижним) слотом.
    // 22.09.2026: голая CARD_SCALE заменена на per-текстурную нормализацию (CARD_TARGET_H /
    // spr.texture.height) — единый равномерный scale.set (сохраняет пропорции), считается от
    // реальной высоты конкретного файла.
    // 22.09.2026 (повторная правка того же дня, по прямому указанию — "сделай все карточки
    // локаций одним размером как на 1 картинке", скриншот редактора позиций с эталоном
    // w=936,h=220): нормализация ТОЛЬКО высоты оставляла разную ШИРИНУ (разное соотношение
    // сторон исходников — Агропром 4.0 против ~4.25-4.35 у остальных). Явное прямое указание
    // отменяет прежний принцип "сохранять пропорции" — теперь width И height растягиваются
    // независимо (см. zone-cards-uniform-size-and-respect-caption-style.test.js).
    assert(/spr\.width = CARD_TARGET_W; spr\.height = CARD_TARGET_H;/.test(body),
        'width И height выставляются НЕЗАВИСИМО в фиксированные CARD_TARGET_W/H (не единый scale, не сохранение пропорций)');
}

console.log('\nTest 4: рамка уважения — единый коэффициент масштаба (без раздельного width/height)');
{
    const start = zoneScreenSrc.indexOf('const frameTex = PIXI.Texture.from');
    const end   = zoneScreenSrc.indexOf('group.addChild(respectFrame);');
    const body  = zoneScreenSrc.slice(start, end);
    assert(/const frameScale = Math\.min\(RESPECT_FRAME_W \/ frameTex\.width, RESPECT_FRAME_H \/ frameTex\.height\);/.test(body),
        'масштаб рамки — единый коэффициент (min по X и Y)');
    assert(/respectFrame\.scale\.set\(frameScale\);/.test(body), 'применяется через scale.set (сохраняет пропорции)');
    assert(!/respectFrame\.width = RESPECT_FRAME_W; respectFrame\.height = RESPECT_FRAME_H;/.test(zoneScreenSrc),
        'старое независимое растяжение width/height у рамки полностью убрано');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

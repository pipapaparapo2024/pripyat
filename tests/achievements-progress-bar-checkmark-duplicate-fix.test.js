/**
 * Test: 26.09.2026, по прямому указанию (5 скриншотов) —
 *
 * 1) У НЕВЫПОЛНЕННОГО достижения (0% прогресса) виден маленький кусочек заливки прогресс-бара
 *    ("красный кусочек, хотя должно быть пусто") — Math.max(PROGRESS_BAR_H, ...) держал
 *    минимальную ширину заливки даже при frac===0.
 * 2) Разворот темы с несколькими тирами ("автоматная нычка") дублирует ПЕРВУЮ строку — тир,
 *    совпадающий со свёрнутой карточкой темы, показывается сразу дважды подряд.
 * 3) Выполненное одиночное достижение ("Охотник повержен") не показывает галочку — раньше
 *    для НЕ-многотирных тем (membersCount<=1) галочка была жёстко скрыта в пользу бара; теперь
 *    показываются ОБА (галочка не перекрывает бар — CHECK_X стоит сразу за концом бара).
 * 4) Хитбокс кнопки КУПИТЬ в попапе подтверждения покупки оружия был 236×105 (заметно больше
 *    самой кнопки, залезал в текст выше) — приведён к размеру хитбокса ОТМЕНА (227×48, тот же Y).
 * 5) Иконка/аватар в панели "РЕЙТИНГ УРОНА" — координаты редактора позиций (x:29,y:532,
 *    scale:0.542 для строки 0, позже уточнены 29.09.2026 до x:33,y:536,scale:0.500 — см.
 *    tests/bosses-fight-positions-round2.test.js), масштабируется как обычный спрайт вместо
 *    принудительного растяжения в фиксированный квадрат 42×42.
 *
 * Run: node tests/achievements-progress-bar-checkmark-duplicate-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const achSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');
const weaponsSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'weapons.js'), 'utf-8');
const fightSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');

console.log('\nTest 1: svod-achievements.js — заливка бара строго 0px при frac===0, минимальная ширина только при frac>0');
{
    assert(/const fillW = frac > 0 \? Math\.max\(PROGRESS_BAR_H, PROGRESS_BAR_W \* frac\) : 0;/.test(achSrc),
        'fillW явно 0 при frac<=0, иначе — старая формула с минимальной шириной');
    assert(/c\.barFillMask\.drawRoundedRect\(0, 0, fillW, PROGRESS_BAR_H, PROGRESS_BAR_H \/ 2\);/.test(achSrc),
        'drawRoundedRect использует именно fillW, не сырое Math.max(...)');
    assert(!/drawRoundedRect\(0, 0, Math\.max\(PROGRESS_BAR_H, PROGRESS_BAR_W \* frac\), PROGRESS_BAR_H, PROGRESS_BAR_H \/ 2\);/.test(achSrc),
        'старый вызов без условия на frac>0 убран');
}

// 26.09.2026 (реверс тем же днём, по прямому указанию — "по списку после 10к урона должна
// быть раздающая боль, она должна повториться там"): исключение свёрнутого тира из
// развёрнутого списка ломало естественную последовательность порогов (10к → сразу 100к, минуя
// 50к). Фильтр убран — тир снова показывается дважды (в шапке темы и на своём месте в списке
// порогов), это теперь сознательное поведение, не баг.
console.log('\nTest 2: svod-achievements.js — тир, совпадающий со свёрнутой карточкой темы, ПОКАЗЫВАЕТСЯ повторно на своём месте в списке порогов');
{
    assert(/members\.forEach\(tier => \{/.test(achSrc),
        'members рендерится ПОЛНОСТЬЮ (без фильтра по id) — свёрнутая карточка (a) сохраняет своё место в последовательности порогов');
    assert(!/members\.filter\(tier => tier\.id !== a\.id\)/.test(achSrc),
        'фильтр-исключение убран целиком');
}

console.log('\nTest 3: svod-achievements.js — галочка/очки/бейдж показываются для ЛЮБОГО done===true (не только для полностью пройденной многотирной темы)');
{
    // 26.09.2026 (повторный репорт тем же днём — "нет ни галочки, ни очков, ни значка звёзд"):
    // изначальный фикс добавил только checkMark, ptsTxt/starsGotBadge остались жёстко false —
    // теперь все три управляются через done.
    const start = achSrc.indexOf('if(showBar){');
    const body = achSrc.slice(start, start + 3200);
    assert(/c\.checkMark\.visible = done;/.test(body), 'checkMark.visible напрямую = done (не жёсткий false)');
    assert(/c\.starsGotBadge\.visible = done;/.test(body), 'starsGotBadge.visible тоже = done');
    assert(/c\.ptsTxt\.visible = done;/.test(body), 'ptsTxt.visible тоже = done');
    assert(/c\.bar\.visible = true; c\.fracTxt\.visible = false;/.test(body), 'бар по-прежнему остаётся видимым рядом с галочкой (не взаимоисключающе)');

    // Регресс-гвард: ветка "тема из нескольких тиров полностью пройдена" (checkMark в else)
    // не тронута — там всё ещё используется отдельная безусловная true, а не done.
    const elseIdx = achSrc.indexOf('c.checkMark.visible = true; // themeComplete');
    assert(elseIdx !== -1, 'ветка "тема полностью пройдена" (checkMark=true безусловно) сохранена без изменений');
}

console.log('\nTest 4: weapons.js — хитбокс КУПИТЬ приведён к размеру/Y хитбокса ОТМЕНА (227×48, y:386), меняется только X');
{
    assert(/const hitBuy = makeParallelogramHit\(cw, 430, 386, 227, 48, 18\);/.test(weaponsSrc),
        'hitBuy — та же ширина/высота/Y/наклон, что и hitCancel, отличается только X (430 vs 665)');
    assert(/const hitCancel = makeParallelogramHit\(cw, 665, 386, 227, 48, 18\);/.test(weaponsSrc),
        'hitCancel не тронут (регресс-гвард — эталон, с которого скопирован размер)');
    assert(!/makeParallelogramHit\(cw, 430, 352, 236, 105, 18\);/.test(weaponsSrc),
        'старый несоразмерный хитбокс КУПИТЬ (236×105) убран целиком');
}

console.log('\nTest 5: bosses_fight.js — аватар рейтинга: координаты (x:37,y:541 для строки 0, уточнено 29.09.2026) и scale:0.324 вместо фикс. 42×42');
{
    // 29.09.2026: второе точечное уточнение позиции редактором в тот же день (было x:33,y:536,
    // scale:0.500) — см. bosses-fight-positions-round2.test.js для полного описания того же
    // замера; этот тест проверяет только сам факт "не растягивается в фиксированный квадрат".
    // 02.10.2026: AV_SCALE уточнён ещё раз редактором позиций, 0.472 → 0.324 (см. актуальное
    // значение в bosses_fight.js и tests/onboarding-permission-and-roulette-assets.test.js) —
    // тест обновлён под текущее значение, смысл проверки (scale, не фиксированный квадрат) тот же.
    assert(/const FRAME_X = 27, FRAME_Y = \[528, 589, 652\];/.test(fightSrc) && /const AV_X = 32, AV_Y = \[532, 593, 656\];/.test(fightSrc), 'рамки и аватары рейтинга стоят по актуальным координатам');
    assert(/const AV_SCALE = 0\.324;/.test(fightSrc), 'AV_SCALE = 0.324 объявлена');
    assert(/avSpr\.scale\.set\(AV_SCALE\); avSpr\.x = avX; avSpr\.y = avY;/.test(fightSrc),
        'avSpr использует scale.set(AV_SCALE), не фиксированные width/height=42');
    assert(!/avSpr\.width = 42; avSpr\.height = 42;/.test(fightSrc), 'старое принудительное растяжение 42×42 убрано');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

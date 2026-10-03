/**
 * Test: батч 21.09.2026 (по прямому указанию, повторный репорт со скриншотами) —
 *
 *  1) «Мои достижения»: карточки всё ещё имели "прозрачные отступы сверху и снизу". Прямым
 *     разбором альфа-канала «кароточка достижений.png» (671×149, RGBA) выяснено: реальный
 *     непрозрачный рисунок занимает только строки 43..112 (высота 70px) — 43px пустого поля
 *     сверху и 36px снизу. Раньше ВСЯ раскладка (позиции текста, шаг между карточками)
 *     считалась от полных 149px, как будто рисунок занимает всю карточку — из-за этого текст
 *     "улетал" в прозрачную зону, а шаг между карточками включал несуществующие лишние px.
 *     Фикс: шаг между карточками = CARD_VISIBLE_H(70) + CARD_GAP(10), позиции текста/иконки/
 *     звезды/шеврона — внутри видимой полосы 43..112, а не 0..149.
 *
 *  2) Скролл-контент опущен на 36px (LIST_TOP 169→169+36) — первая карточка была слишком
 *     близко к заголовкам "МЕСТО/ИГРОК/УРОВЕНЬ/ДОСТИЖЕНИЯ", запечённым в фоне панели.
 *
 *  3) Профиль игрока: убрана дублирующая надпись "Уровень/Авторитет/Боссов убито" позади
 *     визитки; сама визитка поднята на 30px, повёрнута на -2° (тот же приём, что фото
 *     рекордсмена уважения в zone_screen.js), весь текст на ней — белый.
 *
 * Run: node tests/svod-achievements-card-visible-bounds-and-visit-card.test.js
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const svodAchSrc = readSrc('_client/src/game/svod/svod-achievements.js');
const profileSrc = readSrc('_client/src/game/shell/overlays/player_profile.js');

// Тот же простой PNG-декодер альфа-канала, что использовался для диагностики бага — повторная
// проверка гарантирует, что измеренные константы в коде НЕ разъедутся с реальным файлом при
// будущей замене ассета (тест упадёт и напомнит пересчитать CARD_VISIBLE_TOP/H).
function measureVisibleRowsPng(relPath){
    const buf = fs.readFileSync(path.join(root, relPath));
    let pos = 8, width, height, colorType;
    const idat = [];
    while(pos < buf.length){
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos+4, pos+8);
        const data = buf.slice(pos+8, pos+8+len);
        if(type === 'IHDR'){ width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data.readUInt8(9); }
        else if(type === 'IDAT') idat.push(data);
        else if(type === 'IEND') break;
        pos += 8 + len + 4;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const channels = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1);
    const stride = width * channels;
    let offset = 0, prevRow = new Uint8Array(stride);
    let firstOpaque = -1, lastOpaque = -1;
    const maxSum = 255 * width;
    for(let row = 0; row < height; row++){
        const filterType = raw[offset]; offset++;
        const rowData = raw.slice(offset, offset + stride); offset += stride;
        const out = Buffer.alloc(stride);
        for(let i = 0; i < stride; i++){
            const a = i >= channels ? out[i-channels] : 0;
            const b = prevRow[i];
            const c = i >= channels ? prevRow[i-channels] : 0;
            let val = rowData[i];
            if(filterType===1) val = (val+a)&0xff;
            else if(filterType===2) val = (val+b)&0xff;
            else if(filterType===3) val = (val+((a+b)>>1))&0xff;
            else if(filterType===4){
                const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
                val = (val+((pa<=pb&&pa<=pc)?a:(pb<=pc?b:c)))&0xff;
            }
            out[i] = val;
        }
        prevRow = out;
        let alphaSum = 0;
        if(channels === 4) for(let x=0;x<width;x++) alphaSum += out[x*4+3];
        else alphaSum = maxSum;
        if(alphaSum > maxSum*0.02){ if(firstOpaque===-1) firstOpaque = row; lastOpaque = row; }
    }
    return { width, height, firstOpaque, lastOpaque, visibleH: lastOpaque - firstOpaque + 1 };
}

console.log('\nTest 1: "кароточка достижений.png" обрезан до реальных видимых границ (22.09.2026) — файл == видимый контент');
{
    const m = measureVisibleRowsPng('_client/development/images/кароточка достижений.png');
    console.log('    измерено: width=' + m.width + ' height=' + m.height + ' firstOpaque=' + m.firstOpaque + ' lastOpaque=' + m.lastOpaque + ' visibleH=' + m.visibleH);
    // 22.09.2026 (повторный репорт — "ячейки всё ещё имеют прозрачные отступы"): вместо
    // компенсации в раскладке файл обрезан по измеренным границам (были firstOpaque=43,
    // visibleH=70 у старого 149px файла) — теперь весь файл (70px) видим с первой строки.
    assert(m.firstOpaque === 0, 'верхняя граница видимого рисунка — строка 0 (крой убрал прозрачное поле сверху)');
    assert(m.visibleH === 70, 'высота видимого рисунка — 70px, равна полной высоте файла');
    assert(m.height === 70, 'сам файл теперь 70px высотой (было 149px)');

    assert(!/const CARD_VISIBLE_TOP/.test(svodAchSrc), 'CARD_VISIBLE_TOP как отдельная константа убран (крой уже сдвинул точку отсчёта в 0)');
    assert(/const CARD_VISIBLE_H = 70;/.test(svodAchSrc), 'CARD_VISIBLE_H=70 совпадает с реальной высотой обрезанного файла');
}

console.log('\nTest 2: шаг между карточками — реальный видимый зазор (не полная высота текстуры с прозрачными полями)');
{
    assert(/const CARD_STEP = CARD_VISIBLE_H \+ CARD_GAP;/.test(svodAchSrc),
        'CARD_STEP считается от видимой высоты (70) + зазора (10) = 80, а не от CARD_H (149) + зазора = 159');
    assert(/stepPx: CARD_STEP,/.test(svodAchSrc), 'скролл использует тот же CARD_STEP (колёсико/стрелки листают на реальный видимый шаг)');
    assert((svodAchSrc.match(/y \+= CARD_STEP;/g) || []).length === 2,
        'ОБА места приращения y (базовая карточка темы И строка тира) используют CARD_STEP (нашли: ' +
        (svodAchSrc.match(/y \+= CARD_STEP;/g) || []).length + ')');
    assert(!/y \+= CARD_H \+ CARD_GAP;/.test(svodAchSrc), 'старая формула (полная высота текстуры) нигде не осталась');
}

console.log('\nTest 3: внутренние элементы карточки (имя/описание/иконка/звезда) — координаты 0..70 (крой убрал сдвиг)');
{
    assert(/const ICON_CENTER_Y   = CARD_VISIBLE_H \/ 2;/.test(svodAchSrc), 'центр иконки/звезды — половина видимой высоты (35), без CARD_VISIBLE_TOP-сдвига');
    // 22.09.2026: NAME_Y уточнён редактором позиций дважды тем же днём (5→14→11), см. тест ниже про nameTxt.x/y.
    assert(/const NAME_Y = 11;/.test(svodAchSrc), 'имя темы/тира — y=11 (уточнено редактором позиций)');
    assert(/const DESC_Y          = 29;/.test(svodAchSrc), 'описание — y=29 (уточнено редактором позиций, было 26)');
    assert(/const PTS_Y           = 50;/.test(svodAchSrc), 'очки/прогресс-бар — y=50, до нижней границы (50+высота бара ≤ 70)');
    assert(/iconTxt\.x = ICON_X; iconTxt\.y = ICON_CENTER_Y;/.test(svodAchSrc), 'иконка (фолбэк-эмодзи) привязана к ICON_X/ICON_CENTER_Y (было голое число 60)');
    assert(/nameTxt\.x = NAME_X; nameTxt\.y = NAME_Y;/.test(svodAchSrc), 'имя привязано к NAME_X/NAME_Y (было голое число 120)');
    assert(/star\.x = CARD_W - 60; star\.y = ICON_CENTER_Y;/.test(svodAchSrc), 'звезда привязана к ICON_CENTER_Y');
    assert(!/const chevron = new PIXI\.Text/.test(svodAchSrc), 'стрелка раскрытия убрана: тема раскрывается кликом по карточке');
}

console.log('\nTest 4: первая карточка поднята на 12px, чтобы уменьшить верхний зазор');
{
    // 22.09.2026: +50px поверх прежнего сдвига (по прямому указанию, повторный репорт про
    // верхнюю границу списка), см. svod-scroll-bounds-and-achievements-top-offset.test.js.
    // 25.09.2026: LIST_TOP/LIST_H стали явными значениями из редактора позиций (242/286),
    // формула 169+36+38/расчётный LIST_H — история, не текущий код, см.
    // svod-scroll-editable-mask-and-dice-background-fix.test.js.
    assert(/const LIST_TOP = 242, LIST_H = 286;/.test(svodAchSrc),
        'LIST_TOP=242 (эквивалент прежних 169+36+38=243, -1px от редактора), LIST_H=286 — оба сняты напрямую');
}

console.log('\nTest 5: player_profile.js — дублирующая надпись убрана, визитка поднята/повёрнута, весь текст белый');
{
    assert(!/const statsTxt = new PIXI\.Text\(/.test(profileSrc), 'statsTxt ("Уровень/Авторитет/Боссов убито" позади визитки) убран целиком');

    assert(/const CARD_X = 6, CARD_Y = 77 - 30;/.test(profileSrc), 'визитка поднята на 30px (77 → 47)');
    assert(/const CARD_ROTATION_DEG = -2;/.test(profileSrc), 'угол поворота -2° (против часовой)');
    assert(/card\.rotation = CARD_ROTATION_DEG \* Math\.PI \/ 180;/.test(profileSrc), 'поворот применяется на контейнере card — все дочерние элементы поворачиваются вместе с ним');

    const start = profileSrc.indexOf('proto._buildVisitCard = function');
    const end   = profileSrc.indexOf('\n    };', start);
    const body  = profileSrc.slice(start, end);
    assert(!/fill: '#ffcc44'/.test(body) && !/fill: '#a89a88'/.test(body),
        'внутри _buildVisitCard не осталось золотого/серого текста — все поля используют белый');
    assert(/fill: '#ffffff', fontWeight: 'bold',$/m.test(body) || /CARD_VALUE_STYLE/.test(body),
        'значения полей карточки используют белый CARD_VALUE_STYLE');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

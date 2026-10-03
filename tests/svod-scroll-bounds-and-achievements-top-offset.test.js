/**
 * Test: батч 22.09.2026 (по прямому указанию, скриншот вкладки "Мои достижения") —
 *
 *  1) Баг "скролл должен двигаться строго по шкале скролла, но выходит за границы": бегунок
 *     (_buildSvodScroll, svod-scroll.js) считал диапазон движения (trackTop/trackBottom) от
 *     viewY/viewH — высоты ВИДИМОЙ ОБЛАСТИ СПИСКА (mask-контейнера), а не от реальных размеров
 *     самого трека ("шкала скрола.png", нативная высота 242px). У лидерборда viewH тоже был
 *     242 — баг маскировался совпадением. У вкладки "Мои достижения" viewH подняли до 332
 *     (вмещать 4-ю карточку, более раннее прямое указание) — бегунок стал уезжать на 90px
 *     ниже физического низа нарисованного трека. Исправлено: диапазон считается от
 *     track.y/track.height, а не от viewY/viewH.
 *
 *  2) "Сверху ограничение для ячеек достижений слишком маленькое" — верхняя граница маски
 *     списка (LIST_TOP в svod-achievements.js) стояла слишком высоко, верх предыдущей
 *     проскроленной карточки был виден над первой видимой. Сдвинута вниз на 50px (чисто
 *     позиционно — LIST_H, отвечающая за то, что помещается 4 карточки, не менялась).
 *
 * Run: node tests/svod-scroll-bounds-and-achievements-top-offset.test.js
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

const scrollSrc = readSrc('_client/src/game/svod/svod-scroll.js');
const achSrc     = readSrc('_client/src/game/svod/svod-achievements.js');

console.log('\nTest 1: svod-scroll.js — диапазон движения бегунка считается от track.y/track.height, не от viewY/viewH');
{
    assert(/let trackTop = track\.y, trackBottom = track\.y \+ track\.height - thumb\.height;/.test(scrollSrc),
        'начальная инициализация trackTop/trackBottom — от размеров реального спрайта трека');
    assert(!/let trackTop = viewY, trackBottom = viewY \+ viewH - thumb\.height;/.test(scrollSrc),
        'старая (баговая) формула от viewY/viewH не осталась');

    const refreshStart = scrollSrc.indexOf('const refresh = () => {');
    const refreshEnd   = scrollSrc.indexOf('\n        };', refreshStart);
    const refreshBody  = scrollSrc.slice(refreshStart, refreshEnd);
    assert(/trackBottom = track\.y \+ track\.height - thumb\.height;/.test(refreshBody),
        'refresh() тоже пересчитывает trackBottom от track.y/track.height (не от viewY/viewH)');
}

console.log('\nTest 2: sanity — трек "шкала скрола.png" физически меньше (242px), чем viewH вкладки "Мои достижения" — именно это и вызывало баг, фикс (trackTop/trackBottom от track.y/height) остаётся актуальным');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    const trackPath = path.join(IMG_DIR, 'шкала скрола.png');
    assert(fs.existsSync(trackPath), 'файл "шкала скрола.png" существует');
    if(fs.existsSync(trackPath)){
        const buf = fs.readFileSync(trackPath);
        const trackH = buf.readUInt32BE(20); // PNG IHDR: высота на смещении 20
        assert(trackH === 242, 'нативная высота трека — 242px, получили ' + trackH);

        // 25.09.2026: LIST_H стал явным литералом (снят редактором позиций), а не формулой —
        // см. svod-scroll-editable-mask-and-dice-background-fix.test.js. Sanity здесь не про
        // конкретное число, а про то, что viewH по-прежнему БОЛЬШЕ высоты трека — именно это
        // расхождение и требует фикса выше (trackTop/trackBottom от track.y/height).
        const listHMatch = achSrc.match(/const LIST_TOP = \d+, LIST_H = (\d+);/);
        assert(!!listHMatch, 'LIST_H найден в svod-achievements.js');
        if(listHMatch){
            const listH = +listHMatch[1];
            assert(listH > trackH, 'viewH вкладки "Мои достижения" (' + listH + 'px) больше высоты трека (' + trackH + 'px) — без фикса бегунок уезжал бы за пределы трека');
        }
    }
}

console.log('\nTest 3: svod-achievements.js — LIST_TOP/LIST_H (25.09.2026: явные значения из редактора позиций, было формулой)');
{
    assert(/const LIST_TOP = 242, LIST_H = 286;/.test(achSrc),
        'LIST_TOP=242, LIST_H=286 — снято пользователем напрямую через редактор позиций (маска списка теперь редактируемая, см. svod-scroll.js)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 15.09.2026 (bosses_select.js) —
 *  1) Связка ключей теперь рисуется на ВСЕХ 8 карточках, включая Охотника (i===0) —
 *     раньше был отдельный `if(i !== 0)`, из-за которого на Охотнике не было ни иконки,
 *     ни счётчика "N КЛЮЧЕЙ" (репорт: "файл связки ключей не выводится на охотника").
 *  2) Иконка связки ключей больше не тускнеет (alpha=0.5), когда ключей не хватает —
 *     всегда полная непрозрачность.
 *  3) Рамка "особо опасен" (FRAME_REL_X/Y) и фото "убившего" (KILLER_CX/CY/W/H/ROTATION)
 *     сдвинуты на новые координаты, снятые пользователем через редактор позиций.
 *
 * Run: node tests/bosses-select-keys-and-frame.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'),
    'utf-8'
);

console.log('\nTest 1: связка ключей больше не пропускает Охотника (i===0)');
{
    assert(!/if\(i !== 0\)\{/.test(src), 'спец-случай "if(i !== 0)" для ключей убран');
    assert(!/if\(needKeys > 0\)\{\s*\n\s*const KEYCHAIN_TARGET_H/.test(src),
        'иконка связки ключей больше не скрыта условием needKeys>0 (рисуется всегда)');
}

console.log('\nTest 2: иконка ключей больше не тускнеет при нехватке');
{
    assert(!/kcSpr\.alpha = \(activeKeys >= needKeys\) \? 1\.0 : 0\.5/.test(src),
        'логика "activeKeys>=needKeys ? 1.0 : 0.5" удалена');
    assert(!/const activeKeys = Math\.min\(have, needKeys\);/.test(src),
        'activeKeys (использовался только для затемнения) больше не нужен');
    assert(/kcSpr\.alpha = 0\.7;/.test(src), 'связка ключей имеет заданную прозрачность 70%');
}

console.log('\nTest 6: число ключей ограничено 999 и центрируется по длине');
{
    assert(/const shownKeys = Math\.min\(999, have\);/.test(src), 'вывод ограничен 999 без изменения реального баланса');
    assert(/const KEY_TEXT_X_BY_DIGITS = \{ 1: 296, 2: 293, 3: 286 \};/.test(src), 'координаты 1/2/3 цифр совпадают с макетом');
    assert(/keysTxt\.y = cardY \+ 20;/.test(src), 'единый Y относительно карточки');
}

console.log('\nTest 3: счётчик "N КЛЮЧЕЙ" рисуется для каждого босса (включая Охотника)');
{
    const m = src.match(/\{\s*\n\s*const needKeys[\s\S]*?keysTxt\.y = cardY[\s\S]*?cardsContainer\.addChild\(keysTxt\);\s*\n\s*\}/);
    assert(!!m, 'единый блок иконка+счётчик ключей найден (без обёртки if(i!==0))');
}

console.log('\nTest 4: новые координаты рамки "особо опасен"');
{
    assert(/const FRAME_REL_X = 648, FRAME_REL_Y = 8;/.test(src), 'FRAME_REL_X=648 FRAME_REL_Y=8');
}

console.log('\nTest 5: новые координаты/размер/поворот фото "убившего"');
{
    assert(/const KILLER_CX = 722, KILLER_CY = 90;/.test(src), 'KILLER_CX=722 KILLER_CY=90');
    assert(/const KILLER_W = 106, KILLER_H = 106;/.test(src), 'KILLER_W=106 KILLER_H=106 (квадрат, было 90×74)');
    assert(/const KILLER_ROTATION = -3 \* Math\.PI \/ 180;/.test(src), 'KILLER_ROTATION = -3°');
    assert(/spr\.rotation = KILLER_ROTATION;/.test(src), 'rotation применяется к спрайту/плейсхолдеру фото');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

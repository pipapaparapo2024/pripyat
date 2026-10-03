/**
 * Test: батч 22.09.2026 (по прямому указанию, координаты сняты редактором позиций через
 * "БОКС ДЛЯ ТЕКСТА" — universal_pos_editor.js) —
 *
 * 1) Текст суммы джекпота и ник победителя рулетки теперь центрируются в размеченных боксах
 *    через window._centerTextIn (ui_kit.js) вместо ручного anchor+x/y — координаты боксов сняты
 *    прямо в игре тем же инструментом, что раньше диктовал x/y для позиционных правок.
 * 2) "Слева окошко, куда вставляется изображение человека, который сорвал куш, подставь любое
 *    изображение для проверки" — добавлен временный плейсхолдер (своё фото из vk_user_info,
 *    тот же fallback-паттерн на серый прямоугольник, что у zone_screen.js), чисто чтобы было
 *    видно окно — реальная привязка к данным победителя это отдельная задача.
 *
 * Run: node tests/roulette-jackpot-winner-textbox-centering-and-photo-placeholder.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');
const uiKitSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'ui_kit.js'), 'utf-8');

console.log('\nTest 1: window._centerTextIn существует и работает так, как ожидает эта правка (ui_kit.js)');
{
    assert(/window\._centerTextIn = \(text, box\) => \{/.test(uiKitSrc), '_centerTextIn(text, box) определён глобально');
    assert(/text\.anchor\.set\(0\.5, 0\.5\);/.test(uiKitSrc), 'выставляет anchor(0.5,0.5) — центр текста');
    assert(/text\.x = box\.x \+ box\.w \/ 2;/.test(uiKitSrc) && /text\.y = box\.y \+ box\.h \/ 2;/.test(uiKitSrc),
        'позиционирует по центру бокса {x,y,w,h}');
}

console.log('\nTest 2: сумма джекпота (_roulJackTxt) центрируется в боксе, снятом редактором позиций 03.10.2026 (x:748,y:203,w:152,h:42 — поднято на 13px)');
{
    assert(/window\._centerTextIn\(jackTxt, \{x:748, y:203, w:152, h:42\}\);/.test(src),
        'jackTxt центрируется через _centerTextIn с точными координатами из скриншота редактора');
    assert(!/jackTxt\.anchor\.set\(0\.5, 0\.5\);\s*\n\s*jackTxt\.x = 846; jackTxt\.y = 227;/.test(src),
        'старое ручное anchor+x/y для jackTxt убрано (заменено на _centerTextIn)');
}

// 23.09.2026: бокс уточнён повторным снимком редактора позиций — было {x:794,y:285,w:152,h:42},
// стало {x:794,y:288,w:152,h:31} (см. tests/roulette-sector-highlight-removed.test.js Test 4).
console.log('\nTest 3: ник победителя (_roulWinnerNameTxt) центрируется в боксе, снятом редактором позиций 03.10.2026 (x:794,y:278,w:152,h:31 — поднято на 10px)');
{
    assert(/window\._centerTextIn\(winnerNameTxt, \{x:794, y:278, w:152, h:31\}\);/.test(src),
        'winnerNameTxt центрируется через _centerTextIn с точными координатами из скриншота редактора');
    assert(!/winnerNameTxt\.anchor\.set\(0, 0\.5\);\s*\n\s*winnerNameTxt\.x = 830; winnerNameTxt\.y = 293;/.test(src),
        'старое ручное anchor(0,0.5)+x/y для winnerNameTxt убрано (было лево-выровнено, стало центрировано)');
}

// 24.09.2026 (несвязанной правкой, тот же принцип, что уже применён к winnerNameTxt):
// сумма выигрыша (_roulWinnerAmtTxt) тоже переведена на window._centerTextIn() — центрируется
// внутри бокса, размеченного редактором позиций, вместо ручного anchor(0,0.5)+x/y. Расширение
// уже установленной консистентности, не регресс.
console.log('\nTest 4: сумма выигрыша (_roulWinnerAmtTxt) тоже центрируется через window._centerTextIn() — box y:332→320 (поднято на 12px, 03.10.2026)');
{
    assert(/window\._centerTextIn\(winnerAmtTxt, \{x:848, y:320, w:104, h:23\}\);/.test(src),
        '_roulWinnerAmtTxt центрируется в размеченном боксе (та же система, что у winnerNameTxt)');
}

// 23.09.2026: "временный плейсхолдер (своё фото)" заменён на реальную привязку к данным —
// иконка-заглушка по умолчанию + настоящее фото победителя по VK id, см.
// tests/roulette-jackpot-winner-real-photo.test.js для полной проверки нового поведения.
console.log('\nTest 5: регресс-гвард — _roulWinnerPhotoSpr всё ещё существует и сохранён на инстансе');
{
    assert(/this\._roulWinnerPhotoSpr = winnerPhotoSpr;/.test(src), '_roulWinnerPhotoSpr сохранён на инстансе');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

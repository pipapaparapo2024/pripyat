/**
 * Test: два независимых фикса.
 *
 * 1) Блэкджек — рамка подсветки строки "ЛЮБАЯ НЕПАРНАЯ КОМБИНАЦИЯ" перенесена на
 *    координаты, снятые редактором позиций (15.09.2026): шире и выше остальных 8 строк
 *    (293×38 вместо 290×35.2, y:511), центр X (915) совпадает с остальными строками —
 *    только эта строка, 8 парных комбинаций не затронуты.
 *
 * 2) server/universal_pay.php — VK Payments API notification-эндпоинт отдавал photo_url
 *    товаров со СТАРОГО (сменившегося 14.09.2026) хостинга xuliki.top, который сейчас
 *    полностью недоступен (curl -> HTTP 000) — из-за этого VK не мог загрузить иконку
 *    товара в попапе оплаты (пустая заглушка вместо картинки). Актуальный домен —
 *    pripyat-game.ru, где эти же файлы реально существуют (проверено curl -> HTTP 200).
 *
 * Run: node tests/bj-nonpair-highlight-and-payment-domain.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const bj = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8'
);
const pay = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'universal_pay.php'), 'utf-8'
);

console.log('\nTest 1: блэкджек — "ЛЮБАЯ НЕПАРНАЯ КОМБИНАЦИЯ" по ОБЩЕЙ формуле (22.09.2026: раньше была отдельными константами 293×38/y:511, теперь unified — см. blackjack-combo-highlight-point-data-and-error-popup-position.test.js)');
{
    assert(/'__nonpair':\s*501,/.test(bj), "__nonpair теперь ОБЫЧНАЯ запись в BJ_ROW_Y (475, нативный размер фона 04.10.2026), не отдельные BJ_NONPAIR_* константы");
    assert(!/BJ_NONPAIR_W|BJ_NONPAIR_H|BJ_NONPAIR_CY/.test(bj), 'старые BJ_NONPAIR_* константы убраны целиком');
    assert(!/const isNonpair = key === '__nonpair';/.test(bj), 'ветвление isNonpair убрано — все 9 строк (включая nonpair) используют одну и ту же ширину/высоту (BJ_ROW_W/BJ_ROW_H)');
}

console.log('\nTest 2: universal_pay.php — photo_url товаров указывают на актуальный домен pripyat-game.ru');
{
    assert(!/https:\/\/xuliki\.top/.test(pay), 'мёртвый домен xuliki.top больше нигде не используется в URL');
    // 27.09.2026 (устаревший тест, найдено полным прогоном): generic-заглушки tcoin/rubles/semki.jpg
    // заменены на donate_*_icon.png — см. отдельный tests/universal-pay-donate-icons-mismatch-fix.test.js.
    assert(/'stew'=>'https:\/\/pripyat-game\.ru\/server\/images\/donate_stew_icon\.png'/.test(pay), 'тушёнка — актуальный домен');
    assert(/'coins'=>'https:\/\/pripyat-game\.ru\/server\/images\/donate_coins_icon\.png'/.test(pay), 'монеты — актуальный домен');
    assert(/'cigarettes'=>'https:\/\/pripyat-game\.ru\/server\/images\/donate_cigarettes_icon\.png'/.test(pay), 'сигареты — актуальный домен');
    assert(/'photo_url' => \$registry\['links'\]\['energy'\],/.test(pay), 'энергия (item100-107) — актуальный домен');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

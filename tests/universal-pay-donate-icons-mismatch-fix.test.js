/**
 * Test: 27.09.2026, репорт — "в попапе покупки тушёнки (VKWebAppShowOrderBox) иконка не та".
 *
 * Причина: photo_url для карточек товара в get_item брался из $registry['links'], который
 * указывал на старые generic-заглушки (tcoin.jpg — банка с закрытой крышкой, rubles.jpg —
 * пачка денег, semki.jpg — семечка), никак не связанные с актуальным артом валют в игре
 * (interface_up_panel_stew_icon.png и т.п.) и не обновлявшиеся вместе с ним.
 *
 * Фикс: $registry['links'] указывает на donate_*_icon.png (server/images/), скопированные
 * из того же источника, что и иконки ачивок (achievements/тушенка.png, рубли.png, сиги.png).
 *
 * Run: node tests/universal-pay-donate-icons-mismatch-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'server', 'universal_pay.php'), 'utf-8');

// 27.09.2026: проверять надо КОД, а не поясняющие комментарии — сами имена заглушек в них
// упоминаются намеренно (история бага). Без вырезания //-комментариев тест падал на своём же
// объяснении — тот же класс дефекта, что у 6 тестов, починенных этим утром.
const codeOnly = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

console.log('\nTest: registry.links больше не указывает на старые generic-заглушки');
assert(!codeOnly.includes("tcoin.jpg"), 'tcoin.jpg (банка с закрытой крышкой, не тушёнка) удалён из кода');
assert(!codeOnly.includes("rubles.jpg"), 'rubles.jpg (не совпадает с артом монет/энергии) удалён из кода');
assert(!codeOnly.includes("semki.jpg"), 'semki.jpg (семечка вместо пачки сигарет) удалён из кода');

console.log('\nTest: энергия (item100-107) тоже на своей иконке, а не на rubles.jpg');
assert(/'energy'\s*=>\s*'https:\/\/pripyat-game\.ru\/server\/images\/donate_energy_icon\.png'/.test(src),
    'links.energy → donate_energy_icon.png');
assert(/'photo_url'\s*=>\s*\$registry\['links'\]\['energy'\]/.test(src),
    'карточки энергии берут photo_url из registry.links.energy (не хардкод jpg)');
assert(fs.existsSync(path.join(root, 'server', 'images', 'donate_energy_icon.png')),
    'server/images/donate_energy_icon.png существует локально');

console.log('\nTest: registry.links указывает на новые именованные иконки');
assert(/'stew'\s*=>\s*'https:\/\/pripyat-game\.ru\/server\/images\/donate_stew_icon\.png'/.test(src),
    "stew → donate_stew_icon.png");
assert(/'coins'\s*=>\s*'https:\/\/pripyat-game\.ru\/server\/images\/donate_coins_icon\.png'/.test(src),
    "coins → donate_coins_icon.png");
assert(/'cigarettes'\s*=>\s*'https:\/\/pripyat-game\.ru\/server\/images\/donate_cigarettes_icon\.png'/.test(src),
    "cigarettes → donate_cigarettes_icon.png");

console.log('\nTest: локальные файлы иконок существуют перед деплоем (upload.sh их читает по этим путям)');
for (const name of ['donate_stew_icon.png', 'donate_coins_icon.png', 'donate_cigarettes_icon.png']) {
    const p = path.join(root, 'server', 'images', name);
    assert(fs.existsSync(p), `server/images/${name} существует локально`);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

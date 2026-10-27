/**
 * Test: 26.10.2026 — по прямому указанию ("для шмотки маска исполнитель моргания не должно
 * быть"). id116 "Маска (Исполнитель)" (cat:0, голова, shmot.js) — мини-анимация моргания
 * (21.10.2026, "глаза закрыты.png", интервал 15с) не должна срабатывать, пока эта маска надета.
 * Анимация продублирована в трёх местах, показывающих персонажа (home.js — главный экран,
 * shmot_shop.js — примерка, player_profile.js — чужой/свой профиль) — проверяет, что guard
 * добавлен во ВСЕ три, не только в то, с которого начался репорт.
 *
 * Regex-проверка текста файла (не vm-исполнение) — условие простое и без побочных эффектов на
 * экономику/RNG, тот же уровень, что остальные позиционные/условные regex-тесты проекта.
 *
 * Run: node tests/mask-ispolnitel-no-blink.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(cond, msg){ if(cond){ console.log('  ✅', msg); passed++; } else { console.error('  ❌ FAIL:', msg); failed++; } }

const srcDir = path.join(__dirname, '..', '_client', 'src', 'game');

const homeJs = fs.readFileSync(path.join(srcDir, 'home.js'), 'utf-8');
const shopJs = fs.readFileSync(path.join(srcDir, 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
const profileJs = fs.readFileSync(path.join(srcDir, 'shell', 'overlays', 'player_profile.js'), 'utf-8');

console.log('\nhome.js — главный экран, проверка на каждый тик (можно переодеться без закрытия)');
check(/headEq\.id === 116/.test(homeJs) || /\.id === 116/.test(homeJs), 'home.js интервала моргания ссылается на id116');
check(/cat === 0 && it\.equipped/.test(homeJs), 'home.js проверяет именно надетый предмет категории "голова" (cat:0)');

console.log('\nshmot_shop.js — примерка, тот же паттерн на каждый тик');
check(/\.id === 116/.test(shopJs), 'shmot_shop.js интервала моргания ссылается на id116');
check(/cat === 0 && it\.equipped/.test(shopJs), 'shmot_shop.js проверяет именно надетый предмет категории "голова"');

console.log('\nplayer_profile.js — профиль статичен на время показа, проверка один раз до интервала');
check(/headDef\s*=\s*spr\s*;\s*headDef\s*=\s*def\s*;|headDef = def/.test(profileJs), 'player_profile.js захватывает headDef в цикле CLOTH_SLOTS');
check(/headDef && headDef\.id === 116/.test(profileJs), 'player_profile.js guard ссылается на id116');

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/** Regression test for the currency onboarding transition and backpack boss keys.
 * Run: node tests/onboarding-currency-and-backpack-boss-keys.test.js */
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(ok, msg){ if(ok){ console.log('  ✅', msg); passed++; } else { console.error('  ❌ FAIL:', msg); failed++; } }
const root = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(root, '_client/src/game/onboarding/onboarding-popup.js'), 'utf8');
const ryuk = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/ryukzak.js'), 'utf8');
const reward = fs.readFileSync(path.join(root, '_client/src/game/shell/popups/reward.js'), 'utf8');
const dev = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/dev_panel.js'), 'utf8');
const serverRyuk = fs.readFileSync(path.join(root, 'server/core/controllers/ryukzak.php'), 'utf8');
const users = fs.readFileSync(path.join(root, 'server/core/controllers/users.php'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'server/json/ryukzak_config.json'), 'utf8'));
const clientCatalog = JSON.parse(fs.readFileSync(path.join(root, '_client/src/data/ryukzak_rewards.json'), 'utf8'));

console.log('\n1) Валютный шаг обучения не становится тупиком');
assert(/const onNarrationComplete = state === 'currency'/.test(popup), 'для валюты определён callback окончания реплики');
assert(/this\._showPopup\('final'\);[\s\S]{0,80}this\._setStep\('final'\);/.test(popup), 'по окончании реплики показывается финальный экран');

console.log('\n2) Ключи рюкзака привязаны к конкретным боссам');
assert(JSON.stringify(catalog.tiers) === JSON.stringify(clientCatalog), 'серверный и клиентский каталоги рюкзака совпадают');
const expected = [null,null,null,null,1,1,2,2,2,3,3,3,3,3,3,3,3,3,3,3];
assert(catalog.tiers.every((tier, i) => (tier.key_boss || null) === expected[i]), 'уровни 5–6→Счастливчик, 7–9→Ястреб, 10–20→Меченный');
assert(catalog.tiers.every(t => !t.key_boss || (t.key_boss >= 1 && t.key_boss <= 3)), 'Крыс, Баркут, Борода и Жгут отсутствуют среди ключевых наград');
// 02.10.2026 (по прямому указанию — "нужно выводить ключ соответствующего босса, не текст"):
// текстовый превью "+N КЛЮЧА ДЛЯ БОССА..." заменён на иконку конкретного ключа (без числа —
// количество ключей за розыгрыш теперь всегда 1, см. проверку k===1 ниже).
assert(/KEY_BOSS_ICON_FILES = \{ ?1:'ключ счастливчик\.png', ?2:'ключ ястреб\.png', ?3:'ключ меченный\.png' ?\}/.test(ryuk), 'до открытия рюкзака отображается иконка конкретного ключа, не текст');
assert(!/ВОЗМОЖНАЯ НАГРАДА/.test(ryuk), 'старый текстовый превью с числом ключей удалён');
assert(catalog.tiers.every(t => !t.key_boss || t.k === 1), 'количество ключей за один розыгрыш рюкзака всегда ровно 1 (не масштабируется до 7 на верхних уровнях)');
assert(/rewards\.push\(\{type:'boss_key_'\+r\.key_boss, amount:r\.k\}\)/.test(ryuk), 'после открытия в попап передаётся конкретный тип ключа');
assert(/\$bossData\['keys'\]\[\$keyBoss\] = intval\(\$bossData\['keys'\]\[\$keyBoss\]\) \+ \$keyCount;/.test(serverRyuk), 'сервер начисляет ключ в персональный слот bosses_data.keys');
assert(/'bosses_data'/.test(serverRyuk) && !/add\(\$user, 'boss_keys'/.test(serverRyuk), 'рюкзак больше не выдаёт безымянные boss_keys');
assert(/boss_key_1: 'Счастливчик'/.test(reward) && /boss_key_4: 'Крыс'/.test(reward), 'попап содержит подписи персональных ключей');

console.log('\n3) Награда рюкзака показывает иконки ножа/пистолета по новым координатам');
assert(/'награда рюкзак нож\.png':\s*\{ ?x: 510, ?y: 370 ?\}/.test(ryuk), 'нож рюкзака на x:510 y:370');
assert(/'награда рюкзак пистолет\.png':\s*\{ ?x: 305, ?y: 215 ?\}/.test(ryuk), 'пистолет рюкзака на x:305 y:215');
assert(/reward\.mach > 0\) iconItems\.push\(\{f:'награда рюкзак нож\.png'/.test(ryuk), 'иконка ножа рисуется только если нож реально выпал');
assert(/reward\.pist > 0\) iconItems\.push\(\{f:'награда рюкзак пистолет\.png'/.test(ryuk), 'иконка пистолета рисуется только если пистолет реально выпал');
// Старые имена допустимы только в поясняющем комментарии ("заменили старые X/Y"), не как
// активные ключи словарей/пути текстур — проверяем, что они не встречаются внутри кавычек.
assert(!/'nagrada_ryukzak_nozh\.png'/.test(ryuk) && !/'nagrada_ryukzak_pistolet\.png'/.test(ryuk), 'старые файлы ножа/пистолета больше не используются как активные пути');
const fs_ = fs, path_ = path;
assert(fs_.existsSync(path_.join(root, "_client/development/images/layers/popups/sidorovich/награда рюкзак нож.png")), 'файл иконки ножа скопирован в проект');
assert(fs_.existsSync(path_.join(root, "_client/development/images/layers/popups/sidorovich/награда рюкзак пистолет.png")), 'файл иконки пистолета скопирован в проект');

console.log('\n4) DEV-кнопка выставляет ровно 20-й уровень');
assert(/label:'МАКС\. 20 УР\.'[\s\S]{0,90}_setDevRyukzakLevel20/.test(dev), 'кнопка «МАКС. 20 УР.» есть в DEV-панели');
assert(/TS\.php\('users\.devSetRyukzakLevel'/.test(dev), 'кнопка вызывает отдельный серверный endpoint');
assert(/'devSetRyukzakLevel'/.test(users) && /function devSetRyukzakLevel\(\)/.test(users), 'endpoint разрешён и реализован на сервере');
assert(/\$user\['ryukzak_points'\] = 1200;/.test(users), 'endpoint выставляет последний порог — 1200 очков');
assert(/_requireDevUser\(\)/.test(users.slice(users.indexOf('function devSetRyukzakLevel'))), 'endpoint защищён серверной проверкой DEV-аккаунта');

console.log(`\n${'─'.repeat(50)}`);
if(failed){ console.error(`❌ ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`✅ All ${passed} tests passed`);

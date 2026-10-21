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
// 17.10.2026 (по прямому указанию — замена сигарет на сухари, редизайн грида наград рюкзака):
// отдельный floating-спрайт ключа (keyIconSpr/KEY_BASE/_setKeyPreview) убран целиком — ключ
// теперь просто одна из карточек нижнего ряда общего грида (KEY_BOSS_CARD, новый арт).
// 20.10.2026 (по прямому указанию — "количество ключей не отображается и не меняется"):
// KEY_BOSS_CARD расширена слотом 4 (Крыс) — ryukzak.php уже поддерживал key_boss до 4, карты
// для него не было.
assert(/KEY_BOSS_CARD = \{\s*\n\s*1:'рюкзак карточка счастливчик\.png', 2:'рюкзак карточка ястреб\.png',\s*\n\s*3:'рюкзак карточка меченный\.png', 4:'рюкзак карточка крыс\.png',\s*\n\s*\};/.test(ryuk), 'до открытия рюкзака отображается карточка конкретного ключа в гриде (1-4), не текст');
assert(!/ВОЗМОЖНАЯ НАГРАДА/.test(ryuk), 'старый текстовый превью с числом ключей удалён');
assert(!/const keyIconSpr|KEY_BASE =|_setKeyPreview\s*=\s*\(/.test(ryuk), 'старый отдельный floating-спрайт ключа с собственным KEY_BASE/_setKeyPreview полностью удалён как код (упоминание в поясняющем комментарии допустимо)');
assert(catalog.tiers.every(t => !t.key_boss || t.k === 1), 'количество ключей за один розыгрыш рюкзака всегда ровно 1 (не масштабируется до 7 на верхних уровнях)');
assert(/rewards\.push\(\{type:'boss_key_'\+r\.key_boss, amount:r\.k\}\)/.test(ryuk), 'после открытия в попап передаётся конкретный тип ключа');
assert(/\$bossData\['keys'\]\[\$keyBoss\] = intval\(\$bossData\['keys'\]\[\$keyBoss\]\) \+ \$keyCount;/.test(serverRyuk), 'сервер начисляет ключ в персональный слот bosses_data.keys');
assert(/'bosses_data'/.test(serverRyuk) && !/add\(\$user, 'boss_keys'/.test(serverRyuk), 'рюкзак больше не выдаёт безымянные boss_keys');
assert(/boss_key_1: 'Счастливчик'/.test(reward) && /boss_key_4: 'Крыс'/.test(reward), 'попап содержит подписи персональных ключей');

console.log('\n3) Награда рюкзака показывает карточки оружия по новым координатам (динамический грид)');
// 17.10.2026 (по прямому указанию — замена сигарет на сухари, редизайн грида наград рюкзака):
// старый FIXED_POS (6 жёстких слотов под конкретные файлы) заменён TOP_ROW (3 ресурса, всегда
// видны)/BOTTOM_ROW (до 4 слотов, заполняются по порядку тем, что реально выпало — mach→мачете,
// pist→макар, ak→калаш, последним — ключ, если есть). Карточки — новый арт 114×147.
// 18.10.2026: общий сдвиг y+40 для файлов рюкзака без отдельно продиктованных координат.
// 18.10.2026 (по прямому указанию — "баннер шанс на шмотку не должен выводиться, пока фичи
// дропа нет никогда, карточки сдвинь вправо на 140px"): +CARD_X_SHIFT к каждой координате X.
assert(/const TOP_ROW {4}= \[\{x:334\+CARD_X_SHIFT,y:203\},\{x:455\+CARD_X_SHIFT,y:203\},\{x:576\+CARD_X_SHIFT,y:203\}\];/.test(ryuk), 'верхний ряд — 3 позиции ресурсов на заданных координатах (+CARD_X_SHIFT)');
assert(/const BOTTOM_ROW {2}= \[\{x:288\+CARD_X_SHIFT,y:345\},\{x:402\+CARD_X_SHIFT,y:345\},\{x:516\+CARD_X_SHIFT,y:345\},\{x:630\+CARD_X_SHIFT,y:345\}\];/.test(ryuk), 'нижний ряд — 4 позиции на заданных координатах (+CARD_X_SHIFT)');
assert(/reward\.mach > 0\) bottomItems\.push\(\{f:'рюкзак карточка мачете\.png'/.test(ryuk), 'карточка мачете рисуется только если mach реально выпал');
assert(/reward\.pist > 0\) bottomItems\.push\(\{f:'рюкзак карточка макар\.png'/.test(ryuk), 'карточка макара рисуется только если pist реально выпал');
assert(/reward\.ak {3}> 0\) bottomItems\.push\(\{f:'рюкзак карточка калаш\.png'/.test(ryuk), 'карточка калаша рисуется только если ak реально выпал');
// Старые имена допустимы только в истории (докблок), не как активные ключи словарей/пути
// текстур — проверяем, что они не встречаются внутри кавычек как путь загрузки.
assert(!/Texture\.from\(BASE \+ 'награда рюкзак нож\.png'\)/.test(ryuk) && !/Texture\.from\(BASE \+ 'награда рюкзак пистолет\.png'\)/.test(ryuk),
    'старые файлы ножа/пистолета больше не грузятся как активные пути');
const fs_ = fs, path_ = path;
assert(fs_.existsSync(path_.join(root, "_client/development/images/рюкзак карточка мачете.png")), 'файл карточки мачете скопирован в проект');
assert(fs_.existsSync(path_.join(root, "_client/development/images/рюкзак карточка макар.png")), 'файл карточки макара скопирован в проект');
assert(fs_.existsSync(path_.join(root, "_client/development/images/рюкзак карточка калаш.png")), 'файл карточки калаша скопирован в проект');

console.log('\n4) DEV-кнопка выставляет ровно 20-й уровень');
assert(/label:'МАКС\. 20 УР\.'[\s\S]{0,90}_setDevRyukzakLevel20/.test(dev), 'кнопка «МАКС. 20 УР.» есть в DEV-панели');
assert(/TS\.php\('users\.devSetRyukzakLevel'/.test(dev), 'кнопка вызывает отдельный серверный endpoint');
assert(/'devSetRyukzakLevel'/.test(users) && /function devSetRyukzakLevel\(\)/.test(users), 'endpoint разрешён и реализован на сервере');
assert(/\$user\['ryukzak_points'\] = 1200;/.test(users), 'endpoint выставляет последний порог — 1200 очков');
assert(/_requireDevUser\(\)/.test(users.slice(users.indexOf('function devSetRyukzakLevel'))), 'endpoint защищён серверной проверкой DEV-аккаунта');

console.log(`\n${'─'.repeat(50)}`);
if(failed){ console.error(`❌ ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`✅ All ${passed} tests passed`);

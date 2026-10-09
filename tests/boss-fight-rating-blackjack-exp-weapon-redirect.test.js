/**
 * Test: 26.09.2026, по прямому указанию (батч из нескольких скриншотов) —
 *
 * 1) Блэкджек: комбинации 7-7 и 9-9 давали "авторитет" (respect), теперь дают ОПЫТ (exp) —
 *    300 и 1000 соответственно. Ветка resp в коде оставлена (на случай будущих рангов с
 *    авторитетом), просто payouts для этих двух рангов переведены на exp.
 * 2) Ошибка "не хватает патронов на множитель" (bosses-combat.js._attack) — кнопка "ПОНЯТНО"
 *    теперь перекидывает в магазин оружия (weapons.open()), тот же переход, что уже используют
 *    "КУПИТЬ" в _openNoWeaponPopup().
 * 3) Панель "РЕЙТИНГ УРОНА" в бою с боссом: убраны серые Graphics-прямоугольники под аватарами
 *    (были видны как "непонятные серые квадраты"), убраны текстовые плейсхолдеры "---"/"× —"
 *    для пустых строк (теперь просто пустая строка), ник игрока — ближайший доступный в
 *    проекте аналог шрифта из присланного CSS (AA Bebas Neue) белым цветом (было Southbank LT,
 *    золотой #e8c877).
 *
 * Run: node tests/boss-fight-rating-blackjack-exp-weapon-redirect.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bjConfig  = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'blackjack_config.json'), 'utf-8'));
const bjSrc     = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');
const bjClientSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');
const combatSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const fightSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');

console.log('\nTest 1: blackjack_config.json — семерка/девятка переведены с resp на exp, суммы не изменились');
{
    assert(bjConfig.payouts['семерка'].exp === 300, 'семерка: exp=300');
    assert(bjConfig.payouts['семерка'].resp === undefined, 'семерка: старого resp больше нет');
    assert(bjConfig.payouts['девятка'].exp === 1000, 'девятка: exp=1000');
    assert(bjConfig.payouts['девятка'].resp === undefined, 'девятка: старого resp больше нет');
    // Регресс-гвард: остальные ранги (валет/десятка/восьмерка — cig; туз/король/дама — cig+shmot) не тронуты.
    assert(bjConfig.payouts['валет'].cig === 200, 'валет — регресс-гвард, не тронут');
    assert(bjConfig.payouts['туз'].shmot === true, 'туз — регресс-гвард, shmot не тронут');
}

console.log('\nTest 2: blackjack.php — сервер умеет начислять exp из payouts, добавляет в patch/ответ');
{
    const start = bjSrc.indexOf('function resolve(){');
    const body = bjSrc.slice(start, start + 6000);
    assert(/\$cigAmt = 0; \$respAmt = 0; \$expAmt = 0; \$shmotGiven = false; \$shmotGranted = null;/.test(body),
        'expAmt инициализирован рядом с cigAmt/respAmt');
    assert(/if\(!empty\(\$p\['exp'\]\)\)\{  \$expAmt  = intval\(\$p\['exp'\]\);  \$this->ops->add\(\$user, 'exp', \$expAmt\); \}/.test(body),
        'ветка exp начисляет через Gameops::add()');
    assert(/'exp', 'dvor_games', 'shmot'/.test(body), "'exp' добавлен в список patchCurrencies()");
    assert(/'expAmt'       => \$expAmt,/.test(body), 'expAmt возвращается клиенту в финальном ok()');
}

console.log('\nTest 3: dvor-blackjack.js — клиент читает expAmt (для полноты, наравне с cigAmt/respAmt)');
{
    assert(/if\(res\.expAmt\)  items\.push\(\{type:'exp',        amount: res\.expAmt\}\);/.test(bjClientSrc),
        'expAmt добавлен в items наравне с cigAmt/respAmt');
}

console.log('\nTest 4: bosses-combat.js — ошибка нехватки патронов теперь редиректит в магазин оружия по клику ПОНЯТНО');
{
    const idx = combatSrc.indexOf("notify.showResult({text: eqWpn.name + ': нужно ×' + mult + ', есть ' + availQty + '.'}, 0, () => {");
    assert(idx !== -1, 'showResult вызван с 3-м аргументом (onClose callback)');
    const body = combatSrc.slice(idx, idx + 200);
    assert(/if\(window\.weapons\) weapons\.open\(\);/.test(body), 'onClose открывает магазин оружия (weapons.open())');
}

console.log('\nTest 5: bosses_fight.js — серые Graphics-фоны под аватарами рейтинга убраны');
{
    assert(!/avBg\.beginFill\(0x1a1a1a, 1\); avBg\.lineStyle\(1, 0x444444\);/.test(fightSrc),
        'серый Graphics-прямоугольник (avBg) больше не создаётся');
    assert(!/const avBg = new PIXI\.Graphics\(\);/.test(fightSrc), 'переменная avBg удалена целиком');
}

console.log('\nTest 6: bosses_fight.js — плейсхолдеры "---"/"× —" заменены на пустую строку в _showBossFightRating');
{
    assert(!/row\.nameTxt\.text = '---';/.test(fightSrc), 'старый плейсхолдер имени убран');
    assert(!/row\.dmgTxt\.text = '× —';/.test(fightSrc), 'старый плейсхолдер урона убран');
    // 04.10.2026: top.length===0 и !entry объединены в одну ветку (!entry внутри общего forEach
    // по rows — top[i] тоже undefined, когда top пуст) — теперь ОДНО место очищает текст, не два.
    const count = (fightSrc.match(/row\.nameTxt\.text = ''; row\.dmgTxt\.text = '';/g) || []).length;
    assert(count === 1, 'единая ветка (!entry, покрывает и top.length===0, и "мест больше чем участников") очищает текст пустой строкой (найдено: ' + count + ')');
}

console.log('\nTest 7: bosses_fight.js — ник рейтинга: шрифт AA Bebas Neue, белый цвет (по CSS ".Имя_персонажа")');
{
    // 02.10.2026: цвет подтверждён пользователем напрямую как коричневый (не белый) — см.
    // комментарий у nameTxt в bosses_fight.js.
    // 08.10.2026 (фикс пикселизации текста): fontSize:14×NAME_SCALE(1.280) заменены на
    // итоговый fontSize:18 без scale.
    assert(/fontFamily:'AA Bebas Neue', fontSize:18, fill:'#8a7157',/.test(fightSrc),
        'nameTxt использует AA Bebas Neue (ближайший доступный аналог BebasNeueBook) и коричневый цвет (подтверждено пользователем), fontSize:18 (14×1.280)');
    assert(!/fontFamily:'Southbank LT', fontSize:14, fill:'#e8c877',/.test(fightSrc),
        'старый стиль (Southbank LT, золотой) убран');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

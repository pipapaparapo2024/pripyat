/**
 * Test: 26.09.2026, по прямому указанию —
 *
 * 1) bosses_prefight.js — весь текст, лежащий прямо на фоне экрана выбора режима боя (HP-текст,
 *    тултип иконок наград), переведён на цвет #cbc9c9 (палитра Photoshop со скриншота). Карточка-
 *    тултип шмотки в карусели НЕ трогается — у неё свой стиль, копирующий магазин шмоток
 *    (светлый фон, тёмный текст), см. boss-prefight-shmot-carousel-hover-tooltip.test.js.
 *
 * 2) bosses.php.attack() — оверкилл-урон (бью с множителем, урон больше остатка HP босса)
 *    отображается/тратится БЕЗ обрезки по остатку HP: патроны списываются полным mult, урон в
 *    boss_damage_log/total_damage/personalDamageTotal/dmgSpent — полный расчётный $damage.
 *    Единственное, что остаётся ограниченным остатком HP, — сам HP босса ($newHp).
 *
 * Run: node tests/boss-prefight-text-palette-and-overkill-damage.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const prefightSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_prefight.js'), 'utf-8');
const bossesPhp    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

console.log('\nTest 1: bosses_prefight.js — HP-текст и тултип иконок наград цвета #cbc9c9');
{
    assert(/fill:'#cbc9c9',\s*\n\s*fontWeight:'bold', dropShadow:true, dropShadowColor:'#000', dropShadowDistance:2/.test(prefightSrc),
        'HP-текст (xpTxt) — #cbc9c9 (было #ffffff)');
    assert(/const tipTxt = new PIXI\.Text\('', \{\s*\n\s*fontFamily:'Southbank LT', fontSize:18, fill:'#cbc9c9',/.test(prefightSrc),
        'тултип иконок наград (tipTxt) — #cbc9c9 (было #ffcc44)');
    // Регресс-гвард: карточка-тултип шмотки в карусели — отдельный стиль, копирующий магазин
    // шмоток, НЕ трогаем цветом #cbc9c9 (иначе текст на светлом фоне карточки станет нечитаемым).
    assert(/const titleStyle = \{ fontFamily:'Southbank LT', fontSize:17, fontWeight:'bold', fill:'#ac3b26',/.test(prefightSrc),
        'заголовок карточки-тултипа шмотки остался #ac3b26 (не тронут палитрой #cbc9c9)');
}

console.log('\nTest 2: bosses_prefight.js — новая позиция HP-текста (x:866,y:175)');
{
    assert(/xpTxt\.anchor\.set\(0\.5, 0\.5\); xpTxt\.x = 866; xpTxt\.y = 175;/.test(prefightSrc), 'x:866,y:175');
    // 08.10.2026 (фикс пикселизации текста): fontSize:22×scale(1.240) заменены на итоговый
    // fontSize:27 без scale.
    assert(/fontSize:27,/.test(prefightSrc), 'fontSize увеличен напрямую до 27 (= 22×1.240), не через scale');
    assert(!/xpTxt\.scale\.set\(/.test(prefightSrc), 'scale.set() для xpTxt больше не вызывается');
}

console.log('\nTest 3: bosses.php.attack() — патроны списываются полным mult, без экономии на добивающем ударе');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(!/\$actualConsume/.test(body), 'логика "экономии" (actualConsume/dmgPerUnit) удалена целиком');
    // 26.09.2026 (аудит перед модерацией VK — гонка параллельных запросов): списание патронов
    // переехало на SELECT...FOR UPDATE + read-modify-write внутри транзакции
    // ($lockedWeapons/$lockedQty), чтобы два параллельных запроса не списали патроны один раз
    // при двойном уроне (lost update). Формула вычитания (qty - mult, без экономии) не
    // изменилась — изменился только источник читаемого qty и имя переменной, см.
    // boss-attack-server-authoritative-and-timing-friend-rule.test.js за подробным разбором.
    assert(/\$lockedWeapons\[\$weaponId\]\['qty'\] = \$lockedQty - \$mult;/.test(body),
        'списание патронов — полный $mult (из заблокированной SELECT...FOR UPDATE строки)');
}

console.log('\nTest 4: bosses.php.attack() — boss_damage_log/total_damage/personalDamageTotal/dmgSpent считают полный $damage (не обрезанный остатком HP)');
{
    assert(/bind_param\('iiiiii', \$uid, \$bossId, \$diffIdx, \$damage, \$critInt, \$now\);/.test(bossesPhp),
        'boss_damage_log логирует полный $damage — источник "ТОП УРОНА" в попапе победы теперь показывает реально нанесённый удар, не остаток HP');
    assert(/\$this->ops->add\(\$user, 'total_damage', \$damage\);/.test(bossesPhp), 'total_damage считает полный $damage');
    assert(/\$data\['personalDamageTotal'\] = intval\(\$data\['personalDamageTotal'\]\) \+ \$damage;/.test(bossesPhp), 'personalDamageTotal считает полный $damage');
    assert(/\$skillsState\['dmgSpent'\] = intval\(\$skillsState\['dmgSpent'\]\) \+ \$damage;/.test(bossesPhp), 'dmgSpent (прогресс скиллов) считает полный $damage');
}

console.log('\nTest 5: bosses.php.attack() — единственное, что ограничено остатком HP, это сам HP босса');
{
    // 26.09.2026 (уточнение к этому же тесту): $dealt=min(...) как отдельная "обрезанная урон"
    // переменная удалена только из ОБЫЧНОЙ атаки (attack()) — урон босса "Седой" (useSedoy(),
    // отдельная, не затронутая этим реверсом механика) по-прежнему легитимно использует
    // $dealt = min($sedoyLeft, $hpBefore) в своей собственной функции. Проверяем именно тело
    // attack() (уже вырезано выше в `body`), а не весь файл целиком — иначе тест ложно падает
    // на useSedoy().
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const attackBody = bossesPhp.slice(start, end);
    assert(/\$newHp = max\(0, \$hpBefore - \$damage\);/.test(bossesPhp), '$newHp не уходит в минус (HP босса — единственное капнутое значение)');
    assert(!/\$dealt\s*=\s*min\(/.test(attackBody), 'переменная $dealt (обрезанный урон) удалена из attack() целиком (useSedoy() — отдельная функция, её $dealt легитимен, не проверяется здесь)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

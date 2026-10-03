/**
 * Test: батч 19.09.2026 —
 *  1) У «Топ по достижениям» появился выделенный фон (раньше временно переиспользовался фон
 *     «Топ по авторитету») — переиспользуется тот же паттерн (_buildLeaderboardPanel +
 *     ячейка.png), что у урона/авторитета.
 *  2) Зазор между строками рейтинга поднят с 3 до 6px по прямому указанию.
 *  3) Баг найден при проверке "работает ли прокачка оружия на урон в бою" — ответ был "нет":
 *     weapons.js._renderStatus() показывает игроку урон ВКЛЮЧАЯ бонус тира прокачки
 *     (_tierDmg[wp.upg]) и бонус "Зала оружия" (getHallBonus), но bosses-combat.js._attack()
 *     (реальный расчёт урона по боссу) эти два бонуса никогда не прибавлял — прокачка
 *     оружия визуально росла в магазине, но не влияла на урон в бою. Исправлено в двух
 *     местах: сам расчёт урона (bosses-combat.js) и подсказка урона в бою (bosses_fight.js
 *     _showWpnTip), чтобы подсказка не начала ЗАНИЖАТЬ урон относительно реального после фикса.
 *
 * Run: node tests/svod-achievements-bg-and-weapon-tier-damage.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const svodSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod.js'), 'utf-8');
const leaderSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const fightSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const bossesPhp  = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
const weaponsCfg = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'weapons_config.json'), 'utf-8'));

console.log('\nTest 1: у "Топ по достижениям" — собственный фон (не переиспользует фон авторитета)');
{
    const imgPath = path.join(root, '_client', 'development', 'images', 'задний фон топы по достижения.png');
    assert(fs.existsSync(imgPath), 'файл "задний фон топы по достижения.png" скопирован в _client/development/images/');

    const achBlockMatch = svodSrc.match(/\} else if\(key === 'ach'\)\{([\s\S]*?)\n        \}/);
    assert(!!achBlockMatch, "блок key==='ach' найден в svod.js");
    const body = achBlockMatch[1];
    // 21.09.2026: _buildMyAchievementsPanel сменил сигнатуру с голой строки bgFile на объект
    // конфигурации (добавились кнопки саб-табов, см. svod-achievements-own-tabs-and-leaderboard-
    // name-guard.test.js) — bgFile теперь поле этого объекта, а не единственный аргумент.
    assert(/_buildMyAchievementsPanel\(\{\s*\n\s*bgFile: 'задний фон топы по достижения\.png',/.test(body),
        '_buildMyAchievementsPanel вызывается с новым выделенным файлом фона (в составе объекта конфигурации)');
    assert(/bg: 'задний фон топы по достижения\.png'/.test(body),
        '_buildLeaderboardPanel для "ach" тоже использует новый файл фона');
    assert(!/задний фон топы по авторитету\.png/.test(body),
        'старый (временный) фон "авторитету" больше не используется для вкладки достижений');
}

console.log('\nTest 2: зазор между строками рейтинга — 6px (было 3px)');
{
    assert(/const ROW_W = 669, CELL_H = 36, ROW_GAP = 6;/.test(leaderSrc), 'ROW_GAP = 6');
}

console.log('\nTest 3: bosses.php.attack() учитывает бонус тира прокачки оружия');
{
    // 22.09.2026 (по прямому указанию — "перенеси весь бой на сервер"): расчёт урона переехал
    // из bosses-combat.js._attack() в bosses.php.attack() целиком (сервер сам знает upg игрока,
    // клиенту незачем и нельзя это присылать) — формула та же (база + тир + флэт-скилл),
    // просто теперь считает и проверяет сервер.
    // 25.09.2026 (по прямому указанию — "убираем эту механику"): бонус "Зала оружия"
    // (hall_milestones/hallBonus/getHallBonus) убран целиком, из каталога и из формулы.
    assert(weaponsCfg.tier_damage && weaponsCfg.tier_damage.length === 21, 'weapons_config.json.tier_damage — та же таблица бонусов тира, что была в клиентском weapons.js._tierDmg');
    assert(weaponsCfg.hall_milestones === undefined, 'weapons_config.json.hall_milestones больше не существует');

    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$tierBonus = intval\(\$wCatalog\['tier_damage'\]\[min\(20, intval\(\$wp\['upg'\] \?\? 0\)\)\] \?\? 0\);/.test(body),
        'attack() вычисляет tierBonus из weapons_config.tier_damage по текущему wp.upg');
    assert(!/\$hallBonus/.test(body), 'hallBonus нигде не считается в attack()');
    assert(/\$baseDmgWpn = intval\(\$wCatalog\['base_damage'\]\[\$weaponId\]\) \+ \$tierBonus;/.test(body),
        'baseDmgWpn = base_damage + tierBonus (без hallBonus)');
}

console.log('\nTest 4: подсказка урона в бою (bosses_fight._showWpnTip) синхронизирована с реальным расчётом урона');
{
    // 25.09.2026 (по прямому указанию — "шмотки не дают бонуса, оружейка должна показывать
    // модифицированный урон"): расчёт (база+тир+скилл+шмот%/флэт) вынесен в единый
    // weapons.computeModifiedDamage() — _showWpnTip больше сам ничего не считает, только
    // умножает готовое значение на мультипликатор патронов. См.
    // shmot-torso-height-140-poker-open-button-weapon-modified-damage.test.js за подробностями
    // самого computeModifiedDamage().
    const tipStart = fightSrc.indexOf('const _showWpnTip = (spr, wid) => {');
    const tipEnd   = fightSrc.indexOf('const _hideWpnTip', tipStart);
    const body = fightSrc.slice(tipStart, tipEnd);
    assert(/const perHit = window\.weapons \? weapons\.computeModifiedDamage\(wid\) : 0;/.test(body),
        'подсказка использует единый weapons.computeModifiedDamage(), не считает сама');
    assert(!/const tierBonus = /.test(body), 'подсказка больше не дублирует расчёт tierBonus локально');
    assert(!/const hallBonus\s*=/.test(body), 'подсказка не объявляет hallBonus (механика убрана ранее)');
    assert(/const totalDmg = perHit \* mult;/.test(body),
        'totalDmg = perHit(computeModifiedDamage) * mult — подсказка синхронизирована с оружейкой и сервером');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

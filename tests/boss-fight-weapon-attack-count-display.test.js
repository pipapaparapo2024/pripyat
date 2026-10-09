/**
 * Test: репорт 08.10.2026 — "показывай количество оружия, которым игрок может атаковать,
 * в зависимости от коэффициента". Пример из прямого указания: патронов 100, множитель ×1 →
 * показывать 100; тот же запас, множитель ×2 → показывать 50 (т.е. floor(qty/mult)).
 *
 * Эта формула НЕ придумана произвольно — она обязана совпадать с тем, что реально списывает
 * сервер за один удар донатным оружием (bosses.php.attack()): проверяет `qty >= mult`, затем
 * списывает РОВНО `mult` единиц (`$lockedWeapons[$weaponId]['qty'] = $lockedQty - $mult`, см.
 * комментарий там же от 26.09.2026 — "множитель — твёрдая ставка патронами"). Значит
 * floor(qty/mult) — это ровно число ударов, которое реально ещё можно сделать при текущем
 * множителе, до тех пор пока сервер не откажет кодом 87 ("недостаточно оружия/патронов").
 * Крест-сверка с PHP здесь — чтобы будущая правка формулы списания в bosses.php не разошлась
 * молча с тем, что клиент показывает игроку как "доступно ударов".
 *
 * Координаты метки — по прямому указанию, измерено редактором позиций: мачете x:668,y:634
 * (= та же X, что у метки множителя мачете, Y на 80px выше неё: 714-80=634). Та же дельта
 * перенесена на ствол (751,714→634) и автомат (833,714→634).
 *
 * Run: node tests/boss-fight-weapon-attack-count-display.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesFightSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const bossesPhpSrc = fs.readFileSync(
    path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8'
);

console.log('\nTest 1: сервер (bosses.php) списывает ровно mult патронов за удар — предпосылка формулы floor(qty/mult)');
{
    assert(/\$lockedWeapons\[\$weaponId\]\['qty'\]\s*=\s*\$lockedQty\s*-\s*\$mult/.test(bossesPhpSrc),
        "attack() списывает qty -= mult (твёрдая ставка, не 'экономит' на добивающем ударе)");
    assert(/if\(\$lockedQty\s*<\s*\$mult\)/.test(bossesPhpSrc),
        "attack() проверяет qty < mult перед списанием (гейт \"недостаточно патронов\")");
}

console.log('\nTest 2: _buildBossesFight() создаёт метку количества ударов для мачете/ствола/автомата');
{
    const buildStart = bossesFightSrc.indexOf('proto._buildBossesFight = function(){');
    const buildEnd   = bossesFightSrc.indexOf('proto._updateBossesFight = function(bossIdx){');
    assert(buildStart !== -1 && buildEnd !== -1, '_buildBossesFight()/_updateBossesFight() найдены');
    const body = bossesFightSrc.slice(buildStart, buildEnd);

    assert(/this\._bossFightAmmoCountLabels\s*=\s*\[\]/.test(body),
        '_bossFightAmmoCountLabels инициализирован как массив');
    assert(/ammoLbl\.anchor\.set\(0\.5,\s*1\);\s*ammoLbl\.x\s*=\s*pos\.x;\s*ammoLbl\.y\s*=\s*pos\.y\s*-\s*80/.test(body),
        'метка позиционируется на той же X, что и множитель, и на 80px выше по Y');
    assert(/this\._bossFightAmmoCountLabels\[i\]\s*=\s*ammoLbl/.test(body),
        'метка сохраняется в this._bossFightAmmoCountLabels[i]');
}

console.log('\nTest 3: _refreshWeaponBtns() считает floor(qty/mult) и пишет в метку, "" для бесплатного оружия');
{
    const start = bossesFightSrc.indexOf('proto._refreshWeaponBtns = function(){');
    const end   = bossesFightSrc.indexOf('proto._updateBossFightStats = function(){');
    assert(start !== -1 && end !== -1, '_refreshWeaponBtns() найдена');
    const body = bossesFightSrc.slice(start, end);

    assert(/Math\.floor\(qty\s*\/\s*mult\)/.test(body),
        'формула floor(qty/mult) присутствует');
    assert(/const qty\s*=\s*wp\s*\?\s*\(parseInt\(wp\.qty\)\s*\|\|\s*0\)\s*:\s*0/.test(body),
        'qty берётся из wp.qty (текущий запас оружия), 0 как безопасный дефолт');
    assert(/if\(ammoLbl\)\s*ammoLbl\.text\s*=\s*''/.test(body),
        'для бесплатного оружия (id<3) метка явно очищается, не показывает мусор/0');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 27.09.2026, по репорту "покупка всё ещё странно себя ведёт" (тот же класс гонки, что уже
 * чинили в vassilich.js/shmot.js/weapons.js — два независимых источника правды для одной
 * покупки, найден при целенаправленном поиске того же паттерна по всей кодовой базе):
 *
 *  1) _upgradeBuilding(idx) раньше СРАЗУ списывал coins/stew и применял XP/level-up ЛОКАЛЬНО,
 *     плюс this._saveToUdata() записывал этот предсказанный base_buildings в udata ДО ответа
 *     сервера. Если периодический автосейв успевал улететь между локальным изменением и ответом
 *     base.php.upgrade(), сервер грузил из БД уже "предсказанный" base_buildings и списывал
 *     coins/stew СВЕРХУ ещё раз — реальный двойной расход валюты игрока.
 *  2) _trainStat(idx) — тот же паттерн для энергии: base.php.train() списывает фиксированные 3
 *     энергии независимо от клиента, который раньше тоже списывал энергию локально ДО ответа.
 *
 * Фикс: оба метода теперь честный запрос-ответ — ничего не меняют локально до ответа сервера,
 * применяют ТОЛЬКО patch (coins/stew/energy/base_buildings/base_stats) через applyPatch() +
 * _loadFromUdata(). Исключение — str_xp_total в _trainStat(): изначально целиком клиент-
 * авторитетное поле (base.php.train() его не трогает вовсе), инкремент остаётся локальным.
 *
 * Run: node tests/base-server-authoritative-upgrade-and-train.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'base.js'), 'utf-8');
const phpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'base.php'), 'utf-8');

console.log('\nTest 1: _upgradeBuilding(idx) больше не мутирует coins/stew/base_buildings ДО ответа сервера');
{
    const m = src.match(/\t_upgradeBuilding\(idx\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_upgradeBuilding(idx) найден');
    const body = m ? m[1] : '';

    assert(!/udata\['coins'\]\s*=\s*parseInt\(udata\['coins'\]\|\|0\)\s*-\s*b\.upgrade_cost\.coins;/.test(body),
        'coins больше не списывается локально до ответа сервера');
    assert(!/udata\['stew'\]\s*=\s*parseInt\(udata\['stew'\]\|\|0\)\s*-\s*b\.upgrade_cost\.stew;/.test(body),
        'stew больше не списывается локально до ответа сервера');
    assert(!/b\.xp \+= b\.upgrade_xp;/.test(body),
        'b.xp/level больше не предсказывается локально до ответа сервера (иначе _saveToUdata() перед запросом снова открывает ту же гонку для base_buildings)');
    assert(!/this\._saveToUdata\(\);/.test(body),
        '_saveToUdata() больше не вызывается ДО ответа сервера в этой функции (был источником гонки — записывал предсказанный base_buildings в udata до подтверждения)');

    const tsCallIdx     = body.indexOf("TS.php('base.upgrade'");
    const applyPatchIdx = body.indexOf('applyPatch(e.patch)');
    const loadIdx       = body.indexOf('this._loadFromUdata()');
    assert(tsCallIdx !== -1, "TS.php('base.upgrade', ...) вызывается");
    assert(applyPatchIdx !== -1 && applyPatchIdx > tsCallIdx, 'applyPatch(e.patch) вызывается ВНУТРИ колбэка успеха');
    assert(loadIdx !== -1 && loadIdx > applyPatchIdx, '_loadFromUdata() вызывается ПОСЛЕ applyPatch — this.buildings перечитывается из синхронизированного udata');

    assert(/if\(this\._baseUpgradeInFlight\)\{/.test(body), 'есть guard от повторного клика во время запроса (in-flight)');
    const errCbIdx = body.indexOf('}, (err)=>{');
    assert(errCbIdx !== -1 && errCbIdx > applyPatchIdx, 'есть err-колбэк (ошибка сервера больше не игнорируется молча, как раньше с null)');
}

console.log('\nTest 2: _trainStat(idx) больше не мутирует energy/base_stats ДО ответа сервера (str_xp_total — исключение, остаётся локальным)');
{
    const m = src.match(/\t_trainStat\(idx\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_trainStat(idx) найден');
    const body = m ? m[1] : '';

    assert(!/udata\['energy'\] = energy - s\.energy_cost;/.test(body),
        'энергия больше не списывается локально до ответа сервера');
    assert(!/s\.xp \+= gainedXp;/.test(body),
        's.xp/level больше не предсказывается локально до ответа сервера');
    assert(!/this\._saveToUdata\(\);/.test(body),
        '_saveToUdata() больше не вызывается ДО ответа сервера в этой функции');

    const tsCallIdx     = body.indexOf("TS.php('base.train'");
    const applyPatchIdx = body.indexOf('applyPatch(e.patch)');
    const loadIdx       = body.indexOf('this._loadFromUdata()');
    assert(tsCallIdx !== -1, "TS.php('base.train', ...) вызывается");
    assert(applyPatchIdx !== -1 && applyPatchIdx > tsCallIdx, 'applyPatch(e.patch) вызывается ВНУТРИ колбэка успеха');
    assert(loadIdx !== -1 && loadIdx > applyPatchIdx, '_loadFromUdata() вызывается ПОСЛЕ applyPatch — this.stats перечитывается из синхронизированного udata');

    assert(/if\(this\._baseTrainInFlight\)\{/.test(body), 'есть guard от повторного клика во время запроса (in-flight)');
    const errCbIdx = body.indexOf('}, (err)=>{');
    assert(errCbIdx !== -1 && errCbIdx > applyPatchIdx, 'есть err-колбэк на случай ошибки сервера');

    // str_xp_total — сознательное исключение: сервер его не считает (проверено в Test 3 ниже),
    // поэтому инкремент остаётся клиентским, но ПОСЛЕ applyPatch/_loadFromUdata (порядок не
    // важен для этого поля, т.к. оно не приходит в patch и не участвует в гонке).
    assert(/if\(idx === 0\)\{[\s\S]{0,200}udata\['str_xp_total'\] = \(parseInt\(udata\['str_xp_total'\] \|\| 0\) \+ gainedXp\)\.toString\(\);/.test(body),
        'str_xp_total (client-authoritative поле для ачивки "Сила"/Зарубы) по-прежнему инкрементируется локально');
}

console.log('\nTest 3: server/core/controllers/base.php — upgrade()/train() остаются единственным источником списания валюты/энергии');
{
    assert(/if\(isset\(\$cost\['coins'\]\) && !\$this->ops->deduct\(\$user, 'coins', intval\(\$cost\['coins'\]\)\)\) return \$this->ops->fail\(50\);/.test(phpSrc),
        'upgrade() списывает coins через Gameops::deduct с проверкой баланса');
    assert(/if\(isset\(\$cost\['stew'\]\) && !\$this->ops->deduct\(\$user, 'stew', intval\(\$cost\['stew'\]\)\)\) return \$this->ops->fail\(50\);/.test(phpSrc),
        'upgrade() списывает stew через Gameops::deduct с проверкой баланса');
    // 28.09.2026 (фикс собственного теста после централизации списания энергии в
    // Gameops::spendEnergy() — сохраняет остаток прогресса регенерации, deduct() этого не умел):
    assert(/\$energyCost = 3;/.test(phpSrc) && /if\(!\$this->ops->spendEnergy\(\$user, \$energyCost\)\) return \$this->ops->fail\(50\);/.test(phpSrc),
        'train() списывает фиксированные 3 энергии через Gameops::spendEnergy() с проверкой баланса (не сырой deduct)');
    assert(!/str_xp_total/.test(phpSrc),
        'подтверждено: base.php вообще не знает о str_xp_total — это поле осознанно остаётся целиком клиент-авторитетным');
    assert(/\$this->ops->ok\(\['patch' => \$this->ops->patchCurrencies\(\$user\)\]\);/.test(phpSrc.slice(phpSrc.indexOf('function upgrade'), phpSrc.indexOf('function relocate'))),
        'upgrade() возвращает patch через дефолтный набор ключей (включает coins/stew/base_buildings)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

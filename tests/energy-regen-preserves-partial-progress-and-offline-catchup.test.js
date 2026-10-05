/**
 * Test: 28.09.2026, по репорту игрока (скриншот — "Энергия не восстанавливается, или не
 * сохраняется... писал последний раз почти 2 часа назад, зашёл в игру — по прежнему только
 * 5 энергии") + повторному вопросу про старый баг "потратил энергию — 5-минутный кулдаун
 * начался заново, хотя из прошлых 5 минут уже прошло 3".
 *
 * Разбор нашёл ДВЕ проблемы в одной и той же механике:
 *
 * 1) zone.php.fillCheckpoint() (единственная реальная точка траты энергии — base.php.train()
 *    тоже, но через отдельный код) жёстко писала energy_time=time() при КАЖДОЙ трате —
 *    отбрасывала уже накопленный остаток времени до следующей единицы энергии. Тот же класс
 *    бага, что раньше был в клиентском Timers.spendEnergy() (сейчас не вызывается — трата
 *    энергии перенесена на сервер).
 * 2) patch.js.applyPatch() при ответе сервера присваивал TIMERS.current_energy новое
 *    значение, НЕ обновляя TIMERS.energy_base/energy_base_time — следующий тик
 *    startEnergyTimer() пересчитывал энергию от СТАРОЙ базы (сессии) и мог тут же откатить
 *    HUD обратно вверх, либо таймер "+1 через N:NN" показывал неверный отсчёт до следующей
 *    единицы — в любом случае клиентское отображение энергии рассинхронизировалось с
 *    реальным состоянием на сервере сразу после первой траты за сессию.
 *
 * Фикс — единая формула на клиенте (Timers._regenSnapshot(), _client/src/modules/timers.js)
 * и на сервере (Gameops::energySnapshot()/spendEnergy(), server/core/models/gameops.php):
 * считает регенерацию по прошедшему времени и одновременно возвращает "схлопнутую" базовую
 * метку времени, СДВИНУТУЮ на remainder — она хранит уже накопленный остаток, а не сбрасывает
 * его. patch.js теперь зовёт TIMERS.syncFromPatch(patch.energy, patch.energy_time), который
 * пересчитывает базу той же формулой, что и на сервере (для этого energy_time добавлен и в
 * дефолтный набор ключей patchCurrencies(), и в явный список zone.php.fillCheckpoint()).
 *
 * Run: node tests/energy-regen-preserves-partial-progress-and-offline-catchup.test.js
 */

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const timersSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'timers.js'), 'utf-8');
const patchSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'patch.js'), 'utf-8');
const gameopsSrc = fs.readFileSync(path.join(root, 'server', 'core', 'models', 'gameops.php'), 'utf-8');
const zoneSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'zone.php'), 'utf-8');
const baseSrc    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'base.php'), 'utf-8');

console.log('\nTest 1: Timers._regenSnapshot() — реальное выполнение формулы (извлечена из class-тела)');
{
    const begin = timersSrc.indexOf('_regenSnapshot(saved, savedSec, nowMs){');
    const end   = timersSrc.indexOf('\n\tupdateFromUdata(){', begin);
    assert(begin > -1 && end > begin, 'метод _regenSnapshot найден в timers.js');
    const body = timersSrc.slice(begin, end).replace('_regenSnapshot(saved, savedSec, nowMs){', 'function _regenSnapshot(saved, savedSec, nowMs){');
    const obj = { ENERGY_REGEN_SEC: 300, ENERGY_MAX: 50 };
    // eslint-disable-next-line no-new-func
    obj._regenSnapshot = new Function('return (' + body + ')')().bind(obj);

    // a) Офлайн 2 часа (7200с) от energy=5 — ровно репортнутый игроком сценарий: НЕ должна
    // остаться на 5, должна честно накопить 24 тика (7200/300).
    const offline2h = obj._regenSnapshot(5, 1000, (1000 + 7200) * 1000);
    assert(offline2h.energy === 29, 'офлайн 2 часа от energy=5: 5 + 24 тика = 29, а не застряло на 5 (repro скриншота)');

    // b) Нет базовой метки (savedSec<=0, новый аккаунт/сброс) — старт без искусственного бонуса.
    const noBase = obj._regenSnapshot(10, 0, 5000000);
    assert(noBase.energy === 10 && noBase.baseTimeMs === 5000000, 'нет валидной базовой метки — энергия не трогается, база = сейчас');

    // c) Остаток прогресса переносится между двумя последовательными расчётами (имитация
    // "потратил энергию на 3-й минуте из 5, потом доиграл ещё 2 минуты" — старый баг: трата
    // сбрасывала energy_time на момент траты, и тик наступал только через ПОЛНЫЕ 5 минут
    // ПОСЛЕ траты (итого 3+5=8 минут от начала), а не через 2 оставшиеся (итого 5 минут).
    const t0 = 1000; // исходная базовая метка (сек)
    const afterSpend = obj._regenSnapshot(20, t0, (t0 + 180) * 1000); // 180с = 3 мин прошло, тика ещё нет
    assert(afterSpend.energy === 20, 'после 3 из 5 минут — тика ещё нет, energy не изменилась');
    assert(afterSpend.baseTimeMs === t0 * 1000,
        'СТАРЫЙ БАГ ПРОВЕРЕН: без завершённого тика baseTimeMs НЕ сдвигается на момент "траты" — остаётся исходным якорем, remainder не потерян');
    const twoMinMore = obj._regenSnapshot(afterSpend.energy, Math.floor(afterSpend.baseTimeMs / 1000), (t0 + 300) * 1000); // ещё 120с — итого 300с (5 мин) с ИСХОДНОГО момента
    assert(twoMinMore.energy === 21, 'СТАРЫЙ БАГ ПРОВЕРЕН: 3 мин + 2 мин = ровно 5 мин суммарно от исходного момента — тик засчитан вовремя, не через лишние 3 минуты');

    // d) Энергия уже на потолке — remainder не копится (баз-тайм = "сейчас", а не хранит долг).
    const capped = obj._regenSnapshot(50, 1000, (1000 + 250) * 1000); // 250с < 300, тика не было бы, но уже на потолке
    assert(capped.energy === 50 && capped.baseTimeMs === (1000 + 250) * 1000, 'на потолке — baseTimeMs сразу "сейчас", долга к следующей единице нет');

    // e) Донат-переполнение (saved > max) сохраняется, не обрезается регенерацией.
    const overflow = obj._regenSnapshot(60, 1000, (1000 + 10000) * 1000);
    assert(overflow.energy === 60, 'донат-энергия сверх потолка не обрезается регенерацией (Math.max(saved,...))');
}

console.log('\nTest 2: клиент — updateFromUdata/spendEnergy/addEnergy/syncFromPatch используют единую формулу');
{
    assert(/updateFromUdata\(\)\{[\s\S]*?this\._regenSnapshot\(saved, saved_time/.test(timersSrc),
        'updateFromUdata() считает через _regenSnapshot (не инлайн-дублирует формулу)');
    assert(/syncFromPatch\(energyStr, energyTimeStr\)\{/.test(timersSrc),
        'syncFromPatch() добавлен — applyPatch() может пересинхронизировать energy_base/energy_base_time');
    assert(/spendEnergy\(amount\)\{[\s\S]*?this\._regenSnapshot\(/.test(timersSrc),
        'spendEnergy() схлопывает текущую базу через _regenSnapshot() перед вычитанием (не сбрасывает remainder)');
    assert(/addEnergy\(amount\)\{[\s\S]*?this\._regenSnapshot\(/.test(timersSrc),
        'addEnergy() тоже проходит через _regenSnapshot() перед начислением');
}

console.log('\nTest 3: patch.js — applyPatch() синхронизирует TIMERS через syncFromPatch(), не присваивает current_energy напрямую');
{
    assert(/TIMERS\.syncFromPatch\(patch\.energy, patch\.energy_time\)/.test(patchSrc),
        'applyPatch() зовёт TIMERS.syncFromPatch(patch.energy, patch.energy_time)');
    assert(!/TIMERS\.current_energy = parseInt\(patch\.energy\)/.test(patchSrc),
        'старое прямое присваивание current_energy (без пересчёта базы) убрано');
    const maxIdx = patchSrc.indexOf('patch.max_energy !== undefined');
    const enIdx  = patchSrc.indexOf('patch.energy !== undefined');
    assert(maxIdx > -1 && enIdx > -1 && maxIdx < enIdx,
        'max_energy применяется РАНЬШЕ energy — иначе syncFromPatch() посчитал бы потолок по старому ENERGY_MAX');
}

console.log('\nTest 4: сервер — Gameops::energySnapshot()/spendEnergy() — общий источник истины, remainder не отбрасывается');
{
    assert(/function energySnapshot\(\$user\)\{/.test(gameopsSrc), 'Gameops::energySnapshot() существует');
    assert(/function spendEnergy\(&\$user, \$amount\)\{/.test(gameopsSrc), 'Gameops::spendEnergy() существует');
    assert(/\$baseTime\s*=\s*\(\$energy >= \$maxEnergy\) \? \$now : \(\$now - \$remainder\)/.test(gameopsSrc),
        'baseTime сдвигается на remainder (СТАРЫЙ БАГ: раньше просто time())');
    assert(/\$user\['energy_time'\] = \$baseTime;/.test(gameopsSrc),
        'spendEnergy() пишет схлопнутую баз-метку, не голый time()');
}

console.log('\nTest 5: zone.php.fillCheckpoint() — спенд через Gameops::spendEnergy(), старый хардкод time() убран');
{
    assert(/if\(!\$this->ops->spendEnergy\(\$user, \$energyCost\)\) return \$this->ops->fail\(56\);/.test(zoneSrc),
        'fillCheckpoint() тратит энергию через Gameops::spendEnergy(), fail(56) сохранён');
    assert(!/\$user\['energy_time'\] = time\(\);/.test(zoneSrc),
        'старый жёсткий сброс energy_time=time() при трате убран из zone.php');
    assert(/'coins','cigarettes','stew','energy','energy_time','exp','respect',/.test(zoneSrc),
        'явный список ключей patch включает energy_time (иначе клиент не узнаёт новую базу в этой же сессии)');
}

console.log('\nTest 6: base.php.train() — тратит энергию с учётом уже накопленной регенерации, не сырого значения из БД');
{
    // 05.10.2026 (стале-пин, не регрессия — блокировка строки в base.php.train(), см.
    // tests/base-server-authoritative-upgrade-and-train.test.js): spendEnergy() теперь зовётся
    // на залоченной копии $lockedUser.
    assert(/if\(!\$this->ops->spendEnergy\(\$lockedUser, \$energyCost\)\)\{[\s\S]{0,120}?return \$this->ops->fail\(50\);/.test(baseSrc),
        'train() использует Gameops::spendEnergy() вместо обычного deduct() — учитывает регенерацию с последнего сохранения');
    assert(!/\$this->ops->deduct\(\$user, 'energy', \$energyCost\)/.test(baseSrc),
        'старый deduct(\'energy\') (сырое значение, без регенерации) убран из train()');
}

console.log('\nTest 7: Gameops::patchCurrencies() — energy_time в дефолтном наборе ключей');
{
    assert(/\['coins','stew','cigarettes','energy','energy_time','health','exp','max_energy',/.test(gameopsSrc),
        'дефолтный набор ключей patchCurrencies() включает energy_time (base.php.train() и другие эндпоинты без явного списка теперь тоже присылают её)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

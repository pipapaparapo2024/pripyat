/**
 * Test: баг по репорту (скриншот главного экрана сразу после входа — "почему достижения не
 * срабатывают до этого, а только сейчас начали") — достижение "Разогрев" (en_500, потратить
 * суммарно 500 энергии) всплыло только на загрузке, хотя игрок тренировался в Качалке раньше.
 *
 * Корневая причина (найдена расследованием, не то, что предполагал пользователь про
 * "смену карт" — это был другой, уже исправленный баг в блэкджеке): udata['energy_spent'] —
 * единственный источник данных для всей категории ачивок 'energy' (en_500/en_5k/en_50k/
 * en_500k/en_1k/en_1kk) и для ежедневных заданий zadaniya.js "Потратить N энергии" — до этой
 * правки инкрементировался ТОЛЬКО в zone.php.fillCheckpoint() (энергия за чекпоинт Зоны).
 * Энергия, потраченная в Качалке (base.php.train(), 3 за тренировку) — НЕ ВЛИЯЛА на этот стат
 * вообще, ни на сервере, ни на клиенте — прогресс к "Разогрев" и т.п. мог копиться МЕСЯЦАМИ
 * тренировок и не сдвинуться, а затем внезапно скакнуть, стоило зайти в Зону хоть раз.
 *
 * Отдельно: Gameops::patchCurrencies() без явного списка ключей (как вызывает base.php.train())
 * не включал 'energy_spent' в дефолтный набор — даже если бы сервер его увеличивал, patch не
 * донёс бы новое значение клиенту сразу, achievements.js._checkAll() (читает синхронно из
 * udata) видел бы устаревшее значение до следующей полной подгрузки udata (перезаход).
 *
 * Фикс:
 *  1) base.php.train() инкрементирует energy_spent на energyCost (как zone.php уже делает).
 *  2) Gameops::patchCurrencies() дефолтный список ключей включает 'energy_spent' — любой
 *     endpoint без явного списка теперь всегда присылает актуальное значение.
 *  3) base.js._trainStat(): achievements._checkAll() вызывается ПОВТОРНО внутри колбэка
 *     TS.php('base.train', ...), уже ПОСЛЕ applyPatch() — тот вызов на строке раньше видел
 *     ещё старое (client-side оптимистичное) значение energy_spent, не отражающее эту
 *     конкретную тренировку.
 *
 * Run: node tests/gym-training-energy-spent-tracking-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const basePhp    = readSrc('server/core/controllers/base.php');
const gameopsPhp  = readSrc('server/core/models/gameops.php');
const baseJs      = readSrc('_client/src/game/base.js');

console.log('\nTest 1: base.php.train() инкрементирует energy_spent на energyCost (3)');
{
    const start = basePhp.indexOf('function train(){');
    const end   = basePhp.indexOf('\n    }', basePhp.indexOf('patchCurrencies($user)', start));
    const body  = basePhp.slice(start, end);

    assert(/\$energyCost = 3;/.test(body), 'energyCost вынесен в переменную (было захардкожено в deduct)');
    // 28.09.2026 (фикс собственного теста после централизации списания энергии в
    // Gameops::spendEnergy() — сохраняет остаток прогресса регенерации, deduct() этого не умел):
    assert(/if\(!\$this->ops->spendEnergy\(\$user, \$energyCost\)\) return \$this->ops->fail\(50\);/.test(body),
        'spendEnergy() использует ту же переменную energyCost');
    assert(/\$user\['energy_spent'\] = \$this->ops->i\(\$user, 'energy_spent'\) \+ \$energyCost;/.test(body),
        'energy_spent увеличивается на energyCost при каждой тренировке (раньше не трогался вовсе)');
}

console.log('\nTest 2: Gameops::patchCurrencies() дефолтный список ключей включает energy_spent');
{
    const m = gameopsPhp.match(/\$keys = \[([\s\S]*?)\];/);
    assert(!!m, 'дефолтный массив ключей найден');
    assert(m && /'energy_spent'/.test(m[1]), "'energy_spent' присутствует в дефолтном наборе (иначе endpoint'ы без явного списка ключей не присылают его в patch)");
}

console.log('\nTest 3: base.js._trainStat() повторно проверяет достижения ПОСЛЕ applyPatch() в колбэке base.train');
{
    const start = baseJs.indexOf("TS.php('base.train', {stat_id:idx}, (e)=>{");
    const end   = baseJs.indexOf('}, null);', start);
    const body  = baseJs.slice(start, end);

    assert(start !== -1, "колбэк TS.php('base.train', ...) найден");
    const applyIdx = body.indexOf('applyPatch(e.patch);');
    const checkIdx = body.indexOf('achievements._checkAll();');
    assert(applyIdx !== -1, 'applyPatch(e.patch) вызывается внутри колбэка');
    assert(checkIdx !== -1, 'achievements._checkAll() вызывается внутри колбэка');
    assert(applyIdx !== -1 && checkIdx !== -1 && applyIdx < checkIdx,
        '_checkAll() вызывается ПОСЛЕ applyPatch (видит уже свежий energy_spent из ответа сервера)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

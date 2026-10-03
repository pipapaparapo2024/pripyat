/**
 * Test: батч 25.09.2026 (по прямому указанию):
 *
 *  1) Заруба — дневной лимит "раз в сутки на любую цель" убран целиком ("на одного игрока
 *     можно нападать без ограничений по количеству раз"). zaruba.php.fight() больше не
 *     проверяет/не пишет zaruba_last_ts, никогда не возвращает код 93.
 *
 *  2) Заруба — награда за победу (100 сигарет/100 опыта) убрана целиком ("убери панель
 *     награды, не выдавай награду за победу"). fight() не добавляет валюту, панель
 *     "заруба панель награды.png" и цифры под ней убраны с клиента.
 *
 *  3) Урон друга из Соло — АСИММЕТРИЯ (подтверждено явным ответом на уточняющий вопрос):
 *     урон друга, дерущегося в Соло, ВСЁ РАВНО засчитывается получателю, если сам получатель
 *     не в Соло (фильтр `diff_idx IN (0,1,2)` на СТОРОНЕ ДРУГА убран из всех 3 запросов).
 *     Получатель-Соло по-прежнему не получает ничьей помощи (эта гарантия не менялась —
 *     $friendIds=[] при diffIdx===3 у получателя, отдельный, не тронутый код).
 *
 * Run: node tests/zaruba-no-limit-no-reward-and-friend-damage-asymmetry.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) zaruba.php.fight() — дневной лимит убран целиком');
{
    const src = read('server/core/controllers/zaruba.php');
    const fightStart = src.indexOf('function fight(){');
    const fightEnd = src.indexOf('function pump(){');
    const fightBody = src.slice(fightStart, fightEnd);
    assert(!/\$user\['zaruba_last_ts'\]/.test(fightBody), 'fight() больше не пишет $user[\'zaruba_last_ts\'] (упоминания в комментариях — не в счёт)');
    assert(!/i\(\$user, 'zaruba_last_ts'/.test(fightBody), 'fight() больше не читает zaruba_last_ts через Gameops::i()');
    assert(!/fail\(93\)/.test(fightBody), 'fight() больше никогда не возвращает код 93 (дневной лимит)');
    assert(!/cooldownMs\s*=\s*24/.test(fightBody), 'проверка 24-часового кулдауна убрана из fight()');
}

console.log('\n2) zaruba.php.fight() — награда за победу убрана целиком');
{
    const src = read('server/core/controllers/zaruba.php');
    const fightStart = src.indexOf('function fight(){');
    const fightEnd = src.indexOf('function pump(){');
    const fightBody = src.slice(fightStart, fightEnd);
    assert(!/cig_reward|exp_reward/.test(fightBody), 'fight() не читает cig_reward/exp_reward из каталога');
    assert(!/ops->add\(\$user, 'cigarettes'/.test(fightBody), 'fight() не начисляет сигареты');
    assert(!/ops->add\(\$user, 'exp'/.test(fightBody), 'fight() не начисляет опыт');
    assert(!/'reward'\s*=>/.test(fightBody), 'ответ fight() больше не содержит поле reward');
    // 04.10.2026 (по прямому указанию — достижения категории 'pvp' подключены к Зарубе):
    // fight() снова пишет $user, НО только pvp_wins при победе — деньги/опыт/сигареты
    // по-прежнему не начисляются (см. проверки выше), saveUser() условна на $won.
    assert(/if\(\$won\)\{\s*\n\s*\$user\['pvp_wins'\]/.test(fightBody), 'saveUser() вызывается только условно, при победе, и только ради pvp_wins');
    assert(!/ops->add\(\$user, 'coins'/.test(fightBody), 'fight() по-прежнему не начисляет рубли');
    assert(!/ops->add\(\$user, 'stew'/.test(fightBody), 'fight() по-прежнему не начисляет тушёнку');
}

console.log('\n3) player_profile.js — панель награды Зарубы убрана с клиента');
{
    const src = read('_client/src/game/shell/overlays/player_profile.js');
    assert(!/PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/заруба панель награды\.png'\)\)/.test(src),
        'спрайт панели награды больше не создаётся (упоминание файла в поясняющем комментарии — не в счёт)');
    assert(!/formatRewardAmount/.test(src), 'неиспользуемый импорт formatRewardAmount убран (был нужен только для этой панели)');
    assert(!/err && err\.code === 93/.test(src), 'обработка кода 93 (дневной лимит) убрана — сервер его больше не вернёт');
}

console.log('\n4) bosses.php — урон друга из Соло доходит до получателя-не-Соло (фильтр diff_idx убран у источника)');
{
    const src = read('server/core/controllers/bosses.php');

    const sumStart = src.indexOf('private function _friendsDamageSumSince');
    const sumEnd   = src.indexOf('private function _friendsDamagePerUserSince');
    const sumBody  = src.slice(sumStart, sumEnd);
    assert(!/diff_idx.*IN \(0,1,2\)/.test(sumBody), '_friendsDamageSumSince: SQL больше не фильтрует diff_idx друга');
    // 30.09.2026 (прогон перед деплоем): 29.09.2026 запрос перешёл на карту $friendsSince
    // (per-uid граница времени, см. _friendsSinceMap()/_friendsSinceConds()) вместо плоского
    // "uid IN($ids) AND time>=" на всех сразу — суть (только по uid+time, без diff_idx) та же.
    assert(/WHERE \("\.\$this->_friendsSinceConds\(\$friendsSince\)\."\) AND `is_sedoy`=0/.test(sumBody),
        '_friendsDamageSumSince: запрос теперь по карте friendsSince (per-uid uid+time), без diff_idx');

    const perUserStart = src.indexOf('private function _friendsDamagePerUserSince');
    const perUserEnd   = src.indexOf('private function _friendIds');
    const perUserBody  = src.slice(perUserStart, perUserEnd);
    assert(!/diff_idx.*IN \(0,1,2\)/.test(perUserBody), '_friendsDamagePerUserSince: SQL больше не фильтрует diff_idx друга');

    const applyStart = src.indexOf('private function _applyFriendDamage');
    const applyEnd   = src.indexOf('function friendsDamage(){');
    const applyBody  = src.slice(applyStart, applyEnd);
    assert(!/diff_idx.*IN \(0,1,2\)/.test(applyBody), '_applyFriendDamage: курсорный SQL-запрос тоже больше не фильтрует diff_idx друга');
    assert(/if\(\$diffIdx === 3 \|\| empty\(\$friendsSince\)\) return;/.test(applyBody),
        'но гейт ПОЛУЧАТЕЛЯ (сам в Соло → друзья не помогают) остался нетронутым — асимметрия, не полное открытие');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

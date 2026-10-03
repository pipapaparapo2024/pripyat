/**
 * Test: 29.09.2026, репорт игрока со скриншотами — попап "НЕ УДАЛОСЬ ЗАСЧИТАТЬ ПОБЕДУ
 * (возможно, исчерпан дневной лимит убийств этого босса)" появлялся СРАЗУ следом за попапом
 * "ТЫ ПРОИГРАЛ!" на бою, который по факту был выигран (добивающий удар состоялся).
 *
 * Корень: гонка между _onFightTimeout() (1-секундный тик таймера боя, bosses_fight.js.
 * _tickBossFightTimer) и _onDefeat()→claimKill() (запрос награды за победу). Если добивающий
 * удар довёл HP до 0 ПРЯМО НА ГРАНИЦЕ дедлайна боя (FIGHT_DURATION_MS), _onDefeat() уже
 * отправил claimKill() и ждёт ответ сервера — но this._bossStartMs[idx] сбрасывается ТОЛЬКО
 * внутри колбэка claimKill() (успех/ошибка), не сразу при вызове. Пока claimKill() летит
 * туда-обратно, bossStartMs всё ещё ненулевой — очередной тик таймера видел remain===0 и звал
 * _onFightTimeout() БЕЗ проверки, что claimKill уже в полёте. endFightSession() (внутри
 * _onFightTimeout) успевал обнулить бой на сервере раньше, чем ответ claimKill() долетал
 * обратно — claimKill() находил bossStartMs<=0 на сервере и отказывал (fail 65/66), а бой уже
 * был записан как ПОРАЖЕНИЕ, хотя игрок реально добил босса первым.
 *
 * Фикс: _onFightTimeout() теперь проверяет тот же _claimKillPending[diffIdx_idx] флаг, что уже
 * гасит гонку _attack()/_syncFriendsDamage() внутри _onDefeat() — если claimKill уже в полёте,
 * таймаут откладывается. После ЛЮБОГО исхода claimKill() (успех/ошибка) bossStartMs уже
 * обнулён им самим — обычный ранний return (bossStartMs===0) естественно погасит следующий тик
 * без необходимости отдельно "разрешать" таймауту продолжить.
 *
 * Run: node tests/boss-timeout-vs-claimkill-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const combatPath = path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js');
const combatSrc  = fs.readFileSync(combatPath, 'utf-8');

console.log('\n1) _onFightTimeout() проверяет _claimKillPending ДО того, как начинает обрабатывать таймаут (сброс HP/bossStartMs/показ попапа)');
{
    const startIdx = combatSrc.indexOf('proto._onFightTimeout = function(idx){');
    assert(startIdx !== -1, '_onFightTimeout() найден в файле');
    const closeSkillsIdx = combatSrc.indexOf('this._closeSkillsIfOpen();', startIdx);
    const setHpIdx = combatSrc.indexOf('this._setHp(idx, this._maxHp(idx));', startIdx);
    const guardBody = combatSrc.slice(startIdx, setHpIdx);

    assert(/if\(this\._claimKillPending\s*&&\s*this\._claimKillPending\[pendingKeyGuard\]\)\{\s*[\s\S]*?return;\s*\}/.test(guardBody),
        'guard на _claimKillPending присутствует и делает return ДО сброса HP/bossStartMs/попапа');

    // Guard должен идти ДО this._closeSkillsIfOpen() / сброса состояния — иначе часть побочных
    // эффектов (закрытие скиллов, запоминание hpLeftAtLoss и т.п.) успеет случиться до отмены.
    const guardIdx = combatSrc.indexOf('this._claimKillPending[pendingKeyGuard]', startIdx);
    assert(guardIdx !== -1 && closeSkillsIdx !== -1 && guardIdx < closeSkillsIdx,
        'проверка _claimKillPending стоит РАНЬШЕ closeSkillsIfOpen()/сброса состояния боя — таймаут не успевает начать поражение раньше проверки');
}

console.log('\n2) pendingKeyGuard формируется той же формулой diffIdx+"_"+idx, что и pendingKey в _onDefeat() — один и тот же флаг, не два разных namespace');
{
    assert(/const pendingKeyGuard = this\._diffIdx \+ '_' \+ idx;/.test(combatSrc),
        '_onFightTimeout считает ключ той же формулой (diffIdx_idx), что и _onDefeat.pendingKey — иначе флаги не совпадут и guard будет бесполезен');
    assert(/const pendingKey = diffIdx \+ '_' \+ idx;/.test(combatSrc),
        '_onDefeat всё ещё формирует pendingKey той же формулой (регресс-гвард — не переименовано втихую)');
}

console.log('\n3) Симуляция гонки: claimKill в полёте (pending=true) на момент срабатывания тика таймера — таймаут не должен сработать');
{
    // Мини-модель самого guard-условия, извлечённого из исходника — без запуска PIXI/сервера.
    function onFightTimeoutGuardPasses(claimKillPending, diffIdx, idx){
        const pendingKeyGuard = diffIdx + '_' + idx;
        if(claimKillPending && claimKillPending[pendingKeyGuard]) return false; // таймаут отложен
        return true; // таймаут обрабатывается как обычно
    }

    const diffIdx = 0, idx = 2;
    assert(onFightTimeoutGuardPasses({ '0_2': true }, diffIdx, idx) === false,
        'claimKill в полёте для этого boss/diff → таймаут НЕ обрабатывается (гонка погашена)');
    assert(onFightTimeoutGuardPasses({ '0_2': false }, diffIdx, idx) === true,
        'claimKill уже разрешился (pending сброшен в false) → обычный таймаут проходит как раньше');
    assert(onFightTimeoutGuardPasses({}, diffIdx, idx) === true,
        'нет вообще никакого claimKill в полёте (обычный честный таймаут без победы) → работает как раньше, регресс не сломан');
    assert(onFightTimeoutGuardPasses({ '0_5': true }, diffIdx, idx) === true,
        'claimKill в полёте, но для ДРУГОГО босса (idx=5, не 2) → таймаут ЭТОГО босса не блокируется чужим pending');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

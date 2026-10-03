/**
 * Test: баг "нанёс 1000 урона убившего удара боссу — опыт скиллов от этого удара не
 * очищается при выходе/победе, тянется в следующую попытку, хотя новый уровень скилла
 * не был получен".
 *
 * Причина: bosses-combat.js._attack() вызывал skills.addFightDamage(damage) ПОСЛЕ
 * this._setHp(idx, newHp) — а _setHp() синхронно вызывает _onDefeat(), если удар добивающий.
 * _onDefeat() тут же финализирует сессию скиллов (skills.resetSession() → _endSession(),
 * которая обнуляет прогресс, если новый уровень не получен). Поскольку addFightDamage()
 * этого самого удара выполнялся ПОЗЖЕ, урон добивающего удара добавлялся уже ПОСЛЕ
 * финализации/обнуления — создавая свежий "хвост" прогресса, переживающий победу.
 *
 * Фикс: addFightDamage(damage) вызывается ДО _setHp(idx, newHp), чтобы к моменту
 * финализации сессии (_onDefeat → resetSession → _endSession) весь урон этого удара уже
 * был учтён в skillsDmgSpent.
 *
 * 22.09.2026 (по прямому указанию — "перенеси весь бой на сервер"): расчёт урона переехал в
 * bosses.php.attack(), клиентский _attack() теперь только шлёт запрос и применяет готовый
 * ответ (res.damage/res.hp) в колбэке успеха — _setHp() сама по себе по-прежнему НЕ вызывает
 * _onDefeat() синхронно (это делает явный `if(res.hp <= 0) this._onDefeat(idx);` в конце
 * колбэка).
 *
 * 22.09.2026 (второй заход, тем же днём — "читеры могут делать себе огромное кол-во очков
 * скиллов через консоль"): skillsDmgSpent тоже переехал на сервер — bosses.attack() сам копит
 * его (в skills_levels.dmgSpent) и возвращает в patch, addFightDamage(res.damage) на клиенте
 * убран целиком (клиент больше не считает и не шлёт прогресс скиллов сам). Инвариант этого
 * теста теперь другой: skills._loadLevelsFromUdata() (перечитывает СВЕЖИЙ, уже посчитанный
 * сервером прогресс из applyPatch(res.patch)) должен произойти ДО явного _onDefeat(idx) —
 * иначе UI мог бы на мгновение показать устаревший прогресс поверх уже применённого патча.
 *
 * Run: node tests/skills-defeat-damage-order.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);

console.log('\nTest 1: skills._loadLevelsFromUdata() вызывается ДО явного this._onDefeat(idx) в колбэке успеха bosses.attack');
{
    const start = combatSrc.indexOf('proto._attack = function');
    const end   = combatSrc.indexOf('\n    };', start);
    const body  = combatSrc.slice(start, end);
    const applyIdx   = body.indexOf('applyPatch(res.patch);');
    const syncIdx    = body.indexOf('if(window.skills) skills._loadLevelsFromUdata();');
    const defeatIdx  = body.indexOf('if(res.hp <= 0) this._onDefeat(idx);');
    assert(applyIdx !== -1, 'applyPatch(res.patch) найден в колбэке успеха _attack()');
    assert(syncIdx !== -1, 'skills._loadLevelsFromUdata() найден в колбэке успеха _attack() (заменил addFightDamage(res.damage))');
    assert(defeatIdx !== -1, 'явный вызов this._onDefeat(idx) по res.hp<=0 найден');
    assert(applyIdx !== -1 && syncIdx !== -1 && applyIdx < syncIdx,
        'applyPatch() применяется ДО перечитывания skills_levels — иначе _loadLevelsFromUdata() читала бы ещё старый udata');
    assert(syncIdx !== -1 && defeatIdx !== -1 && syncIdx < defeatIdx,
        'прогресс скиллов синхронизируется ДО того, как _onDefeat() запускает попап результата боя');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: баг 20.09.2026 (по прямому указанию) — "прокачал скилл Повелитель времени — время
 * боя полностью обновляется; если постоянно жать эту кнопку, будет почти бесконечное время".
 *
 * Корень: экран боя открывает кнопку "СКИЛЛЫ" прямо во время боя (bosses-combat.js —
 * skillBtn.on('pointerdown', ()=>skills.open())), скиллы качаются на УРОН, нанесённый прямо в
 * этом же бою (skills.addFightDamage вызывается из _attack()). Таймер боя же читал бонус
 * "Повелителя времени" ЖИВЫМ (skills.getTimeBonus()) на каждую атаку/тик — значит инвестиция
 * очков скилла, заработанных ЭТИМ ЖЕ боем, мгновенно продлевала дедлайн ЭТОГО ЖЕ боя: бей →
 * качай Повелителя времени → дедлайн отодвигается → бей ещё → качай ещё. Не буквально
 * бесконечно (потолок скилла — 30 уровней = +60 минут), но задним числом продлевает УЖЕ
 * идущий бой, что и воспринимается как "обновление времени".
 *
 * Дополнительно найден ПОБОЧНЫЙ баг при разборе: bosses_fight.js._openBossesFight() —
 * основной путь входа в бой (bosses_select → prefight → bosses_fight) — проставляет
 * bosses._bossStartMs[di][bossIdx] ДО первой атаки. Из-за этого "if(isNewAttempt){...}" внутри
 * bosses-combat.js._attack() практически НИКОГДА не выполняется по основному пути (тот же
 * механизм уже описан в существующем комментарии про skills.beginSession() чуть выше в файле).
 * Это значит, что и _seedFriendDmgBaseline(), и вчерашний авто-форфейт брошенных боёв
 * (см. boss-abandoned-fight-leaks-help-to-other-bosses.test.js) были фактически МЁРТВЫМ кодом
 * по основному пути. Оба перенесены в _openBossesFight() — туда же, где заморозка timeBonus.
 *
 * Фикс: bosses._fightTimeBonusMs[diffIdx][bossIdx] — бонус ЗАМОРАЖИВАЕТСЯ ОДИН РАЗ в момент
 * реального старта попытки (bosses_fight._openBossesFight, сразу после ответа bosses.startFight)
 * и больше не перечитывается вживую нигде, пока бой не закончится (победа/поражение/таймаут/
 * форфейт) — те же 4 точки сброса, что и у curCycleDmg/friendDmgApplied/bossStartMs.
 *
 * Run: node tests/boss-time-skill-frozen-bonus-and-energy-check.test.js
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

const bossesSrc  = readSrc('_client/src/game/bosses.js');
const combatSrc  = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightSrc   = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const selectSrc  = readSrc('_client/src/game/shell/overlays/bosses_select.js');
const skillsSrc  = readSrc('_client/src/game/skills.js');

console.log('\nTest 1: bosses.js инициализирует _fightTimeBonusMs (4×8, как _bossStartMs)');
{
    assert(/this\._fightTimeBonusMs = \[\[0,0,0,0,0,0,0,0\],\[0,0,0,0,0,0,0,0\],\[0,0,0,0,0,0,0,0\],\[0,0,0,0,0,0,0,0\]\];/.test(bossesSrc),
        '_fightTimeBonusMs проинициализирован тем же 4×8 шаблоном, что и _bossStartMs/friendDmgApplied');
}

console.log('\nTest 2: заморозка происходит РОВНО ОДИН РАЗ — в bosses_fight._openBossesFight, сразу после ответа сервера на startFight');
{
    const start = fightSrc.indexOf('proto._openBossesFight = function');
    const cbStart = fightSrc.indexOf("TS.php('bosses.startFight'", start);
    const cbEnd   = fightSrc.indexOf('this._reallyOpenBossesFight(bossIdx);', cbStart);
    const body = fightSrc.slice(cbStart, cbEnd);

    assert(/bosses\._fightTimeBonusMs\[di\]\[bossIdx\] = window\.skills \? skills\.getTimeBonus\(\) \* 60000 : 0;/.test(body),
        'внутри колбэка успеха startFight бонус читается живьём РОВНО ОДИН РАЗ и сохраняется в _fightTimeBonusMs[di][bossIdx]');

    // Единственное на весь клиент место, где skills.getTimeBonus() читается напрямую КАК КОД
    // (не в комментарии) — это и есть точка заморозки. Считаем только реальный вызов вида
    // "skills.getTimeBonus() * ..." (используется для арифметики), комментарии игнорируем.
    const LIVE_CALL_RE = /skills\.getTimeBonus\(\)\s*\*/g;
    const liveCallCount = (src) => (src.match(LIVE_CALL_RE) || []).length;

    assert(liveCallCount(combatSrc) === 0 && liveCallCount(selectSrc) === 0,
        'bosses-combat.js и bosses_select.js больше НЕ читают skills.getTimeBonus() напрямую как код (только через замороженный _fightTimeBonusMs)');

    const fightSrcLiveReads = liveCallCount(fightSrc);
    assert(fightSrcLiveReads === 1,
        'в bosses_fight.js ровно ОДИН реальный вызов skills.getTimeBonus() в коде — сама точка заморозки (нашли ' + fightSrcLiveReads + ')');
}

console.log('\nTest 3: заморозка происходит ДО открытия экрана боя (this._reallyOpenBossesFight)');
{
    const start = fightSrc.indexOf('proto._openBossesFight = function');
    const freezePos = fightSrc.indexOf('bosses._fightTimeBonusMs[di][bossIdx] = window.skills', start);
    const openPos   = fightSrc.indexOf('this._reallyOpenBossesFight(bossIdx);', start);
    assert(freezePos > start && openPos > freezePos,
        'заморозка бонуса происходит раньше, чем игрок вообще увидит экран боя (нельзя атаковать раньше заморозки)');
}

console.log('\nTest 4: _attack() (bosses-combat.js) использует ЗАМОРОЖЕННЫЙ this._fightTimeBonusMs, а не живой skills.getTimeBonus()');
{
    const start = combatSrc.indexOf('proto._attack = function');
    const end   = combatSrc.indexOf('\n    };', start);
    const body  = combatSrc.slice(start, end);
    assert(/const timeBonus = \(this\._fightTimeBonusMs && this\._fightTimeBonusMs\[this\._diffIdx\]\)\s*\n\s*\? \(this\._fightTimeBonusMs\[this\._diffIdx\]\[idx\] \|\| 0\) : 0;/.test(body),
        '_attack() читает this._fightTimeBonusMs[this._diffIdx][idx], а не skills.getTimeBonus() напрямую');
    assert(!/const timeBonus = window\.skills \? skills\.getTimeBonus/.test(body),
        'старое живое чтение timeBonus в _attack() полностью убрано');
}

console.log('\nTest 5: персистентность — _saveToUdata пишет, _loadFromUdata читает fightTimeBonusMs');
{
    assert(/fightTimeBonusMs: this\._fightTimeBonusMs,/.test(combatSrc), '_saveToUdata сохраняет fightTimeBonusMs в bosses_data');
    assert(/if\(s\.fightTimeBonusMs && Array\.isArray\(s\.fightTimeBonusMs\)\)/.test(combatSrc), '_loadFromUdata читает fightTimeBonusMs обратно');
}

console.log('\nTest 6: все 4 точки конца попытки боя сбрасывают fightTimeBonusMs (та же жизнь, что у bossStartMs/curCycleDmg)');
{
    const timeoutStart = combatSrc.indexOf('proto._onFightTimeout = function');
    const timeoutEnd   = combatSrc.indexOf('\n    };', timeoutStart);
    const timeoutBody  = combatSrc.slice(timeoutStart, timeoutEnd);
    assert(/this\._fightTimeBonusMs && this\._fightTimeBonusMs\[this\._diffIdx\]\) this\._fightTimeBonusMs\[this\._diffIdx\]\[idx\] = 0;/.test(timeoutBody),
        '_onFightTimeout сбрасывает fightTimeBonusMs');

    const defeatStart = combatSrc.indexOf('proto._onDefeat = function');
    const defeatEnd   = combatSrc.indexOf('\n    };', defeatStart);
    const defeatBody  = combatSrc.slice(defeatStart, defeatEnd);
    const resetsInDefeat = (defeatBody.match(/this\._fightTimeBonusMs && this\._fightTimeBonusMs\[diffIdx\]\) this\._fightTimeBonusMs\[diffIdx\]\[idx\] = 0;/g) || []).length;
    assert(resetsInDefeat === 2, '_onDefeat сбрасывает fightTimeBonusMs в ОБЕИХ ветках (успех claimKill и ошибка сервера), нашли ' + resetsInDefeat);

    assert(/bosses\._fightTimeBonusMs && bosses\._fightTimeBonusMs\[diffIdx\]\) bosses\._fightTimeBonusMs\[diffIdx\]\[idx\] = 0;/.test(fightSrc),
        '_forfeitBossFight (bosses_fight.js, кнопка "ВЫЙТИ ИЗ БОЯ") тоже сбрасывает fightTimeBonusMs');
}

console.log('\nTest 7: побочный найденный баг — авто-форфейт брошенных боёв перенесён в реальную точку старта (был мёртв по основному пути)');
{
    const start = fightSrc.indexOf('proto._openBossesFight = function');
    const cbStart = fightSrc.indexOf("TS.php('bosses.startFight'", start);
    const cbEnd   = fightSrc.indexOf('this._reallyOpenBossesFight(bossIdx);', cbStart);
    const body = fightSrc.slice(cbStart, cbEnd);

    // 22.09.2026: _seedFriendDmgBaseline() убран целиком (не просто перенесён) — сервер теперь
    // сам считает урон друга только с момента bossStartMs текущей попытки (см. большой
    // комментарий в bosses.php над _derivedHp()), ретроактивный зачёт старого урона друга
    // физически невозможен, обходной манёвр не нужен. См. также bosses-combat.js, где явно
    // задокументирован этот убранный вызов.
    assert(!/bosses\._seedFriendDmgBaseline\(/.test(body), '_seedFriendDmgBaseline полностью убран из точки старта попытки (функция удалена, а не просто перемещена)');
    assert(/for\(let _di=0; _di<4; _di\+\+\)\{[\s\S]*?for\(let _bi=0; _bi<8; _bi\+\+\)\{/.test(body),
        'авто-форфейт брошенных боёв (цикл по всем diff/boss) остался в реальной точке старта');
    assert(/bosses\._saveToUdata\(\);/.test(body), 'изменения (заморозка/форфейт) сразу сохраняются в udata на клиенте');
}

console.log('\nTest 8: симуляция — прокачка скилла ПРЯМО В БОЮ больше НЕ продлевает уже идущий бой (реальный прогон формулы, не только regex)');
{
    // Модель ровно той же формулы, что в _attack()/_tickBossFightTimer до и после фикса.
    const FIGHT_DURATION_MS = 9 * 60 * 60 * 1000; // 9 часов, как bosses.FIGHT_DURATION_MS

    function remainingOLD(startMs, nowMs, liveSkillLevel){
        const bonus = liveSkillLevel > 0 ? Math.floor(60 * liveSkillLevel / 30) * 60000 : 0; // живой, растёт с уровнем
        return Math.max(0, FIGHT_DURATION_MS + bonus - (nowMs - startMs));
    }
    function remainingNEW(startMs, nowMs, frozenBonusMs){
        return Math.max(0, FIGHT_DURATION_MS + frozenBonusMs - (nowMs - startMs));
    }

    const start = 0;
    const beforeLevelUp = 8 * 60 * 60 * 1000 + 55 * 60 * 1000; // 8ч55м прошло, бой скоро истечёт (уровень скилла был 0)
    const frozenAtStart = 0; // на старте боя уровень скилла был 0 → заморожен 0

    const oldRemainBefore = remainingOLD(start, beforeLevelUp, 0);
    const newRemainBefore = remainingNEW(start, beforeLevelUp, frozenAtStart);
    assert(oldRemainBefore === newRemainBefore && oldRemainBefore === 5 * 60 * 1000,
        'до прокачки скилла оба варианта совпадают: осталось 5 минут');

    // Игрок ПРЯМО В БОЮ (на уроне этого же боя) качает "Повелителя времени" до максимума (ур.30).
    const liveLevelAfterUpgrade = 30;

    const oldRemainAfter = remainingOLD(start, beforeLevelUp, liveLevelAfterUpgrade); // СТАРОЕ поведение: живой бонус
    const newRemainAfter = remainingNEW(start, beforeLevelUp, frozenAtStart);          // НОВОЕ поведение: заморожен на старте

    assert(oldRemainAfter === 65 * 60 * 1000,
        'воспроизведён баг СТАРОЙ формулы: после прокачки скилла ПРЯМО В БОЮ до максимума оставшееся время задним числом подскочило с 5 минут до 65 минут — "время обновилось"');
    assert(newRemainAfter === 5 * 60 * 1000,
        'исправлено НОВОЙ формулой: прокачка скилла в разгар боя НИКАК не влияет на дедлайн уже идущего боя — по-прежнему 5 минут');

    // Бонус применяется только к СЛЕДУЮЩЕЙ, ещё не начатой попытке.
    const nextFightFrozenBonus = liveLevelAfterUpgrade > 0 ? Math.floor(60 * liveLevelAfterUpgrade / 30) * 60000 : 0;
    const nextFightRemain = remainingNEW(0, 0, nextFightFrozenBonus);
    assert(nextFightRemain === FIGHT_DURATION_MS + 60 * 60000,
        'при этом честно заработанный бонус (+60 мин на максимум скилла) применяется к СЛЕДУЮЩЕЙ попытке боя целиком, а не пропадает');
}

console.log('\nTest 9: скилл "Адреналин" (+энергия) — проверка на тот же класс бага ("боюсь, что энергия тоже бесконечно обновляется")');
{
    assert(/\{id:9,\s*name:'Адреналин'/.test(skillsSrc), 'скилл "Адреналин" (id:9) существует в каталоге');
    assert(/getEnergyBonus\(\)\{/.test(skillsSrc), 'skills.getEnergyBonus() определён');

    const anyCallSiteOutsideDefinition = [bossesSrc, combatSrc, fightSrc, selectSrc]
        .some(src => /getEnergyBonus\(\)/.test(src));
    assert(!anyCallSiteOutsideDefinition,
        'ВАЖНО (не баг "бесконечная энергия", а другой баг): getEnergyBonus() нигде НЕ вызывается — ' +
        'бонус "Адреналина" сейчас вообще ни на что не влияет (max_energy им не увеличивается), поэтому ' +
        'механизма "полного обновления энергии" технически не существует — скилл просто ничего не делает. ' +
        'Требуется отдельное решение пользователя: подключать ли getEnergyBonus() к TIMERS.ENERGY_MAX.');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

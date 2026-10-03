/**
 * Test: батч 22.09.2026 (новая фича, по прямому указанию — "нужно сделать так, что прокачку
 * скиллов можно делать и при нажатии на сам скилл, но только на тот, что сейчас прокачивается,
 * то есть если на 2 скилле прокачать 20 я не могу") —
 *
 * Раньше клик по иконке скилла (bosses_skills.js) только выделял её (`_selectSkill`) — реальная
 * прокачка происходила ТОЛЬКО через отдельную кнопку "ПРОКАЧАТЬ" (`_upgradeSelectedSkill`),
 * которая сама искала "текущий" скилл по строгому порядку 0→19 (предыдущий уже куплен, сам ещё
 * не на максимуме, есть доступное очко) — полностью игнорируя, что именно было выделено кликом.
 *
 * Фикс: логика поиска "текущего" скилла вынесена в отдельный `_getCurrentUpgradeSkillIdx()`
 * (используется и кнопкой, и иконкой — единый источник правды, не два независимых алгоритма).
 * Клик по иконке ВСЕГДА выделяет её (тултип/рамка, как раньше), но прокачивает — ТОЛЬКО если
 * кликнули именно по текущему (следующему в цепочке разблокировки) скиллу. Клик по любому
 * другому скиллу — просто выделение, без прокачки (нельзя прыгнуть вперёд по цепочке).
 *
 * Run: node tests/bosses-skills-click-icon-to-upgrade-current-only.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_skills.js'), 'utf-8');

console.log('\nTest 1: _getCurrentUpgradeSkillIdx() — единая точка правды (та же логика 0→19, что раньше жила только внутри кнопки)');
{
    const start = src.indexOf('proto._getCurrentUpgradeSkillIdx = function(){');
    const end   = src.indexOf('\n    };', start);
    assert(start !== -1, '_getCurrentUpgradeSkillIdx определён');
    const body = src.slice(start, end);
    assert(/if\(!window\.skills\) return -1;/.test(body), 'возвращает -1, если модуль скиллов не загружен (не падает)');
    assert(/if\(lvl >= skills\.list\[i\]\.maxLvl\) continue;/.test(body), 'пропускает уже максимальные скиллы');
    assert(/if\(i > 0 && skills\.levels\[i-1\] < 1\) continue;/.test(body), 'пропускает скиллы, у которых предыдущий в цепочке ещё не куплен');
    assert(/if\(skills\.availablePoints < 1\) continue;/.test(body), 'пропускает, если нет доступных очков');
    assert(/return i;/.test(body), 'возвращает индекс первого подходящего скилла');
    assert(/return -1;\s*\n\s*\};/.test(src.slice(start)), 'возвращает -1, если подходящего скилла не нашлось (все на максимуме/очков нет)');
}

console.log('\nTest 2: _upgradeSelectedSkill() переиспользует _getCurrentUpgradeSkillIdx() (не дублирует цикл)');
{
    const start = src.indexOf('proto._upgradeSelectedSkill = function(){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(/const idx = this\._getCurrentUpgradeSkillIdx\(\);/.test(body), 'берёт индекс из общего геттера');
    assert(!/for\(let i = 0; i < 20; i\+\+\)\{/.test(body), 'старый инлайн-цикл поиска скилла убран отсюда (перенесён в геттер)');
}

console.log('\nTest 3: клик по иконке скилла — всегда выделяет, прокачивает ТОЛЬКО если это текущий скилл');
{
    const start = src.indexOf("hit.on('pointerdown', ()=>{");
    const end   = src.indexOf('\n            });', start);
    assert(start !== -1, 'обработчик клика по иконке найден');
    const body = src.slice(start, end);
    assert(/this\._selectSkill\(ii\);/.test(body), 'клик всегда выделяет иконку (тултип/рамка не меняли)');
    assert(/if\(ii === this\._getCurrentUpgradeSkillIdx\(\)\) this\._upgradeSelectedSkill\(\);/.test(body),
        'прокачивает ТОЛЬКО если индекс кликнутой иконки совпадает с текущим прокачиваемым скиллом');
}

console.log('\nTest 4: кнопка "ПРОКАЧАТЬ" по-прежнему работает независимо от того, что выделено кликом (не завязана на _skillSelected)');
{
    const start = src.indexOf("upgrBtn.on('pointerdown'");
    const end   = src.indexOf('\n', start);
    assert(/\(\)=>this\._upgradeSelectedSkill\(\)/.test(src.slice(start, end)), 'кнопка по-прежнему зовёт _upgradeSelectedSkill() напрямую');

    const upgradeStart = src.indexOf('proto._upgradeSelectedSkill = function(){');
    const upgradeEnd   = src.indexOf('\n    };', upgradeStart);
    assert(!/this\._skillSelected/.test(src.slice(upgradeStart, upgradeEnd)),
        '_upgradeSelectedSkill() не читает this._skillSelected — кнопка качает "текущий по цепочке" независимо от визуального выделения (как и раньше)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

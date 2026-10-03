/**
 * Test: репорт 18.09.2026 — "перезагрузил страницу во время боя с боссом — бой обрывается,
 * не сохраняется ни время, ни урон, ни рейтинг".
 *
 * Разбор показал: сами данные боя (bossStartMs/hpByDiff/curCycleDmg/friendDmgApplied) и так
 * переживали перезагрузку нормально (уже были в bosses_data + bossStartMs дополнительно
 * подтверждён сервером в bosses.startFight). Реальная причина — this._diffIdx (выбранная
 * сложность: обычный/опасный/суровый/соло) НЕ сохранялся вообще и после reload всегда
 * сбрасывался конструктором Bosses на 0. bosses_select.js._openBossesPopup() (автопереход в
 * бой при открытии экрана боссов) проверял активный бой ТОЛЬКО в bossStartMs[текущий diffIdx] —
 * если бой был начат в Опасном/Суровом/Соло, после reload эта проверка смотрела в диапазон
 * bossStartMs[0], видела там нули и решала, что боя нет. Экран боссов открывался пустым,
 * будто прогресс сгорел, хотя весь урон/таймер/рейтинг были целы и на сервере, и в udata.
 *
 * Фикс — два независимых слоя защиты:
 *  1) diffIdx теперь сохраняется/восстанавливается вместе с остальным bosses_data.
 *  2) _openBossesPopup сканирует ВСЕ 4 diffIdx-массива при автопереходе, не только текущий.
 *
 * Run: node tests/bosses-reload-mid-fight-resume.test.js
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
const selectSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8'
);

console.log('\nTest 1: _diffIdx сохраняется в bosses_data');
{
    const saveMatch = combatSrc.match(/proto\._saveToUdata = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!saveMatch, '_saveToUdata найден');
    assert(/diffIdx:\s*this\._diffIdx,/.test(saveMatch ? saveMatch[1] : ''),
        '_saveToUdata записывает diffIdx: this._diffIdx в bosses_data');
}

console.log('\nTest 2: _diffIdx восстанавливается из bosses_data с проверкой диапазона 0..3');
{
    const loadMatch = combatSrc.match(/proto\._loadFromUdata = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!loadMatch, '_loadFromUdata найден');
    const body = loadMatch ? loadMatch[1] : '';
    assert(/s\.diffIdx >= 0 && s\.diffIdx <= 3/.test(body),
        '_loadFromUdata проверяет, что восстановленный diffIdx в допустимом диапазоне 0..3');
    assert(/this\._diffIdx = s\.diffIdx;/.test(body),
        '_loadFromUdata присваивает this._diffIdx = s.diffIdx');
}

console.log('\nTest 3: _openBossesPopup сканирует ВСЕ diffIdx при автопереходе в активный бой (не только bosses._diffIdx)');
{
    const popupMatch = selectSrc.match(/proto\._openBossesPopup = function\(\)\{([\s\S]*?)\n\t\t\/\/ Компас пока грузится контент/);
    assert(!!popupMatch, '_openBossesPopup (редирект-блок) найден');
    const body = popupMatch ? popupMatch[1] : '';

    // Раньше был жёсткий `const _redir_di = bosses._diffIdx;` без перебора — теперь должен
    // быть цикл по всем 4 диапазонам bossStartMs.
    assert(!/const _redir_di\s*=\s*bosses\._diffIdx;/.test(body),
        'больше нет жёсткой привязки к ОДНОМУ bosses._diffIdx (старый баг)');
    assert(/for\s*\(\s*let _di\s*=\s*0;\s*_di\s*<\s*bosses\._bossStartMs\.length;\s*_di\+\+\s*\)/.test(body),
        'есть внешний цикл по всем diffIdx (0..bosses._bossStartMs.length)');
    assert(/bosses\._diffIdx\s*=\s*_di;/.test(body),
        'при находке активного боя bosses._diffIdx переключается на диапазон, где реально идёт бой');
    assert(/this\._openBossesFight\(_bi\);/.test(body),
        'после переключения diffIdx открывается боёвка для найденного боя');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

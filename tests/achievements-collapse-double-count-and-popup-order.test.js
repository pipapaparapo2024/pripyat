/**
 * Test: батч 17.09.2026 (продолжение) — 3 отдельных вопроса/бага по достижениям:
 *
 *  1) Персистентность (вопрос пользователя, не баг) — achievements/achievement_stars уже
 *     в whitelist users.php (сохраняются в БД) и уже сбрасываются кнопкой «Сброс всего» в
 *     dev-панели. Тест просто фиксирует это как регресс-гвард.
 *  2) «Мои достижения» в Сводке схлопывает темы в одну карточку (максимальный ЗАРАБОТАННЫЙ
 *     уровень, иначе минимальный/следующая цель) — НЕ трогая категории, где каждый пункт сам
 *     по себе отдельное достижение (боссы kill/solo/fast, локации zone_clear, типы заначек
 *     stash, комбинации карт/покера).
 *  3) energy_spent считался ДВАЖДЫ за каждый чекпоинт зоны (zone.js сам инкрементил + ещё раз
 *     внутри achievements.onEnergySpent) — из-за этого достижения по энергии (и задания в
 *     zadaniya.js на том же ключе) засчитывались вдвое быстрее нужного. Плюс: проверка
 *     достижений в zone.js теперь идёт ПОСЛЕДНЕЙ (после _showCpReward), чтобы попап ачивки
 *     гарантированно рисовался поверх всплывающей награды, а не под ней.
 *
 * Run: node tests/achievements-collapse-double-count-and-popup-order.test.js
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

const usersPhp   = readSrc('server/core/controllers/users.php');
const devPanelSrc = readSrc('_client/src/game/shell/overlays/dev_panel.js');
const achSrc      = readSrc('_client/src/game/achievements.js');
const zoneSrc     = readSrc('_client/src/game/zone.js');
const svodAchSrc  = readSrc('_client/src/game/svod/svod-achievements.js');

console.log('\nTest 1: достижения сохраняются в БД и сбрасываются вместе с аккаунтом (регресс-гвард)');
{
    assert(/'achievements','achievement_stars'/.test(usersPhp), "'achievements'/'achievement_stars' есть в whitelist users.php");
    assert(/achievements:'', achievement_stars:'0'/.test(devPanelSrc), "_resetAccount обнуляет оба поля");
}

// 17.09.2026 (позже этого батча, перенос Зоны на сервер): zone.js._attack() (заполнение
// чекпоинта) больше не считает энергию сам вообще — energy_spent теперь инкрементирует СЕРВЕР
// (zone.php.fillCheckpoint(), ровно один раз на чекпоинт), клиент только применяет патч и
// по-прежнему зовёт achievements.onEnergySpent(energyCost) один раз, чтобы достижения
// пересчитались с той же суммой. "Двойной счёт" структурно невозможен: одна сторона (клиент)
// вообще не пишет это поле — пишет только сервер.
console.log('\nTest 2: energy_spent считается ровно один раз за чекпоинт (не дважды)');
{
    const onEnergyStart = achSrc.indexOf('onEnergySpent(amount){');
    const onEnergyEnd   = achSrc.indexOf('}', onEnergyStart) + 1;
    const onEnergyBody  = achSrc.slice(onEnergyStart, onEnergyEnd);
    assert(!/udata\['energy_spent'\]\s*=/.test(onEnergyBody),
        'achievements.onEnergySpent больше не трогает udata[\'energy_spent\'] сам (это уже делает вызывающий код)');
    assert(/this\._checkAll\(\);/.test(onEnergyBody), 'по-прежнему проверяет достижения');

    const zoneEnergyIncrements = (zoneSrc.match(/udata\['energy_spent'\]\s*=/g) || []).length;
    assert(zoneEnergyIncrements === 0,
        `zone.js вообще не пишет energy_spent (перенесено на сервер) — найдено ${zoneEnergyIncrements}`);
    assert(/achievements\.onEnergySpent\(energyCost\);/.test(zoneSrc),
        'zone.js по-прежнему зовёт achievements.onEnergySpent(energyCost) РОВНО с той суммой, что списал сервер');

    const zonePhp = readSrc('server/core/controllers/zone.php');
    const serverEnergyIncrements = (zonePhp.match(/\$user\['energy_spent'\]\s*=/g) || []).length;
    assert(serverEnergyIncrements === 1,
        `zone.php увеличивает energy_spent ровно 1 раз (найдено ${serverEnergyIncrements}) — единственный источник правды`);
}

console.log('\nTest 3: проверка достижений в чекпоинте зоны идёт ПОСЛЕ показа всплывающей награды (z-order)');
{
    const rewardIdx = zoneSrc.indexOf('this._showCpReward(earned_exp, earned_cig, earned_resp);');
    const achIdx    = zoneSrc.indexOf('if(window.achievements) achievements.onEnergySpent(energyCost);');
    assert(rewardIdx !== -1 && achIdx !== -1, 'обе строки найдены в zone.js');
    assert(achIdx > rewardIdx, 'onEnergySpent() вызывается ПОСЛЕ _showCpReward() — попап ачивки рисуется поверх, не под наградой');
}

console.log('\nTest 4: «Мои достижения» делегирует схлопывание в общий модуль (не дублирует логику)');
{
    // 21.09.2026: импорт расширился (аккордеон добавил achievementFamilyKey/achievementThreshold/
    // familyMembers/getStatValue/formatAchNum в ту же строку) — проверяем, что collapseToTopPerFamily
    // всё ещё импортируется ИЗ ОБЩЕГО МОДУЛЯ, не привязываясь к точному списку остальных имён.
    assert(/import \{[^}]*\bcollapseToTopPerFamily\b[^}]*\} from '\.\.\/\.\.\/modules\/achievement-tiers\.js'/.test(svodAchSrc),
        'svod-achievements.js импортирует схлопывание из общего модуля');
    assert(/collapseToTopPerFamily\(rawList, earned\)/.test(svodAchSrc),
        'использует collapseToTopPerFamily при построении списка карточек');
    assert(!/function familyKey\(/.test(svodAchSrc) && !/function threshold\(/.test(svodAchSrc),
        'локальные дубли familyKey/threshold удалены из svod-achievements.js после переноса в общий модуль');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

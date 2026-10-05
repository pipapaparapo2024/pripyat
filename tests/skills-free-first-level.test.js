/**
 * Test: скилл 0 ("С размашки") раньше давал первый уровень (1/10) бесплатно один раз за
 * игрока (до этого — вообще все 10 уровней были бесплатными, что было убрано ещё раньше).
 *
 * 18.09.2026 (по прямому указанию, отдельно от переноса Скиллов на сервер): льгота убрана
 * ЦЕЛИКОМ — теперь ВСЕ уровни ВСЕХ скиллов, включая первый уровень скилла 0, стоят полную
 * цену очками, без исключений. usedFreeFirstSkill удалён из клиента и сервера полностью.
 *
 * Сопутствующий фикс (сохранён с прошлого батча, актуален и сейчас): цикл поиска скилла для
 * авто-ПРОКАЧАТЬ (skills.js) и авто-выбора (bosses_skills.js) должен требовать доступное
 * очко ОДИНАКОВО для всех скиллов, включая скилл 0 — раньше (до появления самой льготы) там
 * стояла проверка "i > 0 && availablePoints < 1", которая просто ПРОПУСКАЛА проверку очков
 * для скилла 0 — с убранной льготой это снова стало бы дырой (бесплатная прокачка скилла 0
 * без очков), если бы "i > 0 &&" тихо вернулось при рефакторинге. Тесты ниже следят, чтобы
 * условие осталось безусловным (без "i > 0 &&") для ОБОИХ мест.
 *
 * Run: node tests/skills-free-first-level.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const skillsSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'skills.js'), 'utf-8'
);
const bossesSkillsSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_skills.js'), 'utf-8'
);
const skillsPhp = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'skills.php'), 'utf-8'
);

console.log('\nTest 1: usedFreeFirstSkill удалён из клиента и сервера полностью');
{
    assert(!/usedFreeFirstSkill/.test(skillsSrc), 'skills.js не содержит usedFreeFirstSkill ни в каком виде');
    assert(!/usedFreeFirstSkill/.test(bossesSkillsSrc), 'bosses_skills.js не содержит usedFreeFirstSkill ни в каком виде');
    assert(!/usedFreeFirstSkill/.test(skillsPhp), 'skills.php не содержит usedFreeFirstSkill ни в каком виде');
}

console.log('\nTest 2: skills.php.upgrade() — льготы для скилла 0 больше нет, все очки считаются одинаково');
{
    // 25.09.2026: skills.php целиком CRLF (\r\n) — регекс с голым \n на границе функции не
    // матчился (m был null). indexOf-слайс до конца файла переживает оба варианта окончания строк.
    const upgradeStart = skillsPhp.indexOf('function upgrade(){');
    const m = upgradeStart !== -1 ? [null, skillsPhp.slice(upgradeStart)] : null;
    assert(!!m, 'upgrade() найден в skills.php');
    if(m){
        const body = m[1];
        assert(!/\$wasFree/.test(body), 'переменная $wasFree (флаг льготы) удалена');
        assert(!/\$sid === 0 && intval\(\$levels\[0\]\)/.test(body), 'спец-случай "sid===0 && levels[0]===0" удалён — скилл 0 не выделен из общей логики');
        // 25.09.2026: доступные очки читаются из персистентного $state['points'], не earned-spent
        // на лету — см. tests/skills-server-authoritative.test.js Test 10.
        // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): проверка стала
        // многострочным блоком (rollback/close лока строки перед return), сам инвариант не менялся.
        assert(/if\(intval\(\$state\['points'\] \?\? 0\) < 1\)\{/.test(body),
            'проверка доступных очков применяется безусловно — для ЛЮБОГО skill_id, включая 0');
        assert(/return \$this->ops->fail\(78\); \/\/ недостаточно очков скиллов/.test(body), 'отказ при нехватке очков возвращает код 78');
        assert(/\$levels\[\$sid\] = intval\(\$levels\[\$sid\]\) \+ 1;/.test(body),
            'оплаченная прокачка увеличивает уровень ровно на 1 — единственный путь в функции теперь');
    }
}

console.log('\nTest 3: skills.php._spentPoints() — считает ВСЕ уровни без исключения для скилла 0');
{
    const m = skillsPhp.match(/private function _spentPoints\(\$levels\)\{([\s\S]*?)\n        \}/);
    assert(!!m, '_spentPoints найден');
    if(m){
        assert(/foreach\(\$levels as \$v\) \$spent \+= intval\(\$v\);/.test(m[1]),
            'суммирует все уровни одинаково, без ветвления по индексу 0');
        assert(!/\$i === 0/.test(m[1]), 'больше нет ветвления "$i === 0" (льгота для первого скилла убрана)');
    }
}

console.log('\nTest 4: skills.js — spentPoints/canUp/авто-ПРОКАЧАТЬ считают скилл 0 как любой другой');
{
    const spentBody = skillsSrc.match(/get spentPoints\(\)\{([\s\S]*?)\n\t\}/)[1];
    assert(/this\.levels\.reduce\(\(s, v\) => s \+ v, 0\);/.test(spentBody),
        'spentPoints суммирует все уровни без исключения индекса 0');

    const updateCardBody = skillsSrc.match(/_updateCard\(card, si, availPts\)\{([\s\S]*?)const cw = 422/)[1];
    assert(/const canUp = !maxed && availPts >= 1;/.test(updateCardBody),
        'canUp требует очки одинаково для любого скилла — freeFirstAvail больше не влияет на кликабельность');

    const prokBody = skillsSrc.match(/prokBg\.on\('pointerdown', \(\) => \{([\s\S]*?)\n\t\t\}\);/)[1];
    assert(/return this\.availablePoints >= 1;/.test(prokBody),
        'авто-ПРОКАЧАТЬ ищет скилл только по наличию очков — явного разрешения "без очков для скилла 0" больше нет');
}

console.log('\nTest 5: bosses_skills.js — цикл выбора скилла требует очки безусловно (без "i > 0 &&")');
{
    // 22.09.2026: цикл поиска "текущего" скилла вынесен из _upgradeSelectedSkill в отдельный
    // _getCurrentUpgradeSkillIdx() (переиспользуется и кнопкой "ПРОКАЧАТЬ", и кликом по иконке
    // скилла — см. bosses-skills-click-icon-to-upgrade-current-only.test.js), сама проверка не
    // изменилась, просто сменила прописку.
    const m = bossesSkillsSrc.match(/proto\._getCurrentUpgradeSkillIdx = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_getCurrentUpgradeSkillIdx найден');
    if(m){
        const body = m[1];
        assert(!/if\(i > 0 && skills\.availablePoints < 1\) continue;/.test(body),
            'старая условная проверка "i > 0 &&" (пропускала проверку очков для скилла 0) не вернулась');
        assert(/if\(skills\.availablePoints < 1\) continue;/.test(body),
            'проверка очков применяется безусловно для ЛЮБОГО индекса, включая 0');
    }
}

console.log('\nTest 6: skills.upgrade() принимает необязательный onDone-колбэк — bosses_skills.js больше не ждёт синхронный возврат');
{
    assert(/upgrade\(idx, onDone\)\{/.test(skillsSrc), 'upgrade() принимает второй параметр onDone');
    assert(/if\(onDone\) onDone\(true\);/.test(skillsSrc), 'вызывает onDone(true) при успехе');
    assert(/if\(onDone\) onDone\(false\);/.test(skillsSrc), 'вызывает onDone(false) при неудаче/ошибке');
    assert(/skills\.upgrade\(idx, \(ok\) => \{ if\(ok\) this\._updateBossesSkillsScreen\(\); \}\);/.test(bossesSkillsSrc),
        'bosses_skills.js обновляет свой экран через onDone-колбэк, а не через "if(skills.upgrade(idx))" (который всегда был бы false — upgrade асинхронный)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 24.09.2026, по прямому указанию + скриншот — "атаковал 400 урона, перезагрузил
 * браузер — слетел рейтинг урона И шкала опыта скилов (0/1000 вместо реального прогресса)".
 *
 * Корень: window.skills/window.bosses создаются в module_control.js (index.js: `new
 * ModuleControl()`) РАНЬШЕ, чем window.TS вообще существует и тем более раньше, чем
 * TS.php('users.get', ...) успевает ответить — в момент их конструктора window.udata ещё
 * null (index.js: `window.root = window.udata = ... = null;`). Их собственный конструкторский
 * skills._loadFromUdata()/_loadLevelsFromUdata() и bosses._loadFromUdata() при null udata
 * молча ничего не находят и остаются на дефолтах (levels=[0×20], skillsDmgSpent=0,
 * bossStartMs=[0×8×4]). Дальше их НИЧТО не пересинхронизирует само по себе — только
 * СЛУЧАЙНО, как побочный эффект действия игрока (атака/прокачка/конец боя для skills;
 * клик по ХУДу — interface-panels.js — для bosses). После обычной перезагрузки БЕЗ единого
 * действия skills так и остаётся на 0/1000, хотя реальный skills_levels уже пришёл в udata.
 *
 * Фикс: preloader.js.onGetUserInfo() — ровно в момент, когда window.udata становится
 * реальным (не null), явно вызывает skills._loadFromUdata() и bosses._loadFromUdata() —
 * гарантированный пересинк независимо от порядка конструирования модулей и от того, успеет
 * ли игрок случайно совершить действие, которое побочным эффектом обновило бы эти объекты.
 *
 * Run: node tests/skills-bosses-resync-on-real-udata-arrival.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'preloader.js'), 'utf-8');
const indexSrc = fs.readFileSync(path.join(root, '_client', 'src', 'index.js'), 'utf-8');
const moduleControlSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'module_control.js'), 'utf-8');

console.log('\nTest 1: onGetUserInfo() пересинхронизирует skills/bosses сразу после установки реального window.udata');
{
    const m = src.match(/onGetUserInfo\(data\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'onGetUserInfo найдена');
    const body = m ? m[1] : '';
    const udataAssignIdx = body.indexOf('window.udata = window.wrapPlayerData(_raw);');
    const skillsCallIdx  = body.indexOf("if(window.skills && typeof skills._loadFromUdata === 'function') skills._loadFromUdata();");
    const bossesCallIdx  = body.indexOf("if(window.bosses && typeof bosses._loadFromUdata === 'function') bosses._loadFromUdata();");
    assert(udataAssignIdx !== -1, 'window.udata = window.wrapPlayerData(_raw) присваивание найдено (реальные данные, не дефолты нового игрока)');
    assert(skillsCallIdx !== -1 && skillsCallIdx > udataAssignIdx, 'skills._loadFromUdata() вызывается ПОСЛЕ того, как udata стал реальным');
    assert(bossesCallIdx !== -1 && bossesCallIdx > udataAssignIdx, 'bosses._loadFromUdata() вызывается ПОСЛЕ того, как udata стал реальным');
}

console.log('\nTest 2: регресс-гвард — подтверждает саму гонку (module_control.js создаёт объекты ДО TS.php(users.get) в index.js)');
{
    const moduleControlIdx = indexSrc.indexOf('window.modules = new ModuleControl();');
    const tsCreateIdx      = indexSrc.indexOf('window.TS = new Server(');
    assert(moduleControlIdx !== -1 && tsCreateIdx !== -1 && moduleControlIdx < tsCreateIdx,
        'new ModuleControl() (создаёт skills/bosses) идёт РАНЬШЕ создания window.TS — значит РАНЬШЕ любого TS.php(users.get) запроса');
    assert(/window\.root = window\.udata = window\.pre_control = null;/.test(indexSrc),
        'window.udata явно null на момент старта index.js — подтверждает, что конструкторы skills/bosses видят null');
    assert(/window\.skills = new Skills\(\);/.test(moduleControlSrc), 'window.skills создаётся в module_control.js (конструктор — единственный момент до фикса, когда он пытался читать udata)');
    assert(/window\.bosses = new Bosses\(/.test(moduleControlSrc), 'window.bosses создаётся в module_control.js аналогично');
}

console.log('\nTest 3: регресс-гвард — skills._loadFromUdata() (вызываемая фиксом) реально доходит до _loadLevelsFromUdata() (читает skills_levels, не только legacy skills_data)');
{
    const skillsSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'skills.js'), 'utf-8');
    const m = skillsSrc.match(/_loadFromUdata\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'skills._loadFromUdata найдена');
    assert(m && /this\._loadLevelsFromUdata\(\);/.test(m[1]), '_loadFromUdata() зовёт _loadLevelsFromUdata() внутри себя — фикс одним вызовом подтягивает оба поля (legacy skills_data И актуальный skills_levels)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

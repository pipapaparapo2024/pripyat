/**
 * Test: 03.10.2026 (аудит "обходные users.save в обход player-save.js" — тот же класс гонки,
 * уже чинившийся у onboarding.js._setStep(), dev_panel.js.saveDevChanges(), bank.js).
 *
 * skills.js._flushSaveToUdata() (вызывается на КАЖДЫЙ удар по боссу, через 800мс-дебаунс
 * _saveToUdata()) и zone.js._saveToUdata() (вызывается при каждом изменении прогресса
 * локаций/бизнеса) раньше слали СВОЙ отдельный TS.php('users.save', ...) напрямую, в обход
 * общего revision/suspend-механизма player-save.js. zone.js был явно отмечен НЕ обёрнутым в
 * suspend/resume ещё в аудите 28.09.2026 (см. incident_checkall_flush_wipes_server_credits —
 * память агента). skills.js оказался даже опаснее: срабатывает на горячем пути
 * bosses-combat.js._attack(), который сам оборачивает СВОЙ прямой Gameops-сейв в
 * suspendPlayerSave('boss_attack') именно для защиты от этого класса гонки — но эта защита
 * не действует на вызовы МИМО player-save.js, так что конкурентный ad-hoc сейв из skills.js
 * мог прилететь на сервер СТАРЫМ снимком udata ПОСЛЕ прямой записи bosses.attack() и тихо
 * затереть её (bosses_data/total_damage — обычные client-writable поля users.php).
 *
 * Фикс: оба метода теперь используют общий flushPlayerSave() под suspend/resume.
 *
 * Run: node tests/skills-zone-save-suspend-resume-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const skillsSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'skills.js'), 'utf-8');
const zoneSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'zone.js'), 'utf-8');

console.log('\nTest 1: skills.js._flushSaveToUdata() — suspend/resume вокруг flushPlayerSave(), не прямой TS.php в обход player-save.js');
{
    const start = skillsSrc.indexOf('_flushSaveToUdata(){');
    const end   = skillsSrc.indexOf('\n\t}', start);
    const body  = skillsSrc.slice(start, end);
    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('skills_save_to_udata'\);/.test(body),
        'suspendPlayerSave вызывается перед сохранением');
    assert(/if\(window\.flushPlayerSave\) flushPlayerSave\('skills_save_to_udata', _resume\);/.test(body),
        'основной путь — общий flushPlayerSave() (участвует в revision-механизме player-save.js)');
    assert(!/if\(window\.TS\) TS\.php\('users\.save', \{udata_json: JSON\.stringify\(udata\)\}, null, null\);/.test(body),
        'старый прямой TS.php(\'users.save\', ..., null, null) — fire-and-forget в обход player-save.js — убран');
}

console.log('\nTest 2: skills.js._saveToUdata() делегирует отправку в _flushSaveToUdata() (не дублирует прямой TS.php)');
{
    const start = skillsSrc.indexOf('_saveToUdata(){');
    const end   = skillsSrc.indexOf('\n\t}', start);
    const body  = skillsSrc.slice(start, end);
    assert(/this\._flushSaveToUdata\(\);/.test(body), '_saveToUdata() вызывает _flushSaveToUdata() внутри debounce-таймера');
}

console.log('\nTest 3: zone.js._saveToUdata() — suspend/resume вокруг flushPlayerSave(), не прямой TS.php в обход player-save.js');
{
    const start = zoneSrc.indexOf('_saveToUdata(){');
    const end   = zoneSrc.indexOf('\n    }', start);
    const body  = zoneSrc.slice(start, end);
    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('zone_save_to_udata'\);/.test(body),
        'suspendPlayerSave вызывается перед сохранением');
    assert(/if\(window\.flushPlayerSave\)\{/.test(body),
        'основной путь — общий flushPlayerSave() (участвует в revision-механизме player-save.js)');
    assert(!/TS\.php\('users\.save', \{udata_json: JSON\.stringify\(udata\)\},\s*\n\s*\(\)=>console\.log/.test(body),
        'старый прямой безусловный TS.php(\'users.save\', ...) вне flushPlayerSave-пути убран как основной путь');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 03.10.2026 (репорт — "после прохождения обучения оно повторно появляется при входе в
 * игру" у части игроков).
 *
 * Корень: onboarding.js._setStep() раньше слал СВОЙ отдельный TS.php('users.save', ...) с
 * JSON.stringify(udata) целиком — в обход единого дебаунс/revision-механизма player-save.js
 * (тот же класс гонки, что уже чинили у dev_panel.js.saveDevChanges() и bank.js — см.
 * bank-purchase-save-suspend-overwrite-fix.test.js). udata['onboarding_step']=step сам по себе
 * уже ставит в очередь обычный дебаунс-сейв (udata обёрнут в Proxy, см. wrapPlayerData() в
 * player-save.js) — второй, независимый, ничем не защищённый сейв отсюда был лишней гонкой:
 * если какой-то ДРУГОЙ сейв в полёте (например обычный periodic/debounce-флаш, захвативший
 * снимок udata ДО этой мутации) долетал до сервера ПОЗЖЕ прямого вызова отсюда, он тихо
 * перезаписывал onboarding_step обратно на старое значение — шаг 'done' терялся, и при
 * следующем входе обучение показывалось заново.
 *
 * Фикс: _setStep() теперь использует общий flushPlayerSave() под suspend/resume — тот же
 * приём, что уже защищает старт/завершение боя с боссом и покупки (см. AGENTS.md "Архитектура
 * сервера: серверно-авторитетная экономика").
 *
 * Run: node tests/onboarding-step-save-suspend-resume.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'onboarding.js'), 'utf-8');

const start = src.indexOf('_setStep(step){');
const end   = src.indexOf('\n    }', start);
const body  = src.slice(start, end);

console.log('\nTest 1: _setStep() приостанавливает автосейв на время своего сохранения');
{
    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('onboarding_set_step'\);/.test(body),
        'suspendPlayerSave вызывается перед сохранением шага');
    assert(/if\(window\.resumePlayerSave\) resumePlayerSave\('onboarding_set_step'\);/.test(body),
        'resumePlayerSave вызывается в колбэке завершения (успех/ошибка) — не навсегда замораживает автосейв');
}

console.log('\nTest 2: сохранение идёт через общий flushPlayerSave() (revision-механизм player-save.js), не отдельным TS.php в обход него');
{
    assert(/if\(window\.flushPlayerSave\)\{\s*\n\s*flushPlayerSave\('onboarding_set_step:' \+ step, _done\);/.test(body),
        'основной путь — flushPlayerSave(), участвует в общем revision/suspend-механизме');
    assert(/\} else if\(window\.TS\)\{/.test(body),
        'прямой TS.php остался только как fallback на случай, если player-save.js ещё не установлен (не основной путь)');
}

console.log('\nTest 3: событие pripyat:onboarding-done по-прежнему отправляется при шаге done');
assert(/if\(step === 'done'\) window\.dispatchEvent\(new Event\('pripyat:onboarding-done'\)\);/.test(src),
    'событие done не тронуто фиксом — только механизм сохранения изменился');

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

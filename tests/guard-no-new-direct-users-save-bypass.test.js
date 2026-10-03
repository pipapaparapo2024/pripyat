/**
 * Test: 03.10.2026 (по прямому указанию, после 4-го по счёту инцидента того же класса —
 * dev_panel.js.saveDevChanges, bank.js, onboarding.js._setStep, skills.js/zone.js сегодня) —
 * "сторожевой" тест на НОВЫЕ прямые TS.php('users.save', ...) в обход player-save.js.
 *
 * Прямой вызов TS.php('users.save', ...) где угодно, кроме самого player-save.js, в обход
 * revision/suspend-механизма — повторяющийся класс гонки в этом проекте: конкурентный
 * server-authoritative запрос (bosses.attack/claimKill, hata.buy и т.п.) пишет поле НАПРЯМУЮ
 * через Gameops::saveUser(), а независимый ad-hoc сейв (debounce/немедленный/fire-and-forget),
 * захвативший СТАРЫЙ снимок udata ДО этой записи, может прилететь на сервер ПОЗЖЕ и тихо
 * затереть её. player-save.js (suspendPlayerSave/resumePlayerSave/flushPlayerSave) — именно
 * тот механизм, который должен использоваться вместо прямого TS.php('users.save', ...) всюду,
 * кроме самого этого модуля.
 *
 * Этот тест НЕ требует, чтобы каждый файл был идеально "правильным" прямо сейчас — несколько
 * мест остаются в allowlist ниже осознанно (dev-инструменты, одноразовый сейв при первом
 * входе, мёртвый код, точечные fallback-ветки, уже защищённые suspend/resume вокруг
 * flushPlayerSave() в основном пути, см. комментарии в allowlist). Цель — не чтобы список был
 * пуст, а чтобы НИКТО не мог молча добавить НОВОЕ место/новый файл с этим паттерном, не
 * заметив и не обновив этот тест — любое изменение числа вхождений в известном файле или
 * появление паттерна в НОВОМ файле ломает тест и требует осознанного решения (исправить через
 * flushPlayerSave() или добавить в allowlist с объяснением, почему здесь это безопасно).
 *
 * Run: node tests/guard-no-new-direct-users-save-bypass.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src');
const PATTERN = /TS\.php\(\s*['"]users\.save['"]/g;

function walk(dir, out = []){
    for(const entry of fs.readdirSync(dir, { withFileTypes: true })){
        const full = path.join(dir, entry.name);
        if(entry.isDirectory()) walk(full, out);
        else if(entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

// relPath (POSIX-style, относительно _client/src) → ожидаемое число вхождений (код + комментарии,
// т.к. надёжно различить "это реальный вызов" от "это упоминание в комментарии" простым regex
// нельзя, а любое НОВОЕ упоминание — повод перечитать место и осознанно решить, что с ним делать).
const ALLOWLIST = {
    // Сам модуль — единственное место, где прямой вызов НЕ обходной, а и есть реализация.
    'modules/player-save.js': 2, // 1 реальный вызов + 1 упоминание в комментарии про dev_panel.js

    // Dev-инструменты — не часть обычного игрового потока, риск гонки с реальной экономикой
    // игрока минимален (используются вручную разработчиком/тестировщиком).
    'game/debug-tools.js': 1,
    'game/shell/overlays/dev_panel.js': 4, // 3 реальных вызова + 1 упоминание в комментарии

    // Один раз при самом первом входе (сохранение начального ника из VK) — до того, как
    // начинается обычный игровой цикл с конкурентными server-authoritative запросами.
    'game/preloader.js': 1,

    // Мёртвый код — proto._saveSkillsData объявлена, но нигде не вызывается (skills_levels
    // мигрировал на server-only поле 18.09.2026, этот метод остался от старой клиентской
    // прокачки). Не вызывается — гонки нет. Безопаснее оставить задокументированным, чем
    // удалять без явного указания (правило №2 проекта).
    'game/shell/overlays/bosses_skills.js': 1,

    // Смена ника — пользовательское действие по клику, не горячий путь экономики/боя,
    // коллизия с server-authoritative записью практически невозможна по таймингу.
    'game/shell/popups/nick.js': 2, // 1 реальный вызов + 1 упоминание в комментарии

    // Только упоминание в комментарии (объясняет, ПОЧЕМУ раньше было иначе) — реального вызова
    // в этом файле больше нет (hata.buy/hata.select полностью server-authoritative).
    'game/shell/overlays/hata.js': 1,

    // 03.10.2026: onboarding._setStep() переведён на flushPlayerSave() под suspend/resume —
    // прямой TS.php остался только как fallback НА СЛУЧАЙ, если player-save.js почему-то ещё
    // не установлен (защищён suspend/resume вокруг себя же, см. тест ниже).
    'game/onboarding.js': 2, // 1 реальный fallback-вызов + 1 упоминание в комментарии

    // 03.10.2026: skills.js._flushSaveToUdata()/zone.js._saveToUdata() переведены на
    // flushPlayerSave() под suspend/resume — прямой TS.php остался только как fallback-ветка
    // (защищена suspend/resume вокруг себя же), см.
    // skills-zone-save-suspend-resume-race-fix.test.js для полной проверки.
    'game/skills.js': 2, // 1 реальный fallback-вызов + 1 упоминание в комментарии
    'game/zone.js': 2,   // 1 реальный fallback-вызов + 1 упоминание в комментарии
};

console.log('\nTest 1: ни одного НОВОГО файла с TS.php(\'users.save\', ...) вне allowlist');
{
    const allFiles = walk(root);
    const unexpected = [];
    const mismatched = [];

    allFiles.forEach(full => {
        const rel = path.relative(root, full).split(path.sep).join('/');
        const content = fs.readFileSync(full, 'utf-8');
        const count = (content.match(PATTERN) || []).length;
        if(count === 0) return;

        if(!(rel in ALLOWLIST)){
            unexpected.push(rel + ' (' + count + ' вхожд.)');
        } else if(ALLOWLIST[rel] !== count){
            mismatched.push(rel + ': ожидалось ' + ALLOWLIST[rel] + ', найдено ' + count);
        }
    });

    assert(unexpected.length === 0,
        unexpected.length === 0
            ? 'новых файлов с прямым TS.php(\'users.save\', ...) не появилось'
            : 'НАЙДЕНЫ НОВЫЕ файлы с обходом player-save.js: ' + unexpected.join('; ') +
              ' — использовать flushPlayerSave()/suspendPlayerSave()/resumePlayerSave() (modules/player-save.js) или осознанно добавить в ALLOWLIST этого теста с объяснением');

    assert(mismatched.length === 0,
        mismatched.length === 0
            ? 'число вхождений в уже известных файлах не изменилось исподтишка'
            : 'ИЗМЕНИЛОСЬ число вхождений в уже известных файлах: ' + mismatched.join('; ') +
              ' — проверить, не добавлен ли новый необёрнутый вызов рядом со старым');
}

console.log('\nTest 2: fallback-ветки в onboarding.js/skills.js/zone.js реально обёрнуты suspend/resume (не голый TS.php)');
{
    const onboardingSrc = fs.readFileSync(path.join(root, 'game', 'onboarding.js'), 'utf-8');
    const skillsSrc     = fs.readFileSync(path.join(root, 'game', 'skills.js'), 'utf-8');
    const zoneSrc       = fs.readFileSync(path.join(root, 'game', 'zone.js'), 'utf-8');

    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('onboarding_set_step'\);/.test(onboardingSrc),
        'onboarding.js: suspendPlayerSave вызывается ДО любого пути сохранения (в т.ч. fallback)');
    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('skills_save_to_udata'\);/.test(skillsSrc),
        'skills.js: suspendPlayerSave вызывается ДО любого пути сохранения (в т.ч. fallback)');
    assert(/if\(window\.suspendPlayerSave\) suspendPlayerSave\('zone_save_to_udata'\);/.test(zoneSrc),
        'zone.js: suspendPlayerSave вызывается ДО любого пути сохранения (в т.ч. fallback)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

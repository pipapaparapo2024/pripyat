/**
 * Test: прогресс до следующего очка скилла (skillsDmgSpent) сбрасывался в 0 после выхода
 * и повторного захода в игру, хотя должен копиться пожизненно (комментарий в коде это
 * прямо обещает: "Шкала скиллов НЕ должна обнуляться между боями").
 *
 * Репорт пользователя: нанёс 1000 урона по боссу, экран показывал "1000/2000" до
 * следующего очка; вышел и зашёл заново — снова "0/2000".
 *
 * Причина: _saveToUdata() писал skillsDmgSpent/levels только в ПАМЯТЬ (window.udata) —
 * реальная отправка на сервер происходит либо раз в 60 секунд (автосейв), либо через
 * beforeunload при закрытии вкладки. beforeunload-запрос — асинхронный fetch, который в
 * вебвью VK Mini App часто не успевает долететь до реального закрытия страницы (это
 * известное ограничение браузеров, ещё жёстче в контейнерах вроде VK). Если игрок нанёс
 * урон и почти сразу закрыл вкладку — сохранение не долетает, при следующей загрузке
 * с сервера приходит СТАРОЕ значение skillsDmgSpent.
 *
 * Фикс: _saveToUdata() теперь (с дебаунсом 800мс, чтобы не долбить сервер на каждый
 * отдельный удар при быстрой серии атак) сразу шлёт TS.php('users.save', ...) — тот же
 * паттерн немедленного сохранения, что уже используется в bosses_skills.js._saveSkillsData
 * для того же файла skills_data.
 *
 * Run: node tests/skills-progress-persist.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'skills.js'), 'utf-8'
);

console.log('\nTest 1: _saveToUdata() всё ещё пишет skillsDmgSpent/levels в udata (не сломано)');
{
    const m = src.match(/_saveToUdata\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_saveToUdata найден');
    if (m) {
        const body = m[1];
        assert(/udata\['skills_data'\] = JSON\.stringify\(\{/.test(body), 'по-прежнему пишет в udata[\'skills_data\']');
        assert(/skillsDmgSpent: this\.skillsDmgSpent/.test(body), 'сохраняет skillsDmgSpent');
        // 18.09.2026 (позже этого батча — перенос Скиллов на сервер): levels больше НЕ
        // пишется сюда — это поле client-writable, а реальная прокачка теперь хранится в
        // служебном skills_levels (пишет только сервер, см. skills-server-authoritative.test.js).
        assert(!/levels: this\.levels/.test(body), 'levels больше не пишется в client-writable skills_data (перенесено на сервер)');
    }
}

console.log('\nTest 2: _saveToUdata() дебаунсит немедленную отправку на сервер (не ждёт автосейва/beforeunload)');
{
    const m = src.match(/_saveToUdata\(\)\{([\s\S]*?)\n\t\}/);
    if (m) {
        const body = m[1];
        assert(/clearTimeout\(this\._saveDebounce\);/.test(body), 'сбрасывает предыдущий таймер — не копит очередь запросов при частых ударах');
        assert(/this\._saveDebounce = setTimeout\(\(\) => \{/.test(body), 'запускает новый таймер debounce');
        // 03.10.2026 (аудит "обходные users.save в обход player-save.js" — тот же класс гонки,
        // что чинили у onboarding.js._setStep()): прямой TS.php('users.save', ...) заменён на
        // делегирование в _flushSaveToUdata() — см. skills-save-suspend-resume-race-fix.test.js
        // для проверки, что реальная отправка идёт через flushPlayerSave() под suspend/resume.
        assert(/this\._flushSaveToUdata\(\);/.test(body),
            'реально отправляет сохранение на сервер через _flushSaveToUdata() (не полагается только на автосейв раз в 60с или beforeunload)');
        assert(/\}, 800\);/.test(body), 'debounce задержка 800мс — разумный компромисс между частотой запросов и надёжностью');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 24.09.2026, по прямому указанию (скриншот редактора позиций — "Выбрано:
 * home_elements_atlas_1.png", "этот элемент вообще удали из проекта") — аудит показал:
 * home_elements.min.js (компилированная Animate/FLA-библиотека) и её атлас
 * (home_elements_atlas_1.json/.png) НЕ подключены нигде в _client/src/ и НЕ упомянуты в
 * index.html <script> тегах — то есть физически не грузятся текущей игрой, мёртвый остаток
 * (mtime 9 июля, задолго до текущей архитектуры home.js на собственных PIXI-спрайтах).
 * Удалены из локальной папки разработки целиком.
 *
 * Run: node tests/home-elements-dead-asset-removed.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nhome_elements — файлы удалены из _client/development/');
assert(!fs.existsSync(path.join(root, '_client/development/libs/home_elements.min.js')), 'home_elements.min.js удалён');
assert(!fs.existsSync(path.join(root, '_client/development/images/home_elements_atlas_1.json')), 'home_elements_atlas_1.json удалён');
assert(!fs.existsSync(path.join(root, '_client/development/images/home_elements_atlas_1.png')), 'home_elements_atlas_1.png удалён');

console.log('\nРегресс-гвард — home_elements не подключён нигде в index.html и не используется в _client/src/');
const indexHtml = fs.readFileSync(path.join(root, '_client/development/index.html'), 'utf8');
assert(!/home_elements/.test(indexHtml), 'index.html не ссылается на home_elements (не было и не появилось)');

// 28.09.2026 (найдено полным прогоном): grep по голой подстроке "home_elements" неизбежно находит
// ЭТОТ ЖЕ самый комментарий выше (и аналогичные в home.js/home-legacy-bg0-...test.js), который
// как раз ОБЪЯСНЯЕТ, что home_elements удалён — комментарий обязан упомянуть имя того, что убрал,
// иначе не имеет смысла. Проверяем реальный КОД (без строк-комментариев), не текст целиком.
const { execSync } = require('child_process');
let grepOut = '';
try{
    grepOut = execSync('grep -rn "home_elements" _client/src/', { cwd: root }).toString();
} catch(e){
    grepOut = (e.stdout || '').toString(); // grep возвращает exit 1 при отсутствии совпадений — ожидаемый "успех"
}
const codeMatches = grepOut.split('\n').filter(line => {
    const afterColon = line.replace(/^[^:]*:[^:]*:/, ''); // path:lineno:content → content
    return line.trim() !== '' && !afterColon.trim().startsWith('//');
});
assert(codeMatches.length === 0,
    'ни один файл в _client/src/ не ссылается на home_elements ИЗ КОДА (было так и раньше — подтверждено, не только "не сломали сейчас"); найдено вне комментариев: ' + codeMatches.length);

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);

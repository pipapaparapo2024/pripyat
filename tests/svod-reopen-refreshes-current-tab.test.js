/**
 * Test: 24.09.2026, по прямому указанию — "поменял ник, зашёл в Сводку, топ по урону показывает
 * старый ник". Корень: Svod.open() перезапрашивал данные ТОЛЬКО при самом первом открытии за
 * сессию (currentTab === null -> _selectMainTab('news')); повторное открытие Сводки на ТОЙ ЖЕ
 * вкладке (без переключения на другую и обратно) просто показывало уже существующий _pixiWin —
 * _selectMainTab() сама по себе рано выходит, если currentTab не изменился
 * (`if(this.currentTab === key) return;`), поэтому свежий top.get()/достижения никогда не
 * подтягивались повторно.
 *
 * Run: node tests/svod-reopen-refreshes-current-tab.test.js
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'svod.js'), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

const start = src.indexOf('open(){');
const end   = src.indexOf('\n    close(){', start);
const body  = src.slice(start, end);

console.log('\nSvod.open() — принудительно обновляет текущую вкладку при повторном открытии');
assert(!!body && start !== -1, 'open() найден');
assert(/if\(this\.currentTab === null\)\{/.test(body), 'первый заход за сессию по-прежнему обрабатывается отдельно (news)');
assert(/const panel = this\._svodPanels\[this\.currentTab\];/.test(body), 'иначе — читает панель ТЕКУЩЕЙ вкладки напрямую (не через _selectMainTab, который бы рано вышел)');
assert(/if\(panel\.visible && typeof panel\._svodDefaultScope === 'function'\) panel\._svodDefaultScope\(\);/.test(body),
    'обновляет leaderboard-панель (respect/damage/ach «Общий топ»), если она сейчас видима');
assert(/panel\._svodAchPanel && panel\._svodAchPanel\.visible[\s\S]*?_svodRefreshAchievements\(\);/.test(body),
    'обновляет панель «Мои достижения», если сейчас видима именно она (не leaderboard той же вкладки)');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);

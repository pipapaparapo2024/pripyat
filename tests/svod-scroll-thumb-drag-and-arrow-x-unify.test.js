/**
 * Test: батч 25.09.2026 (по прямому указанию + скриншоты) — два бага скролла во вкладке Сводка:
 *
 * 1) "Могу листать колесом мыши, но не могу тащить сам ползунок вверх-вниз" (везде в Сводке —
 *    Топ по урону/авторитету/достижениям, Мои достижения). Корень: _buildSvodScroll (svod-
 *    scroll.js) вешает pointermove/pointerup на `parent` (переданный как `win`) для драга
 *    бегунка — PIXI доставляет эти события только объектам с interactive=true. `win` в обоих
 *    файлах (svod-leaderboard.js._buildLeaderboardPanel, svod-achievements.js.
 *    _buildMyAchievementsPanel) никогда не получал этот флаг — в отличие от bosses_select.js,
 *    где ТОТ ЖЕ паттерн скролла работает именно потому, что там win.interactive=true стоит явно
 *    (см. коммент в самом фиксе). Колесо мыши работало независимо — его слушатель висит прямо
 *    на DOM <canvas>, в обход PIXI hit-теста.
 *
 * 2) "Расположение стрелок в Мои достижения как будто отличается от Общего топа" — 24.09.2026
 *    уже унифицировали Y (обе используют arrowDownY:480), но X остался рассинхронизирован:
 *    achievements передавал arrowX:1033, leaderboard — arrowX:1034. 1px разницы был визуально
 *    заметен пользователю. Оба теперь используют arrowX:1034.
 *
 * "Друзья" без скролла в "Топ по урону" — НЕ баг: тот же getTotalH()/refresh(), что и у
 * "Общего топа", просто список друзей короче высоты viewport (мало друзей играет) →
 * scrollRange=0 → _buildSvodScroll.refresh() корректно прячет track/thumb/arrows (canScroll
 * false). Появится сам, как только друзей наберётся достаточно для переполнения — код не менялся.
 *
 * Run: node tests/svod-scroll-thumb-drag-and-arrow-x-unify.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const lbSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const achSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');
const scrollSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-scroll.js'), 'utf-8');
const bossesSelectSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8');

console.log('\nTest 1: svod-leaderboard.js — win.interactive=true (был отсутствовать, из-за этого drag бегунка не работал)');
{
    const s = lbSrc.indexOf('proto._buildLeaderboardPanel = function(tabCfg){');
    const e = lbSrc.indexOf('const bg = new PIXI.Sprite', s);
    const body = lbSrc.slice(s, e);
    assert(/win\.interactive = true;/.test(body), 'КРИТИЧНО: win.interactive = true стоит сразу после создания win');
}

console.log('\nTest 2: svod-achievements.js — win.interactive=true (тот же фикс)');
{
    const s = achSrc.indexOf('proto._buildMyAchievementsPanel = function(cfg){');
    const e = achSrc.indexOf('const bg = new PIXI.Sprite', s);
    const body = achSrc.slice(s, e);
    assert(/win\.interactive = true;/.test(body), 'КРИТИЧНО: win.interactive = true стоит сразу после создания win');
}

console.log('\nTest 3: регресс-гвард — bosses_select.js (эталон, "уже работает") тоже явно ставит win.interactive=true, подтверждает диагноз');
{
    assert(/win\.interactive = true;/.test(bossesSelectSrc), 'sanity: эталонный экран со скроллом действительно ставит win.interactive=true');
}

console.log('\nTest 4: svod-scroll.js — регресс-гвард, что drag по-прежнему вешается на parent (а не только на thumb/stage)');
{
    // 29.09.2026: добавлен dragRoot = window.root || parent — pointermove/pointerup теперь
    // предпочтительно вешаются на весь PIXI stage (window.root), чтобы драг бегунка не
    // обрывался, когда курсор уходит за пределы контейнера win; parent остаётся фолбэком
    // (и единственным вариантом в окружениях без window.root), поэтому смысл регресс-гварда
    // не меняется — просто через переменную dragRoot, а не напрямую.
    assert(/const dragRoot = window\.root \|\| parent;\s*\n\s*dragRoot\.on\('pointermove', onMove\);/.test(scrollSrc) &&
        /const dragRoot = window\.root \|\| parent;\s*\n\s*dragRoot\.off\('pointermove', onMove\);/.test(scrollSrc),
        'sanity: _buildSvodScroll всё ещё регистрирует drag-move/up через parent (как фолбэк dragRoot), не на thumb/stage');
}

console.log('\nTest 5: svod-achievements.js — arrowX унифицирован с leaderboard (1034, было 1033)');
{
    const start = achSrc.indexOf('this._buildSvodScroll({');
    const end   = achSrc.indexOf('});', start);
    const body  = achSrc.slice(start, end);
    assert(/trackX: 1035, arrowX: 1034, arrowDownY: 480,/.test(body),
        'КРИТИЧНО: arrowX:1034 (было 1033) — стрелки вверх/вниз теперь на той же X, что и в Общем топе');
}

console.log('\nTest 6: sanity — svod-leaderboard.js по-прежнему на arrowX:1034 (эталон, не менялся этим батчем)');
{
    assert(/trackX: 1035, arrowX: 1034, arrowDownY: 480,/.test(lbSrc), 'leaderboard остаётся эталонной точкой сверки');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

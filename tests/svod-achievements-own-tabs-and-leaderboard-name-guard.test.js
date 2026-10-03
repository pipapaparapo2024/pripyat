/**
 * Test: батч 21.09.2026 (по прямому указанию, репорт со скриншотами) —
 *
 *  1) "Кнопки Общий топ/Мои достижения пропали при открытии Мои достижения" — эти кнопки жили
 *     ТОЛЬКО внутри окна лидерборда (svod-leaderboard.js._buildLeaderboardPanel); переключение
 *     на панель достижений прятало окно лидерборда ЦЕЛИКОМ (panel.visible=false), включая сами
 *     кнопки — обратно переключиться было нечем. Фикс: панель достижений строит СВОИ копии
 *     обеих кнопок (svod-achievements.js), не полагаясь на кнопки соседней (в этот момент
 *     скрытой) панели.
 *
 *  2) "У одного игрока имя сломано/пустое (должен быть Алексей)" в общем топе (svod-leaderboard.js
 *     _loadLeaderboard) — цепочка фолбэков `entry.nick || u.name || 'ID N'` не отсекала
 *     ник из одних пробелов (truthy как непустая строка, но визуально пустая ячейка).
 *     Добавлен .trim() на каждом варианте цепочки.
 *
 * Run: node tests/svod-achievements-own-tabs-and-leaderboard-name-guard.test.js
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

const svodSrc         = readSrc('_client/src/game/svod.js');
const svodAchSrc       = readSrc('_client/src/game/svod/svod-achievements.js');
const svodLeaderSrc    = readSrc('_client/src/game/svod/svod-leaderboard.js');

console.log('\nTest 1: svod-achievements.js — панель строит СВОИ копии кнопок ОБЩИЙ ТОП/МОИ ДОСТИЖЕНИЯ');
{
    assert(/const subAll = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'общий топ неактив\.png'\)\);/.test(svodAchSrc),
        'кнопка "Общий топ" создаётся внутри самой панели достижений (неактивный вид — мы уже на достижениях)');
    assert(/const subSecond = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ cfg\.secondBtnActive\)\);/.test(svodAchSrc),
        'кнопка "Мои достижения" тоже своя, в активном виде (текстура берётся из cfg, не захардкожена)');
    assert(/subAll\.on\('pointerdown', \(\) => \{ if\(typeof cfg\.onSwitchToGeneral === 'function'\) cfg\.onSwitchToGeneral\(\); \}\);/.test(svodAchSrc),
        'клик по "Общий топ" внутри панели достижений вызывает callback возврата на лидерборд');
}

console.log('\nTest 2: svod.js — панель достижений строится с onSwitchToGeneral, возвращающим видимость лидерборда И его кнопок разом');
{
    assert(/const achPanel = this\._buildMyAchievementsPanel\(\{/.test(svodSrc), '_buildMyAchievementsPanel вызывается с объектом конфигурации (не голой строкой bgFile, как раньше)');
    const start = svodSrc.indexOf('onSwitchToGeneral: () => {');
    const end   = svodSrc.indexOf('\n                },', start);
    const body  = svodSrc.slice(start, end);
    assert(/achPanel\.visible = false;/.test(body) && /panel\.visible = true;/.test(body),
        'onSwitchToGeneral скрывает панель достижений и возвращает видимость лидерборда (вместе с его кнопками — они снова его дети)');
    assert(/if\(typeof panel\._svodDefaultScope === 'function'\) panel\._svodDefaultScope\(\);/.test(body),
        'возврат на лидерборд также сбрасывает scope на "все" и подсвечивает "Общий топ" как активный (тот же метод, что и при первом открытии вкладки)');
}

console.log('\nTest 3: svod-leaderboard.js — защита от пустого/пробельного ника в общем топе');
{
    assert(/r\.nameTxt\.text = \(entry\.nick && entry\.nick\.trim\(\)\) \|\| \(u && u\.name && u\.name\.trim\(\)\) \|\| \('ID ' \+ entry\.id\);/.test(svodLeaderSrc),
        'имя строится с .trim() на КАЖДОМ варианте цепочки — ник из одних пробелов больше не проходит как "истинный"');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

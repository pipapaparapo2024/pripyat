/**
 * Test: батч 19.09.2026 — правки по редактору позиций для экрана «Сводка» (главные вкладки,
 * список топа) и профиля игрока, присланные пользователем со скриншотами.
 *
 * 1) Главные вкладки Сводки (svod.js) — раньше x/y был ОДИН на активное/пассивное состояние
 *    (anchor-центрирование, 17.09.2026 фикс "кнопка отлетает вниз"). Теперь у части вкладок
 *    добавлена ТОЧЕЧНАЯ поправка по Y для конкретного состояния (activeDy/passiveDy) — общий
 *    anchor-фикс остаётся, поправки лишь смещают итоговую y при рендере данного состояния.
 * 2) player_profile.js — текст "Уровень: X Авторитет: Y Боссов убито: Z" заезжал на верхний
 *    HUD (репорт: "текст слишком далеко вверх залетел"), опущен на 40px.
 * 3) svod-leaderboard.js — avatarMask (белый Graphics-квадрат, служащий .mask для аватарки)
 *    ошибочно добавлялся в row как ОБЫЧНЫЙ видимый ребёнок — рисовался как самостоятельная
 *    подложка позади/поверх аватарки (репорт: "аватарки показываются за ячейкой"). Маска не
 *    должна быть в display-list вообще — работает по одной лишь ссылке .mask. Плюс аватарка
 *    сдвинута вправо на 36px, а колонка "Уровень" — на точную координату + белый цвет.
 *
 * Run: node tests/svod-editor-positions-19-09.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const svodSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod.js'), 'utf-8');
const leaderSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-leaderboard.js'), 'utf-8');
const profileSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf-8');

console.log('\nTest 1: svod.js — точечные поправки по Y для активного/пассивного состояния главных вкладок');
{
    assert(/key:'respect',[\s\S]*?activeDy:-2/.test(svodSrc), "'respect' (топ по авторитету): activeDy:-2 (поднять активную на 2px)");
    assert(/key:'damage', [\s\S]*?activeDy:-4/.test(svodSrc), "'damage' (топ по урону): activeDy:-4 (поднять активную на 4px)");
    assert(/key:'ach',[\s\S]*?activeDy:-10, passiveDy:-9/.test(svodSrc),
        "'ach' (топ по достижениям): activeDy:-10 и passiveDy:-9 (разные поправки для двух состояний)");

    const selectMatch = svodSrc.match(/_selectMainTab\(key\)\{([\s\S]*?)\n    \}/);
    assert(!!selectMatch, '_selectMainTab найден');
    assert(/spr\.y = t\.y \+ \(isActive \? \(t\.activeDy \|\| 0\) : \(t\.passiveDy \|\| 0\)\);/.test(selectMatch[1]),
        '_selectMainTab пересчитывает y при каждом переключении состояния (активна/пассивна)');
}

console.log('\nTest 2: player_profile.js — statsTxt (дублирующая надпись уровень/авторитет/боссов убито) убрана целиком (21.09.2026)');
{
    // Раньше этот тест проверял позицию statsTxt (опущена на 40px, не наезжает на HUD) —
    // 21.09.2026 по прямому указанию ("убери надпись сзади") сам элемент убран: он дублировал
    // поля, которые визитка (_buildVisitCard) и так показывает, а рисовался почти нечитаемым
    // текстом позади неё.
    assert(!/const statsTxt = new PIXI\.Text\(/.test(profileSrc), 'statsTxt больше не создаётся');
    assert(!/Авторитет: /.test(profileSrc), 'дублирующий текст "Авторитет: ..." нигде не остался');
}

// 22.09.2026 (ОТМЕНЕНО — баг найден по живому репорту "иконки игроков вообще не выводятся"):
// 19.09.2026 avatarMask убрали из display-list ЦЕЛИКОМ, решая проблему "белый квадрат виден
// поверх аватарки" — но без родителя PIXI никогда не обновлял её worldTransform, маска
// оставалась в (0,0) и вырезала аватарку целиком. Возвращено обратно — тот же рабочий паттерн,
// что в player_profile.js._buildVisitCard (маска ДОБАВЛЯЕТСЯ в сцену, PIXI и так не рендерит
// объект, пока он активно используется как чей-то .mask). См.
// svod-achievements-spacing-name-pos-and-leaderboard-avatar-mask-fix.test.js.
console.log('\nTest 3: svod-leaderboard.js — avatarMask добавлен в row (иначе PIXI не обновляет её transform)');
{
    const rowMatch = leaderSrc.match(/for\(let i = 0; i < ROWS_POOL; i\+\+\)\{([\s\S]*?)rowsContainer\.addChild\(row\);/);
    assert(!!rowMatch, 'блок построения строки найден');
    const body = rowMatch[1];
    assert(/row\.addChild\(avatarMask\);/.test(body), 'avatarMask добавлена в row.addChild (нужна для обновления transform)');
    assert(/avatar\.mask = avatarMask;/.test(body), 'avatarMask по-прежнему назначен как .mask для avatar (клиппинг фото работает)');
    assert(/row\.addChild\(avatar\);/.test(body), 'avatar (само фото) остаётся видимым ребёнком row');
}

// 22.09.2026: позиция/размер уточнены ещё раз редактором позиций (99,4,25×25) — см.
// svod-icon-position-rounding-and-subtab-sync-fix.test.js для актуальных значений.
console.log('\nTest 4: svod-leaderboard.js — аватарка позиционирована именованными константами (маска и аватарка синхронизированы)');
{
    assert(/const AVATAR_X = 99, AVATAR_Y = 4, AVATAR_SIZE = 25, AVATAR_RADIUS = 5;/.test(leaderSrc), 'AVATAR_X/Y/SIZE/RADIUS объявлены');
    assert(/avatarMask\.x = AVATAR_X; avatarMask\.y = AVATAR_Y;/.test(leaderSrc), 'avatarMask.x/y использует AVATAR_X/AVATAR_Y');
    assert(/avatar\.x = AVATAR_X; avatar\.y = AVATAR_Y;/.test(leaderSrc), 'avatar.x/y использует AVATAR_X/AVATAR_Y (маска и аватарка синхронизированы)');
}

console.log('\nTest 5: svod-leaderboard.js — колонка "Уровень": точная позиция (434,11) и белый цвет');
{
    // 19.09.2026: levelTxt теперь центрируется по горизонтали в собственном блоке
    // «блок под уровень.png» (см. svod-leaderboard-anchor-center-level-col.test.js), поэтому
    // x — не константа 434, а centerX(CELL_BLOCKS.level); проверяем цвет/anchor/y отдельно.
    assert(/fill:'#ffffff'\s*\}\);\s*\n\s*levelTxt\.anchor\.set\(0\.5, 0\);\s*\n\s*levelTxt\.x = centerX\(CELL_BLOCKS\.level\); levelTxt\.y = 11;/.test(leaderSrc),
        'levelTxt — белый цвет (#ffffff), центрирован в блоке «уровень» (anchor 0.5), y=11');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

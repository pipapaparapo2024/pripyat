/**
 * Test: батч 17.10.2026 — репорт + скриншот: "зашёл к игроку в гости, нажал на вкладку Зоны —
 * открылось визиткой гостя, а не Зоной. Такого быть не должно — при открытии любой другой
 * доступной вкладки визитка гостя должна закрываться."
 *
 * Корень: визитка чужого игрока (player_profile.js, proto._buildPlayerProfileScreen) — отдельный
 * полноэкранный оверлей (root.layer2_mc), который никогда не участвовал в общем закрытии вкладок
 * (interface-panels.js._closeAllPanels — единая точка, которую вызывает КАЖДЫЙ обработчик клика
 * по нижней панели ПЕРВОЙ строкой перед открытием своего экрана: Зона/Сидорович/Ящик/Хабар/
 * Шмотки/Сводка уже там есть). Визитку закрывал только её собственный крестик
 * (_closePlayerProfile). Её полноэкранный blocker (alpha 0.001, но interactive=true) продолжал
 * перехватывать клики поверх уже открывшегося под ним целевого экрана — игрок видел всё ту же
 * визитку, хотя формально Зона уже открылась ниже по Z.
 *
 * Второй репорт в том же скриншоте: сверху слева дублировался ник жёлтым шрифтом (отдельная
 * подпись nameTxt поверх всего экрана), хотя сама визитка и так показывает тот же ник внутри
 * карточки (белым). Убрана отдельная подпись целиком.
 *
 * Run: node tests/player-profile-close-on-tab-switch-and-duplicate-nick-removed.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const panelsSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-panels.js'), 'utf-8');
const profileSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf-8');

console.log('\nTest 1: _closeAllPanels закрывает визитку игрока, если она открыта');
{
    const start = panelsSrc.indexOf('proto._closeAllPanels = function(){');
    const end   = panelsSrc.indexOf('if(this._zoneWin && this._zoneWin.visible){', start);
    const block = panelsSrc.slice(start, end);
    assert(/if\(this\._profileWin && this\._profileWin\.parent\) this\._closePlayerProfile\(\);/.test(block),
        '_closeAllPanels проверяет this._profileWin.parent и вызывает this._closePlayerProfile()');
    // Проверка порядка: закрытие визитки должно идти ДО остальных веток (Зона и т.д.), чтобы её
    // блокер гарантированно убирался раньше, чем целевой экран начнёт открываться поверх/под ним.
    const profileIdx = panelsSrc.indexOf('this._closePlayerProfile();');
    const zoneIdx    = panelsSrc.indexOf('if(this._zoneWin && this._zoneWin.visible){');
    assert(profileIdx !== -1 && zoneIdx !== -1 && profileIdx < zoneIdx, 'закрытие визитки стоит раньше закрытия Зоны в _closeAllPanels');
}

console.log('\nTest 2: отдельная жёлтая подпись-заголовок с ником (дубликат) удалена из экрана визитки');
{
    // Область поиска — только proto._buildPlayerProfileScreen (где раньше жил nameTxt): есть
    // ДРУГОЙ, не связанный nameTxt внутри _buildHabarBadge (значок хабара) — не трогаем его.
    const fnStart = profileSrc.indexOf('proto._buildPlayerProfileScreen = function(profile, fallbackNick){');
    const fnEnd   = profileSrc.indexOf('\n    // Визитка игрока', fnStart);
    const fnBody  = profileSrc.slice(fnStart, fnEnd === -1 ? profileSrc.length : fnEnd);
    assert(!/fontFamily: 'Southbank LT', fontSize: 26, fill: '#ffcc44', fontWeight: 'bold',/.test(fnBody),
        'блок создания nameTxt (жёлтый, 26px) удалён из _buildPlayerProfileScreen');
    assert(!/\bnameTxt\b/.test(fnBody), 'переменная nameTxt больше не встречается в _buildPlayerProfileScreen вообще');
}

console.log('\nTest 3: _setDisplayNick сохранён (используется карточкой), но больше не трогает удалённый nameTxt');
{
    const start = profileSrc.indexOf('profile._setDisplayNick = (resolvedNick) => {');
    const end   = profileSrc.indexOf('\n        };', start);
    const body  = profileSrc.slice(start, end);
    assert(start !== -1, '_setDisplayNick всё ещё определена (используется _buildVisitCard при резолве VK-имени)');
    assert(/profile\.displayNick = String\(resolvedNick\)\.trim\(\);/.test(body), '_setDisplayNick по-прежнему обновляет profile.displayNick');
    assert(!/nameTxt\.text/.test(body), '_setDisplayNick больше не пишет в удалённый nameTxt.text');
}

console.log('\nTest 4: ник внутри самой визитки (nickTxt, белым) не тронут — он и есть единственное отображение ника теперь');
{
    assert(/nickTxt = new PIXI\.Text\(profile\.displayNick \|\| \('Игрок ' \+ profile\.id\), \{\r?\n\s*fontFamily: 'Southbank LT', fontSize: 22, fill: '#ffffff', fontWeight: 'bold',/.test(profileSrc),
        'nickTxt визитки (белым, внутри карточки) остался без изменений');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

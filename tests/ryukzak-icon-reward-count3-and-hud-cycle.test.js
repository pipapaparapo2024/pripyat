/**
 * Test: батч 16.09.2026 —
 *  1) bosses_prefight.js — новая иконка "очки рюкзака.png" в блоке ВОЗМОЖНАЯ НАГРАДА,
 *     показывает RYUKZAK_PTS[bossIdx] (та же таблица, что в bosses-combat.js._onDefeat).
 *  2) reward.js — попап "если 3 награды" переставлен на новые координаты/размер,
 *     снятые пользователем через редактор позиций.
 *  3) ryukzak.js — полный симметричный цикл скрытия/восстановления HUD (открытие →
 *     скрыть, НАЗАД → показать) по тому же паттерну, что yashik.js — раньше HUD не
 *     прятался при открытии вообще, поэтому "спрятать после ошибки" не имело парного
 *     "вернуть обратно", и HUD иногда терялся насовсем.
 *
 * Run: node tests/ryukzak-icon-reward-count3-and-hud-cycle.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const prefightSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_prefight.js'), 'utf-8');
const rewardSrc   = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'reward.js'), 'utf-8');
const ryukSrc     = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');
const iconPath    = path.join(__dirname, '..', '_client', 'development', 'images', 'очки рюкзака.png');

console.log('\nTest 1: картинка "очки рюкзака.png" скопирована в development/images');
{
    assert(fs.existsSync(iconPath), 'файл существует локально');
    if(fs.existsSync(iconPath)) assert(fs.statSync(iconPath).size > 0, 'файл не пустой');
}

console.log('\nTest 2: bosses_prefight.js — иконка очков рюкзака добавлена в rewardItems');
{
    assert(/const RYUKZAK_PTS = \[5, 10, 20, 35, 60, 90, 110, 150\];/.test(prefightSrc),
        'та же таблица очков, что в bosses-combat.js (0=Охотник..7=Жгут)');
    // Позже этого батча убран литеральный префикс '+' из тултипа (была двойная "+" визуально
    // рядом с уже плюсующимся значком) — суть (иконка + тултип с очками) не изменилась.
    assert(/\{ url: B\+'очки рюкзака\.png', pos: REWARD_RYUKZAK_POS, tip: \(\)=>\(RYUKZAK_PTS\[bossIdx\]\|\|0\)\+' очков рюкзака' \}/.test(prefightSrc),
        'новый reward-item с картинкой и тултипом добавлен');
    // 26.09.2026: ряд наград пересобран ещё раз — авто-центрирование формулой (ICONS_Y/SLOT_W/
    // ICONS_CX) заменено на точечные фиксированные позиции по каждой иконке (REWARD_*_POS),
    // снятые редактором позиций на новом фоне. Y всех трёх констант — 520/521 (тот же ряд).
    assert(/const REWARD_SIGI_POS    = \{ x: 617, y: 520, scale: 0\.800 \};/.test(prefightSrc), 'позиция иконки сигарет — y:520');
    assert(/const REWARD_RYUKZAK_POS = \{ x: 791, y: 521, scale: 0\.897 \};/.test(prefightSrc), 'позиция иконки рюкзака — y:521, как у остальных наград');
}

console.log('\nTest 3: reward.js — попап "если 3 награды" на новых координатах');
{
    const idx = rewardSrc.indexOf("} else if(items.length === 3){");
    assert(idx !== -1, 'спец-случай для count===3 найден');
    const body = rewardSrc.slice(idx, idx + 400);
    assert(/countArt\.x = 69; countArt\.y = -72;/.test(body), 'x=69 y=-72 (снято через редактор позиций)');
    assert(/countArt\.width = 354; countArt\.height = 180;/.test(body), 'width=354 height=180');
}

console.log('\nTest 4: ryukzak.js — экран награды наследует HUD-политику Рюкзака (декларативный стек, 24.09.2026), НАЗАД выходит из неё через popHud');
{
    // _openRyukzakReward — часть того же потока "Рюкзак открыт", что и главный экран: она НЕ
    // должна повторно регистрировать 'ryukzak' в стеке (уже зарегистрирован там, где Рюкзак
    // был впервые открыт) — см. declarative-hud-refactor.test.js для самой регистрации.
    const openStart = ryukSrc.indexOf('proto._openRyukzakReward = function(){');
    const openEnd   = ryukSrc.indexOf("nazadBtn.on('pointerdown'", openStart);
    const openBody  = ryukSrc.slice(openStart, openEnd);
    assert(!/this\.pushHud\(/.test(openBody), '_openRyukzakReward не регистрирует свою собственную HUD-политику — наследует уже активную от Рюкзака');

    const nazadIdx = ryukSrc.indexOf("nazadBtn.on('pointerdown'");
    assert(nazadIdx !== -1, 'nazadBtn найден');
    const nazadBody = ryukSrc.slice(nazadIdx, nazadIdx + 200);
    assert(/this\.popHud\('ryukzak'\);/.test(nazadBody),
        'NAZAD снимает регистрацию Рюкзака через popHud — HUD того, что было под ним, "проступает" сам');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

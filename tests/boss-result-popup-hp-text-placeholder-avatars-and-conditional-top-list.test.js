/**
 * Test: батч 22.09.2026 (попап "ТЫ ПОБЕДИЛ" boss_result.js, по прямому указанию пользователя
 * с референс-скриншотами) —
 *
 *  1) Красная полоска под портретом босса (вшита в сам файл портрета, например "боевка попап
 *     счастливчик.png") раньше оставалась пустой на победном экране — теперь на ней белым
 *     текстом пишется maxHp босса ("количество хп, которое было у босса"). Координата снята
 *     сканированием красных пикселей самого PNG-файла портрета (157×227): полоска занимает
 *     x:[28,147] y:[165,196], центр (87.5,180.5) → HP_BAR_OFFSET = {x:88,y:181}.
 *     Сопутствующий баг: bosses-combat.js._onDefeat передавал в опции попапа maxHp:0 (было не
 *     нужно, пока полоска не рисовалась) — теперь передаёт реальный this._maxHp(idx).
 *
 *  2) "ТОП УРОНА" (места 4-9): раньше КАЖДАЯ из 6 строк заполнялась либо реальным участником,
 *     либо прочерком "N. —" БЕЗУСЛОВНО — при 2 участниках боя весь список 4-9 всё равно "что-то"
 *     показывал (прочерки), из-за чего левый столбец (4-6) легко терялся на фоне декоративной
 *     рамки панели и выглядел как "не выводится". Теперь строка ранга N показывается только
 *     если участников боя реально было ≥N — иначе текст пустой и элемент невидим (visible=false).
 *
 *  3) "УЧАСТНИКИ БОЯ" (топ-3 фото): если реальных участников меньше 3 — пустые слоты 1-3
 *     заполняются одним из трёх новых портретов-заглушек (боевка попап участник 1/2/3.png),
 *     а не остаются пустой рамкой. Слот, заполненный заглушкой, НЕ получает подпись урона
 *     (это не настоящий участник).
 *
 *  4) Под каждым из топ-3 РЕАЛЬНЫХ аватаров — подпись урона (число + "УРОНА" на второй строке)
 *     цветом места: золото #F5B82E / серебро #C9C9C9 / бронза #C8753D.
 *
 * Run: node tests/boss-result-popup-hp-text-placeholder-avatars-and-conditional-top-list.test.js
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

const bossResultSrc = readSrc('_client/src/game/shell/popups/boss_result.js');
const combatSrc     = readSrc('_client/src/game/bosses/bosses-combat.js');

console.log('\nTest 1: новые файлы-заглушки участников скопированы в _client/development/images/ (без коллизии имён — namespaced)');
{
    const imgDir = path.join(root, '_client', 'development', 'images');
    const expected = [
        'боевка попап участник 1.png',
        'боевка попап участник 2.png',
        'боевка попап участник 3.png',
    ];
    for (const f of expected) {
        assert(fs.existsSync(path.join(imgDir, f)), `файл существует: ${f}`);
    }
}

console.log('\nTest 2: белый HP-текст на красной полоске портрета — только на победе (isWin), рассчитан по реальным пикселям PNG');
{
    // 22.09.2026 (повторный снимок редактора позиций тем же днём — "центрируй HP относительно
    // иконки с боссом"): x больше не хардкод от скана красной полоски — теперь формула
    // PORTRAIT_W/2 (центр портрета), y уточнён (было 181, стало 193). См.
    // skills-always-reset-progress-on-new-fight.test.js Test 4.
    assert(/const HP_BAR_OFFSET = \{ x: PORTRAIT_W \/ 2, y: 193 \};/.test(bossResultSrc),
        'HP_BAR_OFFSET.x — формула от PORTRAIT_W (центр портрета), y=193 снят редактором позиций');

    const elseIdx = bossResultSrc.indexOf('} else {', bossResultSrc.indexOf('if(!isWin){'));
    const elseEnd = bossResultSrc.indexOf('\n        }', elseIdx);
    const body = bossResultSrc.slice(elseIdx, elseEnd);
    assert(/fill:\s*'#ffffff'/.test(body), 'HP-текст на полоске — белый шрифт');
    assert(/hpBarTxt\.x = PORTRAIT_POS\.x \+ HP_BAR_OFFSET\.x;/.test(body), 'X считается от PORTRAIT_POS + HP_BAR_OFFSET');
    assert(/hpBarTxt\.y = PORTRAIT_POS\.y \+ HP_BAR_OFFSET\.y;/.test(body), 'Y считается от PORTRAIT_POS + HP_BAR_OFFSET');
    assert(/opts\.maxHp \|\| 0/.test(body), 'текст — это maxHp босса ("сколько HP у него было"), а не текущий/оставшийся HP');
}

console.log('\nTest 3: bosses-combat.js._onDefeat передаёт реальный maxHp (не захардкоженный 0) в попап победы');
{
    const defeatMatch = combatSrc.match(/proto\._onDefeat = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!defeatMatch, '_onDefeat найден');
    const body = defeatMatch ? defeatMatch[1] : '';
    assert(/maxHp:\s*this\._maxHp\(idx\),/.test(body), 'maxHp передаётся как this._maxHp(idx), больше не захардкожен в 0');
    assert(!/maxHp:\s*0,/.test(body), 'захардкоженного "maxHp: 0" в _onDefeat больше нет');
}

console.log('\nTest 4: "ТОП УРОНА" (места 4-9) — строка ранга N видна только если участников боя было ≥N');
{
    const applyMatch = bossResultSrc.match(/const _applyRatingTop = \(top\) => \{([\s\S]*?)\n        \};/);
    assert(!!applyMatch, '_applyRatingTop найден');
    const body = applyMatch ? applyMatch[1] : '';

    // 25.09.2026: базовое условие переехало на rankedLen (top.length, либо больше — если включён
    // dev-флаг тестового дозаполнения мест 4-9, см. tests/boss-result-top-list-dev-test-data.test.js)
    // — сама логика "строка рисуется только при достаточном числе участников" не изменилась.
    assert(/if\(rank <= rankedLen\)\{/.test(body), 'условие "rank <= rankedLen" — строка рисуется только при достаточном числе участников (реальных или dev-тестовых)');
    assert(/topListTxts\[i\]\.visible = true;/.test(body), 'видимая строка явно помечается visible=true');
    assert(/topListTxts\[i\]\.visible = false;/.test(body), 'недостающая строка явно скрывается (visible=false), а не просто пустой текст');
    assert(!/rank \+ '\. —'/.test(body), 'старый безусловный прочерк "N. —" для недостающих мест убран');
}

console.log('\nTest 5: "УЧАСТНИКИ БОЯ" — недостающие слоты (участников < 3) заполняются портретом-заглушкой, без подписи урона');
{
    assert(/const PLACEHOLDER_AVATARS = \[/.test(bossResultSrc), 'PLACEHOLDER_AVATARS определён');
    assert(/'боевка попап участник 1\.png'/.test(bossResultSrc), 'заглушка 1 в списке');
    assert(/'боевка попап участник 2\.png'/.test(bossResultSrc), 'заглушка 2 в списке');
    assert(/'боевка попап участник 3\.png'/.test(bossResultSrc), 'заглушка 3 в списке');

    const applyMatch = bossResultSrc.match(/const _applyRatingTop = \(top\) => \{([\s\S]*?)\n        \};/);
    const body = applyMatch ? applyMatch[1] : '';
    assert(/if\(i >= topThree\.length\)\{/.test(body), 'заглушка ставится ТОЛЬКО для слотов без реального участника (i >= topThree.length)');
    assert(/spr\.texture = PIXI\.Texture\.from\(BASE \+ PLACEHOLDER_AVATARS\[i\]\);/.test(body), 'текстура слота меняется на заглушку по индексу');
    // 02.10.2026: подпись урона считается через промежуточный shownDamage, а не напрямую
    // entry.damage.
    // 04.10.2026 (РЕВЕРС по прямому указанию — "в попапе должно быть 20, не 1000"): bonus Седого
    // убран из shownDamage целиком — см. tests/boss-result-popup-sedoy-damage-shown-separately.
    // test.js (Test 6) для полной проверки реверса. Для entry=undefined (нет участника) итог
    // тот же — shownDamage=0, t.text='' — смысл ЭТОЙ проверки (заглушки без подписи) не изменился.
    assert(/const shownDamage = entry \? Number\(entry\.damage \|\| 0\) : 0;/.test(body),
        'shownDamage = entry.damage напрямую (без bonus Седого), 0 если участника нет');
    assert(/t\.text = entry \? \(_fmtDmg\(shownDamage\) \+ '\\nУРОНА'\) : '';/.test(body),
        'подпись урона пустая для слота без реального участника (entry undefined → t.text = "")');
}

console.log('\nTest 6: подпись урона под топ-3 — число + "УРОНА" на отдельной строке, цвет по месту (золото/серебро/бронза)');
{
    assert(/const RANK_COLORS = \['#F5B82E', '#C9C9C9', '#C8753D'\];/.test(bossResultSrc),
        'цвета мест: 1=золото #F5B82E, 2=серебро #C9C9C9, 3=бронза #C8753D');

    const dmgTxtMatch = bossResultSrc.match(/const avatarDmgTxts = AVATAR_SLOTS\.map\(\(slot, i\) => \{([\s\S]*?)\n        \}\);/);
    assert(!!dmgTxtMatch, 'avatarDmgTxts определён (по одному текстовому объекту на слот)');
    const body = dmgTxtMatch ? dmgTxtMatch[1] : '';
    assert(/fill:\s*RANK_COLORS\[i\]/.test(body), 'цвет подписи урона берётся из RANK_COLORS по индексу слота (закреплён за местом, не за игроком)');
    // 22.09.2026 (повторный снимок редактора позиций тем же днём): позиция подписи больше не
    // считается от AVATAR_SIZE/2+6 (индивидуально по слоту) — теперь единый AVATAR_DMG_Y для
    // всех трёх, см. skills-always-reset-progress-on-new-fight.test.js Test 3.
    assert(/t\.x = slot\.x; t\.y = AVATAR_DMG_Y;/.test(body), 'подпись позиционируется ПОД аватаром (по центру X своего слота, общий Y=AVATAR_DMG_Y)');

    assert(/avatarDmgTxts\.forEach\(\(t, i\) => \{/.test(bossResultSrc),
        'avatarDmgTxts заполняется по каждому реальному топ-3 участнику отдельно');
    // 02.10.2026: формат подписи тот же ("число\nУРОНА"), но число теперь берётся из shownDamage
    // (entry.damage + bonus Седого для своей записи), не напрямую из entry.damage — см. комментарий
    // у Test 5 выше.
    assert(/entry \? \(_fmtDmg\(shownDamage\) \+ '\\nУРОНА'\) : '';/.test(bossResultSrc),
        'формат подписи — "УРОН\\nУРОНА" (число сверху, слово "УРОНА" отдельным блоком снизу)');
}

console.log('\nTest 7: AVATAR_W/AVATAR_H обновлены (22.09.2026, повторный снимок редактора позиций тем же днём — было единый AVATAR_SIZE=67 квадрат, стало 67×71 прямоугольник)');
{
    assert(/const AVATAR_W = 67;/.test(bossResultSrc), 'AVATAR_W = 67');
    assert(/const AVATAR_H = 71;/.test(bossResultSrc), 'AVATAR_H = 71 (было 67 — единый AVATAR_SIZE заменён раздельными W/H)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 20.09.2026 (по прямому указанию) — на экране боя с боссом добавлены 2 присланных
 * пользователем декоративных фона под текст очков скиллов: «табличка под очки.png» (76×39,
 * под ОЧКИ — уже вложенные/потраченные очки, skills.spentPoints) и «круг под новые очки.png»
 * (40×40, под НОВЫЕ — доступные, ещё не вложенные, skills.availablePoints). Та же идея, что
 * подложки ячеек топа (CELL_BLOCKS в svod-leaderboard.js) — координаты сняты пользователем из
 * редактора позиций/PSD, текст центрируется относительно ЦЕНТРА подложки (anchor 0.5/0.5), а не
 * позиционируется вручную по числу цифр (старый костыль NEW_PTS_X_BY_DIGITS убран как лишний).
 *
 * Run: node tests/boss-fight-points-badges-centered-text.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const fightSrc = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/bosses_fight.js'), 'utf-8');
const imgDir = path.join(root, '_client/development/images');

console.log('\nTest 1: оба файла подложек реально скопированы в images/ (корень, не в подпапку)');
{
    assert(fs.existsSync(path.join(imgDir, 'табличка под очки.png')), 'табличка под очки.png существует в images/');
    assert(fs.existsSync(path.join(imgDir, 'круг под новые очки.png')), 'круг под новые очки.png существует в images/ (пробел в конце имени убран)');
}

console.log('\nTest 2: подложки созданы с координатами пользователя (X:1041,Y:618 и X:1199,Y:618) и реальными размерами PNG (76×39, 40×40)');
{
    assert(/const PTS_BG = \{ x: 1041, y: 618, w: 76, h: 39 \};/.test(fightSrc), 'PTS_BG — координаты и размер табличка под очки.png сняты корректно');
    assert(/const NEW_BG = \{ x: 1199, y: 618, w: 40, h: 40 \};/.test(fightSrc), 'NEW_BG — координаты и размер круг под новые очки.png сняты корректно');
    assert(/new PIXI\.Sprite\(PIXI\.Texture\.from\(B \+ 'табличка под очки\.png'\)\)/.test(fightSrc), 'спрайт табличка под очки.png создан');
    assert(/new PIXI\.Sprite\(PIXI\.Texture\.from\(B \+ 'круг под новые очки\.png'\)\)/.test(fightSrc), 'спрайт круг под новые очки.png создан');
}

console.log('\nTest 3: подложки добавлены в win РАНЬШЕ соответствующего текста (рисуются под текстом, не поверх)');
{
    const ptsBgPos  = fightSrc.indexOf("PIXI.Texture.from(B + 'табличка под очки.png')");
    const ptsTxtPos = fightSrc.indexOf('this._bossFightPtsTxt = ptsTxt;');
    const newBgPos  = fightSrc.indexOf("PIXI.Texture.from(B + 'круг под новые очки.png')");
    const newTxtPos = fightSrc.indexOf('this._bossFightNewTxt = newTxt;');
    assert(ptsBgPos > 0 && ptsBgPos < ptsTxtPos, 'ptsBg создан и добавлен в win до ptsTxt');
    assert(newBgPos > 0 && newBgPos < newTxtPos, 'newBg создан и добавлен в win до newTxt');
}

console.log('\nTest 4: оба текста (ОЧКИ / НОВЫЕ) центрируются anchor(0.5,0.5) относительно ЦЕНТРА своей подложки');
{
    const start = fightSrc.indexOf('const PTS_BG = {');
    const end   = fightSrc.indexOf('this._bossFightNewTxt = newTxt;');
    const body  = fightSrc.slice(start, end);

    // 03.10.2026 (по прямому указанию — "кол-во новых очков и прокачанных опусти вниз на 1px,
    // сдвинь вправо на 1px, уменьши жирность"): +1/+1 к центру подложки, fontWeight bold → normal.
    // 04.10.2026 (редактор позиций, повторная правка): центрирование относительно подложки
    // заменено на явные абсолютные координаты + scale — PTS_BG/NEW_BG остаются только размером
    // самих подложек (не участвуют в позиционировании текста).
    assert(/ptsTxt\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'ptsTxt имеет anchor(0.5,0.5)');
    assert(/ptsTxt\.x = 1080; ptsTxt\.y = 639; ptsTxt\.scale\.set\(1\.521\);/.test(body),
        'ptsTxt позиционируется по явным координатам редактора позиций (x:1080 y:639 scale:1.521)');

    assert(/newTxt\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'newTxt имеет anchor(0.5,0.5)');
    assert(/newTxt\.x = 1220; newTxt\.y = 639; newTxt\.scale\.set\(1\.521\);/.test(body),
        'newTxt позиционируется по явным координатам редактора позиций (x:1220 y:639 scale:1.521)');

    assert(/fontFamily:'Southbank LT', fontSize:18, fill:'#ffffff', fontWeight:'normal',\s*\n\s*\}\);\s*\n\s*ptsTxt\.anchor/.test(fightSrc),
        'ptsTxt fontWeight normal (было bold)');
    assert(/fontFamily:'Southbank LT', fontSize:18, fill:'#ffffff', fontWeight:'normal',\s*\n\s*\}\);\s*\n\s*newTxt\.anchor/.test(fightSrc),
        'newTxt fontWeight normal (было bold)');
}

console.log('\nTest 5: старый костыль ручного сдвига X по числу цифр (NEW_PTS_X_BY_DIGITS) убран — центрирование через anchor делает его лишним');
{
    assert(!/NEW_PTS_X_BY_DIGITS/.test(fightSrc), 'NEW_PTS_X_BY_DIGITS полностью удалён из файла');
    const statsFnStart = fightSrc.indexOf('proto._updateBossFightStats = function');
    const statsFnEnd   = fightSrc.indexOf('\n    };', statsFnStart);
    const statsBody    = fightSrc.slice(statsFnStart, statsFnEnd);
    assert(!/\.x = .*digits/.test(statsBody), '_updateBossFightStats больше не пересчитывает x текста по числу цифр');
    assert(/this\._bossFightPtsTxt\.text = window\.skills \? String\(skills\.spentPoints \|\| 0\) : '—';/.test(statsBody),
        'ОЧКИ по-прежнему берутся из skills.spentPoints (вложенные/потраченные)');
    assert(/this\._bossFightNewTxt\.text = window\.skills \? String\(skills\.availablePoints \|\| 0\) : '—';/.test(statsBody),
        'НОВЫЕ по-прежнему берутся из skills.availablePoints (доступные, не вложенные)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

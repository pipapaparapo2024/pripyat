/**
 * Test: батч 25.09.2026 (по прямому указанию):
 *
 *  1) Кнопка "СКИЛЛЫ" в бою с боссом — файл "боевка таланты.png" заменён на новый "скиллы.png",
 *     позиция и обработчик клика не менялись (1044,530 → iface._openBossesSkillsScreen()).
 *
 *  2) Джекпот-приз "Сорванный джекпот" — попап для исхода Куш (res.kush) в мини-игре
 *     "9 стаканчиков" — заменяет инлайн-текст "🔥 КУШ!" на полноэкранный попап (фон/попап/
 *     кнопка ЗАБРАТЬ, кнопка переиспользует уже существующий файл "стаканчики кнопка
 *     забрать.png"). Награда (KUSH_AMOUNT) уже применена через applyPatch() до открытия попапа
 *     — кнопка ЗАБРАТЬ только закрывает экран.
 *
 * Run: node tests/skills-icon-swap-and-jackpot-prize-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) bosses_fight.js — кнопка СКИЛЛЫ использует новый файл, позиция/обработчик не менялись');
{
    const src = read('_client/src/game/shell/overlays/bosses_fight.js');
    assert(!/PIXI\.Texture\.from\(B \+ 'боевка таланты\.png'\)/.test(src), 'старый файл больше не используется для кнопки');
    assert(/PIXI\.Texture\.from\(B \+ 'скиллы\.png'\)/.test(src), 'кнопка использует новый файл скиллы.png');
    const idx = src.indexOf("PIXI.Texture.from(B + 'скиллы.png')");
    // 29.09.2026: окно расширено 400→600 симв. — hover-scale батч (по прямому указанию,
    // "для всех кнопок небольшой hover эффект увеличения scale") добавил scale.set() в
    // pointerover/pointerout talentBtn, сдвинув pointerdown-обработчик за старую границу окна.
    const chunk = src.slice(idx, idx + 600);
    assert(/talentBtn\.x = 1044; talentBtn\.y = 530;/.test(chunk), 'позиция не изменилась (1044,530)');
    assert(/iface\._openBossesSkillsScreen\(\)/.test(chunk), 'обработчик клика не изменился');
}

console.log('\n2) game-boot.js — прелоад обновлён на новый файл');
{
    const src = read('_client/src/game/game-boot.js');
    assert(!/'боевка таланты\.png'/.test(src), 'старое имя убрано из прелоада');
    assert(/'скиллы\.png'/.test(src), 'новый файл добавлен в прелоад');
    assert(/'боевка таланты кнопка прокачать\.png'/.test(src), 'соседний (другой) файл кнопки прокачки не задет');
}

console.log('\n3) dvor-roulette-minigame.js — попап "Сорванный джекпот" для исхода Куш');
{
    const src = read('_client/src/game/dvor/dvor-roulette-minigame.js');
    assert(/if\(res\.kush\)\{/.test(src) && /this\._openJackpotPrize\(win, res\.amt\);/.test(src),
        'pickCup-колбэк вызывает новый попап именно по флагу kush');
    assert(/proto\._openJackpotPrize = function\(cupsWin, amount\)\{/.test(src), 'метод _openJackpotPrize определён');
    assert(/'\.\/images\/стаканчики задний фон джекпот приз\.png'/.test(src), 'фон — новый файл');
    assert(/bg\.x = 0; bg\.y = 34;/.test(src), 'позиция фона снята редактором позиций (картинка 5)');
    assert(/'\.\/images\/стаканчики попап джекпот приз\.png'/.test(src), 'попап — новый файл');
    assert(/panel\.x = 96; panel\.y = 31;/.test(src), 'позиция попапа снята редактором позиций (картинка 4)');
    assert(/takeBtn\.x = 540; takeBtn\.y = 464;/.test(src), 'позиция кнопки снята редактором позиций (картинка 6)');
    // Кнопка переиспользует УЖЕ существующий файл — новый файл под неё не присылали.
    const jpStart = src.indexOf('proto._openJackpotPrize = function(cupsWin, amount){');
    const jpChunk = src.slice(jpStart, jpStart + 1800);
    assert(/'\.\/images\/стаканчики кнопка забрать\.png'/.test(jpChunk), 'кнопка ЗАБРАТЬ переиспользует существующий файл (новый не присылали)');
}

console.log('\n4) Новые файлы скопированы в _client/development/images/');
{
    const files = [
        'скиллы.png',
        'стаканчики задний фон джекпот приз.png',
        'стаканчики попап джекпот приз.png',
    ];
    files.forEach(f => {
        assert(fs.existsSync(path.join(root, '_client', 'development', 'images', f)), `файл существует: ${f}`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч правок 27.10.2026 по живым репортам с тестового сервера (после первого показа
 * фичей «Заначки»/2048 пользователю):
 *  - svod.js: Сводка больше не открывается сразу на «Заначки» (дефолт вернулся на 'respect').
 *  - svod-zanachki.js: свой выход экрана, репозиция фона/кнопки друзей/viewport-блока/рядов,
 *    репозиция блока награды (звезда/иконка сухарей/разделённый текст), hover-скейл «Запросить».
 *  - svod-zanachki-wishlist.js: новая позиция выхода попапа + заголовок (бывший «Слой 345.png»).
 *  - zanachki.php/zanachkimodel.php: dev-метод devGrantAll (+100 к каждой из 105 карточек).
 *  - dvor.js: «2048 ящик.png» перестал быть интерактивным (рабочей осталась только подпись).
 *  - game2048.js: плитки — единый масштаб (не ломает пропорции), сдвиг надписей +20x/+23y,
 *    hover-скейл на играть/завершить/топ/информация.
 *  - game2048-top-popup.js: координаты лайфтайм-наград (один ряд из 5, не 2 ряда из 6).
 *  - dvor-dice-screen.js: новый фон экрана «Зарик».
 *
 * Run: node tests/oct27-zanachki-2048-dice-live-fixes.test.js
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

const svodSrc          = readSrc('_client/src/game/svod.js');
const zanachkiSrc       = readSrc('_client/src/game/svod/svod-zanachki.js');
const wishlistSrc       = readSrc('_client/src/game/svod/svod-zanachki-wishlist.js');
const zanachkiCtrlSrc   = readSrc('server/core/controllers/zanachki.php');
const zanachkiModelSrc  = readSrc('server/core/models/zanachkimodel.php');
const dvorSrc           = readSrc('_client/src/game/dvor.js');
const game2048Src       = readSrc('_client/src/game/game2048.js');
const topPopupSrc       = readSrc('_client/src/game/game2048/game2048-top-popup.js');
const diceScreenSrc     = readSrc('_client/src/game/dvor/dvor-dice-screen.js');
const devPanelSrc       = readSrc('_client/src/game/shell/overlays/dev_panel.js');
const gameBootSrc       = readSrc('_client/src/game/game-boot.js');
const game2048PhpSrc    = readSrc('server/core/controllers/game2048.php');

console.log('\nTest 1: svod.js — Сводка больше не открывается сразу на «Заначки»');
{
    const start = svodSrc.indexOf('open(){');
    const body  = svodSrc.slice(start, svodSrc.indexOf('\n    close(){', start));
    assert(/this\._selectMainTab\('respect'\);/.test(body), 'дефолтная вкладка — \'respect\' (как до появления Заначки)');
    assert(!/this\._selectMainTab\('zanachki'\);/.test(body), 'больше НЕ открывается сама на \'zanachki\'');
}

console.log('\nTest 2: svod-zanachki.js — свой выход экрана + репозиция фона/кнопки друзей');
{
    assert(/const EXIT_X = 1170, EXIT_Y = 113, EXIT_SCALE = 0\.79;/.test(zanachkiSrc), 'координаты своего выхода (1170,113,scale 0.79)');
    assert(/zanachkiExitBtn\.on\('pointerdown', \(\)=>this\.close\(\)\);/.test(zanachkiSrc), 'свой выход закрывает весь Свод (this.close())');
    assert(/const BG_X = 39, BG_Y = 92;/.test(zanachkiSrc), 'фон экрана переставлен на x:39,y:92');
    assert(/const FRIEND_REQ_X = 695, FRIEND_REQ_Y = 108;/.test(zanachkiSrc), 'кнопка запроса у друзей — y:108 (было 106)');
    assert(/const VIEW_X = 53, VIEW_W = 1127, VIEW_H = 377;/.test(zanachkiSrc), 'viewport-блок списка — x:53,y:184(VIEW_Y),w:1127,h:377');
    assert(/const ROW_H = 125;/.test(zanachkiSrc), 'шаг между рядами коллекций увеличен на 10px (115→125)');
}

console.log('\nTest 3: svod-zanachki.js — компенсация VIEW_X в X-константах ряда (иначе клип справа маской скролла)');
{
    // Критично: mask-прямоугольник в _buildSvodScroll клиппит И по ширине (drawRect(0,0,viewW,viewH)),
    // а contentContainer.x обязан равняться VIEW_X — если X-константы ряда (ROW_X/CARD_X0/REQ_X0/
    // CLAIM_X/STAR_X) не уменьшить на тот же VIEW_X, правый край каждого ряда (фон 1096px) вылезал
    // бы за маску на (VIEW_X) пикселей и обрезался.
    assert(/const ROW_X = 77 - VIEW_X;/.test(zanachkiSrc), 'ROW_X компенсирован (77 - VIEW_X)');
    assert(/const CARD_X0 = 145 - VIEW_X, CARD_PITCH = 112;/.test(zanachkiSrc), 'CARD_X0 компенсирован (145 - VIEW_X)');
    assert(/const REQ_X0 = 132 - VIEW_X, REQ_Y_OFF = 288 - VIEW_Y;/.test(zanachkiSrc), 'REQ_X0 компенсирован (132 - VIEW_X)');
    assert(/const CLAIM_X = 987 - VIEW_X, CLAIM_Y_OFF = 273 - VIEW_Y;/.test(zanachkiSrc), 'CLAIM_X компенсирован (987 - VIEW_X)');
    assert(/const STAR_X = 1000 - VIEW_X, STAR_Y_OFF = 248 - VIEW_Y;/.test(zanachkiSrc), 'STAR_X компенсирован (1000 - VIEW_X)');
}

console.log('\nTest 4: svod-zanachki.js — репозиция блока награды (звезда/иконка сухарей/разделённый текст)');
{
    assert(/starIcon\.x = STAR_X; starIcon\.y = rowY \+ STAR_Y_OFF - 3;/.test(zanachkiSrc), 'звезда поднята на 3px');
    assert(/rewardLabelTxt\.x = STAR_X; rewardLabelTxt\.y = rowY \+ STAR_Y_OFF - 50;/.test(zanachkiSrc), '«Награда:» поднята ещё на 30px (итого -50 от базовой точки)');
    assert(/const sukhariIcon = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'боевка награда сухари\.png'\)\);/.test(zanachkiSrc), 'новая иконка "боевка награда сухари.png" добавлена');
    assert(/sukhariIcon\.width = SUKHARI_ICON_W; sukhariIcon\.height = SUKHARI_ICON_H;/.test(zanachkiSrc), 'иконка сухарей — заданная ширина/пропорциональная высота');
    assert(/const SUKHARI_ICON_W = 25, SUKHARI_ICON_H = Math\.round\(SUKHARI_ICON_W \* 77 \/ 68\);/.test(zanachkiSrc), 'ширина 25px, высота пропорциональна исходнику (68×77)');
    assert(/const sukhariRewardTxt = new PIXI\.Text\('\+50 сухарей', \{/.test(zanachkiSrc), '"+50 сухарей" — отдельный текст');
    assert(/const expRewardTxt = new PIXI\.Text\('\+50 опыта', \{/.test(zanachkiSrc), '"+50 опыта" — отдельный текст');
    assert(/expRewardTxt\.x = STAR_X \+ starIcon\.width \+ 6; expRewardTxt\.y = starIcon\.y;/.test(zanachkiSrc), '"+50 опыта" стоит правее файла звезды');
    assert(/sukhariRewardTxt\.x = STAR_X \+ 30; sukhariRewardTxt\.y = rowY \+ STAR_Y_OFF \+ 2 - 20;/.test(zanachkiSrc), '"+50 сухарей" поднята на 20px');
}

console.log('\nTest 5: svod-zanachki.js — hover-скейл на кнопке «Запросить», сброс при смене текстуры');
{
    assert(/reqSpr\.on\('pointerover', \(\)=>\{ if\(reqSpr\.interactive\) reqSpr\.scale\.set\(1\.08\); \}\);/.test(zanachkiSrc), 'hover увеличивает масштаб кнопки запроса');
    assert(/reqSpr\.on\('pointerout',  \(\)=>\{ reqSpr\.scale\.set\(1\); \}\);/.test(zanachkiSrc), 'уход курсора возвращает масштаб');
    assert(/spr\.scale\.set\(1\); \/\/ сброс hover-скейла/.test(zanachkiSrc), '_zanachkiApplyWishlistTextures() сбрасывает скейл при смене текстуры (pointerout мог не сработать)');
}

console.log('\nTest 6: svod-zanachki-wishlist.js — новая позиция выхода + заголовок попапа');
{
    assert(/const WISHLIST_EXIT_X = 1029, WISHLIST_EXIT_Y = 154, WISHLIST_EXIT_SCALE = 0\.839;/.test(wishlistSrc), 'координаты выхода попапа (1029,154,scale 0.839)');
    assert(/exitBtn\.scale\.set\(WISHLIST_EXIT_SCALE\);/.test(wishlistSrc), 'выход попапа использует новый масштаб');
    assert(/exitBtn\.x = WISHLIST_EXIT_X; exitBtn\.y = WISHLIST_EXIT_Y;/.test(wishlistSrc), 'выход попапа использует новые координаты');
    // 27.10.2026 (по прямому указанию, тем же днём): один общий заголовок заменён ДВУМЯ —
    // "твой запрос" (mode:'own') / "запрос друга" (mode:'friend'), абсолютная позиция x:455,
    // y:193 (редактор позиций) вместо вычисляемого центра над попапом.
    assert(/const titleSpr = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ \(mode === 'friend' \? TITLE_FRIEND_IMG : TITLE_OWN_IMG\)\)\);/.test(wishlistSrc),
        'заголовок попапа выбирается по режиму (own/friend)');
    assert(/const TITLE_X = 455, TITLE_Y = 193;/.test(wishlistSrc),
        'заголовок — абсолютная позиция редактора позиций (не вычисляемый центр)');
}

console.log('\nTest 7: zanachki.php/zanachkimodel.php — dev-метод devGrantAll (+100 к каждой из 105 карточек)');
{
    assert(/'getFriendWishlist', 'giveCard', 'devGrantAll'\];/.test(zanachkiCtrlSrc), 'devGrantAll добавлен в permits');
    assert(/function devGrantAll\(\)\{/.test(zanachkiCtrlSrc), 'devGrantAll() определён в контроллере');
    const start = zanachkiCtrlSrc.indexOf('function devGrantAll(){');
    const body = zanachkiCtrlSrc.slice(start, zanachkiCtrlSrc.indexOf('\n        }\n', start));
    assert(/ZanachkiModel::grantAllCollections\(\$this->ops, \$user, 100\);/.test(body), 'контроллер зовёт grantAllCollections(...,100)');

    assert(/static function grantAllCollections\(\$ops, &\$user, \$amountEach\)\{/.test(zanachkiModelSrc), 'grantAllCollections() определена в модели');
    const mStart = zanachkiModelSrc.indexOf('static function grantAllCollections($ops, &$user, $amountEach){');
    const mBody = zanachkiModelSrc.slice(mStart, zanachkiModelSrc.indexOf('\n    }', mStart));
    assert(/\$data\[\$colKey\]\[\$posKey\] = intval\(\$data\[\$colKey\]\[\$posKey\]\) \+ \$amountEach;/.test(mBody),
        'добавляет (не перезаписывает) amountEach к каждой из 15×7 позиций');
    assert(!/stash_count/.test(mBody), 'не трогает stash_count (та же защита от задвоения, что у grantRandomCards)');

    const panelSrc = readSrc('_client/src/game/shell/overlays/dev_panel.js');
    assert(/TS\.php\('zanachki\.devGrantAll', \{\}, \(e\)=>\{/.test(panelSrc), 'dev-панель вызывает zanachki.devGrantAll');
    assert(/label:'\+100 КАЖДОЙ'/.test(panelSrc), 'кнопка "+100 КАЖДОЙ" присутствует в секции ЗАНАЧКИ');
}

console.log('\nTest 8: dvor.js — «2048 ящик.png» перестал быть интерактивным, «нажать на игру» остался рабочим');
{
    const start = dvorSrc.indexOf("if(!this._game2048YashikSpr){");
    const end   = dvorSrc.indexOf('w.addChild(this._game2048YashikSpr);', start);
    const yashikBlock = dvorSrc.slice(start, end);
    assert(!/interactive = true/.test(yashikBlock), 'ящик больше не interactive');
    assert(!/buttonMode = true/.test(yashikBlock), 'ящик больше не buttonMode');
    assert(!/pointerdown/.test(yashikBlock), 'у ящика больше нет обработчика клика');
    assert(!/pointerover/.test(yashikBlock), 'у ящика больше нет hover-эффекта');

    const pressStart = dvorSrc.indexOf("if(!this._game2048PressSpr){");
    const pressEnd   = dvorSrc.indexOf('w.addChild(this._game2048PressSpr);', pressStart);
    const pressBlock = dvorSrc.slice(pressStart, pressEnd);
    assert(/interactive = true; spr\.buttonMode = true;/.test(pressBlock), '"нажать на игру" остался интерактивным');
    assert(/spr\.on\('pointerdown', \(\)=>\{ if\(window\.game2048\) game2048\.open\(\); \}\);/.test(pressBlock), '"нажать на игру" по-прежнему открывает игру');
}

console.log('\nTest 9: game2048.js — плитки масштабируются единым коэффициентом (не ломают пропорции)');
{
    assert(!/cont\._spr\.width = Math\.min\(cont\._spr\.width \|\| 48,/.test(game2048Src), 'старый баг (меняли ТОЛЬКО .width, не .height) убран');
    assert(/const scale = Math\.min\(1, cellSize \/ tex\.width, cellSize \/ tex\.height\);/.test(game2048Src), 'единый масштаб считается от обоих измерений текстуры');
    assert(/cont\._spr\.scale\.set\(scale\);/.test(game2048Src), 'масштаб применяется через .scale.set() (сохраняет пропорции)');
}

console.log('\nTest 10: game2048.js — динамические надписи сдвинуты +20x/+23y (26.10) + точечные докрутки 27.10');
{
    // 27.10.2026 (по прямому указанию, тем же днём — точечные докрутки поверх общего +20x/+23y):
    // рубли +24, стволы +20, автоматы +14, сухари +10, опыт +4 (все доп. вправо), фрагмент без
    // доп. сдвига; Y всех шести — на 1px вверх (REWARD_ROW_Y - 1).
    assert(/const REWARD_ROW_Y = 380 \+ 23 - 1;/.test(game2048Src), 'REWARD_ROW_Y сдвинут на +23, затем ещё -1 (вверх)');
    assert(/coins: 690 \+ 20 \+ 24, gun: 748 \+ 20 \+ 20, auto: 806 \+ 20 \+ 14,/.test(game2048Src),
        'REWARD_ROW_X: рубли/стволы/автоматы с индивидуальными докрутками поверх общего +20');
    assert(/cig: 864 \+ 20 \+ 10, exp: 922 \+ 20 \+ 4, fragment: 980 \+ 20,/.test(game2048Src),
        'REWARD_ROW_X: сухари/опыт с докруткой, фрагмент без неё');
    // Прогресс крафта: +20x/+23y (26.10), затем ЕЩЁ +30px вправо (27.10, "сдвинь вправо на 30").
    assert(/fragTxt\.x = 865 \+ 20 \+ 30; fragTxt\.y = 417 \+ 23;/.test(game2048Src), 'прогресс крафта сдвинут на +20+30x/+23y');
    // Статус-блок (score/maxTile/stew/attempts/nextCost/type) 27.10 переехал на точные координаты
    // редактора позиций (box-центры) — заменил визуальную прикидку +20x/+23y у score/type.
    assert(/score:       \{ x: 738,   y: 235\.5 \},/.test(game2048Src), 'статус-блок (score) — центр хитбокса x:700,y:220,w:76,h:31 редактора позиций');
    assert(/type:        \{ x: 971,   y: 301\.5 \},/.test(game2048Src), 'статус-блок (type) — центр хитбокса x:933,y:286,w:76,h:31 редактора позиций');
}

console.log('\nTest 11: game2048.js — hover-скейл на играть/завершить партию/топ/информация о событии');
{
    assert(/const _hoverScale = \(spr, scale\) => \{/.test(game2048Src), '_hoverScale() хелпер определён');
    assert(/_hoverScale\(infoBtn, 1\.05\);/.test(game2048Src), 'infoBtn (информация о событии) получил hover-скейл');
    assert(/_hoverScale\(playBtn, 1\.05\);/.test(game2048Src), 'playBtn (играть) получил hover-скейл');
    assert(/_hoverScale\(endBtn, 1\.05\);/.test(game2048Src), 'endBtn (завершить партию) получил hover-скейл');
    assert(/_hoverScale\(topBtn, 1\.05\);/.test(game2048Src), 'topBtn (топ) получил hover-скейл');
}

console.log('\nTest 12: game2048-top-popup.js — координаты лайфтайм-наград (1 ряд из 5, не 2 ряда из 6)');
{
    assert(/coins: 'монеты', gun: 'ствол', auto: 'автомат', cig: 'сухари', exp: 'опыт',\s*\n\s*\};/.test(topPopupSrc),
        'ICON_MAP теперь 5 типов (fragment убран — в арте для него нет иконки)');
    // 27.10.2026 (по прямому указанию, координаты редактора позиций — заменили визуальную
    // прикидку от 26.10): единый шаг LIFETIME_STEP убран, индивидуальный X на каждую иконку
    // (замеры не идеально равномерны), Y поднят с 505 до 525.
    assert(/const LIFETIME_ROW_Y0 = 525;/.test(topPopupSrc), 'LIFETIME_ROW_Y0 обновлён на 525 (было 505)');
    assert(/const LIFETIME_X_MAP = \{ coins: 762, gun: 814, auto: 867, cig: 918, exp: 977 \};/.test(topPopupSrc),
        'LIFETIME_X_MAP — индивидуальные X вместо единого шага LIFETIME_STEP');
    assert(/t\.x = LIFETIME_X_MAP\[type\];\s*\n\s*t\.y = LIFETIME_ROW_Y0;/.test(topPopupSrc),
        'каждая иконка берёт X из LIFETIME_X_MAP по своему типу');
    assert(!/fragment: 'fragments'/.test(topPopupSrc), 'keyMap тоже не содержит fragment (нечего мапить)');
}

console.log('\nTest 15: game2048.js/game2048-top-popup.js — "x" заменён на "X" во всех 4 местах');
{
    // 27.10.2026 (по прямому указанию — "вместо x маленького напиши X большое").
    assert(/const t = new PIXI\.Text\('X0', STYLE_RESOURCE\);/.test(game2048Src), 'game2048.js: начальный текст награды "X0"');
    assert(/this\._rewardTxts\[type\]\.text = 'X' \+ earned\[type\];/.test(game2048Src), 'game2048.js: обновление награды через "X" + число');
    assert(!/'x' \+ earned\[type\]/.test(game2048Src), 'game2048.js: строчный "x" для наград партии не остался нигде');
    assert(/const t = new PIXI\.Text\('X0', STYLE_LIFETIME\);/.test(topPopupSrc), 'game2048-top-popup.js: начальный текст лайфтайм-награды "X0"');
    assert(/this\._top1LifetimeTxts\[type\]\.text = 'X' \+ \(intval\(lt\[keyMap\[type\]\]\) \|\| 0\);/.test(topPopupSrc),
        'game2048-top-popup.js: обновление лайфтайм-награды через "X" + число');
}

console.log('\nTest 16: game2048.js — dev-панель кнопка сброса дневного лимита попыток (реальный серверный permit)');
{
    assert(/'getState', 'start', 'move', 'end', 'top', 'craft', 'devResetDaily'/.test(game2048PhpSrc),
        'devResetDaily зарегистрирован в $permits контроллера');
    assert(/function devResetDaily\(\)\{/.test(game2048PhpSrc), 'devResetDaily() определён');
    assert(/if\(!\$this->_requireDevUser\(\)\) return;/.test(game2048PhpSrc.slice(game2048PhpSrc.indexOf('function devResetDaily'))),
        'devResetDaily защищён тем же dev-гейтом, что и остальные dev-only permits проекта');
    assert(/TS\.php\('game2048\.devResetDaily', \{\}, \(e\)=>\{/.test(devPanelSrc),
        'dev_panel.js вызывает реальный серверный permit, а не клиентский мок');
}

console.log('\nTest 17: game2048.js — карточки плиток 61×61px');
{
    const { execFileSync } = require('child_process');
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    const tileFiles = ['2 ','4 ','8 ','16 ','32 ','64 ','128 ','256 ','512 ','1024 ','2048 ','4096 ','8192 ','16384 ']
        .map(v => '2048 ' + v.trim() + '.png');
    // Чисто размерная проверка через заголовок PNG (IHDR, байты 16-23) — без зависимости от PIL/Python в tests/.
    for(const f of tileFiles){
        const full = path.join(IMG_DIR, f);
        assert(fs.existsSync(full), `файл плитки существует: ${f}`);
        const buf = fs.readFileSync(full);
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        assert(w === 61 && h === 61, `${f} имеет размер 61×61, получено ${w}×${h}`);
    }
}

console.log('\nTest 13: dvor-dice-screen.js/game-boot.js — новый фон экрана «Зарик»');
{
    const start = diceScreenSrc.indexOf('proto._buildDiceScreen = function');
    const end   = diceScreenSrc.indexOf('\n        // Подсветка строки', start);
    const body  = diceScreenSrc.slice(start, end);
    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'двор зарики фон экран 2\.png'\)\);/.test(body),
        'bg использует новый файл "двор зарики фон экран 2.png" (бывший "Слой 249.png")');
    assert(/bg\.x = -1; bg\.y = 22; bg\.width = 1280; bg\.height = 690;/.test(body), 'позиция/размер фона не изменились (тот же нативный размер 1280×676)');
    assert(/'двор зарики фон экран 2\.png'/.test(gameBootSrc), 'новый файл добавлен в раннюю предзагрузку (game-boot.js)');
    assert(!/'двор зарики фон экран\.png'/.test(gameBootSrc), 'старое имя убрано из предзагрузки (не дублируется)');
}

console.log('\nTest 14: новые файлы-ассеты реально существуют на диске (с .webp парой)');
{
    const IMAGES_DIR = path.join(root, '_client', 'development', 'images');
    const expected = [
        'заначки окно запроса заголовок.png',
        'двор зарики фон экран 2.png',
    ];
    for(const f of expected){
        assert(fs.existsSync(path.join(IMAGES_DIR, f)), `файл существует: ${f}`);
        assert(fs.existsSync(path.join(IMAGES_DIR, f + '.webp')), `webp-пара существует: ${f}.webp`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

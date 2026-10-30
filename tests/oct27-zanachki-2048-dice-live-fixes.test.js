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
const countLayoutSrc    = readSrc('_client/src/modules/stash-count-layout.js');
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
    // 28.10.2026 (по прямому указанию — "при закрытии вкладки заначек закрывается сама Сводка,
    // такого быть не должно"): больше НЕ закрывает весь Свод, переключает на дефолтную вкладку.
    assert(/zanachkiExitBtn\.on\('pointerdown', \(\)=>this\._selectMainTab\('respect'\)\);/.test(zanachkiSrc),
        'свой выход переключает на вкладку respect, не закрывает весь Свод');
    assert(/const BG_X = 39, BG_Y = 92;/.test(zanachkiSrc), 'фон экрана переставлен на x:39,y:92');
    assert(/const FRIEND_REQ_X = 695, FRIEND_REQ_Y = 108;/.test(zanachkiSrc), 'кнопка запроса у друзей — y:108 (было 106)');
    assert(/const VIEW_X = 53, VIEW_W = 1127, VIEW_H = 377;/.test(zanachkiSrc), 'viewport-блок списка — x:53,y:184(VIEW_Y),w:1127,h:377');
    // 28.10.2026 (повторная правка тем же днём): шаг между рядами увеличен ещё на 5px (125→130),
    // плюс новый отступ ROW_Y0=10 перед первым рядом.
    // 28.10.2026 (ещё одна правка тем же днём — "расстояние между заначки фон ряда коллекции.png
    // сделай в 13px, отступ сверху от первого файла тоже 13px"): фон ряда высотой 115px, значит
    // ROW_H = 115 + 13 = 128 (зазор между рядами 13px, было 15px при ROW_H=130); ROW_Y0 = 13.
    assert(/const ROW_H = 128;/.test(zanachkiSrc), 'шаг между рядами коллекций — 115(высота фона)+13px зазор=128');
    assert(/const ROW_Y0 = 13;/.test(zanachkiSrc), 'отступ перед первым рядом — 13px');
    // 28.10.2026 (по прямому указанию — "для самой первой коллекции подними фон ряда выше на
    // 5px"): точечная поправка ТОЛЬКО для фона строки первой коллекции, не для карточек/кнопок.
    assert(/rowBg\.y = rowY - \(rowIdx === 0 \? 5 : 0\);/.test(zanachkiSrc), 'фон первого ряда поднят на 5px (только фон, не контент ряда)');
}

console.log('\nTest 3: svod-zanachki.js — компенсация VIEW_X в X-константах ряда (иначе клип справа маской скролла)');
{
    // Критично: mask-прямоугольник в _buildSvodScroll клиппит И по ширине (drawRect(0,0,viewW,viewH)),
    // а contentContainer.x обязан равняться VIEW_X — если X-константы ряда (ROW_X/CARD_X0/
    // CLAIM_X/STAR_X) не уменьшить на тот же VIEW_X, правый край каждого ряда (фон 1096px) вылезал
    // бы за маску на (VIEW_X) пикселей и обрезался. (REQ_X0 убран 28.10.2026 — reqSpr теперь
    // центрируется относительно card, не завязан на VIEW_X напрямую, card.x уже компенсирован.)
    assert(/const ROW_X = 77 - VIEW_X;/.test(zanachkiSrc), 'ROW_X компенсирован (77 - VIEW_X)');
    assert(/const CARD_X0 = 145 - VIEW_X, CARD_PITCH = 112;/.test(zanachkiSrc), 'CARD_X0 компенсирован (145 - VIEW_X)');
    // 28.10.2026 (по прямому указанию, после живой проверки — "ты поднял количество и кнопку
    // «Запросить», но не поднял сами карточки заначек, подними карточки тоже"): CARD_Y_OFF
    // забыли поднять на 7px синхронно с REQ_Y_OFF при первом проходе — исправлено.
    assert(/const CARD_Y_OFF = 197 - VIEW_Y - 7;/.test(zanachkiSrc), 'CARD_Y_OFF поднят на 7px синхронно с REQ_Y_OFF');
    // 28.10.2026 (повторное указание тем же днём — "кнопки запросить/в запросе подними вверх
    // на 7px"): REQ_Y_OFF уменьшен на 7.
    assert(/const REQ_Y_OFF = 288 - VIEW_Y - 7;/.test(zanachkiSrc), 'REQ_Y_OFF поднят на 7px');
    // 28.10.2026 (ещё одно указание тем же днём — "поставь запросить/в запросе центрированно
    // относительно файла самой заначки"): фиксированный REQ_X0 (ручной сдвиг +4px) убран целиком
    // — X теперь считается динамически по центру card/reqSpr.
    assert(!/const REQ_X0/.test(zanachkiSrc), 'REQ_X0-константа убрана — центрирование больше не зависит от ручного сдвига');
    // 28.10.2026 (БАГ, исправлено тем же днём — "в запросе не центрировано, хотя запросить вроде
    // центрировано"): ни карточки, ни файлы запросить/в запросе не в прелоаде — синхронный расчёт
    // card.width/reqSpr.width сразу после создания читал бы заглушку (1px), а не реальный размер.
    // Заменено на _centerZanachkiReqSpr() с отложенным пересчётом по текстуре (как в
    // raznaryadka.js), вызывается и при создании, и при смене текстуры (own/friend статус).
    assert(/this\._centerZanachkiReqSpr\(reqSpr, card\);/.test(zanachkiSrc), 'reqSpr центрируется через общий хелпер (создание)');
    assert(/proto\._centerZanachkiReqSpr = function\(spr, card\)\{/.test(zanachkiSrc), '_centerZanachkiReqSpr определён как proto-метод');
    const centerFnStart = zanachkiSrc.indexOf('proto._centerZanachkiReqSpr = function(spr, card){');
    const centerFnEnd = zanachkiSrc.indexOf('\n    };', centerFnStart);
    const centerFnBody = zanachkiSrc.slice(centerFnStart, centerFnEnd);
    assert(/if\(card\.texture\.width > 1\) apply\(\); else card\.texture\.once\('update', apply\);/.test(centerFnBody),
        'ждёт загрузки текстуры card, если ещё не готова (width<=1)');
    assert(/if\(spr\.texture\.width > 1\) apply\(\); else spr\.texture\.once\('update', apply\);/.test(centerFnBody),
        'ждёт загрузки текстуры spr, если ещё не готова (width<=1)');
    assert(/this\._centerZanachkiReqSpr\(spr, card\);/.test(zanachkiSrc), 'reqSpr пересчитывается через тот же хелпер при смене текстуры (own/friend статус)');
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
    // 28.10.2026 (по прямому указанию — награда теперь РАЗНАЯ по коллекциям: 50/70/80, см.
    // rewardAmountForCol(); также репозиция по редактору позиций для 1-й коллекции и фикс
    // обрезки знака "+" через padding в TextStyle).
    assert(/const sukhariRewardTxt = new PIXI\.Text\('\+' \+ amt \+ ' сухарей', \{/.test(zanachkiSrc), '"+N сухарей" — отдельный текст с динамической суммой');
    assert(/const expRewardTxt = new PIXI\.Text\('\+' \+ amt \+ ' опыта', \{/.test(zanachkiSrc), '"+N опыта" — отдельный текст с динамической суммой');
    assert(/expRewardTxt\.x = STAR_X \+ starIcon\.width \+ 6; expRewardTxt\.y = rowY \+ STAR_Y_OFF \+ 5;/.test(zanachkiSrc), '"+опыта" — новая Y-формула (редактор позиций, 1-я коллекция даёт y:69)');
    assert(/sukhariRewardTxt\.x = STAR_X \+ 30; sukhariRewardTxt\.y = rowY \+ STAR_Y_OFF - 26;/.test(zanachkiSrc), '"+сухарей" — новая Y-формула (редактор позиций, 1-я коллекция даёт y:38)');
    assert(/function rewardAmountForCol\(col\)\{/.test(zanachkiSrc), 'rewardAmountForCol() определена');
    assert(/stroke: '#000000', strokeThickness: 2, padding: 4,/.test(zanachkiSrc), 'padding:4 добавлен на текстах со stroke (фикс обрезки знака "+")');
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

console.log('\nTest 9: game2048.js — плитки БЕЗ какого-либо масштабирования (натуральный пиксельный размер)');
{
    // 28.10.2026 (по прямому указанию, повторный репорт — "выводи как они должны быть, без
    // скейла вообще"): промежуточный Math.min(1, cellSize/tex.width, cellSize/tex.height)
    // (вписывал в ячейку доски с сохранением пропорций) заменён на безусловный scale=1.
    assert(!/cont\._spr\.width = Math\.min\(cont\._spr\.width \|\| 48,/.test(game2048Src), 'старый баг (меняли ТОЛЬКО .width, не .height) убран');
    // Ищем именно ИСПОЛНЯЕМУЮ строку (не упоминание формулы в поясняющем комментарии выше по файлу).
    assert(!/const scale = Math\.min\(1, cellSize/.test(game2048Src), 'клапан "вписать в ячейку" (Math.min по cellSize) убран из кода');
    assert(/cont\._spr\.scale\.set\(1\);/.test(game2048Src), 'плитка рендерится с scale=1 — натуральный пиксельный размер, без вписывания в ячейку');
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
    // 28.10.2026 (по прямому указанию — "если цифра перевалит за 1000, вместо X1000 писалось бы
    // X1K, за 1 000 000 — X1КК"): переиспользован formatAchNum (modules/achievement-tiers.js,
    // тот же к/кк-формат, что у достижений и попапа результата боя), не задублирован инлайн.
    assert(/import \{ formatAchNum \} from '\.\.\/\.\.\/modules\/achievement-tiers\.js';/.test(topPopupSrc),
        'game2048-top-popup.js: импортирует общий formatAchNum');
    assert(/this\._top1LifetimeTxts\[type\]\.text = 'X' \+ formatAchNum\(intval\(lt\[keyMap\[type\]\]\) \|\| 0\);/.test(topPopupSrc),
        'game2048-top-popup.js: обновление лайфтайм-награды через "X" + formatAchNum(число) — сокращается после 1000/1000000');
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

console.log('\nTest 17: game2048.js — карточки плиток в натуральном (неискажённом) размере, без форс-ресайза');
{
    // 28.10.2026 (по прямому указанию, 2 захода подряд): 1) "эти файлы должны быть 62×62... но
    // у них нет прозрачных отступов по бокам, выводи в натуральном размере" — форс-ресайз до
    // квадрата 62×62 убран (PIL getbbox() подтвердил: альфа-канал без отступов у всех 14 файлов,
    // обрезать нечего, а форс-ресайз до идеального квадрата только искажал пропорции оригиналов,
    // 64-71px разброс по сторонам); 2) после объяснения, что cellSize доски физически 46px и
    // поэтому ЛЮБОЙ исходник ≥46px визуально "схлопывался" отрисовкой — "выводи их, как они
    // должны быть, БЕЗ СКЕЙЛА ВООБЩЕ". Теперь исходники — натурального размера (этот тест) И
    // отрисовка больше НЕ вписывает их в ячейку (см. game2048.js._renderTile() —
    // cont._spr.scale.set(1) безусловно, проверено в Test 9 выше).
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    const NATURAL_SIZES = {
        2: [67,68], 4: [66,65], 8: [67,64], 16: [67,65], 32: [66,64], 64: [67,65],
        128: [67,68], 256: [66,68], 512: [67,68], 1024: [66,71], 2048: [67,71],
        4096: [67,69], 8192: [66,71], 16384: [68,71],
    };
    // Чисто размерная проверка через заголовок PNG (IHDR, байты 16-23) — без зависимости от PIL/Python в tests/.
    for(const v of Object.keys(NATURAL_SIZES)){
        const f = `2048 ${v}.png`;
        const full = path.join(IMG_DIR, f);
        assert(fs.existsSync(full), `файл плитки существует: ${f}`);
        const buf = fs.readFileSync(full);
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        const [ew, eh] = NATURAL_SIZES[v];
        assert(w === ew && h === eh, `${f} в натуральном размере ${ew}×${eh}, получено ${w}×${h}`);
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

console.log('\nTest 15: game2048.js — доска 4×4 теперь 16 готовых центров (CELL_POS), BOARD/cellCenter убраны (28.10.2026, редактор позиций, подтверждено явно: "сделай так, как я тебе скинул координаты")');
{
    assert(!/const BOARD = \{/.test(game2048Src), 'формула BOARD убрана целиком');
    assert(!/function cellCenter\(/.test(game2048Src), 'функция cellCenter() убрана целиком');
    assert(/const CELL_POS = \[/.test(game2048Src), 'CELL_POS — новый фиксированный массив 16 центров');
    assert(/const cell = CELL_POS\[r \* 4 \+ c\];/.test(game2048Src), 'цикл построения поля берёт центр из CELL_POS по индексу r*4+c');
    // Первая (1-1, x:6,y:7) и последняя (4-4, x:215,y:209) точки — top-left+w/h(67,68) из
    // редактора, переведённые в центр (x+33.5, y+34). 28.10.2026 (повторное указание тем же
    // днём — "редактор показывал 0 и 0 вместо координат относительно экрана", доска
    // скомпенсирована смещением +383x/+125y поверх исходных чисел, см. докблок CELL_POS).
    assert(/\{ x: 6 \+ 33\.5 \+ 383,   y: 7 \+ 34 \+ 125 \+ 68   \}/.test(game2048Src), 'ячейка 1-1: x=6+33.5+383, y=7+34+125+68 (как продиктовано)');
    assert(/\{ x: 215 \+ 33\.5 \+ 383, y: 209 \+ 34 \+ 125 \+ 68 \}/.test(game2048Src), 'ячейка 4-4: x=215+33.5+383, y=209+34+125+68 (как продиктовано)');
    const cellPosMatch = game2048Src.match(/const CELL_POS = \[([\s\S]*?)\];/);
    assert(!!cellPosMatch, 'CELL_POS найден целиком');
    if(cellPosMatch){
        const count = (cellPosMatch[1].match(/\{ x:/g) || []).length;
        assert(count === 16, `CELL_POS содержит ровно 16 точек (нашлось ${count})`);
    }
}

console.log('\nTest 20: game2048.js — позиция плитки стоит на spr (не на cont-обёртке), чтобы редактор позиций находил реальные экранные координаты, а не локальные 0,0 (28.10.2026, по живому репорту)');
{
    const loopStart = game2048Src.indexOf('for(let r = 0; r < 4; r++){');
    const loopEnd = game2048Src.indexOf('this._win = win;');
    const loopBody = game2048Src.slice(loopStart, loopEnd);
    assert(!/cont\.x = cell\.x; cont\.y = cell\.y;/.test(loopBody), 'cont (обёртка) больше НЕ несёт позицию — иначе редактор находит Sprite с локальными 0,0');
    assert(/spr\.x = cell\.x; spr\.y = cell\.y;/.test(loopBody), 'spr (реальный видимый/кликабельный объект) несёт позицию напрямую — как у всех остальных спрайтов проекта');
    assert(/cont\._cellX = cell\.x; cont\._cellY = cell\.y;/.test(loopBody), 'координаты ячейки сохранены на cont для фолбэк-текста (значения >16384)');

    const renderStart = game2048Src.indexOf('_renderTile(cont, value){');
    const renderEnd = game2048Src.indexOf('\n    }', renderStart);
    const renderBody = game2048Src.slice(renderStart, renderEnd);
    assert(/cont\._fallbackTxt\.x = cont\._cellX; cont\._fallbackTxt\.y = cont\._cellY;/.test(renderBody),
        'фолбэк-текст (нет арта для значения) позиционируется явно той же точкой — cont сам стоит на (0,0)');
}

console.log('\nTest 16: game2048.js — "купить попытку"/инактив переключаются по наличию бесплатных попыток, не только по atLimit (28.10.2026, по прямому указанию)');
{
    assert(/const freeLeft = intval\(daily\.used\) < 3;/.test(game2048Src), 'freeLeft — те же 3 бесплатные попытки, что считает nextPaidIdx');
    assert(/this\._buyBtn\.visible = !session && !atLimit && !freeLeft;/.test(game2048Src),
        'активная кнопка покупки показывается только когда бесплатные ИСЧЕРПАНЫ (следующая партия платная)');
    assert(/this\._buyBtnInactive\.visible = !session && !atLimit && freeLeft;/.test(game2048Src),
        'инактив-кнопка показывается, ПОКА доступны бесплатные партии');
}

console.log('\nTest 17: game2048.js/game2048-top-popup.js — "2048 ТОП" только scale-hover, хитбоксы топ-1, расстояние между строками -9px, места +20px (28.10.2026)');
{
    const topBtnStart = game2048Src.indexOf("'2048 ТОП.png'");
    const topBtnEnd = game2048Src.indexOf('win.addChild(topBtn);', topBtnStart);
    const topBtnBody = game2048Src.slice(topBtnStart, topBtnEnd);
    assert(!/topBtn\.alpha/.test(topBtnBody), '"2048 ТОП" больше не трогает alpha при наведении');
    assert(/_hoverScale\(topBtn, 1\.05\);/.test(game2048Src), '"2048 ТОП" сохраняет scale-only hover через общий _hoverScale');

    // 28.10.2026: повторный снимок хитбокса редактора позиций (775,363,1.105 → 770,362,1.106 и
    // 731,413,1.676 → 727,411,1.699).
    //
    // 28.10.2026 (повторная правка тем же днём — по прямому указанию, после фикса реального
    // шрифта на Bebas Neue Pro Middle): "никнейм сдвинь вправо на 90px и опусти вниз на 12px",
    // "кол-во партий сдвинь вправо на 130px и опусти вниз на 15px, уменьши font size до 16" —
    // 770→860, 362→374 (ник); 727→857, 411→426, fontSize 30→16 (кол-во партий).
    assert(/top1Nick\.x = 860; top1Nick\.y = 374;/.test(topPopupSrc), 'top1Nick — новый хитбокс x:860,y:374');
    assert(/top1Nick\.scale\.set\(1\.106\);/.test(topPopupSrc), 'top1Nick — scale:1.106');
    assert(/top1Games\.x = 857; top1Games\.y = 426;/.test(topPopupSrc), 'top1Games — новый хитбокс x:857,y:426');
    assert(/top1Games\.scale\.set\(1\.699\);/.test(topPopupSrc), 'top1Games — scale:1.699');
    assert(/const STYLE_GAMES_BIG = \{ fontFamily: 'Bebas Neue Pro Middle', fontSize: 16,/.test(topPopupSrc),
        'STYLE_GAMES_BIG.fontSize уменьшен до 16');
    // 28.10.2026 (повторное указание тем же днём — "увеличь расстояние между никнеймами/кол-вом
    // партий/местами на 1px"): 37 → 38 (одна общая строка-шаг на все три колонки).
    assert(/const ROW_H = 46 - 9 \+ 1 - 1 - 0\.5;/.test(topPopupSrc), 'расстояние между строками списка: 46-9+1-1-0.5=36.5');
    assert(/placeTxt\.x = 336 \+ 20;/.test(topPopupSrc), 'места 2..10 сдвинуты вправо на 20px');
}

console.log('\nTest 18: svod-zanachki.js — кнопка «Забрать» получила scale-hover, запрос «у друзей» передаёт myOwnedCounts (28.10.2026, по прямому указанию)');
{
    const claimStart = zanachkiSrc.indexOf("'заначки кнопка забрать.png'");
    const claimEnd = zanachkiSrc.indexOf('content.addChild(claimBtn);', claimStart);
    const claimBody = zanachkiSrc.slice(claimStart, claimEnd);
    assert(/claimBtn\.on\('pointerover', \(\)=>\{ if\(claimBtn\.interactive\) claimBtn\.scale\.set\(1\.08\); \}\);/.test(claimBody),
        '«Забрать» растёт при наведении, только пока активна (коллекция собрана)');
    assert(/claimBtn\.on\('pointerout',  \(\)=>\{ claimBtn\.scale\.set\(1\); \}\);/.test(claimBody),
        '«Забрать» возвращается к scale 1 при уходе курсора');

    const reqBtnStart = zanachkiSrc.indexOf("reqBtn.on('pointerdown'");
    const reqBtnEnd = zanachkiSrc.indexOf('win.addChild(reqBtn);', reqBtnStart);
    const reqBtnBody = zanachkiSrc.slice(reqBtnStart, reqBtnEnd);
    assert(/myOwnedCounts\[col \+ '_' \+ pos\] = Number\(stashData\[col\]\[pos\]\) \|\| 0;/.test(reqBtnBody),
        'кнопка «ЗАПРОС У ДРУЗЕЙ» строит myOwnedCounts из актуального stashData перед открытием своего списка');
    assert(/this\._buildZanachkiWishlistPopup\(\(this\._zanachkiState && this\._zanachkiState\.wishlist\) \|\| \[\], 'own', \{ myOwnedCounts \}\);/.test(reqBtnBody),
        'myOwnedCounts реально передаётся в попап (режим own)');
}

console.log('\nTest 19: svod-zanachki-wishlist.js — под каждой карточкой запроса пишется кол-во копий, которые уже есть у игрока (28.10.2026, подтверждено явно через вопрос пользователю)');
{
    assert(/const owned = Number\(\(ctx\.myOwnedCounts && ctx\.myOwnedCounts\[key\]\) \|\| 0\);/.test(wishlistSrc),
        'owned считается из ctx.myOwnedCounts по ключу col_pos — общий для обоих режимов (own/friend)');
    const countTxtStart = wishlistSrc.indexOf('const countTxt = new PIXI.Text(String(owned)');
    assert(countTxtStart !== -1, 'countTxt создаётся с текстом owned');
    const applyEnd = wishlistSrc.indexOf("if(mode === 'own')", countTxtStart);
    const countTxtBody = wishlistSrc.slice(countTxtStart, applyEnd);
    // 28.10.2026 (баг найден тем же днём — "не видно количество"): исходная позиция (card.y +
    // card.height + 4) попадала ВНУТРЬ actionBtn (зазор карточка→кнопка всего 2px) и пряталась
    // под её спрайтом (actionBtn добавлялся раньше countTxt). Перенесено под кнопку.
    // 28.10.2026 (повторное указание тем же днём, по скриншоту референса — "те же характеристики,
    // что у количества значек которые есть у меня: fontSize 18, чёрный, Southbank LT; подними на
    // 47px"): шрифт/цвет сменены (были Bebas Neue Book 14 белый), позиция поднята на 47px от
    // варианта "под кнопкой".
    assert(/fontFamily: 'Southbank LT', fontSize: 18, fill: '#000000',/.test(countTxtBody), 'Southbank LT, fontSize 18, чёрный — как у количества на основной сетке заначек');
    // 28.10.2026 (баг найден по прямому указанию — "первый раз правильно, второй раз опустились
    // вниз"): actionBtn.height читался СИНХРОННО при построении попапа, а кнопки убрать/отправить
    // нигде не прелоадятся — до загрузки текстуры height ~1px, после — реальные 27-29px, один и
    // тот же код давал разный результат в зависимости от кэша. Фикс — пересчёт через
    // applyCountPos(), вызываемый сразу (если текстура уже готова) либо по 'update' (тот же
    // паттерн, что и _centerZanachkiReqSpr в svod-zanachki.js), плюс обе кнопки добавлены в
    // прелоад (game-boot.js) по ПРАВИЛУ №11.
    assert(countTxtBody.includes("placeStashCount(countTxt, card, actionBtn, mode === 'friend')"), 'общий хелпер ждёт карточку и кнопку');
    assert(countLayoutSrc.includes("image.texture.once('update', update)"), 'позиция обновляется после загрузки каждой участвующей текстуры');
    // 28.10.2026 (повторное указание — "после нажатия убрать/отправить цифры съезжают вниз" —
    // разделение own/friend на РАЗНЫЕ формулы несколькими сообщениями раньше оказалось ошибкой
    // диагностики: видимая разница между скриншотами была следствием гонки текстуры (см. выше),
    // а не разным желаемым местом для двух режимов. own и friend ВОЗВРАЩЕНЫ на одну общую
    // формулу — один набор чисел крутить, не два расходящихся).
    assert(countLayoutSrc.includes('actionButton.y + actionButton.height + 1 - 47 - 3 - (friend ? 3 : 0)'), 'только у друга количество поднято дополнительно на 3px');
    assert(!/if\(mode === 'own'\)\{\s*\n\s*countTxt\.x/.test(wishlistSrc), 'позиция countTxt больше НЕ ветвится по mode — один общий расчёт на оба режима');
    // countTxt строится ПОСЛЕ actionBtn (нужен actionBtn.height для позиционирования), но
    // ДО ветвления own/friend (которое теперь относится только к обработчику кнопки, не к позиции).
    const actionBtnIdx = wishlistSrc.indexOf('win.addChild(actionBtn);');
    const branchIdx = wishlistSrc.indexOf("if(mode === 'own'){");
    assert(actionBtnIdx !== -1 && actionBtnIdx < countTxtStart, 'actionBtn создаётся до countTxt (нужна его высота)');
    assert(countTxtStart < branchIdx, 'countTxt строится до ветвления own/friend — применяется к обоим режимам');
}

console.log('\nTest 19b: game-boot.js — кнопки запроса заначек «убрать»/«отправить» добавлены в прелоад (28.10.2026, ПРАВИЛО №11, корень гонки текстуры из Test 19)');
{
    const gameBootPath = path.join(__dirname, '..', '_client', 'src', 'game', 'game-boot.js');
    const gameBootSrc = fs.readFileSync(gameBootPath, 'utf8');
    assert(gameBootSrc.includes("'заначки кнопка убрать.png'"), 'заначки кнопка убрать.png — в прелоаде');
    assert(gameBootSrc.includes("'заначки кнопка отправить.png'"), 'заначки кнопка отправить.png — в прелоаде');
}

console.log('\nTest 21: game2048-top-popup.js — места игроков (2..10) дополнительно опущены на 9px (28.10.2026, по прямому указанию)');
{
    assert(/const ROW2_Y = 236, PLACE_Y_DELTA = 225 - 236 \+ 9;/.test(topPopupSrc),
        'PLACE_Y_DELTA = 225-236+9 (было -11, стало -2) — места опущены на 9px относительно остального ряда');
}

console.log('\nTest 22: game2048.js — доска дополнительно опущена на 68px поверх уже применённого сдвига (28.10.2026, по прямому указанию)');
{
    assert(/\{ x: 6 \+ 33\.5 \+ 383,   y: 7 \+ 34 \+ 125 \+ 68   \}/.test(game2048Src), 'ячейка 1-1: +68 добавлен к Y поверх +125');
    assert(/\{ x: 215 \+ 33\.5 \+ 383, y: 209 \+ 34 \+ 125 \+ 68 \}/.test(game2048Src), 'ячейка 4-4: +68 добавлен к Y поверх +125');
}

console.log('\nTest 23: game2048-top-popup.js — никнейм топ-1 (28.10.2026: чёрный→белый по диагностике невидимости на тёмной плашке, затем тем же днём белый→чёрный обратно по прямому подтверждённому указанию пользователя — осознанный риск повторной невидимости)');
{
    // Порядок правок тем же днём: сначала диагностирован и исправлен баг невидимости
    // (fill:#000000 на тёмном фоне), затем пользователь ЯВНО подтвердил (после предупреждения
    // о том же риске), что хочет чёрный обратно — безусловно. emptyTopTxt ("Пока нет лидера")
    // по-прежнему переопределяет fill на белый поверх этого же базового стиля — её не касается.
    assert(/const STYLE_NICK = \{ fontFamily: 'Bebas Neue Pro Middle', fontSize: 18, fontWeight: '400', fill: '#000000' \};/.test(topPopupSrc),
        'STYLE_NICK.fill — чёрный (#000000), по прямому подтверждённому указанию 28.10.2026');
}

console.log('\nTest 24: game2048-top-popup.js/dev_panel.js — ждём document.fonts.ready перед ПЕРВОЙ сборкой попапа топа 2048 (28.10.2026, по живому репорту "никнейм/партии не в хитбоксах, хотя координаты верные")');
{
    // Тот же класс гонки, что уже чинился 20.10.2026 в interface-currency-purchase.js: PIXI
    // печёт canvas текста сразу, не дожидаясь реальной загрузки @font-face "Bebas Neue Pro Middle" —
    // если попап строится раньше, браузер молча подставляет fallback-шрифт с другими
    // пропорциями, а _topWin кешируется НАВСЕГДА (if(!this._topWin)), так что один неудачный
    // первый рендер портит экран на весь сеанс.
    const openStart = topPopupSrc.indexOf('proto._openGame2048TopPopup = function(){');
    const openEnd = topPopupSrc.indexOf('\n    };', openStart);
    const openBody = topPopupSrc.slice(openStart, openEnd);
    assert(/document\.fonts\.check\("18px 'Bebas Neue Pro Middle'"\)/.test(openBody), '_openGame2048TopPopup проверяет готовность Bebas Neue Pro Middle');
    assert(/document\.fonts\.ready\.then\(\(\) => \{/.test(openBody), '_openGame2048TopPopup откладывает сборку до document.fonts.ready');
    assert(/if\(!this\._topWin\) this\._buildGame2048TopPopup\(\);/.test(openBody), 'после готовности шрифта (или если _topWin уже есть) — обычная сборка');

    // Дев-панель строит попап НАПРЯМУЮ через _buildGame2048TopPopup(), в обход
    // _openGame2048TopPopup — нужен свой такой же гейт, иначе фикс не действует именно там,
    // где пользователь реально тестирует (мок "Топ (мок)" — тот самый путь из репорта, см.
    // точное совпадение тестовых данных "Тестер 1"/42/100/50/20/300/900 со скриншотом).
    const mockStart = devPanelSrc.indexOf("_row('Топ (мок)'");
    const mockEnd = devPanelSrc.indexOf("_row('Прогресс крафта", mockStart);
    const mockBody = devPanelSrc.slice(mockStart, mockEnd);
    assert(/document\.fonts\.check\("18px 'Bebas Neue Pro Middle'"\)/.test(mockBody), 'дев-панель мок тоже проверяет готовность Bebas Neue Pro Middle перед первой сборкой');
    assert(/document\.fonts\.ready\.then\(run\);/.test(mockBody), 'дев-панель мок откладывает run() (сборка+рендер) до document.fonts.ready');
}

console.log('\nTest 25: game2048.js/game2048-top-popup.js/dev_panel.js — имя шрифта "Bebas Neue Pro" (без суффикса) нигде не используется (28.10.2026, по прямому указанию — аудит "шрифты не успевают загрузиться" вскрыл вторую, более глубокую причину)');
{
    // Корень: 'Bebas Neue Pro' НИКОГДА не был объявлен в fonts.css (@font-face) — только
    // 'Bebas Neue Pro Middle' и 'Bebas Neue Pro Bold'. Это не гонка загрузки, а опечатка в
    // имени семейства с момента создания фичи 26.10.2026 — document.fonts.check для
    // несуществующего имени никогда не станет true, и Test 24's document.fonts.ready.then(retry)
    // зациклился бы НАВСЕГДА, так и не построив попап (хуже прежнего молчаливого fallback-рендера).
    // См. tests/font-family-registration-consistency.test.js — общий проход по всему проекту,
    // подтвердивший, что это ЕДИНСТВЕННОЕ такое место во всём src/.
    assert(!/fontFamily:\s*'Bebas Neue Pro'(?!\s*Middle|\s*Bold)/.test(game2048Src),
        'game2048.js (FONT_STAT) не ссылается на незарегистрированное имя "Bebas Neue Pro"');
    assert(/const FONT_STAT = 'Bebas Neue Pro Middle';/.test(game2048Src),
        'FONT_STAT использует реально зарегистрированный "Bebas Neue Pro Middle"');
    assert(!/fontFamily:\s*'Bebas Neue Pro'(?!\s*Middle|\s*Bold)/.test(topPopupSrc),
        'game2048-top-popup.js не ссылается на незарегистрированное имя "Bebas Neue Pro"');
    assert(!/document\.fonts\.check\("18px 'Bebas Neue Pro'"\)/.test(topPopupSrc),
        'проверка готовности шрифта в game2048-top-popup.js указывает на реально существующее имя, не на "Bebas Neue Pro" без суффикса');
    assert(!/document\.fonts\.check\("18px 'Bebas Neue Pro'"\)/.test(devPanelSrc),
        'проверка готовности шрифта в dev_panel.js (мок) указывает на реально существующее имя, не на "Bebas Neue Pro" без суффикса');
}

console.log('\nTest 26: svod-zanachki.js — счётчик карточки пишет "0" вместо пустой строки, когда у игрока нет копий (28.10.2026, по прямому указанию — "а то сейчас просто пусто, ничего не понятно")');
{
    const applyCountsStart = zanachkiSrc.indexOf('proto._zanachkiApplyCounts = function');
    const applyCountsEnd = zanachkiSrc.indexOf('\n    };', applyCountsStart);
    const applyCountsBody = zanachkiSrc.slice(applyCountsStart, applyCountsEnd);
    assert(/if\(txt\) txt\.text = String\(count\);/.test(applyCountsBody), 'текст всегда String(count), включая 0 — не прячется в пустую строку');
    assert(!/count > 0 \? String\(count\) : ''/.test(applyCountsBody), 'старая условная логика (пусто при 0) убрана');
}

console.log('\nTest 27: svod-zanachki.js — счётчик карточки больше НЕ задвоен с подъёмом card.y (28.10.2026, по прямому указанию — "ты высоко задёрнул текст, опусти на 7px")');
{
    // card.y уже включает -7 (через CARD_Y_OFF) — countTxt.y строится ОТ card.y, значит эта "-7"
    // унаследуется автоматически. Если формула countTxt СВЕРХУ добавляет ещё свою "-7" — итоговый
    // подъём относительно card задваивается (14px вместо 7).
    assert(zanachkiSrc.includes('placeStashCount(countTxt, card)') && countLayoutSrc.includes('card.y + card.height - 20'),
        'позиция считается по реальной карточке без компенсации заглушки 1x1');
    assert(!/countTxt\.y = card\.y \+ card\.height - 18 \+ 92 - 2 - 7;/.test(zanachkiSrc),
        'задвоенная формула (с собственной -7 поверх унаследованной) не осталась');
}

console.log('\nTest 28: svod-zanachki-wishlist.js — счётчик "у меня" опущен ещё на 25px (28.10.2026, по прямому указанию, скриншот "ЗАПРОС ДРУГА В ЗАНАЧКАХ") — ПОЗЖЕ В ТОТ ЖЕ ДЕНЬ отменено, см. Test 19');
{
    // Эта +25 правка опиралась на скриншот, снятый во время гонки текстуры (actionBtn.height
    // читался как placeholder) — визуально выглядела нужной, но после фикса гонки (Test 19)
    // оказалась лишней: с реальной высотой кнопки она уводила число на тёмный фон/кнопку.
    // Отменена тем же днём вместе с разделением own/friend — обе правки держались на одном и
    // том же ошибочном наблюдении. Формула +25 в файле больше НЕ встречается.
    assert(!/countTxt\.y = actionBtn\.y \+ actionBtn\.height \+ 1 - 47 - 3 \+ 25;/.test(wishlistSrc),
        '+25 правка отменена — не осталась в файле после унификации формулы (см. Test 19)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

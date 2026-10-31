import { applyPatch } from '../../modules/patch.js';
import { scheduleFontRedraw } from '../../modules/font-ready.js';
import { placeStashCount } from '../../modules/stash-count-layout.js';

/** Вкладка «Заначки» (26.10.2026, по прямому указанию) — восстановление полноценной механики
 * коллекционных карточек (15 коллекций по 7 карточек), урезанной 25.09.2026 ровно потому что
 * "арт не готов". Сервер — server/core/controllers/zanachki.php (getState/claimCollection/
 * requestCard/cancelRequest/getFriendWishlist/giveCard), модель — server/core/models/
 * zanachkimodel.php. Карточки выдаются за игру по всей игре (зона/ящик/покер/рулетка, см.
 * правки в соответствующих контроллерах) — эта вкладка только показывает собранное/обменивает.
 *
 * Координаты — надиктованы пользователем относительно ПЕРВОЙ строки коллекции (считаем, что
 * видно 3 строки одновременно, остальные 12 — скроллом, тот же механизм, что у Топов/Достижений
 * Сводки, см. svod-scroll.js). Шаг между строками (ROW_H) и горизонтальный шаг карточек
 * (CARD_PITCH) — расчётные (из размеров ассетов/одной явно продиктованной пары координат),
 * финальная подгонка — через universal_pos_editor.js, как принято в проекте для похожих экранов.
 *
 * ⚠️ "y257" для карточки №2 в исходной надиктовке почти наверняка опечатка распознавания речи
 * (вероятно "x257") — вертикальный шаг физически не влезает в высоту строки (115px у фона
 * строки при высоте карточки 93px), поэтому здесь карточки идут ГОРИЗОНТАЛЬНО с шагом ~112px.
 */
const FONT = 'Bebas Neue Book';

const THEMES = {
    1: 'граната', 2: 'кассета', 3: 'открытка', 4: 'зажигалка', 5: 'баллончик',
    6: 'трубка', 7: 'кость', 8: 'фишка', 9: 'шахматы', 10: 'медальон',
    11: 'монета', 12: 'звезда', 13: 'пистолет', 14: 'автомат', 15: 'нож',
};

// 27.10.2026 (по прямому указанию, репозиция после живого теста на сервере): расстояние между
// рядами коллекций увеличено на 10px (было 115).
// 28.10.2026 (по прямому указанию — "у самого первого ряда опусти его ниже на 10px и расстояние
// между такими файлами сделай на 5px больше"): ROW_H 125→130 (шаг между рядами), ROW_Y0 — новый
// отступ ПЕРЕД первым рядом (раньше первый ряд начинался прямо с 0).
// 28.10.2026 (повторное указание тем же днём — "расстояние между заначки фон ряда коллекции.png
// сделай в 13px а отступ сверху от самого первого файла сделай также 13px"): фон ряда
// ("заначки фон ряда коллекции.png") нативной высотой 115px — зазор МЕЖДУ рядами = ROW_H минус
// эта высота, то есть ROW_H = 115 + 13 = 128 (было 130, зазор 15px). ROW_Y0 — тот же отступ 13px
// перед самым первым рядом (было 10).
const ROW_H = 126;
const ROW_Y0 = 13;
// Y-координаты ниже — АБСОЛЮТНЫЕ для первой (верхней видимой) строки; контейнер списка
// целиком ставится на VIEW_Y (см. _buildSvodScroll ниже, тот же приём, что в
// svod-achievements.js: cardsContainer.y = LIST_TOP === viewY), а каждая строка ВНУТРИ него —
// в ЛОКАЛЬНЫХ координатах (rowIdx * ROW_H, начиная с 0), иначе скролл задвоил бы сдвиг.
// 27.10.2026 (по прямому указанию): VIEW_Y 192→184 — абсолютные Y карточек/кнопок ниже считаются
// формулой "абсолют - VIEW_Y", поэтому сами остаются приколоты к тем же исходным абсолютным
// числам (197/288/273/248) независимо от VIEW_Y — эта правка их визуально не сдвигает.
const VIEW_Y = 184;
// 27.10.2026 (по прямому указанию — "я его чуть расширил"): блок отображения ячеек коллекций
// (viewport скролла) x:53,y:184,w:1127,h:377 — снято редактором позиций. ⚠️ Маска скролла
// (_buildSvodScroll в svod-scroll.js) клиппит И ПО ШИРИНЕ, не только по высоте, а
// contentContainer.x ОБЯЗАН быть равен VIEW_X (конвенция всего механизма скролла) — то есть
// контент целиком сдвигается вправо на (новый VIEW_X − старый 0) = 53px относительно экрана,
// а правая граница маски (VIEW_X+VIEW_W=53+1127=1180) РОВНО совпадает со старой (0+1180=1180).
// Без компенсации строка (фон 1096px, начинающийся на ROW_X) вылезала бы на 46px за правый
// край маски и обрезалась бы — поэтому ниже X-константы внутри ряда уменьшены на тот же VIEW_X,
// чтобы их АБСОЛЮТНАЯ позиция на экране осталась прежней (0,0 слева ничем не занято — обрезка
// левого края скролла безвредна, там и раньше ничего не рисовалось).
const VIEW_X = 53, VIEW_W = 1127, VIEW_H = 377;
const ROW_X = 77 - VIEW_X;
const CARD_X0 = 145 - VIEW_X, CARD_PITCH = 112;
// 28.10.2026 (по прямому указанию — "ты поднял количество и кнопку «Запросить», но не поднял
// сами карточки заначек, подними карточки на 7px тоже"): синхронно с REQ_Y_OFF выше — забыли
// применить тот же подъём к самим картинкам карточек в первом заходе.
const CARD_Y_OFF = 197 - VIEW_Y - 7;      // смещение карточки от верха строки
// 28.10.2026 (повторное указание тем же днём — "файлы кнопок запросить/в запросе... подними
// вверх на 7px"): REQ_Y_OFF уменьшен на 7 (было 288 - VIEW_Y).
// 28.10.2026 (ещё одно указание тем же днём — "поставь файлы запросить/в запросе центрированно
// относительно файла самой заначки"): фиксированный REQ_X0 (ручной сдвиг вправо на 4px) убран —
// X теперь вычисляется по центру card динамически, см. reqSpr ниже.
const REQ_Y_OFF = 288 - VIEW_Y - 7;
const CLAIM_X = 987 - VIEW_X, CLAIM_Y_OFF = 273 - VIEW_Y;
const STAR_X = 1000 - VIEW_X, STAR_Y_OFF = 248 - VIEW_Y;
// 27.10.2026 (по прямому указанию, точные координаты с редактора позиций): фон экрана
// x:39,y:92; кнопка запроса у друзей x:695,y:108 (было y:106). Оба — дети `win`, НЕ `content`,
// компенсация VIEW_X их не касается.
const BG_X = 39, BG_Y = 92;
const FRIEND_REQ_X = 695, FRIEND_REQ_Y = 108;
// Кнопка выхода, выделенная ПОД экран заначек (раньше использовался только общий выход Сводки)
// — x:1170,y:113, scale:0.79. Тоже ребёнок `win`.
const EXIT_X = 1170, EXIT_Y = 113, EXIT_SCALE = 0.79;

// 27.10.2026 (по прямому указанию — новые ассеты скролла присланы специально для этой
// вкладки, старый общий "шкала скрола.png"/"свод скролл бегунок.png" здесь больше не нужен):
// track x:1181,y:203; стрелка вверх x:1183,y:216; стрелка вниз x:1183,y:521 — надиктованные
// координаты, трек/стрелки/бегунок теперь СВОИ (см. override в _buildSvodScroll), остальные
// вкладки Сводки (топы/достижения) по-прежнему используют общие ассеты.
const TRACK_X = 1181, ARROW_X = 1183, TRACK_Y = 203, ARROW_UP_Y = 216, ARROW_DOWN_Y = 521;

// 27.10.2026 (по прямому указанию): новая иконка "боевка награда сухари.png" (68×77px в
// исходнике) над звездой наград — выводим шириной 25px, высота пропорциональна (25×77/68≈28).
const SUKHARI_ICON_W = 25, SUKHARI_ICON_H = Math.round(SUKHARI_ICON_W * 77 / 68);

// 28.10.2026 (по прямому указанию, 2-й скрин старого ТЗ — "первые 3 коллекции дают +50 опыта/
// сухарей, последние три +80, все остальные +70"): раньше была ОДНА плоская константа на все
// 15 коллекций (ZanachkiModel::COLLECTION_CIG_REWARD/EXP_REWARD=50) — теперь сервер и клиент
// считают награду по тому же правилу независимо (сервер — источник истины для начисления,
// клиент — только для отображения текста в строке коллекции, см. zanachkimodel.php).
function rewardAmountForCol(col){
    if(col <= 3) return 50;
    if(col >= 13) return 80;
    return 70;
}

function isCollectionComplete(stashData, col){
    const data = (stashData && stashData[col]) || {};
    for(let pos = 1; pos <= 7; pos++){
        if(Number(data[pos] || 0) < 1) return false;
    }
    return true;
}

export function attachSvodZanachki(proto){
    const IMG = './images/';

    proto._buildZanachkiPanel = function(){
        const win = new PIXI.Container();
        win.visible = false;

        // 28.10.2026 (баг найден по прямому указанию — "Собрано коллекций пишется не теми
        // шрифтами"): FONT ('Bebas Neue Book') использует эта вкладка и Разнарядка — и больше
        // никто в игре, т.е. это первый экран, который реально просит браузер его загрузить.
        // Собираем сюда ВСЕ текстовые объекты этого экрана, использующие FONT — см.
        // scheduleFontRedraw() в конце функции.
        const fontTexts = [];

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки фон экрана.png'));
        bg.x = BG_X; bg.y = BG_Y;
        win.addChild(bg);

        // 27.10.2026 (по прямому указанию — "у заначек должен быть свой выход"): отдельная
        // кнопка выхода экрана Заначки (помимо общей кнопки выхода Сводки), размещена по месту,
        // продиктованному для этого экрана.
        // 28.10.2026 (баг найден по прямому указанию — "при закрытии вкладки заначек почему-то
        // закрывается сама Сводка, такого быть не должно"): раньше звала this.close() — то же
        // самое, что и ОБЩАЯ кнопка выхода Сводки (1240,83, см. svod.js) — то есть на экране было
        // ДВЕ кнопки, обе закрывающие весь Свод целиком. Теперь эта (локальная для вкладки)
        // кнопка просто возвращает на дефолтную вкладку ('respect'), как если бы игрок нажал на
        // таб «Топ по авторитету» — Свод остаётся открытым, закрывает его только общая кнопка.
        const zanachkiExitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        zanachkiExitBtn.scale.set(EXIT_SCALE);
        if(window.isMobile) helper.touchPad(zanachkiExitBtn);
        zanachkiExitBtn.x = EXIT_X; zanachkiExitBtn.y = EXIT_Y;
        zanachkiExitBtn.interactive = true; zanachkiExitBtn.buttonMode = true;
        zanachkiExitBtn.on('pointerover', ()=>{ zanachkiExitBtn.scale.set(EXIT_SCALE * 1.08); });
        zanachkiExitBtn.on('pointerout',  ()=>{ zanachkiExitBtn.scale.set(EXIT_SCALE); });
        zanachkiExitBtn.on('pointerdown', ()=>this._selectMainTab('respect'));
        win.addChild(zanachkiExitBtn);

        // Заголовок "Собрано коллекций N/M" — 28.10.2026 (по прямому указанию, редактор позиций
        // новой боковой панели — "боковая часть (область под кнопки).png", см. svod.js): плашка
        // переехала с правой декоративной рамки (944,111,scale1.355) на новую левую боковую
        // панель — координаты были x:75,y:0 (надпись), x:75,y:16 (счёт).
        // 28.10.2026 (повторное указание тем же днём, редактор позиций — хитбокс "Собрана
        // коллекция" x:971,y:114,w:203,h:25, центрировать по горизонтали): позиция снова
        // смещена — на этот раз правее, назад в область исходной декоративной рамки, но уже
        // явными "прямыми" координатами (не scale-контейнером, как в самой первой версии).
        // fontSize 14→18, strokeThickness 2→1 ("тоньше") — применено чуть раньше в тот же день,
        // не трогается этой правкой.
        // 28.10.2026 (повторное указание, новый замер после живого теста — хитбокс "Собрано
        // коллекций" x:1050,y:114,w:121,h:17, fontSize 16; количества x:1018,y:135,w:64,h:30,
        // fontSize 36; "увеличь жирность на один этап" — fontWeight не был задан вообще,
        // добавлен 'bold' на обе надписи): заменяет предыдущий хитбокс (971/203, 972/138).
        // 28.10.2026 (ещё одно повторное указание тем же днём, финальный замер — хитбокс
        // "Собрано коллекций:" x:1049,y:116,w:108,h:14, fontSize 16 без изменений; "N / 15"
        // x:1047,y:135,w:62,h:31, fontSize 36 без изменений): заменяет предыдущий хитбокс (1050/121, 1018/64).
        // 28.10.2026 (БАГ, исправлено тем же днём после живой проверки — "расположение собрано
        // коллекций не по тем координатам"): x/y из редактора позиций для объекта с
        // anchor(0.5,0) — уже готовые object.x/object.y (редактор двигает текст и показывает его
        // текущие координаты), w/h — чисто информационные (рендер-размер на тот момент), не часть
        // формулы. Предыдущая версия ошибочно прибавляла W/2, уводя текст на полсотни пикселей
        // вправо от заданной точки. x/y используются НАПРЯМУЮ, без хитбокс-констант.
        const labelTxt = new PIXI.Text('Собрано коллекций:', {
            fontFamily: FONT, fontSize: 16, fill: '#ffffff', fontWeight: 'bold',
            stroke: '#000000', strokeThickness: 1, padding: 4,
        });
        labelTxt.anchor.set(0.5, 0);
        labelTxt.x = 1049; labelTxt.y = 116;
        win.addChild(labelTxt);
        fontTexts.push(labelTxt);

        const countTxt = new PIXI.Text('0 / 15', {
            fontFamily: FONT, fontSize: 36, fill: '#ffffff', fontWeight: 'bold',
            stroke: '#000000', strokeThickness: 2, padding: 4,
        });
        countTxt.anchor.set(0.5, 0);
        countTxt.x = 1047; countTxt.y = 135;
        win.addChild(countTxt);
        fontTexts.push(countTxt);
        this._zanachkiLabelTxt = labelTxt;
        this._zanachkiCountTxt = countTxt;

        // "ЗАПРОС ЗАНАЧЕК У ДРУЗЕЙ" — открывает МОЙ собственный список запросов (попап shared
        // с визиткой друга, см. svod-zanachki-wishlist.js).
        const reqBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки кнопка запрос у друзей.png'));
        reqBtn.x = FRIEND_REQ_X; reqBtn.y = FRIEND_REQ_Y;
        reqBtn.interactive = true; reqBtn.buttonMode = true;
        reqBtn.on('pointerover', ()=>{ reqBtn.alpha = 0.8; });
        reqBtn.on('pointerout',  ()=>{ reqBtn.alpha = 1; });
        reqBtn.on('pointerdown', ()=>{
            // 28.10.2026 (по прямому указанию — "пиши также их количество снизу, как у остальных
            // карточек прописаны цифры"): тот же myOwnedCounts, что уже передаётся в режим
            // 'friend' (см. player_profile.js._openFriendStashWishlist) — построен здесь из
            // актуального this._zanachkiState.stashData, т.к. в режиме 'own' сервер отдельно
            // такую карту не присылает (своё состояние уже загружено на этом экране).
            const stashData = (this._zanachkiState && this._zanachkiState.stashData) || {};
            const myOwnedCounts = {};
            Object.keys(stashData).forEach(col => {
                Object.keys(stashData[col] || {}).forEach(pos => {
                    myOwnedCounts[col + '_' + pos] = Number(stashData[col][pos]) || 0;
                });
            });
            this._buildZanachkiWishlistPopup((this._zanachkiState && this._zanachkiState.wishlist) || [], 'own', { myOwnedCounts });
        });
        win.addChild(reqBtn);

        const content = new PIXI.Container();
        content.x = VIEW_X; content.y = VIEW_Y;
        win.addChild(content);

        const cardSprites = {}, countTxts = {}, reqSprites = {}, claimBtns = {};

        for(let col = 1; col <= 15; col++){
            const rowIdx = col - 1;
            const rowY = ROW_Y0 + rowIdx * ROW_H;
            const theme = THEMES[col];
            const nn = String(col).padStart(2, '0');

            const rowBg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки фон ряда коллекции.png'));
            rowBg.x = ROW_X;
            // 28.10.2026 (по прямому указанию — "для самой первой коллекции подними фон ряда
            // выше на 5px"): точечная поправка ТОЛЬКО для фона строки первой коллекции (rowIdx
            // 0) — не трогает карточки/кнопки/текст этого же ряда, они по-прежнему садятся на
            // обычный rowY через CARD_Y_OFF/REQ_Y_OFF и т.д.
            rowBg.y = rowY - (rowIdx === 0 ? 5 : 0);
            content.addChild(rowBg);

            for(let pos = 1; pos <= 7; pos++){
                const idx = pos - 1;
                const key = col + '_' + pos;
                const cardX = CARD_X0 + idx * CARD_PITCH;

                const card = new PIXI.Sprite(PIXI.Texture.from(IMG + `заначка ${nn} ${theme} ${pos}.png`));
                card.x = cardX; card.y = rowY + CARD_Y_OFF;
                content.addChild(card);
                cardSprites[key] = card;

                // 27.10.2026 (баг найден, по прямому указанию — "не пишется количество карточек
                // хотя они есть"): раньше текст был чёрным (#000000) без обводки поверх тёмного
                // фона карточки — рендерился, просто физически не виден на тёмном арте. Белый
                // + чёрная обводка — тот же стиль, что у остальных подписей этого экрана.
                // 28.10.2026 (по прямому указанию — редактор позиций, новое место светлее):
                // опущено на 92px, сдвинуто вправо на 35px, шрифт снова чёрный (теперь на
                // достаточно светлом фоне новой позиции, обводка остаётся чёрной — то же самое,
                // что сплошной чёрный текст без разницы в виде).
                // 28.10.2026 (по прямому указанию — "увеличил фонт сайз и поднял на 1-2px выше"):
                // fontSize 14→18, y -2px.
                // 28.10.2026 (повторное указание тем же днём — "кол-во заначек которые есть у
                // игрока подними вверх на 7px"): y ещё -7px.
                // 28.10.2026 (БАГ, исправлено тем же днём после живой проверки — "ты высоко
                // задёрнул текст, я тебя не просил это делать, опусти на 7px"): та "-7" выше была
                // явным сдвигом ОТНОСИТЕЛЬНО card.y на тот момент. Когда ПОЗЖЕ в тот же день
                // card.y САМ получил свой независимый -7 (через CARD_Y_OFF, см. его объявление
                // выше), countTxt.y унаследовал этот сдвиг автоматически (формула начинается с
                // card.y) — и ПОВЕРХ него всё ещё применялась собственная "-7" отсюда, то есть
                // итоговый подъём текста относительно карточки задвоился (14px вместо 7).
                // Убираем дублирующую "-7" — сдвиг на 7px относительно card теперь даёт только
                // CARD_Y_OFF, как и было изначально задумано для первого запроса.
                const countTxt = new PIXI.Text('0', {
                    fontFamily: 'Southbank LT', fontSize: 18, fill: '#000000',
                    strokeThickness: 0, padding: 4,
                });
                countTxt.anchor.set(0.5, 0);
                countTxt.resolution = Math.max(2, (window.scene && window.scene.renderer && window.scene.renderer.resolution) || 1);
                placeStashCount(countTxt, card);
                content.addChild(countTxt);
                countTxts[key] = countTxt;
                fontTexts.push(countTxt);

                const reqSpr = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки кнопка запросить.png'));
                // 28.10.2026 (БАГ, исправлено тем же днём после живой проверки — "в запросе не
                // центрировано, хотя запросить вроде центрировано"): ни карточки "заначка ...png",
                // ни файлы "запросить"/"в запросе" НЕ входят в прелоад (window._allGamePngs,
                // game-boot.js) — значит в момент синхронной сборки этого экрана их текстуры ещё
                // не загружены, card.width/reqSpr.width читались бы как заглушка (1px), а не
                // реальный размер, и центрирование "на глаз" попадало в цель лишь случайно (когда
                // браузер успевал закэшировать картинку раньше). Теперь используется тот же приём
                // отложенного пересчёта после загрузки, что уже в raznaryadka.js (icon.texture.
                // once('update', ...)) — см. _centerZanachkiReqSpr ниже, переиспользуется и тут, и
                // при смене текстуры в _zanachkiApplyWishlistTextures (вторая текстура тоже может
                // быть не прогрета).
                this._centerZanachkiReqSpr(reqSpr, card);
                reqSpr.y = rowY + REQ_Y_OFF;
                reqSpr.interactive = true; reqSpr.buttonMode = true;
                // 27.10.2026 (по прямому указанию — "сделай hover эффект небольшого скейла при
                // наведении на кнопку запросить"): лёгкий scale-бамп (anchor по умолчанию 0,0 —
                // растёт вправо-вниз, та же простая схема, что dvor.js._ss у некруглых кнопок);
                // отключается вместе с interactive, когда карточка уже в запросе (см.
                // _zanachkiApplyWishlistTextures).
                reqSpr.on('pointerover', ()=>{ if(reqSpr.interactive) reqSpr.scale.set(1.08); });
                reqSpr.on('pointerout',  ()=>{ reqSpr.scale.set(1); });
                reqSpr.on('pointerdown', ()=>{
                    if(reqSpr._requested) return;
                    TS.php('zanachki.requestCard', {collection_id: col, position: pos}, (e) => {
                        if(!e) return;
                        if(this._zanachkiState) this._zanachkiState.wishlist = e.wishlist || [];
                        this._zanachkiApplyWishlistTextures();
                    });
                });
                content.addChild(reqSpr);
                reqSprites[key] = reqSpr;
            }

            // 27.10.2026 (по прямому указанию — "забираться должны они не все, сделать
            // расходуемой"): раньше "Забрать" была одноразовой наградой за коллекцию (один
            // клейм — навсегда заблокировано). Теперь каждый клейм СПИСЫВАЕТ по 1 карте с
            // каждой из 7 позиций и доступен ПОВТОРНО, пока после списания набор снова полон —
            // см. ZanachkiModel::claimCollectionReward(). Полный рефетч состояния вместо
            // точечного патча — проще и надёжнее, чем вручную синхронизировать локальные
            // stashData/claimed после списания карт.
            const claimBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки кнопка забрать.png'));
            claimBtn.x = CLAIM_X; claimBtn.y = rowY + CLAIM_Y_OFF;
            // 28.10.2026 (по прямому указанию — "для кнопки Забрать тоже сделай hover-эффект
            // увеличения"): тот же паттерн, что у reqSpr выше — scale-бамп, гейтится interactive
            // (кнопка неактивна, пока набор не полон, см. _zanachkiRefreshClaims).
            claimBtn.on('pointerover', ()=>{ if(claimBtn.interactive) claimBtn.scale.set(1.08); });
            claimBtn.on('pointerout',  ()=>{ claimBtn.scale.set(1); });
            claimBtn.on('pointerdown', ()=>{
                if(!claimBtn._enabled) return;
                TS.php('zanachki.claimCollection', {collection_id: col}, (e) => {
                    if(!e || !e.patch) return;
                    applyPatch(e.patch);
                    if(window.achievements) achievements._checkAll();
                    this._zanachkiFetchState();
                });
            });
            content.addChild(claimBtn);
            claimBtns[col] = claimBtn;

            // 27.10.2026 (по прямому указанию, репозиция после живого теста): звезда вверх на
            // 3px (STAR_Y_OFF-3), "Награда:" вверх ещё на 30px (была уже -20, стало -50 суммарно).
            const starIcon = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки иконка звезда.png'));
            starIcon.width = 25; starIcon.height = 25;
            starIcon.x = STAR_X; starIcon.y = rowY + STAR_Y_OFF - 3;
            content.addChild(starIcon);

            // Новая иконка "боевка награда сухари.png" над звездой (не было на экране вообще).
            const sukhariIcon = new PIXI.Sprite(PIXI.Texture.from(IMG + 'боевка награда сухари.png'));
            sukhariIcon.width = SUKHARI_ICON_W; sukhariIcon.height = SUKHARI_ICON_H;
            sukhariIcon.x = STAR_X;
            sukhariIcon.y = starIcon.y - SUKHARI_ICON_H - 4;
            content.addChild(sukhariIcon);

            const rewardLabelTxt = new PIXI.Text('Награда:', {
                fontFamily: FONT, fontSize: 15, fill: '#ffffff',
                stroke: '#000000', strokeThickness: 2, padding: 4,
            });
            rewardLabelTxt.x = STAR_X; rewardLabelTxt.y = rowY + STAR_Y_OFF - 50;
            content.addChild(rewardLabelTxt);
            fontTexts.push(rewardLabelTxt);

            // 28.10.2026 (по прямому указанию — редактор позиций для 1-й коллекции + "знак +
            // выглядит не так, посмотри и исправь"): "+" — первый символ строки, strokeThickness
            // без запаса padding в PIXI.TextStyle обрезает canvas ровно по метрикам текста без
            // полей под обводку — у тонких/узких глифов вроде "+" обводка слева/сверху уезжала
            // за край canvas и визуально "срезалась" (тот же класс бага уже чинился похожим
            // padding в interface-currency-purchase.js, TXT_STYLE_BASE). amt — число награды,
            // РАЗНОЕ по коллекциям (см. rewardAmountForCol выше, тот же разброс 50/70/80, что и
            // на сервере в ZanachkiModel::collectionReward()).
            const amt = rewardAmountForCol(col);
            const sukhariRewardTxt = new PIXI.Text('+' + amt + ' сухарей', {
                fontFamily: FONT, fontSize: 16, fill: '#ffffff',
                stroke: '#000000', strokeThickness: 2, padding: 4,
            });
            sukhariRewardTxt.x = STAR_X + 30; sukhariRewardTxt.y = rowY + STAR_Y_OFF - 26;
            content.addChild(sukhariRewardTxt);
            fontTexts.push(sukhariRewardTxt);

            const expRewardTxt = new PIXI.Text('+' + amt + ' опыта', {
                fontFamily: FONT, fontSize: 16, fill: '#ffffff',
                stroke: '#000000', strokeThickness: 2, padding: 4,
            });
            expRewardTxt.x = STAR_X + starIcon.width + 6; expRewardTxt.y = rowY + STAR_Y_OFF + 5;
            content.addChild(expRewardTxt);
            fontTexts.push(expRewardTxt);
        }

        this._zanachkiCardSprites = cardSprites;
        this._zanachkiCountTxts = countTxts;
        this._zanachkiReqSprites = reqSprites;
        this._zanachkiClaimBtns = claimBtns;

        const scroll = this._buildSvodScroll({
            parent: win,
            contentContainer: content,
            viewX: VIEW_X, viewY: VIEW_Y, viewW: VIEW_W, viewH: VIEW_H,
            trackX: TRACK_X, arrowX: ARROW_X,
            trackY: TRACK_Y, arrowUpY: ARROW_UP_Y, arrowDownY: ARROW_DOWN_Y,
            trackImg: 'заначки скролл шкала.png', thumbImg: 'заначки скролл бегунок.png',
            arrowUpImg: 'заначки скролл стрелка вверх.png', arrowDownImg: 'заначки скролл стрелка вниз.png',
            // 28.10.2026 (по прямому указанию — "бегунок сдвинь вправо на 6px").
            thumbXAdjust: 6,
            stepPx: ROW_H,
            getTotalH: () => ROW_Y0 + 15 * ROW_H,
            // 28.10.2026 (по прямому указанию, редактор позиций — бегунок в начале x:1188,y:248,
            // в конце x:1188,y:450): физический диапазон движения не совпадает с track.y/
            // track.height (трек "заначки скролл шкала.png" начинается на TRACK_Y=203, что выше
            // желаемого верха 248) — см. thumbTravelTop/thumbTravelBottom в svod-scroll.js.
            thumbTravelTop: 248, thumbTravelBottom: 450,
        });
        this._zanachkiScroll = scroll;

        win._svodDefaultScope = () => this._zanachkiFetchState();

        scheduleFontRedraw("16px '" + FONT + "'", fontTexts);

        this._zanachkiWin = win;
        return win;
    };

    proto._zanachkiFetchState = function(){
        TS.php('zanachki.getState', {}, (e) => {
            if(!e || !e.patch){
                if(window.notify) notify.showResult({text: 'Не удалось загрузить заначки'}, 0);
                return;
            }
            applyPatch(e.patch);
            this._zanachkiState = {
                stashData: e.stashData || {},
                claimed: e.claimed || {},
                wishlist: e.wishlist || [],
                collectedCount: e.collectedCount || 0,
            };
            this._zanachkiApplyCounts();
            this._zanachkiApplyWishlistTextures();
            this._zanachkiRefreshClaims();
            this._zanachkiRefreshHeader();
            if(this._zanachkiScroll) this._zanachkiScroll.refresh();
        }, () => {
            if(window.notify) notify.showResult({text: 'Раздел временно недоступен'}, 0);
        });
    };

    proto._zanachkiApplyCounts = function(){
        const state = this._zanachkiState;
        if(!state) return;
        for(let col = 1; col <= 15; col++){
            for(let pos = 1; pos <= 7; pos++){
                const key = col + '_' + pos;
                const count = Number((state.stashData[col] && state.stashData[col][pos]) || 0);
                const txt = this._zanachkiCountTxts[key];
                // 28.10.2026 (по прямому указанию — "на заначках, которых у игрока нет, пиши
                // ноль, чтобы игрок понимал сколько у него этих заначек, а то сейчас просто
                // пусто, ничего не понятно"): было count>0?String(count):'' — пустая строка при
                // нуле. Теперь число показывается всегда, включая 0.
                if(txt) txt.text = String(count);
            }
        }
    };

    proto._zanachkiApplyWishlistTextures = function(){
        const state = this._zanachkiState;
        if(!state) return;
        const wishSet = {};
        (state.wishlist || []).forEach(it => { wishSet[Number(it.col) + '_' + Number(it.pos)] = true; });
        for(let col = 1; col <= 15; col++){
            for(let pos = 1; pos <= 7; pos++){
                const key = col + '_' + pos;
                const spr = this._zanachkiReqSprites[key];
                if(!spr) continue;
                const requested = !!wishSet[key];
                spr._requested = requested;
                spr.texture = PIXI.Texture.from(IMG + (requested ? 'заначки статус в запросе.png' : 'заначки кнопка запросить.png'));
                spr.interactive = !requested;
                spr.buttonMode = !requested;
                spr.alpha = requested ? 1 : 1;
                spr.scale.set(1); // сброс hover-скейла — текстура сменилась, pointerout мог не сработать
                // 28.10.2026 (см. комментарий у _centerZanachkiReqSpr ниже): новая текстура
                // ("в запросе") может быть ещё не загружена (не входит в прелоад) и/или иметь
                // другую нативную ширину, чем "запросить" — пересчитываем центрирование заново
                // при каждой смене текстуры, не полагаясь на x, выставленный при создании.
                const card = this._zanachkiCardSprites && this._zanachkiCardSprites[key];
                if(card) this._centerZanachkiReqSpr(spr, card);
            }
        }
    };

    // 28.10.2026 (общий хелпер для центрирования reqSpr по X относительно card — см. оба места
    // использования: создание в _buildZanachkiPanel и смена текстуры в
    // _zanachkiApplyWishlistTextures). Ни карточки, ни кнопки запроса не в прелоаде — тот же
    // приём отложенного пересчёта после загрузки, что уже применяется в raznaryadka.js
    // (icon.texture.once('update', ...)): если текстура уже загружена (width>1) — центрируем
    // сразу, иначе ждём события 'update' и центрируем тогда. Оба источника (card и spr)
    // проверяются независимо — какая бы из двух текстур ни догрузилась позже, финальный пересчёт
    // всё равно использует актуальные размеры обеих.
    proto._centerZanachkiReqSpr = function(spr, card){
        const apply = () => { spr.x = card.x + card.width / 2 - spr.width / 2; };
        if(card.texture.width > 1) apply(); else card.texture.once('update', apply);
        if(spr.texture.width > 1) apply(); else spr.texture.once('update', apply);
    };

    // 27.10.2026 (по прямому указанию — клейм стал расходуемым, см. коммент у claimBtn выше):
    // кнопка активна ровно когда набор полон, НЕЗАВИСИМО от того, забирали ли эту коллекцию
    // раньше (claimed теперь используется только для заголовка — "сколько коллекций забирались
    // хотя бы раз", см. _zanachkiRefreshHeader).
    proto._zanachkiRefreshClaims = function(){
        const state = this._zanachkiState;
        if(!state) return;
        for(let col = 1; col <= 15; col++){
            const btn = this._zanachkiClaimBtns[col];
            if(!btn) continue;
            const complete = isCollectionComplete(state.stashData, col);
            btn._enabled = complete;
            btn.interactive = complete;
            btn.buttonMode = complete;
            btn.alpha = complete ? 1 : 0.5;
        }
    };

    proto._zanachkiRefreshHeader = function(){
        const state = this._zanachkiState;
        if(!state || !this._zanachkiCountTxt) return;
        this._zanachkiCountTxt.text = String(state.collectedCount || 0) + ' / 15';
    };
}

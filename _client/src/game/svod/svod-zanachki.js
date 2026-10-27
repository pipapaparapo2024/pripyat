import { applyPatch } from '../../modules/patch.js';

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
const ROW_H = 125;
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
const CARD_Y_OFF = 197 - VIEW_Y;      // смещение карточки от верха строки
const REQ_X0 = 132 - VIEW_X, REQ_Y_OFF = 288 - VIEW_Y;
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

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки фон экрана.png'));
        bg.x = BG_X; bg.y = BG_Y;
        win.addChild(bg);

        // 27.10.2026 (по прямому указанию — "у заначек должен быть свой выход"): отдельная
        // кнопка выхода экрана Заначки (помимо общей кнопки выхода Сводки) — делает то же самое
        // (закрывает весь Свод), просто размещена по месту, продиктованному для этого экрана.
        const zanachkiExitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        zanachkiExitBtn.scale.set(EXIT_SCALE);
        if(window.isMobile) helper.touchPad(zanachkiExitBtn);
        zanachkiExitBtn.x = EXIT_X; zanachkiExitBtn.y = EXIT_Y;
        zanachkiExitBtn.interactive = true; zanachkiExitBtn.buttonMode = true;
        zanachkiExitBtn.on('pointerover', ()=>{ zanachkiExitBtn.alpha = 0.75; });
        zanachkiExitBtn.on('pointerout',  ()=>{ zanachkiExitBtn.alpha = 1; });
        zanachkiExitBtn.on('pointerdown', ()=>this.close());
        win.addChild(zanachkiExitBtn);

        // Заголовок "Собрано коллекций N/M" — 27.10.2026 (по прямому указанию, репозиция по
        // скрину-референсу плашки): ДВА отдельных блока — надпись "Собрано коллекций:" и счёт
        // "N / 15" под ней, не один текст с переносом строки, как было раньше. Хитбокс плашки
        // (редактор позиций) x:944,y:111,scale:1.355,w:206,h:61 — контейнер ставится в эту
        // точку целиком с этим scale, оба текста — его дети в НЕмасштабированных локальных
        // координатах (ширина плашки до масштабирования = 206).
        const headerCont = new PIXI.Container();
        headerCont.x = 944; headerCont.y = 111;
        headerCont.scale.set(1.355);
        win.addChild(headerCont);

        const labelTxt = new PIXI.Text('Собрано коллекций:', {
            fontFamily: FONT, fontSize: 14, fill: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        });
        labelTxt.anchor.set(0.5, 0);
        labelTxt.x = 103; labelTxt.y = 0;
        headerCont.addChild(labelTxt);

        const countTxt = new PIXI.Text('0 / 15', {
            fontFamily: FONT, fontSize: 28, fill: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        });
        countTxt.anchor.set(0.5, 0);
        countTxt.x = 103; countTxt.y = 22;
        headerCont.addChild(countTxt);
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
            this._buildZanachkiWishlistPopup((this._zanachkiState && this._zanachkiState.wishlist) || [], 'own', {});
        });
        win.addChild(reqBtn);

        const content = new PIXI.Container();
        content.x = VIEW_X; content.y = VIEW_Y;
        win.addChild(content);

        const cardSprites = {}, countTxts = {}, reqSprites = {}, claimBtns = {};

        for(let col = 1; col <= 15; col++){
            const rowIdx = col - 1;
            const rowY = rowIdx * ROW_H;
            const theme = THEMES[col];
            const nn = String(col).padStart(2, '0');

            const rowBg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки фон ряда коллекции.png'));
            rowBg.x = ROW_X; rowBg.y = rowY;
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
                const countTxt = new PIXI.Text('', {
                    fontFamily: FONT, fontSize: 14, fill: '#ffffff',
                    stroke: '#000000', strokeThickness: 2,
                });
                countTxt.anchor.set(0.5, 0);
                countTxt.x = cardX + card.width / 2;
                countTxt.y = card.y + card.height - 18;
                content.addChild(countTxt);
                countTxts[key] = countTxt;

                const reqX = REQ_X0 + idx * CARD_PITCH;
                const reqSpr = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки кнопка запросить.png'));
                reqSpr.x = reqX; reqSpr.y = rowY + REQ_Y_OFF;
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
            claimBtn.on('pointerdown', ()=>{
                if(!claimBtn._enabled) return;
                TS.php('zanachki.claimCollection', {collection_id: col}, (e) => {
                    if(!e || !e.patch) return;
                    applyPatch(e.patch);
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
                stroke: '#000000', strokeThickness: 2,
            });
            rewardLabelTxt.x = STAR_X; rewardLabelTxt.y = rowY + STAR_Y_OFF - 50;
            content.addChild(rewardLabelTxt);

            // 27.10.2026 (по прямому указанию — "это должны быть две разные надписи"): раньше
            // был один текст "+50 сухарей  +50 опыта" — разделён на 2 отдельных PIXI.Text.
            // "+50 сухарей" поднята на 20px, "+50 опыта" — правее файла "заначки иконка звезда".
            const sukhariRewardTxt = new PIXI.Text('+50 сухарей', {
                fontFamily: FONT, fontSize: 15, fill: '#ffffff',
                stroke: '#000000', strokeThickness: 2,
            });
            sukhariRewardTxt.x = STAR_X + 30; sukhariRewardTxt.y = rowY + STAR_Y_OFF + 2 - 20;
            content.addChild(sukhariRewardTxt);

            const expRewardTxt = new PIXI.Text('+50 опыта', {
                fontFamily: FONT, fontSize: 15, fill: '#ffffff',
                stroke: '#000000', strokeThickness: 2,
            });
            expRewardTxt.x = STAR_X + starIcon.width + 6; expRewardTxt.y = starIcon.y;
            content.addChild(expRewardTxt);
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
            stepPx: ROW_H,
            getTotalH: () => 15 * ROW_H,
        });
        this._zanachkiScroll = scroll;

        win._svodDefaultScope = () => this._zanachkiFetchState();

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
                if(txt) txt.text = count > 0 ? String(count) : '';
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
            }
        }
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

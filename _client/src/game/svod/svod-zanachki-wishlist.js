/** Попап списка запросов заначек у друзей (26.10.2026, фича "Заначки") — ОДНА общая функция-
 * билдер для двух контекстов (по прямому указанию, чтобы не дублировать разметку):
 *  - mode:'own'    — мой собственный список запросов, открывается кнопкой "ЗАПРОС ЗАНАЧЕК
 *    У ДРУЗЕЙ" на экране Заначки (svod-zanachki.js). Каждый слот — карточка + "УБРАТЬ".
 *  - mode:'friend'  — список запросов ДРУГОГО игрока, открывается кнопкой "ПРОСЬБА ЗАНАЧЕК"
 *    на визитке друга (player_profile.js). Каждый слот — карточка + "ДАТЬ" (активна только
 *    если у меня есть хотя бы 1 копия этой карточки — ctx.myOwnedCounts).
 *
 * ⚠️ Нет отдельного ассета под "ДАТЬ" (только "заначки кнопка убрать.png" с вшитым текстом
 * "УБРАТЬ") — по прямому указанию 26.10.2026 временно переиспользуем ту же плашку, накладывая
 * свой PIXI.Text "ДАТЬ" поверх вшитого текста. Пользователь пришлёт отдельный файл позже —
 * тогда заменить giveBtnFile на новую текстуру и убрать текстовую накладку.
 */
const FONT = 'Bebas Neue Book';

const THEMES = {
    1: 'граната', 2: 'кассета', 3: 'открытка', 4: 'зажигалка', 5: 'баллончик',
    6: 'трубка', 7: 'кость', 8: 'фишка', 9: 'шахматы', 10: 'медальон',
    11: 'монета', 12: 'звезда', 13: 'пистолет', 14: 'автомат', 15: 'нож',
};

// Координаты продиктованы пользователем 26.10.2026 (окно запроса — "заначки окно запроса
// фон.png", 857×234): попап x:210,y:173; слот 1 карточки x:263,y:254, слот 2 x:373,y:254
// (шаг 110px); кнопка под слотом 1 x:253,y:349 (тот же шаг по X). Максимум 7 слотов.
const POPUP_X = 210, POPUP_Y = 173;
const ITEM_X0 = 263, ITEM_Y0 = 254, ITEM_PITCH = 110;
const ACTION_X0 = 253, ACTION_Y0 = 349;
const MAX_SLOTS = 7;
// 27.10.2026 (по прямому указанию, обновлено тем же днём): заголовок раньше был ОДНИМ общим
// файлом ("заначки окно запроса заголовок.png", бывший "Слой 345.png") для обоих режимов —
// теперь это ДВЕ разные надписи в зависимости от контекста: "ТВОЙ ЗАПРОС В ЗАНАЧКАХ"
// (mode:'own', бывший "Слой 345.png" — переснят) и "ЗАПРОС ДРУГА В ЗАНАЧКАХ" (mode:'friend',
// бывший "Слой 348.png"). Позиция — абсолютная x:455,y:193 (надиктована редактором позиций),
// не вычисляемая по центру попапа, как раньше. Кнопка выхода попапа — отдельная точка (была
// общая 1240,83) — x:1029,y:154,scale:0.839.
const TITLE_OWN_IMG = 'заначки окно запроса заголовок твой запрос.png';
const TITLE_FRIEND_IMG = 'заначки окно запроса заголовок запрос друга.png';
const TITLE_X = 455, TITLE_Y = 193;
const WISHLIST_EXIT_X = 1029, WISHLIST_EXIT_Y = 154, WISHLIST_EXIT_SCALE = 0.839;

export function attachSvodZanachkiWishlist(proto){
    const IMG = './images/';

    // items: [{col,pos}, ...] (максимум 7, лишнее обрезается)
    // mode: 'own' | 'friend'
    // ctx: для 'friend' — { targetId, myOwnedCounts: {"col_pos": count} }
    proto._buildZanachkiWishlistPopup = function(items, mode, ctx){
        ctx = ctx || {};
        if(this._zanachkiWishlistWin && this._zanachkiWishlistWin.parent){
            this._zanachkiWishlistWin.parent.removeChild(this._zanachkiWishlistWin);
        }

        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки окно запроса фон.png'));
        bg.x = POPUP_X; bg.y = POPUP_Y;
        win.addChild(bg);

        const titleSpr = new PIXI.Sprite(PIXI.Texture.from(IMG + (mode === 'friend' ? TITLE_FRIEND_IMG : TITLE_OWN_IMG)));
        titleSpr.x = TITLE_X; titleSpr.y = TITLE_Y;
        win.addChild(titleSpr);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        exitBtn.scale.set(WISHLIST_EXIT_SCALE);
        if(window.isMobile) helper.touchPad(exitBtn);
        exitBtn.x = WISHLIST_EXIT_X; exitBtn.y = WISHLIST_EXIT_Y;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ exitBtn.scale.set(WISHLIST_EXIT_SCALE * 1.08); });
        exitBtn.on('pointerout',  ()=>{ exitBtn.scale.set(WISHLIST_EXIT_SCALE); });
        exitBtn.on('pointerdown', ()=>{
            if(win.parent) win.parent.removeChild(win);
            if(this._zanachkiWishlistWin === win) this._zanachkiWishlistWin = null;
        });
        win.addChild(exitBtn);

        (items || []).slice(0, MAX_SLOTS).forEach((item, idx) => {
            const col = Number(item.col), pos = Number(item.pos);
            const theme = THEMES[col];
            if(!theme) return;
            const nn = String(col).padStart(2, '0');

            const cardX = ITEM_X0 + idx * ITEM_PITCH;
            const card = new PIXI.Sprite(PIXI.Texture.from(IMG + `заначка ${nn} ${theme} ${pos}.png`));
            card.x = cardX; card.y = ITEM_Y0;
            win.addChild(card);

            // 28.10.2026 (по прямому указанию — "пиши также их количество снизу, как у
            // остальных карточек прописаны цифры", подтверждено: показывать кол-во копий,
            // которые есть у МЕНЯ сейчас, тот же мехнизм/стиль, что countTxt в основной сетке
            // svod-zanachki.js, строка тоньше — strokeThickness 1 вместо 2 по прямому указанию).
            const key = col + '_' + pos;
            const owned = Number((ctx.myOwnedCounts && ctx.myOwnedCounts[key]) || 0);
            const countTxt = new PIXI.Text(String(owned), {
                fontFamily: FONT, fontSize: 14, fill: '#000000',
                stroke: '#000000', strokeThickness: 1, padding: 4,
            });
            countTxt.anchor.set(0.5, 0);
            countTxt.x = cardX + card.width / 2;
            countTxt.y = card.y + card.height + 4;
            win.addChild(countTxt);

            const actionX = ACTION_X0 + idx * ITEM_PITCH;
            const actionBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'заначки кнопка убрать.png'));
            actionBtn.x = actionX; actionBtn.y = ACTION_Y0;
            win.addChild(actionBtn);

            if(mode === 'own'){
                actionBtn.interactive = true; actionBtn.buttonMode = true;
                actionBtn.on('pointerover', ()=>{ actionBtn.alpha = 0.8; });
                actionBtn.on('pointerout',  ()=>{ actionBtn.alpha = 1; });
                actionBtn.on('pointerdown', ()=>{
                    TS.php('zanachki.cancelRequest', {collection_id: col, position: pos}, (e) => {
                        if(!e) return;
                        if(this._zanachkiState) this._zanachkiState.wishlist = e.wishlist || [];
                        if(typeof this._zanachkiApplyWishlistTextures === 'function') this._zanachkiApplyWishlistTextures();
                        this._buildZanachkiWishlistPopup(e.wishlist || [], 'own', { myOwnedCounts: ctx.myOwnedCounts });
                    });
                });
            } else {
                // mode === 'friend' — "ДАТЬ" вместо "УБРАТЬ" (см. докблок файла про
                // отсутствующий ассет): PIXI.Text поверх той же плашки.
                const giveLbl = new PIXI.Text('ДАТЬ', {
                    fontFamily: FONT, fontSize: 15, fill: '#ffffff',
                    stroke: '#000000', strokeThickness: 2,
                });
                giveLbl.anchor.set(0.5, 0.5);
                giveLbl.x = actionX + actionBtn.width / 2;
                giveLbl.y = ACTION_Y0 + actionBtn.height / 2;
                win.addChild(giveLbl);

                // key/owned уже посчитаны выше (для countTxt) — переиспользуются здесь как есть.
                if(owned > 0){
                    actionBtn.interactive = true; actionBtn.buttonMode = true;
                    actionBtn.on('pointerover', ()=>{ actionBtn.alpha = 0.8; });
                    actionBtn.on('pointerout',  ()=>{ actionBtn.alpha = 1; });
                    actionBtn.on('pointerdown', ()=>{
                        TS.php('zanachki.giveCard', {target_id: ctx.targetId, collection_id: col, position: pos}, (e) => {
                            if(!e || !e.patch) return;
                            applyPatch(e.patch);
                            const remaining = (items || []).filter(it => !(Number(it.col) === col && Number(it.pos) === pos));
                            this._buildZanachkiWishlistPopup(remaining, 'friend', ctx);
                        });
                    });
                } else {
                    actionBtn.alpha = 0.4;
                }
            }
        });

        this._zanachkiWishlistWin = win;
        root.layer2_mc.addChild(win);
        return win;
    };
}

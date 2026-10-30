/** Попап списка запросов заначек у друзей (26.10.2026, фича "Заначки") — ОДНА общая функция-
 * билдер для двух контекстов (по прямому указанию, чтобы не дублировать разметку):
 *  - mode:'own'    — мой собственный список запросов, открывается кнопкой "ЗАПРОС ЗАНАЧЕК
 *    У ДРУЗЕЙ" на экране Заначки (svod-zanachki.js). Каждый слот — карточка + "УБРАТЬ".
 *  - mode:'friend'  — список запросов ДРУГОГО игрока, открывается кнопкой "ПРОСЬБА ЗАНАЧЕК"
 *    на визитке друга (player_profile.js). Каждый слот — карточка + "ОТПРАВИТЬ" (активна только
 *    если у меня есть хотя бы 1 копия этой карточки — ctx.myOwnedCounts).
 *
 * 28.10.2026 (по прямому указанию — файл "отправить.png" прислан): реальный ассет с вшитым
 * текстом "ОТПРАВИТЬ" (переименован в "заначки кнопка отправить.png" во избежание коллизии с
 * универсальным именем, см. ПРАВИЛО про коллизии ассетов в AGENTS.md) заменил временную плашку
 * "заначки кнопка убрать.png" + PIXI.Text "ДАТЬ" поверх — текстовая накладка больше не нужна.
 */
import { applyPatch } from '../../modules/patch.js';
import { placeStashCount } from '../../modules/stash-count-layout.js';
import { scheduleFontRedraw } from '../../modules/font-ready.js';

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
        if(mode === 'friend' && ctx.parentWin && !ctx.parentWin.parent) return null;
        if(this._zanachkiWishlistWin && this._zanachkiWishlistWin.parent){
            this._zanachkiWishlistWin.parent.removeChild(this._zanachkiWishlistWin);
        }

        const win = new PIXI.Container();
        win.interactive = true;
        const countTexts = [];

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
        exitBtn.on('pointerdown', (event)=>{
            if(event && event.stopPropagation) event.stopPropagation();
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

            const actionX = ACTION_X0 + idx * ITEM_PITCH;
            // 28.10.2026 (по прямому указанию): mode:'friend' теперь использует реальный ассет
            // "заначки кнопка отправить.png" (вшитый текст "ОТПРАВИТЬ"), не переиспользует
            // "убрать.png" — см. докблок файла.
            const actionBtnFile = mode === 'own' ? 'заначки кнопка убрать.png' : 'заначки кнопка отправить.png';
            const actionBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + actionBtnFile));
            actionBtn.x = actionX; actionBtn.y = ACTION_Y0;
            win.addChild(actionBtn);

            // 28.10.2026 (по прямому указанию — "пиши также их количество снизу, как у
            // остальных карточек прописаны цифры", подтверждено: показывать кол-во копий,
            // которые есть у МЕНЯ сейчас, тот же мехнизм/стиль, что countTxt в основной сетке
            // svod-zanachki.js, строка тоньше — strokeThickness 1 вместо 2 по прямому указанию).
            const key = col + '_' + pos;
            const owned = Number((ctx.myOwnedCounts && ctx.myOwnedCounts[key]) || 0);
            // 28.10.2026 (баг найден по прямому указанию, тем же днём — "не видно количество"):
            // исходная позиция (card.y + card.height + 4) оказалась ВНУТРИ actionBtn — карточка
            // "заначка ...png" высотой 93px при ITEM_Y0=254 кончается на y=347, а actionBtn
            // начинается на ACTION_Y0=349 (зазор всего 2px, текста там физически не поместить),
            // и т.к. actionBtn добавлялся в `win` РАНЬШЕ countTxt, число рисовалось под кнопкой и
            // было полностью перекрыто её спрайтом. Перенесено НИЖЕ кнопки.
            // 28.10.2026 (повторное указание тем же днём, по скриншоту референса — "дай ему те же
            // характеристики текста, что у количества значек которые есть у меня: fontSize 18,
            // чёрный шрифт, Southbank LT; подними на 47px"): шрифт/цвет сменены на запрошенные
            // (были Bebas Neue Book 14 белый), позиция поднята на 47px от варианта "под кнопкой"
            // — садится у нижнего края самой карточки. Применяется к обоим режимам (own/friend),
            // как и попросили явно.
            const countTxt = new PIXI.Text(String(owned), {
                fontFamily: 'Southbank LT', fontSize: 18, fill: '#000000',
                strokeThickness: 0, padding: 4,
            });
            countTxt.anchor.set(0.5, 0);
            countTxt.resolution = Math.max(2, (window.scene && window.scene.renderer && window.scene.renderer.resolution) || 1);
            countTexts.push(countTxt);
            win.addChild(countTxt);
            // 28.10.2026 (баг найден по прямому указанию — "зашёл первый раз, цифры стояли
            // правильно, вышел, зашёл снова — опустились вниз", повторно пойман тем же днём уже
            // как "после нажатия на убрать/отправить цифры съезжают вниз"): позиция зависела от
            // actionBtn.height В МОМЕНТ построения попапа, а "заначки кнопка убрать/отправить.png"
            // нигде не прелоадятся (ПРАВИЛО №11) — при первой загрузке текстура ещё не готова,
            // sprite.height читается как placeholder (~1px), после кэширования (происходит как
            // раз к моменту пересборки попапа после клика убрать/отправить — сервер успевает
            // ответить позже, чем догружается картинка) — как реальная высота кнопки (27-29px).
            // Один и тот же код давал РАЗНЫЙ результат в зависимости от того, успела ли картинка
            // закэшироваться: на лёгкой заглушке (~1px) число попадало на светлый низ карточки
            // (видно), на реальной высоте (27-29px) — ниже, на тёмный фон попапа/поверх кнопки
            // (чёрная заливка+чёрная обводка текста там практически не видна — тот же стиль, что
            // и у countTxt основной сетки, см. svod-zanachki.js, там это не баг, потому что число
            // там всегда остаётся на светлой карточке).
            // Фикс в ДВЕ части:
            //  1) формула больше НЕ зависит от результата гонки — тот же паттерн, что уже применён
            //     для reqSpr в svod-zanachki.js (_centerZanachkiReqSpr): пересчитывать позицию,
            //     когда текстура реально готова, не полагаться на синхронное чтение .height сразу;
            //  2) own и friend ВОЗВРАЩЕНЫ на ОДНУ общую формулу (попытка развести их по режимам
            //     раньше этим же днём была ошибкой диагностики — визуальная разница между
            //     скриншотами была следствием гонки текстуры, а не разного желаемого места для
            //     двух режимов; общая формула означает один-единственный набор чисел, который
            //     нужно крутить, а не два расходящихся — отдельный источник путаницы, на который
            //     прямо указал пользователь).
            placeStashCount(countTxt, card, actionBtn, mode === 'friend');

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
                // mode === 'friend' — "ОТПРАВИТЬ" (key/owned уже посчитаны выше для countTxt,
                // переиспользуются здесь как есть).
                if(owned > 0){
                    actionBtn.interactive = true; actionBtn.buttonMode = true;
                    actionBtn.on('pointerover', ()=>{ actionBtn.alpha = 0.8; });
                    actionBtn.on('pointerout',  ()=>{ actionBtn.alpha = 1; });
                    actionBtn.on('pointerdown', ()=>{
                        // 28.10.2026 (баг найден по прямому указанию — "нажимаем ОТПРАВИТЬ, ничего
                        // не происходит, потом экран заначек зависает"): здесь не передавался 4-й
                        // (error) колбэк TS.php — при fail-ответе сервера (карточку уже кто-то забрал
                        // первым, 98; у меня её больше нет, 97; и т.п.) игрок не видел НИЧЕГО, кнопка
                        // выглядела сломанной. Плюс critical — applyPatch(e.patch) выше падал
                        // ReferenceError (функция не была импортирована в этом файле, см. import
                        // наверху), что и давало ощущение "зависания" — необработанное исключение
                        // внутри pointerdown-хендлера PIXI.
                        TS.php('zanachki.giveCard', {target_id: ctx.targetId, collection_id: col, position: pos}, (e) => {
                            if(!e || !e.patch) return;
                            applyPatch(e.patch);
                            const remaining = (items || []).filter(it => !(Number(it.col) === col && Number(it.pos) === pos));
                            this._buildZanachkiWishlistPopup(remaining, 'friend', ctx);
                        }, (err) => {
                            const text = err && err.code === 101 ? 'Этому другу можно отправить не больше 10 заначек в сутки' : 'Не удалось отправить заначку. Попробуйте ещё раз';
                            if(window.notify) notify.showResult({text}, 0);
                        });
                    });
                } else {
                    actionBtn.alpha = 0.4;
                }
            }
        });

        this._zanachkiWishlistWin = win;
        if(countTexts.length) scheduleFontRedraw("18px 'Southbank LT'", countTexts);
        (mode === 'friend' && ctx.parentWin ? ctx.parentWin : root.layer2_mc).addChild(win);
        return win;
    };
}

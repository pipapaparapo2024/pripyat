/**
 * Попап результата боя с боссом (победа/поражение) — новый дизайн (18.09.2026, по PSD
 * "боевка-боссы (4).psd", группа "попап выигрыша/проигрыша"), заменяет собой общий
 * iface._showRewardPopup() ТОЛЬКО для боссов (тот попап остаётся как есть для зоны/ящика/
 * хабара/рюкзака — см. reward.js).
 *
 * Координаты фона/портрета/кнопок "ещё раз"/"рассказать"/баннера победил-проиграл/иконки
 * шмотки сняты ТОЧНО из Photoshop (Свойства → X/Y слоя, натуральный размер файла, без
 * растяжения). Координаты аватаров "УЧАСТНИКИ БОЯ", строк "ТОП УРОНА", имени босса и сумм
 * наград координат отдельными числами не получили — измерены приблизительно по мокапу
 * (боевка попап фон.png) и уточнены по референс-скриншоту 18.09.2026 (имя босса чёрными
 * чернилами на плашке ПОРТРЕТА, "ТОП УРОНА" — места 4-9 текстом "N. НИК - УРОНk", суммы
 * наград — СПРАВА от иконок, а не под ними). Это всё равно APPROX и потребует подгонки
 * через универсальный редактор позиций, как и другие подобные случаи в проекте (см.
 * gambling-reward-highlight.test.js).
 */
import { formatAchNum } from '../../../modules/achievement-tiers.js';
import { BOSS_SHMOT_REWARD_IMAGE, BOSS_SHMOT_REWARD_FRAME, BOSS_SHMOT_NOT_OBTAINED } from '../../../modules/boss-shmot-images.js';

export function attachBossResultPopup(proto){
    const BASE = './images/';

    const BOSS_PORTRAITS = [
        'боевка попап охотник.png',
        'боевка попап счастливчик.png',
        'боевка попап ястреб.png',
        'боевка попап меченный.png',
        'боевка попап крыс.png',
        'боевка попап баркут.png',
        'боевка попап борода.png',
        'боевка попап жгут.png',
    ];

    // Точные координаты из PSD (X/Y слоя в Photoshop) — top-left, натуральный размер файла.
    const BG_POS       = { x: 0,   y: 0   };
    const PORTRAIT_POS = { x: 414, y: 225 };
    const AGAIN_BTN_POS= { x: 435, y: 453 };
    const BANNER_POS   = { x: 478, y: 112 };
    const SHARE_BTN_POS= { x: 536, y: 606 };
    const SHMOT_POS    = { x: 813, y: 275 };

    // 26.09.2026 (по прямому указанию — снято редактором позиций): при наведении на иконку
    // шмотки-награды открывается рамка с реальной картинкой выбитой вещи (вместо текстовой
    // подсказки, которая была раньше) — та же идея, что и в новом экране "ВОЗМОЖНАЯ НАГРАДА"
    // перед боем (bosses_prefight.js), тот же общий модуль modules/boss-shmot-images.js.
    const SHMOT_HOVER_FRAME_POS = { x: 860, y: 244 };
    // 26.09.2026 (уточнено редактором позиций повторно): картинка предмета — фиксированный
    // размер 91×88 ДЛЯ ЛЮБОЙ шмотки (по прямому указанию — "в целом это для любой шмотки так
    // сделай"), т.к. исходники в этой папке разного нативного размера — тот же приём, что и
    // единый scale карусели "ВОЗМОЖНАЯ НАГРАДА" (bosses_prefight.js).
    const SHMOT_HOVER_ITEM_POS  = { x: 903, y: 256 };
    const SHMOT_HOVER_ITEM_W = 91, SHMOT_HOVER_ITEM_H = 88;
    // 26.09.2026 (по прямому указанию, уточнено повторно тем же днём — "просто если человек
    // выбил шмотку [целую вещь], не выводить файл не получено"): оверлей "не получено" остаётся
    // для случая прогресса фрагмента (isObtained=false) — просто ГАРАНТИРОВАННО не показывается,
    // когда выпала целая вещь (isObtained=true). Позиция/размер — на своей отдельной точке,
    // крупнее и не совпадает с картинкой предмета.
    const SHMOT_HOVER_NOT_OBTAINED_POS = { x: 867, y: 223 };
    const SHMOT_HOVER_NOT_OBTAINED_W = 169, SHMOT_HOVER_NOT_OBTAINED_H = 142;

    // 26.09.2026 (по прямому указанию — "при наведении на шмотку показывает также её описание,
    // и что выбито", уточнено тем же днём — "сделай так же, как сейчас сделано описание во
    // вкладке шмотки при наведении"): та же карточка-тултип, что и в магазине шмоток
    // (shmot_shop.js._showShopTip — светлая карточка, заголовок #ac3b26, лейблы #2a2118,
    // значения #ac5238, пунктирный разделитель), построена здесь напрямую (не тот же
    // this._shopTipCard — он принадлежит отдельному экрану магазина). Позиция — approx под
    // рамкой (не снята редактором позиций отдельно), потребует подгонки при необходимости.
    const SHMOT_HOVER_DESC_POS = { x: 780, y: 340 };
    const SHMOT_HOVER_DESC_W   = 220;

    // Имя босса — на беж-плашке, вшитой в САМ файл портрета (верхние ~35% кадра любого из
    // BOSS_PORTRAITS), поэтому считаем координату ОТНОСИТЕЛЬНО портрета, а не абсолютной
    // константой — так она остаётся верной для портретов чуть разного размера/пропорций.
    // Значение — точный снимок пользователя через редактор позиций 19.09.2026 (было 36, стало 33).
    const NAME_OFFSET = { x: 78, y: 33 };

    // Точные координаты подписей суммы наград — сняты пользователем через редактор позиций
    // 19.09.2026 (было приблизительно по мокапу, теперь live-координаты каждой подписи).
    const REWARD_LABEL_POS = {
        cig:     { x: 617, y: 296 },
        ryukzak: { x: 705, y: 296 },
        exp:     { x: 782, y: 296 },
    };

    // 22.09.2026 (повторный снимок редактора позиций тем же днём — "делай иконки игроков...
    // вот таким размером в таком месте"): снят на 2-м (среднем) слоте — top-left x:692 y:390,
    // w:67 h:71 (было 67×67 квадрат, стало прямоугольник чуть выше). Центр слота 2 = (692+67/2,
    // 390+71/2) = (725.5, 425.5); дельта от старого центра (722,420) — (+3.5, +5.5) — применена
    // одинаково ко всем трём слотам (сохраняет прежний равномерный шаг между аватарами).
    const AVATAR_SLOTS = [
        { x: 623.5, y: 425.5 },
        { x: 725.5, y: 425.5 },
        { x: 828.5, y: 425.5 },
    ];
    const AVATAR_W = 67;
    const AVATAR_H = 71;

    // 22.09.2026 (по прямому указанию): если реальных участников боя меньше 3 (например,
    // вдвоём завалили босса), пустые места 1-3 в "УЧАСТНИКИ БОЯ" заполняются одним из этих
    // трёх портретов-заглушек (загружены пользователем — "фотки сталкеров.psd"), а не остаются
    // пустой/чёрной рамкой. Распределение фиксированное по индексу слота (не рандом) — так
    // повторный рендер одного и того же результата боя выглядит стабильно одинаково.
    const PLACEHOLDER_AVATARS = [
        'боевка попап участник 1.png',
        'боевка попап участник 2.png',
        'боевка попап участник 3.png',
    ];

    // Цвета подписи урона под топ-3 аватарами (22.09.2026, по прямому указанию — золото/
    // серебро/бронза для 1/2/3 места соответственно).
    const RANK_COLORS = ['#F5B82E', '#C9C9C9', '#C8753D'];

    // "ТОП УРОНА" — места 4-9, два столбца по 3 строки (см. референс-скриншот 18.09.2026):
    // левый столбец 4-6, правый 7-9, единая строка вида "N. НИК - УРОНk".
    // 26.09.2026 (по прямому указанию, скриншот — левый столбец 4-6 места сдвинут вправо на
    // 40px, налезал на декоративную заклёпку слева).
    const TOP_LIST_COLS = [470, 700];
    const TOP_LIST_ROWS = [548, 573, 598];

    // 22.09.2026 (по прямому указанию — "количество урона расположи в таком месте для первого
    // игрока, Y останется на том же месте, просто под ними [для остальных]"): снято редактором
    // позиций на подписи 1-го места ("1K\nУРОНА") — y:470, единый для всех трёх слотов; x
    // по-прежнему берётся из своего слота (под своим аватаром), не общий.
    const AVATAR_DMG_Y = 470;

    // 22.09.2026 (по прямому указанию — "поменял расположение HP у босса, центрируй его
    // относительно иконки с боссом"): раньше HP_BAR_OFFSET.x был снят сканированием красной
    // полоски на портрете (88) — теперь X вычисляется как ГОРИЗОНТАЛЬНЫЙ ЦЕНТР самого портрета
    // (натуральная ширина всех 8 файлов BOSS_PORTRAITS — 157px, центр 78.5), а не независимое
    // число — формулой, а не хардкодом, раз речь именно про центрирование относительно иконки.
    // Y — снят напрямую редактором позиций (было 181, стало 193).
    const PORTRAIT_W = 157;
    const HP_BAR_OFFSET = { x: PORTRAIT_W / 2, y: 193 };

    // 22.09.2026 (по прямому указанию, скриншот попапа победы — "поверх карточки босса по
    // диагонали напиши УБИТ, перед этим поверни на 45 градусов против часовой"): натуральная
    // высота файлов BOSS_PORTRAITS варьируется по боссу (227-236px) — берём средний ориентир
    // для центрирования штампа, как и остальные approx-координаты этого файла (см. шапку) —
    // потребует подгонки через универсальный редактор позиций при необходимости.
    const PORTRAIT_H = 230;

    const _sprite = (file, pos) => {
        const s = new PIXI.Sprite(PIXI.Texture.from(BASE + file));
        s.x = pos.x; s.y = pos.y;
        return s;
    };

    const _fmtDmg = (n) => window.helper && helper.formatKK ? helper.formatKK(n) : String(n);

    proto._closeBossResultPopup = function(){
        if(this._bossResultWin && this._bossResultWin.parent){
            this._bossResultWin.parent.removeChild(this._bossResultWin);
        }
        this._bossResultWin = null;
    };

    // opts: { bossIdx, diffIdx, isWin, cig, exp, ryukzak, shmotAmount, hpLeft, maxHp, sedoyDamage, onClose }
    proto._showBossResultPopup = function(opts){
        console.log('[boss_result] _showBossResultPopup:', JSON.stringify(opts));
        this._closeBossResultPopup();

        const bossIdx  = opts.bossIdx;
        const diffIdx  = opts.diffIdx || 0;
        const isWin    = !!opts.isWin;
        const bossName = (window.bosses && bosses.data[bossIdx]) ? bosses.data[bossIdx].name : '';

        const win = new PIXI.Container();
        win.interactive = true;

        const bg = _sprite('боевка попап фон.png', BG_POS);
        win.addChild(bg);

        const portraitFile = BOSS_PORTRAITS[bossIdx] || BOSS_PORTRAITS[0];
        const portrait = _sprite(portraitFile, PORTRAIT_POS);
        win.addChild(portrait);

        // 24.09.2026 (по прямому указанию — "если босс убит, картинка босса должна затемняться,
        // а не просто текст УБИТ поверх неё"): полупрозрачная чёрная плашка ровно по размеру
        // портрета, поверх портрета, но ПОД штампом "УБИТ" ниже — тонирует картинку, не трогая
        // сам файл (разные боссы — разные PNG, единый оверлей проще, чем спрайт.tint на каждом).
        if(isWin){
            const portraitDark = new PIXI.Graphics();
            portraitDark.beginFill(0x000000, 0.55);
            portraitDark.drawRect(0, 0, PORTRAIT_W, PORTRAIT_H);
            portraitDark.endFill();
            portraitDark.x = PORTRAIT_POS.x; portraitDark.y = PORTRAIT_POS.y;
            win.addChild(portraitDark);
        }

        // "УБИТ" — диагональный штамп поверх портрета босса, только на экране победы.
        if(isWin){
            // 23.09.2026 (по прямому указанию, скриншот): цвет штампа сменён с красного
            // (#c81e1e) на белый — лучше читается на тёмном портрете босса.
            const killedStamp = new PIXI.Text('УБИТ', {
                fontFamily: 'Southbank LT', fontSize: 34, fill: '#ffffff', fontWeight: 'bold',
                dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2,
            });
            killedStamp.anchor.set(0.5, 0.5);
            killedStamp.x = PORTRAIT_POS.x + PORTRAIT_W / 2;
            killedStamp.y = PORTRAIT_POS.y + PORTRAIT_H / 2;
            killedStamp.rotation = -Math.PI / 4; // поворот на 45° против часовой
            killedStamp.alpha = 0.9;
            win.addChild(killedStamp);
        }

        const banner = _sprite(isWin ? 'боевка попап победил.png' : 'боевка попап проиграл.png', BANNER_POS);
        win.addChild(banner);

        // Имя босса — чёрными чернилами на плашке портрета (18.09.2026, по референс-скриншоту).
        const nameTxt = new PIXI.Text(bossName.toUpperCase(), {
            fontFamily: 'Southbank LT', fontSize: 18, fill: '#1a1208', fontWeight: 'bold',
        });
        nameTxt.anchor.set(0.5, 0.5);
        nameTxt.x = PORTRAIT_POS.x + NAME_OFFSET.x;
        nameTxt.y = PORTRAIT_POS.y + NAME_OFFSET.y;
        win.addChild(nameTxt);

        if(!isWin){
            const hpTxt = new PIXI.Text(
                'Осталось HP: ' + (window.bosses ? bosses._fmt(opts.hpLeft || 0) : (opts.hpLeft || 0))
                + ' / ' + (window.bosses ? bosses._fmt(opts.maxHp || 0) : (opts.maxHp || 0)),
                { fontFamily: 'Southbank LT', fontSize: 14, fill: '#1a1208' }
            );
            hpTxt.anchor.set(0.5, 0.5);
            hpTxt.x = PORTRAIT_POS.x + NAME_OFFSET.x;
            hpTxt.y = PORTRAIT_POS.y + NAME_OFFSET.y + 18;
            win.addChild(hpTxt);
        } else {
            // 22.09.2026: "количество хп, которое было у босса" — на победном экране это его
            // максимальный HP (сам босс уже повержен), белым шрифтом поверх красной полоски,
            // вшитой в файл портрета.
            const hpBarTxt = new PIXI.Text(
                window.bosses ? bosses._fmt(opts.maxHp || 0) : String(opts.maxHp || 0),
                {
                    fontFamily: 'Southbank LT', fontSize: 16, fill: '#ffffff', fontWeight: 'bold',
                    dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
                }
            );
            hpBarTxt.anchor.set(0.5, 0.5);
            hpBarTxt.x = PORTRAIT_POS.x + HP_BAR_OFFSET.x;
            hpBarTxt.y = PORTRAIT_POS.y + HP_BAR_OFFSET.y;
            win.addChild(hpBarTxt);
        }

        // Награда — суммы СПРАВА от уже вшитых в фон иконок сигарет/рюкзака/опыта (18.09.2026,
        // по прямому указанию — "рядом справа от них плюс количество"). На поражении наград нет.
        //
        // 28.09.2026 (баг "попап результата боя не показывается ни разу, бой зависает до
        // перезагрузки страницы", репорт игроков + консоль "Uncaught ReferenceError: shmotHoverEls
        // is not defined" в _showBossResultPopup): эта переменная раньше объявлялась через `let`
        // ВНУТРИ блока if(isWin) ниже, а читалась в самом конце функции (см. "поднимаем все 4
        // элемента тултипа сюда" ближе к концу) — то есть ВНЕ блока, где она объявлена. Из-за
        // block-scope у let это ReferenceError на КАЖДОМ результате боя без исключения (и победа,
        // и поражение — на поражении блок if(isWin) вообще не выполнялся, так что переменная не
        // объявлялась нигде в достижимой области видимости). Исключение вылетало ДО
        // `root.layer2_mc.addChild(win)` и ДО onClose-редиректа (_doRedirect →
        // _closeBossesFight()/_openBossesPopup() в bosses-combat.js), поэтому попап никогда не
        // показывался, старый экран боя/хаты оставался висеть, а следующая атака уходила на уже
        // закрытую сервером сессию боя (bossStartMs сервер обнулял ДО этого попапа, в claimKill) —
        // отсюда "бой не начат" и визуально восстановившееся HP при повторном ударе. Объявление
        // поднято сюда, в область видимости всей функции, чтобы быть доступным и в блоке if(isWin)
        // ниже, и в коде поднятия тултипа над аватарами в конце функции.
        let shmotHoverEls = null;
        if(isWin){
            // 19.09.2026 (по прямому указанию): суммы наград — чёрным шрифтом, как подпись
            // имени босса (#1a1208), было светло-бежевым (#e8d8b8).
            // 25.09.2026 (по прямому указанию, скриншот — "вместо 20 000 пиши 20к, вместо
            // 1 500 пиши 1.5к"): переиспользуем formatAchNum() (modules/achievement-tiers.js,
            // уже применяется в "Мои достижения") — целые тысячи без точки (20000 → "20к"),
            // нецелые — с одним знаком после точки (1500 → "1.5к"); суммы меньше 1000 (150, 1)
            // остаются как есть.
            const _rewardLabel = (pos, amount) => {
                const t = new PIXI.Text('+' + formatAchNum(amount || 0), {
                    fontFamily: 'Southbank LT', fontSize: 16, fill: '#1a1208',
                    dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
                });
                t.anchor.set(0, 0.5);
                t.x = pos.x; t.y = pos.y;
                win.addChild(t);
            };
            _rewardLabel(REWARD_LABEL_POS.cig,     opts.cig);
            _rewardLabel(REWARD_LABEL_POS.ryukzak, opts.ryukzak);
            _rewardLabel(REWARD_LABEL_POS.exp,     opts.exp);

            // 22.09.2026 (по прямому указанию, файл шмотка.png — координаты сняты в Photoshop):
            // иконка показывается и на полную вещь (shmotAmount>0, с числом "+N"), и на
            // ПРОГРЕСС фрагмента сета "ссср" (shmotFragment, БЕЗ числа — фрагмент это не
            // "количество", а прогресс сборки).
            //
            // 23.09.2026 (по прямому указанию, репорт "не нужен отдельный попап ошибки для
            // фрагмента — покажи по наведению на иконку прямо тут"): раньше "что именно выпало"
            // показывал отдельный toast в bosses-combat.js (ошибочно через error-стиль попапа) —
            // toast убран целиком, вместо него — тултип по pointerover/pointerout, тот же
            // приём, что уже используется в магазине шмоток (shmot_shop.js._showShopTip).
            // 26.09.2026 (повторное указание тем же днём — "только при наведении", описание
            // должно быть ПОВЕРХ аватаров "УЧАСТНИКИ БОЯ"): shmotHoverEls заполняется ниже,
            // если рамка/картинка реально построены — используется в самом конце
            // _showBossResultPopup(), чтобы поднять эти элементы НАД аватарами, которые
            // добавляются в win позже (иначе аватар/заглушка "боевка попап участник N.png"
            // рисуется поверх и полностью перекрывает тултип). Само объявление
            // `let shmotHoverEls` поднято в начало функции (см. комментарий там, баг 28.09.2026).
            if(opts.shmotAmount > 0 || opts.shmotFragment){
                const shmotIcon = _sprite('боевка попап шмотка.png', SHMOT_POS);
                shmotIcon.interactive = true; shmotIcon.buttonMode = true;
                win.addChild(shmotIcon);
                // 23.09.2026 (снято редактором позиций, по прямому указанию — "поменял
                // расположение +кол-во шмоток"): было +44/+22 от SHMOT_POS, стало +50/+20
                // (абсолютно x:863 y:295, т.к. SHMOT_POS = {813,275}).
                if(opts.shmotAmount > 0) _rewardLabel({ x: SHMOT_POS.x + 50, y: SHMOT_POS.y + 20 }, opts.shmotAmount);

                // 26.09.2026 (по прямому указанию — "при наведении на иконку шмотки будет
                // открываться рамка, внутри — картинка выбитой шмотки"): текстовый тултип
                // заменён на визуальную рамку с реальной картинкой вещи. Полная вещь
                // (shmotAmount>0) — id берём из opts.shmotWonId, картинка показывается как
                // есть. Прогресс фрагмента (opts.shmotFragment, полный предмет ЕЩЁ не собран)
                // — та же картинка вещи, но поверх неё "не получено" (та же трактовка, что и
                // у карусели "ВОЗМОЖНАЯ НАГРАДА" на экране перед боем — предмет показан, но
                // ты им ещё не владеешь).
                const hoverItemId = (opts.shmotAmount > 0 && opts.shmotWonId != null)
                    ? opts.shmotWonId
                    : (opts.shmotFragment && opts.shmotFragment.id != null) ? opts.shmotFragment.id : null;
                const hoverImgFile = hoverItemId != null ? BOSS_SHMOT_REWARD_IMAGE[hoverItemId] : null;

                if(hoverImgFile){
                    const isObtained = opts.shmotAmount > 0;
                    const shmotItem = (window.shmot && Array.isArray(shmot.items))
                        ? shmot.items.find(it => it.id === hoverItemId) : null;

                    const frame = _sprite(BOSS_SHMOT_REWARD_FRAME, SHMOT_HOVER_FRAME_POS);
                    const itemImg = _sprite(hoverImgFile, SHMOT_HOVER_ITEM_POS);
                    itemImg.width = SHMOT_HOVER_ITEM_W; itemImg.height = SHMOT_HOVER_ITEM_H;
                    const notObtainedOverlay = _sprite(BOSS_SHMOT_NOT_OBTAINED, SHMOT_HOVER_NOT_OBTAINED_POS);
                    notObtainedOverlay.width = SHMOT_HOVER_NOT_OBTAINED_W; notObtainedOverlay.height = SHMOT_HOVER_NOT_OBTAINED_H;
                    frame.visible = false; itemImg.visible = false; notObtainedOverlay.visible = false;
                    win.addChild(frame); win.addChild(itemImg); win.addChild(notObtainedOverlay);

                    // 26.09.2026 (по прямому указанию — "сделай так же, как сейчас сделано
                    // описание во вкладке шмотки при наведении"): та же карточка-тултип, что и
                    // shmot_shop.js._showShopTip (заголовок/Бонус/пунктир/что выбито).
                    const descCard = new PIXI.Container();
                    if(shmotItem){
                        const PAD = 12;
                        const titleStyle = { fontFamily:'Southbank LT', fontSize:17, fontWeight:'bold', fill:'#ac3b26',
                            wordWrap:true, wordWrapWidth: SHMOT_HOVER_DESC_W };
                        const lblStyle   = { fontFamily:'Southbank LT', fontSize:14, fontWeight:'bold', fill:'#2a2118' };
                        const valStyle   = { fontFamily:'Southbank LT', fontSize:14, fill:'#ac5238' };

                        let y = PAD;
                        const title = new PIXI.Text(shmotItem.name, titleStyle);
                        title.x = PAD; title.y = y;
                        descCard.addChild(title);
                        y += title.height + 8;

                        const bonusLbl = new PIXI.Text('Бонус: ', lblStyle);
                        bonusLbl.x = PAD; bonusLbl.y = y;
                        descCard.addChild(bonusLbl);
                        const bonusVal = new PIXI.Text(shmotItem.bonus || 'нет бонуса',
                            Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: SHMOT_HOVER_DESC_W - bonusLbl.width }));
                        bonusVal.x = PAD + bonusLbl.width; bonusVal.y = y;
                        descCard.addChild(bonusVal);
                        y += Math.max(bonusLbl.height, bonusVal.height) + 10;

                        const sep = new PIXI.Graphics();
                        sep.lineStyle(1, 0x9c8770, 0.9);
                        const DASH = 5, GAP = 4, sepY = y;
                        for(let dx = 0; dx < SHMOT_HOVER_DESC_W; dx += DASH + GAP){
                            sep.moveTo(PAD + dx, sepY);
                            sep.lineTo(Math.min(PAD + dx + DASH, PAD + SHMOT_HOVER_DESC_W), sepY);
                        }
                        descCard.addChild(sep);
                        y += 10;

                        const dropLbl = new PIXI.Text('Выбито: ', lblStyle);
                        dropLbl.x = PAD; dropLbl.y = y;
                        descCard.addChild(dropLbl);
                        const dropText = isObtained
                            ? 'целая вещь'
                            : 'фрагмент (' + (opts.shmotFragment ? opts.shmotFragment.have + '/' + opts.shmotFragment.need : '?') + ')';
                        const dropVal = new PIXI.Text(dropText,
                            Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: SHMOT_HOVER_DESC_W - dropLbl.width }));
                        dropVal.x = PAD + dropLbl.width; dropVal.y = y;
                        descCard.addChild(dropVal);
                        y += Math.max(dropLbl.height, dropVal.height);

                        const totalW = SHMOT_HOVER_DESC_W + PAD * 2;
                        const totalH = y + PAD;
                        const cardBg = new PIXI.Graphics();
                        cardBg.beginFill(0xfbeee0, 0.97);
                        cardBg.lineStyle(2, 0xc79a72, 1);
                        cardBg.drawRoundedRect(0, 0, totalW, totalH, 8);
                        cardBg.endFill();
                        descCard.addChildAt(cardBg, 0);
                    }
                    descCard.x = SHMOT_HOVER_DESC_POS.x; descCard.y = SHMOT_HOVER_DESC_POS.y;
                    descCard.visible = false;
                    win.addChild(descCard);

                    // 26.09.2026 (повторное указание тем же днём — снова "только при
                    // наведении"): промежуточный клик-тумблер (введён раньше этим же днём)
                    // отменён обратно на pointerover/pointerout, тот же приём, что уже
                    // используется в магазине шмоток (shmot_shop.js._showShopTip).
                    //
                    // 26.09.2026 (уточнено повторно тем же днём — "если человек выбил шмотку,
                    // просто не выводить файл не получено"): условие isObtained не менялось —
                    // notObtainedOverlay и раньше показывался только при !isObtained (прогресс
                    // фрагмента); явно зафиксировано, что при целой вещи (isObtained=true) файл
                    // "не получено" НИКОГДА не появляется.
                    const showTip = () => {
                        frame.visible = true;
                        itemImg.visible = true;
                        notObtainedOverlay.visible = !isObtained;
                        descCard.visible = true;
                    };
                    const hideTip = () => {
                        frame.visible = false;
                        itemImg.visible = false;
                        notObtainedOverlay.visible = false;
                        descCard.visible = false;
                    };
                    // 28.09.2026 (репорт — "на мобильном не видно, какая шмотка выпала"):
                    // pointerover/pointerout выше — правильное и намеренное решение для
                    // ДЕСКТОПА (два прямых указания 26.09.2026 против клик-тумблера там), но
                    // на тач-экранах события pointerover/pointerout в PIXI не срабатывают
                    // вообще (нет курсора, который может "войти"/"выйти" без клика) — тултип
                    // был физически недостижим на мобильном, а не просто неудобен. Десктопное
                    // поведение не трогаем (объект решения от 26.09 касался именно него),
                    // добавляем ТОЛЬКО для window.isMobile тап-тумблер — палец не двигается,
                    // значит конфликта со свайпом/скроллом здесь нет (эта иконка не часть
                    // прокручиваемого списка), обычный pointerdown достаточен.
                    if(window.isMobile){
                        let tipShown = false;
                        shmotIcon.on('pointerdown', () => {
                            tipShown = !tipShown;
                            if(tipShown) showTip(); else hideTip();
                        });
                    } else {
                        shmotIcon.on('pointerover', showTip);
                        shmotIcon.on('pointerout',  hideTip);
                    }

                    shmotHoverEls = { frame, itemImg, notObtainedOverlay, descCard };
                }
            }
        }

        // УЧАСТНИКИ БОЯ (топ-3, фото+корона, БЕЗ подписи ника/урона — см. референс-скриншот) +
        // ТОП УРОНА (места 4-9, текстовый список "N. НИК - УРОНk") — переиспользуем тот же
        // серверный запрос, что и рейтинг на экране боя (bosses.rating), теперь отдаёт топ-9
        // вместо топ-3 (см. bosses.php.rating()).
        const avatarSprs = AVATAR_SLOTS.map(slot => {
            const spr = new PIXI.Sprite(PIXI.Texture.EMPTY);
            spr.width = AVATAR_W; spr.height = AVATAR_H;
            spr.x = slot.x - AVATAR_W / 2; spr.y = slot.y - AVATAR_H / 2;
            win.addChild(spr);
            return spr;
        });

        // 22.09.2026 (по прямому указанию, 7-я картинка референса; Y уточнён отдельным снимком
        // редактора позиций тем же днём — см. AVATAR_DMG_Y): под каждым из топ-3 аватаров —
        // урон, нанесённый этим игроком, цветом места (золото/серебро/бронза), числом сверху и
        // "УРОНА" отдельной строкой снизу. X — свой для каждого слота (под своим аватаром), Y —
        // общий AVATAR_DMG_Y (снят на 1-м месте, применяется одинаково ко всем трём).
        const avatarDmgTxts = AVATAR_SLOTS.map((slot, i) => {
            const t = new PIXI.Text('', {
                fontFamily: 'Southbank LT', fontSize: 15, fill: RANK_COLORS[i], fontWeight: 'bold',
                align: 'center', dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
            });
            t.anchor.set(0.5, 0);
            t.x = slot.x; t.y = AVATAR_DMG_Y;
            win.addChild(t);
            return t;
        });
        const topListTxts = [];
        for(let col = 0; col < TOP_LIST_COLS.length; col++){
            for(let row = 0; row < TOP_LIST_ROWS.length; row++){
                const t = new PIXI.Text('', { fontFamily: 'Southbank LT', fontSize: 14, fill: '#3a2a1a' });
                t.x = TOP_LIST_COLS[col]; t.y = TOP_LIST_ROWS[row];
                win.addChild(t);
                topListTxts.push(t);
            }
        }

        // 29.09.2026 (репорт игрока Flex, скрин "0/1000 HP, а участники боя показывают всего
        // 192 урона" — по прямому указанию: "седой умеет наносить урон боссам, отображается в
        // попапе результата, но не учитывается в топе по урону/скиллах/прочем"): урон Седого
        // реально снижает HP босса (bosses.php._sedoyDamageMineSince), но намеренно исключён из
        // _ratingTop()/opts.top (см. комментарий там — "рейтинг должен отражать реальный боевой
        // вклад"). Без этой строки попап никак не объяснял разницу между суммой участников и
        // maxHp. Позиция — approx, под списком "ТОП УРОНА", потребует подгонки через редактор
        // позиций (см. шапку файла). Видна ТОЛЬКО на победе и только когда Седой реально бил
        // (sedoyDamage>0) — обычные бои без Седого её не показывают.
        // 30.09.2026 (по прямому указанию — "урон седого отправляется друзьям, не должен"):
        // opts.sedoyDamage теперь = ТОЛЬКО мой удар Седого — Седой друга больше не влияет на HP
        // этого боя вообще (см. bosses.php._friendsDamageSumSince/_applyFriendDamage), поэтому и
        // в этой строке его быть не может.
        // Седой отображается только в личной цифре результата. Его урон не попадает в
        // рейтинг, total_damage, опыт навыков или достижения (см. bosses.php).

        // 22.09.2026 (баг "попап победы пустой — нет иконок/урона", по прямому указанию):
        // причина была в том, что bosses.php.claimKill() сбрасывает bossStartMs ДО того, как
        // этот попап успевал сделать СВОЙ отдельный запрос bosses.rating() — rating() видел уже
        // обнулённый bossStartMs и всегда возвращал пустой top. Теперь при победе top приходит
        // готовым прямо в opts (см. bosses-combat.js._onDefeat → claimKill ответ, поле 'top'),
        // отдельный запрос больше не нужен и не может попасть в эту гонку. При поражении/таймауте
        // claimKill не вызывается вовсе (bossStartMs остаётся ненулевым на сервере), поэтому
        // отдельный запрос bosses.rating() по-прежнему корректен — оставлен как fallback.
        const _applyRatingTop = (top) => {
            top = Array.isArray(top) ? top.slice(0, 9) : [];
            // Урон Седого не является боевым уроном: сервер намеренно не включает его в
            // _ratingTop(), total_damage, навыки и достижения. Но когда Седой добил босса
            // БЕЗ обычного удара игрока, обычный top оказывается пустым и попап показывал
            // только три заглушки. Это не рейтинг, а локальная строка представления результата:
            // добавляем текущего игрока исключительно на экран, чтобы отразить реального
            // победителя и его личную сумму Седого. Число добавляется ниже в shownDamage.
            const ownId = String(vk_params && vk_params['vk_user_id'] || '');
            const sedoyDamage = isWin ? Number(opts.sedoyDamage || 0) : 0;
            const hasOwnEntry = top.some(entry => String(entry && entry.id) === ownId);
            if(sedoyDamage > 0 && ownId && !hasOwnEntry){
                top.unshift({ id: ownId, nick: (window.udata && (udata.nick || udata.nickname)) || 'Ты', damage: 0, _sedoyDisplayOnly: true });
                top = top.slice(0, 9);
            }
            console.log('[boss_result] top участников боя:', top.length, '| top:', JSON.stringify(top));
            // 26.09.2026 (баг найден по прямому указанию + скриншот — "сбежал с боя, но не
            // показываются игроки, которые нанесли урон"): раньше при ПОЛНОСТЬЮ пустом top
            // (0 участников — например, побег/таймаут без единого нанесённого удара, или
            // мгновенный побег сразу после входа в бой) функция выходила ЗДЕСЬ, не доходя до
            // цикла ниже (avatarSprs.forEach), который как раз и подставляет
            // PLACEHOLDER_AVATARS в пустые слоты — тот же цикл уже штатно работает для 1-2
            // участников, просто никогда не запускался при 0. Итог — все 3 слота "УЧАСТНИКИ
            // БОЯ" оставались буквально пустыми (PIXI.Texture.EMPTY), а не заглушками, как для
            // случая "меньше 3 участников". Ранний return убран — topThree/rest6 корректно
            // остаются пустыми массивами, весь код ниже уже написан с расчётом на это (entry
            // ? ... : '' везде), включая список "ТОП УРОНА" (rank <= rankedLen, rankedLen=0
            // просто не покажет ни одной строки — уже было корректно).
            const topThree = top.slice(0, 3);
            const rest6    = top.slice(3, 9);

            // 26.09.2026 (баг найден по прямому указанию + скриншот — "теперь каждый раз в бою
            // почему-то лезут мок данные"): раньше здесь стояла временная QA-заглушка (от
            // 25.09.2026), которая дополняла места 4-9 синтетическими записями "Карначев А. —
            // 50000" при включённом udata.dev_force_drops — ЛИЧНОМ флаге "100% дроп шмота с
            // боссов" (dev_panel.js, никак не связанном с рейтингом урона). Пока у аккаунта
            // включён dev_force_drops для тестирования дропа шмоток, эта же ветка молча
            // подменяла ТОП УРОНА фейковыми записями в КАЖДОМ реальном бою — ровно симптом со
            // скриншота. Заглушка была одноразовой, её роль теперь полностью покрывает отдельная
            // dev-кнопка "Попап награды (мок, 10 участников)" (dev_panel.js, вызывает
            // _showBossResultPopup с явным mockTop через параметр opts.top, не через побочный
            // эффект чужого флага) — убрана целиком, top всегда реальный ответ сервера.
            const rankedLen = top.length;

            bosses._resolveVkUsers(topThree.map(e => e.id), (users) => {
                topThree.forEach((entry, i) => {
                    const u = users[String(entry.id)];
                    if(avatarSprs[i] && u && u.photo) avatarSprs[i].texture = PIXI.Texture.from(u.photo);
                });
            });

            // 22.09.2026: если реальных участников боя меньше 3 — оставшиеся слоты "УЧАСТНИКИ
            // БОЯ" заполняются портретом-заглушкой (см. PLACEHOLDER_AVATARS), а не пустой рамкой,
            // и подпись урона под ними не показывается (это не настоящий участник).
            avatarSprs.forEach((spr, i) => {
                if(i >= topThree.length){
                    spr.texture = PIXI.Texture.from(BASE + PLACEHOLDER_AVATARS[i]);
                }
            });
            avatarDmgTxts.forEach((t, i) => {
                const entry = topThree[i];
                const isOwnEntry = entry && String(entry.id) === String(vk_params['vk_user_id']);
                const shownDamage = entry ? Number(entry.damage || 0) + (isOwnEntry && isWin ? Number(opts.sedoyDamage || 0) : 0) : 0;
                t.text = entry ? (_fmtDmg(shownDamage) + '\nУРОНА') : '';
            });

            // 22.09.2026 (по прямому указанию — "выводи цифры в случае, если есть игроков
            // определённое количество"): строка ранга N отображается ТОЛЬКО если в бою реально
            // участвовало ≥N игроков — раньше недостающие места забивались прочерком "N. —"
            // безусловно, из-за чего при 2 участниках весь список 4-9 всё равно занимал место
            // (и выглядел как "ничего не показывается" на местах 4-6, где строка легко терялась
            // на фоне декоративной рамки панели).
            for(let i = 0; i < topListTxts.length; i++){
                const rank = i + 4;
                if(rank <= rankedLen){
                    const entry = rest6[i];
                    topListTxts[i].text = entry ? (rank + '. ' + (entry.nick || 'Сталкер') + ' - ' + _fmtDmg(entry.damage || 0)) : '';
                    topListTxts[i].visible = true;
                } else {
                    topListTxts[i].text = '';
                    topListTxts[i].visible = false;
                }
            }
        };

        // 24.09.2026 (баг "на попапе поражения висит чужой/давний урон", по прямому указанию +
        // скриншот): раньше условие было `opts.isWin && Array.isArray(opts.top)` — на
        // ПОРАЖЕНИИ top от вызывающего кода игнорировался всегда, даже когда
        // bosses-combat.js._onFightTimeout/bosses_fight.js._forfeitBossFight стали передавать
        // его (см. их правки того же батча) — попап уходил в отдельный, гоночный запрос
        // bosses.rating() НИЖЕ, который к этому моменту уже мог увидеть обнулённый bossStartMs
        // (клиент к этому времени успевал сбросить и заflashить его) и вернуть пустой/чужой топ.
        // Теперь опираемся на opts.top для ОБОИХ исходов боя — свежий фолбэк-запрос остаётся
        // только на случай, если вызывающий код вообще не передал top (не должно случаться для
        // текущих 3 мест вызова, но не ломаем совместимость с будущими).
        if(Array.isArray(opts.top)){
            _applyRatingTop(opts.top);
        } else if(window.TS && window.bosses){
            TS.php('bosses.rating', { boss_id: bossIdx, diff_idx: diffIdx }, (res) => {
                _applyRatingTop(res && res.top);
            }, (e) => { console.error('[boss_result] ошибка bosses.rating:', JSON.stringify(e)); });
        }

        // ЕЩЁ РАЗ — закрыть попап и сразу начать новую попытку того же босса/сложности.
        const againBtn = _sprite('боевка попап ещё раз.png', AGAIN_BTN_POS);
        againBtn.interactive = true; againBtn.buttonMode = true;
        againBtn.on('pointerover', () => { againBtn.alpha = 0.8; });
        againBtn.on('pointerout',  () => { againBtn.alpha = 1; });
        // 24.09.2026 (баг найден по прямому указанию + скриншот — "лимит 7 убийств исчерпан,
        // но бой всё равно открылся, атаковать нельзя, выйти можно только через форфейт"):
        // ЕЩЁ РАЗ звал iface._openBossesFight() НАПРЯМУЮ, в обход тех же проверок (дневной
        // лимит/ключи), которые делает bosses_select.js._onNapastClick() перед обычным входом
        // в бой. Сервер bosses.startFight() тоже не проверял лимит (только claimKill() при
        // добивании) — дырка открывала пустую попытку боя, которую нельзя ни выиграть
        // (claimKill вернул бы код 62), ни атаковать (клиентский предчек в _attack() тоже
        // блокирует), единственным выходом оставался форфейт. Теперь ЕЩЁ РАЗ проверяет то же
        // самое, что и обычная кнопка НАПАСТЬ, ДО открытия экрана боя.
        againBtn.on('pointerdown', () => {
            console.log('[boss_result] ЕЩЁ РАЗ | bossIdx:', bossIdx, 'diffIdx:', diffIdx);
            if(window.bosses){
                const today     = bosses._today ? bosses._today() : '';
                const dailyDate = bosses.dailyDate || '';
                const limit     = bosses.DAILY_KILL_LIMIT || 7;
                const dkills    = (dailyDate === today) ? parseInt(bosses.dailyKills[bossIdx] || 0) : 0;
                if(dkills >= limit){
                    this._closeBossResultPopup();
                    if(opts.onClose) opts.onClose();
                    // 29.09.2026: было "убийств" — лимит теперь тратится за любой исход попытки.
                    notify.showResult({text:'Лимит ' + limit + ' попыток на сегодня исчерпан!'}, 0);
                    return;
                }
                const bossData = bosses.data[bossIdx];
                const need = (bossData && bossData.keys_needed) || 0;
                const keySlot = (bossData && bossData.key_slot != null) ? bossData.key_slot : bossIdx;
                const have = Array.isArray(bosses.keys) ? parseInt(bosses.keys[keySlot] || 0) : 0;
                if(!bosses._hasKeyring() && need > 0 && have < need){
                    this._closeBossResultPopup();
                    if(opts.onClose) opts.onClose();
                    notify.showResult({text:'Нужно ' + need + ' ключей! У вас: ' + have}, 0);
                    return;
                }
            }
            this._closeBossResultPopup();
            if(opts.onClose) opts.onClose();
            if(window.iface && typeof iface._openBossesFight === 'function') iface._openBossesFight(bossIdx, diffIdx);
        });
        win.addChild(againBtn);

		// РАССКАЗАТЬ — актуальный системный шаринг VK, только по нажатию игрока.
        const shareBtn = _sprite('боевка попап рассказать.png', SHARE_BTN_POS);
        shareBtn.interactive = true; shareBtn.buttonMode = true;
        shareBtn.on('pointerover', () => { shareBtn.alpha = 0.8; });
        shareBtn.on('pointerout',  () => { shareBtn.alpha = 1; });
        shareBtn.on('pointerdown', () => {
            // Модерация VK (30.09.2026, п.3): раньше здесь стоял window.location.href — внутри
            // Mini App это адрес iframe'а (реальный хостинг клиента, pripyat-game.ru, плюс
            // query-параметры сессии типа sign/vk_user_id), а не vk.com — именно эта ссылка на
            // сторонний домен улетала в шеринг. Каноническая ссылка на приложение — фиксированная.
            const shareLink = 'https://vk.com/app54574178_438953352';
            console.log('[boss_result] РАССКАЗАТЬ | boss:', bossName, '| isWin:', isWin);
            if(window.bridge){
				bridge.send('VKWebAppShare', { link: shareLink })
                    .catch((shareError) => {
                        console.error('[boss_result.share] VK share не удался:', shareError);
                    });
            }
        });
        win.addChild(shareBtn);

        // Стандартная кнопка выхода (см. CLAUDE.md "Паттерн нового PIXI-экрана") — закрывает
        // попап без повторной попытки, возвращает к выбору боссов.
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { exitBtn.alpha = 0.75; });
        exitBtn.on('pointerout',  () => { exitBtn.alpha = 1; });
        exitBtn.on('pointerdown', () => {
            this._closeBossResultPopup();
            if(opts.onClose) opts.onClose();
        });
        win.addChild(exitBtn);

        // 26.09.2026 (по прямому указанию, репорт — "описание шмотки должно быть поверх файла
        // боевка попап участник 3.png"): frame/itemImg/notObtainedOverlay/descCard были
        // добавлены в win РАНЬШЕ аватаров "УЧАСТНИКИ БОЯ" (см. shmotHoverEls выше) — аватар/
        // заглушка (PLACEHOLDER_AVATARS, в т.ч. "боевка попап участник 3.png") рисовался поверх
        // них. addChild() на уже существующем ребёнке PIXI-контейнера переносит его в конец
        // (наверх) без пересоздания — поднимаем все 4 элемента тултипа сюда, в самый конец.
        if(shmotHoverEls){
            win.addChild(shmotHoverEls.frame);
            win.addChild(shmotHoverEls.itemImg);
            win.addChild(shmotHoverEls.notObtainedOverlay);
            win.addChild(shmotHoverEls.descCard);
        }

        this._bossResultWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface && iface.up) root.layer2_mc.addChild(iface.up);
    };
}

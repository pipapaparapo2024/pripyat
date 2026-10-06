import { applyPatch } from '../../../modules/patch.js';

// Индивидуальная подгонка каждого фона (сняты через универсальный редактор позиций
// прямо на этом попапе, ключ — имя файла h.img). Разные исходники по-разному
// скомпонованы по вертикали, единого y=0 на все не хватало.
const BG_ADJUST = {
    'шлюз.png':        { y: 32, scale: 1.000 },
    'канализация.png': { y: 35, scale: 1.000 },
    'двор_фон.png':    { y: 54, scale: 1.000 },
    'мастерская.png':  { y: 74, scale: 1.000 },
    'железка.png':     { y: 56, scale: 1.002 },
    'заправка.png':    { y: 63, scale: 1.004 },
    'станция.png':     { y: 73, scale: 1.000 },
};

const HATAS = [
    { id:0, name:'Кубрик',      img:'кубрик.png',      bossReq:-1, cost:0       },
    { id:1, name:'Шлюз',        img:'шлюз.png',        bossReq:1,  cost:10000   },
    { id:2, name:'Канализация', img:'канализация.png', bossReq:2,  cost:25000   },
    { id:3, name:'Двор',        img:'двор_фон.png',    bossReq:3,  cost:40000   },
    { id:4, name:'Мастерская',  img:'мастерская.png',  bossReq:4,  cost:75000   },
    { id:5, name:'Железка',     img:'железка.png',     bossReq:5,  cost:100000  },
    // 03.10.2026 (репорт игрока — "сижу в хате «станция», отображаюсь в хате «заправка», и
    // наоборот при заезде в «заправку»"): img у id:6/id:7 были перепутаны местами (станция.png
    // стоял у "Заправка", заправка.png — у "Станция"). home.js._bgFiles (тот же набор
    // локаций, индексируется позицией id) уже был в правильном порядке
    // [...,'станция.png','заправка.png'] — то есть главный экран показывал ВЕРНУЮ картинку,
    // а попап выбора хаты (этот файл) — перепутанную. Приведено в соответствие с home.js.
    //
    // 06.10.2026 (баг по репорту со скриншотами — "картинка не совпадает с названием"): правка
    // 03.10 выше синхронизировала ПОЗИЦИЮ файлов img с home.js, но файлы станция.png/
    // заправка.png физически содержат арт, противоположный своим именам — станция.png визуально
    // АЗС (бензоколонки, вывеска "АЗС"), заправка.png визуально ЖД-платформа ("Припять-1",
    // вагоны). Из-за этого текст `name` (взятый по имени файла) не совпадал с тем, что реально
    // нарисовано у игрока на экране. По прямому указанию с двумя скриншотами — меняем местами
    // ТОЛЬКО `name`, img не трогаем, чтобы текст совпадал с картинкой, а не с именем файла.
    { id:6, name:'Заправка',    img:'станция.png',     bossReq:6,  cost:150000  },
    { id:7, name:'Станция',     img:'заправка.png',    bossReq:7,  cost:1000000 },
];

export default class Hata {
    constructor(){
        this._win      = null;
        this._idx      = 0;
        this._bgSpr    = null;
        this._titleTxt = null;
        this._descTxt  = null;
        this._btnBuy   = null;
        this._btnSelP  = null;
        this._btnSelA  = null;
        this._leftSpr  = null;
        this._leftDis  = null;
        this._rightSpr = null;
        this._rightDis = null;
    }

    open(){
        console.log('[hata.open] called | _win:', this._win ? 'exists' : 'null', '| parent:', this._win && this._win.parent ? 'has' : 'none', '| layer2 children:', root.layer2_mc ? root.layer2_mc.children.length : 'N/A', '| iface._openModuleName:', window.iface ? iface._openModuleName : 'N/A');
        if(this._win && this._win.parent){
            console.log('[hata.open] already open — closing');
            this.close();
            return;
        }
        try {
            this._build();
        } catch(e){
            console.error('[hata.open] _build() FAILED:', e);
            return;
        }
        this._idx = parseInt(udata['base_bg_active']) || 0;
        if(this._idx !== 0 && !this._getOwned().includes(this._idx)) this._idx = 0;
        if(isNaN(this._idx) || this._idx < 0 || this._idx >= HATAS.length) this._idx = 0;
        try {
            this._render();
        } catch(e){
            console.error('[hata.open] _render() FAILED:', e);
        }
        root.layer2_mc.addChild(this._win);
        console.log('[hata.open] addChild done | _win.parent:', this._win.parent ? 'yes' : 'NO');
        if(window.iface){
            // Хата — полноэкранный фон в layer2_mc, перекрывает iface.up, если его не поднять поверх.
            if(iface.up)             root.addChild(iface.up);
            if(iface.down)           root.layer2_mc.addChild(iface.down);
            if(iface._pngRightPanel) root.layer2_mc.addChild(iface._pngRightPanel);
            if(iface._pngLeftPanel)  root.layer2_mc.addChild(iface._pngLeftPanel);
        }
        console.log('[hata.open] done | layer2 children after:', root.layer2_mc ? root.layer2_mc.children.length : 'N/A');
    }

    close(){
        console.log('[hata.close] called | _win.parent:', this._win && this._win.parent ? 'has' : 'none');
        if(this._win && this._win.parent) this._win.parent.removeChild(this._win);
        this._win = null;
        if(window.iface){
            if(iface.up)             root.addChild(iface.up);
            if(iface.down)           root.layer1_mc.addChild(iface.down);
            if(iface._pngRightPanel) root.layer1_mc.addChild(iface._pngRightPanel);
            if(iface._pngLeftPanel)  root.layer1_mc.addChild(iface._pngLeftPanel);
            // Сбрасываем чтобы следующий клик кнопки BASE не путался
            iface._openModuleName = null;
        }
    }

    _build(){
        console.log('[hata._build] building hata window');
        const win = new PIXI.Container();
        win.interactive = true;

        // Blocker — перехватывает клики сквозь фон
        const blocker = new PIXI.Graphics();
        blocker.beginFill(0, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // Задний фон хаты (растягиваем на всю игровую зону)
        const bgSpr = new PIXI.Sprite(PIXI.Texture.EMPTY);
        bgSpr.width = 1280; bgSpr.height = 604;
        win.addChild(bgSpr);
        this._bgSpr = bgSpr;

        // Персонаж (тело + надетые шмотки + кисти рук) — те же координаты/пропорции, что
        // и на главном экране (home.js), т.к. фон здесь тоже 1280×604. Чтобы игрок видел,
        // как он будет выглядеть на фоне выбранной локации, а не просто пустую комнату.
        const CHAR_DX = -224, CHAR_DY = -4;
        // 24.09.2026 (по прямому указанию — "в пропущенных местах тоже замени на новый файл"):
        // та же замена, что и в home.js — pers.png -> "персонаж который сидит.png".
        const persSpr = new PIXI.Sprite(PIXI.Texture.from('./images/персонаж который сидит.png'));
        persSpr.anchor.set(0, 0);
        persSpr.x = 730 + CHAR_DX; persSpr.y = 208 + CHAR_DY;
        persSpr.width = 273; persSpr.height = 389;
        win.addChild(persSpr);
        this._persSpr = persSpr;

        // 24.09.2026 (по прямому указанию — "хочу чтобы шмотка на голову была выше по
        // Z-индексу чем шмотка на тело"): Голова (cat:0) была ПЕРВОЙ — теперь стоит сразу
        // ПОСЛЕ Торса (см. тот же фикс в home.js CLOTH_SLOTS).
        const CHAR_SLOTS = [
            { cat: 3, x: 864 + CHAR_DX, y: 591 + CHAR_DY, centerX: true },  // Обувь — самый нижний слой ног
            { cat: 2, x: 893 + CHAR_DX, y: 358 + CHAR_DY, centerX: true },  // Штаны — выше Обуви
            { cat: 1, x: 804 + CHAR_DX, y: 258 + CHAR_DY },                 // Торс — выше Штанов
            { cat: 0, x: 871 + CHAR_DX, y: 195 + CHAR_DY, centerX: true },  // Голова — выше Торса
            { cat: 4, x: 882 + CHAR_DX, y: 414 + CHAR_DY },                 // Аксессуар
            { cat: 6, x: 856 + CHAR_DX, y: 418 + CHAR_DY },                 // Рука
        ];
        // Фаланги правой руки — те же координаты, что и на главном меню (home.js), т.к. эта
        // сцена использует тот же фон 1280×604 и тот же сдвиг CHAR_DX/CHAR_DY. Раньше их
        // тут не было вообще — добавлены были только на home.js.
        const rightHandPhalanxSpr = new PIXI.Sprite(PIXI.Texture.from('./images/фаланги правой руки.png'));
        rightHandPhalanxSpr.anchor.set(0, 0);
        rightHandPhalanxSpr.x = 634;
        rightHandPhalanxSpr.y = 441;
        this._charRightHandPhalanxSpr = rightHandPhalanxSpr;

        this._charSlots = {}; this._charSlotBases = {};
        CHAR_SLOTS.forEach(s => {
            if(s.cat === 6) win.addChild(rightHandPhalanxSpr);
            const spr = new PIXI.Sprite(PIXI.Texture.EMPTY);
            spr.anchor.set(s.centerX ? 0.5 : 0, s.cat === 3 ? 1 : 0);
            spr.x = s.x; spr.y = s.y;
            win.addChild(spr);
            this._charSlots[s.cat] = spr;
            this._charSlotBases[s.cat] = { x: s.x, y: s.y };
        });

        // Левое предплечье (24.09.2026, уточнено пользователем через редактор позиций на
        // home.js — x:515 y:327 scale:0.197 при persSpr там в 506,204, т.е. смещение
        // +9x/+123y от персонажа) — persSpr здесь тоже оказывается на 506,204 итоговых
        // экранных координатах (730+CHAR_DX, 208+CHAR_DY), поэтому то же смещение даёт
        // те же 515,327.
        const leftForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левое предплечье.png'));
        leftForearmSpr.anchor.set(0, 0);
        leftForearmSpr.x = 730 + 8 + CHAR_DX; leftForearmSpr.y = 208 + 120 + CHAR_DY;
        leftForearmSpr.scale.set(0.197);
        win.addChild(leftForearmSpr);
        this._leftForearmSpr = leftForearmSpr;

        const rightHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/правая рука.png'));
        rightHandSpr.anchor.set(0, 0);
        rightHandSpr.x = 862 - 8 + CHAR_DX; rightHandSpr.y = 373 + CHAR_DY;
        win.addChild(rightHandSpr);
        this._charRightHandSpr = rightHandSpr;

        const leftHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левая рука.png'));
        leftHandSpr.anchor.set(0, 0);
        leftHandSpr.x = 756 + 2 + CHAR_DX; leftHandSpr.y = 389 + CHAR_DY;
        win.addChild(leftHandSpr);
        this._charLeftHandSpr = leftHandSpr;

        // 25.09.2026 (уточнение по прямому указанию — то же, что в home.js): прошлое правило
        // "предмет в руке ВСЕГДА выше кистей" оказалось верно только для часов/цепи (надеты
        // НА руку) — позиционирование слота cat:6 теперь внутри _updateCharClothes() (по id
        // предмета), она вызывается из _render() каждый раз.

        // Попап-панель снизу (1280×142, Y=462 — вплотную к HUD)
        const popup = new PIXI.Sprite(PIXI.Texture.from('./images/покупка хаты попап.png'));
        popup.x = 0; popup.y = 462;
        win.addChild(popup);

        // Стрелка влево
        const leftDis = new PIXI.Sprite(PIXI.Texture.from('./images/когда влево больше нельзя.png'));
        leftDis.x = 417; leftDis.y = 506;
        win.addChild(leftDis);
        this._leftDis = leftDis;

        const leftSpr = new PIXI.Sprite(PIXI.Texture.from('./images/влево.png'));
        leftSpr.x = 417; leftSpr.y = 506;
        leftSpr.interactive = true; leftSpr.buttonMode = true;
        leftSpr.on('pointerover', ()=>{ _sa(leftSpr, 0.75); leftSpr.scale.set(1.08); });
        leftSpr.on('pointerout',  ()=>{ _sa(leftSpr, 1); leftSpr.scale.set(1); });
        leftSpr.on('pointerdown', ()=>this._nav(-1));
        win.addChild(leftSpr);
        this._leftSpr = leftSpr;

        // Стрелка вправо
        const rightDis = new PIXI.Sprite(PIXI.Texture.from('./images/когда вправо больше нельзя.png'));
        rightDis.x = 819; rightDis.y = 506;
        win.addChild(rightDis);
        this._rightDis = rightDis;

        const rightSpr = new PIXI.Sprite(PIXI.Texture.from('./images/стрелка вправо.png'));
        rightSpr.x = 819; rightSpr.y = 506;
        rightSpr.interactive = true; rightSpr.buttonMode = true;
        rightSpr.on('pointerover', ()=>{ _sa(rightSpr, 0.75); rightSpr.scale.set(1.08); });
        rightSpr.on('pointerout',  ()=>{ _sa(rightSpr, 1); rightSpr.scale.set(1); });
        rightSpr.on('pointerdown', ()=>this._nav(1));
        win.addChild(rightSpr);
        this._rightSpr = rightSpr;

        // Текст внутри карточки (X=485–806, Y=463–601)
        const styleTitle = {
            fontFamily:'Southbank LT', fontSize:20, fill:'#ffcc44',
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1,
        };
        const styleDesc = {
            fontFamily:'Southbank LT', fontSize:12, fill:'#c8b89a',
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1,
            wordWrap:true, wordWrapWidth:290, align:'center',
        };

        const titleTxt = new PIXI.Text('', styleTitle);
        titleTxt.anchor.set(0.5, 0.5);
        titleTxt.x = 645; titleTxt.y = 510;
        win.addChild(titleTxt);
        this._titleTxt = titleTxt;

        const descTxt = new PIXI.Text('', styleDesc);
        descTxt.anchor.set(0.5, 0.5);
        descTxt.x = 645; descTxt.y = 540;
        win.addChild(descTxt);
        this._descTxt = descTxt;

        // Кнопка «КУПИТЬ» (пассив — 132×24)
        const btnBuy = new PIXI.Sprite(PIXI.Texture.from('./images/кнопка купить пассив.png'));
        btnBuy.anchor.set(0.5, 0.5);
        btnBuy.x = 645; btnBuy.y = 566;
        btnBuy.interactive = true; btnBuy.buttonMode = true;
        btnBuy.visible = false;
        // 25.09.2026 (баг найден по прямому указанию + скриншот — "при наведении на КУПИТЬ
        // появляется какой-то непонятный файл, должна быть обычная тема с затемнением кнопки,
        // как везде"): раньше hover показывал отдельный файл-оверлей «купить актив.png»
        // (растянутый в прямоугольник под размер кнопки, визуально не похожий на саму кнопку) —
        // убран целиком. Теперь как у всех остальных кнопок этого попапа (btnSelP ниже) —
        // просто затемнение alpha самой кнопки.
        btnBuy.on('pointerover',  ()=>{ _sa(btnBuy, 0.75); btnBuy.scale.set(1.08); });
        btnBuy.on('pointerout',   ()=>{ _sa(btnBuy, 1); btnBuy.scale.set(1); });
        btnBuy.on('pointerdown',  ()=>this._buyHata());
        win.addChild(btnBuy);
        this._btnBuy = btnBuy;

        // Кнопка «ВЫБРАТЬ» пассив (132×24, уже куплено, не активно)
        const btnSelP = new PIXI.Sprite(PIXI.Texture.from('./images/кнопка выбрать пассив.png'));
        btnSelP.anchor.set(0.5, 0.5);
        btnSelP.x = 645; btnSelP.y = 566;
        btnSelP.interactive = true; btnSelP.buttonMode = true;
        btnSelP.visible = false;
        btnSelP.on('pointerover', ()=>{ _sa(btnSelP, 0.75); btnSelP.scale.set(1.08); });
        btnSelP.on('pointerout',  ()=>{ _sa(btnSelP, 1); btnSelP.scale.set(1); });
        btnSelP.on('pointerdown', ()=>this._selectHata());
        win.addChild(btnSelP);
        this._btnSelP = btnSelP;

        // Кнопка «ВЫБРАТЬ» актив (137×61, текущая хата)
        const btnSelA = new PIXI.Sprite(PIXI.Texture.from('./images/кнопка выбрать актив.png'));
        btnSelA.anchor.set(0.5, 0.5);
        btnSelA.x = 645; btnSelA.y = 560;
        btnSelA.visible = false;
        win.addChild(btnSelA);
        this._btnSelA = btnSelA;

        // Кнопка выхода
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this.close());
        win.addChild(exitBtn);

        this._win = win;
    }

    // Отрисовывает надетые шмотки на персонаже в превью локации — зеркалит
    // Home.updateClothes() (те же manDx/manDy/manScale/штаны_1-хак), 1 в 1 с главным экраном.
    _updateCharClothes(){
        if(!this._charSlots || !window.shmot) return;
        Object.keys(this._charSlots).forEach(cat => {
            const spr = this._charSlots[cat];
            const base = this._charSlotBases[cat];
            const eq = (shmot.items || []).find(it => it.cat === parseInt(cat) && it.equipped);
            if(eq && eq.imgFile){
                spr.texture = PIXI.Texture.from('./images/shmot/' + eq.imgFile);
                spr.visible = true;
                spr.x = base.x + (eq.manDx || 0);
                spr.y = base.y + (eq.manDy || 0) + (eq.imgFile === 'штаны_1.png' ? -28 : 0);
                spr.scale.set(eq.manScale || 1);
            } else {
                spr.texture = PIXI.Texture.EMPTY;
                spr.visible = false;
                spr.scale.set(1);
            }
            // Обычный предмет зажат справа; часы Poker и цепь Teenager поверх кисти.
            if(parseInt(cat) === 6 && this._charLeftHandSpr && this._charLeftHandSpr.parent === this._win){
                const weaponIdx = this._win.getChildIndex(this._charLeftHandSpr) + 1;
                this._win.addChildAt(spr, Math.min(weaponIdx, this._win.children.length));
                if(eq && (eq.id === 62 || eq.id === 92)) this._win.addChild(spr);
                else if(this._charRightHandSpr) this._win.addChildAt(this._charRightHandSpr, this._win.getChildIndex(spr) + 1);
            }
        });
    }

    _nav(dir){
        const newIdx = this._idx + dir;
        if(isNaN(newIdx) || newIdx < 0 || newIdx >= HATAS.length) return;
        this._idx = newIdx;
        this._render();
    }

    _render(){
        const h = HATAS[this._idx];
        let prog = parseInt(udata['hata_progress']);
        if(isNaN(prog)) prog = -1;
        // Второй независимый сигнал — счётчик убийств конкретного босса (boss_kills_N).
        // hata_progress появился позже как поле, и на старых сохранениях мог не проставиться
        // для уже побеждённых боссов. boss_kills_N инкрементируется при КАЖДОМ убийстве
        // (bosses-combat.js._onDefeat) с самого начала — используем его как страховку.
        const killedThisBoss = h.bossReq >= 0 && parseInt(udata['boss_kills_' + h.bossReq] || 0) > 0;
        const isUnlock = h.bossReq === -1 || prog >= h.bossReq || killedThisBoss;
        const owned    = this._getOwned();
        const isOwned  = owned.includes(h.id);
        let activeId = parseInt(udata['base_bg_active']);
        if(isNaN(activeId)) activeId = 0;
        const isActive = activeId === h.id;

        // Фон
        this._bgSpr.texture = PIXI.Texture.from('./images/' + h.img);
        const adj = BG_ADJUST[h.img] || { y: 0, scale: 1 };
        this._bgSpr.width  = 1280 * adj.scale;
        this._bgSpr.height = 604 * adj.scale;
        this._bgSpr.y = adj.y;

        this._updateCharClothes();

        // Стрелки
        const atLeft  = this._idx <= 0;
        const atRight = this._idx >= HATAS.length - 1;
        this._leftSpr.visible  = !atLeft;
        this._leftDis.visible  =  atLeft;
        this._rightSpr.visible = !atRight;
        this._rightDis.visible =  atRight;

        // Заголовок
        this._titleTxt.text = 'ЛОКАЦИЯ : ' + h.name.toUpperCase();

        // Сброс кнопок и оверлея
        this._btnBuy.visible   = false;
        this._btnSelP.visible  = false;
        this._btnSelA.visible  = false;

        if(!isUnlock){
            const bossNames = ['','Счастливчика','Ястреба','Меченного','Крыса','Баркута','Бороду','Жгута'];
            const bName = bossNames[h.bossReq] || (h.bossReq+1)+'-го босса';
            this._descTxt.text = 'Победи ' + bName + '\nдля разблокировки';
        } else if(h.id === 0 || isOwned){
            this._descTxt.text = isActive ? 'Твоя локация' : 'Локация куплена';
            if(!isActive) this._btnSelP.visible = true;
        } else {
            this._descTxt.text = 'Стоимость: ' + this._fmtCig(h.cost);
            this._btnBuy.visible = true;
        }
    }

    _fmtCig(n){
        if(n >= 1000000) return (n/1000000) + ' кк сигарет';
        if(n >= 1000)    return (n/1000) + ' тыс. сигарет';
        return n + ' сигарет';
    }

    _getOwned(){
        try{ return helper.safeParseJSON(udata['base_bg_owned'], [0]); }
        catch(e){ return [0]; }
    }

    // 22.09.2026 (по прямому указанию — баг "хата после покупки снова просит её купить, хоть
    // в ней и нахожусь"): раньше это был fire-and-forget TS.php('users.save', {...}, null,
    // null) — БЕЗ callback на успех/ошибку, udata менялся оптимистично ДО ответа сервера. Если
    // этот конкретный users.save тихо не сохранялся, следующая свежая загрузка откатывала
    // владение. Теперь покупка/выбор идут через server-authoritative hata.buy/hata.select
    // (server/core/controllers/hata.php) — сервер сам списывает сигареты и пишет владение,
    // клиент применяет ответ только после реального подтверждения.
    _buyHata(){
        const h = HATAS[this._idx];
        if(this._hataReqInFlight) return;
        this._hataReqInFlight = true;
        console.log('[hata._buyHata] → сервер: hata.buy | loc_id:', h.id);
        // 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits): hata.buy()
        // списывает cigarettes напрямую на сервере — окно запроса нужно перекрыть suspend/resume.
        if(window.suspendPlayerSave) suspendPlayerSave('hata_buy');
        TS.php('hata.buy', {loc_id: h.id}, (res) => {
            this._hataReqInFlight = false;
            console.log('[hata._buyHata] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch){
                console.error('[hata._buyHata] некорректный ответ сервера (нет patch), покупка НЕ применена:', JSON.stringify(res));
                if(window.resumePlayerSave) resumePlayerSave('hata_buy');
                notify.showResult({text:'Не удалось купить локацию'}, 0);
                return;
            }
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('hata_buy');
            notify.showResult({text:'Локация «' + h.name + '» куплена!'}, 1);
            if(window.home) home.updateBg();
            this._render();
        }, (err) => {
            this._hataReqInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('hata_buy');
            console.error('[hata._buyHata] ← ошибка сервера:', JSON.stringify(err));
            // Коды: 50 — не хватает сигарет, 52 — уже куплено, 94 — нужный босс ещё не побеждён.
            if(err && err.code === 50){
                notify.showResult({text:'Нужно ' + this._fmtCig(h.cost) + '! Есть: ' + this._fmtCig(parseInt(udata['cigarettes']||0))}, 0);
            } else {
                notify.showResult({text:'Не удалось купить локацию'}, 0);
            }
        });
    }

    _selectHata(){
        const h = HATAS[this._idx];
        if(this._hataReqInFlight) return;
        this._hataReqInFlight = true;
        console.log('[hata._selectHata] → сервер: hata.select | loc_id:', h.id);
        TS.php('hata.select', {loc_id: h.id}, (res) => {
            this._hataReqInFlight = false;
            console.log('[hata._selectHata] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch){
                console.error('[hata._selectHata] некорректный ответ сервера (нет patch), выбор НЕ применён:', JSON.stringify(res));
                notify.showResult({text:'Не удалось выбрать локацию'}, 0);
                return;
            }
            applyPatch(res.patch);
            notify.showResult({text:'Локация «' + h.name + '» выбрана!'}, 1);
            if(window.home) home.updateBg();
            this._render();
        }, (err) => {
            this._hataReqInFlight = false;
            console.error('[hata._selectHata] ← ошибка сервера:', JSON.stringify(err));
            notify.showResult({text:'Не удалось выбрать локацию'}, 0);
        });
    }
}

/** Попап «Купить ключ» — показывается, когда игроку не хватает ключей на босса, который
 * продаёт их за рубли (Счастливчик/id1/3р, Ястреб/id2/6р, Меченный/id3/18р — остальные боссы
 * ключи не продают, buy_key===0). Показывает иконку нужного ключа и кнопку «Купить за N»,
 * которая списывает рубли и начисляет 1 ключ через сервер (bosses.buyKey, см.
 * bosses.js._buyKey()) — покупка не ограничена по количеству, цена не растёт от повторных
 * покупок (тот же клик открывает новую покупку на актуальную цену).
 *
 * 29.09.2026, по прямому указанию — новые ассеты добавлены пользователем локально:
 * "попап купить ключ.png" (фон), "кнопка купить ключи.png" (кнопка), "ключ счастливчик.png"/
 * "ключ ястреб.png"/"ключ меченный.png" (иконки). Координаты фона/кнопки/иконки ключа и стиль
 * подписи "Купить за"/цены — те же, что уже использует попап перезарядки бесплатного оружия
 * (weapon_reload_popup.js) для "Ускорить за 20", по прямому указанию — переиспользовать один
 * и тот же стиль/координаты подписи и цены.
 */
export function attachBuyKeyPopup(proto){
    const BASE = './images/';
    const KEY_ICON_FILE = {
        1: BASE + 'ключ счастливчик.png',
        2: BASE + 'ключ ястреб.png',
        3: BASE + 'ключ меченный.png',
    };
    const KEY_ICON_SCALE = 0.184;

    proto._openBuyKeyPopup = function(bossIdx){
        const d = this.data[bossIdx];
        const cost = (d && d.buy_key) || 0;
        if(!cost){
            console.error('[buy_key_popup._openBuyKeyPopup] boss_id=' + bossIdx + ' не продаёт ключи (buy_key=0)');
            return;
        }

        if(!this._buyKeyWin) this._buildBuyKeyPopup();

        this._buyKeyBossIdx = bossIdx;
        const tex = PIXI.Texture.from(KEY_ICON_FILE[bossIdx] || KEY_ICON_FILE[1]);
        this._buyKeyWin.keyIcon.texture = tex;
        this._buyKeyWin.keyIcon.scale.set(KEY_ICON_SCALE);
        this._buyKeyWin.costTxt.text = String(cost);

        root.layer2_mc.addChild(this._buyKeyWin);
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
        console.log('[buy_key_popup._openBuyKeyPopup] открыт | bossIdx=' + bossIdx + ' cost=' + cost);
    };

    proto._closeBuyKeyPopup = function(){
        if(this._buyKeyWin && this._buyKeyWin.parent) this._buyKeyWin.parent.removeChild(this._buyKeyWin);
    };

    proto._buildBuyKeyPopup = function(){
        const win = new PIXI.Container();
        win.interactive = true;

        // Полноэкранный блокер — гасит клики по бою/списку боссов за попапом (тот же приём,
        // что и в weapon_reload_popup.js).
        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // Фон попапа — позиция задана пользователем напрямую (29.09.2026).
        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап купить ключ.png'));
        bg.x = 405; bg.y = 175;
        win.addChild(bg);

        // Иконка нужного ключа — позиция задана пользователем напрямую (29.09.2026), ширина
        // scale=0.184 (нативно даёт 50×67px).
        const keyIcon = new PIXI.Sprite(PIXI.Texture.from(KEY_ICON_FILE[1]));
        keyIcon.anchor.set(0.5, 0.5);
        keyIcon.x = 662; keyIcon.y = 350;
        win.addChild(keyIcon);
        win.keyIcon = keyIcon;

        // Подпись «Купить за» + цена — те же координаты/стиль, что "Ускорить за"/"20" в попапе
        // перезарядки бесплатного оружия (по прямому указанию — переиспользовать один в один).
        const buyLabelTxt = new PIXI.Text('Купить за', {
            fontFamily: 'Southbank LT', fontSize: 20, fontWeight: 'normal', fill: '#ffee88',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        buyLabelTxt.anchor.set(0, 0.5);
        buyLabelTxt.x = 559; buyLabelTxt.y = 415;
        buyLabelTxt.scale.set(0.908);
        win.addChild(buyLabelTxt);

        const costTxt = new PIXI.Text('', {
            fontFamily: 'Southbank LT', fontSize: 20, fontWeight: 'normal', fill: '#ffee88',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        costTxt.anchor.set(1, 0.5);
        costTxt.x = 671; costTxt.y = 415;
        costTxt.scale.set(1.000);
        win.addChild(costTxt);
        win.costTxt = costTxt;

        const coinIcon = new PIXI.Sprite(PIXI.Texture.from(BASE + 'монеты эмблема.png'));
        coinIcon.x = 673; coinIcon.y = 403;
        win.addChild(coinIcon);

        // Кнопка «Купить ключи» — позиция задана пользователем напрямую (29.09.2026). Списывает
        // buy_key рублей и начисляет 1 ключ на сервере (bosses.js._buyKey()).
        const buyBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'кнопка купить ключи.png'));
        buyBtn.x = 707; buyBtn.y = 392;
        buyBtn.interactive = true; buyBtn.buttonMode = true;
        // 29.09.2026 (по прямому указанию — "для всех кнопок небольшой hover эффект увеличения
        // scale"): к альфа-затемнению добавлено лёгкое увеличение scale при наведении (×1.08),
        // базовый scale запоминается на самом объекте (buyBtn.scale.x уже 1 по умолчанию —
        // явных .scale.set() у этой кнопки не было, поэтому базой служит 1).
        buyBtn.on('pointerover', () => { _sa(buyBtn, 0.85); _ss(buyBtn, 1.08); });
        buyBtn.on('pointerout',  () => { _sa(buyBtn, 1); _ss(buyBtn, 1); });
        buyBtn.on('pointerdown', () => {
            if(this._buyKeyBossIdx === undefined || this._buyKeyBossIdx === null) return;
            this._buyKey(this._buyKeyBossIdx);
        });
        win.addChild(buyBtn);

        // Крестик выхода — 29.09.2026 (по прямому указанию, новый выделенный ассет вместо общего
        // "layers/popups/bosses/exit.png"): "выход попап покупки ключей и кд оружия.png",
        // используется ОБОИМИ попапами (этим и weapon_reload_popup.js), координаты x:861 y:196.
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'выход попап покупки ключей и кд оружия.png'));
        exitBtn.x = 861; exitBtn.y = 196;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { _sa(exitBtn, 0.75); _ss(exitBtn, 1.08); });
        exitBtn.on('pointerout',  () => { _sa(exitBtn, 1); _ss(exitBtn, 1); });
        exitBtn.on('pointerdown', () => { this._closeBuyKeyPopup(); });
        win.addChild(exitBtn);

        this._buyKeyWin = win;
    };
}

/** Попап «Перезарядка» — показывается, когда бесплатное оружие (нож/цепь/бита) ещё на
 * 6-часовом кулдауне. Показывает обратный отсчёт и кнопку «Ускорить за 20», которая тратит
 * 20 рублей и мгновенно снимает кулдаун конкретно ЭТОГО оружия — через сервер
 * (bosses.rushFreeWeapon, см. bosses-combat.js._rushFreeWeaponCd()), не на клиенте.
 *
 * 26.09.2026, по прямому указанию — новые ассеты добавлены пользователем локально:
 * "попап обновления бесплатного оружия.png" (фон 513×292), "попап перезарядки нож/цепь/
 * бита.png" (иконки оружия), "попап перезарядки кнопка ускорить.png" (кнопка). Координаты
 * сняты пользователем через универсальный редактор позиций (скриншоты X/Y-полей).
 */
export function attachWeaponReloadPopup(proto){
    const BASE = './images/';
    const WEAPON_ICON_FILE = {
        0: BASE + 'попап перезарядки нож.png',
        1: BASE + 'попап перезарядки цепь.png',
        2: BASE + 'попап перезарядки бита.png',
    };
    const RUSH_COST = 20;

    proto._openWeaponReloadPopup = function(weaponId){
        if(!this._weaponReloadWin) this._buildWeaponReloadPopup();

        this._weaponReloadWeaponId = weaponId;
        this._weaponReloadWin.weaponIcon.texture = PIXI.Texture.from(WEAPON_ICON_FILE[weaponId] || WEAPON_ICON_FILE[0]);

        this._updateWeaponReloadTimer();
        if(this._weaponReloadInterval) clearInterval(this._weaponReloadInterval);
        this._weaponReloadInterval = setInterval(() => this._updateWeaponReloadTimer(), 1000);

        root.layer2_mc.addChild(this._weaponReloadWin);
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
        console.log('[weapon_reload_popup._openWeaponReloadPopup] открыт | weaponId=' + weaponId);
    };

    proto._closeWeaponReloadPopup = function(){
        if(this._weaponReloadInterval){ clearInterval(this._weaponReloadInterval); this._weaponReloadInterval = null; }
        if(this._weaponReloadWin && this._weaponReloadWin.parent) this._weaponReloadWin.parent.removeChild(this._weaponReloadWin);
    };

    // Обновляет текст обратного отсчёта раз в секунду; закрывает попап сам, как только КД
    // истёк (например, игрок просто держал попап открытым и дождался) — без лишнего клика.
    proto._updateWeaponReloadTimer = function(){
        if(!this._weaponReloadWin || !this._weaponReloadWin.parent) return;
        // 28.09.2026: КД теперь общий на все три бесплатных оружия — обратный отсчёт читает
        // общий таймер (_freeWpnSharedLastUse(), bosses-combat.js), а не отдельный ключ этого
        // конкретного оружия (иначе счётчик тут же уходил бы в 0, хотя другое бесплатное оружие
        // ещё держит откат и попап был открыт именно из-за него).
        const lastUse = this._freeWpnSharedLastUse();
        const remain = lastUse > 0 ? (this.FREE_WPN_CD_MS - (Date.now() - lastUse)) : 0;
        if(remain <= 0){
            this._closeWeaponReloadPopup();
            return;
        }
        const s = Math.ceil(remain / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        const pad = n => String(n).padStart(2, '0');
        this._weaponReloadWin.timerTxt.text = pad(h) + ':' + pad(m) + ':' + pad(sec);
    };

    proto._buildWeaponReloadPopup = function(){
        const win = new PIXI.Container();
        win.interactive = true;

        // Полноэкранный блокер — гасит клики по бою за попапом
        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // Фон попапа (513×292) — позиция снята редактором позиций (26.09.2026, по прямому указанию).
        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап обновления бесплатного оружия.png'));
        bg.x = 405; bg.y = 175;
        win.addChild(bg);

        // Обратный отсчёт — накладывается на пустое место строки "Будет доступно через" в PNG.
        // 26.09.2026 (по прямому указанию — "сделай шрифтом, которым сделан никнейм босса"):
        // fontWeight:'normal' явно, как у bossNameTxt (bosses_fight.js) — тот же приём.
        const timerTxt = new PIXI.Text('', {
            fontFamily: 'Southbank LT', fontSize: 20, fontWeight: 'normal', fill: '#ffdd44',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        timerTxt.anchor.set(0, 0.5);
        // 26.09.2026: позиция снята пользователем через редактор позиций.
        timerTxt.x = 738; timerTxt.y = 280;
        win.addChild(timerTxt);
        win.timerTxt = timerTxt;

        // Иконка оружия, которое сейчас на кулдауне — по центру "пергаментного" квадрата фона.
        const weaponIcon = new PIXI.Sprite(PIXI.Texture.from(WEAPON_ICON_FILE[0]));
        weaponIcon.x = 633; weaponIcon.y = 315;
        win.addChild(weaponIcon);
        win.weaponIcon = weaponIcon;

        // Подпись «Ускорить за» — над ценой/кнопкой. Позиция снята пользователем через
        // редактор позиций (26.09.2026, второй снимок в тот же день — было 537/398/0.721).
        const rushLabelTxt = new PIXI.Text('Ускорить за', {
            fontFamily: 'Southbank LT', fontSize: 20, fontWeight: 'normal', fill: '#ffee88',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        rushLabelTxt.anchor.set(0, 0.5);
        rushLabelTxt.x = 541; rushLabelTxt.y = 415;
        rushLabelTxt.scale.set(0.908);
        win.addChild(rushLabelTxt);

        // Цена ускорения: "20" + иконка монет — слева от кнопки «Ускорить». Позиция снята
        // редактором позиций (26.09.2026, второй снимок в тот же день — было 671/414).
        const costTxt = new PIXI.Text(String(RUSH_COST), {
            fontFamily: 'Southbank LT', fontSize: 20, fontWeight: 'normal', fill: '#ffee88',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        costTxt.anchor.set(1, 0.5);
        costTxt.x = 671; costTxt.y = 415;
        costTxt.scale.set(1.000);
        win.addChild(costTxt);

        const coinIcon = new PIXI.Sprite(PIXI.Texture.from(BASE + 'монеты эмблема.png'));
        coinIcon.x = 673; coinIcon.y = 403;
        win.addChild(coinIcon);

        // Кнопка «Ускорить» — списывает 20 рублей и сбрасывает КД этого оружия на сервере.
        const rushBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап перезарядки кнопка ускорить.png'));
        rushBtn.x = 713; rushBtn.y = 394;
        rushBtn.interactive = true; rushBtn.buttonMode = true;
        // 29.09.2026 (по прямому указанию — "для всех кнопок небольшой hover эффект увеличения
        // scale"): к альфа-затемнению добавлено лёгкое увеличение scale при наведении (×1.08).
        // 30.09.2026 (прогон перед деплоем — выравнено со стилем buy_key_popup.js): плавные
        // _sa/_ss (ui_kit.js) вместо мгновенного присваивания — тот же "один и тот же стиль",
        // что и заявлен в шапке файла, теперь верно для обоих попапов.
        rushBtn.on('pointerover', () => { _sa(rushBtn, 0.85); _ss(rushBtn, 1.08); });
        rushBtn.on('pointerout',  () => { _sa(rushBtn, 1); _ss(rushBtn, 1); });
        rushBtn.on('pointerdown', () => {
            if(this._weaponReloadWeaponId === undefined || this._weaponReloadWeaponId === null) return;
            this._rushFreeWeaponCd(this._weaponReloadWeaponId, () => this._closeWeaponReloadPopup());
        });
        win.addChild(rushBtn);

        // Крестик выхода — 29.09.2026 (по прямому указанию, новый выделенный ассет вместо общего
        // "layers/popups/bosses/exit.png"): "выход попап покупки ключей и кд оружия.png",
        // используется ОБОИМИ попапами (этим и buy_key_popup.js), координаты x:861 y:196 (было
        // 865/200 со старым ассетом exit.png и scale 0.597 — новый ассет уже нужного размера,
        // отдельный scale не нужен).
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'выход попап покупки ключей и кд оружия.png'));
        exitBtn.x = 861; exitBtn.y = 196;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { _sa(exitBtn, 0.75); _ss(exitBtn, 1.08); });
        exitBtn.on('pointerout',  () => { _sa(exitBtn, 1); _ss(exitBtn, 1); });
        exitBtn.on('pointerdown', () => { this._closeWeaponReloadPopup(); });
        win.addChild(exitBtn);

        this._weaponReloadWin = win;
    };
}

/** Reward popup — icon cards (objects) or text lines (strings). */

// 19.09.2026 (по прямому указанию) — числа от 1000 и выше сокращаются буквой "К" (тысячи),
// последние 3 цифры отбрасываются целиком (без округления до сотен) — так задумано:
// "одна буква К заменяет три ноля". Пример: 20000 опыта → "20К", 1897 → "1К" (эта функция
// применяется ТОЛЬКО к суммам наград в попапе, не к произвольным игровым цифрам вроде "Сила").
export function formatRewardAmount(n){
    n = parseInt(n) || 0;
    if(n >= 1000) return Math.floor(n / 1000) + 'К';
    return String(n);
}

export function attachRewardPopup(proto){
    const ICON_MAP = {
        exp:              'попап награда опыт.png',
        cig:              'попап награда сигареты.png',
        cigarettes:       'попап награда сигареты.png',
        auto:             'попап награда автомат.png',
        gun:              'попап награда ствол.png',
        machete:          'попап награда мачете.png',
        red_points:       'попап награда красный поинт.png',
        respect:          'попап награда уважение.png',
        stash:            'попап награда заначки.png',
        habar:            'попап награда заначки.png',
        coins:            'попап награда рубли.png',
        shmot:            'попап награда шмотка.png',
        tatu:             'попап награда тату.png',
        stew:             'попап награда тушенка.png',
        energy:           'попап награда энергия.png',
        heal:             'попап награда опыт.png',
        ammo_gun:         'попап награда ствол.png',
        ammo_auto:        'попап награда автомат.png',
        ammo_machete:     'попап награда мачете.png',
        poker_chips:      'попап награда фишка.png',
        poker_spichki:    'попап награда фишка.png',
        blue_points:      'попап награда синий поинт.png',
        roulette_spichki: 'попап награда синий поинт.png',
        dice_points:      'попап награда красный поинт.png',
        damage:           'попап награда урон.png',
        // Ключи рюкзака всегда приходят с конкретным boss_key_N — карточка и подпись ниже
        // показывают именно того босса, для которого выпал ключ.
        boss_key_1:       'попап награда ключ счастливчик.png',
        boss_key_2:       'попап награда ключ ястреб.png',
        boss_key_3:       'попап награда ключ меченный.png',
        boss_key_4:       'попап награда ключ крыс.png',
        boss_key_5:       'попап награда ключ баркут.png',
        boss_key_6:       'попап награда ключ борода.png',
        boss_key_7:       'попап награда ключ жгут.png',
    };
    const KEY_BOSS_NAMES = {
        boss_key_1: 'Счастливчик',
        boss_key_2: 'Ястреб',
        boss_key_3: 'Меченный',
        boss_key_4: 'Крыс',
        boss_key_5: 'Баркут',
        boss_key_6: 'Борода',
        boss_key_7: 'Жгут',
    };
    const BASE = './images/';

    proto._showRewardPopup = function(items, onClose){
        console.log('[reward] _showRewardPopup called, items:', JSON.stringify(items));
        if(this._rewardWin && this._rewardWin.parent){
            this._rewardWin.parent.removeChild(this._rewardWin);
        }
        if(this._rewardTimer){ clearTimeout(this._rewardTimer); this._rewardTimer = null; }

        const win = new PIXI.Container();
        win.interactive = true;

        const _closePopup = ()=>{
            if(win.parent) win.parent.removeChild(win);
            this._rewardWin = null;
            if(this._rewardTimer){ clearTimeout(this._rewardTimer); this._rewardTimer = null; }
            if(this._rewardHiddenExitBtns){
                this._rewardHiddenExitBtns.forEach(b => { b.visible = true; });
                this._rewardHiddenExitBtns = null;
            }
            if(onClose) onClose();
        };

        // Пока открыт попап награды, крестик/кнопка выхода экрана под ним не должны быть
        // видны — их просвечивало сквозь полупрозрачный оверлей попапа (репорт с экрана
        // рюкзака, но правим универсально — для ЛЮБОГО экрана, где вызывается попап награды).
        this._rewardHiddenExitBtns = [];
        const _hideUnderlyingExitBtns = (node) => {
            if(!node || !node.children) return;
            for(const child of node.children){
                if(child === win) continue;
                if(child.visible && child instanceof PIXI.Sprite){
                    const url = child.texture && child.texture.baseTexture && child.texture.baseTexture.resource
                        ? (child.texture.baseTexture.resource.url || '') : '';
                    if(/выход\.png|btn_exit\.png/i.test(url)){
                        this._rewardHiddenExitBtns.push(child);
                        child.visible = false;
                    }
                }
                _hideUnderlyingExitBtns(child);
            }
        };
        if(root.layer2_mc) _hideUnderlyingExitBtns(root.layer2_mc);
        if(root.layer1_mc) _hideUnderlyingExitBtns(root.layer1_mc);

        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.6);
        overlay.drawRect(0, 0, 1280, 720);
        overlay.endFill();
        overlay.interactive = true;

        win.addChild(overlay);

        const popup = new PIXI.Container();
        popup.x = 640;
        win.addChild(popup);

        // Определяем режим (иконки vs текст) до выбора фона
        const isIcons = items.length > 0 && typeof items[0] === 'object' && items[0] !== null && 'type' in items[0];

        // Count-файлы — отдельная правая иллюстрация, а не замена основной рамки.
        const BG_BY_COUNT = {
            1: 'попап награда если 1 награда.png',
            2: 'попап награда если 2 награды.png',
            3: 'попап награда если 3 награды.png',
            4: 'попап награда если 4 награды.png',
        };
        const useCountBg = isIcons && items.length >= 1 && items.length <= 4;
        const bgFile  = 'попап награда.png';
        const bgScale = 0.675;
        console.log('[reward] bg:', bgFile, 'count illustration:', useCountBg ? BG_BY_COUNT[items.length] : 'none', 'count:', items.length);

        // Background
        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + bgFile));
        bg.anchor.set(0.5, 0.5);
        bg.scale.set(bgScale);
        bg.interactive = true;
        popup.addChild(bg);

        const _dbgTex = bg.texture;
        console.log('[reward] bg sprite tex valid:', _dbgTex.valid, 'w:', _dbgTex.width, 'h:', _dbgTex.height, 'baseValid:', _dbgTex.baseTexture.valid);

        // Позиции кнопок: новые фоны ниже по высоте (~231px полувысота vs 308 у старого)
        const closeBtnY = -290;
        const takeBtnY  = 246;

        // Кнопка закрытия (X) — правый верхний угол попапа

        popup.scale.set(0.765);
        popup.y = 328;

        if(isIcons){
            // Icon-based: each item = {type, amount}
            // 5 карточек видно одновременно, scale подобран под ширину попапа (950px)
            const CARD_SCALE = 0.6810;
            const CARD_H = 411 * CARD_SCALE;
            const SLOT_W  = 174;
            const MAX_VIS = 5;
            const ITEM_Y  = 2;

            // Размеры и положение из макета Photoshop. Общая линия центра
            // иллюстраций (Y=560 в макете) совмещена с центром карточек.
            // Иллюстрация — отдельный слой под карточками, вне маски прокрутки.
            if(useCountBg){
                const layouts = {
                    1: { x:397, y:326, w:910, h:464 },
                    2: { x:640, y:375, w:726, h:370 },
                    3: { x:833, y:432, w:532, h:271 },
                    4: { x:664, y:386, w:725, h:370 },
                };
                const layout = layouts[items.length];
                const countArt = new PIXI.Sprite(PIXI.Texture.from(BASE + BG_BY_COUNT[items.length]));
                if(items.length === 4){
                    // Замерено вручную через редактор позиций — формула через layouts[4] давала
                    // заметно другой (более крупный и смещённый) результат.
                    countArt.x = 41; countArt.y = -91;
                    countArt.width = 390; countArt.height = 199;
                } else if(items.length === 3){
                    // Замерено вручную через редактор позиций (16.09.2026, по прямому указанию) —
                    // формула через layouts[3] давала x чуть правее нужного.
                    countArt.x = 69; countArt.y = -72;
                    countArt.width = 354; countArt.height = 180;
                } else {
                    countArt.x = (layout.x - 1408 / 2) * bgScale;
                    countArt.y = ITEM_Y + 12 + (layout.y - 560) * bgScale;
                    countArt.width = layout.w * bgScale;
                    countArt.height = layout.h * bgScale;
                }
                countArt.interactive = false;
                popup.addChild(countArt);
                console.log('[reward.countArt] наград:', items.length, 'x:', countArt.x, 'y:', countArt.y, 'w:', countArt.width, 'h:', countArt.height);
            }

            const itemsWrap = new PIXI.Container();
            popup.addChild(itemsWrap);

            const maskGfx = new PIXI.Graphics();
            maskGfx.beginFill(0xffffff);
            maskGfx.drawRect(-MAX_VIS * SLOT_W / 2, ITEM_Y - CARD_H / 2 - 5, MAX_VIS * SLOT_W, CARD_H + 80);
            maskGfx.endFill();
            popup.addChild(maskGfx);
            itemsWrap.mask = maskGfx;

            // Всегда используем пять фиксированных слотов. Пустые слоты не сдвигают награды.
            const _slotX = (slot) => -(MAX_VIS - 1) * SLOT_W / 2 + slot * SLOT_W;
            items.forEach((item, i) => {
                const slotX = _slotX(i);
                const imgFile = ICON_MAP[item.type] || 'попап награда опыт.png';
                const bossName = KEY_BOSS_NAMES[item.type];

                const icon = new PIXI.Sprite(PIXI.Texture.from(BASE + imgFile));
                icon.anchor.set(0.5, 0.5);
                // 27.09.2026 (по прямому указанию — "у ячейки энергии виден прозрачный отступ
                // справа"): PNG энергии на самом деле был 281×411 с ~45px пустого прозрачного
                // поля справа от самого рисунка (реальный контент — 236×411, тот же размер, что
                // и у остальных карточек) — растягивание всего холста под явные width/height
                // (как было раньше) растягивало и эту пустоту вместе с рисунком, отсюда зазор.
                // Файл обрезан по фактическому контенту (236×411) — теперь размер идентичен
                // остальным карточкам, спецкейс с explicit width/height больше не нужен.
                icon.scale.set(CARD_SCALE);
                icon.x = slotX; icon.y = ITEM_Y + 12;
                itemsWrap.addChild(icon);

                const amtLabel = bossName
                    ? '+' + formatRewardAmount(item.amount) + '\n' + bossName
                    : '+' + formatRewardAmount(item.amount);
                const amtTxt = new PIXI.Text(amtLabel, {
                    fontFamily: 'Southbank LT', fontSize: bossName ? 24 : 34, fill: '#a58165',
                    dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
                    align: 'center',
                });
                amtTxt.anchor.set(0.5, 0);
                amtTxt.rotation = 0;
                const _TXT_OFF = {
                    gun:          { dx: -4, dy:  0 }, ammo_gun:     { dx: -4, dy:  0 },
                    cig:          { dx: -8, dy:  0 }, cigarettes:   { dx: -8, dy:  0 },
                    coins:        { dx: -6, dy:  0 },
                    exp:          { dx: -2, dy:  0 }, energy:       { dx: 12, dy:  0 }, heal: { dx: 12, dy:  0 },
                    machete:      { dx: -2, dy: 0 }, ammo_machete: { dx: -2, dy: 0 },
                    auto:         { dx: 0, dy: 0 }, ammo_auto:    { dx: 0, dy: 0 },
                };
                const _off = _TXT_OFF[item.type] || { dx: 0, dy: 0 };
                amtTxt.x = slotX + 2 + _off.dx;
                amtTxt.y = ITEM_Y + CARD_H / 2 - 38 - (bossName ? 10 : 6) + _off.dy;
                itemsWrap.addChild(amtTxt);
            });

            if(items.length > MAX_VIS){
                const minX = -(items.length - MAX_VIS) * SLOT_W;
                let _curX = 0;

                const _leftArr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап награда стрелка влево.png'));
                _leftArr.anchor.set(0.5, 0.5);
                _leftArr.scale.set(0.75);
                _leftArr.x = -449; _leftArr.y = 32;
                _leftArr.interactive = true; _leftArr.buttonMode = true;
                popup.addChild(_leftArr);

                const _rightArr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап награда стрелка вправо.png'));
                _rightArr.anchor.set(0.5, 0.5);
                _rightArr.scale.set(0.75);
                _rightArr.x = 462; _rightArr.y = 32;
                _rightArr.interactive = true; _rightArr.buttonMode = true;
                popup.addChild(_rightArr);

                const _updArr = () => {
                    _leftArr.alpha  = (_curX < 0)      ? 1 : 0.35;
                    _rightArr.alpha = (_curX > minX)   ? 1 : 0.35;
                };
                _updArr();

                _leftArr.on('pointerdown', () => {
                    _curX = Math.min(0, _curX + SLOT_W);
                    gsap.to(itemsWrap, { x: _curX, duration: 0.35, ease: 'power2.out' });
                    _updArr();
                });
                _rightArr.on('pointerdown', () => {
                    _curX = Math.max(minX, _curX - SLOT_W);
                    gsap.to(itemsWrap, { x: _curX, duration: 0.35, ease: 'power2.out' });
                    _updArr();
                });
            }
        } else {
            // Text-based display
            const txtStyle = {
                fontFamily: 'Southbank LT', fontSize: 26, fill: '#ffcc44',
                dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2,
                wordWrap: true, wordWrapWidth: 900, align: 'center'
            };
            const startY = -(items.length - 1) * 22;
            items.forEach((line, i) => {
                const t = new PIXI.Text(typeof line === 'string' ? line : String(line), txtStyle);
                t.anchor.set(0.5, 0.5);
                t.x = 0; t.y = startY + i * 44 - 20;
                popup.addChild(t);
            });
        }

        // ЗАБРАТЬ button
        const takeBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап награда кнопка забрать.png'));
        takeBtn.anchor.set(0.5, 0.5);
        takeBtn.scale.set(0.9);
        takeBtn.x = 0; takeBtn.y = takeBtnY;
        takeBtn.interactive = true; takeBtn.buttonMode = true;
        takeBtn.on('pointerover', ()=>{ takeBtn.alpha = 0.8; });
        takeBtn.on('pointerout',  ()=>{ takeBtn.alpha = 1; });
        takeBtn.on('pointerdown', _closePopup);
        popup.addChild(takeBtn);


        this._rewardWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();
    };
}

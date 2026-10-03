import { applyPatch } from '../../modules/patch.js';

/** Покер — экран сумки (покупка и открытие). */
export function attachPokerBag(proto){

    proto._openPokerBagScreen = function(){
        if(this._pokerBagWin && this._pokerBagWin.parent){
            this._pokerBagWin.parent.removeChild(this._pokerBagWin);
        }
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0,0,1280,720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // 18.09.2026: нативный размер файла 1280×690 — вставляется без масштабирования.
        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/poker_bag.png'));
        bg.y = 15;
        win.addChild(bg);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 90;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>{
            if(win.parent) win.parent.removeChild(win);
            this._pokerBagWin = null;
            if(window.iface) iface.restoreHud();
        });
        win.addChild(exitBtn);

        // 27.09.2026 (по прямому указанию, скриншоты — "2200 на экране покера vs 60 в сумке"):
        // читалась чужая валюта roulette_spichki (спички рулетки, тратятся на кейс рулетки) —
        // должна быть poker_spichki (спички покера, та же, что показывает счётчик на самом
        // экране покера и что реально списывает сервер, см. poker.php.openBag()).
        const spichkiCount = parseInt(udata['poker_spichki']||0);
        const spTxt = new PIXI.Text(String(spichkiCount), {
            fontFamily:'Southbank LT', fontSize:28, fill:'#88ccff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        // 03.10.2026 (редактор позиций): было x:240,y:288, без scale.
        spTxt.anchor.set(0.5, 0);
        spTxt.x = 241; spTxt.y = 283; spTxt.scale.set(1.265);
        win.addChild(spTxt);

        const _spichkiNow = parseInt(udata['poker_spichki']||0);
        const _canOpen   = _spichkiNow >= 150;
        const openBtn = new PIXI.Sprite(PIXI.Texture.from(
            _canOpen ? './images/poker_bag_btn_activ.png' : './images/poker_bag_btn.png'
        ));
        openBtn.anchor.set(0.5, 0);
        openBtn.x = 608; openBtn.y = 218;
        openBtn.interactive = true; openBtn.buttonMode = true;
        openBtn.on('pointerover', ()=>{ _sa(openBtn, 0.85); openBtn.scale.set(1.08); });
        openBtn.on('pointerout', ()=>{ _sa(openBtn, 1); openBtn.scale.set(1); });
        openBtn.on('pointerdown', ()=>{
            const cost = 150;
            const have = parseInt(udata['poker_spichki']||0);
            if(have < cost){ if(window.iface) iface._openSidorovichError('Недостаточно голубых спичек!', 'Нужно: ' + cost + ' • У вас: ' + have); return; }
            // 22.09.2026 (по прямому указанию — "нет попап предупреждение стоимости открытия
            // сумки"): подтверждение стоимости ПЕРЕД списанием, тот же _showConfirmPopup, что
            // уже используется для рюкзака (ryukzak.js).
            if(!window.iface || typeof iface._showConfirmPopup !== 'function'){
                this._reallyOpenPokerBag(cost, have, win);
                return;
            }
            iface._showConfirmPopup('Открыть сумку за ' + cost + ' голубых спичек?', () => {
                this._reallyOpenPokerBag(cost, have, win);
            });
        });
        win.addChild(openBtn);

        this._pokerBagWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();
    };

    // 22.09.2026: списание 150 roulette_spichki раньше шло целиком client-side (udata[...] =
    // have - cost, без единого запроса к серверу) — читер мог вызвать этот метод из консоли
    // браузера с произвольным cost или вовсе пропустить списание. Теперь сервер сам проверяет
    // баланс и списывает (server/core/controllers/poker.php.openBag()), тот же паттерн, что
    // уже применён для хаты (hata.js._buyHata()).
    proto._reallyOpenPokerBag = function(cost, have, win){
        if(this._pokerBagReqInFlight) return;
        this._pokerBagReqInFlight = true;
        console.log('[dvor-poker-bag._reallyOpenPokerBag] КЛИК открыть сумку | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        console.log('[dvor-poker-bag._reallyOpenPokerBag] → сервер: poker.openBag | cost:', cost);
        TS.php('poker.openBag', {}, (res) => {
            this._pokerBagReqInFlight = false;
            console.log('[dvor-poker-bag._reallyOpenPokerBag] ← ответ сервера:', JSON.stringify(res));
            if(res && res.debug) console.log('[dvor-poker-bag._reallyOpenPokerBag] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА (debug):', res.debug);
            if(!res || !res.patch){
                console.error('[dvor-poker-bag._reallyOpenPokerBag] некорректный ответ сервера (нет patch), сумка НЕ открыта:', JSON.stringify(res));
                if(window.iface) iface._openSidorovichError('Не удалось открыть сумку', 'Попробуйте ещё раз');
                return;
            }
            applyPatch(res.patch);
            if(res.patch.shmot !== undefined && window.shmot && typeof shmot._loadFromUdata === 'function'){
                shmot._loadFromUdata();
            }
            // Идентичная ситуация с сумкой покера: обновляем постоянный счётчик спичек
            // сразу после server-authoritative списания, не дожидаясь нового входа в экран.
            this._updatePokerUI();
            if(win.parent) win.parent.removeChild(win);
            this._pokerBagWin = null;
            this._openPokerBagOpenedScreen(res.reward, res.clientRewards || [], !!res.hasTatu);
        }, (err) => {
            this._pokerBagReqInFlight = false;
            console.error('[dvor-poker-bag._reallyOpenPokerBag] ← ошибка сервера:', JSON.stringify(err));
            if(err && err.code === 50){
                if(window.iface) iface._openSidorovichError('Недостаточно голубых спичек!', 'Нужно: ' + cost);
            } else {
                if(window.iface) iface._openSidorovichError('Не удалось открыть сумку', 'Попробуйте ещё раз');
            }
        });
    };

    // 23.09.2026 (перенос награды сумки на сервер — см. poker.php.openBag()): exp/cig/stash/
    // coins теперь приходят готовыми от сервера (уже начислены через applyPatch до открытия
    // этого экрана) — эта функция только ОТОБРАЖАЕТ их, не катает случайность сама.
    // 25.09.2026: hasTatu тоже теперь решает и выдаёт сервер (poker.php.openBag() →
    // Gameops::grantShmotFromSource()) — раньше сервер решал только валюту, а тату
    // выдавалось прямо здесь клиентским вызовом dvor._give с типом шмотки (client-writable
    // users.save, который users.php._sanitizeShmot() молча отклонял — приз не доходил до игрока).
    // Шанс дропа тату по-прежнему 0 (выключено в бете) — см. константу в poker.php.
    proto._openPokerBagOpenedScreen = function(reward, clientRewards, hasTatu){
        if(this._pokerBagOpenedWin && this._pokerBagOpenedWin.parent)
            this._pokerBagOpenedWin.parent.removeChild(this._pokerBagOpenedWin);

        const exp    = reward.exp;
        const cig    = reward.cig;
        const stash  = reward.stash;
        const coins  = reward.coins;

        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0,0,1280,720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/покер сумка открытая.png'));
        bg.anchor.set(0.5, 0);
        bg.x = 640; bg.y = 67;
        win.addChild(bg);

        // 04.10.2026 (по прямому указанию — "на вкладке открытые сумки в покере сделай все
        // подписи, все цифры белым шрифтом"): отменяет предыдущую правку 03.10.2026 (тогда
        // просили чёрный) — fill снова '#ffffff', остальное (scale/вес/отступ) не трогалось.
        const AMT_STYLE = {
            fontFamily:'Southbank LT', fontSize:20, fill:'#ffffff',
            fontWeight:'normal', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        };
        const _addAmt = (txt, x, y) => {
            const t = new PIXI.Text(txt, AMT_STYLE);
            t.anchor.set(0.5, 0.5);
            t.x = x; t.y = y + 2;
            t.scale.set(1.25);
            win.addChild(t);
        };
        _addAmt('+' + exp,   624, 207);
        _addAmt('+' + cig,   378, 370);
        _addAmt('+' + stash, 610, 436);
        _addAmt('+' + coins, 836, 332);
        { const tatu = new PIXI.Text(hasTatu ? '1' : 'нету', AMT_STYLE);
            tatu.anchor.set(0.5, 0.5);
            tatu.x = 790; tatu.y = 440 + 2;
            tatu.scale.set(1.25);
            tatu.rotation = -10 * Math.PI / 180;
            win.addChild(tatu); }

        const takeBtn = new PIXI.Sprite(PIXI.Texture.from('./images/покер сумка открытая кнопка забрать.png'));
        takeBtn.anchor.set(0.5, 0.5);
        takeBtn.x = 616; takeBtn.y = 550;
        takeBtn.interactive = true; takeBtn.buttonMode = true;
        takeBtn.on('pointerover', ()=>{ _sa(takeBtn, 0.85); takeBtn.scale.set(1.08); });
        takeBtn.on('pointerout', ()=>{ _sa(takeBtn, 1); takeBtn.scale.set(1); });
        takeBtn.on('pointerdown', ()=>{
            // exp/cig/stash/coins уже начислены сервером (см. коммент у _openPokerBagOpenedScreen
            // выше) — здесь только применяем подсказки ещё не мигрировавших подсистем. Тату
            // (шмотка) тоже уже выдано сервером (poker.php.openBag() → grantShmotFromSource()),
            // если hasTatu — здесь только показываем попап, повторной клиентской выдачи
            // шмотки через dvor._give больше нет.
            (clientRewards || []).forEach(cr => {
                if(cr.type === 'battlepass_xp'){ if(window.battlepass) battlepass.addXp(cr.amt); }
            });
            const rewards = [
                {type:'exp', amount:exp},
                {type:'cig', amount:cig},
                {type:'stash', amount:stash},
                {type:'coins', amount:coins},
            ];
            if(hasTatu) rewards.push({type:'tatu', amount:1});
            if(window.iface) iface._showRewardPopup(rewards);
            if(win.parent) win.parent.removeChild(win);
            this._pokerBagOpenedWin = null;
            if(this._pokerWin) this._updatePokerUI();
            if(window.iface) iface.restoreHud();
        });
        win.addChild(takeBtn);

        this._pokerBagOpenedWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();
    };
}

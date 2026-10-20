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
        // 17.10.2026 (по прямому указанию — замена сигарет на сухари): новый файл 1279×555 —
        // та же логика натурального размера, по центру области 15..705 (y=15+(690-555)/2≈83).
        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/двор покер сумка закрытая экран.png'));
        bg.y = 83;
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
        // тогда это считалось багом (poker_spichki/roulette_spichki были разными валютами).
        // 20.10.2026 (по прямому указанию — "это должны быть одинаковые спички, исправь"):
        // решение пересмотрено — обе валюты ОБЪЕДИНЕНЫ, канонический столбец roulette_spichki
        // (см. poker.php.openBag()), poker_spichki больше нигде не пишется.
        const spichkiCount = parseInt(udata['roulette_spichki']||0);
        const spTxt = new PIXI.Text(String(spichkiCount), {
            fontFamily:'Southbank LT', fontSize:29, fill:'#88ccff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        // 18.10.2026 (редактор позиций): x:270 y:320, fontSize 35→31 (-4px).
        // 18.10.2026 (повторное указание тем же днём — новые координаты x:309,y:323,
        // fontSize ещё -2px): 31→29.
        spTxt.anchor.set(0.5, 0);
        spTxt.x = 309; spTxt.y = 323;
        win.addChild(spTxt);

        const _spichkiNow = parseInt(udata['roulette_spichki']||0);
        const _canOpen   = _spichkiNow >= 150;
        const openBtn = new PIXI.Sprite(PIXI.Texture.from(
            _canOpen ? './images/poker_bag_btn_activ.png' : './images/poker_bag_btn.png'
        ));
        openBtn.anchor.set(0.5, 0);
        openBtn.x = 629; openBtn.y = 286; // 18.10.2026: снято редактором позиций
        openBtn.interactive = true; openBtn.buttonMode = true;
        openBtn.on('pointerover', ()=>{ _sa(openBtn, 0.85); openBtn.scale.set(1.08); });
        openBtn.on('pointerout', ()=>{ _sa(openBtn, 1); openBtn.scale.set(1); });
        openBtn.on('pointerdown', ()=>{
            const cost = 150;
            // 20.10.2026 (по прямому указанию — "это должны быть одинаковые спички, исправь"):
            // poker_spichki/roulette_spichki объединены в одну валюту — читаем общий столбец.
            const have = parseInt(udata['roulette_spichki']||0);
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
            this._openPokerBagOpenedScreen(res.reward, res.clientRewards || [], !!res.hasTatu, res.shmotItemId);
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
    proto._openPokerBagOpenedScreen = function(reward, clientRewards, hasTatu, shmotItemId){
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

        // 17.10.2026 (по прямому указанию — замена сигарет на сухари): новый комплект —
        // "фон стол" (1280×538, фон на всю ширину, центрирован по высоте области 15..705) +
        // "содержимое" (937×478, уже нарисованные иконки наград) поверх по продиктованным
        // координатам (218,125). Суммы (_addAmt ниже) рисуются поверх иконок — старые
        // координаты текста оставлены как стартовое приближение (центр содержимого ~686
        // близок к старому центру 640), точная подгонка под новый макет — через редактор
        // позиций при визуальной сверке на тесте.
        const bgTable = new PIXI.Sprite(PIXI.Texture.from('./images/двор покер сумка открытая фон стол.png'));
        bgTable.x = 0; bgTable.y = 91;
        win.addChild(bgTable);

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/двор покер сумка открытая содержимое.png'));
        bg.x = 156; bg.y = 119; // 18.10.2026: снято редактором позиций
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
        // 18.10.2026: новые координаты сняты редактором позиций (scale 1.250 — уже заложен
        // в _addAmt/tatu ниже через t.scale.set(1.25), не трогаем отдельно).
        _addAmt('+' + exp,   635, 242);
        _addAmt('+' + cig,   449, 387);
        _addAmt('+' + stash, 630, 439);
        _addAmt('+' + coins, 795, 257);
        // 18.10.2026 (по прямому указанию — "уменьши фонт сайз на 2px"): у остальных карточек
        // (_addAmt) AMT_STYLE задаёт размер шрифта 20 и затем ставится scale.set(1.25) —
        // эффективно 25px на экране, этот текст был таким же. Вместо той же пары (её ловит
        // tests/no-text-fontsize-scale-pixelation.test.js как блочный/пиксельный рендер текста
        // при scale≠1) итоговый размер 25-2=23 задан сразу в размере шрифта, без отдельного
        // scale — тот самый способ, которым просил чинить дизайнер.
        { const tatuStyle = Object.assign({}, AMT_STYLE, { fontSize: 23 });
            const tatu = new PIXI.Text(hasTatu ? '1' : 'нету', tatuStyle);
            tatu.anchor.set(0.5, 0.5);
            tatu.x = 899; tatu.y = 411 + 2;
            tatu.rotation = -10 * Math.PI / 180;
            win.addChild(tatu); }

        const takeBtn = new PIXI.Sprite(PIXI.Texture.from('./images/покер сумка открытая кнопка забрать.png'));
        takeBtn.anchor.set(0.5, 0.5);
        takeBtn.x = 636; takeBtn.y = 527; // 18.10.2026: снято редактором позиций
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
            // 20.10.2026 (по прямому указанию, скриншот — "после нажатия ЗАБРАТЬ не вылезал попап
            // награды"): сам этот экран УЖЕ показывает все награды (_addAmt выше рисует exp/cig/
            // stash/coins/шмотку прямо на фоне сумки) — отдельный popups/reward.js поверх был
            // дублем, тот же баг-класс, что уже чинили 17.10.2026 для ящика (yashik.js) и
            // рюкзака (ryukzak.js). Здесь только одна кнопка выхода (ЗАБРАТЬ) — суппрессия не
            // нужна, попап просто больше не вызывается.
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

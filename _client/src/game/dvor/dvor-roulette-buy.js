import { applyPatch } from '../../modules/patch.js';
import buyPointsPackages from '../../data/buy_points_packages.json';

/** Рулетка — экраны покупки поинтов и кейса. */
export function attachRouletteBuy(proto){

    proto._openRouletteBuyScreen = function(){
        if(this._roulBuyWin && this._roulBuyWin.parent) this._roulBuyWin.parent.removeChild(this._roulBuyWin);
        const BASE = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка купить поинты.png'));
        bg.width = 1280; bg.scale.y = bg.scale.x; bg.y = 15;
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
            this._roulBuyWin = null;
            // Купленные поинты обновляли текст только ЗДЕСЬ, на экране покупки — счётчик
            // на основном экране рулетки (_roulPtsTxt) не трогался и показывал старое
            // значение, пока игрок не выходил из Двора и не заходил заново.
            this._updateRouletteUI();
            if(window.iface) iface.restoreHud();
        });
        win.addChild(exitBtn);

        const ptsTxt = new PIXI.Text(String(parseInt(udata['blue_points'] || 0)), {
            fontFamily:'Southbank LT', fontSize:22, fill:'#7fb8ff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        ptsTxt.anchor.set(0.5, 0.5);
        ptsTxt.x = 453; ptsTxt.y = 545;
        win.addChild(ptsTxt);

        // 04.10.2026 (аудит проекта — убрали дубль таблицы цен с dvor-dice-screen.js/
        // roulette.php/dice_config.json): единый источник — buy_points_packages.json (тот же
        // прайс по ТЗ для обеих валют поинтов, рулетка и зарики).
        const ROUL_PKGS = buyPointsPackages;
        const PKG_POS = [
            {x:573, y:330}, {x:713, y:330}, {x:856, y:330},
            {x:574, y:504}, {x:713, y:503}, {x:857, y:504},
        ];
        let purchasePending = false;
        const buyBluePoints = (pkg)=>{
            if(purchasePending){
                console.log('[dvor-roulette-buy.buyBluePoints] покупка уже сохраняется, повторный клик пропущен');
                return;
            }

            const coinsBefore = parseInt(udata['coins'] || 0);
            console.log('[dvor-roulette-buy.buyBluePoints] попытка покупки | цена:', pkg.price, '| поинты:', pkg.pts, '| рублей:', coinsBefore);

            // Клиентская проверка — только для мгновенного дружелюбного сообщения без похода на
            // сервер; финальное решение и списание валюты — только на сервере.
            if(coinsBefore < pkg.price){
                console.warn('[dvor-roulette-buy.buyBluePoints] недостаточно рублей | нужно:', pkg.price, '| есть:', coinsBefore);
                if(window.iface) iface._openSidorovichError('Недостаточно рублей!', 'Нужно: ' + pkg.price + ' • У вас: ' + coinsBefore);
                return;
            }

            if(!window.TS || typeof TS.php !== 'function'){
                console.error('[dvor-roulette-buy.buyBluePoints] TS.php недоступен, покупка отменена');
                if(window.iface) iface._openSidorovichError('Покупка не сохранена', 'Сервер игры недоступен');
                return;
            }

            purchasePending = true;

            // 28.09.2026 (по репорту "покупка всё ещё странно себя ведёт", см. память агента
            // incident_checkall_flush_wipes_server_credits): раньше здесь ДО ответа сервера
            // локально предсказывались coins/blue_points (оптимистичное обновление udata) — тот
            // же класс гонки, что уже чинили для base.js/vassilich.js/shmot.js/weapons.js
            // (см. их комментарии "честный запрос→ответ"): если между оптимистичной записью и
            // ответом сервера успевал улететь независимый автосейв, он мог сохранить ПРЕДСКАЗАННОЕ
            // (не обязательно верное) значение. Теперь ничего не меняем локально, пока сервер не
            // подтвердит — только applyPatch(), плюс suspend/resume перекрывает и окно самого
            // запроса (roulette.php.buyPoints() пишет валюту напрямую, в обход общего автосейва).
            if(window.suspendPlayerSave) suspendPlayerSave('roulette_buy_points');
            const pkgIdx = ROUL_PKGS.indexOf(pkg);
            TS.php('roulette.buyPoints', {pkg_idx: pkgIdx}, (result)=>{
                purchasePending = false;
                if(result && result.patch) applyPatch(result.patch);
                if(window.resumePlayerSave) resumePlayerSave('roulette_buy_points');
                ptsTxt.text = String(parseInt(udata['blue_points'] || 0));
                if(window.iface) iface.updateUp();
                console.log('[dvor-roulette-buy.buyBluePoints] покупка подтверждена сервером | pkg_idx:', pkgIdx, '| цена:', pkg.price, '| получено поинтов:', pkg.pts, '| результат:', result);
            }, (error)=>{
                purchasePending = false;
                if(window.resumePlayerSave) resumePlayerSave('roulette_buy_points');
                if(window.iface){
                    iface.updateUp();
                    iface._openSidorovichError('Покупка не сохранена', 'Попробуйте ещё раз');
                }
                console.error('[dvor-roulette-buy.buyBluePoints] ошибка сохранения, покупка отменена | цена:', pkg.price, '| поинты:', pkg.pts, '| ошибка:', error);
            });
        };

        ROUL_PKGS.forEach((pkg, idx)=>{
            const denomSpr = new PIXI.Sprite(PIXI.Texture.from('./images/' + pkg.img));
            denomSpr.anchor.set(0, 0);
            denomSpr.x = PKG_POS[idx].x; denomSpr.y = PKG_POS[idx].y;
            win.addChild(denomSpr);
            denomSpr.interactive = true; denomSpr.buttonMode = true;
            denomSpr.on('pointerover', ()=>{ _sa(denomSpr, 0.85); denomSpr.scale.set(1.08); });
            denomSpr.on('pointerout', ()=>{ _sa(denomSpr, 1); denomSpr.scale.set(1); });
            denomSpr.on('pointerdown', ()=>buyBluePoints(pkg));
            // 26.09.2026 (по прямому указанию, скриншот — "убери иконки рублей с попапа
            // покупки поинтов"): та же лишняя оверлей-иконка монеты, что убрана из
            // dvor-dice-screen.js — карточка (pkg.img) уже содержит готовую цену/валюту.
        });

        this._roulBuyWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();
    };

    proto._openRouletteCaseScreen = function(){
        if(this._roulCaseWin && this._roulCaseWin.parent)
            this._roulCaseWin.parent.removeChild(this._roulCaseWin);

        const BASE = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // 18.09.2026: нативный размер 1280×702, независимые width/height давали ~1.7% сжатия
        // по вертикали — заменено на пропорциональный scale (см. рулетка страница.png).
        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка закрытый кейс.png'));
        bg.width = 1280; bg.scale.y = bg.scale.x; bg.y = 15;
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
            this._roulCaseWin = null;
        });
        win.addChild(exitBtn);

        const spTxt = new PIXI.Text('Спичек: ' + parseInt(udata['roulette_spichki']||0), {
            fontFamily:'Southbank LT', fontSize:20, fill:'#cc88ff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
        });
        spTxt.anchor.set(0.5, 0);
        spTxt.x = 640; spTxt.y = 60;
        win.addChild(spTxt);

        const openBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка закрытый кейс кнопка открыть.png'));
        openBtn.anchor.set(0.5, 0.5);
        openBtn.x = 640; openBtn.y = 467;
        openBtn.interactive = true; openBtn.buttonMode = true;
        openBtn.on('pointerover', ()=>{ _sa(openBtn, 0.85); openBtn.scale.set(1.08); });
        openBtn.on('pointerout', ()=>{ _sa(openBtn, 1); openBtn.scale.set(1); });
        openBtn.on('pointerdown', ()=>{
            const cost = 150;
            const have = parseInt(udata['roulette_spichki']||0);
            if(have < cost){ if(window.iface) iface._openSidorovichError('Недостаточно голубых спичек!', 'Нужно: ' + cost + ' • У вас: ' + have); return; }
            // 22.09.2026 (по прямому указанию — "нет попап предупреждение стоимости открытия
            // кейса"): подтверждение стоимости ПЕРЕД списанием, тот же _showConfirmPopup, что
            // уже используется для рюкзака (ryukzak.js) и сумки покера (dvor-poker-bag.js).
            // Списание раньше шло целиком client-side (udata[...] = have - cost, без единого
            // запроса к серверу) — читер мог вызвать эту логику из консоли с произвольным cost
            // или вовсе пропустить списание. Теперь сервер сам проверяет баланс и списывает
            // (server/core/controllers/roulette.php.openCase()), тот же паттерн, что уже
            // применён для покерной сумки (poker.php.openBag()) и хаты (hata.js._buyHata()).
            const _reallyOpen = () => {
                if(this._roulCaseReqInFlight) return;
                this._roulCaseReqInFlight = true;
                console.log('[dvor-roulette-buy._reallyOpen] КЛИК открыть кейс | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
                console.log('[dvor-roulette-buy._reallyOpen] → сервер: roulette.openCase | cost:', cost);
                // 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
                // openCase() списывает roulette_spichki напрямую на сервере.
                if(window.suspendPlayerSave) suspendPlayerSave('roulette_open_case');
                TS.php('roulette.openCase', {}, (res) => {
                    this._roulCaseReqInFlight = false;
                    console.log('[dvor-roulette-buy._reallyOpen] ← ответ сервера:', JSON.stringify(res));
                    if(res && res.debug) console.log('[dvor-roulette-buy._reallyOpen] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА (debug):', res.debug);
                    if(!res || !res.patch){
                        console.error('[dvor-roulette-buy._reallyOpen] некорректный ответ сервера (нет patch), кейс НЕ открыт:', JSON.stringify(res));
                        if(window.resumePlayerSave) resumePlayerSave('roulette_open_case');
                        if(window.iface) iface._openSidorovichError('Не удалось открыть кейс', 'Попробуйте ещё раз');
                        return;
                    }
                    applyPatch(res.patch);
                    if(window.resumePlayerSave) resumePlayerSave('roulette_open_case');
                    // Счётчик на уже открытом экране рулетки живёт отдельно от udata и
                    // раньше обновлялся только при следующем входе в рулетку. Обновляем его
                    // сразу после серверного списания 150 спичек.
                    this._updateRouletteUI();
                    if(res.patch.shmot !== undefined && window.shmot && typeof shmot._loadFromUdata === 'function'){
                        shmot._loadFromUdata();
                    }
                    if(win.parent) win.parent.removeChild(win);
                    this._roulCaseWin = null;
                    // 25.09.2026: hasTatu теперь решает и выдаёт сервер (roulette.php.openCase() →
                    // Gameops::grantShmotFromSource()), не клиент — раньше эта строка сама катала
                    // случайность и сама писала шмотку клиентским вызовом dvor._give, т.е.
                    // client-writable users.save, который users.php._sanitizeShmot() молча
                    // отклонял (приз не доходил до игрока). Шанс дропа по-прежнему 0 (выключено
                    // в бете) — см. константу в roulette.php.
                    this._openRouletteCaseOpenedScreen(!!res.hasTatu, res.reward, res.clientRewards || []);
                }, (err) => {
                    this._roulCaseReqInFlight = false;
                    if(window.resumePlayerSave) resumePlayerSave('roulette_open_case');
                    console.error('[dvor-roulette-buy._reallyOpen] ← ошибка сервера:', JSON.stringify(err));
                    if(err && err.code === 50){
                        if(window.iface) iface._openSidorovichError('Недостаточно голубых спичек!', 'Нужно: ' + cost);
                    } else {
                        if(window.iface) iface._openSidorovichError('Не удалось открыть кейс', 'Попробуйте ещё раз');
                    }
                });
            };
            if(!window.iface || typeof iface._showConfirmPopup !== 'function'){ _reallyOpen(); return; }
            iface._showConfirmPopup('Открыть кейс за ' + cost + ' голубых спичек?', _reallyOpen);
        });
        win.addChild(openBtn);

        this._roulCaseWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();
    };

    // 23.09.2026 (перенос награды кейса на сервер — см. roulette.php.openCase()): exp/cig/
    // stash/coins теперь приходят готовыми от сервера (уже начислены через applyPatch до
    // открытия этого экрана) — эта функция только ОТОБРАЖАЕТ их, не катает случайность сама.
    proto._openRouletteCaseOpenedScreen = function(hasTatu, reward, clientRewards){
        const BASE = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bgFile = hasTatu ? 'рулетка открытый кейс с тату.png' : 'рулетка открытый кейс без тату.png';
        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + bgFile));
        // 18.09.2026: нативный размер 1280×702 (у обоих файлов) — пропорциональный scale вместо
        // независимых width/height, тот же фикс, что и у остальных фонов рулетки.
        bg.width = 1280; bg.scale.y = bg.scale.x; bg.y = 15;
        win.addChild(bg);

        const takeBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рулетка открытый кейс кнопка забрать.png'));
        takeBtn.anchor.set(0.5, 0.5);
        takeBtn.x = 640; takeBtn.y = 490;
        takeBtn.interactive = true; takeBtn.buttonMode = true;
        takeBtn.on('pointerover', ()=>{ _sa(takeBtn, 0.85); takeBtn.scale.set(1.08); });
        takeBtn.on('pointerout', ()=>{ _sa(takeBtn, 1); takeBtn.scale.set(1); });
        takeBtn.on('pointerdown', ()=>{
            const exp   = reward.exp;
            const cig   = reward.cig;
            const stash = reward.stash;
            const coins = reward.coins;
            // exp/cig/stash/coins уже начислены сервером (см. коммент у
            // _openRouletteCaseOpenedScreen выше) — здесь только применяем подсказки ещё не
            // мигрировавших подсистем.
            (clientRewards || []).forEach(cr => {
                if(cr.type === 'battlepass_xp'){ if(window.battlepass) battlepass.addXp(cr.amt); }
            });
            // Тату (шмотка) уже выдано сервером (roulette.php.openCase() →
            // grantShmotFromSource()), если hasTatu — здесь только показываем попап.
            const rewards = [
                {type:'exp', amount:exp},
                {type:'cig', amount:cig},
                {type:'stash', amount:stash},
                {type:'coins', amount:coins},
            ];
            if(hasTatu) rewards.push({type:'tatu', amount:1});
            if(window.iface) iface._showRewardPopup(rewards);
            if(win.parent) win.parent.removeChild(win);
        });
        win.addChild(takeBtn);

        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();
    };
}

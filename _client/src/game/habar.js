import { applyPatch } from '../modules/patch.js';

const HABAR_COLLECT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export default class Habar{
    constructor(mc){
        this.mc  = mc;

        // Фиксированные награды по ТЗ — все предметы выдаются сразу.
        // 27.09.2026 (баг найден по прямому репорту — "с пацанского хабара не начислился
        // красный поинт"): статичная промо-картинка магазина ('./images/хабар страница.png')
        // явно обещает "+1 Поинт" (красный, dice_points) и для Обычного, и для Пацанского
        // тиров — а сервер (habar_daily_config.json, зеркало этого списка — только для fallback,
        // см. _collectDay()) вообще не включал dice_points в награды этих двух тиров, только
        // Авторитетный/Элитный. Добавлено dice_points:1 в оба, синхронно с server/json/
        // habar_daily_config.json (сверено построчно с картинкой — остальные суммы совпадали).
        this.containers = [
            {
                id:0, name:'Обычный', price:100,
                rewards:[
                    {type:'damage',       amount:100000},
                    {type:'dice_points',  amount:1},
                    {type:'coins',        amount:10},
                    {type:'cigarettes',   amount:400},
                    {type:'ammo_machete', amount:10},
                ],
            },
            {
                id:1, name:'Пацанский', price:200,
                rewards:[
                    {type:'damage',       amount:200000},
                    {type:'dice_points',  amount:1},
                    {type:'coins',        amount:20},
                    {type:'cigarettes',   amount:800},
                    {type:'ammo_machete', amount:2},
                    {type:'ammo_gun',     amount:3},
                ],
            },
            {
                id:2, name:'Авторитетный', price:300,
                rewards:[
                    {type:'damage',       amount:300000},
                    {type:'coins',        amount:30},
                    {type:'ammo_auto',    amount:5},
                    {type:'ammo_gun',     amount:5},
                    {type:'dice_points',  amount:2},
                    {type:'blue_points',  amount:2},
                    {type:'poker_chips',  amount:1},
                ],
            },
            {
                id:3, name:'Элитный', price:500,
                rewards:[
                    {type:'damage',       amount:500000},
                    {type:'coins',        amount:50},
                    {type:'ammo_auto',    amount:5},
                    {type:'ammo_gun',     amount:10},
                    {type:'dice_points',  amount:4},
                    {type:'blue_points',  amount:4},
                    {type:'poker_chips',  amount:4},
                ],
            },
        ];

        // Совместимость с FLA (на случай если win еще используется где-то)
        try{
            this.win = mc.habar_win;
            if(this.win && this.win.butt_close) this.win.butt_close.on('pointerdown', ()=>this.close());
        } catch(e){ this.win = null; }

        this._pixiWin = null;
    }

    _buildPixiWin(){
        const win = new PIXI.Container();
        win.interactive = true;

        const bl = new PIXI.Graphics();
        bl.beginFill(0x000000, 0.001);
        bl.drawRect(0, 0, 1280, 720);
        bl.endFill();
        bl.interactive = true;
        win.addChild(bl);

        // Фон
        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/хабар страница.png'));
        bg.y = 36;
        win.addChild(bg);

        // Кнопка выход
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/zone/btn_exit.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1197; exitBtn.y = 56;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this.close());
        win.addChild(exitBtn);

        // 4 кнопки (позиции из PSD, фон 1280×720). До покупки — "ЗАБРАТЬ" (купить контейнер).
        // После покупки купленная плашка становится "СОБРАТЬ" (ежедневный сбор, 30 дней), остальные 3 гаснут.
        const BTN_X = [213, 457, 700, 945];
        const BTN_Y = [490, 490, 490, 489];
        const boughtIdx = parseInt(udata['habar_bought'] || 0) - 1; // -1 = ничего не куплено
        this._habarBtns = [];
        this._habarTimerLabels = [];
        this._habarDaysLabels = [];

        for(let i = 0; i < 4; i++){
            if(boughtIdx === i){
                const btn = new PIXI.Sprite(PIXI.Texture.from('./images/хабар кнопка собрать.png'));
                btn.anchor.set(0, 0);
                btn.x = BTN_X[i];
                btn.y = BTN_Y[i];
                btn.interactive = true; btn.buttonMode = true;
                btn.on('pointerover', ()=>{ _sa(btn, 0.85); btn.scale.set(1.08); });
                btn.on('pointerout',  ()=>{ _sa(btn, 1); btn.scale.set(1); });
                btn.on('pointerdown', ()=>this._collectDay());
                win.addChild(btn);
                this._habarBtns.push(btn);

                // Пока суточный кулдаун не закончился, вместо кнопки показываем только
                // некликабельный таймер. Он занимает ту же область, поэтому игрок сразу
                // видит, когда снова станет доступен сбор, и не получает поп-ап ошибки.
                // 24.09.2026 (по прямому указанию, редактор позиций — "Выбрано: Текст
                // '23:59:37' x:985 y:504"): позиция была формулой BTN_X[i]+btn.width/2 (=+61) /
                // BTN_Y[i]+btn.height/2 (=+17) — для купленного слота 3 (Элитный, X=945/Y=489)
                // это давало 1006/506, чуть в стороне от измеренной цели. Смещение уточнено до
                // +40/+15 от BTN_X[i]/BTN_Y[i] (даёт ровно 985/504 для слота 3), применяется
                // одинаково ко всем 4 слотам — та же логика, что и раньше, просто точнее.
                // 03.10.2026 (редактор позиций, по прямому указанию — "время в хабаре сколько
                // осталось до следующего", измерено на купленном слоте Элитный X:945/Y:489 →
                // x:971 y:506): было +40/+15, стало +26/+17.
                const TIMER_OFFSET_X = 26, TIMER_OFFSET_Y = 17;
                const timer = new PIXI.Text('', {
                    fontFamily:'Southbank LT', fontSize:18, fill:'#f0e2c4',
                    align:'center', fontWeight:'bold',
                    dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2,
                });
                timer.anchor.set(0.5, 0.5);
                timer.x = BTN_X[i] + TIMER_OFFSET_X;
                timer.y = BTN_Y[i] + TIMER_OFFSET_Y;
                timer.scale.set(1.258);
                timer.interactive = false;
                timer.visible = false;
                win.addChild(timer);
                this._habarTimerLabels[i] = timer;

                // 24.09.2026 (по прямому указанию — "справа от времени, на том же Y, но правее
                // на 40px, покажи сколько дней уже собрано — N/30"): та же видимость, что и у
                // таймера (появляется вместе с ним, во время кулдауна/после полного сбора).
                // 25.09.2026 (по прямому указанию, редактор позиций — "Выбрано: x:1047 y:504
                // scale:1.000" для купленного слота 3/Элитный): было timer.x+40 (=1025 для слота
                // 3) — offset уточнён до +62, даёт ровно 1047 для слота 3; Y уже совпадал (504),
                // не менялся. Формула общая для всех 4 слотов, как и раньше.
                const daysTxt = new PIXI.Text('', {
                    fontFamily:'Southbank LT', fontSize:18, fill:'#f0e2c4',
                    align:'center', fontWeight:'bold',
                    dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2,
                });
                // 03.10.2026 (редактор позиций — "кол-во уже собранных хабаров", измерено на
                // слоте Элитный → x:1057 y:505): было timer.x+62, стало timer.x+86.
                daysTxt.anchor.set(0.5, 0.5);
                daysTxt.x = timer.x + 86;
                daysTxt.y = timer.y;
                daysTxt.scale.set(1.253);
                daysTxt.interactive = false;
                daysTxt.visible = false;
                win.addChild(daysTxt);
                this._habarDaysLabels[i] = daysTxt;
            } else {
                const btn = new PIXI.Sprite(PIXI.Texture.from('./images/хабар кнопка купить.png'));
                btn.anchor.set(0, 0);
                btn.x = BTN_X[i];
                btn.y = BTN_Y[i];
                if(boughtIdx >= 0){
                    btn.alpha = 0.4;
                } else {
                    btn.interactive = true; btn.buttonMode = true;
                    btn.on('pointerover', ()=>{ _sa(btn, 0.85); btn.scale.set(1.08); });
                    btn.on('pointerout',  ()=>{ _sa(btn, 1); btn.scale.set(1); });
                    const idx = i;
                    btn.on('pointerdown', ()=>this._buyAndOpen(idx));
                }
                win.addChild(btn);
                this._habarBtns.push(btn);
            }
        }

        this._updateHabarTimer();

        win.y = 36;
        this._pixiWin = win;
    }

    // Кулдаун 24ч между сборами. Когда сбор доступен, видна интерактивная кнопка
    // "СОБРАТЬ". Пока он недоступен, кнопка полностью скрыта и на её месте тикает
    // некликабельный таймер — без ошибочного поп-апа по клику.
    _updateHabarTimer(){
        const boughtIdx = parseInt(udata['habar_bought'] || 0) - 1;
        if(boughtIdx < 0) return;

        const lastTs   = parseInt(udata['habar_last_collect_ts'] || 0);
        const remainMs = HABAR_COLLECT_COOLDOWN_MS - (Date.now() - lastTs);
        const btn = this._habarBtns && this._habarBtns[boughtIdx];
        if(!btn) return;
        const timer = this._habarTimerLabels && this._habarTimerLabels[boughtIdx];
        const collected = parseInt(udata['habar_days_collected'] || 0);
        const waiting = collected < 30 && lastTs > 0 && remainMs > 0;
        const canCollect = collected < 30 && !waiting;

        btn.visible = canCollect;
        btn.interactive = canCollect;
        btn.buttonMode = canCollect;
        btn.alpha = 1;

        if(timer){
            timer.visible = !canCollect;
            if(collected >= 30){
                timer.text = 'СОБРАНО';
            } else {
                const totalSeconds = Math.max(0, Math.ceil(remainMs / 1000));
                const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
                const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
                const ss = String(totalSeconds % 60).padStart(2, '0');
                timer.text = hh + ':' + mm + ':' + ss;
            }
        }

        // 24.09.2026 (по прямому указанию — "справа от времени, на том же Y, но правее на
        // 40px, покажи сколько дней уже собрано — N/30"): та же видимость, что у таймера рядом.
        const daysTxt = this._habarDaysLabels && this._habarDaysLabels[boughtIdx];
        if(daysTxt){
            daysTxt.visible = !canCollect;
            daysTxt.text = Math.min(collected, 30) + '/30';
        }
    }

    _buyAndOpen(idx){
        const con = this.containers[idx];
        const stew = parseInt(udata['stew'] || 0);
        if(stew < con.price){
            notify.showResult({text:'Нужно ' + con.price + ' тушенки!'}, 0);
            return;
        }

        // 24.09.2026 (перенос экономики хабара на сервер, по прямому указанию — см. большой
        // комментарий у _collectDay() ниже): списание тушёнки/habar_bought/сброс счётчиков
        // теперь считает и сохраняет ТОЛЬКО сервер (habar.php.buy()), applyPatch() ниже
        // подставляет реальные значения из его ответа — клиент больше не пишет их сам заранее.
        //
        // 24.09.2026 (гонка найдена при переносе): _collectDay() (день 1) теперь ТОЖЕ реальный
        // серверный запрос — раньше он звался сразу же, синхронно, не дожидаясь ответа
        // habar.buy(). Если бы collectDay() долетел до сервера РАНЬШЕ, чем buy() успел
        // закоммитить покупку, он бы честно отклонил её кодом 57 "хабар не куплен" (сервер ещё
        // не видел свежий habar_bought). Теперь collectDay() вызывается только ВНУТРИ callback'а
        // buy() — строго после того, как покупка уже сохранена.
        if(window.battlepass) battlepass.addXp(3);
        TS.php('habar.buy', {container_id: idx}, (e) => {
            if(e && e.patch) applyPatch(e.patch);

            // 19.09.2026 (репорт "купил хабар, но попап с наградой показался не поверх вкладки
            // хабара"): раньше _collectDay() (внутри — iface._showRewardPopup(), addChild в
            // КОНЕЦ layer2_mc, то есть НАВЕРХ) вызывался ДО пересборки экрана хабара ниже — а
            // пересборка сама заново делает root.layer2_mc.addChild(this._pixiWin), что
            // переподнимало СВЕЖИЙ экран хабара ПОВЕРХ уже показанного попапа. Порядок —
            // сначала пересобираем экран (переключаем кнопки/текст в состояние "куплено"), и
            // только ПОСЛЕ этого зовём _collectDay(), чтобы её попап награды гарантированно
            // оказался последним (топовым) ребёнком layer2_mc.
            const wasOpen = this._pixiWin && this._pixiWin.parent;
            if(this._pixiWin && this._pixiWin.parent) this._pixiWin.parent.removeChild(this._pixiWin);
            this._pixiWin = null;
            this._buildPixiWin();
            if(wasOpen) root.layer2_mc.addChild(this._pixiWin);

            // Покупка сразу засчитывает 1-й день сбора, дальше — по кнопке "СОБРАТЬ" раз в день.
            this._collectDay();
        }, (err) => {
            console.error('[habar._buyAndOpen] ← ошибка сервера:', JSON.stringify(err));
        });
    }

    // 24.09.2026 (перенос экономики хабара на сервер, по прямому указанию — проверка показала:
    // вся эта функция раньше была ЦЕЛИКОМ клиентской — начисление наград, счётчик дней и таймер
    // кулдауна писались напрямую в udata и уходили на сервер только общим users.save, БЕЗ какой
    //-либо серверной проверки. Читер мог обнулить habar_days_collected/habar_last_collect_ts из
    // консоли браузера и собирать хабар бесконечно, либо выставить себе валюту напрямую. Теперь
    // сервер (habar.php.collectDay()) сам проверяет покупку/кулдаун/лимит 30 дней и сам решает,
    // что начислить — клиент только просит и применяет результат через applyPatch().
    //
    // Ежедневный сбор наград купленного контейнера — 30 сборов на весь хабар, не чаще
    // одного раза в 24 часа (habar_last_collect_ts, см. HABAR_COLLECT_COOLDOWN_MS).
    // 26.09.2026 (баг найден по прямому указанию — "после повторного сбора хабара урон седого
    // откатывается на старый остаток вместо свежей выдачи"): collectDay() пишет несколько полей
    // (coins/cigarettes/weapons/sedoy_dmg_* и т.д.) напрямую через Gameops::saveUser(), в обход
    // обычного 500мс-дебаунса — тот же класс гонки, что уже чинили для bosses.attack/claimKill/
    // startFight (см. большие комментарии в bosses-combat.js/player-save.js): если ЛЮБАЯ другая
    // мутация udata (даже не связанная с хабаром) успела запланировать debounce-автосейв ровно
    // в окне полёта этого запроса, он уходит со СТАРЫМ udata (снятым ДО applyPatch() ниже) и,
    // придя позже, тихо затирает свежую выдачу обратно на старые значения. suspendPlayerSave()/
    // resumePlayerSave() перекрывают именно это окно — тот же приём, что уже стоит вокруг
    // bosses.attack (bosses-combat.js) и bosses.useSedoy (bosses_fight.js).
    _collectDay(){
        if(this._habarCollecting) return;
        this._habarCollecting = true;
        console.log('[habar._collectDay] → сервер: habar.collectDay');
        if(window.suspendPlayerSave) suspendPlayerSave('habar_collect_day');
        TS.php('habar.collectDay', {}, (res) => {
            this._habarCollecting = false;
            console.log('[habar._collectDay] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch){
                console.error('[habar._collectDay] некорректный ответ сервера (нет patch), награда не применена:', JSON.stringify(res));
                if(window.resumePlayerSave) resumePlayerSave('habar_collect_day');
                return;
            }
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('habar_collect_day');
            if(res.patch.weapons !== undefined && window.weapons && typeof weapons._loadFromUdata === 'function'){
                weapons._loadFromUdata();
            }

            if(window.iface) iface.updateUp();
            // 21.09.2026 (аудит "достижения появляются с задержкой") — экономические достижения
            // (накопить N рублей/сигарет и т.п.) от ежедневного сбора хабара ждали случайного
            // другого действия.
            if(window.achievements) achievements._checkAll();

            this._updateHabarTimer();

            const con = this.containers[parseInt(udata['habar_bought'] || 0) - 1];
            const habarRewards = res.rewards || (con ? con.rewards : []);
            if(window.iface && typeof iface._showRewardPopup === 'function'){
                iface._showRewardPopup(habarRewards);
            } else {
                notify.showResult({text:'«' + (con ? con.name : 'Хабар') + '»: день ' + res.daysCollected + '/30 получен!'}, 1);
            }
        }, (err) => {
            this._habarCollecting = false;
            if(window.resumePlayerSave) resumePlayerSave('habar_collect_day');
            console.error('[habar._collectDay] ← ошибка сервера:', JSON.stringify(err));
            // Коды: 57 — хабар не куплен, 58 — все 30 дней уже собраны, 59 — кулдаун ещё не
            // прошёл. Во всех случаях просто синхронизируем UI-состояние с реальностью сервера
            // (кнопка/таймер) — без попапа ошибки, в обычном интерфейсе сюда попасть нельзя
            // (во время кулдауна кнопка скрыта, вместо неё тикает таймер).
            if(err && err.code === 58) notify.showResult({text:'Хабар этого месяца собран полностью!'}, 0);
            this._updateHabarTimer();
        });
    }

    open(){
        console.log('[habar.open] called | _pixiWin:', this._pixiWin ? 'exists' : 'null', '| parent:', this._pixiWin && this._pixiWin.parent ? 'has' : 'none', '| layer2 children before:', root.layer2_mc ? root.layer2_mc.children.length : 'N/A');
        if(!this._pixiWin) this._buildPixiWin();
        root.layer2_mc.addChild(this._pixiWin);
        // Хабар держит оба ХУДа видимыми всегда, даже открытый поверх боя с боссом
        // (24.09.2026, декларативный ХУД — см. Interface.pushHud/popHud в interface.js).
        if(window.iface) iface.pushHud('habar', { down: true });
        // Таймер под кнопкой "СОБРАТЬ" тикает раз в секунду, пока попап открыт.
        if(!this._habarTimerInterval) this._habarTimerInterval = setInterval(() => this._updateHabarTimer(), 1000);
        console.log('[habar.open] done | layer2 children after:', root.layer2_mc.children.length);
    }

    close(){
        console.log('[habar.close] called | _pixiWin.parent:', this._pixiWin && this._pixiWin.parent ? 'has' : 'none');
        if(this._pixiWin && this._pixiWin.parent) this._pixiWin.parent.removeChild(this._pixiWin);
        if(this._habarTimerInterval){ clearInterval(this._habarTimerInterval); this._habarTimerInterval = null; }
        if(window.iface){
            iface.popHud('habar');
            // Сбрасываем имя открытого модуля чтобы следующий клик кнопки HABar не путался
            iface._openModuleName = null;
        }
        // Хабар открывается поверх экрана боя с боссом — после покупки/выхода нужно
        // обновить видимость кнопки "купить хабар"/"Седой" на экране боя за собой.
        // _refreshBossFightHabarBtn живёт на Interface.prototype (bosses_fight.js), не на bosses.
        if(window.iface && typeof iface._refreshBossFightHabarBtn === 'function') iface._refreshBossFightHabarBtn();
    }
}

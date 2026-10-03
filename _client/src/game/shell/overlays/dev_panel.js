// 25.09.2026 (по прямому указанию — dev-попап с текстами ошибок): зеркало server/json/errors.json
// для офлайн-просмотра в dev-панели (_openErrorBrowser). Сервер остаётся единственным источником
// истины для реальных ответов — при правке errors.json обновить и этот список.
import { applyPatch } from '../../../modules/patch.js';

const DEV_ERROR_CATALOG = [
    {code:0,   text:'Не валидный токен'},
    {code:1,   text:'Обнаружена попытка взлома. Не валидный токен.'},
    {code:2,   text:'Токен не найден. Пожалуйста, обновите страницу с игрой'},
    {code:3,   text:'Истекло время жизни токена. Обнови страницу с игрой, чтобы продолжить'},
    {code:4,   text:'Несовпадение подписи запроса. Попробуй ещё раз!'},
    {code:5,   text:'Братуха! Играть можно только на одной вкладке, так что давай без этого-вот. Обновляй страницу и продолжим!'},
    {code:6,   text:'Перезагрузка сервера. Зайдите позже!'},
    // 27.09.2026 (плановая чистка тестов — найдено расхождение с server/json/errors.json):
    // code:7 отсутствовал в зеркале с момента создания списка 25.09.2026 — забытая запись,
    // не осознанное изменение. errors.json остаётся источником истины, добавлено 1:1.
    {code:7,   text:'Обнаружена попытка подделки идентификатора пользователя. Обновите страницу с игрой'},
    {code:44,  text:'Событие недоступно'},
    {code:45,  text:'Нет попыток'},
    {code:46,  text:'Недостаточно тушёнки'},
    {code:50,  text:'Недостаточно ресурсов'},
    {code:51,  text:'Товар не найден'},
    {code:52,  text:'Уже куплено / забрано'},
    {code:53,  text:'Условие не выполнено'},
    {code:54,  text:'Неверный параметр'},
    {code:55,  text:'Нет в наличии'},
    {code:56,  text:'Эта функция пока недоступна — раздел ещё не готов к бета-тесту'},
    {code:67,  text:'Недостаточно красных поинтов'},
    {code:68,  text:'Нет активного броска — сначала нажми БРОСИТЬ'},
    {code:69,  text:'Заряды переброса кончились'},
    {code:79,  text:'Недостаточно фишек для покера'},
    {code:80,  text:'Дневной лимит игр за тушёнку исчерпан'},
    {code:81,  text:'Недостаточно тушёнки'},
    {code:82,  text:'Нет активной раздачи — сначала нажми РАЗДАТЬ'},
    {code:83,  text:'Доступные смены карт закончились'},
    {code:84,  text:'Недостаточно рублей для партии'},
    {code:85,  text:'Нет активной партии'},
    {code:86,  text:'Доступные смены карт закончились'},
    {code:90,  text:'Нельзя зарубиться с самим собой'},
    {code:91,  text:'Игрок не найден'},
    {code:92,  text:'Рано ещё — этого игрока можно качать раз в 24 часа'},
    {code:99,  text:'Ошибка базы данных'},
    {code:403, text:'Доступ запрещён'},
];

/** Developer panel — добавление ресурсов в игру. */
export function attachDevPanel(proto){
    let saveTimer;
    // 26.09.2026 (по прямому репорту, подтверждено логами — "оплата прошла, а начисленное
    // потом пропало"): эта функция — ОТДЕЛЬНАЯ от player-save.js реализация сохранения (свой
    // прямой TS.php('users.save', ...)), которая раньше ничего не знала о
    // suspendPlayerSave() — например, во время ожидания подтверждения покупки
    // (bank.js._refreshBalanceAfterPurchase) window.udata[currency] ещё старый (сервер уже
    // начислил, клиент ещё не подтянул) — отправка ЭТОГО снимка затирала честно начисленный
    // сервером баланс. Теперь проверяем то же состояние приостановки и откладываем попытку
    // (через именованную функцию — arguments.callee запрещён в strict mode ES-модулей).
    const _attemptDevSave = () => {
        if(window.isPlayerSaveSuspended && isPlayerSaveSuspended()){
            console.warn('[devPanel.saveDevChanges] сохранение приостановлено (ждём критичный запрос, напр. подтверждение покупки) — откладываю');
            saveTimer = setTimeout(_attemptDevSave, 500);
            return;
        }
        TS.php('users.save', {udata_json: JSON.stringify(udata)}, (result) => {
            console.log('[devPanel] результат сохранения:', result);
        }, null);
    };
    const saveDevChanges = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(_attemptDevSave, 250);
    };

    // 29.09.2026 (см. коммент у $allowed в users.php — coins/stew/cigarettes убраны из
    // client-writable whitelist): дев-кнопки валюты больше не могут писать её через обычный
    // saveDevChanges()/users.save — используют узкий permit users.devGrantCurrency(). Принимает
    // объект {coins, stew, cigarettes} (любое подмножество, значения — дельта, может быть
    // отрицательной), применяет ответ через applyPatch (реальное значение всегда считает сервер).
    const _grantCurrencyServer = (deltas, cb) => {
        if(!window.TS) return;
        TS.php('users.devGrantCurrency', deltas, (e) => {
            if(e && e.patch) applyPatch(e.patch);
            if(window.iface){ iface.updateUp(); iface.updateNick(); }
            if(cb) cb(e);
        }, null);
    };


    proto._openDevPanel = function(){
        const DEV_UIDS = ['1113977365', '382448269'];
        if(!window.vk_params || !DEV_UIDS.includes(String(vk_params['vk_user_id']))) return;
        if(this._devWin && this._devWin.parent){
            this._closeDevPanel();
            return;
        }
        this._buildDevPanel();
        root.layer2_mc.addChild(this._devWin);
        // 18.09.2026 (репорт: "вкладку Dev перекрывает верхний HUD, такого быть не должно —
        // должна открываться поверх всего вообще"): одноразовый addChild при открытии
        // недостаточен — многие экраны (по конвенции проекта, см. CLAUDE.md "Паттерн нового
        // PIXI-экрана") сами делают root.layer2_mc.addChild(iface.up/down) КАЖДЫЙ раз при
        // своём открытии, что переподнимает HUD ПОВЕРХ уже открытой дев-панели, если что-то
        // такое происходит, пока панель открыта. Тот же приём, что у кнопки редактора позиций
        // (✥, см. universal_pos_editor.js) — держим панель на самом верху КАЖДЫЙ кадр через
        // Ticker, а не только один раз при создании.
        if(!this._devWinTickerFn){
            // 19.09.2026 (репорт: "худ почему-то выше по z-index, чем дев-панель" — предыдущая
            // правка 18.09.2026 переподнимала devWin только СРЕДИ ДЕТЕЙ layer2_mc, но не
            // трогала сам HUD (iface.up/down) — если HUD в этот момент физически лежал ГДЕ-ТО
            // ПОСЛЕ devWin внутри layer2_mc (многие экраны сами делают
            // root.layer2_mc.addChild(iface.up/down) при своём открытии/обновлении — см.
            // CLAUDE.md "Паттерн нового PIXI-экрана"), простое addChild(devWin) сразу же
            // перебивалось следующим таким вызовом. Теперь КАЖДЫЙ кадр сначала сами
            // подтягиваем HUD в layer2_mc, а СРАЗУ ПОСЛЕ — devWin поверх него: порядок внутри
            // layer2_mc гарантированно [...HUD, devWin] каждый кадр, независимо от того, что
            // делают другие экраны между кадрами.
            this._devWinTickerFn = () => {
                if(!this._devWin || !this._devWin.parent) return;
                if(window.iface){
                    if(iface.up)   root.layer2_mc.addChild(iface.up);
                    if(iface.down) root.layer2_mc.addChild(iface.down);
                }
                this._devWin.parent.addChild(this._devWin);
            };
            PIXI.Ticker.shared.add(this._devWinTickerFn);
        }
        console.log('[devPanel] открыт');
    };

    // Единая точка закрытия — используется кнопкой ✕, кликом по затемнению и повторным
    // нажатием кнопки открытия. Обязательно снимает wheel-слушатель скролла (см.
    // _buildDevPanel → блок «Скролл контента»), иначе он остаётся висеть на canvas
    // после закрытия панели и копится при повторных открытиях.
    proto._closeDevPanel = function(){
        if(this._devWheelHandler){
            const canvasEl = document.querySelector('canvas');
            if(canvasEl) canvasEl.removeEventListener('wheel', this._devWheelHandler);
            this._devWheelHandler = null;
        }
        if(this._devWin && this._devWin.parent) this._devWin.parent.removeChild(this._devWin);
        this._devWin = null;
        console.log('[devPanel] закрыт');
    };

    proto._buildDevPanel = function(){
        const win = new PIXI.Container();
        win.interactive = true;

        // 25.09.2026: _devWin пересоздаётся заново при каждом открытии панели (см.
        // _openDevPanel) — старая ссылка на попап ошибок (child УЖЕ отброшенного _devWin)
        // иначе осталась бы висеть и ложно считалась бы "уже открыта" при следующем нажатии.
        this._errBrowserWin = null;

        // Затемнение фона
        const bl = new PIXI.Graphics();
        bl.beginFill(0x000000, 0.78);
        bl.drawRect(0, 0, 1280, 720);
        bl.endFill();
        bl.interactive = true;
        bl.on('pointerdown', ()=>this._closeDevPanel());
        win.addChild(bl);

        // Панель
        // Раньше PY держали НИЖЕ HUD (y=0-58) намеренно, т.к. HUD раньше поднимался поверх
        // окна — с тех пор devWin рендерится выше ВСЕХ слоёв включая HUD (см. _openDevPanel),
        // так что заход панели в зону y<58 больше не проблема кликабельности.
        const PW = 730, PH = 650;
        const PX = Math.round((1280 - PW) / 2);
        const PY = 42; // 15.09.2026: поднято ещё на 40px по прямой просьбе (было 82)

        const panel = new PIXI.Graphics();
        panel.beginFill(0x12121e, 0.97);
        panel.lineStyle(2, 0x3ad4a4, 1);
        panel.drawRoundedRect(PX, PY, PW, PH, 10);
        panel.endFill();
        panel.interactive = true;
        win.addChild(panel);

        // Заголовок
        const title = new PIXI.Text('МЕНЮ РАЗРАБОТЧИКА', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#3af0c0',
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:2
        });
        title.anchor.set(0.5, 0);
        title.x = PX + PW/2; title.y = PY + 12;
        win.addChild(title);

        // Кнопка закрытия
        const closeG = new PIXI.Graphics();
        closeG.beginFill(0x7a2020, 0.9);
        closeG.drawRoundedRect(0, 0, 28, 28, 5);
        closeG.endFill();
        closeG.x = PX + PW - 38; closeG.y = PY + 10;
        closeG.interactive = true; closeG.buttonMode = true;
        closeG.on('pointerdown', ()=>this._closeDevPanel());
        const closeTxt = new PIXI.Text('✕', {fontFamily:'Arial', fontSize:16, fill:'#ffffff'});
        closeTxt.anchor.set(0.5, 0.5); closeTxt.x=14; closeTxt.y=14;
        closeG.addChild(closeTxt);
        win.addChild(closeG);

        // Разделитель под заголовком
        const sep = new PIXI.Graphics();
        sep.lineStyle(1, 0x3ad4a4, 0.4);
        sep.moveTo(PX+10, PY+42); sep.lineTo(PX+PW-10, PY+42);
        win.addChild(sep);

        // ── Скроллируемая область контента ─────────────────────────────
        // Панель уже переполнялась содержимым (PY+PH выходило за пределы канваса
        // 1280×720) — по прямой просьбе весь список секций/строк теперь живёт в
        // отдельном замаскированном контейнере с прокруткой (колесо мыши + перетаскивание
        // бегунка), а не напрямую в win. Заголовок/крестик/кнопка "МИЛЛИОН ВСЕГО" остаются
        // вне контейнера — не скроллятся, всегда на виду.
        const CONTENT_TOP = PY + 48;
        const CONTENT_BOTTOM = PY + PH - 8;
        const VIS_H = CONTENT_BOTTOM - CONTENT_TOP;

        const content = new PIXI.Container();
        win.addChild(content);

        const contentMask = new PIXI.Graphics();
        contentMask.beginFill(0xffffff);
        contentMask.drawRect(PX, CONTENT_TOP, PW, VIS_H);
        contentMask.endFill();
        win.addChild(contentMask);
        content.mask = contentMask;

        // ── Построитель строк ────────────────────────────────────────
        let curY = PY + 48;
        const ROW_H = 26;
        const BTN_H = 20;
        const BTN_GAP = 5;
        const BTNS_X = PX + 210;
        const LBL_X  = PX + 14;

        const _btn = (label, color, onClick) => {
            const chars = label.length;
            const BW = chars <= 3 ? 52 : chars <= 5 ? 64 : chars <= 7 ? 80 : 96;
            const g = new PIXI.Graphics();
            g.beginFill(color, 0.92);
            g.drawRoundedRect(0, 0, BW, BTN_H, 4);
            g.endFill();
            g.interactive = true; g.buttonMode = true;
            g.on('pointerover', ()=>{ g.alpha = 0.65; });
            g.on('pointerout',  ()=>{ g.alpha = 1; });
            g.on('pointerdown', ()=>{ onClick(); g.alpha = 0.4; setTimeout(()=>g.alpha=1, 120); });
            const t = new PIXI.Text(label, {fontFamily:'Southbank LT', fontSize:12, fill:'#ffffff'});
            t.anchor.set(0.5, 0.5); t.x=BW/2; t.y=BTN_H/2;
            g.addChild(t);
            return { g, w: BW };
        };

        const _row = (label, btns) => {
            const lbl = new PIXI.Text(label, {fontFamily:'Southbank LT', fontSize:14, fill:'#bbbbbb'});
            lbl.x = LBL_X; lbl.y = curY + 3;
            content.addChild(lbl);
            let bx = BTNS_X;
            btns.forEach(b => {
                const {g, w} = _btn(b.label, b.color, b.action);
                g.x = bx; g.y = curY + 1;
                content.addChild(g);
                bx += w + BTN_GAP;
            });
            curY += ROW_H;
        };

        const _section = (label) => {
            curY += 4;
            const g = new PIXI.Graphics();
            g.lineStyle(1, 0x3ad4a4, 0.35);
            g.moveTo(PX+10, curY+10); g.lineTo(PX+PW-10, curY+10);
            content.addChild(g);
            const t = new PIXI.Text(label, {fontFamily:'Southbank LT', fontSize:14, fill:'#3af0c0'});
            t.x = LBL_X; t.y = curY + 2;
            content.addChild(t);
            curY += 22;
        };

        const million = _btn('МИЛЛИОН ВСЕГО', 0x1a3a7a, () => this._giveMillion());
        million.g.x = PX + 14; million.g.y = PY + 12;
        win.addChild(million.g);

        // ── Хелперы действий ────────────────────────────────────────
        const _addU = (key, amt) => {
            if(!window.udata) return;
            if(key === 'coins' || key === 'stew' || key === 'cigarettes'){
                _grantCurrencyServer({[key]: amt}, () => {
                    console.log('[devPanel] +'+amt+' к '+key+' (сервер) итого='+udata[key]);
                });
                return;
            }
            udata[key] = String(parseInt(udata[key]||0) + amt);
            if(window.iface){ iface.updateUp(); iface.updateNick(); }
            saveDevChanges();
            console.log('[devPanel] +'+amt+' к '+key+'  итого='+udata[key]);
        };
        const _energy = (amount) => {
            const max = parseInt(udata['max_energy'] || 50);
            const current = window.TIMERS ? TIMERS.current_energy : parseInt(udata['energy'] || 0);
            const value = amount === null ? max : Math.min(max, current + amount);
            udata['energy'] = String(value);
            if(window.TIMERS){
                TIMERS.ENERGY_MAX = max;
                TIMERS.current_energy = TIMERS.energy_base = value;
                TIMERS.energy_base_time = Date.now();
            }
            if(window.iface) iface.updateEnergy();
            saveDevChanges();
        };
        const _addAmmo = (idx, amt) => {
            if(!window.weapons) return;
            const wp = weapons.data[idx];
            if(!wp) return;
            wp.qty = (parseInt(wp.qty)||0) + amt;
            wp.owned = true;
            weapons._saveToUdata();
            saveDevChanges();
            this._pushWeaponsGrant();
            console.log('[devPanel] оружие['+idx+'].qty='+wp.qty);
        };
        const _buy = (idx) => {
            if(!window.weapons) return;
            weapons.data[idx].owned = true;
            weapons._saveToUdata();
            saveDevChanges();
            this._pushWeaponsGrant();
            console.log('[devPanel] куплено оружие idx='+idx);
        };
        const _addKey = (i, amt) => {
            if(!window.bosses) return;
            bosses.keys[i] = (parseInt(bosses.keys[i]||0) + amt);
            bosses._saveToUdata();
            saveDevChanges();
            console.log('[devPanel] ключ['+i+']='+bosses.keys[i]);
        };

        // Цвета кнопок
        const G=0x1e6b2a, B=0x1a3a7a, O=0x6a3a10, R=0x6a1a1a, P=0x4a1a6a, T=0x1a5a5a;

        // ── ВАЛЮТА ──────────────────────────────────────────────────
        _section('ВАЛЮТА');
        _row('Рубли', [
            {label:'+1К',   color:G, action:()=>_addU('coins',1000)},
            {label:'+10К',  color:G, action:()=>_addU('coins',10000)},
            {label:'+100К', color:G, action:()=>_addU('coins',100000)},
            {label:'+1М',   color:B, action:()=>_addU('coins',1000000)},
        ]);
        _row('Сигареты', [
            {label:'+100',  color:G, action:()=>_addU('cigarettes',100)},
            {label:'+1К',   color:G, action:()=>_addU('cigarettes',1000)},
            {label:'+10К',  color:G, action:()=>_addU('cigarettes',10000)},
            {label:'+100К', color:B, action:()=>_addU('cigarettes',100000)},
        ]);
        _row('Тушёнка', [
            {label:'+1',   color:O, action:()=>_addU('stew',1)},
            {label:'+5',   color:O, action:()=>_addU('stew',5)},
            {label:'+10',  color:O, action:()=>_addU('stew',10)},
            {label:'+50',  color:O, action:()=>_addU('stew',50)},
        ]);
        _row('Опыт', [
            {label:'+1К',   color:P, action:()=>_addU('exp',1000)},
            {label:'+10К',  color:P, action:()=>_addU('exp',10000)},
            {label:'+100К', color:P, action:()=>_addU('exp',100000)},
            {label:'+1М',   color:P, action:()=>_addU('exp',1000000)},
        ]);
        _row('Энергия', [
            {label:'+50',  color:T, action:()=>_energy(50)} ,
            {label:'+100', color:T, action:()=>_energy(100)} ,
            {label:'МАКС', color:R, action:()=>_energy(null)} ,
        ]);
        _row('Синие поинты', [
            {label:'+50',  color:B, action:()=>_addU('blue_points',50)},
            {label:'+100', color:B, action:()=>_addU('blue_points',100)},
            {label:'+500', color:B, action:()=>_addU('blue_points',500)},
        ]);
        _row('Зарики', [
            {label:'+50',  color:R, action:()=>_addU('dice_points',50)},
            {label:'+100', color:R, action:()=>_addU('dice_points',100)},
            {label:'+500', color:R, action:()=>_addU('dice_points',500)},
        ]);

        // ── ОРУЖИЕ ──────────────────────────────────────────────────
        _section('ОРУЖИЕ');
        [['Мачете',3],['Ствол',4],['Автомат',5]].forEach(([name, idx]) => {
            _row(name, [
                {label:'+100', color:O, action:()=>_addAmmo(idx,100)},
                {label:'+1К',  color:O, action:()=>_addAmmo(idx,1000)},
                {label:'+10К', color:O, action:()=>_addAmmo(idx,10000)},
                {label:'КУПИТЬ',color:G,action:()=>_buy(idx)},
            ]);
        });

        // ── ДВОР ────────────────────────────────────────────────────
        _section('ДВОР');
        _row('Уровни игр', [
            {label:'100 УР. ВСЕ', color:P, action:()=>this._maxDvorLevels()},
        ]);

        _section('РЮКЗАК');
        _row('Уровень рюкзака', [
            {label:'МАКС. 20 УР.', color:P, action:()=>this._setDevRyukzakLevel20()},
        ]);

        // ── ШМОТ ────────────────────────────────────────────────────
        // 19.09.2026 (по прямому указанию): кнопка выдачи всех предметов гардероба сразу —
        // чтобы проверять внешний вид/тултипы/фильтры магазина, не фармя каждую вещь отдельно.
        _section('ШМОТ');
        _row('Гардероб', [
            {label:'ОТКРЫТЬ ВСЁ', color:P, action:()=>this._unlockAllShmot()},
        ]);
        if(String(window.vk_params && vk_params['vk_user_id']) === '382448269'){
            _row('Связка ключей', [
                {label:'ВКЛ / ВЫКЛ', color:T, action:()=>this._toggleDevKeyring()},
            ]);
        }
        // 22.09.2026 (по прямому указанию — "добавь в dev кнопку которая делает 100% шанс
        // дропа шмоток отовсюду") — личный server-only флаг аккаунта (users.setDevFlag),
        // читается bosses.php.claimKill()/yashik.php.openBox() перед каждым броском шанса
        // дропа — форсирует гарантированную выдачу (боссы, ящик, Потерянный тайник) ТОЛЬКО
        // для этого аккаунта, остальные игроки не затронуты.
        _row('Дроп шмота 100%', [
            {label:'ВКЛ',  color:T, action:()=>this._setDevForceDrops(true)},
            {label:'ВЫКЛ', color:R, action:()=>this._setDevForceDrops(false)},
        ]);

        // ── ТЕСТ UI ───────────────────────────────────────────────────
        _section('ТЕСТ UI');
        _row('Компас загрузки', [
            {label:'ПОКАЗАТЬ', color:T, action:()=>this._testCompass()},
        ]);
        _row('Достижение', [
            {label:'ПОКАЗАТЬ', color:T, action:()=>this._testAchievementPopup()},
        ]);
        // 25.09.2026 (по прямому указанию — "кнопка, при нажатии на которую открывается поп-ап
        // с текстами ошибок, которые есть в игре, можно листать"): зеркало server/json/errors.json
        // (DEV_ERROR_CATALOG ниже) — тот же приём, что уже используется для зеркала дроп-пула
        // шмоток в bosses_prefight.js: сервер остаётся источником истины, здесь только копия
        // для офлайн-просмотра текстов без реального провоцирования каждой ошибки вручную.
        _row('Тексты ошибок', [
            {label:'ПОКАЗАТЬ', color:T, action:()=>this._openErrorBrowser()},
        ]);

        // ── КЛЮЧИ БОССОВ ────────────────────────────────────────────
        _section('КЛЮЧИ БОССОВ');
        ['Охотник','Счастливчик','Ястреб','Меченный','Крыс','Баркут','Борода','Жгут'].forEach((name, i) => {
            _row(name, [
                {label:'+1', color:O, action:()=>_addKey(i,1)},
                {label:'+3', color:O, action:()=>_addKey(i,3)},
                {label:'+5', color:R, action:()=>_addKey(i,5)},
            ]);
        });

        // ── СБРОС ───────────────────────────────────────────────────
        _section('СБРОС');
        _row('Аккаунт', [
            {label:'СБРОС ВСЕГО', color:R, action:()=>this._resetAccount()},
        ]);
        // 23.09.2026 (по прямому указанию, после разового ручного сброса всех тестовых
        // аккаунтов через одноразовый server/reset_all_players_23092026.php — тот скрипт
        // выполнен и удалён с сервера, но сама операция понадобится ещё не раз в ходе
        // тестирования): постоянная кнопка вместо одноразового скрипта на каждый раз.
        // Кнопка видна ЛЮБОМУ игроку (DEV-кнопка в HUD ничем не ограничена, см.
        // interface.js) — единственная защита от случайного/злонамеренного нажатия это
        // серверная проверка пароля в users.resetAllPlayers() (см. users.php), НЕ клиентский
        // prompt() сам по себе (его тривиально обойти из консоли).
        _row('Все игроки', [
            {label:'СБРОС У ВСЕХ', color:R, action:()=>this._resetAllPlayers()},
        ]);

        // ── МИНИ-ИГРЫ / БОЙ (ТЕСТ) ───────────────────────────────────
        // 25.09.2026 (по прямому указанию — "вместо визуальной демки стаканчиков сделай 100%
        // шанс джекпота для теста"): старая кнопка "Стаканчики/ОТКРЫТЬ" (super_game.js,
        // чисто визуальная демка без сервера) убрана — вместо нее кнопка форсирует джекпот на
        // СЛЕДУЮЩЕМ реальном roulette.spin() этого игрока (dev-only флаг на сервере,
        // roulette.php.spin() проверяет и сразу сбрасывает — см. users.setDevFlag), чтобы
        // можно было пройти всю настоящую цепочку (спин → выбор приза/мини-игра → стаканчики)
        // вживую, а не по отдельной изолированной демке.
        _section('МИНИ-ИГРЫ / БОЙ (ТЕСТ)');
        _row('Джекпот рулетки', [
            {label:'100% НА СЛЕД. СПИН', color:T, action:()=>this._forceNextJackpot()},
        ]);
        // 25.09.2026 (по прямому указанию — "кнопка открывает бой с любым боссом (Охотник) и
        // показывает эффект критического урона, чтобы двигать его в редакторе"): обычный вход
        // в бой (та же цепочка проверок, что и у игрока — Охотнику ключи не нужны), эффект
        // включается ПОСЛЕ того как экран боя реально построен (спрайт эффекта появляется
        // только в _buildBossesFight), поэтому ждём его появления коротким поллингом вместо
        // фиксированной задержки.
        _row('Бой + крит-эффект', [
            {label:'ОХОТНИК', color:T, action:()=>{
                this._closeDevPanel();
                if(!window.iface) return;
                iface._openBossesFight(0, 0);
                let tries = 0;
                const _waitAndShow = () => {
                    if(iface._bossCritEffectSpr){ iface._devShowCriticalEffectPersistent(); return; }
                    if(++tries < 40) setTimeout(_waitAndShow, 100);
                };
                setTimeout(_waitAndShow, 100);
            }},
        ]);

        // 26.09.2026 (по прямому указанию — "сделай кнопку попап награды с боссом с мок-
        // данными, как будто босса било 10 человек, 1 место 11к урона, 2 место 10к, 3 место
        // 9к и т.д."): открывает попап результата боя НАПРЯМУЮ (без реального боя) с
        // синтетическим топ-10 — damage убывает ровно на 1000 на каждое место (11000..2000).
        // id[0] — реальный vk_user_id тестера (своё фото должно резолвиться по-настоящему),
        // остальные — заведомо несуществующие положительные id (VK просто не найдёт их и
        // молча оставит слот без фото — bosses._resolveVkUsers уже это обрабатывает без ошибок,
        // не путать с невалидными <=0 id, которые там же намеренно отфильтровываются).
        _row('Попап награды (мок, 10 участников)', [
            {label:'ОТКРЫТЬ', color:T, action:()=>{
                this._closeDevPanel();
                if(!window.iface || typeof iface._showBossResultPopup !== 'function') return;
                const myUid = parseInt((window.vk_params && vk_params['vk_user_id']) || 0, 10) || 1;
                const mockTop = [];
                for(let i = 0; i < 10; i++){
                    mockTop.push({ id: i === 0 ? myUid : (900000000 + i), nick: 'Тестер ' + (i + 1), damage: 11000 - i * 1000 });
                }
                iface._showBossResultPopup({
                    bossIdx: 0, diffIdx: 0, isWin: true,
                    cig: 1000, exp: 5000, ryukzak: 50,
                    hpLeft: 0, maxHp: (window.bosses && bosses.BOSS_HP) ? bosses.BOSS_HP[0][0] : 100000,
                    top: mockTop,
                    shmotAmount: 1, shmotWonId: 41, shmotWonName: 'Панама (Охотник)',
                });
            }},
        ]);

        // 30.09.2026 (обучение, по прямому указанию — "хочу себе это сделать для
        // тестирования"): перезапускает тур с начала через прямой restart() — обучение теперь
        // и так открыто всем (_isEligible() всегда true), кнопка просто даёт сбросить и
        // посмотреть заново, не дожидаясь сброса всего аккаунта.
        _section('ОБУЧЕНИЕ');
        _row('Тур по вкладкам', [
            {label:'ЗАНОВО', color:T, action:()=>{
                this._closeDevPanel();
                if(window.onboarding) onboarding.restart();
                else console.error('[dev_panel] window.onboarding ещё не создан');
            }},
        ]);

        // ── Скролл контента (колесо мыши + бегунок) ────────────────────
        // totalH — фактическая высота всего построенного контента (curY дошёл до конца
        // последней секции); maxScroll = 0, если контент помещается целиком — тогда
        // бегунок вообще не рисуем (нечего скроллить).
        const totalH = curY - CONTENT_TOP + 10;
        const maxScroll = Math.max(0, totalH - VIS_H);

        if(maxScroll > 0){
            const trackX = PX + PW - 14;
            const track = new PIXI.Graphics();
            track.beginFill(0x000000, 0.35);
            track.drawRoundedRect(trackX, CONTENT_TOP, 6, VIS_H, 3);
            track.endFill();
            win.addChild(track);

            const thumbH = Math.max(24, VIS_H * VIS_H / totalH);
            const thumb = new PIXI.Graphics();
            thumb.beginFill(0x3ad4a4, 0.85);
            thumb.drawRoundedRect(0, 0, 6, thumbH, 3);
            thumb.endFill();
            thumb.x = trackX; thumb.y = CONTENT_TOP;
            thumb.interactive = true; thumb.buttonMode = true;
            win.addChild(thumb);

            let scrollRatio = 0;
            const _applyScroll = () => {
                content.y = -scrollRatio * maxScroll;
                thumb.y = CONTENT_TOP + scrollRatio * (VIS_H - thumbH);
            };

            let dragging = false, dragY0 = 0, ratio0 = 0;
            const onThumbMove = (e) => {
                if(!dragging) return;
                const dy = e.data.global.y - dragY0;
                scrollRatio = Math.max(0, Math.min(1, ratio0 + dy / Math.max(1, VIS_H - thumbH)));
                _applyScroll();
            };
            const onThumbUp = () => {
                dragging = false;
                win.off('pointermove', onThumbMove);
                win.off('pointerup', onThumbUp);
                win.off('pointerupoutside', onThumbUp);
            };
            thumb.on('pointerdown', (e) => {
                dragging = true; dragY0 = e.data.global.y; ratio0 = scrollRatio;
                win.on('pointermove', onThumbMove);
                win.on('pointerup', onThumbUp);
                win.on('pointerupoutside', onThumbUp);
            });

            // Колесо мыши вешаем на сам canvas (PIXI v6 не эмитит wheel-события через свою
            // interaction-систему) — тот же паттерн, что уже используется в shmot_shop.js.
            // Слушатель снимается в _closeDevPanel(), иначе копился бы при каждом открытии.
            this._devWheelHandler = (e) => {
                if(!this._devWin || !this._devWin.parent) return;
                scrollRatio = Math.max(0, Math.min(1, scrollRatio + e.deltaY * 0.0015));
                _applyScroll();
            };
            const canvasEl = document.querySelector('canvas');
            if(canvasEl) canvasEl.addEventListener('wheel', this._devWheelHandler, { passive: true });

            console.log('[devPanel] контент скроллируемый | высота контента:', Math.round(totalH), '| видимая область:', VIS_H, '| maxScroll:', Math.round(maxScroll));
        } else {
            console.log('[devPanel] контент помещается целиком, скролл не нужен | высота контента:', Math.round(totalH), '| видимая область:', VIS_H);
        }

        this._devWin = win;
    };

    // Показывает попап "Достижение выполнено" для проверки вёрстки/позиционирования —
    // берёт первое достижение из списка и открывает как обычный попап (через штатную
    // очередь _openAchievementPopup), НЕ начисляя очки и не трогая earned (это не
    // _checkAll — только показ). Попап уже поддерживает универсальный редактор позиций
    // (иконка/тексты помечены _uDraggable в achievement.js) — можно включить кнопку ✥
    // и подвигать элементы плашки прямо во время показа.
    proto._testAchievementPopup = function(){
        if(!window.achievements || !achievements.list || !achievements.list.length){
            console.warn('[devPanel._testAchievementPopup] achievements не загружены');
            return;
        }
        const a = achievements.list[0];
        // persistent:true — именно в dev-панели попап держится на экране постоянно (закрыть
        // можно только тапом), чтобы спокойно подгонять позиции элементов редактором (✥),
        // не соревнуясь с авто-исчезновением через ~3.8с, как в боевом показе.
        achievements._openAchievementPopup(a, {persistent:true});
        console.log('[devPanel._testAchievementPopup] показан тестовый попап достижения (persistent) | id:', a.id, '| name:', a.name);
    };

    // DEV: сервер выставляет ровно 1200 очков — это последний порог и, следовательно,
    // уровень рюкзака 20. Обычный users.save намеренно не может менять это поле.
    proto._setDevRyukzakLevel20 = function(){
        if(!window.TS) return;
        TS.php('users.devSetRyukzakLevel', {}, (res) => {
            if(res && res.patch) applyPatch(res.patch);
            if(window.iface) iface.updateUp();
            notify.showResult({text:'Рюкзак: уровень 20'}, 1);
        }, (err) => {
            console.error('[devPanel._setDevRyukzakLevel20] ошибка:', err);
            notify.showResult({text:'Не удалось выставить уровень рюкзака'}, 0);
        });
    };

    // Полный сброс аккаунта до состояния нового игрока (15.09.2026, по прямой просьбе).
    // Не трогает БД напрямую (правило проекта — CLAUDE.md №3) — udata заменяется дефолтным
    // объектом и сохраняется через штатный users.save.
    //
    // ВАЖНО (баг найден 15.09.2026, репорт "сбросил аккаунт, но остались шмотки"):
    // server/users.php.save() НЕ перезаписывает всю строку целиком — он идёт по своему
    // whitelist ($allowed) и обновляет в БД ТОЛЬКО те колонки, чьи ключи реально ЕСТЬ во
    // входящем JSON (`if(isset($incoming[$key]))`). Раньше этот объект содержал только
    // ~20 "простых" полей (валюта/энергия), а weapons/shmot/bosses_data/achievements/
    // skills_data/gang_data/inventory и т.д. были ПРОПУЩЕНЫ ВООБЩЕ — сервер просто не
    // трогал старые значения этих колонок в БД, и на следующей загрузке они возвращались
    // как ни в чём не бывало. Комментарий "каждый модуль сам восстановит дефолт" был
    // неверен: это работает только когда ключа вообще нет в БД (настоящий новый игрок),
    // а не когда он там уже есть и сервер его не очищает. Исправлено: явно перечисляем
    // КАЖДЫЙ ключ из server/users.php.$allowed с "пустым" значением (JSON-поля → '{}'/''
    // — falsy в клиентских проверках вида `if(!udata['x']) return`, счётчики → '0'), чтобы
    // сервер реально обнулил каждую колонку.
    // После сохранения — обязательная перезагрузка страницы: многие модули (weapons/bosses/
    // skills и т.д.) уже держат старые значения в памяти и сами не перечитают udata без reload.
    proto._resetAccount = function(){
        if(!window.udata) return;
        this._showConfirmPopup('Полный сброс аккаунта — все данные будут стёрты. Точно?', ()=>{
            window.udata = window.wrapPlayerData({
                // Валюта / ресурсы
                coins:'10', cigarettes:'1000', stew:'0', exp:'0', energy:'50', max_energy:'50',
                respect:'0', ammo_auto:'0', ammo_gun:'0', ammo_machete:'0', health:'100', energy_time:'0',
                poker_chips:'0', poker_spichki:'0', roulette_spichki:'0',
                blue_points:'0', dice_points:'0', habar_counts:'0', stash_count:'0',
                dvor_games:'0', dvor_games_data:'{}', dvor_daily:'{}',
                dvor_daily_sigs:'{}', nickname:'', level:'1', stew_spent:'0',
                roulette_winner:'{}',
                // Всё остальное из server/users.php $allowed — раньше отсутствовало здесь
                // вообще, из-за чего сервер оставлял старые значения в БД нетронутыми.
                zone:'{}', base_buildings:'', base_stats:'', base_location:'',
                // gang_id/hapuga_sold/vassilich_buys — колонки типа INT в БД (не TEXT/VARCHAR,
                // как большинство остальных) — пустая строка '' там вызывает mysqli fatal error
                // "Incorrect integer value: '' for column..." (репорт: "всё ещё не работает
                // сброс", 500 на users.save сразу после того, как был закрыт баг с habar_bought).
                // Нужен именно '0', как и у прочих числовых счётчиков.
                // 22.09.2026 (баг найден по прямому указанию — "сбросил БД, количество патронов
                // не сбросилось"): weapons/shmot были '' (пустая строка) — users.php._sanitizeWeapons()/
                // _sanitizeShmot() делают json_decode('') → null → is_array(null) === false →
                // ВСЁ поле молча отклоняется целиком (см. return null в обоих методах), старый
                // JSON-блоб (с прежними qty/owned/upg) остаётся в БД нетронутым. weapons.js читает
                // патроны ИЗ ЭТОГО блоба (ammo_auto/ammo_gun/ammo_machete — лишь legacy-фолбэк,
                // не основной источник), поэтому патроны/оружие визуально не сбрасывались, хотя
                // сам запрос users.save формально "проходил успешно". '[]' — валидный JSON пустой
                // массив, проходит json_decode/is_array и реально обнуляет блоб.
                gang_id:'0', gang_data:'[]', weapons:'[]', shmot:'[]', inventory:'[]',
                hapuga_items:'', hapuga_sold:'0', hapuga_refreshes:'0', hapuga_avail:'1', hapuga_next_ts:'0',
                bp_level:'0', bp_xp:'0', bp_xp_next:'0', bp_claimed:'', svod_claimed:'',
                zadaniya:'', zadaniya_day:'', bot_settings:'', bot_running:'0',
                days_played:'1', total_damage:'0', zone_fights:'0', dvor_wins:'0',
                bosses_killed:'0', habar_opened:'0',
                train_count:'0', vassilich_buys:'0', coins_earned:'0',
                bosses_data:'', zone_income_time:'0',
                zone_fights_0:'0', zone_fights_1:'0', zone_fights_2:'0', zone_fights_3:'0', zone_fights_4:'0',
                natisk_event_id:'', natisk_free_attempts:'0', natisk_paid_attempts:'0', natisk_kills:'0',
                natisk_seen_event_id:'',
                ach_score:'0',
                skills_data:'', skill_points:'0',
                hata_progress:'-1', base_bg_owned:'', base_bg_active:'',
                stash_data:'', stash_count:'0',
                boss_kills_0:'0', boss_kills_1:'0', boss_kills_2:'0',
                bj_games:'0', dice_games:'0', energy_spent:'0',
                habar_bought:'0', habar_days_collected:'',
                sedoy_dmg_total:'0', sedoy_dmg_left:'0',
                achievements:'', achievement_stars:'0',
                coins_spent:'0', votes_spent:'0', str_xp_total:'0', login_streak:'0', last_login_day:'',
                ryukzak_points:'0', ryukzak_claimed_level:'0',
                // Аудит 16.09.2026 — раньше отсутствовали в whitelist сервера (см. users.php),
                // добавлены сюда для полноты сброса теперь, когда сервер их реально сохраняет.
                boss_keys:'0', bullets:'0', tatu:'0', nick:'',
                cards_games:'0', cards_combos:'{}', poker_games:'0', poker_combos:'{}',
                roulette_games:'0', solo_kills:'[]', speed_kills:'[]',
                habar_last_collect_ts:'0', keyring_owner:'0',
                loc_respect_0:'0', loc_respect_1:'0', loc_respect_2:'0', loc_respect_3:'0', loc_respect_4:'0',
                dice_free_ts:'0',
                // 24.09.2026: snd_vol/mus_vol (громкость звука/музыки) — те же дефолты, что уже
                // были в JS-фолбэке sound.js (0.7/0.5) и в migrate31.php.
                snd_vol:'0.7', mus_vol:'0.5',
                // Найдено 18.09.2026 (тест-свипом при переносе Ящика): zone_collect_0..4
                // (кулдаун 8ч сбора дохода бизнеса, см. migrate16.php/zone.php.collectIncome)
                // добавлены в whitelist при переносе Зоны, но забыты здесь — сброшенный
                // аккаунт всё ещё сидел на СТАРОМ кулдауне сбора дохода локаций.
                zone_collect_0:'0', zone_collect_1:'0', zone_collect_2:'0', zone_collect_3:'0', zone_collect_4:'0',
                // 30.09.2026 (обучение): сброс возвращает игрока к состоянию "обучение ещё не
                // показывалось" — '' трактуется onboarding.js._currentStep() как 'intro'.
                onboarding_step:'',
            });
            console.log('[devPanel._resetAccount] udata заменён дефолтом нового игрока (полный whitelist):', udata);
            // 18.09.2026 (найдено при аудите после переноса экономики на сервер): skills_levels/
            // dice_session/poker_session/blackjack_session/yashik_session/roulette_cups — server-only
            // игровые сессии, сознательно НЕ входящие в whitelist users.php (иначе клиент мог бы
            // подделать их через users.save, что и было целью переноса на сервер). Обычный
            // users.save() ниже их не достаёт — без этого отдельного вызова "полный сброс"
            // оставлял бы прокачанные скиллы и зависшие игровые сессии нетронутыми в БД.
            TS.php('users.resetSession', {}, (r)=>{
                console.log('[devPanel._resetAccount] server-only сессии (скиллы/покер/зарики/блэкджек/ящик/рулетка-кубки) сброшены:', JSON.stringify(r));
            }, (err)=>{
                console.error('[devPanel._resetAccount] не удалось сбросить server-only сессии:', JSON.stringify(err));
            });
            // 25.09.2026: 'shmot' убран из client-writable whitelist (см. комментарий у
            // $allowed в users.php) — shmot:'[]' в объекте выше через обычный users.save
            // больше НЕ сохранится, требуется отдельный dev-only вызов (тот же приём, что
            // используется в _unlockAllShmot()).
            TS.php('users.devGrantShmot', {shmot_json: '[]'}, (r)=>{
                console.log('[devPanel._resetAccount] shmot сброшен на сервере:', JSON.stringify(r));
            }, (err)=>{
                console.error('[devPanel._resetAccount] не удалось сбросить shmot на сервере:', JSON.stringify(err));
            });
            // 26.09.2026 (по прямому репорту — "остался в рамке локации как человек с больше
            // всего уважения после сброса"): zone_respect_leader — отдельная глобальная таблица
            // рекордов, не задевается обычным users.save/resetSession (см. комментарий у
            // zone.php.resetMyRespectLeader()) — сбрасываем отдельным вызовом.
            TS.php('zone.resetMyRespectLeader', {}, (r)=>{
                console.log('[devPanel._resetAccount] рамка уважения (zone_respect_leader) сброшена на сервере:', JSON.stringify(r));
            }, (err)=>{
                console.error('[devPanel._resetAccount] не удалось сбросить рамку уважения:', JSON.stringify(err));
            });
            if(window.skills){
                // Зеркалим сброс skills_levels и в клиентской памяти — иначе прокачанные уровни
                // остались бы видны в открытом окне Скиллов до следующей полной перезагрузки
                // страницы (см. skills.js._loadLevelsFromUdata — читает udata['skills_levels'],
                // которого после сброса просто нет в новом udata, поэтому сама не перезапишет).
                skills.levels = new Array(20).fill(0);
                skills.skillsDmgSpent = 0;
                if(skills._win && typeof skills._refresh === 'function') skills._refresh();
                console.log('[devPanel._resetAccount] skills.levels обнулены в памяти');
            }
            TS.php('users.save', {udata_json: JSON.stringify(udata)}, (result)=>{
                console.log('[devPanel._resetAccount] сохранено на сервере:', result);
                if(window.notify) notify.showResult({text:'Аккаунт сброшен'}, 1);
                // По просьбе пользователя (16.09.2026) — без перезагрузки страницы. Закрываем
                // весь открытый UI через _closeAllPanels() и обновляем HUD, чтобы не показывать
                // старые значения.
                this._closeDevPanel();
                // Хабар — самостоятельный PIXI-оверлей с собственным секундным таймером.
                // Закрываем его без условия на parent: после сброса он мог остаться видимым
                // до перезагрузки, если сцена уже была переподвешена другим оверлеем.
                if(window.habar && typeof habar.close === 'function') habar.close();
                if(typeof this._closeAllPanels === 'function') this._closeAllPanels();
                if(typeof this.updateUp === 'function') this.updateUp();
                // Баг найден 18.09.2026 ("сбросил аккаунт — уровень и опыт остались старыми"):
                // уровень и exp-полоска перерисовываются ТОЛЬКО в updateNick() (interface.js —
                // она же пересчитывает level из udata['exp'] и обновляет exp_bar), а не в
                // updateUp() (та трогает только stew/coins/cigarettes). updateNick() тут не
                // вызывалась вообще — level_txt/exp_bar так и оставались нарисованными по
                // старым, дореформенным значениям, хотя сам udata['exp'] уже был '0'.
                if(typeof this.updateNick === 'function') this.updateNick();

                // Баг найден 16.09.2026 ("энергия не сбрасывается до 50, таймер боссов не
                // сбрасывается") — прямое следствие отказа от location.reload() выше: TIMERS и
                // bosses кешируют своё состояние в памяти отдельно от udata и НЕ перечитывают
                // его сами при простой смене udata объекта. Форсируем перечитывание обоих здесь.
                if(window.TIMERS && typeof TIMERS.updateFromUdata === 'function'){
                    TIMERS.updateFromUdata();
                    console.log('[devPanel._resetAccount] TIMERS.updateFromUdata() — энергия принудительно пересчитана из сброшенного udata:', TIMERS.current_energy, '/', TIMERS.ENERGY_MAX);
                }
                if(window.bosses){
                    // bosses._loadFromUdata() тут не подходит — она только ДОБАВЛЯЕТ поля из
                    // распарсенного bosses_data и сразу же return'ится на пустой строке (см.
                    // bosses-combat.js._loadFromUdata: `if(!udata['bosses_data']) return;`),
                    // т.е. ничего не обнулит. Явно возвращаем те же дефолты, что и в конструкторе
                    // Bosses (bosses.js) — таймер боя, ключи, дневной лимит и т.д.
                    bosses.keys       = [999,0,0,0,0,0,0,0];
                    bosses.killsTotal = [0,0,0,0,0,0,0,0];
                    bosses.dailyKills = [0,0,0,0,0,0,0,0];
                    bosses.dailyDate  = '';
                    bosses._bossStartMs = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
                    bosses._freeWpnLastMs = {};
                    bosses.friendDmgApplied = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
                    bosses._curCycleDmg = [0,0,0,0,0,0,0,0];
                    bosses.hpByDiff = [
                        [...bosses.BOSS_HP.map(r=>r[0])],
                        [...bosses.BOSS_HP.map(r=>r[1])],
                        [...bosses.BOSS_HP.map(r=>r[2])],
                        [...bosses.BOSS_HP.map(r=>r[3])],
                    ];
                    console.log('[devPanel._resetAccount] bosses — таймер боя/ключи/дневной лимит принудительно сброшены в памяти');
                }
                if(window.zone){
                    // Баг найден 18.09.2026 ("сбросил аккаунт — прогресс Кордона остался") — та же
                    // причина, что уже была закрыта для bosses выше: zone._loadFromUdata() ТОЛЬКО
                    // ДОБАВЛЯЕТ прогресс из сохранённого JSON (`if(!saved[li]) continue;` — при
                    // udata['zone']==='{}' применять просто нечего), сама никогда ничего не
                    // обнуляет. Явно возвращаем те же дефолты, что и в конструкторе Zone —
                    // чекпоинты/бизнесы/зачистки локаций.
                    zone.locations.forEach(loc => {
                        loc.checkpoints.forEach(cp => { cp.filled = 0; });
                        loc.businesses.forEach(b => { b.level = 0; });
                        loc.cleared = 0;
                        loc.currentBizIdx = 0;
                    });
                    zone.currentLoc = 0;
                    console.log('[devPanel._resetAccount] zone — чекпоинты/бизнесы/зачистки локаций принудительно сброшены в памяти');
                }
                if(window.shmot){
                    // Баг найден 18.09.2026 ("после сброса аккаунта шмотки остались надеты") —
                    // та же причина, что уже закрыта выше для bosses/zone: shmot._loadFromUdata()
                    // (shmot.js) при udata['shmot']==='' делает `if(!udata['shmot']) return;` —
                    // ничего не трогает, старое состояние (owned/equipped) в памяти остаётся как
                    // было. По прямому указанию 18.09.2026 у игрока изначально НЕ должно быть
                    // никакой надетой/купленной одежды вообще (раньше 4 предмета — Бандана,
                    // Майка, Брюки сталкера, Берцы простые — были зашиты как owned:true/
                    // equipped:true прямо в конструкторе Shmot; убрано там же).
                    shmot.items.forEach(it => { it.owned = false; it.equipped = false; });
                    // Персонаж на главном экране рисует надетую одежду по window.shmot.items
                    // отдельным проходом (home.js.updateClothes()) — без явного вызова спрайты
                    // старой экипировки остались бы висеть на модели до следующего захода в
                    // магазин шмоток (единственное другое место, которое его вызывает).
                    if(window.home && typeof home.updateClothes === 'function') home.updateClothes();
                    console.log('[devPanel._resetAccount] shmot — вся одежда снята и убрана из инвентаря в памяти');
                }
                if(window.weapons){
                    // 22.09.2026 (баг найден по прямому указанию — "сбросил БД, количество
                    // патронов не сбросилось") — ТОЧНО тот же класс бага, что уже закрыт выше
                    // для bosses/zone/shmot: weapons._loadFromUdata() при udata['weapons']==='[]'
                    // (пустой, но теперь валидный JSON-массив — см. фикс weapons:'' → weapons:'[]'
                    // чуть выше) проходит `saved.forEach(...)` НОЛЬ раз — старые owned/equipped/
                    // upg/qty в памяти (window.weapons.data) остаются нетронутыми, а
                    // "legacy"-фолбэк на ammo_auto/gun/machete ТОЛЬКО ПОДНИМАЕТ qty, если оно
                    // больше текущего — никогда не опускает. Без явного сброса здесь патроны/
                    // апгрейды визуально "не сбрасывались" даже после исправления сохранения на
                    // сервере. Возвращаем те же дефолты, что и в конструкторе Weapons — нож/цепь/
                    // бита бесплатные (нож экипирован), мачете/ствол/автомат не куплены, апгрейды
                    // и боезапас обнулены.
                    weapons.data.forEach((w, i) => {
                        w.owned    = i <= 2;
                        w.equipped = i === 0;
                        w.upg      = 0;
                        w.qty      = 0;
                    });
                    if(weapons._win && typeof weapons._renderStatus === 'function') weapons._renderStatus();
                    console.log('[devPanel._resetAccount] weapons — оружие/патроны/апгрейды принудительно сброшены в памяти');
                }
            }, (e)=>{
                console.error('[devPanel._resetAccount] ошибка сохранения на сервере:', e);
                if(window.notify) notify.showResult({text:'Ошибка сброса — см. консоль'}, 0);
            });
        });
    };

    // 23.09.2026 (по прямому указанию): полный сброс ВСЕХ игроков разом — то же самое, что
    // _resetAccount() выше, но применённое сервером ко всем существующим id в таблице users
    // за один запрос (users.php.resetAllPlayers() — там же лежит и бэкап таблиц перед сбросом,
    // и защита от несуществующих колонок). Пароль обязателен и проверяется ТОЛЬКО на сервере —
    // сама кнопка видна любому игроку (DEV-кнопка в HUD ничем не ограничена), так что prompt()
    // здесь — просто способ собрать пароль у того, кто нажал, а не механизм защиты сам по себе.
    proto._resetAllPlayers = function(){
        this._showConfirmPopup('Сбросить ВСЕХ игроков (не только себя)? Нужен пароль администратора.', ()=>{
            const pass = window.prompt('Пароль администратора:');
            if(!pass) return;
            if(!window.TS) return;
            TS.php('users.resetAllPlayers', {password: pass}, (r)=>{
                console.log('[devPanel._resetAllPlayers] сервер подтвердил сброс всех игроков:', JSON.stringify(r));
                if(window.notify) notify.showResult({text:'Сброшено игроков: ' + (r && r.players_reset != null ? r.players_reset : '?')}, 1);
            }, (err)=>{
                console.error('[devPanel._resetAllPlayers] ошибка:', JSON.stringify(err));
                if(window.notify) notify.showResult({text: (err && err.code === 403) ? 'Неверный пароль' : 'Ошибка сброса — см. консоль'}, 0);
            });
        });
    };

    // Выставляет 100 уровень сразу во всех 4 дворовых играх (покер/карты/зарики/рулетка).
    // Покер использует переменную шкалу опыта по брекетам (_pokerExpPerStep) — большого
    // запаса exp с головой хватает на все 100 уровней; остальные 3 игры — простая шкала
    // "10 очков на уровень, максимум 100" (_simpleLevelInfo), поэтому exp=1000 достаточно.
    proto._maxDvorLevels = function(){
        if(!window.dvor) return;
        if(!dvor._data) dvor._loadData();
        dvor._data.poker.exp    = 100000;
        dvor._data.cards.exp    = 1000;
        dvor._data.dice.exp     = 1000;
        dvor._data.roulette.exp = 1000;
        dvor._saveData();
        if(typeof dvor._updatePokerUI === 'function')     dvor._updatePokerUI();
        if(typeof dvor._updateBlackjackUI === 'function') dvor._updateBlackjackUI();
        if(typeof dvor._updateDiceScreenUI === 'function') dvor._updateDiceScreenUI();
        if(typeof dvor._updateRouletteUI === 'function')  dvor._updateRouletteUI();
        saveDevChanges();
        console.log('[devPanel._maxDvorLevels] покер/карты/зарики/рулетка -> уровень 100');
    };

    // 19.09.2026 (репорт: "МИЛЛИОН ВСЕГО" в консоли — "GIVE_MILLION is not a function").
    // window.GIVE_MILLION живёт в debug-tools.js, но определяется ТОЛЬКО когда
    // window.debug_mode===true — это намеренный барьер (Аудит безопасности 17.09.2026,
    // index.js): раньше debug_mode был true всегда, и ЛЮБОЙ игрок мог набрать GIVE_MILLION()
    // прямо в консоли браузера. По прямому указанию кнопке в dev-панели временно нужен
    // рабочий доступ — но включать debug_mode глобально означало бы заново открыть ИМЕННО ТУ
    // консольную дыру для всех игроков, не только для этой кнопки. Вместо этого — та же логика
    // (список полей 1:1 с debug-tools.js.GIVE_MILLION) продублирована здесь как метод
    // дев-панели: работает из кнопки, но window.GIVE_MILLION по-прежнему НЕ определён в
    // консоли обычного игрока.
    proto._giveMillion = function(){
        const M = '1000000';
        // 29.09.2026: coins/stew/cigarettes больше не client-writable (см. коммент у $allowed
        // в users.php) — АБСОЛЮТНОЕ значение "1000000" здесь выставить обычным users.save()
        // нельзя, только дельтой через users.devGrantCurrency(). Считаем дельту от того, что
        // сейчас в udata (актуально сразу после users.get()/patch — для дев-инструмента этого
        // достаточно), и шлём эти три поля ОДНИМ запросом (см. коммент у devGrantCurrency() в
        // users.php — параллельные отдельные запросы на одну и ту же строку затирали бы друг друга).
        const currencyDeltas = {};
        ['coins','stew','cigarettes'].forEach(key => {
            const delta = 1000000 - parseInt(udata[key]||0);
            if(delta !== 0) currencyDeltas[key] = delta;
        });
        udata['exp']               = M;
        udata['respect']           = M;
        udata['dice_points']       = M;
        udata['blue_points']       = M;
        udata['poker_chips']       = M;
        udata['poker_spichki']     = M;
        udata['roulette_spichki']  = M;
        udata['stash_count']       = M; // habar_counts НЕ трогаем — это JSON-массив Хабара, не счётчик заначек
        udata['ammo_auto']         = M;
        udata['ammo_gun']          = M;
        udata['ammo_machete']      = M;
        udata['skill_points']      = '300';
        udata['energy']            = M;
        udata['max_energy']        = M;
        if(window.TIMERS){
            TIMERS.ENERGY_MAX       = 1000000;
            TIMERS.current_energy   = 1000000;
            TIMERS.energy_base      = 1000000;
            TIMERS.energy_base_time = Date.now();
        }
        if(window.weapons){
            [3,4,5].forEach(i => { weapons.data[i].qty = 1000000; weapons.data[i].owned = true; });
            weapons._saveToUdata();
        }
        if(window.bosses){ bosses.keys = new Array(8).fill(1000000); bosses._saveToUdata(); }
        if(window.iface) iface.updateUp();
        // 19.09.2026 (репорт "оружие/патроны не сохраняются"): ammo_auto/ammo_gun/ammo_machete
        // и weapons — единственные поля из списка выше, которые обычный users.save() ниже молча
        // отклоняет при РОСТЕ значения (см. $monotonicFields/$jsonBlobGuards в users.php),
        // поэтому для них нужен отдельный неограниченный devGrantWeapons() (см.
        // _pushWeaponsGrant()).
        //
        // 23.09.2026 (баг "оружие куплено с 1М патронов, но атака отвечает 'не куплено'", по
        // прямому указанию): раньше оба запроса — users.save() (гвардит рост weapons/ammo_*) и
        // _pushWeaponsGrant() (пишет их же в обход гварда) — улетали ПАРАЛЛЕЛЬНО, без всякой
        // гарантии порядка ответа. Если users.save() успевал прочитать текущее значение из БД
        // ДО того, как devGrantWeapons() закоммитил новое, guard видел ещё старое owned:false,
        // отклонял "эскалацию" и следующей же своей записью тихо стирал только что выданное
        // оружие — сервер потом честно отвечал "не куплено" на bosses.attack, хотя клиент
        // (оптимистично обновивший weapons.data в памяти) продолжал показывать 1М патронов.
        // Фикс: сначала девогрант (единственный, кто реально имеет право поднять owned/qty),
        // и только ПОСЛЕ его ответа — общий users.save() для остальных полей (coins/energy/…),
        // чтобы guard внутри save() гарантированно видел уже закоммиченное свежее значение —
        // см. большой комментарий у _pushWeaponsGrant() ниже. Передаём callback вместо
        // параллельного вызова: users.save() уходит ТОЛЬКО после ответа devGrantWeapons().
        // Валюта (devGrantCurrency) грантится ПЕРВЫМ шагом той же цепочки — свой независимый
        // read+write строки, ничего не гвардит по эскалации, порядок относительно
        // weapons/users.save для неё не критичен, но пусть тоже идёт последовательно, а не
        // параллельно остальным двум запросам той же строки.
        const afterCurrency = () => {
            this._pushWeaponsGrant(() => {
                TS.php('users.save', {udata_json: JSON.stringify(udata)}, (res) => {
                    console.log('[devPanel._giveMillion] сохранено:', res);
                    if(window.notify) notify.showResult({text:'+1 000 000 всего!'}, 1);
                }, null);
            });
        };
        if(Object.keys(currencyDeltas).length){
            _grantCurrencyServer(currencyDeltas, afterCurrency);
        } else {
            afterCurrency();
        }
    };

    // Общий пуш weapons/ammo_auto/ammo_gun/ammo_machete в обход users.save()-санитайзеров —
    // см. подробный комментарий у users.php.devGrantWeapons(). Используется и точечными
    // кнопками секции ОРУЖИЕ (+патроны/КУПИТЬ), и МИЛЛИОН ВСЕГО.
    //
    // 23.09.2026 (баг "оружие куплено с 1М патронов, но атака отвечает 'не куплено'", по
    // прямому указанию): вызывающий код (saveDevChanges()/прямой users.save() в _giveMillion())
    // и этот метод раньше улетали ПАРАЛЛЕЛЬНО, без всякой гарантии порядка ответа — оба пишут в
    // ту же колонку `weapons`. users.save() внутри читает ТЕКУЩЕЕ значение weapons из БД и не
    // пропускает рост owned/qty без прохода через weapons.buy() (см. $jsonBlobGuards в
    // users.php) — если его SELECT успевал выполниться РАНЬШЕ, чем здесь закоммитится
    // devGrantWeapons(), guard видел ещё старое owned:false, отклонял "эскалацию" и следом сам
    // же перезаписывал колонку этим старым значением — молча стирая только что выданное оружие
    // (сервер потом честно отвечал "не куплено" на bosses.attack, хотя клиент, оптимистично
    // обновивший weapons.data в памяти, продолжал показывать 1М патронов). Фикс: devGrantWeapons
    // теперь ВСЕГДА идёт первым и единственным писателем в этот момент — отменяем отложенный
    // saveDevChanges() на время запроса, а любой follow-up (общий saveDevChanges() для прочих
    // полей, либо явный callback вызывающего кода вроде _giveMillion()) срабатывает только
    // ПОСЛЕ ответа сервера, когда свежее значение уже гарантированно закоммичено.
    proto._pushWeaponsGrant = function(afterCb){
        if(!window.weapons || !window.TS) return;
        clearTimeout(saveTimer);
        TS.php('users.devGrantWeapons', {
            weapons_json: JSON.stringify(weapons.data.map(w=>({owned:w.owned,equipped:w.equipped,upg:w.upg,qty:w.qty||0}))),
            ammo_auto:    weapons.data[5] ? (weapons.data[5].qty||0) : 0,
            ammo_gun:     weapons.data[4] ? (weapons.data[4].qty||0) : 0,
            ammo_machete: weapons.data[3] ? (weapons.data[3].qty||0) : 0,
        }, (res) => { console.log('[devPanel._pushWeaponsGrant] сохранено:', res); afterCb ? afterCb(res) : saveDevChanges(); },
           (err) => { console.error('[devPanel._pushWeaponsGrant] ошибка:', err); afterCb ? afterCb(null) : saveDevChanges(); });
    };

    // 19.09.2026 (по прямому указанию): помечает owned=true у ВСЕХ предметов гардероба
    // (включая дроп-предметы id41+, у которых price:null — иначе их вообще не проверить
    // визуально без реализованного механизма выдачи) и обновляет уже открытый магазин, если
    // он на экране в этот момент.
    //
    // 25.09.2026 (по прямому указанию — перенос shmot.equip() на сервер, см. большой комментарий
    // в users.php у $allowed): 'shmot' убран из client-writable whitelist — обычный
    // shmot._saveToUdata() (generic users.save) молча перестал бы сохранять этот дамп. Тот же
    // приём, что уже применён к оружию (_pushWeaponsGrant/users.devGrantWeapons) — dev-only
    // прямой SQL update через users.devGrantShmot, в обход whitelist.
    proto._unlockAllShmot = function(){
        if(!window.shmot || !Array.isArray(shmot.items) || !window.TS) return;
        shmot.items.forEach(it => { it.owned = true; });
        // Индекс массива ДОЛЖЕН быть it.id, не порядковой позицией в this.items — та же дыра,
        // что уже чинили 18.09.2026 в shmot.js._saveToUdata() (id 20+ физически лежат не по
        // порядку). Дублируем тот же формат построения массива здесь.
        const save = [];
        shmot.items.forEach(it => { save[it.id] = {owned: it.owned, equipped: it.equipped}; });
        const shmotJson = JSON.stringify(save);
        udata['shmot'] = shmotJson; // держим локальный udata в курсе — на случай чтения до следующей полной перезагрузки
        TS.php('users.devGrantShmot', {shmot_json: shmotJson}, (res) => {
            console.log('[devPanel._unlockAllShmot] сохранено на сервере:', res);
            if(res && res.patch) applyPatch(res.patch);
            if(typeof shmot._shopRefresh === 'function' && shmot._shopWin) shmot._shopRefresh(true);
        }, (err) => {
            console.error('[devPanel._unlockAllShmot] ошибка сохранения на сервере:', err);
        });
        console.log('[devPanel._unlockAllShmot] выдано предметов:', shmot.items.length);
    };

    // Личный редкий предмет рулетки, выдаётся только текущему dev-аккаунту и проходит
    // тот же серверный путь, что настоящий выигрыш — так проверяется и его отображение.
    proto._toggleDevKeyring = function(){
        if(!window.TS) return;
        TS.php('users.toggleDevKeyring', {}, (res) => {
            if(!res || !res.ok){
                if(window.notify) notify.showResult({text:'Не удалось изменить связку ключей'}, 0);
                return;
            }
            if(res.patch) applyPatch(res.patch);
            if(window.shmot && typeof shmot._loadFromUdata === 'function') shmot._loadFromUdata();
            if(window.home && typeof home.updateClothes === 'function') home.updateClothes();
            if(window.notify) notify.showResult({text:res.enabled ? 'Связка ключей выдана' : 'Связка ключей снята'}, 1);
        }, () => { if(window.notify) notify.showResult({text:'Не удалось изменить связку ключей'}, 0); });
    };

    // 22.09.2026 (по прямому указанию — "добавь в dev кнопку которая делает 100% шанс дропа
    // шмоток отовсюду") — переключает личный server-only флаг dev_force_drops через отдельный
    // permit users.setDevFlag (тот же обходной паттерн, что users.devGrantWeapons — пишет
    // ровно одно поле напрямую, в обход whitelist-санитайзеров users.save). Флаг читают
    // bosses.php.claimKill() и yashik.php.openBox() перед каждым броском шанса дропа —
    // форсирует гарантированную выдачу ТОЛЬКО для аккаунта, включившего флаг.
    proto._setDevForceDrops = function(on){
        if(!window.TS) return;
        TS.php('users.setDevFlag', {flag: 'dev_force_drops', value: on ? 1 : 0}, (res) => {
            if(window.udata) udata['dev_force_drops'] = String(on ? 1 : 0);
            console.log('[devPanel._setDevForceDrops] dev_force_drops =', on ? 1 : 0, res);
        }, (err) => console.error('[devPanel._setDevForceDrops] ошибка:', err));
    };

    // 25.09.2026 (по прямому указанию — "вместо демки стаканчиков сделай 100% шанс джекпота
    // для теста"): тот же паттерн, что и _setDevForceDrops — одноразовый server-only флаг,
    // roulette.php.spin() сам гасит его сразу после использования (см. коммент там).
    proto._forceNextJackpot = function(){
        if(!window.TS) return;
        TS.php('users.setDevFlag', {flag: 'dev_force_jackpot', value: 1}, (res) => {
            console.log('[devPanel._forceNextJackpot] dev_force_jackpot = 1', res);
            if(window.notify) notify.showResult({text: 'Следующий спин рулетки — джекпот'}, 1);
        }, (err) => {
            console.error('[devPanel._forceNextJackpot] ошибка:', err);
            if(window.notify) notify.showResult({text: 'Ошибка — см. консоль'}, 0);
        });
    };

    // Показывает компас загрузки (#_clo, тот же оверлей, что и при реальной загрузке)
    // бесконечно (без авто-скрытия) — для проверки вёрстки/анимации без реальной загрузки
    // текстур. Кнопка «СТОП» — обычный DOM-элемент поверх #_clo (z-index выше), закрывает
    // и убирает саму себя.
    proto._testCompass = function(){
        this._compassShow();
        // #_clo обычно перехватывает ВСЕ клики (pointer-events:all) — оправдано при реальной
        // загрузке, но здесь мешает кнопке редактора позиций (✥, всегда в углу канваса,
        // PIXI.Ticker) быть кликабельной поверх теста. Пропускаем клики насквозь к канвасу —
        // сам компас остаётся видимым (это чисто визуальный оверлей).
        const _cloEl = document.getElementById('_clo');
        if(_cloEl) _cloEl.style.pointerEvents = 'none';
        console.log('[devPanel._testCompass] компас показан в бесконечном режиме (для теста вёрстки), клики пропускаются к канвасу');
        if(this._testCompassStopBtn) return; // кнопка «СТОП» уже на экране
        const btn = document.createElement('button');
        btn.textContent = 'СТОП';
        btn.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);' +
            'z-index:10000;padding:12px 32px;font-size:16px;font-weight:bold;' +
            'background:#7a2020;color:#fff;border:2px solid #fff;border-radius:6px;cursor:pointer;';
        btn.onclick = () => {
            this._compassHide();
            if(_cloEl) _cloEl.style.pointerEvents = '';
            if(btn.parentNode) btn.parentNode.removeChild(btn);
            this._testCompassStopBtn = null;
            console.log('[devPanel._testCompass] компас скрыт по кнопке СТОП');
        };
        document.body.appendChild(btn);
        this._testCompassStopBtn = btn;
    };

    // 25.09.2026 (по прямому указанию — "поп-ап с текстами ошибок, можно листать"): карточка
    // код+текст текущей записи DEV_ERROR_CATALOG, кнопки ◀/▶ листают список по кругу. Живёт
    // ВНУТРИ this._devWin (а не отдельным addChild в layer2_mc) — иначе тикер devWin
    // (_devWinTickerFn выше, переподнимает devWin КАЖДЫЙ кадр) перекрыл бы popup уже на
    // следующем кадре.
    proto._openErrorBrowser = function(){
        if(this._errBrowserWin){ this._errBrowserWin.visible = true; return; }
        if(!this._devWin) return;

        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.7);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const CARD_W = 520, CARD_H = 220;
        const CARD_X = (1280 - CARD_W) / 2, CARD_Y = (720 - CARD_H) / 2;
        const card = new PIXI.Graphics();
        card.beginFill(0x14201c, 0.97);
        card.lineStyle(2, 0x3ad4a4, 0.6);
        card.drawRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 8);
        card.endFill();
        win.addChild(card);

        const titleTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:16, fill:'#3af0c0', fontWeight:'bold',
        });
        titleTxt.anchor.set(0.5, 0);
        titleTxt.x = CARD_X + CARD_W / 2; titleTxt.y = CARD_Y + 16;
        win.addChild(titleTxt);

        const codeTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:14, fill:'#bbbbbb',
        });
        codeTxt.anchor.set(0.5, 0);
        codeTxt.x = CARD_X + CARD_W / 2; codeTxt.y = CARD_Y + 42;
        win.addChild(codeTxt);

        const bodyTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:15, fill:'#ffffff', align:'center',
            wordWrap:true, wordWrapWidth: CARD_W - 60,
        });
        bodyTxt.anchor.set(0.5, 0);
        bodyTxt.x = CARD_X + CARD_W / 2; bodyTxt.y = CARD_Y + 76;
        win.addChild(bodyTxt);

        let idx = 0;
        const _render = () => {
            const total = DEV_ERROR_CATALOG.length;
            const e = DEV_ERROR_CATALOG[idx];
            titleTxt.text = 'ТЕКСТЫ ОШИБОК  (' + (idx + 1) + ' / ' + total + ')';
            codeTxt.text = 'Код: ' + e.code;
            bodyTxt.text = e.text;
            // 26.09.2026 (по прямому указанию — "кнопка Показать должна показывать попап
            // ошибки из игры, а не только текст"): раньше карточка сама рисовала код+текст
            // своим собственным стилем — дев не видел, как ошибка ВЫГЛЯДИТ у реального
            // игрока. Теперь при каждом ◀/▶ и открытии сразу поверх поднимается настоящий
            // игровой попап ошибки (iface._openSidorovichError — тот же компонент, что видит
            // живой игрок), с реальным текстом текущей записи каталога. Маленькая карточка
            // остаётся рядом — в ней код и листалка, которых в самом попапе ошибки нет.
            if(window.iface && typeof iface._openSidorovichError === 'function'){
                iface._openSidorovichError('Ошибка ' + e.code, e.text);
                // Этот попап кладётся в root.layer2_mc, а devWin каждый
                // кадр сам себя поднимает на верх layer2_mc (_devWinTickerFn выше) — обычный
                // попап оказался бы под панелью уже на следующем кадре. Перевешиваем именно
                // ЭТОТ попап внутрь devWin — тогда он поднимается вместе с панелью, а не под ней.
                if(iface._sidErrorWin) this._devWin.addChild(iface._sidErrorWin);
            }
        };

        const _navBtn = (label, x, onClick) => {
            const g = new PIXI.Graphics();
            g.beginFill(0x1a3a2a, 1);
            g.lineStyle(1, 0x3ad4a4, 0.6);
            g.drawRoundedRect(0, 0, 40, 32, 4);
            g.endFill();
            g.x = x; g.y = CARD_Y + CARD_H - 48;
            g.interactive = true; g.buttonMode = true;
            g.on('pointerover', ()=>{ g.alpha = 0.7; });
            g.on('pointerout',  ()=>{ g.alpha = 1; });
            g.on('pointerdown', onClick);
            const t = new PIXI.Text(label, {fontFamily:'Southbank LT', fontSize:16, fill:'#ffffff'});
            t.anchor.set(0.5, 0.5); t.x = 20; t.y = 16;
            g.addChild(t);
            win.addChild(g);
            return g;
        };
        // По кругу — с последней записи ▶ ведёт на первую, с первой ◀ ведёт на последнюю
        // (листать без тупиков, раз список маленький).
        _navBtn('◀', CARD_X + 24, ()=>{ idx = (idx - 1 + DEV_ERROR_CATALOG.length) % DEV_ERROR_CATALOG.length; _render(); });
        _navBtn('▶', CARD_X + CARD_W - 64, ()=>{ idx = (idx + 1) % DEV_ERROR_CATALOG.length; _render(); });

        const closeBtn = new PIXI.Text('✕', {fontFamily:'Southbank LT', fontSize:20, fill:'#ff8888'});
        closeBtn.anchor.set(0.5, 0.5);
        closeBtn.x = CARD_X + CARD_W - 20; closeBtn.y = CARD_Y + 18;
        closeBtn.interactive = true; closeBtn.buttonMode = true;
        closeBtn.on('pointerover', ()=>{ closeBtn.alpha = 0.7; });
        closeBtn.on('pointerout',  ()=>{ closeBtn.alpha = 1; });
        closeBtn.on('pointerdown', ()=>{ win.visible = false; });
        win.addChild(closeBtn);

        _render();
        this._devWin.addChild(win);
        this._errBrowserWin = win;
        console.log('[devPanel._openErrorBrowser] открыт, записей в каталоге:', DEV_ERROR_CATALOG.length);
    };

    // Глобальные консольные чит-функции (доступны через devtools → Console)
    window.GIVE_CIGS = function(n){
        if(!window.udata) return console.warn('[cheat] udata не загружен');
        n = parseInt(n) || 1000;
        // 29.09.2026: cigarettes больше не client-writable — через users.devGrantCurrency().
        _grantCurrencyServer({cigarettes: n}, () => {
            console.log('[cheat] GIVE_CIGS('+n+') → cigarettes=' + udata['cigarettes']);
        });
    };
    window.GIVE_STEW = function(n){
        if(!window.udata) return console.warn('[cheat] udata не загружен');
        n = parseInt(n) || 10;
        // 29.09.2026: stew больше не client-writable — через users.devGrantCurrency().
        _grantCurrencyServer({stew: n}, () => {
            console.log('[cheat] GIVE_STEW('+n+') → stew=' + udata['stew']);
        });
    };
}

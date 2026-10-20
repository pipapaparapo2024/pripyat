/** Кнопки панелей, открытие/закрытие модулей. */
export function attachInterfacePanels(proto){

    proto.initButtons = function(){
        // 18.10.2026 (по прямому указанию — "пройдись по всему проекту где есть покупка, FLA →
        // обычные изображения"): старый хитбокс butt_bank вёл на FLA-окно банка (bank.init()) —
        // тот же баг-класс, что уже чинили для CURRENCY_INFO (interface-panels.js, 18.10.2026,
        // см. bank-currency-hud-restore.test.js): _buildTopCurrencyWidget() (вызывается ПОЗЖЕ,
        // см. interface.js init()) прячет этот объект (interactive=false), но _addHoverGlow()
        // здесь всё равно принудительно включал interactive=true через setButton() — рабочим
        // путём кнопка не была (порядок вызовов спасал), но оставалась миной на будущее. Кнопка
        // "магазин" в новом верхнем HUD (interface-top-currency.js) уже полностью её заменяет.
        //
        // 20.10.2026 (баг найден по прямому указанию — "в верхнем худе всё ещё есть hover
        // увеличение"): ровно ТОТ ЖЕ баг-класс был описан выше для butt_bank, но блок для
        // butt_settings (тот же старый невидимый 35×35 FLA-хитбокс) тогда забыли убрать —
        // _addHoverGlow(this.up.butt_settings) вызывался здесь и возвращал interactive=true
        // через setButton() уже ПОСЛЕ того, как _buildTopCurrencyWidget() выставил
        // interactive=false, оставляя висеть "ожившую" невидимую кнопку с hover-увеличением
        // поверх области нового settingsBtn. Кнопка "настройки" в новом виджете
        // (interface-top-currency.js) уже полностью её заменяет (свой pointerdown →
        // _openSoundPopup()) — блок убран целиком, как и butt_bank выше.

        if(this.up.butt_energy_plus){
            this.up.butt_energy_plus.visible = false;
            this.up.butt_energy_plus.interactive = false;
        }
        // 18.10.2026 (по прямому указанию — "butt_energy_buy.png вообще убери, покупку энергии
        // открывать по нажатию на количество энергии"): кнопка-плюс больше не создаётся — см.
        // energy_txt.on('pointerdown', ...) в interface.js (initNickLabel()).

        // 18.10.2026 (баг найден по прямому указанию — "в магазине всё ещё сигареты, старые
        // ассеты на месте", подтверждено снимком редактора позиций: клик вёл на объект из
        // interface_elements_atlas_1.png, 879×491 — это bank_bg, СТАРОЕ окно банка, не новый
        // попап покупки сухарей): здесь раньше висел легаси-обработчик клика ПРЯМО на старых
        // FLA-объектах val_stew/val_coins/val_cigarettes — `interface-top-currency.js`
        // (_buildTopCurrencyWidget(), вызывается раньше в upInit()) уже прячет эти объекты
        // (visible=false, interactive=false) и полностью заменяет их новым виджетом с
        // собственными кнопками/попапами. Но этот код ниже (initButtons() выполняется ПОСЛЕ
        // upInit()) заново звал setButton(this.up[key]) → interactive=true, buttonMode=true —
        // и вешал pointerdown, который для val_cigarettes напрямую звал bank.init('cigarettes')
        // (СТАРОЕ окно банка на вкладке сигарет, с label 'Сигареты' — даже текст не был
        // обновлён на "Сухари"). Невидимый, но интерактивный объект в этой версии PIXI всё
        // равно ловил клики — именно он перехватывал попытки открыть новый попап сухарей.
        // Весь блок удалён целиком — новый виджет верхнего HUD полностью замещает эту
        // функциональность (клик по иконке/кнопке "+" каждой из трёх валют).



        const downBtns = { butt_weapons:'weapons', butt_shmot:'shmot' };
        for(const [key, mod] of Object.entries(downBtns)){
            if(this.down[key]){
                this._addHoverGlow(this.down[key]);
                this.down[key].on('pointerdown', ()=>this.openModule(mod));
            }
        }
        if(this.down.butt_gangs){
            this.down.butt_gangs.interactive = false;
            this.down.butt_gangs.buttonMode = false;
            this.down.butt_gangs.alpha = 0.45;
            // 18.10.2026 (баг найден по снимку редактора позиций — "скоро банда.png"
            // задвоился): плашка "СКОРО" (изначально добавлена здесь 21.09.2026) теперь
            // строится в interface-bottom-nav.js (_bottomNavSoonBadge, поверх новой кнопки
            // "Банда" нового нижнего HUD, батч 17.10.2026) — старая копия, которая раньше
            // сидела прямо на this.down по координатам X:465 Y:24 (локальные, см. историю
            // правок в git), больше не нужна и убрана, чтобы на экране не было двух значков.
        }
        if(this.down.butt_bosses){
            this._addHoverGlow(this.down.butt_bosses);
            this.down.butt_bosses.on('pointerdown', ()=>{
                if(this._bossWin && this._bossWin.visible){ this._closeAllPanels(); }
                else {
                    // Нижняя кнопка может быть нажата раньше, чем состояние Bosses успело
                    // восстановиться из udata после загрузки VK iframe. Без этой строки
                    // _openBossesPopup() видел нулевой bossStartMs и показывал выбор боссов.
                    if(window.bosses && typeof bosses._loadFromUdata === 'function') bosses._loadFromUdata();
                    this._compassShow();
                    this._closeAllPanels();
                    this._openBossesPopup(); // сама перенаправит в найденный активный бой
                }
            });
        }
        if(this.down.butt_zone){
            this._addHoverGlow(this.down.butt_zone);
            this.down.butt_zone.on('pointerdown', ()=>this._openZoneScreen());
        }
        if(this.down.butt_vassilich){
            this._addHoverGlow(this.down.butt_vassilich);
            this.down.butt_vassilich.on('pointerdown', ()=>{
                if(this._sidWin && this._sidWin.visible){ this._closeAllPanels(); }
                else { this._closeAllPanels(); this._openSidorovichPopup(); }
            });
        }

    };

    proto._openLeaderboard = function(){
        if(this._openModuleName === 'leaderboard'){ this._closeAllPanels(); return; }
        this._compassShow();
        this._closeAllPanels();
        this._openModuleName = 'leaderboard';
        const run = () => {
            if(window.leaderboard){
                if(typeof window.leaderboard.open === 'function') window.leaderboard.open();
                else if(typeof window.leaderboard.init === 'function') window.leaderboard.init();
            }
            this.showCloseBtn();
            requestAnimationFrame(() => this._compassHide());
        };
        if(window.leaderboard){ run(); return; }
        modules.checkFlags(['top'], run);
    };

    proto.openModule = function(name){
        console.log('[interface.openModule] name:', name, '| _openModuleName:', this._openModuleName, '| window[name]:', !!window[name], '| habar open:', window.habar && window.habar._pixiWin && window.habar._pixiWin.parent ? 'YES' : 'no');
        if(this._openModuleName === name){
            // Проверяем что модуль РЕАЛЬНО открыт (мог закрыться через собственную X-кнопку)
            const m = window[name];
            const reallyOpen = m && (
                (m._pixiWin   && m._pixiWin.parent)   ||
                (m._win       && m._win.parent)        ||
                (m._shopWin   && m._shopWin.visible)   ||
                (m._lobbyWin  && m._lobbyWin.parent)   ||
                (m._dvorWrap  && m._dvorWrap.parent)   ||
                (m.win        && m.win.parent)
            );
            console.log('[interface.openModule] same name | reallyOpen:', reallyOpen);
            if(reallyOpen){
                console.log('[interface.openModule] TOGGLE CLOSE for', name);
                this._closeAllPanels();
                return;
            }
            // Модуль уже закрылся сам — сбрасываем флаг и открываем заново
            this._openModuleName = null;
        }
        this._compassShow();
        this._closeAllPanels();
        this._openModuleName = name;

        const run = () => {
            if(window[name]){
                if(typeof window[name].open === 'function') window[name].open();
                else if(typeof window[name].init === 'function') window[name].init();
            }
            this.showCloseBtn();
            requestAnimationFrame(() => this._compassHide());
        };

        if(window[name]){ run(); return; }
        modules.checkFlags([name], run);
    };

    proto._closeAllPanels = function(){
        console.log('[interface._closeAllPanels] called | _openModuleName:', this._openModuleName, '| habar open:', window.habar && window.habar._pixiWin && window.habar._pixiWin.parent ? 'YES' : 'no');
        // 17.10.2026 (баг найден по прямому указанию + скриншот — "зашёл к игроку в гости,
        // нажал на вкладку Зоны — открылась визитка гостя вместо Зоны"): визитка чужого игрока
        // (player_profile.js) — отдельный полноэкранный оверлей, который никогда не участвовал
        // в этом общем закрытии вкладок (в отличие от Зоны/Сидоровича/Ящика/Хабара/Шмоток/Сводки
        // выше) — её закрывал ТОЛЬКО собственный крестик (_closePlayerProfile, см. exitBtn в
        // player_profile.js). Полноэкранный blocker визитки (alpha 0.001, но interactive=true)
        // продолжал перехватывать клики поверх реально открывшегося под ним экрана Зоны — тур
        // никак не падал с ошибкой, экран просто визуально оставался тем же самым. Закрываем
        // здесь же, как и остальные оверлеи выше — единая точка входа при переключении вкладки.
        if(this._profileWin && this._profileWin.parent) this._closePlayerProfile();
        if(this._zoneWin && this._zoneWin.visible){
            clearInterval(this._zoneTimerInterval);
            this._zoneTimerInterval = null;
            this._zoneWin.visible = false;
            this.popHud('zone');
            this._stopZoneAmbient();
        }
        // 25.09.2026 (баг "оба ХУДа пропадают после Сидорович→Ящик→Сидорович→крестик", см.
        // подробный коммент в sidorovich.js): Сидорович теперь участвует в ХУД-стеке —
        // закрытие отсюда (переключение на другую вкладку) обязано снимать его требование
        // из стека, иначе оно остаётся там навсегда (никогда не popHud'нутое), путая
        // restoreHud() при следующих открытиях/закрытиях других экранов.
        if(this._sidWin && this._sidWin.visible){ this._sidWin.visible = false; this.popHud('sidorovich'); }
        // Та же причина: Ящик (yashik.js) сам себя не закрывал при переключении на другую
        // вкладку нижней панели (например повторный клик на Сидоровича, пока Ящик ещё открыт
        // поверх него) — экран оставался открытым и видимым, его pushHud('yashik') оставался
        // в стеке навсегда орфанded-записью.
        if(this._yashikWin && this._yashikWin.visible){ this._yashikWin.visible = false; this.popHud('yashik'); }
        if(this._bossWin && this._bossWin.visible){
            this._bossWin.visible = false;
            this.popHud('bossSelect');
        }
        if(window.bosses && bosses.win && bosses.win.visible) bosses.win.visible = false;
        if(window.dvor && typeof dvor.close === 'function' && (dvor._lobbyWin || dvor._dvorWrap)) dvor.close();
        if(window.weapons && typeof weapons.close === 'function' && weapons._win) weapons.close();
        if(window.hata && typeof hata.close === 'function' && hata._win) hata.close();
        // 30.09.2026 (баг найден по живому тесту обучения — "открываю Хабар, а поверх него
        // мгновенно всплывает рука/пульс следующего шага тура"): было БЕЗ условия на открытость
        // (в отличие от dvor/weapons/hata выше) — habar.close() всегда сам вызывает
        // iface.popHud('habar') (habar.js), даже если Хабар ни разу не открывался. Поскольку
        // _closeAllPanels() вызывается ПЕРВОЙ строкой в openModule() — в т.ч. при открытии
        // САМОГО Хабара — клик по вкладке "Хабар" сам же гасил её же ещё не открытый экран,
        // выстреливал popHud('habar') раньше времени и (для онбординга, см. onboarding-tour.js
        // ._hookScreenClose) продвигал тур на шаг раньше, чем игрок вообще увидел Хабар. Тот же
        // паттерн guard'а, что уже у dvor/weapons/hata на этих же строках.
        if(window.habar && typeof habar.close === 'function' && habar._pixiWin && habar._pixiWin.parent) habar.close();
        // 29.09.2026: тот же паттерн, что zone/bossSelect/sidorovich/yashik выше — магазин
        // шмоток теперь тоже в декларативном ХУД-стеке (pushHud('shmot', {}) в
        // shmot_shop.js._openShmotShop), закрытие отсюда обязано снимать его запись.
        // 30.09.2026 (баг по живому тесту обучения — "открываю Шмотки, а указатель тура сразу
        // перескакивает на Сидоровича"): было `shmot._shopWin.parent` — shmot_shop.js.exitBtn
        // никогда не убирает _shopWin из родителя (тот же паттерн, что zone/sidorovich/yashik/
        // bossSelect — просто visible=false), поэтому .parent остаётся правдивым НАВСЕГДА после
        // первого открытия за сессию. При повторном прохождении тура (или просто повторном
        // открытии Шмоток) эта ветка срабатывала мгновенно на САМ клик по вкладке — раньше, чем
        // shmot.open() успевал её реально открыть — и мгновенно гасила ещё не открывшийся экран,
        // стреляя popHud('shmot') раньше времени (тот же класс бага, что уже чинили для Хабара
        // выше). Проверка на `.visible` (как у zone/sidorovich/yashik/bossSelect) отражает
        // РЕАЛЬНОЕ текущее состояние экрана, а не факт "когда-то был построен".
        if(window.shmot && shmot._shopWin && shmot._shopWin.visible){ shmot._shopWin.visible = false; this.popHud('shmot'); }
        // Сводка (17.09.2026) — тот же паттерн, что habar: root.layer2_mc, не home.openScreen(),
        // поэтому её тоже нужно закрывать явно, иначе экран остаётся висеть при переключении
        // на другую вкладку (общий fallback ниже вызывает только home.closeScreen()).
        if(window.svod && typeof svod.close === 'function' && svod._pixiWin && svod._pixiWin.parent) svod.close();
        if(this._openModuleName){
            this._openModuleName = null;
            if(window.home) home.closeScreen();
            this.hideCloseBtn();
        }
    };

    proto._initCloseBtn = function(){
        const SIZE = 44;
        const X = 1280 - SIZE - 8;
        const Y = 58;

        const btn = new PIXI.Container();
        btn.interactive = true;
        btn.buttonMode  = true;
        btn.visible     = false;
        btn.x = X;
        btn.y = Y;

        const bg = new PIXI.Graphics();
        bg.beginFill(0x1a0e06, 0.85);
        bg.lineStyle(2, 0x8b5c2a, 1);
        bg.drawCircle(SIZE/2, SIZE/2, SIZE/2);
        bg.endFill();

        const cross = new PIXI.Graphics();
        cross.lineStyle(3, 0xe8c97a, 1);
        const p = 12;
        cross.moveTo(p, p); cross.lineTo(SIZE-p, SIZE-p);
        cross.moveTo(SIZE-p, p); cross.lineTo(p, SIZE-p);

        btn.addChild(bg, cross);
        btn.on('pointerover',  ()=>{ bg.tint = 0xFFAA44; cross.tint = 0xFFFFFF; });
        btn.on('pointerout',   ()=>{ bg.tint = 0xFFFFFF; cross.tint = 0xFFFFFF; });
        btn.on('pointerdown',  ()=>{ this._closeCurrentModule(); });

        root.layer2_mc.addChild(btn);
        window.globalCloseBtn = btn;
    };

    proto.showCloseBtn = function(){ if(window.globalCloseBtn) window.globalCloseBtn.visible = true; };
    proto.hideCloseBtn = function(){ if(window.globalCloseBtn) window.globalCloseBtn.visible = false; };

    proto._closeCurrentModule = function(){
        const modules = ['bosses','zone','weapons','shmot','gangs','vassilich',
                         'dvor','base','habar','leaderboard','svod','zadaniya',
                         'battlepass','hapuga','bot','bank'];
        for(const name of modules){
            const m = window[name];
            if(!m) continue;
            if(typeof m.close === 'function'){ try { m.close(); } catch(e){} break; }
            if(typeof m.hide  === 'function'){ m.hide();  break; }
            if(m.container && m.container.visible !== undefined){ m.container.visible = false; break; }
        }
        this._openModuleName = null;
        this.hideCloseBtn();
    };
    proto._buildPngSidePanels = function(){
        const IMG = './images/';
        const PANEL_X_RIGHT = 1042;
        const PANEL_Y_RIGHT = 140;

        // Левая панель (скряга/бот/пропуск) убрана целиком (21.09.2026, по прямому указанию) —
        // все три раздела ещё не готовы к бета-тесту, простое затемнение кнопок не убеждало
        // игроков, что раздела нет. Сами модули (hapuga.js/bot.js/battlepass.js) и их серверная
        // блокировка (BETA_LOCKED, см. CLAUDE.md) НЕ трогались — только вход в них с HUD.
        // iface._pngLeftPanel больше не существует — hata.js уже безопасно проверяет
        // `if(iface._pngLeftPanel)` в обе стороны (open/close), падать негде.

        // RIGHT panel: двор, База, Хабар, Сводка — «топы» убраны из игры насовсем
        // (16.09.2026, по прямому указанию), Сводка сделана кликабельной.
        // yOff считается от индекса в массиве.
        //
        // 22.09.2026 (по прямому указанию): кнопка "Ежедневные задания" убрана из панели
        // ЦЕЛИКОМ (была уже затемнена/недоступна — теперь просто не рисуется). Сам модуль
        // Zadaniya (game/zadaniya.js) НЕ тронут — window.zadaniya по-прежнему создаётся
        // (module_control.js.constructZadaniya) и загружается (game-boot.js), просто у него
        // больше нет точки входа с HUD. 'zadaniya' также намеренно оставлен в списке модулей
        // _closeCurrentModule() выше — на случай, если он снова станет открываемым откуда-то ещё.
        const rightCfg = [
            { file: 'двор',    mod: 'dvor'        },
            { file: 'База',    mod: 'base'        },
            { file: 'Хабар',   mod: 'habar'       },
            { file: 'Сводка',  mod: 'svod'        },
        ];
        const BTN_W_R = 236, BTN_H_R = 57, GAP_R = 4;
        const rightPanel = new PIXI.Container();
        rightPanel.x = PANEL_X_RIGHT; rightPanel.y = PANEL_Y_RIGHT;
        rightCfg.forEach((b, i) => {
            const yOff = i * (BTN_H_R + GAP_R);
            const norm = new PIXI.Sprite(PIXI.Texture.from(IMG + b.file + '.png'));
            const hov  = new PIXI.Sprite(PIXI.Texture.from(IMG + b.file + ' hover.png'));
            norm.y = hov.y = yOff;
            hov.visible = false;
            const hit = new PIXI.Graphics();
            hit.beginFill(0x000000, 0.001); hit.drawRect(0, yOff, BTN_W_R, BTN_H_R); hit.endFill();
            hit.interactive = !b.disabled; hit.buttonMode = !b.disabled;
            if(b.disabled) norm.alpha = 0.45;
            hit.on('pointerover',  ()=>{ norm.visible=false; hov.visible=true;  });
            hit.on('pointerout',   ()=>{ hov.visible=false;  norm.visible=true; });
            hit.on('pointerdown', ()=>{
                console.log('[PNG right tab] clicked:', b.mod, '| _openModuleName:', this._openModuleName);
                if(b.mod === 'base'){
                    if(window.hata){
                        if(hata._win && hata._win.parent){ this._closeAllPanels(); return; }
                        this._closeAllPanels(); hata.open();
                    } else {
                        modules.checkFlags(['base'], ()=>{
                            if(window.hata){ this._closeAllPanels(); hata.open(); }
                        });
                    }
                    return;
                }
                if(b.mod === 'leaderboard'){ this._openLeaderboard(); return; }
                this.openModule(b.mod);
            });
            rightPanel.addChild(norm, hov, hit);
        });
        root.layer1_mc.addChild(rightPanel);
        this._pngRightPanel = rightPanel;
        console.log('[interface._buildPngSidePanels] right panel built at', PANEL_X_RIGHT, PANEL_Y_RIGHT);
    };

}

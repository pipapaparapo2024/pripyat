/** Покер — игровая логика (ставка, замена карт, разрешение руки).
 *
 * ── SERVER-AUTHORITATIVE (18.09.2026, перенос экономики — Казино) ──
 * Раньше списание фишки/тушёнки, весовой RNG комбинации (_pokerRoll), генерация карт под
 * неё (_pokerGenerateHandForCombo) и итоговая оценка руки (_evaluatePokerHand) считались
 * прямо в браузере — читер мог подставить this._pokerHand с рояль-флешем и вызвать
 * _resolvePokerNewScreen() из консоли, либо вызвать dvor._give('shmot', 999) напрямую.
 * Теперь раздача/замена/итог — три отдельных запроса к серверу (poker.deal/swap/resolve,
 * server/core/controllers/poker.php); клиент только просит и проигрывает анимацию тасовки
 * (косметическую — реальная рука уже определена сервером к моменту её начала). Активная
 * раздача хранится в udata['poker_session'] — это поле НЕ в whitelist users.php (как
 * dice_session/yashik_session), клиент физически не может подделать его через users.save.
 */
import { applyPatch } from '../../modules/patch.js';
import { getTrimmedCardTexture } from './dvor-poker-card-trim.js';

export function attachPokerGame(proto){

    // 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у блэкджека
    // после репорта "выпала AA хотя pity ещё далеко", конкретного бага здесь не было): сервер
    // (poker.php) кладёт поле debug в каждый ответ deal/swap/resolve/openBag.
    function logPokerDebug(fnLabel, debug){
        if(!debug){ console.warn('[dvor-poker.' + fnLabel + '] сервер не вернул debug — правка ещё не задеплоена?'); return; }
        console.log('[dvor-poker.' + fnLabel + '] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА (debug):', debug);
        if(debug.comboMismatchAtDeal){
            console.error('[dvor-poker.' + fnLabel + '] !!! сгенерированная рука не равна запрошенной комбинации !!!', debug);
        }
        if(debug.saveVerifyMismatch){
            console.error('[dvor-poker.' + fnLabel + '] !!! записанное и прочитанное обратно значение разошлись !!!', debug);
        }
    }

    // 25.09.2026 (по прямому указанию — "выбор сбрасывается при смене вкладки/перезагрузке,
    // игра уничтожается"): вызывается ОДИН раз при первом открытии экрана покера за загрузку
    // страницы (см. dvor-poker.js._openPokerScreen). poker.getSession — без побочных эффектов,
    // просто читает poker_session с сервера. Если раздача была активна — восстанавливаем ровно
    // то же состояние, что выставляет успешный poker.deal (кроме анимации тасовки, она чисто
    // косметическая и здесь не нужна — карты сразу показываются в конечном виде).
    proto._pokerRestoreSession = function(){
        TS.php('poker.getSession', {}, (res) => {
            if(!res || !res.active || !res.hand){
                console.log('[dvor-poker._pokerRestoreSession] активной раздачи нет — обычный простой экран');
                return;
            }
            console.log('[dvor-poker._pokerRestoreSession] найдена незавершённая раздача, восстанавливаю:', JSON.stringify(res));
            this._pokerHand      = res.hand;
            this._pokerSelected  = [false,false,false,false,false];
            this._pokerSwapsLeft = Math.max(0, intval_(res.swapsAllowed) - intval_(res.swapsUsed));
            this._pokerState     = 1;
            if(this._pokerResultTxt) this._pokerResultTxt.text = '';
            for(let i = 0; i < 5; i++){
                if(this._pokerCardSprites[i]) this._pokerCardSprites[i].visible = true;
                if(this._pokerSuitTexts[i])   this._pokerSuitTexts[i].visible   = true;
            }
            this._pokerUpdateCards();
            this._updatePokerSwapButtons();
            this._updatePokerUI();
        }, (err) => {
            console.error('[dvor-poker._pokerRestoreSession] ошибка сервера, считаем что активной раздачи нет:', JSON.stringify(err));
        });
    };
    function intval_(v){ return parseInt(v, 10) || 0; }

    proto._playPokerNewScreen = function(useChip){
        if(this._pokerReqInFlight){
            console.log('[dvor-poker._playPokerNewScreen] запрос уже выполняется, повторный клик проигнорирован');
            return;
        }

        const doDeal = () => {
            this._pokerReqInFlight = true;
            console.log('[dvor-poker._playPokerNewScreen] КЛИК раздать use_chip=' + useChip + ' | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
            // 28.09.2026 (репорт — "опыт/уровень в азартных играх не сохраняется"): предыдущий
            // раунд заканчивается вызовом this._addExp('poker',1) (dvor.js), который пишет
            // udata['dvor_games_data'] локально и сам зовёт flushPlayerSave(), НЕ дожидаясь
            // завершения. Если игрок жмёт ИГРАТЬ сразу следующим кликом, poker.deal() ниже может
            // стартовать раньше, чем тот flush долетел — сервер читает ПОЛНУЮ строку через
            // Gameops::loadUser() (ещё СО СТАРЫМ dvor_games_data) и в конце пишет её обратно —
            // если это происходит ПОСЛЕ того, как долетел flush с новым опытом, свежий опыт тихо
            // затирается. flushPlayerSave() здесь гарантирует, что предыдущий раунд сохранён,
            // ПРЕЖДЕ чем стартует следующий (тот же приём, что уже в blackjack.deal/dice.start).
            flushPlayerSave('poker_deal_flush_prev_exp', () => {
            console.log('[dvor-poker._playPokerNewScreen] → сервер: poker.deal | use_chip:', useChip);
            // 24.09.2026 (баг найден по прямому указанию — "не дали 20 рублей за пару",
            // подтверждено консолью — почти КАЖДЫЙ deal/swap/resolve печатал "!!! записанное и
            // прочитанное обратно значение разошлись !!!"): тот же класс гонки, что уже чинили
            // для боссов (см. player-save.js) — poker.deal/swap/resolve пишут poker_session
            // НАПРЯМУЮ через Gameops::saveUser(), в обход обычного автосейва. При игре в покер
            // клики идут заметно чаще (deal→swap→swap→swap→resolve за секунды), поэтому 500мс-
            // окно автосейва почти ВСЕГДА перекрывалось со следующим запросом — отсюда почти
            // 100% воспроизводимость по сравнению с боссами. suspendPlayerSave()/
            // resumePlayerSave() перекрывают всё окно каждого запроса.
            if(window.suspendPlayerSave) suspendPlayerSave('poker_deal');
            TS.php('poker.deal', {use_chip: useChip}, (res) => {
                this._pokerReqInFlight = false;
                console.log('[dvor-poker._playPokerNewScreen] ← ответ сервера:', JSON.stringify(res));
                logPokerDebug('_playPokerNewScreen (deal)', res && res.debug);
                if(!res || !res.patch || !res.hand){
                    console.error('[dvor-poker._playPokerNewScreen] некорректный ответ сервера (нет patch/hand), раздача не начата:', JSON.stringify(res));
                    if(window.resumePlayerSave) resumePlayerSave('poker_deal');
                    return;
                }
                // 25.09.2026 (тот же фикс, что у боссов — bosses-combat.js._attack, см. подробный
                // коммент там): applyPatch() ПЕРЕД resumePlayerSave(), иначе отложенный автосейв
                // может уйти со СТАРЫМ udata и затереть то, что poker.deal() только что записал
                // напрямую (poker_session) — та же гонка, просто в покере.
                applyPatch(res.patch);
                if(window.resumePlayerSave) resumePlayerSave('poker_deal');
                this._loadDaily();
                iface.updateUp();

                this._pokerHand      = res.hand;
                this._pokerSelected  = [false,false,false,false,false];
                // 25.09.2026: если deal() вернул уже АКТИВНУЮ раздачу (res.resumed — сервер не
                // стал перезаписывать её новой, см. poker.php.deal()), swapsUsed может быть >0 —
                // считаем остаток явно, а не берём общий лимит как есть.
                this._pokerSwapsLeft = Math.max(0, intval_(res.swapsAllowed) - intval_(res.swapsUsed));
                this._pokerState     = 1;
                if(this._pokerResultTxt) this._pokerResultTxt.text = '';
                for(let i = 0; i < 5; i++){
                    if(this._pokerCardSprites[i]) this._pokerCardSprites[i].visible = true;
                    if(this._pokerSuitTexts[i])   this._pokerSuitTexts[i].visible   = true;
                }
                this._runPokerShuffleAnimation();
            }, (err) => {
                this._pokerReqInFlight = false;
                if(window.resumePlayerSave) resumePlayerSave('poker_deal');
                console.error('[dvor-poker._playPokerNewScreen] ← ошибка сервера:', JSON.stringify(err));
                // Коды: 79 — недостаточно фишек, 80 — дневной лимит игр за тушёнку исчерпан,
                // 81 — недостаточно тушёнки.
                if(err && err.code === 79){
                    if(window.iface) iface._openSidorovichError('Недостаточно фишек!', 'Нужна 1 фишка • У вас: ' + parseInt(udata['poker_chips']||0));
                } else if(err && err.code === 80){
                    if(window.notify) notify.showResult({text:'Лимит 25 игр за тушенку на сегодня!'}, 0);
                } else if(err && err.code === 81){
                    if(window.iface) iface._openSidorovichError('Недостаточно тушёнки!', 'Нужно: 5 • У вас: ' + parseInt(udata['stew']||0));
                } else if(window.notify) notify.showResult({text:'Не удалось начать раздачу'}, 0);
            });
            }); // flushPlayerSave('poker_deal_flush_prev_exp', ...) — см. коммент выше
        };

        // Игрок нажал ИГРАТЬ заново, не подтвердив явно предыдущую раздачу (не нажал
        // СЫГРАТЬ и не израсходовал все смены) — ничего не должно "сгорать": сначала
        // ждём, пока сервер подведёт итог старой раздачи (poker.resolve, награда
        // начисляется как обычно) и покажем тостом, что именно выиграно — и только
        // ПОСЛЕ этого просим новую раздачу. Ждать обязательно (а не запускать deal
        // параллельно с resolve) — иначе deal() перезапишет udata['poker_session']
        // раньше, чем resolve() успеет его прочитать на сервере (гонка запросов).
        if(this._pokerState === 1){
            this._pokerConfirmNewScreen(() => {
                if(window.notify && this._pokerResultTxt && this._pokerResultTxt.text){
                    notify.showResult({text: this._pokerResultTxt.text}, 1);
                }
                doDeal();
            });
        } else {
            doDeal();
        }
    };

    // Чисто визуальная анимация тасовки (карты мелькают случайными рангами/мастями) —
    // ЗЕМЛИТСЯ на серверных this._pokerHand в конце. Косметический Math.random() здесь
    // ничего не решает — реальная рука уже определена сервером в poker.deal().
    proto._runPokerShuffleAnimation = function(){
        const _prks = ['двойка','тройка','четверка','пятерка','шестерка','семерка','восьмерка','девятка','десятка','валет','дама','король','туз'];
        const _suts = ['♠','♥','♦','♣'];
        let _pf = 0;
        const _panim = setInterval(()=>{
            for(let i = 0; i < 5; i++){
                const spr = this._pokerCardSprites[i];
                if(spr){
                    const rr = _prks[Math.floor(Math.random()*_prks.length)];
                    const rs = _suts[Math.floor(Math.random()*4)];
                    const tex = PIXI.Texture.from(this._getCardImgPath(rr, rs));
                    // Метим спрайт "поколением" — тот же приём, что и в _updatePokerCardVisual
                    // (dvor-poker-screen.js): за 80мс между кадрами тасования этот же слот может
                    // получить ещё одну новую карту раньше, чем придёт асинхронный результат
                    // обрезки текущей — коллбэк ниже должен это заметить и не применяться.
                    const myGen = (spr._pokerGen = (spr._pokerGen || 0) + 1);
                    // 26.09.2026: та же фиксированная 86×140 через width/height (не scale —
                    // у каждой карты своя обрезанная bbox, единый scale давал разный итоговый
                    // размер), что теперь в итоговой раздаче (dvor-poker-screen.js) — иначе
                    // карта визуально "скакнула" бы в размере между тасовкой и финальным показом.
                    const CARD_W = 86, CARD_H = 140;
                    const applySize = () => {
                        if(spr._pokerGen !== myGen) return;
                        spr.width = CARD_W; spr.height = CARD_H;
                        spr.y = spr._pokerBaseY;
                    };
                    // 1) Best-effort сразу «сырой» текстурой — карта не пустая, пока считается обрезка.
                    spr.texture = tex;
                    applySize();
                    // 2) Обрезаем по содержимому — см. dvor-poker-card-trim.js. Благодаря прогреву
                    //    кэша при открытии экрана (preloadAllCardTrims) это почти всегда синхронный
                    //    хит из кэша, поэтому карта уже во время тасования показывает правильный,
                    //    финальный размер, а не "сырой" с последующим скачком.
                    getTrimmedCardTexture(tex, (trimmedTex) => {
                        if(spr._pokerGen !== myGen) return;
                        spr.texture = trimmedTex;
                        applySize();
                    });
                }
            }
            if(++_pf >= 10){
                clearInterval(_panim);
                this._pokerUpdateCards();
                this._updatePokerSwapButtons();
                this._updatePokerUI();
                if(this._pokerSwapsLeft === 0) this._pokerConfirmNewScreen();
            }
        }, 80);
    };

    proto._pokerConfirmNewScreen = function(onDone){
        if(this._pokerState !== 1){ if(onDone) onDone(); return; }
        this._resolvePokerNewScreen(onDone);
    };

    proto._togglePokerSwap = function(idx){
        if(this._pokerReqInFlight) return;
        if(this._pokerState !== 1 || this._pokerSwapsLeft <= 0) return;
        if(!Number.isInteger(idx) || idx < 0 || idx >= 5 || !this._pokerHand) return;

        this._pokerReqInFlight = true;
        console.log('[dvor-poker._togglePokerSwap] КЛИК смена idx=' + idx + ' | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        console.log('[dvor-poker._togglePokerSwap] → сервер: poker.swap | idx:', idx);
        // 24.09.2026 — см. большой коммент у poker.deal() выше (тот же класс гонки автосейва).
        if(window.suspendPlayerSave) suspendPlayerSave('poker_swap');
        TS.php('poker.swap', {idx: idx}, (res) => {
            this._pokerReqInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('poker_swap');
            console.log('[dvor-poker._togglePokerSwap] ← ответ сервера:', JSON.stringify(res));
            logPokerDebug('_togglePokerSwap (swap)', res && res.debug);
            if(!res || !res.card){
                console.error('[dvor-poker._togglePokerSwap] некорректный ответ сервера (нет card), замена не применена:', JSON.stringify(res));
                return;
            }
            this._pokerHand[idx] = res.card;
            this._pokerSelected[idx] = false;
            if(this._pokerCardBorders && this._pokerCardBorders[idx]) this._pokerCardBorders[idx].visible = false;
            this._updatePokerCardVisual(idx);
            this._pokerSwapsLeft = res.swapsLeft;
            this._updatePokerSwapButtons();
            // Все доступные смены израсходованы — решать больше нечего, сразу подводим итог
            // и начисляем награду (раньше нужно было ещё отдельно нажимать СЫГРАТЬ вручную).
            if(this._pokerSwapsLeft <= 0) this._pokerConfirmNewScreen();
        }, (err) => {
            this._pokerReqInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('poker_swap');
            console.error('[dvor-poker._togglePokerSwap] ← ошибка сервера:', JSON.stringify(err));
            // Коды: 82 — нет активной раздачи, 83 — смены закончились. В обоих случаях
            // просто синхронизируем локальное UI-состояние с реальностью на сервере.
            if(err && err.code === 83) this._pokerSwapsLeft = 0;
            this._updatePokerSwapButtons();
        });
    };

    proto._resolvePokerNewScreen = function(onDone){
        if(this._pokerReqInFlight){ if(onDone) onDone(); return; }
        this._pokerReqInFlight = true;
        this._pokerState = 0;
        if(this._pokerDealBtn) this._pokerDealBtn.visible = false;
        for(let i = 0; i < 5; i++){
            if(this._pokerSwapBtns[i]){
                this._pokerSwapBtns[i].visible = true;
                this._pokerSwapBtns[i].interactive = false;
                this._pokerSwapBtns[i].buttonMode = false;
                this._pokerSwapBtns[i].texture = PIXI.Texture.from('./images/smenit_passiv.png');
            }
        }

        console.log('[dvor-poker._resolvePokerNewScreen] КЛИК резолв | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        console.log('[dvor-poker._resolvePokerNewScreen] → сервер: poker.resolve');
        // 24.09.2026 — см. большой коммент у poker.deal() выше (тот же класс гонки автосейва).
        // Именно ЗДЕСЬ гонка выглядит как "не начислило награду" — resolve() пишет
        // poker_session.active=false ОДНОВРЕМЕННО с coins/exp/cigarettes через ту же
        // saveUser(), и клобберящий автосейв откатывает их вместе.
        if(window.suspendPlayerSave) suspendPlayerSave('poker_resolve');
        TS.php('poker.resolve', {}, (res) => {
            this._pokerReqInFlight = false;
            console.log('[dvor-poker._resolvePokerNewScreen] ← ответ сервера:', JSON.stringify(res));
            logPokerDebug('_resolvePokerNewScreen (resolve)', res && res.debug);
            if(!res || !res.patch){
                console.error('[dvor-poker._resolvePokerNewScreen] некорректный ответ сервера (нет patch), итог не применён:', JSON.stringify(res));
                if(window.resumePlayerSave) resumePlayerSave('poker_resolve');
                this._finishPokerNewScreen();
                if(onDone) onDone();
                return;
            }
            // 25.09.2026 (тот же фикс, что у боссов — см. подробный коммент в
            // bosses-combat.js._attack): applyPatch() ПЕРЕД resumePlayerSave() — именно resolve()
            // и есть та гонка, что описана в коммент выше ("не начислило награду").
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('poker_resolve');
            if(res.patch.shmot !== undefined && window.shmot && typeof shmot._loadFromUdata === 'function'){
                shmot._loadFromUdata();
            }

            // Патроны уже начислены сервером. Только обновляем локальное представление.
            if(res.patch.weapons !== undefined && window.weapons){
                weapons._loadFromUdata();
            }

            // 22.09.2026 (баг "слетели шансы, не выдаёт награду", по прямому указанию —
            // расследование показало, что награда честно начисляется сервером всегда, просто
            // ничего не показывало результат): _pokerResultTxt никогда не добавлялся ни в один
            // контейнер — строка использовалась ТОЛЬКО как текст для тоста в ОТДЕЛЬНОМ сценарии
            // (повторный клик ИГРАТЬ поверх незавершённой раздачи, см. _playPokerNewScreen).
            // Обычное завершение раздачи вообще не показывало игроку итог, кроме подсветки
            // таблицы. Тост добавлен и сюда — тот же текст, та же подсветка остаётся как было.
            if(this._pokerResultTxt) this._pokerResultTxt.text = '🃏 ' + res.lbl + (res.sp ? '  +'+res.sp+'🟣' : '');
            if(window.notify && this._pokerResultTxt && this._pokerResultTxt.text) notify.showResult({text: this._pokerResultTxt.text}, 1);
            this._pokerShowComboHighlight(res.combo);
            if(window.achievements) achievements.onDvorGame('poker', {combo: res.id});

            this._finishPokerNewScreen();
            if(onDone) onDone();
        }, (err) => {
            this._pokerReqInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('poker_resolve');
            console.error('[dvor-poker._resolvePokerNewScreen] ← ошибка сервера:', JSON.stringify(err));
            if(window.notify) notify.showResult({text:'Не удалось подвести итог партии'}, 0);
            this._finishPokerNewScreen();
            if(onDone) onDone();
        });
    };

    proto._finishPokerNewScreen = function(){
        this._addExp('poker', 1);
        this._updatePokerUI();
    };
}

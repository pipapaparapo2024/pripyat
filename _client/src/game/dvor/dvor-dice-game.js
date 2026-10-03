import { applyPatch } from '../../modules/patch.js';

/** Зарики — игровая логика (бросок, замена, разрешение).
 *
 * ── SERVER-AUTHORITATIVE (18.09.2026, перенос экономики — Казино, игра 1/5) ──
 * Раньше RNG (бросок/переброс) и начисление награды считал клиент — читер мог подделать
 * udata['dvor_games_data'].dice.pity консолью и форсировать джекпот 4×6 в каждой партии, либо
 * просто вызвать _give('cig', 999999) напрямую. Теперь бросок/переброс/итог — три отдельных
 * запроса к серверу (dice.start/reroll/resolve, server/core/controllers/dice.php); клиент
 * только просит и проигрывает анимацию по СЕРВЕРНЫМ значениям. Состояние текущего броска и
 * pity-счётчик хранятся в udata['dice_session'] — это поле НЕ в whitelist users.php (как
 * roulette_cups у Roulette), клиент физически не может подделать его через users.save.
 *
 * TABLE ниже оставлена ТОЛЬКО для UI (подсветка нужной строки в напечатанной на фоне таблице,
 * см. dvor-dice-screen.js._diceShowComboHighlight) — суммы/раздача больше не считаются по ней,
 * реальная таблица теперь в server/json/dice_config.json (сверена построчно при переносе).
 */
export function attachDiceGame(proto){

    // 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у блэкджека
    // после репорта "выпала AA хотя pity ещё далеко", конкретного бага здесь не было): сервер
    // (dice.php) кладёт поле debug в каждый ответ start/reroll/resolve — печатаем раскрытым
    // объектом в консоль, отдельным console.error если сервер сам пометил находку.
    function logDiceDebug(fnLabel, debug){
        if(!debug){ console.warn('[dvor-dice.' + fnLabel + '] сервер не вернул debug — правка ещё не задеплоена?'); return; }
        console.log('[dvor-dice.' + fnLabel + '] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА (debug):', debug);
        if(debug.saveVerifyMismatch){
            console.error('[dvor-dice.' + fnLabel + '] !!! записанное и прочитанное обратно значение разошлись !!!', debug);
        }
    }

    const TABLE = [
        {v:6,n:4}, {v:6,n:3}, {v:6,n:2},
        {v:5,n:4}, {v:5,n:3}, {v:5,n:2},
        {v:4,n:4}, {v:4,n:3}, {v:4,n:2},
        {v:3,n:4}, {v:3,n:3}, {v:3,n:2},
        {v:2,n:4}, {v:2,n:3}, {v:2,n:2},
        {v:1,n:4}, {v:1,n:3}, {v:1,n:2},
    ];

    // 25.09.2026 (по прямому указанию — "выбор сбрасывается при смене вкладки/перезагрузке,
    // игра уничтожается"): вызывается ОДИН раз при первом открытии экрана зариков за загрузку
    // страницы (см. dvor-dice.js._openDiceScreen). dice.getSession — без побочных эффектов.
    // Если бросок был активен — восстанавливаем то же состояние, что и успешный dice.start,
    // но без анимации броска (она чисто косметическая) — кости сразу показываются в итоговом виде.
    proto._diceRestoreSession = function(){
        TS.php('dice.getSession', {}, (res) => {
            if(!res) return;
            if(!res.active || !Array.isArray(res.rolls)){
                console.log('[dvor-dice._diceRestoreSession] активного броска нет — обычный простой экран');
                return;
            }
            console.log('[dvor-dice._diceRestoreSession] найден незавершённый бросок, восстанавливаю:', JSON.stringify(res));
            this._diceRolls     = res.rolls;
            this._diceSelected  = [false,false,false,false];
            this._diceSwapsLeft = Math.max(0, (parseInt(res.swapsAllowed,10)||0) - (parseInt(res.swapsUsed,10)||0));
            this._diceState     = 1;
            for(let i = 0; i < 4; i++){
                if(this._diceDiceSprites[i]){ this._diceDiceSprites[i].texture = PIXI.Texture.from('./images/зарики кости ' + this._diceRolls[i] + '.png'); this._diceDiceSprites[i].visible = true; }
                if(this._diceDiceTexts[i])  { this._diceDiceTexts[i].text = String(this._diceRolls[i]); this._diceDiceTexts[i].visible = true; }
                this._diceDeselectAnim(i);
            }
            if(this._diceThrowBtn) this._diceThrowBtn.visible = false;
            this._updateDiceSwapUI();
        }, (err) => {
            console.error('[dvor-dice._diceRestoreSession] ошибка сервера, считаем что активного броска нет:', JSON.stringify(err));
        });
    };

    proto._playDiceNewScreen = function(){
        if(this._diceState === 1 || this._diceStarting) return;

        // Подсветка выигранной строки с прошлой партии должна висеть до этого самого момента
        // (по прямому указанию) — гасим её явно здесь, при старте НОВОЙ партии, а не по таймеру.
        if(this._diceComboHighlight){
            if(window.gsap) gsap.killTweensOf(this._diceComboHighlight);
            this._diceComboHighlight.visible = false;
        }

        this._diceStarting = true;
        console.log('[dvor-dice._playDiceNewScreen] КЛИК бросить | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        // 28.09.2026 (репорт — "опыт/уровень в азартных играх не сохраняется"): предыдущий раунд
        // заканчивается вызовом this._addExp('dice',1) (dvor.js), который пишет
        // udata['dvor_games_data'] локально и сам зовёт flushPlayerSave() — но НЕ ждёт его
        // завершения. Если игрок бросает кости СРАЗУ следующим кликом (частый сценарий), этот
        // dice.start() может стартовать раньше, чем предыдущий flush долетел до сервера —
        // dice.start() на сервере читает ПОЛНУЮ строку через Gameops::loadUser() (включая ещё
        // СТАРЫЙ dvor_games_data без только что заработанного опыта) и в конце пишет её же
        // обратно через saveUser() — если это происходит ПОСЛЕ того, как долетел flush с новым
        // опытом, свежий опыт тихо затирается старым снимком. flushPlayerSave() здесь гарантирует,
        // что предыдущий раунд полностью сохранён, ПРЕЖДЕ чем начинается следующий (тот же приём,
        // что уже используется в blackjack.deal ниже и в zone.php.fillCheckpoint).
        flushPlayerSave('dice_start_flush_prev_exp', () => {
        console.log('[dvor-dice._playDiceNewScreen] → сервер: dice.start');
        // 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
        // dice.start() списывает dice_points напрямую на сервере — окно запроса нужно перекрыть
        // suspend/resume, та же защита, что уже есть у dvor-poker-game.js/bosses.attack.
        if(window.suspendPlayerSave) suspendPlayerSave('dice_start');
        TS.php('dice.start', {}, (res) => {
            this._diceStarting = false;
            console.log('[dvor-dice._playDiceNewScreen] ← ответ сервера:', JSON.stringify(res));
            logDiceDebug('_playDiceNewScreen (start)', res && res.debug);
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('dice_start');
            if(Array.isArray(res.shmotGranted) && window.shmot){
                res.shmotGranted.forEach(id => {
                    const item = shmot.items && shmot.items.find(it => it.id === id);
                    if(item) item.owned = true;
                });
            }
            iface.updateUp();
            if(typeof this._updateDiceTimer === 'function') this._updateDiceTimer();

            this._diceRolls    = res.rolls;
            this._diceSelected = [false,false,false,false];
            // 25.09.2026: если start() вернул уже АКТИВНЫЙ бросок (res.resumed — сервер не стал
            // перебрасывать заново, см. dice.php.start()), swapsUsed может быть >0.
            this._diceSwapsLeft = Math.max(0, (parseInt(res.swapsAllowed,10)||0) - (parseInt(res.swapsUsed,10)||0));
            this._diceState = 1;
            this._runDiceThrowAnimation();
        }, (err) => {
            this._diceStarting = false;
            if(window.resumePlayerSave) resumePlayerSave('dice_start');
            console.error('[dvor-dice._playDiceNewScreen] ← ошибка сервера:', JSON.stringify(err));
            if(err && err.code === 67){
                if(window.iface) iface._openSidorovichError(
                    'Недостаточно красных поинтов!',
                    'Для игры в зарики нужен 1 красный поинт.'
                );
            } else if(window.notify) notify.showResult({text:'Не удалось начать партию'}, 0);
        });
        }); // flushPlayerSave('dice_start_flush_prev_exp', ...) — см. коммент выше
    };

    // Чисто визуальная анимация броска (спрайты крутятся/скачут случайно во время полёта) —
    // ЗЕМЛИТСЯ на серверных this._diceRolls в конце. Косметический Math.random() здесь ничего
    // не решает — реальный итог уже определён сервером в dice.start().
    proto._runDiceThrowAnimation = function(){
        const _sprs  = this._diceDiceSprites;
        const _rolls = this._diceRolls;

        for(let i = 0; i < 4; i++){
            if(this._diceDiceTexts[i])  { this._diceDiceTexts[i].text = '?'; this._diceDiceTexts[i].visible = false; }
            if(_sprs[i])                { _sprs[i].texture = PIXI.Texture.from('./images/зарики кости 1.png'); _sprs[i].visible = true; }
            this._diceDeselectAnim(i);
        }
        if(this._diceThrowBtn)   this._diceThrowBtn.visible = false;
        if(this._diceConfirmBtn) this._diceConfirmBtn.visible = false;

        for(let i = 0; i < 4; i++){
            const spr = _sprs[i];
            if(!spr) continue;
            const delay = 0.07 * i, ox = spr.x, oy = spr.y;
            const totalRot = (4 + 2*Math.random()) * Math.PI * 2;
            const driftX = 24 * (Math.random() - 0.5);
            gsap.to(spr, {y: oy-32, x: ox+driftX, duration:0.22, delay, ease:'power2.out', onComplete:()=>gsap.to(spr,{y:oy,x:ox,duration:0.32,ease:'bounce.out'})});
            gsap.to(spr, {rotation: totalRot, duration:0.6+delay, delay, ease:'power3.out', onComplete:()=>{ spr.rotation=0; }});
            gsap.timeline({delay:delay+0.55})
                .to(spr.scale,{x:1.2,y:0.8,duration:0.07,ease:'none'})
                .to(spr.scale,{x:0.9,y:1.1,duration:0.06,ease:'none'})
                .to(spr.scale,{x:1,y:1,duration:0.10,ease:'power2.out'});
        }

        let fr = 0;
        const anim = setInterval(()=>{
            for(let i = 0; i < 4; i++){
                const rr = Math.ceil(6*Math.random());
                if(_sprs[i]) _sprs[i].texture = PIXI.Texture.from('./images/зарики кости ' + rr + '.png');
            }
            if(++fr >= 14){
                clearInterval(anim);
                for(let i = 0; i < 4; i++){
                    if(_sprs[i]) _sprs[i].texture = PIXI.Texture.from('./images/зарики кости ' + _rolls[i] + '.png');
                    if(this._diceDiceTexts[i]) this._diceDiceTexts[i].text = String(_rolls[i]);
                }
                this._updateDiceSwapUI();
            }
        }, 65);
    };

    proto._toggleDiceSwap = function(idx){
        if(this._diceRerolling || !Number.isInteger(idx) || idx < 0 || idx > 3) return;
        if(this._diceState !== 1 || this._diceSwapsLeft <= 0) return;
        // 26.09.2026 (по прямому указанию — "при одном нажатии кубик начинает двигаться
        // [выбор], при ПОВТОРНОМ нажатии именно на кубик он перебрасывается"): клик по уже
        // выбранному (покачивающемуся) кубику сразу отправляет его в реролл — без отдельной
        // кнопки-подтверждения. _diceConfirmNewScreen() сам найдёт selectedIdx===idx, т.к.
        // выбор уже стоит.
        if(this._diceSelected[idx]){
            this._diceConfirmNewScreen();
            return;
        }
        // По ТЗ один заряд перебрасывает РОВНО один выбранный кубик — выбор одного кубика
        // снимает выделение с остальных.
        for(let i = 0; i < 4; i++){
            this._diceSelected[i] = false;
            this._diceDeselectAnim(i);
        }
        this._diceSelected[idx] = true;
        this._diceSelectAnim(idx);
        this._updateDiceSwapUI();
    };

    // 25.09.2026 (по прямому указанию — "убери жёлтую рамку, кубик должен сам меняться при
    // выборе"): лёгкое бесконечное покачивание кубика (±0.12 рад, туда-обратно) вместо
    // статичной жёлтой рамки-обводки — тот же приём kill/restart тween'а, что уже используют
    // другие анимации проекта (см. _bjComboHighlight в dvor-blackjack.js).
    proto._diceSelectAnim = function(idx){
        const spr = this._diceDiceSprites[idx];
        if(!spr || !window.gsap) return;
        gsap.killTweensOf(spr);
        spr.rotation = 0;
        this._diceWobbleTweens[idx] = gsap.to(spr, {
            rotation: 0.12, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut'
        });
    };

    proto._diceDeselectAnim = function(idx){
        if(this._diceWobbleTweens && this._diceWobbleTweens[idx]){
            this._diceWobbleTweens[idx].kill();
            this._diceWobbleTweens[idx] = null;
        }
        const spr = this._diceDiceSprites[idx];
        if(spr){
            if(window.gsap) gsap.killTweensOf(spr);
            spr.rotation = 0;
        }
    };

    proto._updateDiceSwapUI = function(){
        const canSwap = this._diceState === 1 && this._diceSwapsLeft > 0;
        for(let i = 0; i < 4; i++){
            if(this._diceDiceHits[i]){ this._diceDiceHits[i].interactive = canSwap; this._diceDiceHits[i].buttonMode = canSwap; }
        }
        // 25.09.2026: кнопка теперь sprite (см. dvor-dice-screen.js) с "запечённым" в
        // картинке текстом — переключать нужно только видимость, текст менять больше нечему.
        if(this._diceConfirmBtn){
            const hasSelected = this._diceSelected && this._diceSelected.some(Boolean);
            if(canSwap && hasSelected){ this._diceConfirmBtn.visible = true; }
            else if(this._diceState === 1){ this._diceConfirmBtn.visible = true; }
        }
        if(!canSwap && this._diceState === 1 && !(this._diceSelected && this._diceSelected.some(Boolean))){
            this._resolveDiceNewScreen();
        }
    };

    proto._diceConfirmNewScreen = function(){
        if(this._diceRerolling) return;
        if(this._diceState !== 1) return;
        if(this._diceSelected && this._diceSelected.some(Boolean) && this._diceSwapsLeft > 0){
            const selectedIdx = this._diceSelected.findIndex(Boolean);
            this._diceRerolling = true;
            if(this._diceConfirmBtn) this._diceConfirmBtn.visible = false;

            console.log('[dvor-dice._diceConfirmNewScreen] КЛИК переброс idx=' + selectedIdx + ' | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
            console.log('[dvor-dice._diceConfirmNewScreen] → сервер: dice.reroll | idx:', selectedIdx);
            TS.php('dice.reroll', {idx: selectedIdx}, (res) => {
                console.log('[dvor-dice._diceConfirmNewScreen] ← ответ сервера:', JSON.stringify(res));
                logDiceDebug('_diceConfirmNewScreen (reroll)', res && res.debug);
                // Сервер может заменить весь итог до показа (premium ×0.9), поэтому берём
                // полный массив, а не только значение выбранной кости.
                if(Array.isArray(res.rolls) && res.rolls.length === 4) this._diceRolls = res.rolls;
                else this._diceRolls[selectedIdx] = res.value;
                this._diceSelected[selectedIdx] = false;
                this._diceDeselectAnim(selectedIdx);
                this._diceSwapsLeft = Math.max(0, this._diceSwapsLeft - 1);

                let fr = 0;
                const anim = setInterval(()=>{
                    const i = selectedIdx;
                    const rr = Math.ceil(6*Math.random());
                    if(this._diceDiceTexts[i]) this._diceDiceTexts[i].text = String(rr);
                    if(this._diceDiceSprites[i]) this._diceDiceSprites[i].texture = PIXI.Texture.from('./images/зарики кости ' + rr + '.png');
                    if(++fr >= 8){
                        clearInterval(anim);
                        for(let dieIdx = 0; dieIdx < 4; dieIdx++){
                            if(this._diceDiceTexts[dieIdx]) this._diceDiceTexts[dieIdx].text = String(this._diceRolls[dieIdx]);
                            if(this._diceDiceSprites[dieIdx]) this._diceDiceSprites[dieIdx].texture = PIXI.Texture.from('./images/зарики кости ' + this._diceRolls[dieIdx] + '.png');
                        }
                        this._diceRerolling = false;
                        this._updateDiceSwapUI();
                    }
                }, 60);
            }, (err) => {
                console.error('[dvor-dice._diceConfirmNewScreen] ← ошибка сервера (reroll):', JSON.stringify(err));
                this._diceRerolling = false;
                this._diceSelected[selectedIdx] = false;
                this._diceDeselectAnim(selectedIdx);
                // 26.09.2026 (по прямому репорту — "переброс кубиков не работает"): раньше
                // ЛЮБАЯ ошибка сервера (в т.ч. чисто транзитная — например одноразовое
                // "Несовпадение подписи запроса" сразу после несвязанного 500 где-то ещё в
                // сессии, см. dev-force-combo-500-and-reqkey-corruption-fix.test.js) безусловно
                // обнуляла _diceSwapsLeft, ПОЛНОСТЬЮ и НАВСЕГДА отключая переброс до конца
                // раунда — тот же класс бага, что уже был исправлен для poker.swap() (там
                // zeroing стоит только под конкретным кодом "смены закончились"). Теперь так же:
                // обнуляем счётчик только на РЕАЛЬНОМ "заряды переброса кончились" (code 69,
                // dice.php.reroll()), для любой другой ошибки просто возвращаем UI в состояние
                // "готов к повторной попытке" — пользователь может нажать ещё раз.
                if(err && err.code === 69) this._diceSwapsLeft = 0;
                this._updateDiceSwapUI();
            });
        } else {
            this._resolveDiceNewScreen();
        }
    };

    proto._resolveDiceNewScreen = function(){
        if(this._diceResolving) return;
        this._diceResolving = true;
        this._diceState = 0;
        if(this._diceConfirmBtn) this._diceConfirmBtn.visible = false;
        for(let i = 0; i < 4; i++){
            if(this._diceDiceHits[i]){ this._diceDiceHits[i].interactive = false; this._diceDiceHits[i].buttonMode = false; }
            this._diceDeselectAnim(i);
        }

        console.log('[dvor-dice._resolveDiceNewScreen] КЛИК подтвердить/резолв | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        console.log('[dvor-dice._resolveDiceNewScreen] → сервер: dice.resolve');
        // 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
        // dice.resolve() начисляет награду напрямую на сервере.
        if(window.suspendPlayerSave) suspendPlayerSave('dice_resolve');
        TS.php('dice.resolve', {}, (res) => {
            this._diceResolving = false;
            console.log('[dvor-dice._resolveDiceNewScreen] ← ответ сервера:', JSON.stringify(res));
            logDiceDebug('_resolveDiceNewScreen (resolve)', res && res.debug);
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('dice_resolve');
            if(res.patch && res.patch.shmot !== undefined && window.shmot && typeof shmot._loadFromUdata === 'function'){
                shmot._loadFromUdata();
            }

            // Подсистемы, которые сервер ещё не переносит (гардероб/оружие/боевой пропуск) —
            // применяем на клиенте по подсказке сервера (см. dice.php: clientRewards).
            (res.clientRewards || []).forEach(cr => {
                if(cr.type === 'battlepass_xp'){ if(window.battlepass) battlepass.addXp(cr.amt); }
                else if(window.weapons && (cr.type === 'auto' || cr.type === 'gun' || cr.type === 'machete')){
                    weapons.grantAmmo(cr.type, cr.amt);
                }
            });
            iface.updateUp();

            if(res.forced){
                this._diceShowComboHighlight(0); // строка "4×6" — всегда первая в таблице
            } else {
                const hitIndices = (res.rewards || [])
                    .map(r => TABLE.findIndex(t => t.v === r.v && t.n === r.n))
                    .filter(i => i >= 0);
                if(hitIndices.length) this._diceShowComboHighlight(hitIndices);
            }

            this._finishDiceNewScreen();
        }, (err) => {
            this._diceResolving = false;
            if(window.resumePlayerSave) resumePlayerSave('dice_resolve');
            console.error('[dvor-dice._resolveDiceNewScreen] ← ошибка сервера:', JSON.stringify(err));
            if(window.notify) notify.showResult({text:'Не удалось подвести итог партии'}, 0);
            this._finishDiceNewScreen();
        });
    };

    proto._finishDiceNewScreen = function(){
        this._addExp('dice', 1);
        this._updateDiceScreenUI();
        if(this._diceThrowBtn) this._diceThrowBtn.visible = true;
        if(window.achievements) achievements.onDvorGame('dice', {});
    };
}

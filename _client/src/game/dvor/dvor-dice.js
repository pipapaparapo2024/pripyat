/** Зарики — FLA-панель (старый, используется только авто-ботом) + новый экран (оркестратор). */
import { applyPatch } from '../../modules/patch.js';
import { attachDiceScreen } from './dvor-dice-screen.js';
import { attachDiceGame   } from './dvor-dice-game.js';

export function attachDice(proto){

    // ── FLA зарики (старая панель) ──────────────────────────────────────────
    //
    // 18.09.2026, перенос экономики на сервер: раньше эта функция САМА бросала кости
    // (Math.random()) и начисляла награду — читер мог вызвать dvor._playDice() напрямую из
    // консоли сколько угодно раз, минуя даже новый экран зариков (dvor-dice-game.js). Панель
    // dice_panel визуально уже недостижима через обычную навигацию (см. Dvor._openGame —
    // 'dice' сразу открывает _openDiceScreen()), НО эта функция по-прежнему вызывается
    // авто-ботом (bot.js, «Авто-двор (кости)») — поэтому не удалена, а переведена на тот же
    // сервер, что и новый экран: dice.start + сразу dice.resolve (эта старая панель никогда не
    // поддерживала переброс костей, поэтому reroll здесь не нужен).
    proto._playDice = function(){
        if(this._rolling) return;
        this._rolling = true;
        console.log('[dvor-dice._playDice] (авто-бот) -> сервер: dice.start');
        TS.php('dice.start', {}, (res) => {
            console.log('[dvor-dice._playDice] <- старт получен, сразу резолвим (без переброса) | rolls:', JSON.stringify(res.rolls));
            applyPatch(res.patch);
            iface.updateUp();
            TS.php('dice.resolve', {}, (res2) => {
                console.log('[dvor-dice._playDice] <- итог:', JSON.stringify(res2));
                applyPatch(res2.patch);
                if(res2.patch && res2.patch.shmot !== undefined && window.shmot && typeof shmot._loadFromUdata === 'function'){
                    shmot._loadFromUdata();
                }
                // 25.09.2026: убрана ветка cr.type==='shmot' → shmot.giveRandom() — dice.php
                // (см. applyCurrency() внутри resolve()) уже начисляет шмотку САМ через
                // Gameops::grantShmotFromSource() и никогда не присылает type:'shmot' в
                // clientRewards, так что эта ветка была мёртвым кодом, реализующим тот же
                // небезопасный паттерн (клиент сам решает и сам пишет владение шмоткой через
                // users.save, которое users.php._sanitizeShmot() молча отклоняет).
                (res2.clientRewards || []).forEach(cr => {
                    if(cr.type === 'battlepass_xp'){ if(window.battlepass) battlepass.addXp(cr.amt); }
                    else if(window.weapons && (cr.type === 'auto' || cr.type === 'gun' || cr.type === 'machete')){
                        weapons.grantAmmo(cr.type, cr.amt);
                    }
                });
                iface.updateUp();
                this._finishDice();
            }, (err) => {
                console.error('[dvor-dice._playDice] <- ошибка resolve:', JSON.stringify(err));
                this._rolling = false;
            });
        }, (err) => {
            console.error('[dvor-dice._playDice] <- ошибка start:', JSON.stringify(err));
            this._rolling = false;
            if(err && err.code === 67 && window.iface){
                iface._openSidorovichError('Недостаточно красных поинтов!', 'Для игры в зарики нужен 1 красный поинт.');
            }
        });
    };

    proto._finishDice = function(){
        this._addExp('dice',1);
        this._rolling=false;
    };

    // ── Новый экран — оркестратор ────────────────────────────────────────────

    proto._getDiceSwapsAllowed = function(){
        const lvl = this._getLevelInfo('dice').level;
        if(lvl >= 100) return 3;
        if(lvl >= 60)  return 2;
        if(lvl >= 20)  return 1;
        return 0;
    };

    proto._openDiceScreen = function(){
        if(!this._diceWin) this._buildDiceScreen();
        root.layer2_mc.addChild(this._diceWin);
        // 22.09.2026 (баг найден по живому репорту — "фон двоится при открытии зариков"):
        // здесь стояло только interactiveChildren=false, БЕЗ скрытия/затемнения — лобби Двора
        // (_dvorWrap, свой фон "вкладка двор.png", 1280×546, растянут) оставалось полностью
        // ВИДИМЫМ под экраном зариков. Фон зариков ("зарики фон вкладка двор.png") — та же
        // самая картинка байт-в-байт (проверено по MD5), но вставлена в НАТИВНОМ размере
        // 1280×536 без растяжения — короче канваса на 184px. В незакрытых зазорах (верх/низ)
        // сквозь неё было видно СТАРОЕ растянутое лобби — то самое "двоение".
        //
        // 24.09.2026 (по прямому указанию — "игры должны открываться поверх Двора, а не
        // Главного, фон Двора при этом затемнён"): вместо полного скрытия (visible=false)
        // теперь просто затемняем лобби (alpha) — оно остаётся видимым позади экрана игры, но
        // тусклым и некликабельным. Заодно решает и "двоение": тусклая нестыковка на стыке
        // краёв куда менее заметна, чем яркая. _closeDiceScreen() ниже возвращает alpha=1.
        if(this._dvorWrap){ this._dvorWrap.alpha = 0; this._dvorWrap.interactiveChildren = false; }
        this._loadDaily();
        this._updateDiceScreenUI();
        this._startDiceTimer();
        if(window.iface) iface.restoreHud();

        // 25.09.2026 (по прямому указанию — "выбор сбрасывается при смене вкладки/перезагрузке,
        // игра уничтожается"): this._diceState живёт только в JS-памяти текущего объекта Dvor —
        // при перезагрузке страницы/новой вкладке он всегда undefined, даже если на СЕРВЕРЕ
        // бросок всё ещё активен (dice_session.active), потому что стоимость уже списана.
        // Проверяем один раз за загрузку страницы.
        if(this._diceState !== 1 && !this._diceSessionChecked){
            this._diceSessionChecked = true;
            this._diceRestoreSession();
        }
    };

    proto._closeDiceScreen = function(){
        this._stopDiceTimer();
        if(this._diceBuyWin && this._diceBuyWin.parent) this._diceBuyWin.parent.removeChild(this._diceBuyWin);
        if(this._diceWin && this._diceWin.parent) this._diceWin.parent.removeChild(this._diceWin);
        if(this._dvorWrap){ this._dvorWrap.alpha = 1; this._dvorWrap.interactiveChildren = true; }
    };

    proto._startDiceTimer = function(){
        this._stopDiceTimer();
        this._updateDiceTimer();
        // Раньше интервал нигде не заводился (только один разовый вызов выше) — текст
        // "через HH:MM:SS" не тикал бы сам по себе без переоткрытия экрана.
        this._diceTimerInterval = setInterval(() => this._updateDiceTimer(), 1000);
    };

    proto._stopDiceTimer = function(){
        if(this._diceTimerInterval){ clearInterval(this._diceTimerInterval); this._diceTimerInterval = null; }
    };

    // Бесплатный ежедневный бросок (16.09.2026, возвращён по прямому указанию — см. подробный
    // комментарий в dvor-dice-game.js._playDiceNewScreen). Текст над кнопкой БРОСИТЬ:
    // "БЕСПЛАТНЫЙ БРОСОК", если udata['dice_free_ts'] пуст или прошло ≥24ч, иначе обратный
    // отсчёт до следующего бесплатного броска (стоимость платного броска уже на самой кнопке).
    proto._updateDiceTimer = function(){
        if(!this._diceTimerTxt) return;
        const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
        const lastFree = parseInt(udata && udata['dice_free_ts'] || 0);
        const now = Date.now();
        // 19.09.2026 (по прямому указанию): белый цвет в обоих состояниях (было
        // зелёный "доступно"/серый "ждать") — раньше style.fill переключался туда-обратно.
        if(!lastFree || (now - lastFree) >= FREE_COOLDOWN_MS){
            this._diceTimerTxt.text = 'БЕСПЛАТНЫЙ БРОСОК';
        } else {
            const remainSec = Math.ceil((FREE_COOLDOWN_MS - (now - lastFree)) / 1000);
            const hh = String(Math.floor(remainSec / 3600)).padStart(2, '0');
            const mm = String(Math.floor((remainSec % 3600) / 60)).padStart(2, '0');
            const ss = String(remainSec % 60).padStart(2, '0');
            this._diceTimerTxt.text = 'БЕСПЛАТНЫЙ БРОСОК ЧЕРЕЗ: ' + hh + ':' + mm + ':' + ss;
        }
        this._diceTimerTxt.style.fill = '#ffffff';
    };

    proto._updateDiceScreenUI = function(){
        if(!this._data) return;
        const lvl = this._getLevelInfo('dice');
        if(this._diceLevelTxt) this._diceLevelTxt.text = String(lvl.level);
        if(this._diceNextLvlTxt) this._diceNextLvlTxt.text = String(lvl.level + 1);
        if(this._diceExpBarFill){
            // Маска для тонированной копии "шкала уровня зарики.png" (см.
            // dvor-dice-screen.js) — тот же паттерн, что и вертикальная шкала в
            // блэкджеке: фон и заливка — один и тот же ассет, залитая часть просто
            // тонирована и видна через маску-прямоугольник растущей ширины.
            const pct = lvl.next > 0 ? Math.min(1, lvl.cur / lvl.next) : 0;
            // 19.09.2026: 523→525 и 371,85→370,97 — синхронизировано с новой позицией/шириной
            // levelScale/levelTrackLit (dvor-dice-screen.js, редактор позиций), иначе заливка
            // рисовалась бы поверх старого места, разъехавшись со сдвинутым фоном шкалы.
            const w = Math.max(0, Math.floor(525 * pct));
            this._diceExpBarFill.clear();
            if(w > 0){
                this._diceExpBarFill.beginFill(0xffffff, 1);
                this._diceExpBarFill.drawRoundedRect(370, 97, w, 28, 12);
                this._diceExpBarFill.endFill();
            }
            if(this._diceLevelTrackLit) this._diceLevelTrackLit.visible = w > 0;
        }
        const swaps = this._getDiceSwapsAllowed();
        if(this._diceAvailTxt) this._diceAvailTxt.text = String(swaps);
        const pts = parseInt(udata['dice_points']||0);
        if(this._dicePointsTxt) this._dicePointsTxt.text = String(pts);
    };

    // Подключаем sub-модули
    attachDiceScreen(proto);
    attachDiceGame(proto);
}

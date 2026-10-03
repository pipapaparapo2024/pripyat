/** Покер — FLA-панель (старый) + новый экран (оркестратор). */
import { attachPokerScreen } from './dvor-poker-screen.js';
import { attachPokerBag    } from './dvor-poker-bag.js';
import { attachPokerGame   } from './dvor-poker-game.js';
import { preloadAllCardTrims } from './dvor-poker-card-trim.js';

export function attachPoker(proto){

    // 18.09.2026 (перенос Покера на сервер): старая FLA-панель покера (_getPokerSlots/
    // _pokerRoll/_playPoker/_resolvePoker) удалена целиком — она была мёртвым кодом уже
    // до этого переноса. this.win.poker_panel никогда не показывается игроку: _openGame('poker')
    // (dvor.js) всегда уходит на _openPokerScreen() (новый экран) РАНЬШЕ, чем доходит до
    // строки, которая показала бы poker_panel; bot.js не ссылается на покер вообще (в
    // отличие от Зариков, чей старый _playDice реально дёргался автобоем). Та же RNG/выплата
    // теперь живёт на сервере (server/core/controllers/poker.php) для актуального нового
    // экрана — см. dvor-poker-game.js.

    // ── Новый экран покера — вспомогательные методы ───────────────────────────

    proto._getPokerSwapsAllowed = function(){
        const lvl = this._getLevelInfo('poker').level;
        if(lvl >= 100) return 3;
        if(lvl >= 60)  return 2;
        if(lvl >= 20)  return 1;
        return 0;
    };

    proto._openPokerScreen = function(){
        if(!this._pokerWin) this._buildPokerScreen();
        // Прогреваем кэш обрезки карт ОДИН раз при первом открытии экрана — чтобы
        // анимация тасования (dvor-poker-game.js) с первого кадра использовала уже
        // обрезанный (правильный) размер, а не "прыгала" в размере в момент раздачи.
        if(!this._pokerTrimsPreloaded){
            this._pokerTrimsPreloaded = true;
            preloadAllCardTrims((rank, suit) => this._getCardImgPath(rank, suit));
        }
        // 29.09.2026 (репорт — "если выйти из казино во время раздачи карт/костей, когда ещё
        // можно менять, и зайти обратно, игра будто ничего не сохраняет"): здесь стоял
        // _pokerConfirmNewScreen() — тот же метод, что и кнопка ПОДТВЕРДИТЬ, он СРАЗУ шлёт
        // poker.resolve() и завершает раздачу целиком, даже если у игрока ещё остались смены
        // карт. Экран, закрытый посреди незавершённой раздачи (state=1), нужно было просто
        // ПЕРЕРИСОВАТЬ в актуальном состоянии (карты/кнопки смены) — this._pokerHand и
        // this._pokerSwapsLeft уже корректны в памяти (никто их не трогал, пока экран был
        // закрыт), не хватало только вызвать те же функции отрисовки, что и
        // _pokerRestoreSession() при восстановлении после перезагрузки (см. чуть ниже) — вместо
        // того, чтобы отбирать у игрока право доиграть свою же раздачу. Дайс/блэкджек этой
        // ошибки не имели — у них при state===1 просто ничего не делается, экран остаётся как
        // был (там же и подсмотрен образец правильного поведения).
        if(this._pokerState === 1){
            this._pokerUpdateCards();
            this._updatePokerSwapButtons();
        } else if(!this._pokerSessionChecked){
            // 25.09.2026 (по прямому указанию — "выбор сбрасывается при смене вкладки/
            // перезагрузке, игра уничтожается"): this._pokerState живёт только в JS-памяти
            // текущего объекта Dvor — при перезагрузке страницы/новой вкладке он всегда
            // undefined, даже если на СЕРВЕРЕ раздача всё ещё активна (poker_session.active),
            // потому что деньги за неё уже списаны. Проверяем один раз за загрузку страницы.
            this._pokerSessionChecked = true;
            this._pokerRestoreSession();
        }
        root.layer2_mc.addChild(this._pokerWin);
        // 24.09.2026 (по прямому указанию — "игры должны открываться поверх Двора, а не
        // Главного, фон Двора при этом затемнён"): лобби Двора остаётся ВИДИМЫМ (затемнённым и
        // некликабельным) позади экрана игры, вместо полного скрытия. См. подробный разбор
        // бага "фон двоится" (22.09.2026) в dvor-dice.js._openDiceScreen() — затемнение
        // попутно решает и его.
        if(this._dvorWrap){ this._dvorWrap.alpha = 0; this._dvorWrap.interactiveChildren = false; }
        this._updatePokerUI();
        if(window.iface) iface.restoreHud();
    };

    proto._getCardImgPath = function(rank, suit){
        const RM = {двойка:'2',тройка:'3',четверка:'4',пятерка:'5',шестерка:'6',семерка:'7',восьмерка:'8',девятка:'9',десятка:'10',валет:'J',дама:'Q',король:'K',туз:'A'};
        const SM = {'♠':'покер масть пики','♥':'покер масть черви','♦':'покер масть буби','♣':'покер масть крести'};
        const r = RM[rank] || rank;
        const folder = SM[suit] || 'покер масть пики';
        return './images/' + folder + '/' + r + '.png';
    };

    proto._closePokerScreen = function(){
        if(this._pokerBagWin && this._pokerBagWin.parent) this._pokerBagWin.parent.removeChild(this._pokerBagWin);
        if(this._pokerWin && this._pokerWin.parent) this._pokerWin.parent.removeChild(this._pokerWin);
        if(this._dvorWrap){ this._dvorWrap.alpha = 1; this._dvorWrap.interactiveChildren = true; }
    };

    // Подключаем sub-модули
    attachPokerScreen(proto);
    attachPokerBag(proto);
    attachPokerGame(proto);
}

/** Пошаговое обучение (30.09.2026, по прямому указанию) — вводный попап → смена позывного →
 * тур по 8 вкладкам (рука-указатель + закадровая озвучка) → попап про валюту → финальный попап.
 *
 * 30.09.2026 (по прямому указанию — "открой обучение для всех игроков"): гейт по двум тестовым
 * VK id снят, теперь доступно всем. Обучение по-прежнему срабатывает РОВНО ОДИН РАЗ на игрока —
 * это уже обеспечивает udata['onboarding_step'] (сохраняется на сервере, см. ниже), а не
 * гейт по uid, так что снятие гейта ничего в этой гарантии не меняет. Игрок, у которого
 * onboarding_step ещё не выставлен (все существующие аккаунты на момент этого деплоя — им
 * никогда не сохраняли это поле, т.к. раньше они были не в списке допущенных), увидит обучение
 * на СВОЙ следующий полный вход в игру (через прелоадер, см. start() ниже) — ровно так, как
 * попросили: не ретроактивно посреди уже идущей сессии, а на следующей загрузке страницы.
 *
 * Состояние — udata['onboarding_step'], обычное (не server-only) whitelist-поле users.php:
 * intro → dvor → zone → baza → habar → bosses → svod → shmot → sidorovich → currency → final → done.
 * null/отсутствует трактуется как 'intro' (обучение ещё не показывалось).
 */
import { TOUR_TABS, ONBOARDING_EXTRA_SOUNDS } from './onboarding/onboarding-data.js';
import { attachOnboardingPopup } from './onboarding/onboarding-popup.js';
import { attachOnboardingTour } from './onboarding/onboarding-tour.js';

export default class Onboarding{
    constructor(){
        this._popupWin = null;
        this._tourWin = null;
        this._activeTourKey = null;
        this._narrationInstance = null;
        this._narrationUrl = null;
        this._pendingIdleNarration = false;
        this._idleTimer = null;
    }

    // 30.09.2026: раньше сверялось с ELIGIBLE_UIDS (2 тестовых аккаунта) — по прямому указанию
    // открыто для всех, метод оставлен как единая точка на случай, если гейт понадобится снова
    // (например временно отключить обучение одним изменением здесь, не трогая остальной код).
    _isEligible(){
        return true;
    }

    _currentStep(){
        return (window.udata && udata['onboarding_step']) || 'intro';
    }

    // 03.10.2026 (репорт — "после прохождения обучения оно повторно появляется при входе в
    // игру" у части игроков): раньше здесь был СВОЙ отдельный TS.php('users.save', ...) с
    // JSON.stringify(udata) целиком — в обход единого дебаунс/revision-механизма
    // player-save.js (тот же класс гонки, что уже чинили у dev_panel.js.saveDevChanges() и
    // bank.js, см. комментарий у isPlayerSaveSuspended() в player-save.js). udata['onboarding_
    // step']=step уже САМ по себе ставит в очередь обычный дебаунс-сейв (udata обёрнут в Proxy,
    // см. wrapPlayerData()) — второй, независимый, ничем не защищённый сейв отсюда был просто
    // лишней гонкой: если КАКОЙ-ТО другой сейв в полёте (например обычный периодический/
    // debounce-флаш, захвативший снимок udata ДО этой мутации) долетал до сервера ПОЗЖЕ этого
    // прямого вызова, он тихо перезаписывал onboarding_step обратно на старое значение — и при
    // следующем входе шаг 'done' оказывался потерян, обучение показывалось заново. Теперь
    // используется общий flushPlayerSave() (учитывает revision — лишнего запроса не будет, если
    // нечего сохранять) под suspend/resume — тот же приём, что уже защищает старт/завершение боя
    // с боссом и покупки, см. AGENTS.md "Архитектура сервера".
    _setStep(step){
        if(!window.udata) return;
        udata['onboarding_step'] = step;
        console.log('[onboarding._setStep] ' + step);
        if(window.suspendPlayerSave) suspendPlayerSave('onboarding_set_step');
        const _done = (err) => {
            if(window.resumePlayerSave) resumePlayerSave('onboarding_set_step');
            if(err) console.error('[onboarding._setStep] ошибка сохранения:', JSON.stringify(err));
            else console.log('[onboarding._setStep] сохранён на сервере: ' + step);
        };
        if(window.flushPlayerSave){
            flushPlayerSave('onboarding_set_step:' + step, _done);
        } else if(window.TS){
            // Резервный путь на случай, если player-save.js почему-то ещё не установлен —
            // старое поведение, просто не должно встречаться в норме.
            TS.php('users.save', {udata_json: JSON.stringify(udata)}, () => _done(), (err) => _done(err));
        } else {
            _done();
        }
		if(step === 'done') window.dispatchEvent(new Event('pripyat:onboarding-done'));
    }

    // Вызывается один раз при старте игры (module_control.js.constructShmot(), та же "всё
    // готово" точка, что и первый achievements._checkAll() — см. комментарий там).
    start(){
        this._hookScreenClose();
        if(!this._isEligible()){
            console.log('[onboarding.start] uid не в списке допущенных — обучение не показываю');
            return;
        }
        const step = this._currentStep();
        console.log('[onboarding.start] eligible=true | шаг=' + step);
        if(step === 'done') return;

        // 30.09.2026 (баг по живому тесту — "озвучка запускается раньше, чем видео-прелоадер
        // реально закончилось"): constructShmot() (откуда вызывается start()) срабатывает, как
        // только готовы игровые данные — это НЕ то же самое, что "прелоадер визуально убран"
        // (preloader-visual.js ждёт ещё и чистой границы цикла видео, см. index.js). Откладываем
        // сам показ попапа/озвучку до этого момента через общий регистр колбэков.
        const run = () => {
            if(step === 'intro'){ this._showPopup('intro'); return; }
            if(step === 'currency'){ this._showPopup('currency'); return; }
            if(step === 'final' || step === 'permission'){ this._showPopup(step); return; }
            if(TOUR_TABS.some(t => t.key === step)){ this._startTourStep(step); return; }
            console.error('[onboarding.start] неизвестное значение onboarding_step: ' + step + ' — сбрасываю на intro');
            this._setStep('intro');
            this._showPopup('intro');
        };
        if(window.onPreloaderHidden) window.onPreloaderHidden(run);
        else run();
    }

    // Кнопка dev-панели "Проиграть обучение заново" — сбрасывает шаг и стартует интро-попап
    // заново, независимо от uid (для тестирования кем угодно на dev-сборке).
    restart(){
        console.log('[onboarding.restart] сброс и повторный запуск обучения');
        this._destroyTourOverlay();
        this._hidePopup();
        this._activeTourKey = null;
        this._clearIdleTimer();
        if(window.udata) udata['onboarding_step'] = 'intro';
        this._showPopup('intro');
    }

    // Озвучка — PIXI.sound, тот же паттерн, что background-music.js. onComplete опционален:
    // попапам (интро/валюта/финал) переход по завершению звука не нужен, шагам тура — нужен.
    _playNarration(url, onComplete){
        this._stopNarration();
        if(!window.PIXI || !PIXI.sound){
            console.error('[onboarding._playNarration] PIXI.sound недоступен — озвучка не заиграет');
            return;
        }
        const alias = 'onboarding_' + url;
        const myGen = (this._narrationGen = (this._narrationGen || 0) + 1);
        const start = () => {
            if(myGen !== this._narrationGen) return; // успели переключиться, пока грузилось
            try{
                this._narrationInstance = PIXI.sound.play(alias, {
                    volume: 1,
                    complete: () => {
                        if(myGen !== this._narrationGen) return;
                        console.log('[onboarding._playNarration] озвучка доиграла: ' + url);
                        this._narrationInstance = null;
                        this._narrationUrl = null;
                        if(onComplete) onComplete();
                        this._flushQueuedIdleNarration();
                    },
                });
            } catch(e){
                console.error('[onboarding._playNarration] ошибка воспроизведения:', e.message);
            }
        };
        if(PIXI.sound.exists(alias)){ start(); return; }
        PIXI.sound.add(alias, {
            url, preload: true,
            loaded: (err) => {
                if(err){ console.error('[onboarding._playNarration] не удалось загрузить ' + url + ':', err.message); return; }
                start();
            },
        });
    }

    _stopNarration(){
        this._narrationGen = (this._narrationGen || 0) + 1; // глушит устаревший complete-колбэк
        if(this._narrationInstance && typeof this._narrationInstance.stop === 'function'){
            try{ this._narrationInstance.stop(); } catch(e){}
        }
        this._narrationInstance = null;
        this._narrationUrl = null;
    }

    _queueIdleNarration(){
        if(this._narrationInstance){ this._pendingIdleNarration = true; return; }
        this._playNarration(ONBOARDING_EXTRA_SOUNDS.idle);
    }

    _flushQueuedIdleNarration(){
        if(!this._pendingIdleNarration || this._currentStep() === 'done') return;
        this._pendingIdleNarration = false;
        this._playNarration(ONBOARDING_EXTRA_SOUNDS.idle);
    }

    // Минуту без действий в обучении считаем именно от последнего клика/смены шага.
    // Таймер не завершает урок и не меняет шаг: он только останавливает текущую реплику и
    // напоминает игроку, что ждём его действия.
    _touchOnboardingActivity(){
        this._clearIdleTimer();
        this._idleTimer = setTimeout(() => {
            this._idleTimer = null;
            if(this._currentStep() === 'done') return;
            this._queueIdleNarration();
        }, 60000);
    }

    _clearIdleTimer(){
        if(this._idleTimer){ clearTimeout(this._idleTimer); this._idleTimer = null; }
    }
}

attachOnboardingPopup(Onboarding);
attachOnboardingTour(Onboarding);

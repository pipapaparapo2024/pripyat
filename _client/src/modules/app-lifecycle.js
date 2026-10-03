/** Пауза игры при сворачивании Mini App (модерация VK, 30.09.2026 — п.6 отказа: "если свернуть
 * игру, музыка продолжает играть, а приложение работает в фоновом режиме", ссылка на
 * dev.vk.com/ru/games/how-to/handle-minimize-and-restore-events).
 *
 * До этой правки нигде в проекте не было подписки ни на VKWebAppViewHide/VKWebAppViewRestore,
 * ни на document.visibilitychange — modules/background-music.js (и dvor-music.js/
 * zone-ambient.js) продолжали крутить PIXI.sound бесконечно, пока вкладка/приложение свёрнуты.
 *
 * VKWebAppViewHide/VKWebAppViewRestore — основной канал (так сворачивание видно из
 * VK-приложения на телефоне/десктопе); document.visibilitychange — резервный (веб-версия,
 * где этих bridge-событий может не быть) — тот же паттерн уже используется в player-save.js
 * для flushPlayerSave('hidden'), здесь по аналогии.
 *
 * Останавливается ОБЩИЙ PIXI.Ticker.shared (все анимации/твины/спайн-модели/счётчики кадров —
 * см. ui_kit.js/dev_panel.js, которые тоже висят на shared-тикере) и вся звуковая подсистема
 * через PIXI.sound.pauseAll()/resumeAll() — это НЕ останавливает и НЕ сбрасывает игровые
 * таймеры/лимиты (они считаются от временных меток на сервере, см. CLAUDE.md "серверно-
 * авторитетная экономика"), только визуальный рендер и звук в свёрнутом состоянии.
 */
let _paused = false;

function _pauseApp(source){
    if(_paused) return;
    _paused = true;
    console.log('[app-lifecycle._pauseApp] приложение свёрнуто (' + source + ') — ставлю звук и рендер на паузу');
    if(window.PIXI && PIXI.sound && typeof PIXI.sound.pauseAll === 'function'){
        try{ PIXI.sound.pauseAll(); } catch(e){
            console.error('[app-lifecycle._pauseApp] ошибка PIXI.sound.pauseAll:', e.message);
        }
    }
    if(window.PIXI && PIXI.Ticker && PIXI.Ticker.shared){
        try{ PIXI.Ticker.shared.stop(); } catch(e){
            console.error('[app-lifecycle._pauseApp] ошибка PIXI.Ticker.shared.stop:', e.message);
        }
    }
}

function _resumeApp(source){
    if(!_paused) return;
    _paused = false;
    console.log('[app-lifecycle._resumeApp] приложение развёрнуто обратно (' + source + ') — возобновляю звук и рендер');
    if(window.PIXI && PIXI.sound && typeof PIXI.sound.resumeAll === 'function'){
        try{ PIXI.sound.resumeAll(); } catch(e){
            console.error('[app-lifecycle._resumeApp] ошибка PIXI.sound.resumeAll:', e.message);
        }
    }
    if(window.PIXI && PIXI.Ticker && PIXI.Ticker.shared){
        try{ PIXI.Ticker.shared.start(); } catch(e){
            console.error('[app-lifecycle._resumeApp] ошибка PIXI.Ticker.shared.start:', e.message);
        }
    }
}

export function installAppLifecyclePause(){
    if(window.bridge && typeof bridge.subscribe === 'function'){
        bridge.subscribe((e) => {
            if(!e || !e.detail) return;
            if(e.detail.type === 'VKWebAppViewHide') _pauseApp('VKWebAppViewHide');
            else if(e.detail.type === 'VKWebAppViewRestore') _resumeApp('VKWebAppViewRestore');
        });
    } else {
        console.error('[app-lifecycle.installAppLifecyclePause] window.bridge недоступен — пауза по сворачиванию будет работать только через visibilitychange');
    }

    document.addEventListener('visibilitychange', () => {
        if(document.visibilityState === 'hidden') _pauseApp('visibilitychange');
        else _resumeApp('visibilitychange');
    });

    console.log('[app-lifecycle.installAppLifecyclePause] подписка на сворачивание/разворачивание установлена');
}

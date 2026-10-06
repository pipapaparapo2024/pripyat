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
import { pauseBackgroundMusicWatchdog, resumeBackgroundMusicWatchdog } from './background-music.js';

let _paused = false;

// 06.10.2026 (баг по репорту — "зашёл в игру, через минуту-две музыка начинает дублироваться,
// двоится"): PIXI.sound.pauseAll()/resumeAll() приостанавливают ОБЩИЙ AudioContext, но не трогают
// JS-таймеры (watchdog треков в background-music.js/dvor-music.js, интервал между звуками в
// zone-ambient.js) — те тикают по wall-clock и могут сработать ВХОЛОСТУЮ, пока приложение
// свёрнуто дольше оставшейся длительности трека, форсируя переключение на следующий трек поверх
// ещё не остановленного текущего (который потом "оживает" параллельно при возврате из фона —
// отсюда двоение). Три канала отключают/перевзводят свои таймеры здесь же, синхронно с
// pauseAll()/resumeAll() — watchdog Двора живёт на window.dvor, watchdog атмосферы Зоны (она
// примешана к Interface.prototype, interface.js:420, не к классу Zone) — на window.iface,
// оба глобальные синглтоны (см. module_control.js); их методы могут отсутствовать, если
// экран ни разу не открывался в этой сессии, поэтому вызовы защищены проверкой наличия метода.
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
    pauseBackgroundMusicWatchdog();
    if(window.dvor && typeof dvor._pauseDvorMusicWatchdog === 'function') dvor._pauseDvorMusicWatchdog();
    // attachZoneAmbient() примешан к Interface.prototype (interface.js:420), не к Zone — живой
    // держатель _zoneAmbientTimer это глобальный синглтон window.iface (module_control.js), не
    // window.zone (та модель данных локаций, другой класс).
    if(window.iface && typeof iface._pauseZoneAmbientWatchdog === 'function') iface._pauseZoneAmbientWatchdog();
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
    resumeBackgroundMusicWatchdog();
    if(window.dvor && typeof dvor._resumeDvorMusicWatchdog === 'function') dvor._resumeDvorMusicWatchdog();
    if(window.iface && typeof iface._resumeZoneAmbientWatchdog === 'function') iface._resumeZoneAmbientWatchdog();
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

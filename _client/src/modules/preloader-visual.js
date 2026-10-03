/** Визуал загрузочного экрана — видео (preloader.mp4) на весь экран, ЗАЦИКЛЕНО повторяется,
 * пока игра не готова; убирается на ближайшей чистой границе цикла ПОСЛЕ готовности.
 *
 * 22.09.2026 (по прямому указанию): ранее здесь была Spine-анимация как основной вариант с
 * этим же видео как фолбэком на случай ошибки — пользователю не понравился результат
 * Spine-варианта, попросил полностью вернуть видео. Spine-ветка убрана целиком.
 *
 * 24.09.2026 (по прямому указанию — "сделай прелоадер анимацию зацикленной чтобы она
 * повторялась когда заканчивается"): между 22.09 и сейчас ролик по окончании прятался и
 * вместо него показывался статичный компас загрузки (#_clo) — пользователь явно попросил
 * вернуть цикл вместо этого. Ручной перезапуск (currentTime=0 + play()) в обработчике 'ended',
 * а не нативный vid.loop=true — нативный loop вообще не эмитит событие 'ended', а оно нужно,
 * чтобы убирать прелоадер именно на чистой границе цикла (не обрывать ролик посередине кадра),
 * когда игра готова. Компас (#_clo) этому файлу больше не нужен вообще.
 *
 * window._preloaderVideoReady() — вызывается из game-boot.js, когда игра реально готова к
 * показу.
 */
export function startPreloaderVisual(){
    let _gameDone = false, _removed = false;

    window._preloaderVideoReady = () => { _gameDone = true; };

    const vid = document.createElement('video');
    vid.src = './preloader.mp4';
    vid.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;object-fit:cover;pointer-events:none;';
    vid.playsInline = true;
    vid.muted = true;
    document.body.appendChild(vid);

    function _remove(){
        if(_removed) return;
        _removed = true;
        clearTimeout(_failsafeTid);
        vid.style.transition = 'opacity 0.5s';
        vid.style.opacity = '0';
        setTimeout(() => { try{ vid.remove(); }catch(e){} }, 550);
        // 27.09.2026 (баг по прямому указанию — "анимация прелоадера играет пару раз и гаснет,
        // хотя данные ещё грузятся"): сигнализируем index.js, что прелоадер реально скрыт —
        // плашка версии в углу экрана (window._onPreloaderHidden) не должна быть видна раньше.
        if(typeof window._onPreloaderHidden === 'function') window._onPreloaderHidden();
    }

    // 27.09.2026 (баг по прямому указанию — "анимация прелоадера играет пару раз и после этого
    // гаснет, появляется чёрный экран, хотя данные могут ещё грузиться"): раньше по истечении
    // 30с этот таймер ПРИНУДИТЕЛЬНО вызывал _remove() независимо от _gameDone — на медленной
    // сети (VK-вебвью, полная цепочка: getServerTime → links.json → security.getToken →
    // donuts.json → friends.get/getAppUsers → users.get → endLoadGame → ~300 текстур +
    // 16 фоновых модулей, см. game-boot.js) реальная загрузка легко превышает 30с. Ролик короче
    // этого — он успевал отыграть цикл несколько раз ("пара раз"), затем таймер обрывал видео
    // ДО готовности игры → пустой чёрный экран (body/vid background:#000), пока игра всё ещё
    // грузится. Требование прямого указания: прелоадер должен крутиться в бесконечном цикле и
    // скрываться ТОЛЬКО когда данные реально готовы — никакого стороннего условия остановки.
    // Поэтому таймер больше НЕ убирает прелоадер — только пишет диагностику в консоль (видна
    // локально при window.debug_mode=true, см. index.js), сам цикл 'ended' продолжает работать.
    const _failsafeTid = setTimeout(() => {
        console.warn('[preloader-video] загрузка идёт дольше 30с — ролик продолжает крутиться в цикле, ждём реальной готовности игры (не убираем прелоадер по таймеру)');
    }, 30000);

    vid.addEventListener('ended', () => {
        if(_gameDone){
            console.log('[preloader-video] игра готова, ролик отыгран целиком — убираем прелоадер');
            _remove();
            return;
        }
        console.log('[preloader-video] клип отыгран целиком, игра ещё грузится — повторяем ролик (loop)');
        vid.currentTime = 0;
        vid.play().catch(() => {});
    });
    vid.addEventListener('error', () => { _remove(); });
    vid.play().catch(() => {});
    console.log('[preloader-video] запущено воспроизведение preloader.mp4');
}

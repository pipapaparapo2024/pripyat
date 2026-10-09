/** Визуал загрузочного экрана — Spine-анимация (Preloader.atlas/.webp + preloader.json,
 * ./spine/) на весь экран, ЗАЦИКЛЕНО повторяется, пока игра не готова; убирается СРАЗУ по
 * сигналу готовности (window._preloaderVisualReady()), не дожидаясь границы цикла анимации.
 *
 * 08.10.2026 (по прямому указанию — "замени прелоадер на новый, который тебе скинули, не
 * зацикливай старый"): раньше здесь крутилось video (preloader.mp4, FLA-рендер зомби). 22.09.2026
 * пользователь уже пробовал Spine-вариант и попросил вернуть видео — но 08.10.2026 прислал
 * НОВУЮ Spine-анимацию прелоадера и прямо попросил использовать именно её. Видео-ветка убрана
 * целиком (как раньше убирали Spine-ветку — тот же принцип, не держать обе параллельно).
 *
 * Контракт с остальным кодом НЕ изменился:
 * - window._preloaderVisualReady() (переименован из _preloaderVideoReady — это больше не видео)
 *   вызывается из game-boot.js, когда игра реально готова к показу.
 * - window._onPreloaderHidden() дёргается в момент реального скрытия (плашка версии и т.п.
 *   ждут именно этого, не факта готовности игры — см. index.js).
 * - 30-секундный таймер НИЧЕГО не обрывает принудительно (только предупреждение в консоль) —
 *   тот же баг-класс, что чинили 27.09.2026 для видео: VK-вебвью легко грузится дольше 30с
 *   (getServerTime → links.json → security.getToken → donuts.json → users.get → endLoadGame →
 *   ~300 текстур + 16 фоновых модулей, см. game-boot.js), а полотно должно крутиться, пока
 *   игра реально не готова — никакого стороннего условия остановки.
 */

const SPINE_DIR = './spine/';

// Координаты/масштаб — 08.10.2026, ВТОРОЙ экспорт прелоадера (Preloader (2).zip, по прямому
// указанию "ставь в тест"). В отличие от первого экспорта (который содержал только персонажа —
// фон приходилось временно подставлять отдельной статичной картинкой, см. историю правок в
// git/памяти), этот экспорт несёт СОБСТВЕННЫЙ фон прямо внутри скелета: слот 'back' (bone=root,
// drawOrder[0] — самый нижний, т.е. задний план) и слот 'back_front' (тот же bone=root, но
// drawOrder ПОСЛЕ персонажа — полупрозрачный передний слой/виньетка поверх него). Отдельная
// статичная подложка (_composite.png.webp) больше не нужна и убрана — теперь дублировала бы
// фон, который уже рисует сам renderer.draw(skeleton).
//
// Расчёт RENDER_X/Y/SCALE — НЕ на глаз, а по точной геометрии слота 'back' из preloader.json:
//   bones: root{scaleX:0.3898,scaleY:0.3898}, back{parent:root} (без своего смещения/скейла)
//   skins.default.attachments.back.back: {x:110.92, y:640.67, scaleX:3.2337, scaleY:3.2337,
//                                          width:1280, height:720}
// Это region-attachment 1280×720 (ровно наш канвас), отцентрованный в (x,y) локальных единицах
// слота. Мировой центр = root.scale * (x,y) = 0.3898*(110.92,640.67) = (43.23, 249.73).
// Мировой размер = width*scaleX*root.scale × height*scaleY*root.scale = 1613.0×907.5 — то есть
// 'back' в мировых единицах больше нашего канваса в 1613/1280≈1.2602 раза (одинаково по обеим
// осям — счёт сходится, можно доверять). RENDER_SCALE = 1280/1613.0 = 0.7935 — именно тот
// масштаб, при котором 'back' встаёт 1:1 на весь канвас. Края back в мировых координатах:
// x:[-763.29, 849.75], y:[-204.03, 703.49] (центр ± половина размера) → при переводе левого
// края x в экранный 0 и верхнего (большего) y в экранный 0 получаем RENDER_X=606, RENDER_Y=558
// (проверено с обеих сторон прямоугольника — сходится до пикселя с учётом округления).
// Правило №6 по-прежнему в силе (не могу открыть игру вживую) — если после деплоя раскладка
// всё же не встанет ровно на весь экран, пришлите скриншот, поправлю точнее.
const RENDER_X = 606, RENDER_Y = 558, RENDER_SCALE = 0.7935;

export function startPreloaderVisual(){
    let _removed = false, _animId = null;

    // 08.10.2026 (баг найден по прямому репорту — "если загрузка прошла, прелоадер должен
    // заканчиваться, а не висеть чёрным экраном"): раньше здесь только выставлялся флаг
    // _gameDone, а реальное скрытие ждало события 'complete' от Spine AnimationState (границы
    // цикла анимации) — см. комментарий у listener'а ниже. Любая заминка внутри самого Spine-
    // рантайма (ошибка в update/apply/draw, которая каждый кадр ловится try/catch и просто
    // логируется в консоль, не останавливая цикл, НО и не давая времени реально продвигаться)
    // держала бы прелоадер на экране бесконечно, даже когда игра давно готова — дополнительная
    // и ничем не оправданная зависимость показа игры от исправности анимационного рантайма.
    // Прячем сразу же, как только сервер/клиент реально готовы — _remove() и так делает плавный
    // fade (opacity 0.5s), обрыв анимации на произвольном кадре цикла визуально не заметен.
    window._preloaderVisualReady = () => {
        console.log('[preloader-spine._preloaderVisualReady] игра готова — скрываем зацикленный Spine-прелоадер сразу');
        _remove();
    };

    const cv = document.createElement('canvas');
    cv.id = '_preloader_spine';
    cv.width = 1280; cv.height = 720;
    cv.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;background:#000;pointer-events:none;';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    if(!ctx){
        console.error('[preloader-spine] ОШИБКА: getContext("2d") вернул null — канвас не поддерживается, скрываем сразу');
        _remove();
        return;
    }

    function _resizeCanvas(){
        // Letterbox-вписывание 1280×720 в экран — тот же принцип, что у основного PIXI-канваса
        // (index.js.resize()), чтобы персонаж не растягивался и не обрезался непропорционально.
        const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
        const w = 1280 * scale, h = 720 * scale;
        cv.style.width = w + 'px';
        cv.style.height = h + 'px';
        cv.style.left = ((window.innerWidth - w) / 2) + 'px';
        cv.style.top = ((window.innerHeight - h) / 2) + 'px';
    }
    window.addEventListener('resize', _resizeCanvas);
    _resizeCanvas();

    function _remove(){
        if(_removed) return;
        _removed = true;
        clearTimeout(_failsafeTid);
        if(_animId) cancelAnimationFrame(_animId);
        cv.style.transition = 'opacity 0.5s';
        cv.style.opacity = '0';
        setTimeout(() => { try{ cv.remove(); }catch(e){} }, 550);
        // 27.09.2026 (изначально про видео, тот же принцип переносится сюда): сигнализируем
        // index.js, что прелоадер реально скрыт — плашка версии в углу экрана
        // (window._onPreloaderHidden) не должна быть видна раньше.
        if(typeof window._onPreloaderHidden === 'function') window._onPreloaderHidden();
    }

    const _failsafeTid = setTimeout(() => {
        console.warn('[preloader-spine] загрузка идёт дольше 30с — анимация продолжает крутиться в цикле, ждём реальной готовности игры (не убираем прелоадер по таймеру)');
    }, 30000);

    function _load(){
        const sp = window.spine;
        if(!sp){
            console.error('[preloader-spine] ОШИБКА: window.spine не найден — libs/spine-canvas.js не загрузился, скрываем прелоадер (фолбэк — компас #_clo)');
            _remove();
            return;
        }
        fetch(SPINE_DIR + 'Preloader_v2.atlas')
            .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status + ' при загрузке atlas'); return r.text(); })
            .then(atlasText => {
                const atlas = new sp.TextureAtlas(atlasText);
                const texName = atlas.pages[0].name;
                console.log('[preloader-spine] atlas загружен и распарсен, текстура:', texName);

                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const offCv = document.createElement('canvas');
                    offCv.width = img.width; offCv.height = img.height;
                    const offCtx = offCv.getContext('2d');
                    if(!offCtx){
                        console.error('[preloader-spine] ОШИБКА: offscreen canvas getContext("2d") вернул null');
                        _remove();
                        return;
                    }
                    offCtx.drawImage(img, 0, 0);
                    atlas.pages[0].setTexture(new sp.CanvasTexture(offCv));
                    console.log('[preloader-spine] текстура загружена:', img.width + 'x' + img.height);

                    fetch(SPINE_DIR + 'preloader_v2.json')
                        .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status + ' при загрузке JSON'); return r.json(); })
                        .then(jsonData => {
                            // IK-таймлайны несовместимы с этим runtime (см. spine-boss.js — та же чистка).
                            if(jsonData.animations) Object.values(jsonData.animations).forEach(a => { if(a.ik) delete a.ik; });

                            const loader = new sp.AtlasAttachmentLoader(atlas);
                            const skelJson = new sp.SkeletonJson(loader);
                            skelJson.scale = 1;
                            const skelData = skelJson.readSkeletonData(jsonData);
                            const animName = skelData.animations[0] ? skelData.animations[0].name : 'animation';
                            console.log('[preloader-spine] JSON загружен: костей=' + skelData.bones.length +
                                ', анимаций=' + skelData.animations.map(a => a.name).join(',') + ', используем "' + animName + '"');

                            const skeleton = new sp.Skeleton(skelData);
                            if(skeleton.setupPose) skeleton.setupPose();

                            const stateData = new sp.AnimationStateData(skelData);
                            const state = new sp.AnimationState(stateData);
                            state.setAnimation(0, animName, true);

                            const renderer = new sp.SkeletonRenderer(ctx);
                            renderer.triangleRendering = true;

                            console.log('[preloader-spine] загрузка завершена, запускаем render loop');
                            _startLoop(skeleton, state, renderer);
                        })
                        .catch(e => {
                            console.error('[preloader-spine] ОШИБКА загрузки/парсинга JSON:', e.message, '| URL:', SPINE_DIR + 'preloader_v2.json');
                            _remove();
                        });
                };
                img.onerror = () => {
                    console.error('[preloader-spine] ОШИБКА загрузки текстуры:', SPINE_DIR + texName);
                    _remove();
                };
                img.src = SPINE_DIR + texName;
            })
            .catch(e => {
                console.error('[preloader-spine] ОШИБКА загрузки atlas:', e.message, '| URL:', SPINE_DIR + 'Preloader_v2.atlas');
                _remove();
            });
    }

    let _lastTs = 0;
    function _startLoop(skeleton, state, renderer){
        _lastTs = performance.now();
        const tick = (ts) => {
            if(_removed) return;
            _animId = requestAnimationFrame(tick);
            const delta = Math.min((ts - _lastTs) / 1000, 0.05);
            _lastTs = ts;

            try {
                state.update(delta);
                state.apply(skeleton);
                if(skeleton.update) skeleton.update(delta);
                skeleton.updateWorldTransform(window.spine.Physics ? window.spine.Physics.update : 2);
            } catch(e){
                console.error('[preloader-spine] ОШИБКА update/apply/worldTransform:', e.message);
            }

            // Фон теперь рисует сам скелет (слот 'back', см. комментарий у RENDER_X/Y/SCALE
            // выше) — clearRect нужен только чтобы стереть предыдущий кадр перед перерисовкой.
            ctx.clearRect(0, 0, 1280, 720);
            ctx.save();
            ctx.translate(RENDER_X, RENDER_Y);
            ctx.scale(RENDER_SCALE, -RENDER_SCALE); // Spine Y-up → Canvas Y-down
            try {
                renderer.draw(skeleton);
            } catch(e){
                console.error('[preloader-spine] ОШИБКА renderer.draw:', e.message);
            }
            ctx.restore();
        };
        _animId = requestAnimationFrame(tick);
    }

    _load();
    console.log('[preloader-spine] запущена загрузка Spine-прелоадера');
}

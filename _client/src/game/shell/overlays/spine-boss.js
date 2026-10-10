/** Spine-анимация боссов поверх фона боевого экрана.
 *
 * 08.10.2026 (по прямому указанию — "анимация должна быть поверх заднего фона, но ниже всех
 * остальных файлов (иконки оружия, тултипы и т.п.)", плюс баг-репорт "тултип оружия был ПОД
 * анимацией"): раньше анимация рисовалась в ОТДЕЛЬНЫЙ DOM-канвас (<canvas> поверх document.body,
 * CSS z-index:50) — целиком НАД или ПОД всей PIXI-сценой разом, т.к. CSS z-index не может
 * воткнуть один DOM-элемент МЕЖДУ двумя слоями внутри одного PIXI-канваса (background и UI —
 * оба просто пиксели одного и того же <canvas id="stage">). Решение: Spine рисуется в offscreen-
 * канвас, который используется как источник обычной PIXI.Texture — сам Spine-"персонаж" теперь
 * ОБЫЧНЫЙ PIXI.Sprite внутри _bossFightWin, вставленный сразу после фона (bg) и до любого другого
 * UI (см. bosses_fight.js._buildBossesFight → _spineBossMount(win), вызывается сразу после
 * win.addChild(bg)). Обычный PIXI z-order (addChild/addChildAt) решает и "поверх фона", и "под
 * оружием/тултипами/всем остальным" одним и тем же механизмом, без отдельных DOM-трюков и без
 * хрупких "кто сейчас сверху" проверок (раньше здесь была проверка "overlay виден, только если
 * _bossFightWin — последний ребёнок layer2_mc", которая ломалась от HUD, переставляемого наверх
 * при каждом открытии любого экрана — весь этот класс бага отпадает вместе с DOM-подходом).
 */

const SPINE_DIR = './images/spine/';

// Конфиги per-boss: null = нет Spine-анимации (используется статика)
// tex НЕ указывать — имя текстуры читается автоматически из первой строки .atlas файла
//
// 08.10.2026 (по прямому указанию — "включи всю анимацию, поставь для каждого босса свою,
// будем тестировать на тестовом домене"): Spine включён для боссов 0-3. x/y/scale — ТЕ ЖЕ
// координаты 1280×720-канваса, что и раньше (сам DOM→PIXI переход ничего не меняет в системе
// координат — тот же offscreen-канвас 1280×720, та же математика translate/scale).
//
// 08.10.2026 (взрыв Счастливчика всё ещё не появлялся после первой попытки — разобран JSON
// lucky_explosion.json покадрово, найдена архитектурная причина): это НЕ короткий одноразовый
// эффект, который можно "запустить в момент броска" — это ПОЛНАЯ параллельная дорожка, синхро-
// низированная с ТЕМ ЖЕ циклом, что и основной 'animation' в lucky.json. Доказательство по
// таймлайнам слотов lucky_explosion.json:
//   слот 'granata2' (граната в полёте)   — attachment появляется t=8.5333, исчезает t=8.9667
//   слот 'boom1' (кадры взрыва 00000-60) — attachment появляется t=8.9333, rgba гаснет к t=9.9333
//   кость 'granata2' (translate/rotate)  — кейфреймы t=5.3667..10.2333 (тот же виток, что и бросок
//                                           в lucky.json: t=8.5333 там же, где граната пропадает
//                                           из руки персонажа)
// т.е. всё НУЖНОЕ для синхронизации уже встроено в собственные таймлайны скелета — если просто
// держать его AnimationState в ТОЧНОЙ синхронизации по времени с основным персонажем (loop:true,
// общие часы), эффект появится и исчезнет САМ, когда положено, без какого-либо "триггера".
// Предыдущая реализация (trackTime от 0, одноразовый setAnimation(loop:false) по условию
// "пересекли throwTime") была неверной моделью — перезапускала взрыв с НУЛЯ в момент, когда
// граната пропадает у основного персонажа, а видимый контент в самой explosion-анимации
// начинается лишь на 8.53с ПОЗЖЕ старта её собственного трека — поэтому вспышка оказывалась
// на ~8.5с позже настоящего броска и чаще всего не успевала попасться в тот же виток показа.
//
// Исправление — общие часы, без триггера: entry.loopElapsed (уже считался как позиция внутри
// цикла ОСНОВНОГО персонажа) используется как ЕДИНЫЙ источник времени для ОБОИХ скелетов.
// Для взрыва это делается НАПРЯМУЮ через `trackEntry.trackTime = entry.loopElapsed` (Spine
// public API, см. spine-canvas.js: TrackEntry.getAnimationTime() = trackTime % duration при
// loop=true) — а не через `state.update(delta)` с отдельным накапливаемым счётчиком. Это же
// попутно снимает риск рассинхрона: у lucky.json реальная длина цикла (макс. time среди ВСЕХ
// таймлайнов) — 10.6667с, у lucky_explosion.json — 10.2333с (другая!) — при независимом
// накоплении через update(delta) они бы медленно расходились по фазе; при прямой установке
// trackTime от ОДНИХ часов расхождения нет никогда (Spine сам берёт по модулю СВОЕЙ duration).
//
// Позиция/масштаб взрыва: у lucky.json корневая кость имеет 'scaleX'/'scaleY'=0.3898 (запечённый
// масштаб персонажа, Spine применяет его САМ при updateWorldTransform — cfg.scale=0.40 ниже это
// ДОПОЛНИТЕЛЬНЫЙ множитель поверх), а у lucky_explosion.json корневая кость БЕЗ scale (=1.0 по
// умолчанию) — тот же cfg.scale=0.40 дал бы персонаж/взрыв разного эффективного размера и сильно
// не туда по месту.
//
// 10.10.2026 (пользователь прислал скриншот боя — взрыв на экране выглядел "разбросанным",
// облако дыма/огня занимало большую часть кадра при cfg.scale=1.0 "натурального размера"):
// разобран lucky_explosion.json покадрово ещё раз — у кости 'root' правда нет запечённого
// scale, НО у кости 'boom' (та самая, что несёт кадры взрыва boom1) ЕСТЬ СВОЙ собственный
// запечённый scale-таймлайн внутри самой анимации: ~3.614..3.661 (то есть кадр взрыва и без
// cfg.scale уже увеличен Spine'ом в ~3.6 раза относительно исходных 372×372px кадра). Плюс у
// этой же кости translate доходит до y≈1216 (почти вдвое больше высоты канваса 720px), у кости
// 'granata2' — x: -29..528, y: -514..771. Это и объясняет "разброс": при cfg.scale=1.0 кадр
// взрыва раздувается до ~1340×1340px и улетает далеко за границы кадра боя (1280×720).
// Итог: масштаб взрыва возвращён на 0.25 (как пользователь просил изначально, до запроса
// "натурального размера") — при этом множителе кадр ≈372×3.6×0.25≈335px, а максимальные
// смещения костей (~1216×0.25≈304px по Y, ~528×0.25≈132px по X от опорной точки) остаются
// внутри границ канваса 1280×720, без разброса за кадр. Позиция (680,673) не менялась.
const BOSS_SPINE = [
    { atlas: 'okhotnik.atlas',   json: 'okhotnik.json',
      x: 680, y: 673, scale: 0.40, anim: 'animation' },  // 0 — Охотник
    { atlas: 'lucky.atlas',      json: 'lucky.json',
      x: 680, y: 673, scale: 0.40, anim: 'animation',    // 1 — Счастливчик
      explosion: { atlas: 'lucky_explosion.atlas', json: 'lucky_explosion.json', anim: 'animation',
                   x: 680, y: 673, scale: 0.25 } },
    { atlas: 'yastreb.atlas',    json: 'yastreb.json',
      x: 680, y: 673, scale: 0.40, anim: 'animation' },  // 2 — Ястреб
    { atlas: 'mechennii.atlas',  json: 'mechennii.json',
      x: 680, y: 673, scale: 0.40, anim: 'animation' },  // 3 — Меченный
    null, null, null, null                               // 4-7 — пока без Spine (файлов нет)
];

export function attachSpineBoss(proto) {

    proto._spineBossInit = function() {
        if (this._spineOffCv) return;

        console.log('[spine-boss._spineBossInit] создаём offscreen-канвас 1280×720 + PIXI.Sprite-обёртку');
        const cv = document.createElement('canvas');
        cv.width  = 1280;
        cv.height = 720;
        this._spineOffCv = cv;
        this._spineCtx   = cv.getContext('2d');

        if (!this._spineCtx) {
            console.error('[spine-boss._spineBossInit] ОШИБКА: getContext("2d") вернул null — канвас не поддерживается');
            return;
        }

        this._spineTexture = PIXI.Texture.from(cv);
        this._spineSprite  = new PIXI.Sprite(this._spineTexture);
        this._spineSprite.visible = false;
        // Спрайт заполняет весь кадр боя (1280×720) — сам персонаж рисуется ВНУТРИ offscreen-
        // канваса своими translate/scale (см. tick() ниже), спрайт лишь выводит готовый кадр.
        this._spineSprite.width  = 1280;
        this._spineSprite.height = 720;

        this._spineCache = {}; // bossIdx → {skeleton, state, renderer, cfg, duration, loopElapsed, explosion?}
        this._spineAnimId = null;
        this._spineLastTs = 0;
        this._spineDrawCount = 0;
        console.log('[spine-boss._spineBossInit] инициализация завершена');
    };

    // Вызывается из _buildBossesFight() СРАЗУ после создания фона (win.addChild(bg)), ДО любого
    // другого UI — порядок addChild и есть Z-порядок в PIXI, поэтому место вызова здесь и решает
    // "анимация поверх фона, но под всем остальным" целиком.
    proto._spineBossMount = function(win) {
        this._spineBossInit();
        if (!this._spineSprite) return;
        win.addChild(this._spineSprite);
        console.log('[spine-boss._spineBossMount] спрайт вставлен в _bossFightWin, индекс=' + win.getChildIndex(this._spineSprite));
    };

    proto._spineBossShow = function(bossIdx) {
        console.log('[spine-boss._spineBossShow] bossIdx=' + bossIdx);
        this._spineBossInit();
        const cfg = BOSS_SPINE[bossIdx];
        if (!cfg) {
            console.log('[spine-boss._spineBossShow] boss ' + bossIdx + ' не имеет Spine-конфига — скрываем');
            this._spineBossHide();
            return;
        }

        // 08.10.2026 (по прямому требованию — "анимация запустилась, циклична, работает
        // постоянно, взаимодействия на экране боя (атака и т.п.) не должны её перезапускать"):
        // _spineBossShow() вызывается РОВНО один раз за открытие экрана боя (см.
        // bosses_fight.js._reallyOpenBossesFight, onComplete анимации открытия окна) — обычная
        // атака (_attackWithWeapon) её не трогает вовсе, только HP/статы/кнопки оружия. Этот
        // guard — защита на будущее: если _spineBossShow всё же позовут повторно для ТОГО ЖЕ
        // уже идущего босса, не трогаем ни кэш, ни render loop.
        if (this._spineBossIdx === bossIdx && this._spineCache[bossIdx] && this._spineSprite.visible) {
            console.log('[spine-boss._spineBossShow] уже показан и крутится для этого же босса — no-op');
            return;
        }
        console.log('[spine-boss._spineBossShow] cfg:', JSON.stringify(cfg));

        this._spineBossIdx = bossIdx;
        this._spineSprite.visible = true;
        console.log('[spine-boss._spineBossShow] sprite.visible=true');

        if (this._spineCache[bossIdx]) {
            console.log('[spine-boss._spineBossShow] скелет уже в кэше — запускаем loop');
            this._spineBossStartLoop();
        } else {
            console.log('[spine-boss._spineBossShow] скелет не в кэше — загружаем файлы');
            this._spineBossLoad(bossIdx, cfg);
        }
    };

    proto._spineBossHide = function() {
        console.log('[spine-boss._spineBossHide] скрываем спрайт');
        if (this._spineSprite) this._spineSprite.visible = false;
        if (this._spineAnimId) { cancelAnimationFrame(this._spineAnimId); this._spineAnimId = null; }
        if (this._spineCtx) this._spineCtx.clearRect(0, 0, 1280, 720);
        this._spineDrawCount = 0;
    };

    // 08.10.2026: вынесено из _spineBossLoad() в отдельный переиспользуемый загрузчик — нужен
    // ДВАЖДЫ на одного босса (основной персонаж + взрыв Счастливчика), раньше была одна копия
    // кода на главного персонажа. tag — префикс в логах, чтобы отличать, какой из двух грузится.
    proto._loadSpineSkeleton = function(tag, atlasPath, jsonPath, animName, onReady) {
        const sp = window.spine;
        if (!sp) {
            console.error('[spine-boss.' + tag + '] ОШИБКА: window.spine не найден — spine-canvas.js не загружен?');
            return;
        }
        console.log('[spine-boss.' + tag + '] 1/3 загружаем atlas: ' + atlasPath);

        fetch(atlasPath)
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' при загрузке atlas');
                return r.text();
            })
            .then(atlasText => {
                console.log('[spine-boss.' + tag + '] atlas загружен, символов:', atlasText.length);

                let atlas;
                try {
                    atlas = new sp.TextureAtlas(atlasText);
                } catch(e) {
                    console.error('[spine-boss.' + tag + '] ОШИБКА парсинга atlas:', e.message);
                    throw e;
                }
                console.log('[spine-boss.' + tag + '] atlas распарсен: страниц=' + atlas.pages.length + ', регионов=' + atlas.regions.length);

                const texName = atlas.pages[0].name;
                console.log('[spine-boss.' + tag + '] 2/3 загружаем текстуру: ' + texName + ' (из atlas.pages[0].name)');
                const texDir = atlasPath.slice(0, atlasPath.lastIndexOf('/') + 1);
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    console.log('[spine-boss.' + tag + '] текстура загружена:', img.width + 'x' + img.height);

                    const offCv = document.createElement('canvas');
                    offCv.width = img.width; offCv.height = img.height;
                    const offCtx = offCv.getContext('2d');
                    if (!offCtx) {
                        console.error('[spine-boss.' + tag + '] ОШИБКА: offscreen canvas getContext("2d") вернул null');
                        return;
                    }
                    offCtx.drawImage(img, 0, 0);

                    try {
                        const canvasTex = new sp.CanvasTexture(offCv);
                        atlas.pages[0].setTexture(canvasTex);
                        console.log('[spine-boss.' + tag + '] CanvasTexture установлена на page[0]');
                    } catch(e) {
                        console.error('[spine-boss.' + tag + '] ОШИБКА установки CanvasTexture:', e.message);
                        return;
                    }

                    console.log('[spine-boss.' + tag + '] 3/3 загружаем JSON: ' + jsonPath);
                    fetch(jsonPath)
                        .then(r => {
                            if (!r.ok) throw new Error('HTTP ' + r.status + ' при загрузке JSON');
                            return r.json();
                        })
                        .then(jsonData => {
                            const animNames = jsonData.animations ? Object.keys(jsonData.animations) : [];
                            console.log('[spine-boss.' + tag + '] JSON загружен: костей=' + (jsonData.bones ? jsonData.bones.length : 0) +
                                ', слотов=' + (jsonData.slots ? jsonData.slots.length : 0) +
                                ', анимаций=' + animNames.join(','));

                            animNames.forEach(name => {
                                const anim = jsonData.animations[name];
                                if (anim.ik) {
                                    console.warn('[spine-boss.' + tag + '] анимация "' + name + '" содержит IK-таймлайны — удаляем (runtime несовместим)');
                                    delete anim.ik;
                                }
                            });

                            let skelData, skeleton, state;
                            try {
                                const loader   = new sp.AtlasAttachmentLoader(atlas);
                                const skelJson = new sp.SkeletonJson(loader);
                                skelJson.scale = 1;
                                skelData = skelJson.readSkeletonData(jsonData);
                                console.log('[spine-boss.' + tag + '] readSkeletonData OK: ' +
                                    skelData.bones.length + ' костей, ' + skelData.animations.length + ' анимаций');
                            } catch(e) {
                                console.error('[spine-boss.' + tag + '] ОШИБКА readSkeletonData:', e.message, e.stack);
                                return;
                            }

                            try {
                                skeleton = new sp.Skeleton(skelData);
                                if (skeleton.setupPose) skeleton.setupPose();
                            } catch(e) {
                                console.error('[spine-boss.' + tag + '] ОШИБКА создания Skeleton:', e.message, e.stack);
                                return;
                            }

                            let trackEntry;
                            try {
                                const stateData = new sp.AnimationStateData(skelData);
                                state = new sp.AnimationState(stateData);
                                trackEntry = state.setAnimation(0, animName, true);
                                console.log('[spine-boss.' + tag + '] AnimationState создан, анимация "' + animName + '" запущена' +
                                    (trackEntry ? ' (duration=' + trackEntry.animation.duration.toFixed(2) + 'с)' : ' ВНИМАНИЕ: trackEntry=null'));
                            } catch(e) {
                                console.error('[spine-boss.' + tag + '] ОШИБКА AnimationState/setAnimation:', e.message);
                                console.error('  Доступные анимации:', skelData.animations.map(a => a.name).join(', '));
                                return;
                            }

                            const renderer = new sp.SkeletonRenderer(this._spineCtx);
                            renderer.triangleRendering = true;
                            console.log('[spine-boss.' + tag + '] ✓ загрузка завершена');

                            onReady({ skeleton, state, renderer, trackEntry, duration: trackEntry ? trackEntry.animation.duration : 0 });
                        })
                        .catch(e => {
                            console.error('[spine-boss.' + tag + '] ОШИБКА загрузки/парсинга JSON:', e.message, '| URL:', jsonPath, '| Стек:', e.stack);
                        });
                };
                img.onerror = () => {
                    console.error('[spine-boss.' + tag + '] ОШИБКА загрузки текстуры:', texDir + texName);
                };
                img.src = texDir + texName;
            })
            .catch(e => {
                console.error('[spine-boss.' + tag + '] ОШИБКА загрузки atlas:', e.message, '| URL:', atlasPath);
            });
    };

    proto._spineBossLoad = function(bossIdx, cfg) {
        console.log('[spine-boss._spineBossLoad] начинаем загрузку boss=' + bossIdx);
        this._loadSpineSkeleton(
            'main(boss' + bossIdx + ')', SPINE_DIR + cfg.atlas, SPINE_DIR + cfg.json, cfg.anim,
            (loaded) => {
                this._spineCache[bossIdx] = { ...loaded, cfg, loopElapsed: 0 };
                console.log('[spine-boss._spineBossLoad] ✓ boss=' + bossIdx + ' в кэше, duration=' + loaded.duration.toFixed(2) + 'с');

                if (this._spineBossIdx === bossIdx && this._spineSprite.visible) {
                    this._spineBossStartLoop();
                } else {
                    console.warn('[spine-boss._spineBossLoad] loop НЕ запущен: bossIdx=' + this._spineBossIdx +
                        ' (ожидался ' + bossIdx + '), visible=' + this._spineSprite.visible);
                }

                // Взрыв (если задан для этого босса) грузится ПАРАЛЛЕЛЬНО, отдельно от основного
                // персонажа — не блокирует его появление, если вдруг не загрузится/ошибётся.
                if (cfg.explosion) {
                    const ecfg = cfg.explosion;
                    this._loadSpineSkeleton(
                        'explosion(boss' + bossIdx + ')', SPINE_DIR + ecfg.atlas, SPINE_DIR + ecfg.json, ecfg.anim,
                        (eLoaded) => {
                            const entry = this._spineCache[bossIdx];
                            if (!entry) return; // бой уже закрыли/ушли с экрана
                            entry.explosion = { ...eLoaded, cfg: ecfg };
                            console.log('[spine-boss._spineBossLoad] ✓ explosion(boss' + bossIdx + ') в кэше, duration=' + eLoaded.duration.toFixed(2) + 'с');
                        }
                    );
                }
            }
        );
    };

    // 08.10.2026 (по прямому указанию — "анимация босса появляется с задержкой ~0.5с при входе
    // в бой, пусть грузится заранее, пока крутится прелоадер"): вызывается ОДИН раз из
    // game-boot.js, пока игрок ещё смотрит на загрузочный экран — грузит и парсит ВСЕ 4
    // Spine-скелета (+ взрыв Счастливчика) заранее в this._spineCache, той же функцией
    // _loadSpineSkeleton(), что и обычный ленивый путь. В отличие от _spineBossLoad() — НЕ
    // стартует render loop и не трогает this._spineBossIdx/sprite.visible (бой ещё не открыт);
    // _spineBossShow() при реальном входе в бой увидит уже готовый this._spineCache[bossIdx] и
    // сразу перейдёт на ветку "скелет уже в кэше" без сетевого похода.
    proto._spineBossPreloadAll = function() {
        this._spineBossInit();
        console.log('[spine-boss._spineBossPreloadAll] предзагрузка всех Spine-боссов во время загрузочного экрана');
        BOSS_SPINE.forEach((cfg, bossIdx) => {
            if (!cfg || this._spineCache[bossIdx]) return;
            this._loadSpineSkeleton(
                'preload(boss' + bossIdx + ')', SPINE_DIR + cfg.atlas, SPINE_DIR + cfg.json, cfg.anim,
                (loaded) => {
                    this._spineCache[bossIdx] = { ...loaded, cfg, loopElapsed: 0 };
                    console.log('[spine-boss._spineBossPreloadAll] ✓ boss=' + bossIdx + ' предзагружен');

                    if (cfg.explosion) {
                        const ecfg = cfg.explosion;
                        this._loadSpineSkeleton(
                            'preload-explosion(boss' + bossIdx + ')', SPINE_DIR + ecfg.atlas, SPINE_DIR + ecfg.json, ecfg.anim,
                            (eLoaded) => {
                                const entry = this._spineCache[bossIdx];
                                if (!entry) return;
                                entry.explosion = { ...eLoaded, cfg: ecfg };
                                console.log('[spine-boss._spineBossPreloadAll] ✓ explosion(boss' + bossIdx + ') предзагружен');
                            }
                        );
                    }
                }
            );
        });
    };

    proto._spineBossStartLoop = function() {
        if (this._spineAnimId) cancelAnimationFrame(this._spineAnimId);
        this._spineLastTs = performance.now();
        this._spineDrawCount = 0;
        console.log('[spine-boss._spineBossStartLoop] запускаем render loop для boss=' + this._spineBossIdx);

        const entry = this._spineCache[this._spineBossIdx];
        if (!entry) {
            console.error('[spine-boss._spineBossStartLoop] ОШИБКА: нет данных в кэше для boss=' + this._spineBossIdx);
            return;
        }
        console.log('[spine-boss._spineBossStartLoop] рендер в точку x=' + entry.cfg.x + ' y=' + entry.cfg.y + ' scale=' + entry.cfg.scale);

        const tick = (ts) => {
            if (!this._spineSprite || !this._spineSprite.visible) {
                console.log('[spine-boss.tick] спрайт скрыт — останавливаем loop после ' + this._spineDrawCount + ' кадров');
                return;
            }
            this._spineAnimId = requestAnimationFrame(tick);

            const entry = this._spineCache[this._spineBossIdx];
            if (!entry) {
                console.warn('[spine-boss.tick] нет entry в кэше для boss=' + this._spineBossIdx);
                return;
            }

            const { skeleton, state, renderer, cfg } = entry;
            const delta = Math.min((ts - this._spineLastTs) / 1000, 0.05);
            this._spineLastTs = ts;

            try {
                state.update(delta);
                state.apply(skeleton);
                if (skeleton.update) skeleton.update(delta);
                skeleton.updateWorldTransform(window.spine.Physics ? window.spine.Physics.update : 2);
            } catch(e) {
                console.error('[spine-boss.tick] ОШИБКА update/apply/worldTransform:', e.message, e.stack);
            }

            const ctx = this._spineCtx;
            ctx.clearRect(0, 0, 1280, 720);
            ctx.save();
            ctx.translate(cfg.x, cfg.y);
            ctx.scale(cfg.scale, -cfg.scale); // Spine Y-up → Canvas Y-down
            try {
                renderer.draw(skeleton);
            } catch(e) {
                console.error('[spine-boss.tick] ОШИБКА renderer.draw:', e.message, e.stack);
            }
            ctx.restore();

            // 08.10.2026 (переписано — см. большой комментарий у BOSS_SPINE/explosion выше):
            // взрыв — НЕ одноразовый эффект по триггеру, а полная параллельная дорожка,
            // синхронизированная с ОСНОВНЫМ персонажем по ОДНИМ часам (entry.loopElapsed —
            // позиция внутри цикла основного 'animation'). Никакого setAnimation()/
            // "playing"-флага на каждый бросок — explosion.trackEntry один раз создан с
            // loop:true при загрузке, а его trackTime выставляется НАПРЯМУЮ от loopElapsed
            // каждый кадр (TrackEntry.getAnimationTime() = trackTime % duration — Spine сам
            // возьмёт по модулю СВОЕЙ длины цикла, даже если она короче, чем у основного
            // скелета, без накопления рассинхрона). Собственные таймлайны взрыва сами решают,
            // когда что-то видно (боевых "if видно/не видно" здесь не нужно) — рисуем каждый
            // кадр, пустые атаченты просто ничего не выведут на экран.
            if (entry.explosion && entry.duration > 0) {
                entry.loopElapsed += delta;
                if (entry.loopElapsed >= entry.duration) entry.loopElapsed -= entry.duration;

                const ex = entry.explosion;
                const ecfg = ex.cfg;
                if (ex.trackEntry) {
                    ex.trackEntry.trackTime = entry.loopElapsed;
                    try {
                        ex.state.apply(ex.skeleton);
                        if (ex.skeleton.update) ex.skeleton.update(delta);
                        ex.skeleton.updateWorldTransform(window.spine.Physics ? window.spine.Physics.update : 2);
                    } catch(e) {
                        console.error('[spine-boss.tick] ОШИБКА apply взрыва:', e.message);
                    }
                    ctx.save();
                    ctx.translate(ecfg.x, ecfg.y);
                    ctx.scale(ecfg.scale, -ecfg.scale);
                    try {
                        ex.renderer.draw(ex.skeleton);
                    } catch(e) {
                        console.error('[spine-boss.tick] ОШИБКА renderer.draw взрыва:', e.message);
                    }
                    ctx.restore();
                }
            }

            // Канвас — источник обычной PIXI.Texture (CanvasResource), GPU не видит новые
            // пиксели, пока явно не попросить переслать их — .update() делает это каждый кадр.
            if (this._spineTexture) this._spineTexture.update();

            this._spineDrawCount++;
            // Подробный лог: первые 3 кадра, затем каждые 60 (для быстрой диагностики размера)
            if (this._spineDrawCount <= 3 || this._spineDrawCount % 60 === 0) {
                const rootBone = skeleton.bones[0];
                console.log('[spine-boss.tick] кадр #' + this._spineDrawCount +
                    ' delta=' + (delta * 1000).toFixed(1) + 'ms' +
                    ' cfg=(x=' + cfg.x + ',y=' + cfg.y + ',scale=' + cfg.scale + ')' +
                    (entry.explosion ? ' loopElapsed=' + entry.loopElapsed.toFixed(2) + 's' : ''));

                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                skeleton.bones.forEach(bone => {
                    const b = bone.appliedPose;
                    if (b.worldX !== undefined) {
                        minX = Math.min(minX, b.worldX);
                        maxX = Math.max(maxX, b.worldX);
                        minY = Math.min(minY, b.worldY);
                        maxY = Math.max(maxY, b.worldY);
                    }
                });
                if (isFinite(minX)) {
                    const scrL = Math.round(cfg.x + minX * cfg.scale);
                    const scrR = Math.round(cfg.x + maxX * cfg.scale);
                    const scrT = Math.round(cfg.y - maxY * cfg.scale);
                    const scrB = Math.round(cfg.y - minY * cfg.scale);
                    console.log('[spine-boss.tick] ─ BBOX НА ЭКРАНЕ (1280×720):' +
                        ' X=[' + scrL + '..' + scrR + '] Y=[' + scrT + '..' + scrB + ']' +
                        ' | ширина=' + (scrR - scrL) + 'px высота=' + (scrB - scrT) + 'px');
                    if (scrT < 0)   console.warn('[spine-boss.tick] ВНИМАНИЕ: верхушка персонажа обрезана — scrT=' + scrT + ' (за краем канваса)');
                    if (scrB > 720) console.warn('[spine-boss.tick] ВНИМАНИЕ: нижняя часть обрезана — scrB=' + scrB + ' (за краем 720px)');
                }
            }
        };
        this._spineAnimId = requestAnimationFrame(tick);
    };
}

/** Spine-анимация боссов поверх PixiJS-канваса (отдельный 2D-канвас-оверлей). */

const SPINE_DIR = './images/spine/';

// Конфиги per-boss: null = нет Spine-анимации (используется статика)
// tex НЕ указывать — имя текстуры читается автоматически из первой строки .atlas файла
const BOSS_SPINE = [
    // { atlas: 'okhotnik.atlas', json: 'okhotnik.json',
    //   x: 680, y: 673, scale: 0.40, anim: 'animation' },  // 0 — Охотник (скрыта до решения z-order)
    null, null, null, null, null, null, null, null          // 0-7 — пока без Spine
];

export function attachSpineBoss(proto) {

    proto._spineBossInit = function() {
        if (this._spineCv) return;

        console.log('[spine-boss._spineBossInit] создаём overlay-канвас 1280×720, z-index:50, clip-path до y=620 (86.1%)');
        const cv = document.createElement('canvas');
        cv.id = '_spine_boss';
        cv.width  = 1280;
        cv.height = 720;
        // clip-path: показываем только верхние 86.1% (до y=620 из 720) — панель оружия внизу не перекрывается
        cv.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:50;display:none;clip-path:polygon(0 0,100% 0,100% 86.1%,0 86.1%);';
        document.body.appendChild(cv);
        this._spineCv  = cv;
        this._spineCtx = cv.getContext('2d');

        if (!this._spineCtx) {
            console.error('[spine-boss._spineBossInit] ОШИБКА: getContext("2d") вернул null — канвас не поддерживается');
            return;
        }
        console.log('[spine-boss._spineBossInit] 2D-контекст получен OK');

        // Синхронизация с PIXI-канвасом (CSS размеры и позиция)
        this._spineSyncFn = () => {
            const pv = document.getElementById('stage');
            if (!pv) {
                console.warn('[spine-boss._spineSyncFn] PIXI-канвас #stage не найден в DOM');
                return;
            }
            const prevLeft = cv.style.left;
            cv.style.width  = pv.style.width;
            cv.style.height = pv.style.height;
            cv.style.left   = pv.style.left;
            cv.style.top    = pv.style.top;
            if (prevLeft !== cv.style.left) {
                console.log('[spine-boss._spineSyncFn] позиция overlay синхронизирована:',
                    'left=' + cv.style.left, 'top=' + cv.style.top,
                    'width=' + cv.style.width, 'height=' + cv.style.height);
            }
        };
        window.addEventListener('resize', this._spineSyncFn);
        this._spineSyncFn();

        this._spineCache = {}; // bossIdx → {skeleton, state, renderer}
        this._spineAnimId = null;
        this._spineLastTs = 0;
        this._spineDrawCount = 0;
        console.log('[spine-boss._spineBossInit] инициализация завершена');
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
        console.log('[spine-boss._spineBossShow] cfg:', JSON.stringify(cfg));

        this._spineSyncFn();
        this._spineCv.style.display = 'block';
        console.log('[spine-boss._spineBossShow] overlay display=block, размер: ' + this._spineCv.style.width + 'x' + this._spineCv.style.height);
        this._spineBossIdx = bossIdx;

        if (this._spineCache[bossIdx]) {
            console.log('[spine-boss._spineBossShow] скелет уже в кэше — запускаем loop');
            this._spineBossStartLoop();
        } else {
            console.log('[spine-boss._spineBossShow] скелет не в кэше — загружаем файлы');
            this._spineBossLoad(bossIdx, cfg);
        }
    };

    proto._spineBossHide = function() {
        console.log('[spine-boss._spineBossHide] скрываем overlay');
        if (this._spineCv) this._spineCv.style.display = 'none';
        if (this._spineAnimId) { cancelAnimationFrame(this._spineAnimId); this._spineAnimId = null; }
        if (this._spineCtx) this._spineCtx.clearRect(0, 0, 1280, 720);
        this._spineDrawCount = 0;
    };

    proto._spineBossLoad = function(bossIdx, cfg) {
        const sp = window.spine;
        if (!sp) {
            console.error('[spine-boss._spineBossLoad] ОШИБКА: window.spine не найден — spine-canvas.js не загружен?');
            return;
        }
        console.log('[spine-boss._spineBossLoad] spine runtime найден, начинаем загрузку boss=' + bossIdx);
        console.log('[spine-boss._spineBossLoad] 1/3 загружаем atlas: ' + SPINE_DIR + cfg.atlas);

        fetch(SPINE_DIR + cfg.atlas)
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' при загрузке atlas');
                return r.text();
            })
            .then(atlasText => {
                console.log('[spine-boss._spineBossLoad] atlas загружен, символов:', atlasText.length);

                let atlas;
                try {
                    atlas = new sp.TextureAtlas(atlasText);
                } catch(e) {
                    console.error('[spine-boss._spineBossLoad] ОШИБКА парсинга atlas:', e.message);
                    throw e;
                }
                console.log('[spine-boss._spineBossLoad] atlas распарсен: страниц=' + atlas.pages.length + ', регионов=' + atlas.regions.length);
                atlas.pages.forEach((p, i) => console.log('  page[' + i + '] name=' + p.name + ' size=' + p.width + 'x' + p.height));

                // Имя текстуры берём из атласа (строка 1) — не захардкожено
                const texName = atlas.pages[0].name;
                console.log('[spine-boss._spineBossLoad] 2/3 загружаем текстуру: ' + SPINE_DIR + texName + ' (из atlas.pages[0].name)');
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    console.log('[spine-boss._spineBossLoad] текстура загружена:', img.width + 'x' + img.height, 'naturalWidth=' + img.naturalWidth);

                    const offCv = document.createElement('canvas');
                    offCv.width = img.width; offCv.height = img.height;
                    const offCtx = offCv.getContext('2d');
                    if (!offCtx) {
                        console.error('[spine-boss._spineBossLoad] ОШИБКА: offscreen canvas getContext("2d") вернул null');
                        return;
                    }
                    offCtx.drawImage(img, 0, 0);
                    console.log('[spine-boss._spineBossLoad] offscreen canvas создан: ' + offCv.width + 'x' + offCv.height);

                    try {
                        const canvasTex = new sp.CanvasTexture(offCv);
                        atlas.pages[0].setTexture(canvasTex);
                        console.log('[spine-boss._spineBossLoad] CanvasTexture установлена на page[0], регионов с текстурой: ' +
                            atlas.pages[0].regions.length);
                        atlas.pages[0].regions.forEach(r => console.log('  region "' + r.name + '" u=' + r.u.toFixed(3) + ' v=' + r.v.toFixed(3) + ' texture=' + (r.texture ? 'OK' : 'NULL')));
                    } catch(e) {
                        console.error('[spine-boss._spineBossLoad] ОШИБКА установки CanvasTexture:', e.message);
                        return;
                    }

                    console.log('[spine-boss._spineBossLoad] 3/3 загружаем JSON: ' + SPINE_DIR + cfg.json);
                    fetch(SPINE_DIR + cfg.json)
                        .then(r => {
                            if (!r.ok) throw new Error('HTTP ' + r.status + ' при загрузке JSON');
                            return r.json();
                        })
                        .then(jsonData => {
                            const skelVer = jsonData.skeleton ? jsonData.skeleton.spine : '?';
                            const boneCount = jsonData.bones ? jsonData.bones.length : 0;
                            const slotCount = jsonData.slots ? jsonData.slots.length : 0;
                            const animNames = jsonData.animations ? Object.keys(jsonData.animations) : [];
                            const constraintCount = jsonData.constraints ? jsonData.constraints.length : 0;
                            console.log('[spine-boss._spineBossLoad] JSON загружен: Spine v' + skelVer +
                                ', костей=' + boneCount + ', слотов=' + slotCount +
                                ', констрейнтов=' + constraintCount + ', анимаций=' + animNames.join(','));

                            // Проверяем IK-констрейнты в секции constraints
                            if (jsonData.constraints) {
                                jsonData.constraints.forEach((c, i) => {
                                    console.log('  constraint[' + i + '] name="' + c.name + '" type="' + c.type + '"');
                                });
                            }

                            // Логируем IK-таймлайны в анимациях перед удалением
                            animNames.forEach(animName => {
                                const anim = jsonData.animations[animName];
                                if (anim.ik) {
                                    const ikKeys = Object.keys(anim.ik);
                                    console.warn('[spine-boss._spineBossLoad] анимация "' + animName + '" содержит IK-таймлайны: ' + ikKeys.join(', ') +
                                        ' — удаляем (runtime несовместим с IK-форматом этого JSON)');
                                    delete anim.ik;
                                }
                            });

                            let skelData;
                            try {
                                const loader   = new sp.AtlasAttachmentLoader(atlas);
                                const skelJson = new sp.SkeletonJson(loader);
                                skelJson.scale = 1;
                                skelData = skelJson.readSkeletonData(jsonData);
                                console.log('[spine-boss._spineBossLoad] readSkeletonData OK: ' +
                                    skelData.bones.length + ' костей, ' +
                                    skelData.slots.length + ' слотов, ' +
                                    skelData.animations.length + ' анимаций');
                                skelData.animations.forEach(a => console.log('  anim "' + a.name + '" длительность=' + a.duration.toFixed(2) + 'с'));
                            } catch(e) {
                                console.error('[spine-boss._spineBossLoad] ОШИБКА readSkeletonData:', e.message);
                                console.error('  Стек:', e.stack);
                                return;
                            }

                            let skeleton;
                            try {
                                skeleton = new sp.Skeleton(skelData);
                                if (skeleton.setupPose) skeleton.setupPose();
                                const rootBone = skeleton.bones[0];
                                console.log('[spine-boss._spineBossLoad] Skeleton создан, корневая кость: "' + rootBone.data.name + '"' +
                                    ' worldX=' + rootBone.appliedPose.worldX.toFixed(1) + ' worldY=' + rootBone.appliedPose.worldY.toFixed(1));
                            } catch(e) {
                                console.error('[spine-boss._spineBossLoad] ОШИБКА создания Skeleton:', e.message, e.stack);
                                return;
                            }

                            let state;
                            try {
                                const stateData = new sp.AnimationStateData(skelData);
                                state = new sp.AnimationState(stateData);
                                const trackEntry = state.setAnimation(0, cfg.anim, true);
                                console.log('[spine-boss._spineBossLoad] AnimationState создан, анимация "' + cfg.anim + '" запущена' +
                                    (trackEntry ? ' (track duration=' + trackEntry.animation.duration.toFixed(2) + 'с)' : ' ВНИМАНИЕ: trackEntry=null'));
                            } catch(e) {
                                console.error('[spine-boss._spineBossLoad] ОШИБКА AnimationState/setAnimation:', e.message);
                                console.error('  Доступные анимации:', skelData.animations.map(a => a.name).join(', '));
                                return;
                            }

                            const renderer = new sp.SkeletonRenderer(this._spineCtx);
                            renderer.triangleRendering = true;
                            console.log('[spine-boss._spineBossLoad] SkeletonRenderer создан, triangleRendering=true');

                            this._spineCache[bossIdx] = { skeleton, state, renderer, cfg };
                            console.log('[spine-boss._spineBossLoad] ✓ загрузка boss=' + bossIdx + ' завершена, запускаем render loop');

                            if (this._spineBossIdx === bossIdx && this._spineCv.style.display !== 'none') {
                                this._spineBossStartLoop();
                            } else {
                                console.warn('[spine-boss._spineBossLoad] loop НЕ запущен: bossIdx=' + this._spineBossIdx +
                                    ' (ожидался ' + bossIdx + '), display=' + this._spineCv.style.display);
                            }
                        })
                        .catch(e => {
                            console.error('[spine-boss._spineBossLoad] ОШИБКА загрузки/парсинга JSON:', e.message);
                            console.error('  URL:', SPINE_DIR + cfg.json);
                            console.error('  Стек:', e.stack);
                        });
                };
                img.onerror = (e) => {
                    console.error('[spine-boss._spineBossLoad] ОШИБКА загрузки текстуры: ' + SPINE_DIR + texName);
                    console.error('  Возможные причины: файл не найден, CORS, неверный формат WebP');
                };
                img.src = SPINE_DIR + texName;
            })
            .catch(e => {
                console.error('[spine-boss._spineBossLoad] ОШИБКА загрузки atlas:', e.message);
                console.error('  URL:', SPINE_DIR + cfg.atlas);
            });
    };

    proto._spineBossStartLoop = function() {
        if (this._spineAnimId) cancelAnimationFrame(this._spineAnimId);
        this._spineLastTs = performance.now();
        this._spineDrawCount = 0;
        console.log('[spine-boss._spineBossStartLoop] запускаем render loop для boss=' + this._spineBossIdx);

        const cv = this._spineCv;
        const entry = this._spineCache[this._spineBossIdx];
        if (!entry) {
            console.error('[spine-boss._spineBossStartLoop] ОШИБКА: нет данных в кэше для boss=' + this._spineBossIdx);
            return;
        }
        const { cfg } = entry;
        console.log('[spine-boss._spineBossStartLoop] overlay canvas: ' +
            'internal=' + cv.width + 'x' + cv.height +
            ' css=' + cv.style.width + 'x' + cv.style.height +
            ' pos=(' + cv.style.left + ',' + cv.style.top + ')' +
            ' display=' + cv.style.display + ' z-index=' + cv.style.zIndex);
        console.log('[spine-boss._spineBossStartLoop] рендер в точку x=' + cfg.x + ' y=' + cfg.y + ' scale=' + cfg.scale);

        const tick = (ts) => {
            if (!this._spineCv || this._spineCv.style.display === 'none') {
                console.log('[spine-boss.tick] overlay скрыт — останавливаем loop после ' + this._spineDrawCount + ' кадров');
                return;
            }
            this._spineAnimId = requestAnimationFrame(tick);

            // Авто-скрытие: если поверх _bossFightWin в layer2_mc открыт другой экран/попап — прячем Spine
            const _l2 = window.root && window.root.layer2_mc;
            if(_l2 && this._bossFightWin) {
                const _idx = _l2.children.indexOf(this._bossFightWin);
                const _onTop = (_idx >= 0 && _idx === _l2.children.length - 1);
                const _op = _onTop ? '1' : '0';
                if(cv.style.opacity !== _op) {
                    cv.style.opacity = _op;
                    console.log('[spine-boss.tick] opacity→' + _op +
                        ' (bossWin_idx=' + _idx + ' layer2.length=' + _l2.children.length + ')');
                }
            }

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
                console.error('[spine-boss.tick] ОШИБКА renderer.draw:', e.message);
                console.error('  triangleRendering=' + renderer.triangleRendering);
                console.error('  Стек:', e.stack);
            }
            ctx.restore();

            this._spineDrawCount++;
            // Подробный лог: первые 3 кадра, затем каждые 60 (для быстрой диагностики размера)
            if (this._spineDrawCount <= 3 || this._spineDrawCount % 60 === 0) {
                const rootBone = skeleton.bones[0];
                const bp = rootBone.appliedPose;
                console.log('[spine-boss.tick] кадр #' + this._spineDrawCount +
                    ' delta=' + (delta * 1000).toFixed(1) + 'ms' +
                    ' cfg=(x=' + cfg.x + ',y=' + cfg.y + ',scale=' + cfg.scale + ')');

                // Вычисляем bounding box всех костей — показывает реальный размер и позицию на экране
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
                    // Конвертируем Spine-координаты в экранные (с учётом translate + y-flip scale)
                    const scrL = Math.round(cfg.x + minX * cfg.scale);
                    const scrR = Math.round(cfg.x + maxX * cfg.scale);
                    const scrT = Math.round(cfg.y - maxY * cfg.scale); // Spine Y-up → экран Y-down
                    const scrB = Math.round(cfg.y - minY * cfg.scale);
                    console.log('[spine-boss.tick] ─ BBOX НА ЭКРАНЕ (1280×720):' +
                        ' X=[' + scrL + '..' + scrR + '] Y=[' + scrT + '..' + scrB + ']' +
                        ' | ширина=' + (scrR - scrL) + 'px высота=' + (scrB - scrT) + 'px');
                    if (scrT < 0)   console.warn('[spine-boss.tick] ВНИМАНИЕ: верхушка персонажа обрезана — scrT=' + scrT + ' (за краем канваса)');
                    if (scrB > 720) console.warn('[spine-boss.tick] ВНИМАНИЕ: нижняя часть обрезана — scrB=' + scrB + ' (за краем 720px)');
                }

                let visibleSlots = 0;
                skeleton.drawOrder.appliedPose.forEach(slot => {
                    if (slot.bone.active && slot.appliedPose.attachment) visibleSlots++;
                });
                console.log('[spine-boss.tick] слотов с attachment: ' + visibleSlots + ' из ' + skeleton.slots.length);
            }
        };
        this._spineAnimId = requestAnimationFrame(tick);
    };
}

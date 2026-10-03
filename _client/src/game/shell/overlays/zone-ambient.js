import { applyAudioVolumes } from '../../../modules/audio-volumes.js';
/** Атмосферные звуки Зоны (24.09.2026, по прямому указанию) — 5 звуков по кругу
 * (1→2→3→4→5→1...), в отличие от фоновой музыки Двора (dvor-music.js, играет ПОДРЯД без
 * пауз) — здесь звук проигрывается "время от времени", с паузой между звуками, пока открыт
 * экран Зоны. Останавливается при закрытии экрана (оба пути — крестик самого экрана И общий
 * _closeAllPanels(), см. zone_screen.js/interface-panels.js).
 *
 * INTERVAL_MS — пауза между звуками не была указана числом, выбран разумный дефолт (45с);
 * поменять/уточнить по просьбе — одна строка.
 */
export function attachZoneAmbient(proto){
    const TRACKS = [
        './sounds/звуки зона 1 .mp3',
        './sounds/звуки зона 2.mp3',
        './sounds/звуки зона 3 .mp3',
        './sounds/звуки зона аномалии 1.mp3',
        './sounds/звуки зона аномалии 2 .mp3',
    ];
    const INTERVAL_MS = 45000;
    // 25.09.2026 (по прямому указанию — "звуки зона 3, я хочу чтобы он на протяжении своего
    // воспроизведения (30 секунд) повышал громкость по нарастающей, от самой тихой до своей
    // обычной"): только у ЭТОГО трека (idx=2) громкость плавно растёт 0→1 (множитель поверх
    // обычной громкости звуков _sndVol, см. audio-volumes.js) в течение FADE_IN_DURATION_MS —
    // остальные 4 трека играют как раньше, сразу на полной громкости.
    const FADE_IN_TRACK_IDX = 2;
    const FADE_IN_DURATION_MS = 30000;

    proto._startZoneAmbient = function(){
        if(this._zoneAmbientPlaying){
            console.log('[zone-ambient._startZoneAmbient] уже запущено, повторный запуск пропущен');
            return;
        }
        if(!window.PIXI || !PIXI.sound){
            console.error('[zone-ambient._startZoneAmbient] PIXI.sound недоступен (libs/pixi-sound.js не загружен?) — атмосферные звуки Зоны играть не будут');
            return;
        }
        this._zoneAmbientPlaying = true;
        this._zoneAmbientTrackIdx = 0;
        console.log('[zone-ambient._startZoneAmbient] запуск атмосферы Зоны, звуков:', TRACKS.length, TRACKS, '| интервал между звуками:', INTERVAL_MS + 'мс');
        this._playNextZoneAmbient();
    };

    proto._stopZoneAmbient = function(){
        if(!this._zoneAmbientPlaying){
            console.log('[zone-ambient._stopZoneAmbient] уже остановлено, ничего не делаю');
            return;
        }
        console.log('[zone-ambient._stopZoneAmbient] остановка атмосферы Зоны');
        this._zoneAmbientPlaying = false;
        clearTimeout(this._zoneAmbientTimer);
        if(this._zoneAmbientInstance && typeof this._zoneAmbientInstance.stop === 'function'){
            try{
                this._zoneAmbientInstance.stop();
            } catch(e){
                console.error('[zone-ambient._stopZoneAmbient] ошибка при остановке текущего звука:', e.message);
            }
        }
        this._zoneAmbientInstance = null;
    };

    // Проигрывает звук this._zoneAmbientTrackIdx (по модулю длины плейлиста), затем планирует
    // следующий через INTERVAL_MS (пауза, не подряд — в этом отличие от dvor-music.js). Если
    // экран Зоны закрыли, пока звук ещё грузился (this._zoneAmbientPlaying стало false) —
    // воспроизведение не стартует, цикл не оживает сам по себе после выхода.
    proto._playNextZoneAmbient = function(){
        if(!this._zoneAmbientPlaying) return;

        const idx   = this._zoneAmbientTrackIdx % TRACKS.length;
        const url   = TRACKS[idx];
        const alias = 'zone_ambient_' + idx;
        // 24.09.2026 (по прямому указанию — "звуки во дворе/зоне привязаны к переключателю
        // звуки, а не музыки"): эти файлы — эмбиент-ЗВУКИ (не музыкальный плейлист), должны
        // слушать _sndVol, а не _musVol — раньше слушали не тот регулятор.
        const vol   = window._sndVol !== undefined ? window._sndVol : 0.7;
        // 25.09.2026 (тот же баг-класс, что чинили в background-music.js/dvor-music.js — устаревший
        // complete/error от уже неактуального звука может задвоить/сбить расписание): поколение
        // занимается сразу, устаревшие closures сверяют его перед тем, как продвинуть плейлист.
        const myGen = (this._zoneAmbientGen = (this._zoneAmbientGen || 0) + 1);
        console.log('[zone-ambient._playNextZoneAmbient] звук', (idx + 1) + '/' + TRACKS.length, '| alias:', alias, '| url:', url, '| громкость:', vol, '| gen:', myGen);

        const _scheduleNext = () => {
            if(myGen !== this._zoneAmbientGen){
                console.log('[zone-ambient._playNextZoneAmbient] устаревший _scheduleNext (gen', myGen, '≠ текущий', this._zoneAmbientGen + ') — расписание уже продвинуто, игнорирую');
                return;
            }
            this._zoneAmbientTrackIdx = idx + 1;
            clearTimeout(this._zoneAmbientTimer);
            this._zoneAmbientTimer = setTimeout(() => this._playNextZoneAmbient(), INTERVAL_MS);
        };

        const _startPlayback = () => {
            if(!this._zoneAmbientPlaying || myGen !== this._zoneAmbientGen){
                console.log('[zone-ambient._playNextZoneAmbient] Зона закрыта или звук устарел, пока', idx + 1, 'грузился — воспроизведение отменено');
                return;
            }
            try{
                applyAudioVolumes();
                const isFadeIn = idx === FADE_IN_TRACK_IDX;
                this._zoneAmbientInstance = PIXI.sound.play(alias, {
                    // Ноль PIXI.sound иногда трактует как "без изменений/не проигрывать" —
                    // берём заведомо тихое, но ненулевое значение как старт нарастания.
                    volume: isFadeIn ? 0.001 : 1,
                    complete: () => {
                        if(myGen !== this._zoneAmbientGen){
                            console.log('[zone-ambient._playNextZoneAmbient] устаревший complete звука', idx + 1, '(gen', myGen, '≠ текущий', this._zoneAmbientGen + ') — игнорирую');
                            return;
                        }
                        console.log('[zone-ambient._playNextZoneAmbient] звук', idx + 1, 'доигран, следующий через', INTERVAL_MS + 'мс');
                        _scheduleNext();
                    },
                });
                if(this._zoneAmbientInstance && typeof this._zoneAmbientInstance.on === 'function'){
                    this._zoneAmbientInstance.on('error', (e) => {
                        if(myGen !== this._zoneAmbientGen){
                            console.log('[zone-ambient._playNextZoneAmbient] устаревший error звука', idx + 1, '(gen', myGen, '≠ текущий', this._zoneAmbientGen + ') — игнорирую');
                            return;
                        }
                        console.error('[zone-ambient._playNextZoneAmbient] ошибка воспроизведения звука', idx + 1, '(событие error):', e && e.message, '| url:', url);
                        _scheduleNext();
                    });
                }
                if(isFadeIn && this._zoneAmbientInstance){
                    const inst = this._zoneAmbientInstance;
                    const startTs = (window.performance && performance.now) ? performance.now() : Date.now();
                    console.log('[zone-ambient._playNextZoneAmbient] звук', idx + 1, '— запущено нарастание громкости на', FADE_IN_DURATION_MS + 'мс');
                    const _rampStep = () => {
                        // Если за время анимации звук остановили (crash закрыл Зону) или уже
                        // сменился следующий трек — instance больше не текущий, прекращаем.
                        if(this._zoneAmbientInstance !== inst) return;
                        const now = (window.performance && performance.now) ? performance.now() : Date.now();
                        const t = Math.min(1, (now - startTs) / FADE_IN_DURATION_MS);
                        try{ inst.volume = t; } catch(e){
                            console.error('[zone-ambient._playNextZoneAmbient] ошибка при обновлении громкости нарастания:', e.message);
                            return;
                        }
                        if(t < 1) requestAnimationFrame(_rampStep);
                        else console.log('[zone-ambient._playNextZoneAmbient] звук', idx + 1, '— нарастание громкости завершено');
                    };
                    requestAnimationFrame(_rampStep);
                }
            } catch(e){
                console.error('[zone-ambient._playNextZoneAmbient] ошибка воспроизведения звука', idx + 1, ':', e.message, '| url:', url);
                _scheduleNext();
            }
        };

        if(PIXI.sound.exists(alias)){
            _startPlayback();
            return;
        }
        PIXI.sound.add(alias, {
            url,
            preload: true,
            loaded: (err) => {
                if(err){
                    console.error('[zone-ambient._playNextZoneAmbient] не удалось загрузить звук', idx + 1, ':', err.message, '| url:', url);
                    _scheduleNext();
                    return;
                }
                console.log('[zone-ambient._playNextZoneAmbient] звук', idx + 1, 'загружен успешно');
                _startPlayback();
            },
        });
    };
}

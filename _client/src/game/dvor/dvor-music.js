import { applyAudioVolumes } from '../../modules/audio-volumes.js';
/** Фоновая музыка Двора (24.09.2026, по прямому указанию) — 3 трека по кругу
 * (1→2→3→1→2→3...), играют, пока открыт экран Двора, останавливаются при выходе.
 *
 * Подробное логирование по прямому требованию (ПРАВИЛО №8 в CLAUDE.md) — любая ошибка
 * загрузки/воспроизведения не должна проходить незамеченной и молча обрывать плейлист.
 */
export function attachDvorMusic(proto){
    const TRACKS = [
        './sounds/звуки двор 1.mp3',
        './sounds/звуки двор 2.mp3',
        './sounds/звуки двор 3.mp3',
    ];

    // 25.09.2026 (тот же баг-класс, что чинили в global background-music.js — "цикл музыки
    // ломается, если выключить звук в настройках и через какое-то время включить обратно"):
    // watchdog и настоящий complete/error одного и того же трека могут сработать ОБА — первый
    // продвигает плейлист, второй прилетает позже от уже устаревшего трека и либо задваивает
    // advance, либо гасит watchdog уже СЛЕДУЮЩЕГО легитимного трека. this._dvorMusicGen —
    // токен поколения: каждый вызов _playNextDvorTrack() бьёт новый номер, closures сверяют его
    // перед тем как продвинуть плейлист — устаревший вызов молча игнорируется.
    proto._startDvorMusic = function(){
        if(this._dvorMusicPlaying){
            console.log('[dvor-music._startDvorMusic] плейлист уже играет, повторный запуск пропущен');
            return;
        }
        if(!window.PIXI || !PIXI.sound){
            console.error('[dvor-music._startDvorMusic] PIXI.sound недоступен (libs/pixi-sound.js не загружен?) — фоновая музыка Двора играть не будет');
            return;
        }
        this._dvorMusicPlaying = true;
        this._dvorMusicTrackIdx = 0;
        console.log('[dvor-music._startDvorMusic] запуск плейлиста Двора, треков:', TRACKS.length, TRACKS);
        this._playNextDvorTrack();
    };

    // 06.10.2026 (тот же баг-класс, что чинили в background-music.js — "музыка дублируется,
    // двоится" после возврата из фона): this._dvorMusicWatchdog тикает по wall-clock setTimeout,
    // не связанному с паузой AudioContext — если Двор остаётся открытым, пока приложение
    // свёрнуто дольше оставшейся длительности трека, watchdog форсит _advance() вхолостую ПОКА
    // мы в фоне, запуская второй трек поверх первого. app-lifecycle.js отключает этот таймер на
    // время сворачивания и перевзводит заново при разворачивании.
    proto._pauseDvorMusicWatchdog = function(){
        if(!this._dvorMusicWatchdog) return;
        console.log('[dvor-music._pauseDvorMusicWatchdog] приложение свёрнуто — отключаю сторож-таймер трека Двора на время паузы');
        clearTimeout(this._dvorMusicWatchdog);
        this._dvorMusicWatchdog = null;
    };

    proto._resumeDvorMusicWatchdog = function(){
        if(!this._dvorMusicPlaying || !this._dvorMusicInstance) return;
        const idx   = this._dvorMusicTrackIdx % TRACKS.length;
        const alias = 'dvor_music_' + idx;
        const myGen = this._dvorMusicGen;
        const _sound = PIXI.sound.find(alias);
        const _durationMs = (_sound && _sound.duration) ? _sound.duration * 1000 : 60000;
        console.log('[dvor-music._resumeDvorMusicWatchdog] приложение развёрнуто — перевзвожаю сторож-таймер трека Двора', idx + 1, 'с полным запасом');
        clearTimeout(this._dvorMusicWatchdog);
        this._dvorMusicWatchdog = setTimeout(() => {
            if(myGen !== this._dvorMusicGen){
                console.log('[dvor-music._resumeDvorMusicWatchdog] устаревший watchdog (gen', myGen, '≠ текущий', this._dvorMusicGen + ') — трек уже сменился легитимно, игнорирую');
                return;
            }
            console.error('[dvor-music._resumeDvorMusicWatchdog] трек', idx + 1, 'не долетел до complete/error за', Math.round(_durationMs / 1000) + 5, 'сек после возврата из фона — принудительно переключаюсь');
            this._dvorMusicTrackIdx = idx + 1;
            this._playNextDvorTrack();
        }, _durationMs + 5000);
    };

    proto._stopDvorMusic = function(){
        if(!this._dvorMusicPlaying){
            console.log('[dvor-music._stopDvorMusic] музыка уже остановлена, ничего не делаю');
            return;
        }
        console.log('[dvor-music._stopDvorMusic] остановка музыки Двора | текущий трек:', (this._dvorMusicTrackIdx % TRACKS.length) + 1);
        this._dvorMusicPlaying = false;
        clearTimeout(this._dvorMusicWatchdog);
        if(this._dvorMusicInstance && typeof this._dvorMusicInstance.stop === 'function'){
            try{
                this._dvorMusicInstance.stop();
            } catch(e){
                console.error('[dvor-music._stopDvorMusic] ошибка при остановке текущего трека:', e.message);
            }
        }
        this._dvorMusicInstance = null;
    };

    // Проигрывает трек this._dvorMusicTrackIdx (по модулю длины плейлиста), по завершении —
    // сама себя вызывает для следующего индекса. Если Двор закрыли, пока трек ещё грузился
    // (this._dvorMusicPlaying стало false) — воспроизведение не стартует, плейлист не оживает
    // сам по себе после выхода.
    proto._playNextDvorTrack = function(){
        if(!this._dvorMusicPlaying) return;

        const idx   = this._dvorMusicTrackIdx % TRACKS.length;
        const url   = TRACKS[idx];
        const alias = 'dvor_music_' + idx;
        // 24.09.2026 (по прямому указанию — "звуки во дворе/зоне привязаны к переключателю
        // звуки, а не музыки"): несмотря на название файла ("звуки двор *.mp3"), плейлист
        // слушал _musVol (регулятор МУЗЫКИ) — должен слушать _sndVol (регулятор ЗВУКОВ), раз
        // это категория "звуки", а не отдельный музыкальный трек (см. новый global
        // background-music.js — вот ТАМ действительно музыка, слушает _musVol).
        const vol   = window._sndVol !== undefined ? window._sndVol : 0.7;
        // 25.09.2026: см. большой комментарий у _startDvorMusic — новое поколение занимается
        // сразу, до загрузки/проигрывания, чтобы устаревшие closures предыдущего трека не
        // продвинули плейлист повторно, когда прилетят позже.
        const myGen = (this._dvorMusicGen = (this._dvorMusicGen || 0) + 1);
        console.log('[dvor-music._playNextDvorTrack] трек', (idx + 1) + '/' + TRACKS.length, '| alias:', alias, '| url:', url, '| громкость:', vol, '| gen:', myGen);

        const _advance = () => {
            if(myGen !== this._dvorMusicGen){
                console.log('[dvor-music._playNextDvorTrack] устаревший _advance (gen', myGen, '≠ текущий', this._dvorMusicGen + ') — трек уже продвинут другим путём, игнорирую');
                return;
            }
            this._dvorMusicTrackIdx = idx + 1;
            this._playNextDvorTrack();
        };

        const _startPlayback = () => {
            if(!this._dvorMusicPlaying || myGen !== this._dvorMusicGen){
                console.log('[dvor-music._playNextDvorTrack] Двор закрыт или трек устарел, пока', idx + 1, 'грузился — воспроизведение отменено');
                return;
            }
            try{
                applyAudioVolumes();
                this._dvorMusicInstance = PIXI.sound.play(alias, {
                    volume: 1,
                    complete: () => {
                        if(myGen !== this._dvorMusicGen){
                            console.log('[dvor-music._playNextDvorTrack] устаревший complete трека', idx + 1, '(gen', myGen, '≠ текущий', this._dvorMusicGen + ') — плейлист уже продвинут, игнорирую');
                            return;
                        }
                        console.log('[dvor-music._playNextDvorTrack] трек', idx + 1, 'доигран до конца, переключаюсь на следующий');
                        clearTimeout(this._dvorMusicWatchdog);
                        _advance();
                    },
                });
                if(this._dvorMusicInstance && typeof this._dvorMusicInstance.on === 'function'){
                    this._dvorMusicInstance.on('error', (e) => {
                        if(myGen !== this._dvorMusicGen){
                            console.log('[dvor-music._playNextDvorTrack] устаревший error трека', idx + 1, '(gen', myGen, '≠ текущий', this._dvorMusicGen + ') — плейлист уже продвинут, игнорирую');
                            return;
                        }
                        console.error('[dvor-music._playNextDvorTrack] ошибка воспроизведения трека', idx + 1, '(событие error):', e && e.message, '| url:', url);
                        clearTimeout(this._dvorMusicWatchdog);
                        _advance();
                    });
                }
                // 24.09.2026 (по прямому указанию — "музыка почему-то остановилась", точную
                // причину подтвердить логами не удалось): сторож-таймер на случай, если трек ни
                // разу не долетит до complete/error (браузер придушил вкладку в фоне, звук
                // молча завис и т.п.) — без него плейлист мог бы замереть навсегда без единой
                // строки в консоли. duration неизвестна ДО загрузки, поэтому берём её из уже
                // загруженного Sound (+5с запаса); если вдруг недоступна — 60с дефолт.
                // 25.09.2026: этот же watchdog и был ПОЛОВИНОЙ настоящего бага ("цикл музыки
                // ломается") — он и настоящий complete могли сработать оба на одном треке; gen-
                // проверка ниже не даёт устаревшему срабатыванию тронуть уже продвинутый плейлист.
                const _sound = PIXI.sound.find(alias);
                const _durationMs = (_sound && _sound.duration) ? _sound.duration * 1000 : 60000;
                clearTimeout(this._dvorMusicWatchdog);
                this._dvorMusicWatchdog = setTimeout(() => {
                    if(myGen !== this._dvorMusicGen){
                        console.log('[dvor-music._playNextDvorTrack] устаревший watchdog трека', idx + 1, '(gen', myGen, '≠ текущий', this._dvorMusicGen + ') — трек уже сменился легитимно, игнорирую');
                        return;
                    }
                    console.error('[dvor-music._playNextDvorTrack] трек', idx + 1, 'не долетел до complete/error за', Math.round(_durationMs / 1000) + 5, 'сек — принудительно переключаюсь на следующий, чтобы плейлист не завис молча');
                    _advance();
                }, _durationMs + 5000);
            } catch(e){
                console.error('[dvor-music._playNextDvorTrack] ошибка воспроизведения трека', idx + 1, ':', e.message, '| url:', url);
                _advance();
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
                    console.error('[dvor-music._playNextDvorTrack] не удалось загрузить трек', idx + 1, ':', err.message, '| url:', url);
                    _advance();
                    return;
                }
                console.log('[dvor-music._playNextDvorTrack] трек', idx + 1, 'загружен успешно');
                _startPlayback();
            },
        });
    };
}

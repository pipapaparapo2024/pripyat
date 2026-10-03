import { applyAudioVolumes } from './audio-volumes.js';
/** Глобальная фоновая МУЗЫКА (24.09.2026, по прямому указанию) — 2 трека по кругу
 * (1→2→1→2...), запускается один раз, когда открывается главный экран, и играет непрерывно
 * везде до конца сессии (в отличие от dvor-music.js/zone-ambient.js — те звучат только внутри
 * своего экрана и относятся к категории "звуки", слушают _sndVol; это отдельный канал
 * "музыка", слушает _musVol — регулируются разными ползунками в попапе настроек звука,
 * см. shell/popups/sound.js).
 *
 * Подробное логирование по прямому требованию (ПРАВИЛО №8 в CLAUDE.md) — любая ошибка
 * загрузки/воспроизведения не должна проходить незамеченной и молча обрывать плейлист.
 */
const TRACKS = [
    './sounds/музыка задний фон 1.mp3',
    './sounds/музыка задний фон 2.mp3',
];

let _playing = false;
let _trackIdx = 0;
let _instance = null;
let _watchdog = null;
// 25.09.2026 (баг найден по прямому указанию — "цикл музыки ломается, если выключить звук в
// настройках и через какое-то время включить обратно"): watchdog и настоящий complete/error
// одного и того же трека могут сработать ОБА (вкладка на паузе в фоне — типичный триггер,
// напр. пока открыт поп-ап настроек и телефон/браузер придушил таймеры) — первый срабатывает,
// продвигает плейлист на следующий трек, а второй прилетает ПОЗЖЕ от уже устаревшего трека и
// продвигает плейлист ЕЩЁ РАЗ (задваивая advance — трек пропускается) или гасит watchdog уже
// СЛЕДУЮЩЕГО, легитимно играющего трека (снимая с него защиту от зависания). _gen — токен
// поколения: каждый вызов _playNextTrack() бьёт новый номер, closures запоминают его как
// myGen и, прежде чем продвинуть плейлист, сверяются, что их поколение всё ещё актуально —
// устаревший вызов молча игнорируется вместо порчи состояния.
let _gen = 0;

export function startBackgroundMusic(){
    if(_playing){
        console.log('[background-music.startBackgroundMusic] плейлист уже играет, повторный запуск пропущен');
        return;
    }
    if(!window.PIXI || !PIXI.sound){
        console.error('[background-music.startBackgroundMusic] PIXI.sound недоступен (libs/pixi-sound.js не загружен?) — фоновая музыка играть не будет');
        return;
    }
    _playing = true;
    _trackIdx = 0;
    console.log('[background-music.startBackgroundMusic] запуск глобального музыкального плейлиста, треков:', TRACKS.length, TRACKS);
    _playNextTrack();
}

export function stopBackgroundMusic(){
    if(!_playing){
        console.log('[background-music.stopBackgroundMusic] музыка уже остановлена, ничего не делаю');
        return;
    }
    console.log('[background-music.stopBackgroundMusic] остановка глобальной музыки | текущий трек:', (_trackIdx % TRACKS.length) + 1);
    _playing = false;
    clearTimeout(_watchdog);
    if(_instance && typeof _instance.stop === 'function'){
        try{
            _instance.stop();
        } catch(e){
            console.error('[background-music.stopBackgroundMusic] ошибка при остановке текущего трека:', e.message);
        }
    }
    _instance = null;
}

// Проигрывает трек _trackIdx (по модулю длины плейлиста), по завершении — сама себя вызывает
// для следующего индекса. Если музыку остановили, пока трек ещё грузился (_playing стало
// false) — воспроизведение не стартует, плейлист не оживает сам по себе после остановки.
function _playNextTrack(){
    if(!_playing) return;

    const idx   = _trackIdx % TRACKS.length;
    const url   = TRACKS[idx];
    const alias = 'bg_music_' + idx;
    const vol   = window._musVol !== undefined ? window._musVol : 0.5;
    // 25.09.2026: см. большой комментарий у объявления _gen — этот вызов "занимает" новое
    // поколение сразу, ДО начала загрузки/проигрывания трека, чтобы любой предыдущий (уже
    // устаревший) вызов, чьи complete/error/watchdog ещё могут прилететь позже, гарантированно
    // проиграл сравнение myGen !== _gen и не тронул состояние плейлиста повторно.
    const myGen = ++_gen;
    console.log('[background-music._playNextTrack] трек', (idx + 1) + '/' + TRACKS.length, '| alias:', alias, '| url:', url, '| громкость:', vol, '| gen:', myGen);

    const _advance = () => {
        if(myGen !== _gen){
            console.log('[background-music._playNextTrack] устаревший _advance (gen', myGen, '≠ текущий', _gen + ') — трек уже продвинут другим путём, игнорирую');
            return;
        }
        _trackIdx = idx + 1;
        _playNextTrack();
    };

    const _startPlayback = () => {
        if(!_playing || myGen !== _gen){
            console.log('[background-music._playNextTrack] музыка остановлена или трек устарел, пока', idx + 1, 'грузился — воспроизведение отменено');
            return;
        }
        try{
            applyAudioVolumes();
            _instance = PIXI.sound.play(alias, {
                volume: 1,
                complete: () => {
                    if(myGen !== _gen){
                        console.log('[background-music._playNextTrack] устаревший complete трека', idx + 1, '(gen', myGen, '≠ текущий', _gen + ') — плейлист уже продвинут, игнорирую');
                        return;
                    }
                    console.log('[background-music._playNextTrack] трек', idx + 1, 'доигран до конца, переключаюсь на следующий');
                    clearTimeout(_watchdog);
                    _advance();
                },
            });
            if(_instance && typeof _instance.on === 'function'){
                _instance.on('error', (e) => {
                    if(myGen !== _gen){
                        console.log('[background-music._playNextTrack] устаревший error трека', idx + 1, '(gen', myGen, '≠ текущий', _gen + ') — плейлист уже продвинут, игнорирую');
                        return;
                    }
                    console.error('[background-music._playNextTrack] ошибка воспроизведения трека', idx + 1, '(событие error):', e && e.message, '| url:', url);
                    clearTimeout(_watchdog);
                    _advance();
                });
            }
            // Сторож-таймер — тот же приём, что уже есть у dvor-music.js/zone-ambient.js: если
            // трек ни разу не долетит до complete/error (браузер придушил вкладку в фоне и
            // т.п.), плейлист не должен замереть навсегда без единой строки в консоли.
            const _sound = PIXI.sound.find(alias);
            const _durationMs = (_sound && _sound.duration) ? _sound.duration * 1000 : 60000;
            clearTimeout(_watchdog);
            _watchdog = setTimeout(() => {
                if(myGen !== _gen){
                    console.log('[background-music._playNextTrack] устаревший watchdog трека', idx + 1, '(gen', myGen, '≠ текущий', _gen + ') — трек уже сменился легитимно, игнорирую');
                    return;
                }
                console.error('[background-music._playNextTrack] трек', idx + 1, 'не долетел до complete/error за', Math.round(_durationMs / 1000) + 5, 'сек — принудительно переключаюсь на следующий, чтобы плейлист не завис молча');
                _advance();
            }, _durationMs + 5000);
        } catch(e){
            console.error('[background-music._playNextTrack] ошибка воспроизведения трека', idx + 1, ':', e.message, '| url:', url);
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
                console.error('[background-music._playNextTrack] не удалось загрузить трек', idx + 1, ':', err.message, '| url:', url);
                _advance();
                return;
            }
            console.log('[background-music._playNextTrack] трек', idx + 1, 'загружен успешно');
            _startPlayback();
        },
    });
}

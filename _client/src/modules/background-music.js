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

// 06.10.2026 (баг по репорту — "зашёл в игру, через минуту-две музыка начинает дублироваться,
// двоиться"): корень — _watchdog тикает по wall-clock setTimeout, который НЕ связан с паузой
// AudioContext (app-lifecycle.js._pauseApp() вызывает PIXI.sound.pauseAll(), это приостанавливает
// звук, но не трогает уже запущенные JS-таймеры). Если приложение свёрнуто дольше, чем
// оставшаяся длительность трека, _watchdog всё равно срабатывает ПОКА мы в фоне и форсит
// _advance() → новый PIXI.sound.play() стартует ВТОРОЙ трек поверх первого — а когда
// AudioContext потом разворачивается (resumeAll() или автовозврат браузера), первый трек, чья
// ссылка (_instance) уже перезаписана вторым, продолжает звучать параллельно и никогда не
// останавливается (stopBackgroundMusic() видит только актуальный _instance). Фикс — app-lifecycle
// отключает этот таймер на время сворачивания и перевзводит его заново (с полным запасом) при
// разворачивании, не давая ему сработать вхолостую, пока звук реально не играет.
export function pauseBackgroundMusicWatchdog(){
    if(!_watchdog) return;
    console.log('[background-music.pauseBackgroundMusicWatchdog] приложение свёрнуто — отключаю сторож-таймер трека на время паузы');
    clearTimeout(_watchdog);
    _watchdog = null;
}

// 17.10.2026 (повторный репорт после фикса 06.10.2026 — "зашёл в игру, свернул вкладку, зашёл
// обратно — музыка двоится"): watchdog-гонка от 06.10 закрыта (сторож-таймер не тикает в фоне),
// но остаётся ДРУГОЙ путь к тому же симптому — обычный complete ТЕКУЩЕГО трека теоретически
// может долететь, пока вкладка ещё в фоне (не все браузеры одинаково полностью замораживают
// колбэки/события WebAudio при pauseAll(), в отличие от setTimeout, который гарантированно не
// тикает) — тогда _advance() легитимно запускает СЛЕДУЮЩИЙ трек ещё в фоне, а когда вкладка
// возвращается, PIXI.sound.resumeAll() снимает паузу с ОБОИХ Sound-объектов разом (resumeAll
// глобальный, не завязан на то, какой алиас сейчас "актуальный" по мнению _trackIdx) — старый
// трек, которому просто не дали нормально увидеть collection своего complete, оживает ПАРАЛЛЕЛЬНО
// с новым. Корень минимален и не стоит того, чтобы разбирать внутренности pixi-sound (3rd-party,
// минифицирован) — вместо этого страхуемся: прямо здесь, в момент возврата из фона, явно
// останавливаем Sound-объект КАЖДОГО трека плейлиста, который не является текущим (_trackIdx) и
// при этом сам считает себя играющим (sound.isPlaying) — это не меняет обычное поведение ни на
// йоту (в норме посторонних играющих алиасов нет, функция ничего не делает), но гарантированно
// убивает именно симптом "двоится", независимо от того, какой из путей гонки его вызвал.
function _stopStrayTracks(activeIdx){
    for(let i = 0; i < TRACKS.length; i++){
        if(i === activeIdx) continue;
        const alias = 'bg_music_' + i;
        const stray = PIXI.sound.exists(alias) ? PIXI.sound.find(alias) : null;
        if(stray && stray.isPlaying){
            console.error('[background-music._stopStrayTracks] обнаружен и остановлен дублирующийся трек', i + 1, '(alias', alias + ') — играл параллельно с актуальным треком', activeIdx + 1);
            try{ stray.stop(); } catch(e){
                console.error('[background-music._stopStrayTracks] ошибка при остановке дублирующегося трека:', e.message);
            }
        }
    }

    // 26.10.2026 (повторный репорт после фикса 06.10/17.10 — "зашёл, сменил вкладку, вернулся —
    // музыка двоится", тот же симптом третий раз): проверка выше ловит ДРУГОЙ alias, играющий
    // параллельно активному, но НЕ ловит ДВА экземпляра ОДНОГО И ТОГО ЖЕ активного alias —
    // возможно именно так резолвится эта гонка (например: трек ещё грузился/был в процессе
    // Sound.play(), когда вкладка скрылась — pauseAll() не мог поставить на паузу то, что ещё не
    // начало звучать; к моменту возврата из фона он всё-таки стартовал и разошёлся с тем
    // экземпляром, который resumeAll() поднял из паузы). pixi-sound хранит ВСЕ одновременно
    // звучащие IMediaInstance активного Sound в .instances — если их больше одного, глушим все,
    // кроме самого раннего (им управляет _instance выше по модулю), не трогая сам Sound/позицию
    // воспроизведения второго — слушатель не должен услышать рестарт трека с нуля.
    const activeAlias = 'bg_music_' + activeIdx;
    const activeSound = PIXI.sound.exists(activeAlias) ? PIXI.sound.find(activeAlias) : null;
    if(activeSound && Array.isArray(activeSound.instances) && activeSound.instances.length > 1){
        console.error('[background-music._stopStrayTracks] у активного трека', activeIdx + 1, 'обнаружено', activeSound.instances.length, 'одновременных экземпляров — глушу лишние, оставляю один');
        activeSound.instances.slice(1).forEach((inst) => {
            try{ inst.stop(); } catch(e){
                console.error('[background-music._stopStrayTracks] ошибка при остановке лишнего экземпляра активного трека:', e.message);
            }
        });
    }
}

export function resumeBackgroundMusicWatchdog(){
    if(!_playing || !_instance) return;
    const idx   = _trackIdx % TRACKS.length;
    const alias = 'bg_music_' + idx;
    const myGen = _gen;
    _stopStrayTracks(idx);
    const _sound = PIXI.sound.find(alias);
    const _durationMs = (_sound && _sound.duration) ? _sound.duration * 1000 : 60000;
    console.log('[background-music.resumeBackgroundMusicWatchdog] приложение развёрнуто — перевзвожаю сторож-таймер трека', idx + 1, 'с полным запасом (время в фоне не засчитывается)');
    clearTimeout(_watchdog);
    _watchdog = setTimeout(() => {
        if(myGen !== _gen){
            console.log('[background-music.resumeBackgroundMusicWatchdog] устаревший watchdog (gen', myGen, '≠ текущий', _gen + ') — трек уже сменился легитимно, игнорирую');
            return;
        }
        console.error('[background-music.resumeBackgroundMusicWatchdog] трек', idx + 1, 'не долетел до complete/error за', Math.round(_durationMs / 1000) + 5, 'сек после возврата из фона — принудительно переключаюсь');
        _trackIdx = idx + 1;
        _playNextTrack();
    }, _durationMs + 5000);
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
            // 26.10.2026 (по прямому указанию — музыка всё ещё двоится после фиксов 06.10/17.10):
            // этот трек мог успеть доиграть сетевую ЗАГРУЗКУ (PIXI.sound.add({loaded: ...})) уже
            // ПОКА вкладка была скрыта — pauseAll() в _pauseApp() не может поставить на паузу то,
            // чего ещё не существовало в момент сворачивания, поэтому playback стартует "вживую"
            // в фоне и расходится с тем, что потом поднимает resumeAll(). Explicit stop() перед
            // play() — дешёвый no-op, если играть нечему, и гарантия, что у ЭТОГО alias не может
            // остаться более одного живого экземпляра, независимо от того, каким именно путём
            // сложилась гонка (ту же гарантию для ДРУГИХ alias даёт _stopStrayTracks() на resume).
            if(PIXI.sound.exists(alias)) PIXI.sound.stop(alias);
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

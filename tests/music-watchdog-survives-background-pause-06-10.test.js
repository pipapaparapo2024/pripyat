/**
 * Test: 06.10.2026, по репорту — "зашёл в игру, через минуту-две музыка начинает
 * дублироваться, двоиться".
 *
 * Корень: app-lifecycle.js._pauseApp()/_resumeApp() (добавлены 30.09.2026 для модерации VK —
 * пауза при сворачивании) вызывают PIXI.sound.pauseAll()/resumeAll(), которые приостанавливают
 * ОБЩИЙ AudioContext — но background-music.js._watchdog (а также dvor-music.js/zone-ambient.js —
 * тот же класс) тикает по wall-clock setTimeout, НЕ связанному с этой паузой. Если приложение
 * свёрнуто дольше оставшейся длительности трека, watchdog всё равно срабатывает ПОКА мы в фоне и
 * форсит переключение на следующий трек — новый PIXI.sound.play() стартует поверх ещё не
 * остановленного текущего. Когда AudioContext потом разворачивается, оба трека звучат
 * параллельно (первый никогда не останавливается — его ссылка уже перезаписана вторым).
 *
 * Фикс: pauseBackgroundMusicWatchdog()/resumeBackgroundMusicWatchdog() — app-lifecycle вызывает
 * их синхронно с pauseAll()/resumeAll(), отключая watchdog на время сворачивания и перевзводя
 * его заново (с полным запасом) при разворачивании.
 *
 * Это РЕАЛЬНОЕ исполнение кода модуля через vm (не grep по тексту) с управляемым виртуальным
 * таймером — тест обязан был бы провалиться на коде ДО фикса (watchdog сработал бы во время
 * "фона" и запустил второй play()), и ловит будущую регрессию, если кто-то уберёт вызов pause/
 * resume из app-lifecycle.js или сломает сам watchdog.
 *
 * Run: node tests/music-watchdog-survives-background-pause-06-10.test.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');

// ── Виртуальный таймер: setTimeout/clearTimeout, управляемые вручную через tick(ms), без
// реального ожидания — позволяет детерминированно смоделировать "1-2 минуты в фоне".
function makeVirtualClock(){
    let now = 0;
    let nextId = 1;
    const timers = new Map(); // id -> {due, fn, cleared}
    return {
        setTimeout(fn, ms){
            const id = nextId++;
            timers.set(id, { due: now + ms, fn, cleared: false });
            return id;
        },
        clearTimeout(id){
            const t = timers.get(id);
            if(t) t.cleared = true;
        },
        tick(ms){
            now += ms;
            // Срабатывают все непросроченные таймеры с due <= now, по возрастанию due — срабатывание
            // может породить НОВЫЕ таймеры (watchdog сам себя перевзводит через _playNextTrack), их
            // тоже нужно учитывать, если их due уже наступил к текущему now.
            let fired = true;
            while(fired){
                fired = false;
                const due = [...timers.entries()].filter(([,t]) => !t.cleared && t.due <= now).sort((a,b) => a[1].due - b[1].due);
                for(const [id, t] of due){
                    timers.delete(id);
                    t.fn();
                    fired = true;
                }
            }
        },
    };
}

console.log('\n=== Реальное исполнение background-music.js через виртуальный таймер ===');
{
    const clock = makeVirtualClock();
    const playCalls = []; // {alias}
    const sounds = { bg_music_0: { duration: 10 }, bg_music_1: { duration: 10 } }; // 10с трек

    const ctx = {
        window: { _musVol: 0.5 },
        console: { log(){}, error(...a){ console.error('[module]', ...a); } },
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        applyAudioVolumes(){},
    };
    ctx.PIXI = {
        sound: {
            exists: (alias) => !!sounds[alias]._loaded,
            find: (alias) => sounds[alias],
            add: (alias, opts) => { sounds[alias]._loaded = true; opts.loaded(null); },
            play: (alias, opts) => {
                playCalls.push(alias);
                const inst = { _opts: opts, stop(){}, on(){} };
                sounds[alias]._lastOpts = opts;
                return inst;
            },
        },
    };
    ctx.window.PIXI = ctx.PIXI;
    vm.createContext(ctx);

    let src = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'background-music.js'), 'utf-8');
    src = src.replace("import { applyAudioVolumes } from './audio-volumes.js';", '');
    src = src.replace(/export function/g, 'function');
    vm.runInContext(src, ctx);

    ctx.startBackgroundMusic();
    assert(playCalls.length === 1 && playCalls[0] === 'bg_music_0', 'запуск стартует трек 0 ровно один раз (' + JSON.stringify(playCalls) + ')');

    console.log('\n1) Без паузы watchdog (регресс, воспроизведение бага ДО фикса): если НЕ отключать watchdog, долгий фон форсит второй play() поверх первого');
    {
        // Независимая проверка на ОТДЕЛЬНОМ виртуальном времени — не трогаем основной сценарий ниже,
        // просто доказываем, что защитный механизм (watchdog) в принципе способен сработать и
        // продублировать трек, если его не поставить на паузу — иначе тест 2 был бы бессмысленным
        // (неясно, проверяет ли он реальную защиту или просто ничего не делает).
        const clock2 = makeVirtualClock();
        const playCalls2 = [];
        const sounds2 = { bg_music_0: { duration: 10 }, bg_music_1: { duration: 10 } };
        const ctx2 = {
            window: { _musVol: 0.5 }, console: { log(){}, error(){} },
            setTimeout: clock2.setTimeout, clearTimeout: clock2.clearTimeout, applyAudioVolumes(){},
        };
        ctx2.PIXI = {
            sound: {
                exists: (a) => !!sounds2[a]._loaded,
                find: (a) => sounds2[a],
                add: (a, o) => { sounds2[a]._loaded = true; o.loaded(null); },
                play: (a) => { playCalls2.push(a); return { stop(){}, on(){} }; },
            },
        };
        ctx2.window.PIXI = ctx2.PIXI;
        vm.createContext(ctx2);
        vm.runInContext(src, ctx2);
        ctx2.startBackgroundMusic();
        clock2.tick(60000); // 1 минута реального (не нашего) времени — watchdog НЕ отключали
        assert(playCalls2.length === 2 && playCalls2[1] === 'bg_music_1',
            'без pauseBackgroundMusicWatchdog() watchdog форсит второй play() сам по себе за 60с простоя — подтверждает, что защита в тесте 2 реально что-то предотвращает, а не no-op: ' + JSON.stringify(playCalls2));
    }

    console.log('\n2) С паузой watchdog (фикс): тот же простой 60с НЕ запускает второй трек, пока приложение в фоне');
    {
        ctx.pauseBackgroundMusicWatchdog();
        clock.tick(60000); // 1 минута "в фоне"
        assert(playCalls.length === 1, 'за 60с с отключённым watchdog второй play() НЕ запущен (' + JSON.stringify(playCalls) + ') — именно это раньше дублировало музыку');
    }

    console.log('\n3) После возврата из фона watchdog снова работает как защита от зависшего трека (не сломан фиксом навсегда)');
    {
        ctx.resumeBackgroundMusicWatchdog();
        clock.tick(14000); // ещё не истёк полный запас (10с трек + 5с) — рано
        assert(playCalls.length === 1, 'watchdog перевзведён с ПОЛНЫМ запасом, а не с унаследованным из фона — через 14с ещё не форсит');
        clock.tick(2000); // итого 16с с момента resume — должен сработать
        assert(playCalls.length === 2 && playCalls[1] === 'bg_music_1',
            'через ~15с после resume watchdog всё-таки форсит переключение, если трек реально завис — safety net не сломан фиксом');
    }
}

console.log('\n=== Регресс-гвард — app-lifecycle.js вызывает pause/resume для всех трёх звуковых каналов ===');
{
    const lifecycleSrc = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'app-lifecycle.js'), 'utf-8');
    assert(/import \{ pauseBackgroundMusicWatchdog, resumeBackgroundMusicWatchdog \} from '\.\/background-music\.js';/.test(lifecycleSrc),
        'app-lifecycle.js импортирует pause/resume для глобальной музыки');
    const pauseBody  = lifecycleSrc.slice(lifecycleSrc.indexOf('function _pauseApp'), lifecycleSrc.indexOf('function _resumeApp'));
    const resumeBody = lifecycleSrc.slice(lifecycleSrc.indexOf('function _resumeApp'));
    assert(/pauseBackgroundMusicWatchdog\(\);/.test(pauseBody), '_pauseApp вызывает pauseBackgroundMusicWatchdog()');
    assert(/dvor\._pauseDvorMusicWatchdog\(\);/.test(pauseBody), '_pauseApp вызывает dvor._pauseDvorMusicWatchdog()');
    assert(/iface\._pauseZoneAmbientWatchdog\(\);/.test(pauseBody), '_pauseApp вызывает iface._pauseZoneAmbientWatchdog() (не window.zone — та модель данных локаций, другой класс)');
    assert(/resumeBackgroundMusicWatchdog\(\);/.test(resumeBody), '_resumeApp вызывает resumeBackgroundMusicWatchdog()');
    assert(/dvor\._resumeDvorMusicWatchdog\(\);/.test(resumeBody), '_resumeApp вызывает dvor._resumeDvorMusicWatchdog()');
    assert(/iface\._resumeZoneAmbientWatchdog\(\);/.test(resumeBody), '_resumeApp вызывает iface._resumeZoneAmbientWatchdog()');

    const dvorSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-music.js'), 'utf-8');
    assert(/proto\._pauseDvorMusicWatchdog = function\(\)\{/.test(dvorSrc) && /proto\._resumeDvorMusicWatchdog = function\(\)\{/.test(dvorSrc),
        'dvor-music.js определяет оба хука (примешиваются к Dvor.prototype)');

    const zoneSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone-ambient.js'), 'utf-8');
    assert(/proto\._pauseZoneAmbientWatchdog = function\(\)\{/.test(zoneSrc) && /proto\._resumeZoneAmbientWatchdog = function\(\)\{/.test(zoneSrc),
        'zone-ambient.js определяет оба хука (примешиваются к Interface.prototype — interface.js:420, НЕ к классу Zone)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: найдено 24.09.2026 по живому репорту ("музыка почему-то остановилась") — точную
 * причину подтвердить логами не удалось (нет прямых доказательств, в отличие от save-race
 * бага), поэтому добавлена ЗАЩИТНАЯ мера: сторож-таймер и обработчик 'error' на каждый трек,
 * чтобы плейлист не мог замереть НАВСЕГДА молча, даже если 'complete' по какой-то причине не
 * придёт (браузер придушил вкладку в фоне, звук завис и т.п.).
 *
 * Run: node tests/dvor-music-watchdog-and-error-handling.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client/src/game/dvor/dvor-music.js'), 'utf-8');

console.log('\nTest: каждый трек получает обработчик error, переключающий плейлист дальше');
{
    const start = src.indexOf('const _startPlayback = () => {');
    const end   = src.indexOf('\n        };', start);
    const body  = src.slice(start, end);
    assert(!!body && start !== -1, '_startPlayback() найден');
    assert(/this\._dvorMusicInstance\.on\('error', \(e\) => \{/.test(body), 'подписка на событие error у проигранного инстанса');
    assert(/clearTimeout\(this\._dvorMusicWatchdog\);[\s\S]{0,80}_advance\(\);/.test(body.slice(body.indexOf("'error'"))),
        'обработчик error останавливает сторож-таймер и переходит к следующему треку (_advance)');
}

console.log('\nTest: сторож-таймер планируется на длительность трека + запас, и переключает плейлист, если complete/error не пришли');
{
    const start = src.indexOf('const _startPlayback = () => {');
    const end   = src.indexOf('\n        };', start);
    const body  = src.slice(start, end);
    assert(/const _durationMs = \(_sound && _sound\.duration\) \? _sound\.duration \* 1000 : 60000;/.test(body),
        'длительность берётся из загруженного Sound (с дефолтом 60с, если недоступна)');
    assert(/this\._dvorMusicWatchdog = setTimeout\(\(\) => \{/.test(body), 'сторож-таймер запланирован');
    assert(/_durationMs \+ 5000/.test(body), 'таймер даёт запас +5с сверх ожидаемой длительности трека');
    assert(/_advance\(\);\s*\}, _durationMs \+ 5000\);/.test(body), 'по истечении таймера плейлист принудительно переключается на следующий трек');
}

console.log('\nTest: успешное завершение трека (complete) и остановка музыки (_stopDvorMusic) отменяют сторож-таймер');
{
    const completeIdx = src.indexOf("complete: () => {");
    const completeChunk = src.slice(completeIdx, completeIdx + 700);
    assert(/clearTimeout\(this\._dvorMusicWatchdog\);/.test(completeChunk), 'complete-колбэк отменяет сторож-таймер перед переходом дальше');

    const stopStart = src.indexOf('proto._stopDvorMusic = function(){');
    const stopEnd   = src.indexOf('\n    };', stopStart);
    const stopBody  = src.slice(stopStart, stopEnd);
    assert(/clearTimeout\(this\._dvorMusicWatchdog\);/.test(stopBody), '_stopDvorMusic() тоже отменяет сторож-таймер (не оставляет висящий setTimeout после выхода из Двора)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

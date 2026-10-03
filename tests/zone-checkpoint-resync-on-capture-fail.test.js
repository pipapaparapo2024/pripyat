/**
 * Test: батч 22.09.2026 (по прямому указанию, репорт "после прохода фулл зоны, не засчитывает
 * проход, попап «не все точки пройдены»" — воспроизводится, несмотря на расследование
 * 19.09.2026, которое не нашло повторяемого server-side бага и добавило только видимую ошибку
 * + диагностический error_log). Повторное расследование НЕ нашло нового детерминированного
 * бага в самой логике (fillCheckpoint→авто-захват→res.captured сброс/зone-popup.js→_capture()
 * всё структурно согласовано) — вместо гадания вслепую добавлены:
 *  1) Подробный лог полного состояния чекпоинтов В МОМЕНТ клика "ВЫПОЛНИТЬ", ДО решения
 *     allDone — чтобы при следующем репорте сразу видеть, где именно разошлись клиент/сервер.
 *  2) Самоисцеляющийся ресинк на код 61 (не все ячейки заполнены): перечитывает АКТУАЛЬНЫЙ
 *     udata['zone'] с сервера (users.get) и пересобирает this.locations[locIdx] через уже
 *     существующий _loadFromUdata() — следующий клик опирается на правдивое состояние, даже
 *     если корневую причину так и не поймали со второго захода.
 *
 * Run: node tests/zone-checkpoint-resync-on-capture-fail.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const zoneSrc      = readSrc('_client/src/game/zone.js');
const zonePopupSrc = readSrc('_client/src/game/zone/zone-popup.js');

console.log('\nTest 1: zone-popup.js — клик ВЫПОЛНИТЬ логирует полное состояние чекпоинтов ДО решения allDone');
{
    const start = zonePopupSrc.indexOf("this._locExecActiv.on('pointerdown', ()=>{");
    const end   = zonePopupSrc.indexOf('});', start);
    const body  = zonePopupSrc.slice(start, end);

    const logIdx    = body.indexOf("console.log('[zone-popup ВЫПОЛНИТЬ]");
    const allDoneIdx= body.indexOf('const allDone = loc.checkpoints.every');
    const branchIdx = body.indexOf('if(allDone){');
    assert(logIdx > -1, 'лог с полным состоянием чекпоинтов присутствует');
    assert(allDoneIdx > -1 && logIdx > allDoneIdx, 'лог печатается ПОСЛЕ вычисления allDone (чтобы включить его значение в вывод)');
    assert(branchIdx > -1 && logIdx < branchIdx, 'лог печатается ДО ветвления _capture()/_attack() — виден весь контекст решения');
    assert(/JSON\.stringify\(loc\.checkpoints\.map\(cp => cp\.filled \+ '\/' \+ cp\.cells\)\)/.test(body),
        'лог включает filled/cells КАЖДОЙ ячейки, не только итоговый allDone');
}

console.log('\nTest 2: zone.js._capture() — на код 61 запускает самоисцеляющийся ресинк, не просто текст');
{
    const start = zoneSrc.indexOf('_capture(locIdx){');
    const end   = zoneSrc.indexOf('_upgradeBusiness(locIdx, bizIdx){');
    const body  = zoneSrc.slice(start, end);
    assert(/if\(err && err\.code === 61\)\{/.test(body), 'ветка кода 61 сохранена');
    assert(/this\._resyncFromServer\(locIdx\);/.test(body), 'на код 61 вызывается _resyncFromServer() — не просто уведомление без действия');
}

console.log('\nTest 3: zone.js._resyncFromServer() — тянет СВЕЖИЙ zone с сервера (не из локального кэша) и пересобирает this.locations');
{
    const start = zoneSrc.indexOf('_resyncFromServer(locIdx){');
    const end   = zoneSrc.indexOf('\n    }', start);
    const body  = zoneSrc.slice(start, end);
    assert(/TS\.php\('users\.get', \{uid: vk_params\['vk_user_id'\], users: 'skip'\}/.test(body),
        'запрашивает users.get напрямую с сервера — не полагается на локальный udata, который мог быть источником расхождения');
    assert(/udata\['zone'\] = fresh\.zone;/.test(body), 'обновляет udata[\'zone\'] СВЕЖИМ значением из ответа сервера');
    assert(/this\._loadFromUdata\(\);/.test(body), 'пересобирает this.locations через уже существующий _loadFromUdata() — тот же путь, что при обычной загрузке игры');
    assert(/if\(this\._locPopup && this\._locPopup\.visible\) this\._updateLocPopup\(locIdx\);/.test(body),
        'обновляет попап локации сразу после ресинка — следующий клик увидит правдивое состояние без перезагрузки страницы');
}

console.log('\nTest 4: zone.js._resyncFromServer() устойчив к отсутствию TS/vk_params (не падает молча)');
{
    const start = zoneSrc.indexOf('_resyncFromServer(locIdx){');
    const end   = zoneSrc.indexOf('\n    }', start);
    const body  = zoneSrc.slice(start, end);
    assert(/if\(!window\.TS \|\| !window\.vk_params\) return;/.test(body), 'ранний return при отсутствии зависимостей — не бросает исключение');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

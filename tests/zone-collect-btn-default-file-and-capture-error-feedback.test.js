/**
 * Test: батч 19.09.2026 —
 *
 *  1) По прямому указанию: место под кнопку «Собрать прибыль» (X=441 Y=669, W=448 H=45)
 *     больше не пустует, пока сбор недоступен — новый файл "Когда показывается время.png"
 *     висит там ВСЕГДА как подложка под таймер обратного отсчёта, подменяется на
 *     "собрать прибыль.png" (тот же слот/размер), когда у игрока появляется доступный сбор.
 *  2) Репорт "прохожу локацию (Кордон) — прохождение не начинается заново, будто зависла":
 *     живые данные (SELECT zone FROM users) на момент репорта показали, что чекпоинты Кордона
 *     у этого игрока фактически СБРОШЕНЫ корректно (cleared:1, cps все 0) — повторяемого бага
 *     именно в логике сброса не нашли. Зато нашли реальную, воспроизводимую причину, почему
 *     это МОГЛО выглядеть как зависание: zone._capture() при любой ошибке сервера (в т.ч.
 *     fail(61) "не все ячейки заполнены" — единственный официальный сценарий использования
 *     этого эндпоинта, см. комментарий в zone.php.captureLocation) не показывал игроку вообще
 *     НИЧЕГО — кнопка "ВЫПОЛНИТЬ" выглядела так, будто просто не реагирует. Добавлены
 *     notify.showResult на обоих путях ошибки + диагностическое логирование (клиент и сервер,
 *     фактический массив cps), чтобы при повторе бага сразу было видно расхождение.
 *
 * Run: node tests/zone-collect-btn-default-file-and-capture-error-feedback.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const zoneScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');
const zoneSrc        = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'zone.js'), 'utf-8');
const zonePhp         = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'zone.php'), 'utf-8');
const IMAGES_DIR      = path.join(root, '_client', 'development', 'images');

console.log('\nTest 1: новый файл "Когда показывается время.png" скопирован в images/ (тот же слот, что собрать прибыль.png)');
{
    const newPath = path.join(IMAGES_DIR, 'Когда показывается время.png');
    const oldPath = path.join(IMAGES_DIR, 'собрать прибыль.png');
    assert(fs.existsSync(newPath), 'Когда показывается время.png существует');
    assert(fs.existsSync(oldPath), 'собрать прибыль.png (существующий файл, второе состояние) на месте');
    const readDims = (p) => { const b = fs.readFileSync(p); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
    assert(readDims(newPath) === readDims(oldPath),
        'оба файла одного размера (448x45) — честная замена в том же слоте, получили ' + readDims(newPath) + ' vs ' + readDims(oldPath));
}

console.log('\nTest 2: btnCollect создаётся ВСЕГДА видимым, по умолчанию с новым файлом, некликабельным');
{
    const m = zoneScreenSrc.match(/const btnCollect = new PIXI\.Sprite\(PIXI\.Texture\.from\(Z \+ 'Когда показывается время\.png'\)\);([\s\S]*?)win\.addChild\(btnCollect\);/);
    assert(!!m, 'btnCollect создаётся с текстурой "Когда показывается время.png" по умолчанию');
    const body = m ? m[1] : '';
    assert(/btnCollect\.visible = true;/.test(body), 'btnCollect.visible = true с самого начала (не false)');
    assert(/btnCollect\.interactive = false; btnCollect\.buttonMode = false;/.test(body),
        'по умолчанию НЕ интерактивен (это просто подложка под таймер, не кнопка)');
}

console.log('\nTest 3: _zoneUpdateCollect переключает текстуру и интерактивность по canCollect, а не видимость');
{
    const m = zoneSrc && null; // zone.js не содержит этот код — он в zone_screen.js
    const funcMatch = zoneScreenSrc.match(/proto\._zoneUpdateCollect = function\(\)\{([\s\S]*?)\n\t\};/);
    assert(!!funcMatch, '_zoneUpdateCollect найден');
    const body = funcMatch ? funcMatch[1] : '';
    assert(/this\._zoneBtnCollect\.visible = true;/.test(body), 'visible всегда true внутри апдейта (спрайт больше никогда не скрывается целиком)');
    assert(/this\._zoneBtnCollect\.texture = PIXI\.Texture\.from\(\s*Z \+ \(canCollect \? 'собрать прибыль\.png' : 'Когда показывается время\.png'\)\s*\);/.test(body),
        'текстура выбирается по canCollect: доступно → собрать прибыль.png, иначе → новый файл');
    assert(/this\._zoneBtnCollect\.interactive = canCollect;/.test(body), 'кликабелен ТОЛЬКО когда canCollect=true');
    assert(/this\._zoneBtnCollect\.buttonMode  = canCollect;/.test(body), 'buttonMode синхронизирован с canCollect');
}

console.log('\nTest 4: zone._capture() показывает игроку notify при ЛЮБОЙ ошибке (было — тихо, только console.error)');
{
    const start = zoneSrc.indexOf('_capture(locIdx){');
    const end   = zoneSrc.indexOf('// ── БИЗНЕС', start);
    assert(start !== -1 && end !== -1, '_capture найден');
    const body = zoneSrc.slice(start, end);
    assert(/notify\.showResult\(\{text:'Не удалось захватить локацию\. Попробуйте ещё раз'\}, 0\);/.test(body),
        'некорректный ответ сервера (нет patch/capture) — теперь показывает notify, не только console.error');
    assert(/if\(err && err\.code === 61\)\{/.test(body), 'ошибка сервера различает код 61 (не все ячейки заполнены) от прочих');
    assert(/notify\.showResult\(\{text:'Не все точки локации ещё выполнены\. Обновляю\.\.\.'\}, 0\);/.test(body),
        'код 61 показывает игроку осмысленное сообщение, а не общую "ошибку сервера"');
    assert(/if\(this\._locPopup && this\._locPopup\.visible\) this\._updateLocPopup\(locIdx\);/.test(body),
        'после ЛЮБОЙ ошибки попап перерисовывается — кнопка ВЫПОЛНИТЬ отражает актуальное серверное состояние, а не застывший локальный allDone');
}

console.log('\nTest 5: диагностика — клиент логирует состояние чекпоинтов до отправки и на ошибке (не только факт ошибки)');
{
    assert(/cps перед отправкой:.*JSON\.stringify\(loc\.checkpoints\.map\(cp => cp\.filled \+ '\/' \+ cp\.cells\)\)/.test(zoneSrc),
        '_capture логирует состояние cps ПЕРЕД отправкой запроса');
    assert(/cps на момент ошибки:.*JSON\.stringify\(loc\.checkpoints\.map\(cp => cp\.filled \+ '\/' \+ cp\.cells\)\)/.test(zoneSrc),
        '_capture логирует состояние cps В МОМЕНТ ошибки — для сравнения с тем, что было отправлено');
}

console.log('\nTest 6: диагностика — сервер логирует фактический cps-массив при fail(61), а не просто отклоняет запрос молча');
{
    const m = zonePhp.match(/if\(\$captureOut === null\)\{([\s\S]*?)\n            \}/);
    assert(!!m, 'блок обработки captureOut===null найден в zone.php.captureLocation');
    const body = m ? m[1] : '';
    assert(/error_log\('\[zone\.captureLocation\] fail\(61\)/.test(body), 'error_log вызывается при fail(61)');
    assert(/\$this->registry\['uid'\]/.test(body), 'лог включает uid — понятно, чей именно аккаунт');
    assert(/json_encode\(\$progress\[strval\(\$locIdx\)\]\['cps'\] \?\? null\)/.test(body),
        'лог включает фактический cps-массив ИМЕННО этой локации на сервере — при повторе бага видно расхождение с тем, что думал клиент');
    assert(/return \$this->ops->fail\(61\);/.test(body), 'fail(61) всё ещё возвращается после логирования (поведение для клиента не изменилось, только видимость для нас)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

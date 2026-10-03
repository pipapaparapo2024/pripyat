/**
 * Test: 18.09.2026 — три бага, найденные пользователем при работе с бизнесом Зоны и попапом
 * повышения уровня.
 *
 *  1) Попап «Недостаточно сигарет» появлялся ПОД попапом бизнеса. Причина:
 *     zone-biz.js — клик по «УЛУЧШИТЬ» вызывал zone._upgradeBusiness(locIdx, bi), а СРАЗУ
 *     following строкой — безусловный this._openBizPopup(). _upgradeBusiness() на
 *     недостатке сигарет синхронно показывает попап ошибки (notify.showResult →
 *     root.layer2_mc.addChild), но следующая же строка пересобирала попап бизнеса и ТОЖЕ
 *     добавляла его в layer2_mc — оказываясь последним (== поверх) добавленным ребёнком,
 *     перекрывая свежепоказанный попап ошибки. zone._upgradeBusiness() уже сама вызывает
 *     _openBizPopup() из СВОЕГО success-колбэка — второй вызов в zone-biz.js был лишним и
 *     удалён.
 *
 *  2) zone.collectLocIncome() показывал ОДИН И ТОТ ЖЕ текст "Бизнес не прокачан — дохода
 *     нет" для ЛЮБОЙ ошибки сервера — включая код 59 (8-часовой кулдаун сбора ещё не истёк,
 *     см. zone.php.collectIncome: fail(59)), из-за чего игрок с реально прокачанным
 *     бизнесом, но недавно уже собравший прибыль, видел вводящее в заблуждение сообщение.
 *     Теперь код 59 → "прибыль уже собрана", код 60 (все уровни бизнесов == 0, реально
 *     нечего собирать) → старый текст, остальное → нейтральное "не удалось собрать".
 *
 *  3) Кнопка выхода в попапе level_up.js — координаты сняты пользователем через дев-редактор
 *     позиций 18.09.2026: x=1062, y=120 (было x=1120, y=82).
 *
 * Run: node tests/zone-biz-zorder-and-collect-error-codes.test.js
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

const zoneBizSrc  = readSrc('_client/src/game/zone/zone-biz.js');
const zoneSrc     = readSrc('_client/src/game/zone.js');
const levelUpSrc  = readSrc('_client/src/game/shell/popups/level_up.js');
const zonePhpSrc  = readSrc('server/core/controllers/zone.php');

console.log('\nTest 1: клик по "УЛУЧШИТЬ" в zone-biz.js больше не дублирует _openBizPopup()');
{
    const start = zoneBizSrc.indexOf("btn.on('pointerdown', ()=>{");
    const end   = zoneBizSrc.indexOf('});', start) + 3;
    const body  = zoneBizSrc.slice(start, end);
    assert(/this\._upgradeBusiness\(locIdx, bi\);/.test(body), 'клик по-прежнему вызывает _upgradeBusiness');
    assert(!/this\._upgradeBusiness\(locIdx, bi\);\s*this\._openBizPopup\(\);/.test(body),
        'безусловный this._openBizPopup() сразу после _upgradeBusiness() удалён (дублировал success-путь и перекрывал попап ошибки)');
}

console.log('\nTest 2: zone._upgradeBusiness() по-прежнему сам переоткрывает попап ТОЛЬКО при успехе');
{
    const start = zoneSrc.indexOf('_upgradeBusiness(locIdx, bizIdx){');
    const end   = zoneSrc.indexOf('\n    }', start);
    const body  = zoneSrc.slice(start, end);
    assert(/if\(this\._bizPopup && this\._bizPopup\.parent\) this\._openBizPopup\(\);/.test(body),
        '_openBizPopup() вызывается внутри success-колбэка TS.php (единственное место, где это должно происходить)');
}

console.log('\nTest 3: zone.collectLocIncome() различает код ошибки 59 (кулдаун) и 60 (реально не прокачан)');
{
    const start = zoneSrc.indexOf('collectLocIncome(locIdx, onDone){');
    const end   = zoneSrc.indexOf('\n    }', start);
    const body  = zoneSrc.slice(start, end);
    assert(/const code = err && err\.code;/.test(body), 'код ошибки читается из err.code');
    assert(/if\(code === 59\) notify\.showResult\(\{text:'Прибыль уже собрана — попробуйте позже'\}, 0\);/.test(body),
        'код 59 (кулдаун) показывает отдельное сообщение, не "бизнес не прокачан"');
    assert(/else if\(code === 60\) notify\.showResult\(\{text:'Бизнес не прокачан — дохода нет'\}, 0\);/.test(body),
        'код 60 (реально нечего собирать) сохраняет старый текст');
    assert(/else notify\.showResult\(\{text:'Не удалось собрать прибыль'\}, 0\);/.test(body),
        'прочие коды/сетевые ошибки — нейтральный текст, не пугающий "бизнес не прокачан"');
}

console.log('\nTest 4: zone.php.collectIncome() коды 59/60 совпадают с тем, что различает клиент (регресс-гвард)');
{
    const start = zonePhpSrc.indexOf('function collectIncome(){');
    const end   = zonePhpSrc.indexOf('\n        }', zonePhpSrc.indexOf('$this->ops->ok([\'patch\' => $patch', start));
    const body  = zonePhpSrc.slice(start, end);
    assert(/return \$this->ops->fail\(59\); \/\/ кулдаун ещё не истёк/.test(body), 'fail(59) — кулдаун (сервер)');
    assert(/return \$this->ops->fail\(60\); \/\/ бизнес не прокачан/.test(body), 'fail(60) — реально нечего собирать (сервер)');
}

console.log('\nTest 5: кнопка выхода в попапе "Уровень повышен" — новые координаты (x:1062, y:120)');
{
    assert(/exitBtn\.x = 1062;/.test(levelUpSrc), 'exitBtn.x === 1062');
    assert(/exitBtn\.y = 120;/.test(levelUpSrc), 'exitBtn.y === 120');
    assert(!/exitBtn\.x = 1120;/.test(levelUpSrc), 'старая координата x=1120 удалена');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

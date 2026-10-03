/**
 * Test: награда за полную зачистку локации (zone._capture) не совпадала с ТЗ стр.15
 * ("Награда за зачистку"): Рубеж(=Кордон) 100 сигарет/10 уважения/50 опыта, Отстойник(=Свалка)
 * 200/20/100, Глухая Лощина 300/30/150, Промзона(=Агропром) 400/40/200, Очаг(=Янтарь) 500/50/250.
 *
 * Раньше формула была bonus = 500*(locIdx+1) сигарет БЕЗ уважения и опыта вообще — для Кордона
 * выходило "+500 сигарет" вместо "100 сигарет, 10 уважения, 50 опыта" (репорт пользователя).
 *
 * Проверенные по ТЗ по-клеточные (checkpoint) награды НЕ трогались — они уже совпадали 1-в-1
 * (см. Test 2), баг был именно в бонусе за зачистку локации целиком.
 *
 * Run: node tests/zone-capture-reward-tz.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const zoneSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'zone.js'), 'utf-8'
);
// 17.09.2026 (позже этого батча, перенос Зоны на сервер): _capture() больше не считает
// награду сама — она стала тонкой обёрткой над TS.php('zone.captureLocation', ...), а сама
// формула (и её начисление) переехала в zone.php._applyCaptureIfFull() — читер больше не
// может подделать "зачистил локацию" консолью и накрутить себе сигареты/уважение/опыт.
const zonePhp = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'zone.php'), 'utf-8'
);

console.log('\nTest 1: zone.php._applyCaptureIfFull() считает награду за локацию по формуле ТЗ (100/10/50 * (locIdx+1))');
{
    const start = zonePhp.indexOf('private function _applyCaptureIfFull(&$progress, $locIdx, &$user){');
    const end   = zonePhp.indexOf('\n        }', start);
    const body  = zonePhp.slice(start, end);

    assert(/\$mult = \$locIdx \+ 1;/.test(body), 'множитель — locIdx+1 (Кордон=1, Свалка=2, ...)');
    assert(/\$bonusCig = 100 \* \$mult;/.test(body), 'сигареты — 100 * mult (ТЗ: 100/200/300/400/500)');
    assert(/\$bonusResp = 10 \* \$mult;/.test(body), 'уважение — 10 * mult (ТЗ: 10/20/30/40/50)');
    assert(/\$bonusExp = 50 \* \$mult;/.test(body), 'опыт — 50 * mult (ТЗ: 50/100/150/200/250)');
    assert(/\$this->ops->add\(\$user, 'respect', \$bonusResp\);/.test(body),
        'уважение реально начисляется через Gameops::add (раньше не начислялось вообще)');
    assert(/\$this->ops->add\(\$user, 'exp', \$bonusExp\);/.test(body),
        'опыт реально начисляется через Gameops::add (раньше не начислялся вообще)');

    // Клиент по-прежнему строит попап награды из ОТВЕТА сервера (res.capture.resp/exp), не сам считает.
    assert(/\{type:'respect',\s*amount:res\.capture\.resp\}/.test(zoneSrc), 'уважение попадает в попап награды (из ответа сервера)');
    assert(/\{type:'exp',\s*amount:res\.capture\.exp\}/.test(zoneSrc), 'опыт попадает в попап награды (из ответа сервера)');

    // Реально вычисляем результат формулы для всех 5 локаций и сверяем с ТЗ дословно.
    const expected = [
        {cig:100, resp:10, exp:50},   // Кордон
        {cig:200, resp:20, exp:100},  // Свалка
        {cig:300, resp:30, exp:150},  // Глухая Долина
        {cig:400, resp:40, exp:200},  // Агропром
        {cig:500, resp:50, exp:250},  // Янтарь
    ];
    let allMatch = true;
    for(let locIdx = 0; locIdx < 5; locIdx++){
        const mult = locIdx + 1;
        const got = {cig: 100*mult, resp: 10*mult, exp: 50*mult};
        const exp = expected[locIdx];
        if(got.cig !== exp.cig || got.resp !== exp.resp || got.exp !== exp.exp) allMatch = false;
    }
    assert(allMatch, 'формула даёт ТОЧНО значения из ТЗ для всех 5 локаций (100/10/50 → 500/50/250)');
}

console.log('\nTest 2: по-клеточные (checkpoint) награды Кордона совпадают с ТЗ стр.15 (не менялись, сверка)');
{
    const cordonMatch = zoneSrc.match(/id:0, name:'Кордон'[\s\S]*?checkpoints:\[([\s\S]*?)\],\s*\n\s*businesses/);
    assert(!!cordonMatch, 'блок checkpoints Кордона найден');
    if(cordonMatch){
        const body = cordonMatch[1];
        // ТЗ: точка1 20сиг/15оп/5ув, точка2 30/20/7, точка3 40/25/9, точка4 50/30/11, точка5 60/35/13, точка6 70/40/15
        const tzRewards = [
            {cig:20, exp:15, resp:5},
            {cig:30, exp:20, resp:7},
            {cig:40, exp:25, resp:9},
            {cig:50, exp:30, resp:11},
            {cig:60, exp:35, resp:13},
            {cig:70, exp:40, resp:15},
        ];
        const rewardMatches = [...body.matchAll(/reward:\{cig:(\d+),\s*exp:(\d+),\s*resp:(\d+)\s*\}/g)];
        assert(rewardMatches.length === 6, 'найдено 6 точек с наградами (по числу точек в ТЗ)');
        let allMatch = rewardMatches.length === 6;
        rewardMatches.forEach((mm, i) => {
            const got = {cig: +mm[1], exp: +mm[2], resp: +mm[3]};
            const exp = tzRewards[i];
            if(got.cig !== exp.cig || got.exp !== exp.exp || got.resp !== exp.resp) allMatch = false;
        });
        assert(allMatch, 'все 6 точек Кордона совпадают с ТЗ дословно — баг был только в бонусе за локацию целиком, не в точках');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

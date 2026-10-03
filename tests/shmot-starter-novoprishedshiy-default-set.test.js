/**
 * Test: 26.09.2026, РЕВЕРТ по прямому указанию — "изначально у каждого игрока нет сета
 * новопришедшего, но его можно купить в магазине без проблем за сигареты (условная цена)".
 *
 * 25.09.2026 в этом же проекте была сделана ПРОТИВОПОЛОЖНАЯ вещь (автовыдача стартового сета
 * "новопришедший" owned+equipped=true при создании аккаунта/сбросе, см. старую версию этого же
 * файла в git-истории) — по прямому указанию пользователя ОТМЕНЕНА полностью. Новое требование:
 * 3 предмета сета "новопришедший" (id94 обувь/id95 футболка/id97 шорты) становятся ОБЫЧНЫМИ
 * покупными товарами за сигареты — ничем не отличаются от любого другого товара shmot-магазина
 * (та же честная покупка через shmot.php.buy(), та же кнопка "купить" в shmot_shop.js).
 *
 * Цены выбраны исполнителем (пользователь разрешил): футболка 200, шорты 100, обувь 150 —
 * "условные копейки", подтверждено пользователем как ориентир.
 *
 * Run: node tests/shmot-starter-novoprishedshiy-default-set.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const shmotJsSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const shmotCatalog = JSON.parse(fs.readFileSync(path.join(root, 'server', 'json', 'shmot_items.json'), 'utf-8'));

console.log('\nTest 1: users.php — автовыдача стартового набора убрана целиком (_starterShmotJson не существует)');
{
    assert(!/_starterShmotJson/.test(usersSrc), 'ни одного упоминания _starterShmotJson не осталось (ни определения, ни вызова)');
}

console.log('\nTest 2: users.php — создание нового аккаунта и сброс снова используют пустой \'[]\', не спецлогику');
{
    const getStart = usersSrc.indexOf('function get(){');
    const getEnd   = usersSrc.indexOf('function getProfile(', getStart);
    const getBody  = usersSrc.slice(getStart, getEnd);
    assert(/'shmot'=>'\[\]'/.test(getBody), 'get() — создание нового аккаунта: shmot снова пустой массив');

    const resetStart = usersSrc.indexOf('private function _defaultResetUdata(){');
    const resetEnd   = usersSrc.indexOf('\n        }', usersSrc.indexOf('gang_id', resetStart));
    const resetBody  = usersSrc.slice(resetStart, resetEnd);
    assert(/'shmot'=>'\[\]'/.test(resetBody), '_defaultResetUdata() — сброс аккаунта: shmot снова пустой массив');
}

console.log('\nTest 3: shmot_items.json (сервер, реальный источник цены для shmot.php.buy()) — id94/95/97 продаются за сигареты');
{
    const expected = { 94: 150, 95: 200, 97: 100 };
    Object.entries(expected).forEach(([id, price]) => {
        const it = shmotCatalog.find(x => x.id === Number(id));
        assert(!!it, `id${id} существует в каталоге`);
        assert(it && it.price && it.price.type === 'cig', `id${id} — тип цены 'cig' (сигареты)`);
        assert(it && it.price && it.price.a === price, `id${id} — цена ${price} сигарет`);
    });
    // Регресс-гвард: старая метка source:'starter' убрана — товар больше не "особый".
    [94, 95, 97].forEach(id => {
        const it = shmotCatalog.find(x => x.id === id);
        assert(!it.source || it.source !== 'starter', `id${id} — старая метка source:'starter' убрана из каталога`);
    });
}

console.log('\nTest 4: game/shmot.js (клиент, для отображения цены/кнопки "купить" в магазине) — те же 3 предмета, та же цена');
{
    const expected = [[94, 150], [95, 200], [97, 100]];
    expected.forEach(([id, price]) => {
        const re = new RegExp(`\\{id:${id},[^}]*price:\\{type:'cig',a:${price}\\}`);
        assert(re.test(shmotJsSrc), `id:${id} в shmot.js имеет price:{type:'cig',a:${price}} (совпадает с сервером)`);
    });
    const novoLines = shmotJsSrc.split('\n').filter(l => l.includes("set:'новопришедший'"));
    assert(novoLines.length === 3, 'найдено ровно 3 строки предметов сета новопришедший');
    assert(novoLines.every(l => !l.includes('price:null')), 'ни одна из них не содержит price:null (все теперь покупные)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

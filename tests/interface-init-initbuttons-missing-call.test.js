/**
 * Test: найдено 24.09.2026 по живому репорту "нижний ХУД вообще не кликабельный, ничего не
 * происходит при нажатии на вкладки снизу". initButtons() (interface/interface-panels.js) —
 * единственное место, где вешается pointerdown на кнопки нижней панели (butt_weapons/
 * butt_shmot/butt_bosses/butt_zone/butt_vassilich) и часть верхней (butt_bank/butt_settings/
 * иконки валют) — нигде не вызывался (та же природа бага, что и initNickLabel(), см.
 * interface-upinit-nicklabel-missing-call.test.js).
 *
 * Run: node tests/interface-init-initbuttons-missing-call.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const interfaceSrc = fs.readFileSync(path.join(root, '_client/src/game/interface.js'), 'utf-8');
const panelsSrc     = fs.readFileSync(path.join(root, '_client/src/game/interface/interface-panels.js'), 'utf-8');

console.log('\nTest: init() вызывает initButtons()');
{
    const start = interfaceSrc.indexOf('init(){');
    const end   = interfaceSrc.indexOf('\n\tupInit(){', start);
    const body  = interfaceSrc.slice(start, end);

    assert(!!body && start !== -1, 'init() найден');
    assert(body.includes('this.upInit();'), 'upInit() по-прежнему вызывается');
    assert(body.includes('this.downInit();'), 'downInit() по-прежнему вызывается');
    assert(body.includes('this.initButtons();'), 'this.initButtons() вызывается внутри init() — иначе кнопки HUD не кликабельны');

    const upIdx   = body.indexOf('this.upInit();');
    const downIdx = body.indexOf('this.downInit();');
    const btnIdx  = body.indexOf('this.initButtons();');
    assert(upIdx !== -1 && downIdx !== -1 && btnIdx !== -1 && upIdx < downIdx && downIdx < btnIdx,
        'порядок: upInit() → downInit() → initButtons() (кнопки навешиваются после того, как обе панели готовы)');
}

console.log('\nTest: initButtons() по-прежнему вешает обработчики на все шесть нижних кнопок и ключевые верхние');
{
    const start = panelsSrc.indexOf('proto.initButtons = function(){');
    const end   = panelsSrc.indexOf('\n    };', start);
    const body  = panelsSrc.slice(start, end);

    assert(!!body && start !== -1, 'proto.initButtons найден в interface-panels.js');
    for (const btn of ['butt_bank', 'butt_settings']) {
        assert(body.includes('this.up.' + btn), `initButtons() ссылается на верхнюю кнопку ${btn}`);
    }
    for (const btn of ['butt_bosses', 'butt_zone', 'butt_vassilich']) {
        assert(body.includes('this.down.' + btn), `initButtons() вешает обработчик на нижнюю кнопку ${btn}`);
    }
    assert(/downBtns\s*=\s*\{\s*butt_weapons:'weapons',\s*butt_shmot:'shmot'\s*\}/.test(body),
        'weapons/shmot по-прежнему навешиваются через общий цикл downBtns');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

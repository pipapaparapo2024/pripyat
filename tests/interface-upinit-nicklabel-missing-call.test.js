/**
 * Test: найдена 24.09.2026 аномалия при разборе консольной ошибки "Cannot set properties of
 * undefined (setting 'text') at updateNick" — interface.js.initNickLabel() создаёт this.nick_txt/
 * this.level_txt/this.exp_bar/this.energy_txt/this.energy_bar/этс, но нигде в кодовой базе не
 * вызывался (потерян при рефакторинге). upInit() вызывал updateUp()/updateNick()/updateEnergy()
 * сразу, а они читают эти поля как уже существующие — this.nick_txt был всегда undefined.
 *
 * Run: node tests/interface-upinit-nicklabel-missing-call.test.js
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

console.log('\nTest: upInit() вызывает initNickLabel() до updateNick()/updateEnergy()');
{
    const start = interfaceSrc.indexOf('upInit(){');
    const end   = interfaceSrc.indexOf('\n\tupdateUp(){', start);
    const body  = interfaceSrc.slice(start, end);

    assert(!!body && start !== -1, 'upInit() найден');

    const initIdx   = body.indexOf('this.initNickLabel();');
    const updUpIdx  = body.indexOf('this.updateUp();');
    const updNickIdx = body.indexOf('this.updateNick();');
    const updEnIdx   = body.indexOf('this.updateEnergy();');

    assert(initIdx !== -1, 'this.initNickLabel() вызывается внутри upInit()');
    assert(updNickIdx !== -1 && updEnIdx !== -1, 'updateNick()/updateEnergy() по-прежнему вызываются в upInit()');
    assert(initIdx !== -1 && updUpIdx !== -1 && initIdx < updUpIdx,
        'initNickLabel() вызывается ДО updateUp()');
    assert(initIdx !== -1 && updNickIdx !== -1 && initIdx < updNickIdx,
        'initNickLabel() вызывается ДО updateNick() — иначе this.nick_txt/this.level_txt/this.exp_bar ещё undefined');
    assert(initIdx !== -1 && updEnIdx !== -1 && initIdx < updEnIdx,
        'initNickLabel() вызывается ДО updateEnergy() — иначе this.energy_txt/this.energy_bar ещё undefined');
}

console.log('\nTest: initNickLabel() по-прежнему создаёт все поля, которые читают updateNick()/updateEnergy()');
{
    const start = interfaceSrc.indexOf('initNickLabel(){');
    const end   = interfaceSrc.indexOf('\n\tupdateNick(){', start);
    const body  = interfaceSrc.slice(start, end);

    assert(!!body && start !== -1, 'initNickLabel() найден');
    for (const field of ['this.nick_txt', 'this.level_txt', 'this.exp_bar', 'this.energy_txt', 'this.energy_bar', 'this.energy_timer_txt']) {
        assert(body.includes(field + ' ='), `initNickLabel() создаёт ${field}`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

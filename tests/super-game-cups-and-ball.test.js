/**
 * Test: «Стаканчики» (super_game.js) — DEV-only демо-мини-игра, добавлена 24.09.2026.
 *
 * 25.09.2026 (по прямому указанию, в 2 шага):
 *  1) dev-панель перестала её открывать — кнопка "Стаканчики/ОТКРЫТЬ" заменена на форс
 *     джекпота (см. tests/roulette-dev-force-jackpot.test.js), сам модуль пока остался в
 *     проекте, но стал полностью недостижим через UI.
 *  2) Раз модуль стал мёртвым кодом (никто его больше не вызывает) — файл удалён целиком,
 *     вместе с импортом/подключением в interface.js. Этот тест теперь проверяет именно
 *     ПОЛНОЕ УДАЛЕНИЕ, а не поведение самой игры (её больше нет).
 *
 * Run: node tests/super-game-cups-and-ball.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\n1) super_game.js физически удалён из проекта');
{
    assert(!fs.existsSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'super_game.js')),
        'файл _client/src/game/shell/overlays/super_game.js больше не существует');
}

console.log('\n2) interface.js — ни импорта, ни подключения attachSuperGame не осталось');
{
    const ifaceSrc = read('_client/src/game/interface.js');
    assert(!/attachSuperGame/.test(ifaceSrc), 'ни одного упоминания attachSuperGame в interface.js (ни import, ни вызов)');
    assert(!/super_game\.js/.test(ifaceSrc), 'путь к super_game.js нигде не остался');
    // Соседние подключения (тот же паттерн attachX(Interface.prototype)) не задеты правкой.
    assert(/attachDevPanel\(Interface\.prototype\);/.test(ifaceSrc), 'attachDevPanel всё ещё подключён (соседняя строка не пострадала)');
    assert(/attachUniversalPosEditor\(Interface\.prototype\);/.test(ifaceSrc), 'attachUniversalPosEditor всё ещё подключён (соседняя строка не пострадала)');
}

console.log('\n3) dev_panel.js — по-прежнему не вызывает _openSuperGame (уже проверено ранее, сверяем ещё раз после удаления файла)');
{
    const devSrc = read('_client/src/game/shell/overlays/dev_panel.js');
    assert(!/_openSuperGame/.test(devSrc), 'dev-панель нигде не ссылается на удалённый метод');
}

console.log('\n4) Нигде в клиентском коде не осталось живых вызовов удалённых методов');
{
    const path2 = require('path');
    function walk(dir, out){
        for(const f of fs.readdirSync(dir)){
            const p = path2.join(dir, f);
            if(fs.statSync(p).isDirectory()) walk(p, out);
            else if(f.endsWith('.js')) out.push(p);
        }
    }
    const files = [];
    walk(path2.join(root, '_client', 'src'), files);
    const offenders = [];
    for(const f of files){
        const s = fs.readFileSync(f, 'utf-8');
        if(/_openSuperGame\(\)|_pickSuperGameCup\(|_revealSuperGameCup\(|_resetSuperGame\(/.test(s)) offenders.push(f);
    }
    assert(offenders.length === 0, 'ни один файл в _client/src не вызывает удалённые методы super_game.js (найдено: ' + offenders.join(', ') + ')');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 24.09.2026 (по прямому указанию, живой вопрос — "почему я через редактор не
 * могу менять расположение файлов в верхнем ХУДе?").
 *
 * Корень: interface.js.restoreHud() при показе верхнего ХУДа клал this.up ПРЯМО в root,
 * минуя root.layer0_mc/layer1_mc/layer2_mc — эта функция вызывается почти на каждом открытии/
 * закрытии любого экрана (30+ мест по всей игре), т.е. this.up практически всегда жил вне
 * трёх слоёв. Хит-тест universal_pos_editor.js (_uFindAllAt/_uCollectAt) жёстко сканирует
 * ТОЛЬКО эти три слоя — бэрый root не проверяет вообще (см. universal_pos_editor.js:640-645).
 * Поэтому клик по любому объекту верхнего ХУДа в режиме редактора не находил вообще ничего.
 *
 * Нижний ХУД (this.down) всегда клался в root.layer2_mc и был доступен редактору без проблем —
 * баг был именно в асимметрии между up/down внутри одной функции.
 *
 * Фикс: this.up тоже кладётся в root.layer2_mc (как this.down) — редактор теперь находит его
 * через тот же путь сканирования, которым уже пользуется для нижнего ХУДа.
 *
 * Run: node tests/hud-top-reparent-layer2-for-pos-editor.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const ifaceSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface.js'), 'utf-8');
const editorSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');
const bossesSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses.js'), 'utf-8');
const skillsSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'skills.js'), 'utf-8');

console.log('\nTest 1: restoreHud() кладёт this.up в root.layer2_mc, а не прямо в root');
{
    const start = ifaceSrc.indexOf('restoreHud(){');
    const end   = ifaceSrc.indexOf('\n\t}', start);
    const body  = ifaceSrc.slice(start, end);
    assert(/if\(this\.up\) root\.layer2_mc\.addChild\(this\.up\);/.test(body),
        'this.up переносится в root.layer2_mc (та же ветка, что и this.down)');
    assert(!/if\(this\.up\) root\.addChild\(this\.up\);/.test(body),
        'КРИТИЧНО: старая версия (голый root.addChild, без слоя) больше не осталась');
}

console.log('\nTest 2: this.down по-прежнему кладётся в тот же root.layer2_mc (симметрия up/down сохранена)');
{
    const start = ifaceSrc.indexOf('restoreHud(){');
    const end   = ifaceSrc.indexOf('\n\t}', start);
    const body  = ifaceSrc.slice(start, end);
    assert(/this\.down\.visible = true;\s*\n\s*root\.layer2_mc\.addChild\(this\.down\);/.test(body),
        'this.down всё так же переносится в root.layer2_mc при показе — up и down теперь в одном слое');
}

console.log('\nTest 3: регресс-гвард — хит-тест редактора позиций реально сканирует только эти три слоя (подтверждает, почему фикс работает)');
{
    assert(/return this\._uCollectAt\(root\.layer1_mc, gx, gy, \[\]\)\.concat\(this\._uCollectAt\(root\.layer0_mc, gx, gy, \[\]\)\);/.test(editorSrc),
        '_uFindAllAt() падает на layer1_mc+layer0_mc после проверки layer2_mc — root напрямую нигде не сканируется');
    assert(/const l2 = this\._uCollectAt\(root\.layer2_mc, gx, gy, \[\]\);/.test(editorSrc),
        '_uFindAllAt() в первую очередь сканирует layer2_mc — именно туда теперь попадает this.up');
}

console.log('\nTest 4: регресс-гвард — "поднять поверх своего текущего родителя" в bosses.js/skills.js не завязаны на конкретный слой (не сломаны переносом)');
{
    assert(/if\(iface\.up   && iface\.up\.parent\)   iface\.up\.parent\.addChild\(iface\.up\);/.test(bossesSrc),
        'bosses.js поднимает iface.up через iface.up.parent (родитель-агностично, слой не важен)');
    assert(/if\(window\.iface && iface\.up && iface\.up\.parent\) iface\.up\.parent\.addChild\(iface\.up\);/.test(skillsSrc),
        'skills.js делает то же самое — оба места продолжат работать независимо от того, какой именно слой сейчас родитель');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

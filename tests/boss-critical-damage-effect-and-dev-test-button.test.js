/**
 * Test: батч 25.09.2026 (по прямому указанию) — эффект "Критический урон":
 *
 * 1) Новый файл "эффект критический урон.png" добавлен спрайтом в bosses_fight.js (скрыт по
 *    умолчанию), показывается на РЕАЛЬНОМ критическом ударе (res.critical, уже считается
 *    сервером в bosses.php — critChance от скиллов, см. bosses-combat.js._attack()).
 * 2) Dev-панель: кнопка "Бой + крит-эффект / ОХОТНИК" открывает обычный бой с Охотником (та
 *    же цепочка проверок, что у игрока) и принудительно показывает эффект БЕЗ автоскрытия —
 *    для позиционирования через universal_pos_editor.js.
 *
 * 25.09.2026 (повторное указание тем же днём — "каждый раз выбирается рандомная позиция из
 * вариантов"): пользователь прислал 4 варианта позиции/масштаба/поворота ОДНОГО файла эффекта,
 * снятые редактором позиций. Добавлен CRIT_EFFECT_VARIANTS + _pickCritEffectVariant(), общий
 * для _showCriticalEffect() (реальный бой) и _devShowCriticalEffectPersistent() (dev-панель) —
 * см. секцию 7 ниже.
 *
 * Run: node tests/boss-critical-damage-effect-and-dev-test-button.test.js
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

const fightSrc  = read('_client/src/game/shell/overlays/bosses_fight.js');
const combatSrc = read('_client/src/game/bosses/bosses-combat.js');
const devSrc    = read('_client/src/game/shell/overlays/dev_panel.js');

console.log('\n1) Ассет реально скопирован в проект');
{
    assert(fs.existsSync(path.join(root, '_client', 'development', 'images', 'эффект критический урон.png')),
        'файл "эффект критический урон.png" существует в _client/development/images/');
}

console.log('\n2) bosses_fight.js — спрайт эффекта создан, скрыт по умолчанию, сохранён в this._bossCritEffectSpr');
{
    assert(/PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/эффект критический урон\.png'\)\)/.test(fightSrc),
        'спрайт создаётся из нового файла');
    const idx = fightSrc.indexOf("PIXI.Texture.from('./images/эффект критический урон.png')");
    const block = fightSrc.slice(idx, idx + 300);
    assert(/critEffect\.visible = false;/.test(block), 'скрыт по умолчанию (не виден в обычном бою без крита)');
    assert(/this\._bossCritEffectSpr = critEffect;/.test(block), 'сохранён в this._bossCritEffectSpr для показа из других методов/файлов');
}

console.log('\n3) _showCriticalEffect() — показывает эффект и автоматически скрывает через некоторое время');
{
    const start = fightSrc.indexOf('proto._showCriticalEffect = function');
    const end   = fightSrc.indexOf('\n    };', start);
    const body  = fightSrc.slice(start, end);
    assert(start !== -1, '_showCriticalEffect определён');
    assert(/spr\.visible = true;/.test(body), 'делает спрайт видимым');
    assert(/spr\.visible = false/.test(body), 'где-то скрывает обратно (авто-скрытие, не остаётся навсегда)');
}

console.log('\n4) _devShowCriticalEffectPersistent() — показывает БЕЗ авто-скрытия (для позиционирования)');
{
    const start = fightSrc.indexOf('proto._devShowCriticalEffectPersistent = function');
    const end   = fightSrc.indexOf('\n    };', start);
    const body  = fightSrc.slice(start, end);
    assert(start !== -1, '_devShowCriticalEffectPersistent определён');
    assert(/spr\.visible = true;/.test(body), 'делает спрайт видимым');
    assert(!/setTimeout|gsap\.to\(spr/.test(body), 'НЕ планирует автоскрытие — спрайт остаётся видимым, пока не позиционируют вручную');
}

console.log('\n5) bosses-combat.js._attack() — вызывает _showCriticalEffect() именно при res.critical===true');
{
    const start = combatSrc.indexOf('proto._attack = function');
    const end   = combatSrc.lastIndexOf('};');
    const body  = combatSrc.slice(start, end);
    assert(/if\(res\.critical && window\.iface && typeof iface\._showCriticalEffect === 'function'\) iface\._showCriticalEffect\(\);/.test(body),
        'вызов условный — только когда сервер вернул res.critical===true, не на каждый удар');
}

console.log('\n6) dev_panel.js — кнопка "Бой + крит-эффект / ОХОТНИК" открывает обычный бой (bossIdx=0, diffIdx=0) и форсирует эффект');
{
    assert(/iface\._openBossesFight\(0, 0\);/.test(devSrc), 'открывает бой с Охотником (bossIdx=0) в обычном режиме (diffIdx=0) — та же цепочка проверок, что у игрока');
    assert(/iface\._devShowCriticalEffectPersistent\(\);/.test(devSrc), 'вызывает именно persistent-версию (без авто-скрытия), не обычную _showCriticalEffect');
    assert(/iface\._bossCritEffectSpr/.test(devSrc), 'ждёт появления спрайта (экран боя строится асинхронно) вместо фиксированной задержки');
}

console.log('\n7) CRIT_EFFECT_VARIANTS — 4 варианта позиции/масштаба/поворота (снятые редактором позиций)');
{
    assert(/const CRIT_EFFECT_VARIANTS = \[/.test(fightSrc), 'CRIT_EFFECT_VARIANTS определён на уровне модуля');
    const variants = [
        {x: 396, y: 275, scale: 1.042, rot: -9},
        {x: 971, y: 237, scale: 1.176, rot: 61},
        {x: 513, y: 451, scale: 0.977, rot: 0},
        {x: 760, y: 422, scale: 1.157, rot: 51},
    ];
    for (const v of variants) {
        const needle = `{x: ${v.x}, y: ${v.y}, scale: ${v.scale}, rot: ${v.rot}}`;
        assert(fightSrc.includes(needle), `вариант присутствует: ${needle}`);
    }
}

console.log('\n8) _pickCritEffectVariant() — выбирает случайный вариант, конвертирует градусы в радианы для PIXI');
{
    const start = fightSrc.indexOf('proto._pickCritEffectVariant = function');
    const end   = fightSrc.indexOf('\n    };', start);
    const body  = fightSrc.slice(start, end);
    assert(start !== -1, '_pickCritEffectVariant определён');
    assert(/CRIT_EFFECT_VARIANTS\[Math\.floor\(Math\.random\(\) \* CRIT_EFFECT_VARIANTS\.length\)\]/.test(body),
        'случайный индекс по длине массива вариантов (не захардкожен на один вариант)');
    assert(/spr\.x = v\.x; spr\.y = v\.y;/.test(body), 'применяет x/y выбранного варианта');
    assert(/spr\.scale\.set\(v\.scale\);/.test(body), 'применяет scale выбранного варианта');
    assert(/spr\.rotation = v\.rot \* Math\.PI \/ 180;/.test(body),
        'rot из редактора (градусы) конвертируется в радианы для PIXI.rotation');
}

console.log('\n9) _showCriticalEffect() и _devShowCriticalEffectPersistent() оба вызывают _pickCritEffectVariant() — dev-режим показывает тот же разброс, что реальный бой');
{
    const showStart = fightSrc.indexOf('proto._showCriticalEffect = function');
    const showEnd   = fightSrc.indexOf('\n    };', showStart);
    assert(/this\._pickCritEffectVariant\(\);/.test(fightSrc.slice(showStart, showEnd)),
        '_showCriticalEffect вызывает _pickCritEffectVariant перед показом');

    const devStart = fightSrc.indexOf('proto._devShowCriticalEffectPersistent = function');
    const devEnd   = fightSrc.indexOf('\n    };', devStart);
    assert(/this\._pickCritEffectVariant\(\);/.test(fightSrc.slice(devStart, devEnd)),
        '_devShowCriticalEffectPersistent тоже вызывает _pickCritEffectVariant');
}

console.log('\n10) Фиксированной позиции (x:640/y:300) при создании спрайта больше нет — она задаётся только при показе');
{
    const idx = fightSrc.indexOf("PIXI.Texture.from('./images/эффект критический урон.png')");
    const block = fightSrc.slice(idx, idx + 300);
    assert(!/critEffect\.x = 640; critEffect\.y = 300;/.test(block),
        'старая фиксированная позиция убрана из блока создания спрайта');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

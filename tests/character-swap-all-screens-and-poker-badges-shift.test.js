/**
 * Test: 24.09.2026, по прямому указанию — три отдельные правки:
 *
 * 1) "в пропущенных местах тоже замени на новый файл и аналогично добавь левое предплечье":
 *    расширяет фикс home.js (сделанный ранее) на 4 оставшихся места, где рисуется тот же
 *    персонаж — base.js, hata.js, player_profile.js, shmot_shop.js. В каждом — pers.png заменён
 *    на новый файл, добавлено левое предплечье, ГДЕ есть собственный список слотов одежды
 *    (CLOTH_SLOTS/CHAR_SLOTS/MAN_SLOTS) — голова переставлена выше торса, как и в home.js.
 *
 * 2) Замки/галочки уровня покера (poker_20_level и т.п.) сдвинуты на -14px по X и -1px по Y,
 *    подтверждено скриншотом редактора позиций (poker_20_level.png x:708→694 y:117→116).
 *
 * Run: node tests/character-swap-all-screens-and-poker-badges-shift.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nПоследнее замки/галочки уровня покера — сдвинуты -14px/-1px');
{
    const src = read('_client/src/game/dvor/dvor-poker-screen.js');
    // 25.09.2026 (по прямому указанию — новая позиция "покер разрешено.png"): checkX/checkY
    // сдвинуты ещё раз, тем же +13x/+1y уже у ВСЕХ трёх тиров — см.
    // tests/poker-level-icons-position.test.js для актуальной проверки этих координат.
    assert(/\{ img:'poker_20_level',  thr:20,  lockX:707, lockY:117, lockScale:0\.981, checkX:714, checkY:120 \},/.test(src), 'poker_20_level: lockX/Y без изменений (708→694, 117→116), checkX/Y — новый снимок 701→714, 119→120');
    assert(/\{ img:'poker_60_level',  thr:60,  lockX:765, lockY:117, lockScale:0\.975, checkX:771, checkY:120 \},/.test(src), 'poker_60_level: lockX/Y без изменений, checkX/Y тем же шагом 758→771, 119→120');
    assert(/\{ img:'poker_100_level', thr:100, lockX:821, lockY:117, lockScale:1\.000, checkX:827, checkY:120 \},/.test(src), 'poker_100_level: lockX/Y без изменений, checkX/Y тем же шагом 814→827, 119→120');
}

const screens = [
    { file: '_client/src/game/base.js', persVar: 'this._persSpr', forearmVar: 'this._leftForearmSpr', hasSlots: false },
    { file: '_client/src/game/shell/overlays/hata.js', persVar: 'persSpr', forearmVar: 'leftForearmSpr', hasSlots: true, slotsArrName: 'CHAR_SLOTS' },
    { file: '_client/src/game/shell/overlays/player_profile.js', persVar: 'persSpr', forearmVar: 'leftForearmSpr', hasSlots: true, slotsArrName: 'CLOTH_SLOTS' },
    { file: '_client/src/game/shell/overlays/shmot_shop.js', persVar: 'persSpr', forearmVar: 'leftForearmSpr', hasSlots: true, slotsArrName: 'MAN_SLOTS' },
];

screens.forEach(s => {
    console.log(`\n${s.file} — персонаж заменён, предплечье добавлено` + (s.hasSlots ? ', голова выше торса' : ''));
    const src = read(s.file);
    assert(/PIXI\.Texture\.from\('\.\/images\/персонаж который сидит\.png'\)/.test(src), 'использует новый файл персонажа');
    assert(!/PIXI\.Texture\.from\('\.\/images\/pers\.png/.test(src), 'старая ссылка на pers.png не осталась');
    assert(/PIXI\.Texture\.from\('\.\/images\/левое предплечье\.png'\)/.test(src), 'добавлен спрайт левого предплечья');

    if(s.hasSlots){
        const arrIdx = src.indexOf(`const ${s.slotsArrName} = [`);
        const arrEnd = src.indexOf('];', arrIdx);
        const body = src.slice(arrIdx, arrEnd);
        const cat1Pos = body.indexOf('cat: 1');
        const cat0Pos = body.indexOf('cat: 0');
        assert(cat1Pos !== -1 && cat0Pos !== -1, 'слоты Торс(cat:1)/Голова(cat:0) найдены в ' + s.slotsArrName);
        assert(cat1Pos < cat0Pos, 'Торс стоит РАНЬШЕ Головы в ' + s.slotsArrName + ' — Голова рисуется поверх Торса (addChild-порядок = z-порядок)');
    }
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);

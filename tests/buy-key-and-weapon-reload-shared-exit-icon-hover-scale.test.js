/**
 * Test: 29.09.2026, по прямому указанию — два независимых уточнения тем же днём:
 *
 * 1) Новый выделенный ассет крестика выхода "выход попап покупки ключей и кд оружия.png"
 *    (было общее "layers/popups/bosses/exit.png" + scale 0.597) — используется ОБОИМИ
 *    попапами (buy_key_popup.js и weapon_reload_popup.js) на одних и тех же координатах
 *    x:861 y:196 (было 865/200). Новый ассет уже нужного размера — отдельный scale не нужен.
 *
 * 2) "для всех кнопок небольшой hover эффект увеличения scale" — к существующему
 *    альфа-затемнению на pointerover/pointerout добавлено scale.set(1.08)/scale.set(1) для
 *    каждой интерактивной кнопки этих двух попапов (buyBtn/rushBtn/оба exitBtn).
 *
 * Run: node tests/buy-key-and-weapon-reload-shared-exit-icon-hover-scale.test.js
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

const buyKeyPopupSrc = readSrc('_client/src/game/shell/overlays/buy_key_popup.js');
const weaponPopupSrc = readSrc('_client/src/game/shell/overlays/weapon_reload_popup.js');
const imgDir = path.join(root, '_client', 'development', 'images');

console.log('\nTest 1: новый файл иконки выхода реально лежит на диске (PNG + WebP-пара)');
{
    const png  = path.join(imgDir, 'выход попап покупки ключей и кд оружия.png');
    const webp = png + '.webp';
    assert(fs.existsSync(png), 'PNG-файл иконки выхода существует в _client/development/images/');
    assert(fs.existsSync(webp), 'WebP-пара иконки выхода существует рядом (make_webp.py)');
}

console.log('\nTest 2: buy_key_popup.js — exitBtn использует новый ассет на x:861 y:196, без scale.set(0.597)');
{
    assert(/const exitBtn = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'выход попап покупки ключей и кд оружия\.png'\)\);/.test(buyKeyPopupSrc),
        'exitBtn загружает новый ассет "выход попап покупки ключей и кд оружия.png"');
    assert(/exitBtn\.x = 861; exitBtn\.y = 196;/.test(buyKeyPopupSrc), 'exitBtn.x=861 exitBtn.y=196');
    assert(!/PIXI\.Texture\.from\(BASE \+ 'layers\/popups\/bosses\/exit\.png'\)/.test(buyKeyPopupSrc),
        'старый общий ассет exit.png больше НЕ загружается в реальном коде (упоминание в комментарии-истории допустимо)');
    assert(!/exitBtn\.scale\.set\(0\.597\)/.test(buyKeyPopupSrc), 'старый scale 0.597 убран (новый ассет уже нужного размера)');
}

console.log('\nTest 3: weapon_reload_popup.js — exitBtn использует тот же новый ассет на тех же координатах');
{
    assert(/const exitBtn = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'выход попап покупки ключей и кд оружия\.png'\)\);/.test(weaponPopupSrc),
        'exitBtn загружает тот же новый ассет');
    assert(/exitBtn\.x = 861; exitBtn\.y = 196;/.test(weaponPopupSrc), 'exitBtn.x=861 exitBtn.y=196 — те же координаты, что в buy_key_popup.js');
    assert(!/PIXI\.Texture\.from\(BASE \+ 'layers\/popups\/bosses\/exit\.png'\)/.test(weaponPopupSrc),
        'старый общий ассет exit.png больше НЕ загружается в реальном коде (упоминание в комментарии-истории допустимо)');
    assert(!/exitBtn\.scale\.set\(0\.597\)/.test(weaponPopupSrc), 'старый scale 0.597 убран');
}

// 30.09.2026 (прогон перед деплоем — тест обновлён): оба попапа выровнены на плавные _sa/_ss
// (ui_kit.js, requestAnimationFrame-интерполяция) вместо мгновенного присваивания alpha/scale —
// тот же "один и тот же стиль", что и заявлен в шапках обоих файлов, буквально одинаков теперь.
console.log('\nTest 4: buy_key_popup.js — все интерактивные кнопки (buyBtn/exitBtn) получили hover-scale 1.08 в дополнение к alpha (через _sa/_ss)');
{
    assert(/buyBtn\.on\('pointerover', \(\) => \{ _sa\(buyBtn, 0\.85\); _ss\(buyBtn, 1\.08\); \}\);/.test(buyKeyPopupSrc),
        'buyBtn pointerover: alpha=0.85 И scale=1.08');
    assert(/buyBtn\.on\('pointerout',  \(\) => \{ _sa\(buyBtn, 1\); _ss\(buyBtn, 1\); \}\);/.test(buyKeyPopupSrc),
        'buyBtn pointerout: alpha=1 И scale возвращается к 1 (не остаётся увеличенной)');
    assert(/exitBtn\.on\('pointerover', \(\) => \{ _sa\(exitBtn, 0\.75\); _ss\(exitBtn, 1\.08\); \}\);/.test(buyKeyPopupSrc),
        'exitBtn pointerover: alpha=0.75 И scale=1.08');
    assert(/exitBtn\.on\('pointerout',  \(\) => \{ _sa\(exitBtn, 1\); _ss\(exitBtn, 1\); \}\);/.test(buyKeyPopupSrc),
        'exitBtn pointerout: alpha=1 И scale возвращается к 1');
}

console.log('\nTest 5: weapon_reload_popup.js — все интерактивные кнопки (rushBtn/exitBtn) получили hover-scale 1.08 в дополнение к alpha (через _sa/_ss)');
{
    assert(/rushBtn\.on\('pointerover', \(\) => \{ _sa\(rushBtn, 0\.85\); _ss\(rushBtn, 1\.08\); \}\);/.test(weaponPopupSrc),
        'rushBtn pointerover: alpha=0.85 И scale=1.08');
    assert(/rushBtn\.on\('pointerout',  \(\) => \{ _sa\(rushBtn, 1\); _ss\(rushBtn, 1\); \}\);/.test(weaponPopupSrc),
        'rushBtn pointerout: alpha=1 И scale возвращается к 1');
    assert(/exitBtn\.on\('pointerover', \(\) => \{ _sa\(exitBtn, 0\.75\); _ss\(exitBtn, 1\.08\); \}\);/.test(weaponPopupSrc),
        'exitBtn pointerover: alpha=0.75 И scale=1.08');
    assert(/exitBtn\.on\('pointerout',  \(\) => \{ _sa\(exitBtn, 1\); _ss\(exitBtn, 1\); \}\);/.test(weaponPopupSrc),
        'exitBtn pointerout: alpha=1 И scale возвращается к 1');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

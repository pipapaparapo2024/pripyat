/**
 * Test: shmot_pos_editor.js — режим live-редактирования позиций шмоток на манекене
 * (drag мышкой + стрелки), с читаемым выводом manDx/manDy для вставки в shmot.js,
 * и учётом спец-компенсации -28px по Y для штаны_1.png.
 *
 * (dev_popups.js — панель быстрого превью попапов — была удалена и заменена
 * универсальным редактором позиций, см. tests/universal-pos-editor.test.js)
 *
 * Run: node tests/dev-pos-editor-and-popups.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const editorSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_pos_editor.js'), 'utf-8'
);
const shopSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8'
);
const shmotSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8'
);

// ── Test 1: shmot.js подключает и активирует редактор позиций ────────────────
console.log('\nTest 1: shmot.js импортирует и вызывает attachShmotPosEditor');
{
    assert(/import \{ attachShmotPosEditor \} from '\.\/shell\/overlays\/shmot_pos_editor\.js';/.test(shmotSrc),
        'импорт attachShmotPosEditor есть');
    assert(/attachShmotPosEditor\(Shmot\.prototype\);/.test(shmotSrc),
        'attachShmotPosEditor подключён к Shmot.prototype');
}

// ── Test 2: shmot_shop.js — кнопки редактора существуют в коде, но закомментированы ──
// 26.09.2026 (по прямому указанию, перед модерацией VK — "убери... вкладку редактирование
// итд... сделай так чтобы игроки не могли получить к ней доступ"): кнопки "🛠 РЕДАКТОР"/
// "📋 КОПИРОВАТЬ" убраны из живого экрана магазина (не удалены из файла — закомментированы,
// см. tests/hide-dev-tools-and-console-from-players.test.js для полной проверки). Метод
// _togglePosEditor() сам (в shmot_pos_editor.js, Test 3+ ниже) остался нетронутым — просто
// больше не вызывается ни из одной живой кнопки.
console.log('\nTest 2: shmot_shop.js — код кнопок редактора сохранён, но закомментирован (не активен для игрока)');
{
    assert(/\/\/ posBtnBg\.on\('pointerdown', \(\)=>this\._togglePosEditor\(\)\);/.test(shopSrc),
        'код кнопки-тумблера сохранён закомментированным');
    assert(/\/\/ posCopyBtn\.on\('pointerdown', \(\)=>this\._copyPosEditorValues\(\)\);/.test(shopSrc),
        'код кнопки копирования сохранён закомментированным');
    assert(/\/\/ this\._posEditorBtnTxt = posBtnTxt;/.test(shopSrc), 'ссылка на текст тумблера тоже закомментирована');
}

// ── Test 3: drag-логика — единый move/up на весь экран, а не на спрайт ───────
console.log('\nTest 3: drag реализован через единые pointermove/pointerup на _shopWin (не на спрайт)');
{
    assert(/this\._shopWin\.on\('pointermove', this\._posMoveHandler\);/.test(editorSrc),
        'pointermove навешен на this._shopWin');
    assert(/this\._shopWin\.on\('pointerup', this\._posUpHandler\);/.test(editorSrc),
        'pointerup навешен на this._shopWin');
    assert(/spr\.on\('pointerdown', onDown\);/.test(editorSrc),
        'pointerdown навешен именно на спрайт шмотки (старт драга)');
}

// ── Test 4: стрелки — 1px, Shift — 10px ───────────────────────────────────────
console.log('\nTest 4: клавиатурная подгонка — 1px, Shift — 10px');
{
    assert(/const step = e\.shiftKey \? 10 : 1;/.test(editorSrc), 'step = 10 при Shift, иначе 1');
    assert(/window\.addEventListener\('keydown', this\._posKeyHandler\);/.test(editorSrc),
        'keydown слушатель регистрируется при включении редактора');
    assert(/window\.removeEventListener\('keydown', this\._posKeyHandler\);/.test(editorSrc),
        'keydown слушатель снимается при выключении редактора (нет утечки)');
}

// ── Test 5: компенсация -28px для штаны_1.png учтена при чтении manDy ────────
console.log('\nTest 5: _hackY компенсирует спец-случай штаны_1.png при выводе manDy');
{
    const m = editorSrc.match(/const _hackY = \(eq\) => \(eq && eq\.imgFile === 'штаны_1\.png'\) \? -28 : 0;/);
    assert(!!m, '_hackY(eq) возвращает -28 для штаны_1.png, иначе 0');
    assert(/const dy = Math\.round\(spr\.y - base\.y - _hackY\(eq\)\);/.test(editorSrc),
        'dy вычисляется с вычетом _hackY — иначе значение задвоится в _updateManSprites');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 25.09.2026 (по прямому указанию) — иконка кнопки настроек (шестерёнка, открывает
 * попап настроек звука, iface.up.butt_settings) заменена на новый файл пользователя
 * (C:\Users\HONOR\Desktop\vk_game\кнопка настройки.png, 37×35, вплотную обрезан).
 *
 * Старый butt_settings.png (interface_elements.min.js, компилированная FLA-библиотека) был
 * снимком ВСЕЙ сцены Animate CC с иконкой, нарисованной по абсолютным координатам стейджа —
 * код вырезал из него регион new PIXI.Rectangle(1217,21,37,35). Новый файл пользователя УЖЕ
 * вплотную обрезан (37×35 — размер 1-в-1 совпадает с шириной/высотой старого выреза), поэтому
 * вместо попытки повторить старый холст ассет заменён на маленький файл, а прямоугольник выреза
 * сдвинут на (0,0,37,35) — берёт файл целиком, без смещения.
 *
 * Run: node tests/settings-button-icon-swap.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');

console.log('\nTest 1: новый файл butt_settings.png лежит в _client/development/images/ (источник для деплоя)');
{
    const imgPath = path.join(root, '_client', 'development', 'images', 'butt_settings.png');
    assert(fs.existsSync(imgPath), 'butt_settings.png существует в images/');
}

console.log('\nTest 2: interface_elements.min.js — прямоугольник выреза сдвинут на (0,0,37,35), старое смещение (1217,21) убрано');
{
    const libSrc = fs.readFileSync(path.join(root, '_client', 'development', 'libs', 'interface_elements.min.js'), 'utf-8');
    assert(libSrc.includes('new PIXI.Rectangle(0,0,37,35)'),
        'новый вырез (0,0,37,35) — берёт маленький файл целиком, без смещения на старый холст');
    assert(!libSrc.includes('new PIXI.Rectangle(1217,21,37,35)'),
        'старое смещение (1217,21) для прежнего большого холста убрано — иначе вырез читал бы за пределами нового маленького файла');
    assert(libSrc.includes('"images/butt_settings.png"'),
        'путь к файлу не менялся — только его содержимое и вырез (имя используется дважды в файле: карта имён + точка загрузки)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

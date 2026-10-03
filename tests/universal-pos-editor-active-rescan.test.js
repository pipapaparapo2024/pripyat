/**
 * Test: редактор позиций форсирует показ скрытых "актив"-состояний (купить актив/отмена
 * актив и т.п.), но раньше делал это ОДИН РАЗ, в момент включения режима. Попапы,
 * созданные уже ПОСЛЕ включения (например «купить патрон для ящика», открывается по
 * клику уже после того, как редактор был включён) — ни разу не сканировались, их
 * актив-спрайты оставались невидимыми и недоступными для позиционирования.
 *
 * Фикс: сканирование вынесено в отдельный переиспользуемый метод (_uScanForceActive) и
 * запускается не только один раз при включении, но и периодически (раз в 500мс), пока
 * режим редактора включён — новые попапы подхватываются без переключения режима туда-обратно.
 *
 * Run: node tests/universal-pos-editor-active-rescan.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
);

console.log('\nTest 1: _uScanForceActive — переиспользуемый метод, а не одноразовая локальная функция');
{
    const m = src.match(/proto\._uScanForceActive = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_uScanForceActive найден как метод proto');
    if (m) {
        const body = m[1];
        assert(/if\(!this\._uForcedVisible\) return;/.test(body), 'безопасно выходит, если массив ещё не инициализирован (режим не включён)');
        assert(/_looksLikeActiveState\(child\)/.test(body), 'использует тот же критерий поиска актив-состояний');
        assert(/this\._uForcedVisible\.push\(child\);/.test(body), 'найденные спрайты добавляются в общий список для отката при выключении');
    }
}

console.log('\nTest 2: _enableUniversalEdit запускает периодический пересканы, не только разовый');
{
    const m = src.match(/proto\._enableUniversalEdit = function\(\)\{([\s\S]*?)\n\s{8}\/\/ 2\)/);
    assert(!!m, 'начало _enableUniversalEdit найдено');
    if (m) {
        const body = m[1];
        assert(/this\._uScanForceActive\(\);/.test(body), 'вызывает _uScanForceActive() сразу при включении');
        assert(/this\._uActiveScanInterval = setInterval\(\(\) => this\._uScanForceActive\(\), 500\);/.test(body),
            'запускает periodic setInterval (500мс), повторно вызывающий сканирование — ловит попапы, открытые ПОСЛЕ включения режима');
    }
}

console.log('\nTest 3: _disableUniversalEdit останавливает периодический таймер (не течёт после выключения)');
{
    const m = src.match(/proto\._disableUniversalEdit = function\(\)\{([\s\S]*?)\n\s{8}if\(this\._uForcedVisible\)/);
    assert(!!m, 'начало _disableUniversalEdit найдено');
    if (m) {
        assert(/clearInterval\(this\._uActiveScanInterval\); this\._uActiveScanInterval = null;/.test(m[1]),
            'clearInterval вызывается при выключении режима — таймер не остаётся висеть в фоне навсегда');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

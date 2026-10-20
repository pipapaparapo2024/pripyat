/**
 * Test: батч 17.10.2026 — репорт "в попапе результата боя пишется разными шрифтами количество
 * HP босса, причём выглядит по-разному". Расследование:
 *
 *  1) Между экраном ПОБЕДЫ и экраном ПОРАЖЕНИЯ текст с maxHp босса реально рисовался ДВУМЯ
 *     разными стилями — hpTxt (поражение) остался на старом мелком стиле (14px, обычный) от
 *     прежнего смысла "остаток HP" (убран батчем раньше в тот же день), хотя теперь показывает
 *     ТУ ЖЕ величину (общий maxHp), что и hpBarTxt на экране победы (16px, bold, dropShadow).
 *     Это реальная несогласованность — исправлено унификацией стиля (см. Test 1/2 ниже).
 *  2) "У разных боссов по-разному пишется количество HP" — это НЕ баг: bosses._fmt() (bosses.js)
 *     намеренно форматирует число по диапазону величины — <10 000 полным числом с разделителем
 *     разрядов (toLocaleString('ru'), актуально только для Охотника, maxHp=1000 → "1 000"),
 *     10 000-999 999 сокращением "X.Xк" (Ястреб 50000 → "50к"), ≥1 000 000 — "X.Xкк" (Жгут
 *     30000000 → "30кк"). Один и тот же шрифт/стиль применяется ко всем — различается только
 *     ТЕКСТ (ожидаемо, т.к. у боссов разный maxHp), не оформление. Фикс здесь не требуется —
 *     см. Test 3, который пиннует сам _fmt() как регресс-защиту, чтобы не спутать с багом снова.
 *
 * 19.10.2026 (по прямому указанию, снято редактором позиций — "font-size количества хп
 * уменьшить на 2 пикселя"): 16px → 14px на ОБЕИХ страницах (унификация между win/loss, которую
 * чинил этот тест, по-прежнему в силе — просто базовый размер сместился).
 *
 * Run: node tests/boss-result-hp-text-style-unified-win-loss.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');
const bossesSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses.js'), 'utf-8');

console.log('\nTest 1: поражение (isWin:false) — hpTxt 14px/bold/dropShadow, как на победе');
{
    const start = src.indexOf('if(!isWin){');
    const end   = src.indexOf('} else {', start);
    const block = src.slice(start, end);
    assert(/fontSize: 14, fill: '#ffffff', fontWeight: 'bold',/.test(block), 'hpTxt — fontSize:14, bold (19.10.2026: было 16)');
    assert(/dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,/.test(block), 'hpTxt — dropShadow включён, те же параметры, что у hpBarTxt на победе');
}

console.log('\nTest 2: победа (isWin:true) — hpBarTxt тот же размер, что и на поражении (эталон унификации)');
{
    const start = src.indexOf('} else {');
    const end   = src.indexOf('\n        }\n\n        // Награда', start);
    const block = src.slice(start, end === -1 ? src.length : end);
    assert(/fontSize: 14, fill: '#ffffff', fontWeight: 'bold',/.test(block), 'hpBarTxt — fontSize:14, bold (19.10.2026: было 16)');
    assert(/dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,/.test(block), 'hpBarTxt — dropShadow (не менялось)');
}

console.log('\nTest 3: bosses._fmt() — регресс-защита формата по диапазонам величины (не баг, пояснение см. шапку)');
{
    const start = bossesSrc.indexOf('_fmt(n){');
    const end   = bossesSrc.indexOf('\n    }\n\n    _renderBuyKey', start);
    const body  = bossesSrc.slice(start, end);
    assert(/if\(n >= 1e6\)  return \(n\/1e6\)\.toFixed\(1\)\.replace\('\.0',''\)\+'кк';/.test(body), '≥1кк — сокращение "Xкк"');
    assert(/if\(n >= 1e4\)  return \(n\/1e3\)\.toFixed\(1\)\.replace\('\.0',''\)\+'к';/.test(body), '10к-1кк — сокращение "Xк"');
    assert(/return n\.toLocaleString\('ru'\);/.test(body), '<10к — полное число с разделителем разрядов (только Охотник, maxHp=1000)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

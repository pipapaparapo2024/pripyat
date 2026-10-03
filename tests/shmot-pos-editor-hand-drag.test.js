/**
 * Test: предметы категории "Рука" (cat 6: кукла вуду, мачете, бита, серп, молот, дубина)
 * нельзя было двигать в редакторе позиций магазина шмоток.
 *
 * Причина: _enablePosEditor() вешал interactive/pointerdown только на те слоты, у которых
 * spr.visible === true В МОМЕНТ включения редактора. Категория "Рука" по умолчанию ничего
 * не надета (нет предмета с owned:true/equipped:true среди id35-40) — слот невидим при
 * старте. Если надеть оружие в руку уже ПОСЛЕ включения редактора (обычный сценарий —
 * зашёл в редактор, потом переключил вкладку "Рука" и надел мачете), слот так и оставался
 * без обработчика pointerdown навсегда, пока редактор не выключить и включить заново.
 *
 * Фикс: interactive/pointerdown вешаются на ВСЕ слоты сразу при включении редактора,
 * независимо от текущей видимости — PIXI и так не даёт hit-test невидимым объектам,
 * так что когда вещь наденут, драг просто заработает без доп. действий.
 *
 * Run: node tests/shmot-pos-editor-hand-drag.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'shmot_pos_editor.js'), 'utf-8'
);

// ── Test 1: interactive вешается на все слоты без проверки visible ───────────
console.log('\nTest 1: _enablePosEditor вешает interactive/pointerdown на ВСЕ слоты (не только видимые)');
{
    const m = src.match(/Object\.keys\(this\._manSlots\)\.forEach\(cat => \{([\s\S]*?)\n\s{8}\}\);/);
    assert(!!m, 'цикл по this._manSlots найден в _enablePosEditor');
    if (m) {
        const body = m[1];
        assert(!/if\(!spr\.visible\) return;/.test(body),
            'больше НЕТ ранней проверки spr.visible — иначе слот, пустой при включении редактора, навсегда остаётся некликабельным');
        assert(/spr\.interactive = true; spr\.buttonMode = true;/.test(body),
            'interactive/buttonMode выставляются безусловно для каждого слота');
        assert(/spr\.on\('pointerdown', onDown\);/.test(body), 'pointerdown навешен на каждый слот');
    }
}

// ── Test 2: категория "Рука" (cat 6) присутствует в CAT_NAMES и участвует в общем цикле ──
console.log('\nTest 2: категория "Рука" (cat 6) не исключена из общей логики редактора');
{
    assert(/6:'Рука'/.test(src), 'CAT_NAMES содержит cat 6 = Рука');
    assert(!/if\(cat\s*===?\s*6\)/.test(src) && !/if\(c\s*===?\s*6\)/.test(src),
        'нет отдельного спецкейса, исключающего категорию 6 из общей логики');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

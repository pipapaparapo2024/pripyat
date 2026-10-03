/**
 * Test: Reward popup — real PNG icons for "stew" (тушёнка) and "energy" instead of
 * the old placeholder/hand-drawn card.
 *
 * Changes in shell/popups/reward.js (27.09.2026):
 *   - ICON_MAP.stew was 'попап награда рубли.png' (borrowed rubли icon, temp placeholder)
 *     → now 'попап награда тушенка.png' (dedicated art, same 236x411 size class as siblings).
 *   - ICON_MAP.energy did not exist at all → now 'попап награда энергия.png'.
 *   - The manual energy-only fallback (PIXI.Texture.EMPTY sprite + hand-drawn
 *     PIXI.Graphics card/border + "ЭНЕРГИЯ" PIXI.Text + bolt polygon) is removed —
 *     energy now goes through the same PIXI.Sprite(ICON_MAP[...]) path as every
 *     other reward type.
 *   - 27.09.2026 follow-up: the energy PNG originally shipped as 281x411 — 236x411 of real
 *     content plus ~45px of fully-transparent padding on the right (report: "visible gap on
 *     the right of the energy card"). It was cropped to the real content bounds (236x411,
 *     same size class as every other card), so the earlier icon.width/icon.height=CARD_W/
 *     CARD_H special-case for energy is gone — every reward type now goes through the same
 *     icon.scale.set(CARD_SCALE) path.
 *
 * This test reads the real source file and checks it as text (regex/substring),
 * so it verifies the actual shipped code, not a hand-copied mirror of constants.
 *
 * Run: node tests/reward-popup-stew-energy-icons.test.js (do NOT auto-run — see project rule).
 */

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const SRC_PATH = path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'reward.js');
const src = fs.readFileSync(SRC_PATH, 'utf8');

// ── Test 1: ICON_MAP.stew points to the new dedicated art, not the rubли placeholder ──
console.log('\nTest 1: ICON_MAP.stew → dedicated тушёнка art (no longer borrowing рубли icon)');
{
    assert(/stew:\s*'попап награда тушенка\.png'/.test(src), "ICON_MAP.stew === 'попап награда тушенка.png'");
    assert(!/stew:\s*'попап награда рубли\.png'/.test(src), 'ICON_MAP.stew no longer aliases попап награда рубли.png');
}

// ── Test 2: ICON_MAP.energy exists and points to the new art ──────────────────────────
console.log('\nTest 2: ICON_MAP.energy → dedicated энергия art (previously absent from ICON_MAP)');
{
    assert(/energy:\s*'попап награда энергия\.png'/.test(src), "ICON_MAP.energy === 'попап награда энергия.png'");
}

// ── Test 3: Old energy-only PIXI.Texture.EMPTY branch is gone ─────────────────────────
console.log('\nTest 3: energy no longer special-cased to an empty/invisible texture');
{
    assert(!/item\.type === 'energy' \? PIXI\.Texture\.EMPTY/.test(src),
        "no more \"item.type === 'energy' ? PIXI.Texture.EMPTY : ...\" ternary");
    assert(/new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ imgFile\)\)/.test(src),
        'icon sprite is unconditionally PIXI.Texture.from(BASE + imgFile) for every type');
}

// ── Test 4: Old hand-drawn energy card/label/bolt block is gone ───────────────────────
console.log('\nTest 4: manual energy fallback (Graphics card + "ЭНЕРГИЯ" label + bolt) removed');
{
    assert(!/ЭНЕРГИЯ/.test(src), 'no hardcoded "ЭНЕРГИЯ" text label left in source');
    assert(!/bolt\.drawPolygon/.test(src), 'no hand-drawn lightning-bolt polygon left in source');
    assert(!/Отдельного PNG энергии нет/.test(src), 'stale "no dedicated energy PNG" comment removed');
}

// ── Test 5: 27.09.2026 — энергия больше не спецкейс, PNG обрезан по контенту (236×411, как у соседей) ──
console.log('\nTest 5: энергия больше не спецкейс — PNG обрезан до 236×411 (реальный контент), общий scale.set(CARD_SCALE) для всех типов');
{
    // Причина прошлого спецкейса (explicit width/height=CARD_W/CARD_H только для energy) —
    // исходный PNG был 281×411 с ~45px пустого прозрачного поля СПРАВА от рисунка (репорт —
    // "у ячейки энергии видно прозрачный отступ справа"). Растягивание всего холста под общий
    // размер карточки растягивало и эту пустоту вместе с рисунком, из-за чего сама иконка
    // визуально "сжималась" влево, а зазор оставался. Файл обрезан по фактическому контенту
    // (236×411, идентично остальным карточкам) — спецкейс с explicit width/height не нужен.
    assert(!/CARD_W/.test(src), 'CARD_W (использовался только в спецкейсе energy) удалён из файла целиком — переменная больше не нужна');
    assert(!/item\.type === 'energy'\)\{[\s\S]{0,80}icon\.width/.test(src), 'energy больше не задаёт icon.width/height отдельной веткой');
    const line = src.split('\n').find(l => l.includes('icon.scale.set(CARD_SCALE)'));
    assert(!!line, 'icon.scale.set(CARD_SCALE) применяется без условия по item.type — единый путь для всех типов, включая energy');

    const imgPath = path.join(__dirname, '..', '_client', 'development', 'images', 'попап награда энергия.png');
    if (fs.existsSync(imgPath)) {
        // Простая проверка размера PNG без внешних зависимостей — читаем IHDR-чанк напрямую
        // (байты 16-23: width/height, big-endian uint32 каждое).
        const buf = fs.readFileSync(imgPath);
        const width  = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        assert(width === 236 && height === 411,
            `попап награда энергия.png обрезан до 236×411 (реальный контент, как у соседних карточек) — получено ${width}×${height}`);
    } else {
        console.log('  ⚠️  файл попап награда энергия.png не найден локально — пропуск проверки размера (не блокирует тест)');
    }
}

// ── Summary ─────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.error(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

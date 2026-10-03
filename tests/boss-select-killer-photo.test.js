/**
 * Test: рамка «ОСОБО ОПАСЕН / УБИВШИЙ» на карточке босса (bosses_select.js) раньше была
 * просто нарисованной на PNG пустой рамкой без единой строчки кода — никто и никогда не
 * подставлял туда фото. Теперь один запрос bosses.killers на весь список карточек (не по
 * одному на каждую) находит, кто (сам игрок или его друг) больше всего раз убил именно
 * этого босса, и вставляет его фото в рамку.
 *
 * Координаты рамки (KILLER_CX/CY/SIZE) сняты прямым промером пикселей исходника
 * boss_ohotnik.png (836×182, рендерится 1:1 без масштабирования) — рамка одинакова на всех
 * 8 карточках, т.к. это один и тот же PNG-шаблон с разным фото босса слева.
 *
 * Run: node tests/boss-select-killer-photo.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_select.js'), 'utf-8'
);

console.log('\nTest 1: cardY каждого босса запоминается (нужно для позиционирования фото позже)');
{
    assert(/const cardYs = \[\];/.test(src), 'массив cardYs объявлен');
    assert(/cardYs\.push\(cardY\);/.test(src), 'cardY каждой карточки добавляется в массив по мере построения');
}

console.log('\nTest 2: один запрос bosses.killers на весь список, не по одному на карточку');
{
    const m = src.match(/TS\.php\('bosses\.killers', \{\}, \(res\)=>\{([\s\S]*?)\n\t\t\t\}, \(e\)=>/);
    assert(!!m, 'запрос bosses.killers найден вне цикла BOSSES.forEach (один на всех)');
    if (m) {
        const body = m[1];
        assert(/bosses\._resolveVkUsers\(killers\.map\(k=>k\.id\)/.test(body),
            'id всех «убивших» резолвятся в имя/фото одним вызовом bosses._resolveVkUsers');
        assert(/const cardY = cardYs\[k\.boss_id\];/.test(body), 'позиция фото берётся из cardYs по boss_id из ответа сервера');
        assert(/spr\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'фото центрируется якорем 0.5/0.5 — совпадает с тем, что KILLER_CX/CY заданы как ЦЕНТР рамки');
    }
}

console.log('\nTest 3: координаты рамки заданы константами (уточнены через редактор позиций 15.09.2026)');
{
    // Раньше (до 15.09.2026) координаты снимались прямым промером PNG; теперь — уточнены
    // пользователем "вживую" через универсальный редактор позиций (✥) прямо на карточке
    // Охотника, отдельно для рамки (FRAME_REL_X/Y) и для фото/плейсхолдера (KILLER_CX/CY/W/H).
    assert(/const FRAME_REL_X = 648, FRAME_REL_Y = 8;/.test(src), 'FRAME_REL_X=648 FRAME_REL_Y=8');
    assert(/const KILLER_CX = 722, KILLER_CY = 90;/.test(src), 'KILLER_CX=722 KILLER_CY=90');
    assert(/const KILLER_W = 106, KILLER_H = 106;/.test(src), 'KILLER_W=106 KILLER_H=106');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

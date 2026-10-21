/**
 * Test: найдено 24.09.2026 по живому указанию ("игры должны открываться поверх Двора, а не
 * Главного, фон Двора при этом затемнён, но ничего не сломай") — раньше все 4 игры Двора
 * (рулетка/зарики/покер/блэкджек) при открытии полностью СКРЫВАЛИ лобби Двора
 * (_dvorWrap.visible=false, баг "фон двоится" 22.09.2026, см. dvor-dice.js). Тогда лобби
 * сделали ВИДИМЫМ, но затемнённым (alpha=0.35).
 *
 * 24.09.2026 (ПОЗЖЕ ТЕМ ЖЕ ДНЁМ, другой разговор, по прямому указанию + скриншот "кнопки
 * справа просвечивают позади покера"): выяснилось, что alpha=0.35 — это и есть причина
 * просвечивания, которое приняли за баг рендеринга слоёв. Пользователь явно подтвердил
 * (AskUserQuestion, после того как ему показали оба конкурирующих решения одного дня):
 * оставить alpha=0 (Двор полностью невидим, не просто затемнён) — см.
 * dvor-wrap-fully-hidden-behind-casino-games.test.js для актуального покрытия.
 *
 * ⚠️ 20.10.2026: alpha=0 ОТМЕНЕНО обратно на затемнение — но НЕ через alpha=0.35 (это тоже
 * было отменено в тот же день, см. докблок dvor-wrap-fully-hidden-behind-casino-games.test.js),
 * а через отдельный чёрный Graphics-слой поверх Двора (this._showDvorDarken()/_hideDvorDarken()
 * в dvor.js). Источник истины — tests/oct20-batch4-dvor-darken-fix-and-ryukzak-key-card.test.js.
 * Этот файл из названия ("dim lobby, not hide") внезапно снова оказался верным по СУТИ, даже с
 * устаревшими строками ниже — обновлены под сегодняшнюю реализацию.
 *
 * Файл оставлен (не удалён) как история конфликта решений — используй
 * tests/oct20-batch4-dvor-darken-fix-and-ryukzak-key-card.test.js как источник истины для
 * текущего поведения.
 *
 * Run: node tests/dvor-games-dim-lobby-not-hide.test.js
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

const GAMES = [
    { file: '_client/src/game/dvor/dvor-roulette.js',  openFn: 'proto._openRouletteScreen',  closeFn: 'proto._closeRouletteScreen' },
    { file: '_client/src/game/dvor/dvor-dice.js',      openFn: 'proto._openDiceScreen',      closeFn: 'proto._closeDiceScreen' },
    { file: '_client/src/game/dvor/dvor-poker.js',     openFn: 'proto._openPokerScreen',     closeFn: 'proto._closePokerScreen' },
    { file: '_client/src/game/dvor/dvor-blackjack.js', openFn: 'proto._openBlackjackScreen', closeFn: 'proto._closeBlackjackScreen' },
];

for(const g of GAMES){
    console.log(`\nTest: ${g.file} — лобби Двора затемняется через _showDvorDarken()/_hideDvorDarken(), не скрывается и не бледнеет само`);
    const src = readSrc(g.file);

    const openIdx = src.indexOf(g.openFn);
    assert(openIdx !== -1, `${g.openFn} найден`);
    const openEnd = src.indexOf('\n    };', openIdx);
    const openBody = src.slice(openIdx, openEnd);
    assert(/this\._showDvorDarken\(\);/.test(openBody),
        'открытие игры: вызывает this._showDvorDarken() (см. докблок про финальную реализацию 20.10.2026)');
    assert(!/this\._dvorWrap\.alpha\s*=/.test(openBody),
        'открытие игры: больше не трогает _dvorWrap.alpha напрямую (ни 0.35, ни 0)');

    const closeIdx = src.indexOf(g.closeFn);
    assert(closeIdx !== -1, `${g.closeFn} найден`);
    const closeEnd = src.indexOf('\n    };', closeIdx);
    const closeBody = src.slice(closeIdx, closeEnd);
    assert(/this\._hideDvorDarken\(\);/.test(closeBody),
        'закрытие игры: вызывает this._hideDvorDarken()');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

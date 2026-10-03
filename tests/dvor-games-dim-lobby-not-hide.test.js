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
 * Файл оставлен (не удалён) как история конфликта решений в рамках одного дня — используй
 * dvor-wrap-fully-hidden-behind-casino-games.test.js как источник истины для текущего
 * поведения.
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
    console.log(`\nTest: ${g.file} — лобби Двора полностью скрыто (alpha=0) при открытии, восстанавливается при закрытии`);
    const src = readSrc(g.file);

    const openIdx = src.indexOf(g.openFn);
    assert(openIdx !== -1, `${g.openFn} найден`);
    const openEnd = src.indexOf('\n    };', openIdx);
    const openBody = src.slice(openIdx, openEnd);
    assert(/this\._dvorWrap\.alpha = 0;/.test(openBody),
        'открытие игры: _dvorWrap.alpha = 0 (полностью невидим, НЕ 0.35 затемнение)');
    assert(/this\._dvorWrap\.interactiveChildren = false/.test(openBody),
        'открытие игры: _dvorWrap.interactiveChildren = false (некликабельно)');
    assert(!/this\._dvorWrap\.alpha = 0\.35/.test(openBody),
        'открытие игры: старое значение 0.35 (тусклое затемнение) больше не используется');

    const closeIdx = src.indexOf(g.closeFn);
    assert(closeIdx !== -1, `${g.closeFn} найден`);
    const closeEnd = src.indexOf('\n    };', closeIdx);
    const closeBody = src.slice(closeIdx, closeEnd);
    assert(/this\._dvorWrap\.alpha = 1/.test(closeBody),
        'закрытие игры: _dvorWrap.alpha восстановлен в 1 (полная видимость)');
    assert(/this\._dvorWrap\.interactiveChildren = true/.test(closeBody),
        'закрытие игры: _dvorWrap.interactiveChildren восстановлен в true (снова кликабельно)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

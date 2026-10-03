/**
 * Test: две связанные правки покера.
 *
 * 1) Анимация тасования (setInterval в dvor-poker-game.js._playPokerNewScreen) раньше
 *    показывала карты "сырого" (необрезанного по содержимому) размера — обрезка
 *    (dvor-poker-card-trim.js) применялась только в финальной раздаче
 *    (_updatePokerCardVisual, dvor-poker-screen.js), из-за чего в момент, когда
 *    тасование останавливалось и показывался итог, карта визуально "прыгала" в размере.
 *    Фикс: тасование тоже прогоняет каждую случайную карту через getTrimmedCardTexture,
 *    с тем же generation-guard (spr._pokerGen), что и в финальной раздаче — если слот
 *    успел смениться на новую случайную карту раньше, чем пришёл результат обрезки
 *    предыдущей, устаревший результат отбрасывается.
 *
 *    Дополнительно: кэш обрезки прогревается ЗАРАНЕЕ, при первом открытии экрана покера
 *    (preloadAllCardTrims, dvor-poker.js._openPokerScreen) — до этого обрезка каждой из
 *    32 карт колоды считалась только "на лету" при первой встрече, поэтому даже с гвардом
 *    первые кадры тасования могли показать "сырой" размер. Прогрев гарантирует, что к
 *    началу тасования кэш уже заполнен и getTrimmedCardTexture отвечает синхронно.
 *
 * 2) Карты сдвинуты на -2px по X и +11px по Y (единая точка — CARD_XS/CARD_YS в
 *    dvor-poker-screen.js._buildPokerScreen, откуда координаты берут и спрайты карт,
 *    и рамки выбора, и анимация тасования через spr._pokerBaseY).
 *
 * Run: node tests/poker-card-shuffle-trim-and-offset.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const gameSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-game.js'), 'utf-8'
);
const pokerSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker.js'), 'utf-8'
);
const trimSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-card-trim.js'), 'utf-8'
);
const screenSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'dvor', 'dvor-poker-screen.js'), 'utf-8'
);

// ── Test 1: анимация тасования использует getTrimmedCardTexture с generation-guard ──
console.log('\nTest 1: dvor-poker-game.js — тасование обрезает карты по содержимому, с защитой от гонки');
{
    assert(/import \{ getTrimmedCardTexture \} from '\.\/dvor-poker-card-trim\.js';/.test(gameSrc),
        'импорт getTrimmedCardTexture есть');
    const m = gameSrc.match(/const _panim = setInterval\(\(\)=>\{([\s\S]*?)\n\s{8}\}, 80\);/);
    assert(!!m, 'тело setInterval анимации тасования найдено');
    if (m) {
        const body = m[1];
        assert(/const myGen = \(spr\._pokerGen = \(spr\._pokerGen \|\| 0\) \+ 1\);/.test(body),
            'каждый кадр метит спрайт новым поколением (myGen)');
        assert(/getTrimmedCardTexture\(tex, \(trimmedTex\) => \{/.test(body),
            'каждый кадр запрашивает обрезанную текстуру через getTrimmedCardTexture');
        assert(/if\(spr\._pokerGen !== myGen\) return;\s*\n\s*spr\.texture = trimmedTex;/.test(body),
            'коллбэк обрезки проверяет поколение перед применением (не даёт устаревшему кадру перезаписать новый)');
    }
}

// ── Test 2: кэш обрезки прогревается заранее при открытии экрана покера ────────
console.log('\nTest 2: dvor-poker.js — preloadAllCardTrims вызывается один раз при первом открытии');
{
    assert(/import \{ preloadAllCardTrims \} from '\.\/dvor-poker-card-trim\.js';/.test(pokerSrc),
        'импорт preloadAllCardTrims есть');
    const m = pokerSrc.match(/proto\._openPokerScreen = function\(\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_openPokerScreen найден');
    if (m) {
        const body = m[1];
        assert(/if\(!this\._pokerTrimsPreloaded\)\{/.test(body), 'прогрев защищён флагом — вызывается один раз, не при каждом открытии');
        assert(/preloadAllCardTrims\(\(rank, suit\) => this\._getCardImgPath\(rank, suit\)\);/.test(body),
            'preloadAllCardTrims вызывается с колбэком построения пути по рангу/масти');
    }
}

// ── Test 3: preloadAllCardTrims прогревает всю колоду (19.09.2026: расширена до 13×4=52) ──
console.log('\nTest 3: dvor-poker-card-trim.js — preloadAllCardTrims перебирает всю колоду (13×4=52)');
{
    assert(/export function preloadAllCardTrims\(getCardImgPath\)\{/.test(trimSrc), 'функция экспортирована');
    const m = trimSrc.match(/const _ALL_RANKS = (\[[^\]]*\]);/);
    const s = trimSrc.match(/const _ALL_SUITS = (\[[^\]]*\]);/);
    assert(!!m && !!s, 'массивы рангов и мастей объявлены');
    if (m && s) {
        const ranks = JSON.parse(m[1].replace(/'/g, '"'));
        const suits = JSON.parse(s[1].replace(/'/g, '"'));
        assert(ranks.length === 13, 'рангов: 13 (полная колода двойка-туз), получили ' + ranks.length);
        assert(suits.length === 4, 'мастей: 4, получили ' + suits.length);
    }
    assert(/getTrimmedCardTexture\(tex, \(\) => \{/.test(trimSrc), 'прогрев использует ту же getTrimmedCardTexture (единый кэш)');
}

// ── Test 4: позиции карт (снято редактором позиций) ───────────
console.log('\nTest 4: dvor-poker-screen.js — CARD_XS/CARD_YS актуальные координаты');
{
    // 25.09.2026, ПОВТОРНЫЙ снимок тем же днём (по прямому указанию, редактор позиций — 5
    // координат по слотам 1-5): x:[370,459,547,635,724] (было [369,467,551,635,719]),
    // y:286 для всей строки (было 288) — см. tests/poker-card-size-127.test.js для масштаба.
    assert(/const CARD_XS = \[370, 459, 547, 635, 724\];/.test(screenSrc),
        'CARD_XS = [370,459,547,635,724] (было [369,467,551,635,719])');
    assert(/const CARD_YS = \[286, 286, 286, 286, 286\];/.test(screenSrc),
        'CARD_YS = [286,286,286,286,286] (было 288, вся строка на -2)');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

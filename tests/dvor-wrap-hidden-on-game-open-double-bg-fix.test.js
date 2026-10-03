/**
 * Test: батч 22.09.2026 (по прямому указанию, живой репорт — "фон двоится при открытии
 * зариков, ты ошибся, это не фон зариков, а фон всего двора") —
 *
 * Корень: _dvorWrap (лобби Двора, собственный фон "вкладка двор.png", растянут до 1280×546)
 * НЕ скрывался при открытии ЛЮБОЙ из 4 игр (зарики/рулетка/покер/блэкджек) — в открывающих
 * функциях стояло только `_dvorWrap.interactiveChildren = false`, БЕЗ `visible = false`
 * (закрывающие функции корректно восстанавливают ОБА флага — асимметрия). Фон зарики
 * ("зарики фон вкладка двор.png") — побайтово ТА ЖЕ картинка (проверено по MD5), но вставлена
 * в НАТИВНОМ размере 1280×536 без растяжения, короче канваса на 184px — в незакрытых зазорах
 * сквозь неё было видно СТАРОЕ растянутое лобби. Тот же баг актуален и для рулетки/покера/
 * блэкджека — не только зариков.
 *
 * Run: node tests/dvor-wrap-hidden-on-game-open-double-bg-fix.test.js
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

console.log('\nTest 1: "вкладка двор.png" и "зарики фон вкладка двор.png" — побайтово один и тот же файл (MD5)');
{
    const IMG_DIR = path.join(root, '_client', 'development', 'images');
    const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(path.join(IMG_DIR, f))).digest('hex');
    const a = md5('вкладка двор.png');
    const b = md5('зарики фон вкладка двор.png');
    console.log('    вкладка двор.png:            ', a);
    console.log('    зарики фон вкладка двор.png: ', b);
    assert(a === b, 'MD5 совпадает — это буквально одна и та же картинка под двумя именами (подтверждает репорт пользователя)');
}

// 24.09.2026 (тот же день, ПОЗЖЕ, другой разговор — по прямому указанию + скриншот "кнопки
// справа просвечивают позади покера"): visible=false (фикс от 22.09) был на некоторое время
// заменён на alpha=0.35 (тусклое, но видимое лобби — см. git-историю/dvor-games-dim-lobby-not-hide.test.js),
// а затем, после того как ЭТО САМО оказалось источником просвечивания, пользователь явно
// подтвердил (AskUserQuestion) окончательный вариант — alpha=0 (полностью невидим). Функционально
// эквивалентно исходной цели этого теста (Двор не должен быть виден при открытой игре), просто
// через alpha вместо visible — см. dvor-wrap-fully-hidden-behind-casino-games.test.js для
// актуального, самого подробного покрытия этого поведения.
console.log('\nTest 2: все 4 экрана игр Двора полностью скрывают _dvorWrap (alpha=0) при открытии, не только interactiveChildren');
{
    const files = {
        dice:      'server/../_client/src/game/dvor/dvor-dice.js'.replace('server/../', ''),
        roulette:  '_client/src/game/dvor/dvor-roulette.js',
        poker:     '_client/src/game/dvor/dvor-poker.js',
        blackjack: '_client/src/game/dvor/dvor-blackjack.js',
    };
    for(const [name, rel] of Object.entries(files)){
        const src = readSrc(rel);
        assert(/if\(this\._dvorWrap\)\{ this\._dvorWrap\.alpha = 0; this\._dvorWrap\.interactiveChildren = false; \}/.test(src),
            name + ': открытие экрана скрывает _dvorWrap.alpha=0 (полностью невидим)');
        assert(!/if\(this\._dvorWrap\) this\._dvorWrap\.interactiveChildren = false;$/m.test(src),
            name + ': старая неполная строка (только interactiveChildren, без скрытия) больше не осталась');
    }
}

console.log('\nTest 3: закрывающие функции по-прежнему корректно восстанавливают ОБА флага (не трогали — уже были верны)');
{
    const files = [
        '_client/src/game/dvor/dvor-dice.js',
        '_client/src/game/dvor/dvor-roulette.js',
        '_client/src/game/dvor/dvor-poker.js',
        '_client/src/game/dvor/dvor-blackjack.js',
    ];
    for(const rel of files){
        const src = readSrc(rel);
        assert(/if\(this\._dvorWrap\)\{ this\._dvorWrap\.alpha = 1; this\._dvorWrap\.interactiveChildren = true; \}/.test(src),
            rel + ': закрытие экрана по-прежнему восстанавливает оба флага (alpha+interactiveChildren)');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

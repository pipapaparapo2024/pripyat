/**
 * Test: 20.10.2026, батч 4 — два поведенческих фикса.
 *
 * 1) Вкладка «Двор» становилась ПОЛНОСТЬЮ ПРОЗРАЧНОЙ при открытии любой игры (рулетка/зарики/
 *    покер/блэкджек), хотя по комментариям в коде (24.09.2026) она должна была только
 *    ЗАТЕМНЯТЬСЯ, оставаясь видимой позади экрана игры. Корень: `this._dvorWrap.alpha = 0;` —
 *    alpha=0 это полная прозрачность (невидимо), а не затемнение; расхождение между намерением
 *    в комментарии и реальным числом в коде просуществовало с 24.09.2026 до сегодняшнего
 *    репорта. Исправлено на alpha=0.35 (видно, но тускло) во ВСЕХ 4 играх Двора одинаково.
 *
 * 2) Попап результата рюкзака (_openRyukzakReward) показывал карточку ключа БЕЗ числового
 *    лейбла ("штучный предмет" — осознанное решение 17.10.2026, но пользователь теперь прямо
 *    попросил обратное: "не отображается количество ключей, которые выиграл игрок"). Плюс
 *    KEY_BOSS_CARD покрывала только слоты 1-3 (Счастливчик/Ястреб/Меченный), хотя
 *    ryukzak.php уже поддерживает слот 4 (Крыс) — добавлена карта для слота 4. Плюс добавлен
 *    hover-тултип "Ключ от <Босса>" по прямому указанию.
 *
 * Run: node tests/oct20-batch4-dvor-darken-fix-and-ryukzak-key-card.test.js
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

console.log('\nTest 1: все 4 игры Двора затемняют (alpha=0.35), а не прячут (alpha=0) лобби при открытии');
{
    const files = {
        'зарики':    '_client/src/game/dvor/dvor-dice.js',
        'покер':     '_client/src/game/dvor/dvor-poker.js',
        'блэкджек':  '_client/src/game/dvor/dvor-blackjack.js',
        'рулетка':   '_client/src/game/dvor/dvor-roulette.js',
    };
    for (const [name, rel] of Object.entries(files)) {
        const src = readSrc(rel);
        assert(/this\._dvorWrap\.alpha = 0\.35; this\._dvorWrap\.interactiveChildren = false;/.test(src),
            `${name}: открытие экрана выставляет alpha=0.35 (затемнение), не 0 (прозрачность)`);
        assert(!/this\._dvorWrap\.alpha = 0; this\._dvorWrap\.interactiveChildren = false;/.test(src),
            `${name}: старое alpha=0 (полная прозрачность) больше не используется при открытии`);
    }
}

console.log('\nTest 2: закрытие экранов по-прежнему возвращает alpha=1 (не трогали эту половину)');
{
    const dice = readSrc('_client/src/game/dvor/dvor-dice.js');
    const bj   = readSrc('_client/src/game/dvor/dvor-blackjack.js');
    assert(/this\._dvorWrap\.alpha = 1; this\._dvorWrap\.interactiveChildren = true;/.test(dice),
        'dvor-dice.js: закрытие возвращает alpha=1');
    assert(/this\._dvorWrap\.alpha = 1; this\._dvorWrap\.interactiveChildren = true;/.test(bj),
        'dvor-blackjack.js: закрытие возвращает alpha=1');
}

console.log('\nTest 3: ryukzak.js — карточка ключа теперь показывает число (reward.k), не undefined');
{
    const src = readSrc('_client/src/game/shell/overlays/ryukzak.js');
    assert(/if\(keyFile\) bottomItems\.push\(\{\s*\n\s*f: keyFile, v: reward\.k,/.test(src),
        'карточка ключа получает v: reward.k вместо undefined');
    assert(!/if\(keyFile\) bottomItems\.push\(\{f: keyFile, v: undefined\}\);/.test(src),
        'старый undefined-лейбл для ключа убран');
}

console.log('\nTest 4: ryukzak.js — KEY_BOSS_CARD расширена до слота 4 (Крыс), которого раньше не было');
{
    const src = readSrc('_client/src/game/shell/overlays/ryukzak.js');
    assert(/const KEY_BOSS_CARD = \{[\s\S]{0,200}4:'рюкзак карточка крыс\.png'/.test(src),
        'KEY_BOSS_CARD[4] теперь указывает на рюкзак карточка крыс.png');
    assert(/1:'рюкзак карточка счастливчик\.png'/.test(src) && /2:'рюкзак карточка ястреб\.png'/.test(src) && /3:'рюкзак карточка меченный\.png'/.test(src),
        'слоты 1-3 (Счастливчик/Ястреб/Меченный) сохранены без изменений');
}

console.log('\nTest 5: ryukzak.js — hover-тултип "Ключ от <босса>" на карточке ключа (родительный падеж)');
{
    const src = readSrc('_client/src/game/shell/overlays/ryukzak.js');
    assert(/const KEY_BOSS_NAME_GEN = \{ 1:'Счастливчика', 2:'Ястреба', 3:'Меченного', 4:'Крыса' \};/.test(src),
        'карта имён в родительном падеже для всех 4 слотов');
    assert(/tip: 'Ключ от ' \+ \(KEY_BOSS_NAME_GEN\[reward\.key_boss\] \|\| 'босса'\),/.test(src),
        'текст тултипа строится из KEY_BOSS_NAME_GEN с фолбэком');
    assert(/spr\.on\('pointerover', \(\) => \{\s*\n\s*keyTipTxt\.text = tipText;/.test(src),
        'pointerover карточки с tipText показывает тултип');
    assert(/spr\.on\('pointerout', \(\) => \{ keyTip\.visible = false; \}\);/.test(src),
        'pointerout скрывает тултип');
}

console.log('\nTest 6: ryukzak.js — ОБЫЧНЫЕ карточки (рубли/сухари/опыт/оружие) по-прежнему БЕЗ tipText-параметра (не задеты фиксом)');
{
    const src = readSrc('_client/src/game/shell/overlays/ryukzak.js');
    assert(/topItems\.forEach\(\(item, i\) => _addCard\(item\.f, item\.v, TOP_ROW\[i\]\)\);/.test(src),
        'верхний ряд по-прежнему вызывается без 4-го аргумента (tipText undefined — hover не навешивается)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: два независимых бага.
 *
 * 1) Коллизия имён файлов: habar.js использовал './images/купить.png' и
 *    './images/собрать.png' — но './images/купить.png' УЖЕ занят магазином одежды
 *    (shmot_shop.js:331, stateFile='купить.png') под СВОЙ ассет (другой визуальный стиль).
 *    Деплой новых кнопок хабара под тем же именем перезаписал файл на сервере — кнопки
 *    "КУПИТЬ" в магазине одежды стали показывать хабаровскую картинку вместо своей.
 *    Исправлено: хабар использует уникальные имена "хабар кнопка купить.png"/
 *    "хабар кнопка собрать.png", магазин одежды не тронут.
 *
 * 2) На 100 (макс.) уровне покера "Опыт: cur/next" показывал абсурдные числа вроде
 *    "98613/22" — _pokerLevelInfo(exp) считает cur=exp-used, где used перестаёт расти
 *    после lv=100 (цикл останавливается), а exp продолжает копиться от игр после макс.
 *    уровня — cur рос неограниченно. next тоже был мусорным (_pokerExpPerStep(101) просто
 *    попадает в последнюю ветку "return 22"). Исправлено: на 100 уровне возвращается
 *    maxed:true, экран показывает "Опыт: МАКС" вместо чисел.
 *
 * Run: node tests/poker-maxlevel-and-habar-filename-collision.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');
const habar      = fs.readFileSync(path.join(root, 'habar.js'), 'utf-8');
const shmotShop  = fs.readFileSync(path.join(root, 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
const dvor       = fs.readFileSync(path.join(root, 'dvor.js'), 'utf-8');
const pokerScr   = fs.readFileSync(path.join(root, 'dvor', 'dvor-poker-screen.js'), 'utf-8');
const pokerLegacy= fs.readFileSync(path.join(root, 'dvor', 'dvor-poker.js'), 'utf-8');

console.log('\nTest 1: хабар и магазин одежды больше не делят один и тот же файл "купить.png"');
{
    assert(/stateFile = !item\.owned \? 'купить\.png'/.test(shmotShop), 'магазин одежды по-прежнему использует своё "купить.png" (не тронут)');
    assert(!/'\.\/images\/купить\.png'/.test(habar), 'habar.js больше не ссылается на общий "купить.png"');
    assert(!/'\.\/images\/собрать\.png'/.test(habar), 'habar.js больше не ссылается на общий "собрать.png"');
    assert(/'\.\/images\/хабар кнопка купить\.png'/.test(habar), 'habar.js использует уникальное имя "хабар кнопка купить.png"');
    assert(/'\.\/images\/хабар кнопка собрать\.png'/.test(habar), 'habar.js использует уникальное имя "хабар кнопка собрать.png"');
}

console.log('\nTest 2: покер — 100 уровень показывает "МАКС" вместо мусорных чисел ("98613/22")');
{
    const m = dvor.match(/_pokerLevelInfo\(exp\)\{([\s\S]*?)\n {4}\}/);
    assert(!!m, '_pokerLevelInfo найден');
    if (m) {
        const body = m[1];
        assert(/if\(lv >= 100\) return \{level:100, cur:0, next:1, maxed:true\};/.test(body),
            'на 100 уровне возвращается maxed:true (cur/next больше не растут бесконечно)');
        assert(/return \{level:lv, cur:exp-used, next:this\._pokerExpPerStep\(lv\+1\), maxed:false\};/.test(body),
            'до 100 уровня поведение не изменилось (maxed:false)');
    }
    assert(/lvl\.maxed \? 'Опыт: МАКС' : 'Опыт: ' \+ lvl\.cur \+ '\/' \+ lvl\.next/.test(pokerScr),
        'экран покера (dvor-poker-screen.js) показывает "Опыт: МАКС" при maxed');
    assert(/const ratio = lvl\.maxed \? 1 : /.test(pokerScr), 'полоска опыта покера полностью заполнена при maxed');
    // 18.09.2026 (перенос Покера на сервер): старая FLA-панель покера (dvor-poker.js), где
    // раньше была ЕЩЁ одна проверка maxed для level_txt/exp_txt, удалена целиком как мёртвый
    // код (недостижима — см. dvor-poker.js и dvor.js._bindGamePanels/_initPanel). Единственные
    // живые места, показывающие "Опыт: МАКС" — новый экран (проверен выше) и общая _initPanel
    // (используется другими играми, dice/cards/roulette — проверена ниже).
    assert(!/proto\._resolvePoker\s*=/.test(pokerLegacy), 'sanity: старая _resolvePoker (единственное место с maxed в dvor-poker.js) действительно удалена');
    assert(/lvl\.maxed \? 'МАКС' : lvl\.cur \+ '\/' \+ lvl\.next/.test(dvor),
        'общая _initPanel (dvor.js, используется всеми играми) тоже учитывает maxed');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

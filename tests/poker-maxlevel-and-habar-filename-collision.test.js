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
 *    попадает в последнюю ветку "return 22"). Исправлено 12.10.2026: на 100 уровне
 *    возвращался maxed:true, экран показывал "Опыт: МАКС" вместо чисел — рабочий, но
 *    band-aid фикс (прятал симптом, не причину: уровень визуально "замирал" на 100).
 *
 *    27.10.2026 (баг найден по прямому указанию — живой репорт "был уровень 100, добил до
 *    101, всё ещё показывает 100"): "МАКС"-заглушка САМА стала багом — в азартных играх
 *    Двора не должно быть ограничения по уровню вообще. Правильный фикс — ПРОДОЛЖИТЬ цикл
 *    _pokerLevelInfo() после lv=100 (используя тот же фиксированный шаг 22, что уже
 *    возвращает _pokerExpPerStep(lv) для lv>90), а не капать его — это заодно убирает И
 *    старый баг "98613/22" (cur/next снова корректно ограничены шагом 0..22), И маскирующий
 *    его "МАКС"-фриз, одним и тем же изменением.
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
    // 21.10.2026: "купить.png" переименован в "магазин вещей кнопка купить.png" (аудит имён
    // файлов, отдельная, не связанная с этим инцидентом правка) — важная для ЭТОГО теста часть
    // (разные, НЕ коллидирующие имена между магазином и хабаром) не изменилась.
    assert(/stateFile = !item\.owned \? 'магазин вещей кнопка купить\.png'/.test(shmotShop), 'магазин одежды использует своё "магазин вещей кнопка купить.png" (отдельное от хабара имя)');
    assert(!/'\.\/images\/купить\.png'/.test(habar), 'habar.js больше не ссылается на общий "купить.png"');
    assert(!/'\.\/images\/собрать\.png'/.test(habar), 'habar.js больше не ссылается на общий "собрать.png"');
    assert(/'\.\/images\/хабар кнопка купить\.png'/.test(habar), 'habar.js использует уникальное имя "хабар кнопка купить.png"');
    assert(/'\.\/images\/хабар кнопка собрать\.png'/.test(habar), 'habar.js использует уникальное имя "хабар кнопка собрать.png"');
}

console.log('\nTest 2 (27.10.2026, переписан — "ограничения по уровню в азартных играх Двора быть не должно"): покер — уровень растёт БЕЗ ограничения, "98613/22" не воспроизводится, "МАКС"-заглушка убрана целиком');
{
    const m = dvor.match(/_pokerLevelInfo\(exp\)\{([\s\S]*?)\n {4}\}/);
    assert(!!m, '_pokerLevelInfo найден');
    if (m) {
        const body = m[1];
        assert(/while\(true\)\{ const s=this\._pokerExpPerStep\(lv\+1\); if\(used\+s>exp\)break; used\+=s; lv\+\+; \}/.test(body),
            'цикл БОЛЬШЕ НЕ капается на lv<100 — продолжает использовать фиксированный шаг 22 (см. _pokerExpPerStep) сколь угодно далеко');
        assert(!/lv *< *100/.test(body) && !/lv *>= *100/.test(body), 'никакой проверки на уровень 100 внутри цикла/возврата больше нет');
        assert(!/maxed/.test(body), "'maxed' убран из _pokerLevelInfo целиком — больше нечему быть true/false");
        assert(/return \{level:lv, cur:exp-used, next:this\._pokerExpPerStep\(lv\+1\)\};/.test(body),
            'возврат — всегда реальные level/cur/next, без ветвления');
    }
    // Реальное исполнение: много уровней выше 100 (в т.ч. пример из старого баг-репорта) —
    // cur/next остаются в разумных пределах (0..22), не "98613/22".
    {
        const fn = new Function('exp', `
            function pokerExpPerStep(lv){
                if(lv<=10)return 6; if(lv<=20)return 8;  if(lv<=30)return 10;
                if(lv<=40)return 11;if(lv<=50)return 13; if(lv<=60)return 15;
                if(lv<=70)return 16;if(lv<=80)return 18; if(lv<=90)return 20;
                return 22;
            }
            let lv=0, used=0;
            while(true){ const s=pokerExpPerStep(lv+1); if(used+s>exp)break; used+=s; lv++; }
            return {level:lv, cur:exp-used, next:pokerExpPerStep(lv+1)};
        `);
        const atLevel100Used = (() => { let lv=0, used=0; const step=(l)=>{ if(l<=10)return 6; if(l<=20)return 8; if(l<=30)return 10; if(l<=40)return 11; if(l<=50)return 13; if(l<=60)return 15; if(l<=70)return 16; if(l<=80)return 18; if(l<=90)return 20; return 22; }; while(lv<100){ used+=step(lv+1); lv++; } return used; })();
        const far = fn(atLevel100Used + 50 * 22 + 15); // far above level 100
        assert(far.level === 150, `уровень реально доходит до 150 и дальше (получено ${far.level})`);
        assert(far.cur === 15 && far.next === 22, `cur/next остаются в пределах шага (0..22), не растут неограниченно (получено ${far.cur}/${far.next})`);
    }

    assert(/this\._pokerExpLabelTxt\.text = 'Опыт: ' \+ lvl\.cur \+ '\/' \+ lvl\.next;/.test(pokerScr),
        'экран покера (dvor-poker-screen.js) всегда показывает реальные cur/next, без ветки "МАКС"');
    assert(!/'Опыт: МАКС'/.test(pokerScr), '"Опыт: МАКС" полностью убран из экрана покера');
    assert(/const ratio = lvl\.next > 0 \? Math\.min\(1, lvl\.cur \/ lvl\.next\) : 0;/.test(pokerScr),
        'полоска опыта покера считается от реальных cur/next (без maxed-ветки)');
    // 18.09.2026 (перенос Покера на сервер): старая FLA-панель покера (dvor-poker.js) удалена
    // целиком как мёртвый код — sanity-гвард остаётся актуальным и после этой правки.
    assert(!/proto\._resolvePoker\s*=/.test(pokerLegacy), 'sanity: старая _resolvePoker в dvor-poker.js по-прежнему удалена');
    assert(/this\._setTxt\(p, 'exp_txt',    lvl\.cur \+ '\/' \+ lvl\.next\);/.test(dvor),
        'общая _initPanel (dvor.js, используется всеми играми) тоже больше не проверяет maxed');
    assert(!/lvl\.maxed/.test(dvor), "'lvl.maxed' нигде в dvor.js больше не встречается");
}

console.log('\nTest 3 (27.10.2026, тот же баг-репорт, но для Зариков/рулетки/блэкджека — "был уровень 100, добил до 101, всё ещё показывает 100"): _simpleLevelInfo() тоже без ограничения уровня');
{
    const m = dvor.match(/_simpleLevelInfo\(exp\)\{([\s\S]*?)\n {4}\}/);
    assert(!!m, '_simpleLevelInfo найден');
    if(m){
        const body = m[1];
        assert(/return \{level:Math\.floor\(exp\/10\), cur:exp%10, next:10\};/.test(body),
            'level больше не капается через Math.min(100, ...) — растёт неограниченно вместе с exp');
        assert(!/Math\.min\(100/.test(body), 'Math.min(100,...) убран из _simpleLevelInfo целиком');
    }
    // Реальное исполнение — уровень 101 (ровно пример из багрепорта) отображается как 101, не 100.
    const level101Exp = 1010; // 101*10
    const simple = (exp) => ({level: Math.floor(exp/10), cur: exp%10, next: 10});
    assert(simple(level101Exp).level === 101, 'уровень 101 (1010 exp) вычисляется как 101, не капается на 100');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

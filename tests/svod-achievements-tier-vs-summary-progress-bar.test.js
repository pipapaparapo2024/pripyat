/**
 * Test: батч 25.09.2026 (по прямому указанию, 2 скриншота) —
 *  1) Раскрыл тему "Раздающий боль" (следующая цель, ещё не заработана) — у базовой карточки
 *     темы нет прогресс-бара, хотя у той же самой темы в развёрнутом списке (тир-строка) он
 *     есть. Ожидание: прогресс-бар должен быть и на карточках, "на которые нужно кликать".
 *  2) "Охотник повержен" (одиночное достижение, membersCount=1, уже выполнено) — должно быть
 *     "заполнено с прогрессом", а не выглядеть как пустое/недостижение.
 *
 * Корень: базовая карточка темы (isTierRow:false) раньше ВСЕГДА показывала сводку (очки/
 * галочка/бейдж) и НИКОГДА прогресс-бар — было корректно, пока карточка показывала МАКСИМАЛЬНЫЙ
 * ЗАРАБОТАННЫЙ тир (тема и так "закрыта", бар нечего показывать). После фикса
 * collapseToTopPerFamily() (см. achievement-tiers.js, тот же день) карточка чаще показывает
 * СЛЕДУЮЩУЮ НЕЗАРАБОТАННУЮ цель — для неё нужен прогресс-бар, а не сводка. Для тем из ОДНОГО
 * тира (kill/solo/fast/комбинации — не разворачиваются) сводка тоже не имеет смысла (не тема
 * с несколькими тирами, а одно достижение целиком) — бар нагляднее.
 *
 * Фикс: showBar = isTierRow || !themeComplete, где themeComplete = membersCount>1 &&
 * earnedCount===membersCount. Сводка (очки/галочка/бейдж) остаётся ТОЛЬКО для полностью
 * завершённых многотирных тем.
 *
 * 25.09.2026 (повторное указание тем же днём, новый скриншот — "Ломать не строить" (30кк
 * урона боссам) выполнено — галочка ✅ и +76 звёзд видны, — но полоска прогресса СВЕРХУ почти
 * пустая): второй, независимый баг в том же _fillCard() — showBar теперь показывает бар для
 * выполненных одиночных достижений (по фиксу выше), но САМА ДОЛЯ ЗАПОЛНЕНИЯ (frac) всё ещё
 * считалась исключительно по cur/target, где cur = getStatValue(state, a.statPath) — живой
 * клиентский снимок udata (window.achievements._state()), а done — серверный источник истины
 * (window.achievements.earned, achievements.php.sync(), см. миграцию достижений на сервер).
 * Если клиентский снимок статы в момент рендера карточки не совпадает 1-в-1 с тем, что сервер
 * использовал при выдаче достижения (другая секунда чтения udata и т.п.) — бар недоливает,
 * хотя достижение уже официально выполнено. Фикс: done переопределяет frac целиком (frac=1),
 * cur/target участвуют только пока достижение ещё не выполнено. См. Test 5 ниже.
 *
 * Run: node tests/svod-achievements-tier-vs-summary-progress-bar.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');

const s = src.indexOf('const _fillCard = (c, a, opts) => {');
const e = src.indexOf('\n        };', s);
const body = src.slice(s, e);

console.log('\nTest 1: themeComplete требует И >1 тира, И все заработаны — одиночные достижения (membersCount<=1) никогда не считаются "завершённой темой"');
{
    assert(/const themeComplete = membersCount > 1 && earnedCount === membersCount;/.test(body),
        'themeComplete = membersCount>1 && earnedCount===membersCount — одиночные (kill/solo/комбинации) исключены условием ">1"');
}

console.log('\nTest 2: showBar — бар показывается всегда, КРОМЕ полностью завершённой многотирной темы');
{
    assert(/const showBar = isTierRow \|\| !themeComplete;/.test(body),
        'showBar = isTierRow (тир-строка всегда бар) || !themeComplete (тема не завершена целиком — тоже бар)');
}

console.log('\nTest 3: ветка showBar — рисует прогресс-бар к ТЕКУЩЕЙ цели (achievementThreshold(a)/getStatValue), не заглушку');
{
    const ifStart = body.indexOf('if(showBar){');
    const ifEnd   = body.indexOf('} else {', ifStart);
    const ifBody  = body.slice(ifStart, ifEnd);
    assert(/const target = achievementThreshold\(a\);/.test(ifBody), 'target = порог ТЕКУЩЕГО отображённого достижения (следующая цель темы, или единственный тир)');
    assert(/const cur = getStatValue\(state, a\.statPath\);/.test(ifBody), 'cur = текущее значение статы игрока по этому достижению');
    // 26.09.2026 (по прямому указанию, скриншот — "Охотник повержен выполнен, но галочка не
    // стоит"): галочка больше не скрывается жёстко в режиме бара — c.checkMark.visible = done.
    // 26.09.2026 (повторный репорт тем же днём — "нет ни галочки, ни очков, ни значка звёзд"):
    // очки/бейдж звёзд теперь тоже видны вместе с галочкой при done (бар при этом остаётся
    // видимым индикатором прогресса — все элементы сосуществуют, не взаимоисключающе).
    assert(/c\.checkMark\.visible = done;/.test(ifBody) && /c\.starsGotBadge\.visible = done;/.test(ifBody) && /c\.ptsTxt\.visible = done;/.test(ifBody),
        'в режиме бара галочка/очки/бейдж видны вместе если done — бар остаётся основным индикатором');
    assert(/c\.card\.interactive = c\.card\.buttonMode = isTierRow \? false : expandable;/.test(ifBody),
        'базовая карточка темы (не тир), показанная как бар, остаётся кликабельной если у темы больше одного тира (expandable)');
}

console.log('\nTest 4: ветка !showBar (themeComplete) — сводка очков/галочки/бейджа, бар скрыт');
{
    const elseStart = body.indexOf('} else {', body.indexOf('if(showBar){'));
    const elseEnd   = body.indexOf('\n            }', elseStart);
    const elseBody  = body.slice(elseStart, elseEnd);
    assert(/c\.bar\.visible = false; c\.fracTxt\.visible = false;/.test(elseBody), 'бар скрыт в ветке сводки — тема уже полностью завершена, показывать нечего');
    assert(/c\.checkMark\.visible = true;/.test(elseBody), 'галочка видна — themeComplete уже гарантирует, что тема выполнена целиком');
}

console.log('\nTest 5: ветка showBar — frac учитывает done (серверный earned) ПРИОРИТЕТНО над cur/target (клиентский снимок статы)');
{
    const ifStart = body.indexOf('if(showBar){');
    const ifEnd   = body.indexOf('} else {', ifStart);
    const ifBody  = body.slice(ifStart, ifEnd);
    assert(/const frac = done \? 1 : \(target > 0 \? Math\.min\(1, cur \/ target\) : 0\);/.test(ifBody),
        'done переопределяет frac=1 целиком — cur/target участвуют только для НЕ выполненных достижений');

    // Рантайм-репро прямо со скриншота: "Ломать не строить" (30кк урона), достижение уже
    // выполнено (done=true), но живой клиентский снимок total_damage в этот момент меньше
    // порога (например, ещё не долетел свежий patch с сервера) — старая формула
    // (target>0 ? Math.min(1,cur/target) : ...) дала бы почти пустой бар, хотя галочка+награда
    // уже показаны. Новая формула обязана дать 1 в этом случае.
    const target = 30000000;
    const cur    = 1200000; // клиентский снимок отстал/разошёлся — сильно меньше порога
    const done   = true;    // сервер уже подтвердил выполнение (window.achievements.earned)
    const frac   = done ? 1 : (target > 0 ? Math.min(1, cur / target) : 0);
    assert(frac === 1, 'достигнутое достижение — бар всегда 100%, даже если клиентский cur разошёлся с target: получили frac=' + frac);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

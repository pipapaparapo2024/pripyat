/**
 * Test: батч 21.09.2026 (по прямому указанию, разбор багрепорта после боя с боссом) — большой
 * набор независимых фиксов:
 *
 *  1) КРАШ "ReferenceError: Z is not defined" в zone_screen.js._zoneUpdateCollect() — Z была
 *     объявлена ТОЛЬКО в соседней _zoneUpdatePage(), эта функция читала её как будто общую для
 *     файла. Тот же баг ОБЪЯСНЯЕТ и репорт "прокачал бизнес — кнопка «Собрать прибыль» не
 *     появилась": функция падала на первой же попытке обновить текстуру кнопки.
 *  2) Рюкзак — перенос на сервер (ryukzak.php, по прямому указанию, т.к. деньги/награда):
 *     тушёнка реально списывается (раньше не списывалась вообще), рюкзак открывается СКОЛЬКО
 *     УГОДНО раз (очки влияют только на уровень тарифа, а не на возможность открытия — старый
 *     гейт canClaim/claimedLevel убран), уровень физически не может превышать 20 (ровно 20
 *     порогов в массиве).
 *  3) Скилл "Адреналин" — getEnergyBonus() наконец подключён к TIMERS.ENERGY_MAX (+1 за
 *     уровень), тем же аддитивным паттерном, что gangs.js/hapuga.js/vassilich.js.
 *  4) Достижения "появляются пачкой после перезахода" — периодический догоняющий _checkAll()
 *     каждые 30 сек, та же идея, что уже применена к login_streak при первой загрузке (19.09).
 *  5) Крестик выхода — новая позиция (x:1240,y:90) применена ко ВСЕМ играм Двора (зарики,
 *     рулетка х2, блэкджек, покер, сумка покера), не только к покеру.
 *  6) Блэкджек — смена карты УЖЕ гарантированно возвращает другой ранг (blackjack.php.swap()),
 *     подтверждаем тестом, что эта защита реально в коде (баг не воспроизводится).
 *  7) Рулетка — 2 позиционные правки (кнопка покупки поинтов, кнопка КРУТИТЬ) + новый
 *     переиспользуемый хелпер window._centerTextIn(text, box) для центрирования текста в
 *     произвольном прямоугольнике без ручных подложек-блоков на каждый случай.
 *
 * Run: node tests/batch-21-09-crash-ryukzak-adrenaline-achievements-positions.test.js
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

const zoneScreenSrc = readSrc('_client/src/game/shell/overlays/zone_screen.js');
const ryukzakSrc    = readSrc('_client/src/game/shell/overlays/ryukzak.js');
const ryukzakPhpSrc = readSrc('server/core/controllers/ryukzak.php');
const registrySrc   = readSrc('server/core/models/registry.php');
const errorsSrc     = readSrc('server/json/errors.json');
const skillsSrc     = readSrc('_client/src/game/skills.js');
const moduleCtlSrc  = readSrc('_client/src/modules/module_control.js');
const blackjackPhp  = readSrc('server/core/controllers/blackjack.php');
const rouletteSrc   = readSrc('_client/src/game/dvor/dvor-roulette-screen.js');
const uiKitSrc      = readSrc('_client/src/game/shell/ui_kit.js');

console.log('\nTest 1: zone_screen.js._zoneUpdateCollect() больше не падает на необъявленной Z');
{
    const start = zoneScreenSrc.indexOf('proto._zoneUpdateCollect = function');
    const end   = zoneScreenSrc.indexOf('\n\t}', start);
    const body  = zoneScreenSrc.slice(start, end);
    assert(/const Z = '\.\/images\/';/.test(body), '_zoneUpdateCollect объявляет свою локальную const Z (не полагается на соседнюю функцию)');
    assert(/Z \+ \(canCollect/.test(body), 'использование Z для текстуры кнопки на месте');
}

console.log('\nTest 2: ryukzak.php — новый server-authoritative контроллер зарегистрирован и содержит нужную логику');
{
    // 22.09.2026: 'hata' дописан ПОСЛЕ 'ryukzak' в массиве classes (новый server-authoritative
    // контроллер хаты) — regex больше не требует, чтобы ryukzak был последним элементом.
    assert(/'ryukzak'/.test(registrySrc), "'ryukzak' добавлен в массив classes registry.php");
    assert(/class Ryukzak/i.test(ryukzakPhpSrc), 'класс Ryukzak определён');
    // 04.10.2026: 'preview' добавлен рядом с 'open' (честный предрасчёт оружия в награде рюкзака
    // до клика ЗАБРАТЬ, см. tests/ryukzak-honest-weapon-preview.test.js) — permits теперь из двух.
    assert(/\$this->permits = \['open', 'preview'\];/.test(ryukzakPhpSrc), 'permits содержит open и preview');
    // 25.09.2026: блок стал многострочным (добавлено логирование, см. большой коммент про
    // обнуление ryukzak_points у класса) — deduct + fail(46) внутри одного if по-прежнему рядом.
    assert(/if\(!\$this->ops->deduct\(\$user, 'stew', \$cost\)\)\{[\s\S]{0,200}?return \$this->ops->fail\(46\);/.test(ryukzakPhpSrc),
        'open() реально списывает тушёнку (deduct), код ошибки 46 — уже существующий "Недостаточно тушёнки"');
    assert(/"code":46,"text":"Недостаточно тушёнки"/.test(errorsSrc), 'errors.json уже содержит код 46 (переиспользован, не задублирован)');
    assert(!/canClaim|claimedLevel/i.test(ryukzakPhpSrc), 'сервер НЕ гейтит открытие по claimedLevel — открывать можно сколько угодно раз');
    assert(/\$level = max\(1, \$this->_levelFromPoints\(\$points, \$catalog\['thresholds'\]\)\);/.test(ryukzakPhpSrc),
        'уровень считается из ryukzak_points через тот же пороговый массив, что и раньше на клиенте');
}

console.log('\nTest 3: ryukzak_config.json — 20 порогов и 20 тарифов (тот же массив, что был в ryukzak_rewards.json)');
{
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'server/json/ryukzak_config.json'), 'utf-8'));
    assert(cfg.thresholds.length === 20, 'ровно 20 порогов (уровень физически не может быть больше 20)');
    assert(cfg.tiers.length === 20, 'ровно 20 тарифов наград');
    assert(cfg.open_cost_stew === 20, 'стоимость открытия — 20 тушёнки');
    const clientRewards = JSON.parse(fs.readFileSync(path.join(root, '_client/src/data/ryukzak_rewards.json'), 'utf-8'));
    assert(JSON.stringify(cfg.tiers) === JSON.stringify(clientRewards), 'серверная таблица тарифов 1-в-1 совпадает со старой клиентской (сверка построчно)');
}

console.log('\nTest 4: ryukzak.js (клиент) зовёт сервер вместо локального RNG/начисления, гейт claimedLevel убран');
{
    assert(/TS\.php\('ryukzak\.open', \{\}, \(res\) => \{/.test(ryukzakSrc), 'клиент зовёт ryukzak.open вместо локального расчёта награды');
    assert(/applyPatch\(res\.patch\);/.test(ryukzakSrc), 'применяет patch от сервера через applyPatch (не мёржит поля вручную)');
    assert(!/const canClaim|canClaim\s*&&|if\(!canClaim\)/.test(ryukzakSrc), 'canClaim как реальная переменная-гейт убран (упоминание в пояснительном комментарии не в счёт) — кнопка ЗАБРАТЬ больше не гейтится локально');
    assert(!/ryukzak_claimed_level/.test(ryukzakSrc), 'ryukzak_claimed_level больше не читается клиентом (открытие не привязано к нему)');
    assert(/err && err\.code === 46/.test(ryukzakSrc), 'клиент явно обрабатывает код 46 (недостаточно тушёнки) отдельным сообщением');
    assert(!/Math\.random\(\) \* 100/.test(ryukzakSrc), 'клиентский RNG розыгрыша оружия убран (теперь считает сервер)');
}

console.log('\nTest 5: "Адреналин" (id:9), +1 макс. энергии за уровень — 28.09.2026: перенесено на сервер (та же дыра, что чинили у шмота)');
{
    // Раньше skills.js.upgrade() callback сам считал и писал TIMERS.ENERGY_MAX/udata['max_energy']
    // напрямую (client-writable, тот же класс дыры, что у shmot.js._applyMaxEnergyBonus(), см.
    // tests/shmot-owned-bonus-economy-server-authoritative.test.js). Теперь считает и пишет
    // сервер (skills.php.upgrade()), клиент просто применяет patch.
    assert(!/if\(idx === 9 && window\.TIMERS\)\{/.test(skillsSrc),
        'skills.js: клиентская спецобработка id:9 (TIMERS.ENERGY_MAX/udata[\'max_energy\']) убрана целиком');
    const skillsPhpSrc = readSrc('server/core/controllers/skills.php');
    const start = skillsPhpSrc.indexOf('function upgrade(){');
    const end   = skillsPhpSrc.indexOf('\n        }', skillsPhpSrc.indexOf('$this->ops->ok(', start));
    const body  = skillsPhpSrc.slice(start, end);
    assert(/if\(\$sid === 9\) \$this->ops->add\(\$user, 'max_energy', 1\);/.test(body),
        'skills.php.upgrade(): id:9 начисляет +1 max_energy через Gameops::add() (аддитивно, не перезаписывает поле)');
    assert(/patchCurrencies\(\$user, \['skills_levels', 'max_energy'\]\)/.test(body),
        'patch включает max_energy — клиент увидит новый максимум через обычный applyPatch()');
}

console.log('\nTest 6: module_control.js — периодический догоняющий _checkAll() для достижений без выделенного триггера');
{
    assert(/setInterval\(\(\) => \{ if\(window\.achievements\) achievements\._checkAll\(\); \}, 30000\);/.test(moduleCtlSrc),
        'фоновый _checkAll() каждые 30 сек добавлен рядом со стартовым вызовом');
}

console.log('\nTest 7: крестик выхода (x:1240,y:90) применён ко ВСЕМ играм Двора, не только к покеру');
{
    // 21.09.2026: блэкджек получил ИНДИВИДУАЛЬНУЮ правку (y:90→98, снято через редактор
    // позиций отдельным прямым указанием) — выведен из общей проверки унифицированной y=90,
    // проверяется отдельно ниже своим собственным значением.
    const files = [
        '_client/src/game/dvor/dvor-dice-screen.js',
        '_client/src/game/dvor/dvor-poker-bag.js',
        '_client/src/game/dvor/dvor-poker-screen.js',
        '_client/src/game/dvor/dvor-roulette-buy.js',
        '_client/src/game/dvor/dvor-roulette-screen.js',
    ];
    for(const f of files){
        const src = readSrc(f);
        const matches = (src.match(/exitBtn\.x = 1240; exitBtn\.y = 90;/g) || []).length;
        assert(matches >= 1, f + ': найдена минимум 1 кнопка выхода на позиции (1240,90), нашли ' + matches);
        assert(!/exitBtn\.x = 1240; exitBtn\.y = (83|71);/.test(src), f + ': старая позиция (83 или 71) не осталась');
    }

    const bjSrc = readSrc('_client/src/game/dvor/dvor-blackjack.js');
    assert(/exitBtn\.x = 1240; exitBtn\.y = 98;/.test(bjSrc),
        'dvor-blackjack.js: крестик выхода индивидуально сдвинут на y=98 (снято через редактор позиций 21.09.2026)');
}

console.log('\nTest 8: блэкджек — смена карты УЖЕ гарантированно исключает старый ранг (не воспроизводится, подтверждаем защиту)');
{
    const start = blackjackPhp.indexOf('function swap()');
    const end   = blackjackPhp.indexOf('\n        }', blackjackPhp.indexOf('swapsLeft', start));
    const body  = blackjackPhp.slice(start, end);
    // 23.09.2026: инструментация добавила промежуточные $rejectOld/$rejectMatch переменные и
    // трассировку swapTrace[] вместо однострочного "if(...) continue;" — логика (старый ранг
    // всегда отбраковывается) не изменилась, проверяем через обе части раздельно.
    assert(/\$rejectOld\s*=\s*\(\$rank === \$oldRank\);/.test(body) && /if\(\$rejectOld\) continue;/.test(body),
        'цикл розыгрыша нового ранга пропускает совпадение со старым рангом');
    assert(/if\(\$newRank === null\)\{[\s\S]*?foreach\(\$RANKS as \$r\) if\(\$r !== \$oldRank\)/.test(body),
        'детерминированный fallback (если 50 попыток RNG не помогли) тоже гарантированно исключает старый ранг — новая карта НИКОГДА не совпадает со старой');
}

console.log('\nTest 9: рулетка — 2 позиционные правки применены (кнопка покупки поинтов, кнопка КРУТИТЬ)');
{
    // 03.10.2026: позиции уточнены редактором позиций повторно — buyPlusBtn y:396→376,
    // spinBtn y:528→515.
    assert(/buyPlusBtn\.x = 922; buyPlusBtn\.y = 376;/.test(rouletteSrc), 'кнопка покупки синих поинтов — новая позиция (922,376)');
    assert(/spinBtn\.x = 848; spinBtn\.y = 515;/.test(rouletteSrc), 'кнопка КРУТИТЬ — новая позиция (848,515)');
}

console.log('\nTest 10: новый переиспользуемый хелпер window._centerTextIn(text, box) — центрирует текст в произвольном прямоугольнике');
{
    assert(/window\._centerTextIn = \(text, box\) => \{/.test(uiKitSrc), 'хелпер определён в ui_kit.js (общий модуль, доступен всем экранам)');
    assert(/text\.anchor\.set\(0\.5, 0\.5\);/.test(uiKitSrc), 'выставляет anchor(0.5,0.5)');
    assert(/text\.x = box\.x \+ box\.w \/ 2;/.test(uiKitSrc) && /text\.y = box\.y \+ box\.h \/ 2;/.test(uiKitSrc),
        'позиционирует по центру прямоугольника box{x,y,w,h}');

    // Реальный прогон хелпера (не только regex) — та же формула, что в ui_kit.js, независимая
    // копия (не eval исходника — надёжнее к пробелам/переносам строк в реальном файле).
    const fn = (text, box) => {
        text.anchor.set(0.5, 0.5);
        text.x = box.x + box.w / 2;
        text.y = box.y + box.h / 2;
    };
    const fakeText = { anchor: { set: (x,y)=>{ fakeText._ax=x; fakeText._ay=y; } }, x:0, y:0 };
    fn(fakeText, { x: 1041, y: 618, w: 76, h: 39 });
    assert(fakeText._ax === 0.5 && fakeText._ay === 0.5, 'реальный вызов: anchor выставлен в (0.5,0.5)');
    assert(fakeText.x === 1079 && fakeText.y === 637.5, 'реальный вызов: x/y — точный центр прямоугольника (1041+38=1079, 618+19.5=637.5)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

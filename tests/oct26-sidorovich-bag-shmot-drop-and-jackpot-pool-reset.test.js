/**
 * Test: 26.10.2026, по прямому указанию — точечный прод-деплой "шмотки за рюкзак Сидоровича/
 * рулетку/покер" + ряд фиксов джекпота рулетки, перед заливкой на прод.
 *
 * Контекст (репорт пользователя): "тату пока отложили в сторону, вместо них будут шмотки,
 * перенеси шанс и логику тату на шмотки с рюкзака". Старая (отключённая в бете) клиентская
 * логика тату рюкзака была: уровень рюкзака ≥20 (топ-тир из 20) И шанс 15% — см. исторический
 * комментарий в ryukzak.js ("Бета: выпадение тату отключено. const hasTatu = level >= 20 &&
 * Math.random() < 0.15;"). Поднят по прямому указанию пользователя на шмотку 1-в-1 (тот же %,
 * то же условие уровня), через grantShmotFromSource('sidorovich_bag') — источник в
 * shmot_items.json существовал (5 предметов, id 101-105), но был полностью недостижим ни одним
 * контроллером до этой правки.
 *
 * Отдельно — такой же, давно существующий, но выключенный (0%) tatuChancePct-дроп шмотки был
 * уже вживую в roulette.php.openCase()/poker.php.openBag() (та же архитектура, что у боссов —
 * grantShmotFromSource()). По прямому указанию поднят до 10% в обоих местах. У roulette.php
 * источник ('roulette') при этом НЕ совпадал ни с одной записью каталога (там только
 * 'roulette_bag', 5 предметов) — при 0% это было безвредно (grantShmotFromSource тихо вернул
 * бы null даже при выигрышном ролле), но стало бы реальной несостыковкой при включении шанса —
 * исправлено той же правкой (источник переименован в 'roulette_bag'). У poker.php источник
 * ('poker') уже совпадал с реальным непустым пулом — там правилась только константа шанса.
 *
 * Джекпот рулетки — три отдельных репорта тем же сообщением:
 * 1) "сорвал джекпот, но его сразу не показывает, только при перезаходе в рулетку" — pickCup()
 *    (мини-игра "9 стаканчиков", ветка реального Куша) пишет udata['roulette_winner'] через
 *    applyPatch(), но баннер победителя на экране рулетки (_roulWinnerNameTxt/_roulWinnerAmtTxt/
 *    _roulWinnerPhotoSpr) перечитывается из udata только внутри _updateRouletteUI() — её никто
 *    не звал после ЭТОГО события (открытие экрана уже давно прошло, следующий спин может не
 *    случиться вовсе). Фикс — явный вызов this._updateRouletteUI() сразу после applyPatch()
 *    в _finishReveal() (dvor-roulette-minigame.js).
 * 2) "джекпот ему не упал" — pickCup()/claimPrize() пишут coins/exp/weapons/roulette_winner
 *    ПРЯМО в строку игрока через Gameops::saveUser(), в обход debounce-автосейва
 *    (modules/player-save.js) — тот же класс гонки, что уже закрыт для boss start/attack/
 *    claimKill и для _spinRoulette() в этом же файле. Без suspend/resume вокруг запроса
 *    параллельный автосейв со старым снимком udata мог прилететь ПОСЛЕ прямой записи сервера
 *    и тихо затереть уже начисленный куш обратно (см. память агента
 *    incident_checkall_flush_wipes_server_credits — тот же класс багов). Фикс — обёрнуты
 *    flushPlayerSave()+suspendPlayerSave()/resumePlayerSave() по образцу _spinRoulette().
 * 3) "сумма джекпота должна рассчитываться не от 3000, а начинаться с нуля и копиться
 *    постепенно" — jackpot_pool имел хардкоженный фолбэк/дефолт 3000 во всех аварийных ветках
 *    (нет соединения к БД, кеш-строка не найдена) И реально обнулялся на 3000 после каждой
 *    настоящей выплаты Куша. Все вхождения переведены на 0 — и на сервере (roulette.php), и на
 *    клиенте (dvor-roulette.js).
 *
 * Плюс позиционная правка (не требует отдельного теста по Правилу №10, но assert обновлён —
 * см. tests/roulette-jackpot-winner-textbox-centering-and-photo-placeholder.test.js и 3 других
 * файла с тем же пином): ник победителя поднят на 2px (y:278→276), сумма — на 3px (y:320→317).
 *
 * Run: node tests/oct26-sidorovich-bag-shmot-drop-and-jackpot-pool-reset.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf-8');

const ryukzakSrc   = read('server/core/controllers/ryukzak.php');
const rouletteSrc  = read('server/core/controllers/roulette.php');
const pokerSrc     = read('server/core/controllers/poker.php');
const catalogSrc   = read('server/json/shmot_items.json');
const ryukzakJsSrc = read('_client/src/game/shell/overlays/ryukzak.js');
const minigameSrc  = read('_client/src/game/dvor/dvor-roulette-minigame.js');
const orchSrc      = read('_client/src/game/dvor/dvor-roulette.js');

console.log('\nTest 1: ryukzak.php.open() — дроп шмотки из рюкзака Сидоровича (15% на уровне 20, источник sidorovich_bag)');
{
    const openStart = ryukzakSrc.indexOf('function open(){');
    assert(openStart !== -1, 'open() найден');
    const saveIdx = ryukzakSrc.indexOf('if(!$this->ops->saveUser($user)){', openStart);
    const body = ryukzakSrc.slice(openStart, saveIdx);
    assert(/\$hasShmot = false; \$shmotItemId = null;/.test(body), 'переменные инициализированы на безопасные дефолты (ничего не выпало)');
    assert(/if\(\$level >= 20 && mt_rand\(1, 100\) <= 15\)\{/.test(body), 'гейт level>=20 (топ-тир рюкзака) И 15% ролл — 1-в-1 перенос старой (отключённой) логики тату');
    assert(/\$shmotItemId = \$this->ops->grantShmotFromSource\(\$user, 'sidorovich_bag'\);/.test(body), 'выдаёт предмет из источника sidorovich_bag (5 предметов в каталоге, были недостижимы ДО этой правки)');
    assert(/\$hasShmot = \$shmotItemId !== null;/.test(body), 'hasShmot честно отражает результат grantShmotFromSource (null, если пул уже выбит целиком)');

    const patchIdx = ryukzakSrc.indexOf('$patch = $this->ops->patchCurrencies($user, [', openStart);
    const patchBody = ryukzakSrc.slice(patchIdx, ryukzakSrc.indexOf(']);', patchIdx) + 3);
    assert(/'shmot', 'max_energy',/.test(patchBody), "'shmot'/'max_energy' добавлены в patch — иначе клиент не узнал бы о новой шмотке/бонусе энергии без полной перезагрузки udata");

    const okIdx = ryukzakSrc.indexOf("\$this->ops->ok(['patch' => \$patch, 'reward' => \$reward", openStart);
    assert(okIdx !== -1, "ok()-ответ найден");
    assert(/'hasShmot' => \$hasShmot, 'shmotItemId' => \$shmotItemId\]\);/.test(ryukzakSrc.slice(okIdx, okIdx + 200)),
        'hasShmot/shmotItemId уходят в ответ клиенту (не только в error_log)');
}

console.log('\nTest 2: shmot_items.json — источник sidorovich_bag реально существует (5 предметов, id 101-105)');
{
    const matches = catalogSrc.match(/"source": "sidorovich_bag"/g) || [];
    assert(matches.length === 5, `ровно 5 предметов с источником sidorovich_bag, найдено ${matches.length}`);
}

console.log('\nTest 3: roulette.php.openCase() — дроп шмотки поднят до 10%, источник исправлен на roulette_bag');
{
    const openCaseStart = rouletteSrc.indexOf('function openCase(){');
    const nextFn = rouletteSrc.indexOf('\n    function ', openCaseStart + 10);
    const body = rouletteSrc.slice(openCaseStart, nextFn);
    assert(/\$tatuChancePct = 10;/.test(body), 'шанс поднят с 0 до 10%');
    assert(/grantShmotFromSource\(\$user, 'roulette_bag'\)/.test(body), "источник исправлен на 'roulette_bag' — ТОЛЬКО он реально существует в каталоге (не 'roulette')");
    assert(!/grantShmotFromSource\(\$user, 'roulette'\)/.test(body), "старый несостыкованный источник 'roulette' (без _bag) не остался рядом");
}

console.log('\nTest 4: poker.php.openBag() — дроп шмотки поднят до 10%, источник не трогали (уже был корректен)');
{
    const openBagStart = pokerSrc.indexOf('$tatuChancePct = 10;');
    assert(openBagStart !== -1, 'шанс поднят с 0 до 10%');
    const body = pokerSrc.slice(openBagStart, openBagStart + 200);
    assert(/grantShmotFromSource\(\$user, 'poker'\)/.test(body), "источник остался 'poker' — этот пул уже был непустым (5 предметов) до правки");
}

console.log('\nTest 5: джекпот — все фолбэки/дефолты jackpot_pool переведены с 3000 на 0 (сервер и клиент)');
{
    assert(!/jackpot_pool['"]?\s*=>\s*3000/.test(rouletteSrc), 'в roulette.php не осталось дефолтов jackpot_pool=>3000');
    assert(!/`jackpot_pool`=3000/.test(rouletteSrc), 'в roulette.php не осталось SQL-сбросов на jackpot_pool`=3000');
    assert(/'jackpot_pool' => 0, 'spin_counter' => 0, 'spin_threshold' => 0\] \+ \$slotResult\)/.test(rouletteSrc), 'фолбэк без _rawLink() в spin() — 0, не 3000');
    assert(/'keyring_available' => false, 'jackpot_pool' => 0, 'spin_counter' => 0, 'spin_threshold' => 0\]\);/.test(rouletteSrc), 'фолбэк без _rawLink() в status() — 0, не 3000');
    assert(/\$jackpotPool = \$row \? intval\(\$row\['jackpot_pool'\]\) : 0;/.test(rouletteSrc), 'status(): $row?..:0, не :3000');
    assert(/\$row = \$res2 \? \$res2->fetch_assoc\(\) : \['spin_threshold' => 999999999, 'keyring_cycle_ends_at' => 0, 'jackpot_pool' => 0\];/.test(rouletteSrc), 'spin(): фолбэк-массив без соединения — jackpot_pool:0, не :3000');
    assert(/`kush_threshold`=\$newT, `jackpot_pool`=0 WHERE `id`=1/.test(rouletteSrc), 'pickCup(): сброс после РЕАЛЬНОЙ выплаты Куша — на 0, не на 3000');

    assert(!/\|\| 3000/.test(orchSrc), 'клиент (dvor-roulette.js) не хардкодит фолбэк 3000 нигде');
    assert(/this\._roulJackpotPool = \(res && res\.jackpot_pool != null\) \? parseInt\(res\.jackpot_pool\) : 0;/.test(orchSrc), '_openRouletteScreen(): фолбэк статуса — 0');
    assert(/this\._roulJackTxt\.text = \(this\._roulJackpotPool \|\| 0\)\.toLocaleString/.test(orchSrc), '_updateRouletteUI(): фолбэк отображения — 0');
    assert(/this\._roulJackpotPool = res\.jackpot_pool != null \? parseInt\(res\.jackpot_pool\) : \(this\._roulJackpotPool \|\| 0\);/.test(orchSrc), '_spinRoulette() callback: фолбэк — 0');
}

console.log('\nTest 6: джекпот — победитель отображается СРАЗУ после реального выигрыша (без перезахода в рулетку)');
{
    const finishIdx = minigameSrc.indexOf('const _finishReveal = () => {');
    const applyIdx  = minigameSrc.indexOf('if(res.patch) applyPatch(res.patch);', finishIdx);
    const after     = minigameSrc.slice(applyIdx, applyIdx + 1400);
    assert(applyIdx !== -1 && applyIdx > finishIdx, '_finishReveal() и applyPatch(res.patch) найдены');
    assert(/this\._updateRouletteUI\(\);/.test(after), '_updateRouletteUI() вызывается сразу после applyPatch() — перечитывает udata[\'roulette_winner\'] в баннер победителя немедленно, не только при следующем открытии экрана');
}

console.log('\nTest 7: джекпот — pickCup()/claimPrize() защищены от гонки с автосейвом (suspend/resume)');
{
    const pickCupCallIdx = minigameSrc.indexOf("TS.php('roulette.pickCup', {idx:i}, (res)=>{");
    const before = minigameSrc.slice(Math.max(0, pickCupCallIdx - 500), pickCupCallIdx);
    assert(/flushPlayerSave\('roulette_pickcup_flush_prev', \(\) => \{/.test(before), 'pickCup(): flushPlayerSave() перед запросом (сбрасывает уже накопленные несохранённые изменения)');
    assert(/suspendPlayerSave\('roulette_pickcup'\);/.test(before), 'pickCup(): suspendPlayerSave() перед запросом');
    // Окно широкое намеренно — между вызовом pickCup и колбэком ошибки лежит вся логика
    // анимации раскрытия стаканчиков (_finishReveal/_flipCup/otherKushIdx), это не соседние строки.
    const afterPickCup = minigameSrc.slice(pickCupCallIdx, pickCupCallIdx + 10500);
    const resumeCount = (afterPickCup.match(/resumePlayerSave\('roulette_pickcup'\);/g) || []).length;
    assert(resumeCount >= 2, `pickCup(): resumePlayerSave() вызван и в успехе, и в ошибке (найдено ${resumeCount})`);

    const claimPrizeCallIdx = minigameSrc.indexOf("TS.php('roulette.claimPrize', {}, (res)=>{");
    const beforeClaim = minigameSrc.slice(Math.max(0, claimPrizeCallIdx - 300), claimPrizeCallIdx);
    assert(/suspendPlayerSave\('roulette_claimprize'\);/.test(beforeClaim), 'claimPrize(): suspendPlayerSave() перед запросом (та же гонка, credit реальных coins)');
    const afterClaim = minigameSrc.slice(claimPrizeCallIdx, claimPrizeCallIdx + 2500);
    const resumeClaimCount = (afterClaim.match(/resumePlayerSave\('roulette_claimprize'\);/g) || []).length;
    assert(resumeClaimCount >= 2, `claimPrize(): resumePlayerSave() вызван и в успехе, и в ошибке (найдено ${resumeClaimCount})`);
}

console.log('\nTest 8: ryukzak.js — баннер "шанс на шмотку" показывает РЕАЛЬНЫЙ результат (не жёсткий false)');
{
    assert(!/const HAS_SHMOT_DROP/.test(ryukzakJsSrc), 'старая жёстко-ложная константа HAS_SHMOT_DROP убрана');
    assert(/let hasShmotNow\s*=/.test(ryukzakJsSrc), 'hasShmotNow — mutable, обновляется по реальному ответу сервера');
    assert(/import \{ buildShmotTooltipCard \} from '\.\.\/shmot-tooltip\.js';/.test(ryukzakJsSrc), 'переиспользует общий компонент тултипа шмотки (не дублирует вёрстку)');
    assert(/const CARD_X_SHIFT = 0;/.test(ryukzakJsSrc), 'место под баннер снова всегда зарезервировано (фича реальна — сетка наград не "наезжает" на него)');

    const zabratIdx = ryukzakJsSrc.indexOf("TS.php('ryukzak.open', {}, (res) => {");
    assert(zabratIdx !== -1, 'колбэк ryukzak.open найден');
    const body = ryukzakJsSrc.slice(zabratIdx, zabratIdx + 1800);
    assert(/hasShmotNow\s*=\s*!!res\.hasShmot && shmotItemId !== null;/.test(body), 'hasShmotNow обновляется из res.hasShmot реального ответа сервера');
    assert(/shmotBanner\.visible = hasShmotNow;/.test(body), 'видимость баннера переключается по реальному результату ЭТОГО открытия');
    assert(/shmot\._loadFromUdata\(\)/.test(body), 'shmot.items перечитывается из udata ПЕРЕД поиском выпавшего предмета по id (иначе owned не успеет обновиться)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

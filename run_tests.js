/**
 * Pre-deploy tests for pripyat-game.ru
 * Run: node run_tests.js
 * No external libraries needed.
 */

const fs   = require('fs');
const path = require('path');

const SRC      = path.join(__dirname, '_client', 'src');
const IMAGES   = path.join(__dirname, '_client', 'development', 'images');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
    try {
        fn();
        console.log('  [OK] ' + name);
        passed++;
    } catch(e) {
        console.log('  [FAIL] ' + name);
        console.log('         ' + e.message);
        failed++;
        errors.push({ name, msg: e.message });
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

function readSrc(relPath) {
    return fs.readFileSync(path.join(SRC, relPath), 'utf-8');
}

function localImages() {
    // Нижний регистр для сравнения (Windows нечувствителен, сервер Linux чувствителен)
    return new Set(fs.readdirSync(IMAGES).map(f => f.toLowerCase()));
}

// ════════════════════════════════════════════════════════════════
// 1. ЖИЗНЕННЫЙ ЦИКЛ ЭКРАНОВ
//    Каждая функция _openXxx обязана вызывать определённые методы
// ════════════════════════════════════════════════════════════════
console.log('\n── 1. Жизненный цикл экранов ──');

const zoneScreen = readSrc('game/shell/overlays/zone_screen.js');

test('_openZoneScreen вызывает _compassShow', () => {
    assert(zoneScreen.includes('this._compassShow()'),
        '_compassShow() не вызывается — компас не будет показан');
});

test('_openZoneScreen вызывает _compassWaitTex', () => {
    assert(zoneScreen.includes('this._compassWaitTex('),
        '_compassWaitTex() не вызывается — компас будет крутиться вечно (баг v279)');
});

test('_openZoneScreen вызывает _closeAllPanels', () => {
    assert(zoneScreen.includes('this._closeAllPanels()'),
        '_closeAllPanels() не вызывается — старые панели останутся открытыми');
});

test('_openZoneScreen очищает _zoneTimerInterval при повторном открытии', () => {
    assert(zoneScreen.includes('clearInterval(this._zoneTimerInterval)'),
        'clearInterval не вызывается — таймеры будут накапливаться');
});

test('_openZoneScreen вызывает _zoneGoToIndex', () => {
    // 21.09.2026: карусель по одной локации заменила постраничное переключение —
    // _zoneUpdatePage() переименована/переработана в _zoneGoToIndex(instant).
    assert(zoneScreen.includes('this._zoneGoToIndex(true)'),
        '_zoneGoToIndex(true) не вызывается — первая локация не отобразится');
});

test('_openZoneScreen задаёт _zoneTimerInterval', () => {
    assert(zoneScreen.includes('this._zoneTimerInterval = setInterval('),
        'Таймер обновления не запускается');
});

// ════════════════════════════════════════════════════════════════
// 2. ICON_MAP — все файлы должны существовать локально
// ════════════════════════════════════════════════════════════════
console.log('\n── 2. ICON_MAP (reward.js) ──');

const rewardSrc = readSrc('game/shell/popups/reward.js');
const imgs = localImages();

// Вытащить все значения ICON_MAP из исходника
const iconMapMatch = rewardSrc.match(/const ICON_MAP\s*=\s*\{([^}]+)\}/s);
if (iconMapMatch) {
    const mapBody = iconMapMatch[1];
    const fileRefs = [...mapBody.matchAll(/'([^']+\.png)'/g)].map(m => m[1]);
    const uniqueFiles = [...new Set(fileRefs)];
    uniqueFiles.forEach(fname => {
        test('ICON_MAP: ' + fname, () => {
            assert(imgs.has(fname), 'Файл отсутствует в development/images/');
        });
    });
} else {
    test('ICON_MAP найден в reward.js', () => {
        assert(false, 'Не удалось найти ICON_MAP в reward.js');
    });
}

// ════════════════════════════════════════════════════════════════
// 3. СТАТИЧЕСКИЕ ССЫЛКИ НА КАРТИНКИ — все ./images/XXX.png
//    которые не содержат ${} (динамика) должны существовать
// ════════════════════════════════════════════════════════════════
console.log('\n── 3. Статические ссылки на картинки ──');

const shellFiles = [];
function collectFiles(dir) {
    fs.readdirSync(dir).forEach(f => {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) collectFiles(full);
        else if (f.endsWith('.js')) shellFiles.push(full);
    });
}
collectFiles(path.join(SRC, 'game', 'shell'));

// Извлекаем ./images/XXX.png — только статические (без ${})
const staticRefs = new Set();
shellFiles.forEach(file => {
    const src = fs.readFileSync(file, 'utf-8');
    const matches = src.matchAll(/['"`](\.\/)?(images\/[^'"`${}]+\.png)['"`]/g);
    for (const m of matches) staticRefs.add(m[2].replace('images/', ''));
});

staticRefs.forEach(fname => {
    // Пропускаем динамику и пути с layers/ (они в серверной подпапке, не в нашей flat структуре)
    if (fname.includes('${') || fname.includes('*')) return;
    if (fname.includes('layers/') || fname.includes('hud/')) return;
    test('images/' + fname, () => {
        assert(imgs.has(fname.toLowerCase()), 'Файл отсутствует в development/images/');
    });
});

// ════════════════════════════════════════════════════════════════
// 4. МЕТОДЫ PROTO — zone_screen должен определить все нужные
// ════════════════════════════════════════════════════════════════
console.log('\n── 4. proto-методы zone_screen ──');

const requiredZoneMethods = [
    '_openZoneScreen',
    '_zoneGoToIndex',
    '_zoneUpdateCollect',
];

requiredZoneMethods.forEach(method => {
    test('zone_screen определяет proto.' + method, () => {
        assert(zoneScreen.includes('proto.' + method + ' = function'),
            'Метод не определён — runtime crash при вызове');
    });
});

// ════════════════════════════════════════════════════════════════
// 5. REWARD POPUP — структурные проверки
// ════════════════════════════════════════════════════════════════
console.log('\n── 5. Reward popup ──');

test('reward.js определяет proto._showRewardPopup', () => {
    assert(rewardSrc.includes('proto._showRewardPopup = function'),
        'Метод не определён');
});

test('reward.js использует допустимый CARD_SCALE', () => {
    const match = rewardSrc.match(/const CARD_SCALE\s*=\s*([\d.]+)/);
    assert(match, 'CARD_SCALE не найден');
    const val = parseFloat(match[1]);
    assert(val >= 0.5 && val <= 1.5, `CARD_SCALE = ${val} — значение вне допустимого диапазона 0.5–1.5`);
});

test('reward.js очищает _rewardTimer при повторном открытии', () => {
    assert(rewardSrc.includes('clearTimeout(this._rewardTimer)'),
        'clearTimeout не вызывается — таймеры накапливаются');
});

// ════════════════════════════════════════════════════════════════
// 6. СКИЛЛЫ И БОССЫ — регрессии 16.09.2026
// ════════════════════════════════════════════════════════════════
console.log('\n── 6. Скиллы и боссы ──');

// 18.09.2026 — SERVER-AUTHORITATIVE СКИЛЛЫ: upgrade() раньше был синхронным (мгновенно
// возвращал true/false и мутировал this.levels), что позволяло эти два теста выполнять
// runtime-eval класса Skills через new Function(skillsSrc...) — трюк, которым этот файл
// оживлял ES-класс без реального ES-модульного загрузчика. С добавлением
// `import { applyPatch } from '../modules/patch.js'` наверху skills.js (нужен для applyPatch
// в новом asynchronous upgrade()) этот трюк ломается — "Cannot use import statement outside
// a module". Асинхронная природа upgrade() всё равно сделала бы прежний
// "s.upgrade(0) === true" синхронным ожиданием неверным. Подробная поведенческая проверка
// той же самой арифметики (очки/максимум) теперь живёт на СЕРВЕРЕ — см.
// tests/skills-server-authoritative.test.js (проверки). Здесь — лёгкая регресс-проверка,
// что формула (1 очко за КАЖДЫЙ уровень КАЖДОГО скилла, включая первый уровень скилла 0 —
// 18.09.2026, льгота "первый скилл бесплатно" убрана целиком по прямому указанию) не
// потерялась при переносе.
const skillsPhp = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'skills.php'), 'utf-8');
test('Размашистый: льготы больше нет — первый уровень скилла 0 тоже стоит очко (skills.php)', () => {
    assert(!/usedFreeFirstSkill/.test(skillsPhp), 'бесплатная прокачка скилла 0 (usedFreeFirstSkill) удалена целиком');
    assert(/foreach\(\$levels as \$v\) \$spent \+= intval\(\$v\);/.test(skillsPhp),
        '_spentPoints() считает ВСЕ уровни без исключений (раньше skill 0 первый уровень не считался)');
});

test('Размашистый: каждый уровень (включая первый скилла 0) расходует одно очко (skills.php)', () => {
    // 25.09.2026: доступные очки читаются из персистентного $state['points'] (см.
    // tests/skills-server-authoritative.test.js Test 10), не пересчитываются earned-spent на лету.
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): проверка стала
    // многострочным блоком (добавлен rollback/close лока строки перед return при нехватке
    // очков, см. tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js), поэтому
    // старый однострочный regex больше не матчится — сам инвариант (нужно >=1 очко) не менялся.
    assert(/if\(intval\(\$state\['points'\] \?\? 0\) < 1\)\{/.test(skillsPhp),
        'проверка доступных очков не найдена в skills.php.upgrade()');
    assert(/return \$this->ops->fail\(78\); \/\/ недостаточно очков скиллов/.test(skillsPhp),
        'отказ при нехватке очков возвращает код 78');
    assert(/\$levels\[\$sid\] = intval\(\$levels\[\$sid\]\) \+ 1;/.test(skillsPhp),
        'оплаченная прокачка должна увеличивать уровень ровно на 1');
});

const bossesPhp = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
// 22.09.2026: bosses.rating() переработан на boss_damage_log (см. tests/boss-attack-server-
// authoritative-and-timing-friend-rule.test.js и tests/boss-rating-log-based-no-stale-peaks-
// cache.test.js) — сам расчёт топа вынесен в общий приватный _ratingTop(), переиспользуемый
// claimKill() (см. tests/boss-victory-popup-top-and-double-kill-count-fix.test.js). Этот тест
// обновлён на актуальную структуру вместо давно устаревших curCycleDmg/bossDamage полей.
// 24.09.2026: граница захвата исправлена на "\n {8}\}" (ровно уровень отступа самой функции) —
// старый "\n\s*\}" ловил ПЕРВУЮ попавшуюся закрывающую скобку ЛЮБОГО отступа (например, вложенный
// if(!empty($perUser)){...} на 16 пробелах), обрезая тело _ratingTop() раньше реального конца и
// теряя хвост (array_slice(...) ниже). Названия хелперов сверены с текущей реализацией
// (_friendsDamagePerUserSince, не устаревшее _storedFriendDamagePerUser; гейт
// diffIdx!==3 && !empty($friendIds), не голое if($diffIdx!==3)).
const ratingTopBody = bossesPhp.match(/private function _ratingTop\([^)]*\)\{([\s\S]*?)\n {8}\}/);
test('Рейтинг босса — по друзьям, по урону с boss_damage_log, в соло без друзей, топ-9', () => {
    assert(ratingTopBody, 'не найден метод bosses._ratingTop');
    assert(ratingTopBody[1].includes('_damageSumSince('), 'рейтинг читает собственный урон из boss_damage_log (_damageSumSince), не устаревшее поле');
    assert(ratingTopBody[1].includes('_friendsDamagePerUserSince('),
        'рейтинг берёт вклад друзей тем же методом, что и везде (_friendsDamagePerUserSince)');
    assert(ratingTopBody[1].includes('$diffIdx !== 3'), 'в соло (diff_idx=3) друзья НЕ подмешиваются — только сам игрок');
    assert(!ratingTopBody[1].includes('curCycleDmg') && !ratingTopBody[1].includes('bossDamage'),
        'старые client-writable поля curCycleDmg/bossDamage больше не используются в рейтинге — только boss_damage_log');
    // 18.09.2026: топ-3 → топ-9 — новый попап результата боя показывает места 1-3 фото-аватарками
    // (УЧАСТНИКИ БОЯ) и места 4-9 текстовым списком (ТОП УРОНА), см. boss_result.js.
    // 04.10.2026 (по прямому указанию — "может быть такое что я не попаду в топ, поэтому имеет
    // смысл брать не 8 лучших игроков по вкладу, а всё-таки 9"): раньше себя и друзей сливали в
    // один список и резали array_slice(,0,9) НАРАВНЕ — при 9+ друзьях с большим уроном своя
    // строка могла вылететь из топа СВОЕГО ЖЕ боя. Теперь себя показываем ВСЕГДА (если бил), а
    // топ-8 берём только среди друзей — итог тот же максимум 9 строк, но свой вклад гарантирован.
    assert(ratingTopBody[1].includes('array_slice($friendEntries, 0, 8)'), 'топ друзей не ограничен 8 лучшими по вкладу');
    assert(ratingTopBody[1].includes('$entries = $myEntry ? array_merge([$myEntry], $topFriends) : $topFriends;'),
        'своя строка не гарантирована в итоговом списке — может быть вытеснена друзьями с большим уроном');
});

const bossesCoreSrc = readSrc('game/bosses.js');
const bossesCombatSrc = readSrc('game/bosses/bosses-combat.js');
const bossesSelectSrc = readSrc('game/shell/overlays/bosses_select.js');
test('Охотник всегда имеет 999 нерасходуемых ключей', () => {
    assert(bossesCoreSrc.includes('this.keys         = [999,'), 'начальное число ключей Охотника не равно 999');
    assert(bossesCombatSrc.includes('this.keys[0] = 999'), 'старое сохранение может вернуть ключи Охотника к другому числу');
    assert(bossesCoreSrc.includes("name:'Охотник',     keys_needed:0"), 'Охотник может расходовать ключи');
    assert(bossesSelectSrc.includes('if(i === 0) have = 999'), 'на карточке Охотника не гарантирован вывод 999');
});

test('Счётчик ключей центрируется для 1–3 цифр и ограничивается значением 999', () => {
    assert(bossesSelectSrc.includes('const shownKeys = Math.min(999, have)'), 'визуальный счётчик не ограничен 999');
    assert(bossesSelectSrc.includes('const KEY_TEXT_X_BY_DIGITS = { 1: 296, 2: 293, 3: 286 }'), 'нет координат для 1/2/3 цифр');
    assert(bossesSelectSrc.includes("keysTxt.x = KEY_TEXT_X_BY_DIGITS[String(shownKeys).length] || 286"), 'X не выбирается по числу цифр');
    assert(bossesSelectSrc.includes('keysTxt.y = cardY + 20'), 'координата Y не привязана одинаково к каждой карточке');
    // 08.10.2026 (фикс пикселизации текста): fontSize:18×scale(1.333) заменены на fontSize:24
    // без scale — тот же итоговый размер, но текст рендерится сразу чётким, не растянутым.
    assert(bossesSelectSrc.includes("fontSize: 24, fill: '#e8e0d0',"), 'итоговый размер счётчика ключей не применён ко всем карточкам (fontSize 18×1.333≈24)');
    assert(bossesSelectSrc.includes('kcSpr.alpha = 0.7'), 'связка ключей не имеет прозрачность 70%');
});

test('Убито, лимит и таймер имеют одинаковые координаты относительно каждой карточки', () => {
    // 25.09.2026: KILLED_DY 128→124 (сдвиг на 4px вверх, по прямому указанию пользователя).
    // 08.10.2026 (фикс пикселизации текста): KILLED_SCALE=1.083 убран, fontSize killedTxt
    // вынесен сразу в итоговый размер (20×1.083≈22) — позиция (KILLED_X/KILLED_DY) не менялась.
    assert(bossesSelectSrc.includes('const KILLED_X = 310, KILLED_DY = 124;'), 'позиция числа УБИТО не совпадает с Баркутом');
    assert(bossesSelectSrc.includes('const DAILY_X = 380, DAILY_DY = 126'), 'ЛИМИТ не привязан к общей позиции');
    assert(bossesSelectSrc.includes('const TIMER_X = 380, TIMER_DY = 148'), 'таймер не привязан к общей позиции');
    assert(!bossesSelectSrc.includes('(i === 0 ? -8 : 0)'), 'у Охотника остался отдельный сдвиг подписей');
});

// ════════════════════════════════════════════════════════════════
// 7. ЗАРИКИ, РУЛЕТКА И РЮКЗАК — регрессии 16.09.2026
// ════════════════════════════════════════════════════════════════
console.log('\n── 7. Зарики, рулетка и рюкзак ──');

const diceGameSrc = readSrc('game/dvor/dvor-dice-game.js');
const dicePhpSrc  = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'dice.php'), 'utf-8');
// 18.09.2026, перенос экономики на сервер: списание красного поинта (и сама проверка "хватает
// ли") переехало в dice.php.start() — client-side больше НЕ решает, можно играть или нет,
// только просит сервер и показывает его ответ. Тест обновлён на новое место истины.
test('Зарики требуют и списывают ровно один красный поинт (теперь на сервере)', () => {
    const start = dicePhpSrc.indexOf('function start(){');
    const end   = dicePhpSrc.indexOf('\n        }', dicePhpSrc.indexOf('$this->ops->ok([\'patch\' => $patch, \'rolls\' => $rolls, \'swapsAllowed\'', start));
    const body  = dicePhpSrc.slice(start, end);
    assert(body.includes("if(!\$this->ops->deduct(\$user, 'dice_points', 1)) return \$this->ops->fail(67);"),
        'нет блокировки игры при нуле красных поинтов на сервере');
    assert(diceGameSrc.includes("err && err.code === 67"), 'клиент показывает понятную ошибку при отказе сервера (недостаточно поинтов)');
    assert(!body.includes("udata['coins']") && !body.includes("'coins'"), 'сервер всё ещё не может заменить красный поинт рублями');
});

const diceUiSrc = readSrc('game/dvor/dvor-dice.js');
test('Над кнопкой Зариков нет дублирующей подписи о стоимости игры', () => {
    assert(!diceUiSrc.includes('1 ИГРА = 1 КРАСНЫЙ ПОИНТ'),
        'над кнопкой осталась лишняя подпись «1 ИГРА = 1 КРАСНЫЙ ПОИНТ»');
});

// Бесплатный ежедневный бросок возвращён 16.09.2026 (по прямому указанию, на этот раз через
// честный udata['dice_free_ts'], без скрытого списания рублей — см. подробный комментарий в
// dvor-dice-game.js._playDiceNewScreen). Текст над кнопкой теперь ЖИВОЙ: «БЕСПЛАТНЫЙ БРОСОК»
// или обратный отсчёт до него — то самое служебное поле из предыдущего теста больше НЕ должно
// быть пустой заглушкой.
test('Над кнопкой Зариков показывается бесплатный бросок или обратный отсчёт до него', () => {
    assert(diceUiSrc.includes("udata['dice_free_ts']"),
        'таймер не читает udata[\'dice_free_ts\'] — бесплатный бросок не отслеживается');
    assert(diceUiSrc.includes("'БЕСПЛАТНЫЙ БРОСОК'"),
        'нет текста «БЕСПЛАТНЫЙ БРОСОК», когда бросок доступен');
    assert(diceUiSrc.includes("'БЕСПЛАТНЫЙ БРОСОК ЧЕРЕЗ: '"),
        'нет обратного отсчёта «БЕСПЛАТНЫЙ БРОСОК ЧЕРЕЗ: HH:MM:SS», когда бросок использован');
    assert(!diceUiSrc.includes("this._diceTimerTxt.text = ''"),
        'старая заглушка (текст всегда пустой) всё ещё осталась');
    assert(/setInterval\(\(\) => this\._updateDiceTimer\(\), 1000\)/.test(diceUiSrc),
        '_startDiceTimer не заводит повторяющийся интервал — обратный отсчёт не будет тикать сам по себе');
});

// 18.09.2026: бесплатный/платный выбор тоже переехал в dice.php.start() — сервер сам решает
// freeAvailable ПЕРЕД проверкой dice_points (тот же порядок, что был у клиента раньше).
test('dice.php.start() сначала проверяет бесплатный бросок, платный поинт — только если бесплатный уже использован', () => {
    const start = dicePhpSrc.indexOf('function start(){');
    const end   = dicePhpSrc.indexOf('\n        }', dicePhpSrc.indexOf('$this->ops->ok([\'patch\' => $patch, \'rolls\' => $rolls, \'swapsAllowed\'', start));
    const body  = dicePhpSrc.slice(start, end);
    assert(body.includes("dice_free_ts"), 'не проверяет dice_free_ts в начале броска');
    assert(body.includes('freeAvailable'), 'нет явного флага freeAvailable — сложно проверить порядок условий');
    assert(body.indexOf('$freeAvailable =') < body.indexOf("deduct(\$user, 'dice_points'"),
        'проверка бесплатного броска идёт ПЕРЕД списанием красных поинтов');
});

// 18.09.2026: раздача по таблице (за КАЖДОЕ значение с парой+, до двух одновременных наград)
// тоже переехала в dice.php.resolve() — клиент только подсвечивает нужные строки по res.rewards.
test('dice.php.resolve() начисляет обе награды при двух разных парах', () => {
    const start = dicePhpSrc.indexOf('function resolve(){');
    const end   = dicePhpSrc.indexOf('\n        }', dicePhpSrc.lastIndexOf('$this->ops->ok(['));
    const body  = dicePhpSrc.slice(start, end);
    assert(/foreach\(\$catalog\['table'\] as \$row\)\{/.test(body), 'перебирает ВСЮ таблицу, а не останавливается на первом совпадении');
    assert(!/break;/.test(body.slice(body.indexOf("foreach(\$catalog['table']"), body.indexOf('if(empty($rewards))'))),
        'нет break внутри перебора таблицы — иначе засчитывалась бы только первая пара из двух одновременных');
    assert(diceGameSrc.includes('this._diceShowComboHighlight(hitIndices)'),
        'клиент подсвечивает ВСЕ строки из res.rewards, а не только первую');
});

const rouletteSrc = readSrc('game/dvor/dvor-roulette.js');
test('Рулетка объясняет ошибку при отсутствии синих поинтов', () => {
    assert(rouletteSrc.includes("'Недостаточно синих поинтов!'"), 'нет понятного заголовка ошибки');
    assert(rouletteSrc.includes("'Для прокрутки рулетки нужен 1 синий поинт. У вас: 0'"),
        'нет пояснения стоимости и текущего баланса');
});

const ryukzakSrc = readSrc('game/shell/overlays/ryukzak.js');
test('Числа наград рюкзака имеют цвет #1a1a1a', () => {
    assert(ryukzakSrc.includes("fontFamily: 'Southbank LT', fontSize: 24, fill: '#1a1a1a'"),
        'цвет чисел наград рюкзака не изменён на #1a1a1a');
});

const zoneSrc = readSrc('game/zone.js');
test('Награды чекпоинта имеют единый белый стиль и промежуток 14 px', () => {
    const start = zoneSrc.indexOf('_showCpReward(xp, cig, resp){');
    const end = zoneSrc.indexOf('_showStashPickup(){');
    const body = zoneSrc.slice(start, end);
    assert(body.includes('const REWARD_FONT_SIZE = 24'), 'нет единого размера текста наград');
    assert(body.includes('const REWARD_ROW_GAP = 14'), 'между блоками наград не задан промежуток 14 px');
    assert(body.includes("fill:'#ffffff'"), 'единый цвет текста наград не белый');
    assert((body.match(/REWARD_STYLE/g) || []).length === 4,
        'XP, сигареты и уважение не используют один общий стиль');
    assert(body.includes('const xpY = -REWARD_ROW_STEP') && body.includes('const respY = REWARD_ROW_STEP'),
        'три блока не выровнены по единому вертикальному шагу');
});

test('Прогресс локаций загружается из строки и из JSON-объекта БД', () => {
    assert(zoneSrc.includes("const saved = typeof raw === 'string' ? JSON.parse(raw) : raw"),
        'zone по-прежнему безусловно передаётся в JSON.parse');
    assert(zoneSrc.includes("console.error('[zone._loadFromUdata]"), 'ошибка загрузки прогресса по-прежнему скрывается');
    assert(zoneSrc.includes("TS.php('users.save', {udata_json: JSON.stringify(udata)}"), 'изменения локации не отправляются в users.save');
});

const levelUpSrc = readSrc('game/shell/popups/level_up.js');
test('Кнопка Поделиться использует только актуальный VK Share', () => {
    assert(!levelUpSrc.includes('VKWebAppShowWallPostBox'), 'устаревший постинг на стену не удалён');
    assert(levelUpSrc.includes("bridge.send('VKWebAppShare'"), 'нет системного VK Share');
    assert(levelUpSrc.includes("notify.showResult({text:'Не удалось поделиться"), 'ошибка VK API остаётся невидимой пользователю');
});

// 24.09.2026 (декларативный рефакторинг ХУДа, см. tests/declarative-hud-refactor.test.js):
// placeHudUnderRyukzak() убрана целиком — старая ручная цепочка (this.up/this.down.visible)
// заменена на iface.pushHud(). 25.09.2026 (по прямому указанию, скриншот — "теряется нижний
// ХУД, должно быть просто поверх Сидоровича"): {up:false,down:false} от 24.09.2026 заменено на
// pushHud('ryukzak', {}) — ХУД больше не трогается, попап просто накладывается поверх (окно
// Сидоровича на заднем фоне по-прежнему не закрывается — overlay, не замена экрана).
test('Рюкзак открывается просто поверх текущего экрана через декларативный pushHud, Сидорович на фоне не закрывается', () => {
    assert(ryukzakSrc.includes("this.pushHud('ryukzak', {});"), "открытие Рюкзака не регистрирует pushHud('ryukzak', {})");
    assert(ryukzakSrc.includes("this.popHud('ryukzak');"), 'кнопка НАЗАД не снимает регистрацию через popHud');
    assert(!ryukzakSrc.includes('const placeHudUnderRyukzak'), 'старая ручная функция placeHudUnderRyukzak должна быть убрана целиком (заменена декларативным стеком)');
});

// 22.09.2026: боевая система боссов переписана на server-authoritative bosses.attack() — HP
// больше НЕ считается и не хранится на клиенте вообще (ни curCycleDmg, ни bossDamage), клиент
// только выставляет производный HP, пришедший от сервера. Тест обновлён с устаревшей проверки
// клиентского накопления урона на актуальную — см. tests/boss-attack-server-authoritative-and-
// timing-friend-rule.test.js для полного покрытия.
test('HP боссов выставляется ТОЛЬКО из производного ответа сервера, клиент урон сам не копит', () => {
    assert(bossesCombatSrc.includes('this._setHp(idx, res.hp)'),
        '_attack() не выставляет HP из res.hp — клиент может считать урон сам, что и было багом');
    assert(!bossesCombatSrc.includes('damageData.bossDamage[idx] ='),
        'старое клиентское накопление bossDamage всё ещё существует — можно исказить рейтинг через консоль');
});

// 24.09.2026: HP переехал с чистого пересчёта (_derivedHp(), убрана) на личный мутируемый
// кэш boss_fight_session + курсор урона друга (_syncFightSession()/_applyFriendDamage(), см.
// большой комментарий в bosses.php и tests/boss-fight-session-cache-and-friend-cursor.test.js)
// — "потребление ровно один раз" теперь обеспечивает курсор (id > cursorId), не отдельная
// функция _consumeFriendDamage (которая в текущей архитектуре не существует).
test('Помощь друзей (friendsDamage) — HP из личного кэша (boss_fight_session), не client-writable поля', () => {
    const friendsStart = bossesPhp.indexOf('function friendsDamage()');
    const friendsEnd   = bossesPhp.indexOf('function rating()', friendsStart);
    const friendsBody  = friendsStart !== -1 && friendsEnd !== -1 ? bossesPhp.slice(friendsStart, friendsEnd) : null;
    assert(friendsBody, 'не найден метод friendsDamage (сигнатура могла измениться)');
    // 04.10.2026 (по прямому указанию, найдено на реальных прод-данных — "cursorId уехал вперёд,
    // а hp не упал"): голый _syncFightSession() + отдельное $user['boss_fight_session']=
    // json_encode($session) были уязвимы к гонке с параллельным attack()/useSedoy() (lost
    // update — кто сохранил последним, тот и победил). Теперь — _syncFightSessionLocked()
    // (блокирует строку SELECT...FOR UPDATE, перечитывает кэш ПОД локом) + _commitFightSession()
    // (пишет сырым UPDATE и коммитит) — см. tests/boss-fight-session-row-lock-race.test.js.
    assert(friendsBody.includes('_syncFightSessionLocked('), 'HP синхронизируется через общий locked-метод с attack()/startFight()/useSedoy()');
    assert(friendsBody.includes('_commitFightSession('),
        'обновлённый кэш (курсор + hp) реально сохраняется атомарно под локом — иначе урон друга мог теряться при гонке с параллельным запросом');
    assert(friendsBody.includes('saveUser($user)'), 'остальные поля (напр. friends_since) по-прежнему сохраняются обычным saveUser()');
    assert(!friendsBody.includes('curCycleDmg') && !friendsBody.includes('bossDamage'),
        'friendsDamage всё ещё читает старые client-writable поля вместо boss_damage_log');
});

const bossesFightSrc = readSrc('game/shell/overlays/bosses_fight.js');
test('Пустые мачете, ствол и автомат открывают единый попап покупки оружия', () => {
    const start = bossesFightSrc.indexOf('proto._attackWithWeapon = function(weapIdx)');
    const end = bossesFightSrc.indexOf('proto._openNoWeaponPopup = function()');
    const body = bossesFightSrc.slice(start, end);
    assert(body.includes("weapIdx > 2 && (!wp.owned || (parseInt(wp.qty)||0) <= 0)"),
        'нулевое количество магазинного оружия не проверяется до атаки');
    assert(body.includes('this._openNoWeaponPopup()'),
        'для пустого магазинного оружия не открывается попап «ТОРМОЗИ»');
    assert(bossesCombatSrc.includes("typeof iface._openNoWeaponPopup === 'function'"),
        'внутренняя проверка боя не использует тот же попап как резервный путь');
});

// ════════════════════════════════════════════════════════════════
// 8. ШМОТКИ И ТОПЫ — регрессии слоёв руки и лимита топа урона
// ════════════════════════════════════════════════════════════════
console.log('\n── 8. Шмотки и топы ──');

const homeSrc = readSrc('game/home.js');
const shmotShopSrc = readSrc('game/shell/overlays/shmot_shop.js');
const hataSrc = readSrc('game/shell/overlays/hata.js');
const profileSrc = readSrc('game/shell/overlays/player_profile.js');
const topPhpSrc = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'top.php'), 'utf-8');
const leaderboardSrc = readSrc('game/svod/svod-leaderboard.js');

test('Оружие между левой и правой руками: левая ниже, правая выше', () => {
    assert(/getChildIndex\(this\._leftHandSpr\)/.test(homeSrc),
        'главный экран не ставит предмет сразу после левой руки');
    assert(/getChildIndex\(this\._manLeftHandSpr\)/.test(shmotShopSrc),
        'манекен магазина не ставит предмет сразу после левой руки');
    assert(/getChildIndex\(this\._charLeftHandSpr\)/.test(hataSrc),
        'превью хаты не ставит предмет сразу после левой руки');
    assert(/getChildIndex\(leftHandSpr\)/.test(profileSrc),
        'профиль игрока не ставит предмет сразу после левой руки');
    assert(/addChildAt\(this\._rightHandSpr, root\.layer0_mc\.getChildIndex\(spr\) \+ 1\)/.test(homeSrc),
        'главный экран не переносит правую руку выше обычного предмета');
    assert(/eq\.id === 62 \|\| eq\.id === 92/.test(homeSrc),
        'для часов Poker и цепи Teenager нет исключения поверх правой руки');
});

test('Ресинхронизация зоны не сбрасывает остаток КД, а dev-выдача шмота начисляет энергию', () => {
    const zoneSrc = readSrc('game/zone.js');
    const usersPhp = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
    const devPanelSrc = readSrc('game/shell/overlays/dev_panel.js');
    assert(/TIMERS\.syncFromPatch\(fresh\.energy, fresh\.energy_time\)/.test(zoneSrc),
        'ресинхронизация зоны не использует server energy_time');
    assert(!/fresh\.energy[\s\S]{0,180}energy_base_time\s*=\s*Date\.now\(\)/.test(zoneSrc),
        'ресинхронизация зоны сбрасывает таймер на пять минут');
    assert(/applyShmotOwnBonus\(\$user, intval\(\$id\)\)/.test(usersPhp),
        'dev-выдача одежды не начисляет её бонус max_energy');
    assert(/_toggleDevKeyring/.test(devPanelSrc),
        'в dev-панели нет выдачи связки ключей');
});

test('Кнопка отмены и число в полной звезде достижений используют заданные координаты и стиль', () => {
    const bossesFightSrc = readSrc('game/shell/overlays/bosses_fight.js');
    const svodAchievementsSrc = readSrc('game/svod/svod-achievements.js');
    assert(/makeParallelogramHit\(win, 666, 388, 219, 36, 18\)/.test(bossesFightSrc),
        'хит-зона отмены в попапе оружия не совпадает с координатами из редактора');
    assert(/starPtsTxt = new PIXI\.Text\('', \{[^}]*fill:'#ffffff'/.test(svodAchievementsSrc),
        'число в полной звезде не белое');
    // 29.09.2026 (по прямому указанию): starPtsTxt.x сдвинут на star.x + 1 (было ровно star.x) —
    // число внутри звезды визуально сидело чуть левее геометрического центра иконки.
    assert(/starPtsTxt\.anchor\.set\(0\.5, 0\.5\);[\s\S]{0,100}starPtsTxt\.x = star\.x \+ 1; starPtsTxt\.y = star\.y/.test(svodAchievementsSrc),
        'число в полной звезде сдвинуто на +1px вправо относительно центра спрайта');
});

test('Топ по урону отдаёт и отображает до 100 игроков', () => {
    assert(/\$cat === 0 \|\| \$cat === 4 \|\| \$cat === 5/.test(topPhpSrc),
        'cat:0 не включён в серверный лимит 100 строк');
    assert(/LIMIT " \. \$this->_rowsLimit\(0\)/.test(topPhpSrc),
        'недельный топ урона не использует общий лимит строк');
    assert(/const ROWS_POOL = 100;/.test(leaderboardSrc),
        'клиентский пул строк не рассчитан на 100 игроков');
});

test('Нулевой недельный урон не исключает игрока из топа', () => {
    const weeklyTopStart = topPhpSrc.indexOf('private function _getWeeklyDamageTop()');
    const weeklyTop = topPhpSrc.slice(weeklyTopStart);
    assert(/FROM `\{\$utb\}` u[\s\S]*LEFT JOIN/.test(weeklyTop),
        'недельный топ должен начинаться с таблицы пользователей и подмешивать урон LEFT JOIN-ом');
    assert(/COALESCE\(d\.dmg, 0\)/.test(weeklyTop),
        'игрок без ударов должен получать значение урона 0');
});

test('Сброс аккаунта закрывает хабар и очищает его таймер', () => {
    const devPanelSrc = readSrc('game/shell/overlays/dev_panel.js');
    assert(/if\(window\.habar && typeof habar\.close === 'function'\) habar\.close\(\);/.test(devPanelSrc),
        'сброс не вызывает habar.close()');
    const habarSrc = readSrc('game/habar.js');
    assert(/clearInterval\(this\._habarTimerInterval\)/.test(habarSrc),
        'habar.close() не останавливает собственный таймер');
});

test('Связка ключей — личная награда с PNG и не блокируется другим игроком', () => {
    const rouletteSrc = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'roulette.php'), 'utf-8');
    const bossesPhp = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
    const claimStart = rouletteSrc.indexOf('private function _tryClaimKeyring()');
    const claim = rouletteSrc.slice(claimStart, rouletteSrc.indexOf('\n    }', claimStart) + 6);
    const shmotSrc = readSrc('game/shmot.js');
    assert(/\$user\['keyring_owner'\] = 1/.test(claim),
        'выдача связки не сохраняет личное право игрока');
    assert(!/keyring_cycle_ends_at/.test(claim),
        'выдача связки всё ещё зависит от глобального владельца или цикла');
    // 30.09.2026 (третий заход в тот же день): ?cb=2/?cb=3 не помогли — кэш вне нашего контроля
    // (похоже на прокси/CDN самого ВК) игнорировал смену query-параметра. Файл переименован в
    // "связка ключей v2.png" — смена пути гарантированно пробивает любой кэш.
    assert(/imgFile:'связка ключей v2\.png'/.test(shmotSrc),
        'у связки не задана собственная PNG-картинка');
    assert(fs.existsSync(path.join(__dirname, '_client', 'development', 'images', 'shmot', 'связка ключей v2.png')),
        'PNG связки отсутствует среди ассетов одежды');
    assert(/keyringItem\.owned = !!\(udata && parseInt\(udata\['keyring_owner'\]\) > 0\)/.test(shmotSrc),
        'право владельца связки не читается из server-only флага');
    assert(/\$hasKeyring = \$this->ops->i\(\$user, 'keyring_owner'\) > 0/.test(bossesPhp),
        'сервер боссов не читает личное право владельца связки');
    assert(/if\(!\$hasKeyring\)\{\s*if\(\$needKeys > 0/.test(bossesPhp),
        'владелец связки всё ещё проходит проверку и списание ключей');
});

test('Связка ключей экипируется как обычный предмет руки', () => {
    const shmotSrc = readSrc('game/shmot.js');
    const shopSrc = readSrc('game/shell/overlays/shmot_shop.js');
    const shmotPhp = fs.readFileSync(path.join(__dirname, 'server', 'core', 'controllers', 'shmot.php'), 'utf-8');
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'server', 'json', 'shmot_items.json'), 'utf-8'));
    assert(/id:100, cat:6[\s\S]{0,260}cellDx:-10, cellDy:-26, cellScale:0\.239[\s\S]{0,180}manDx:-13, manDy:30, manScale:0\.170/.test(shmotSrc),
        'у связки не заданы новые масштаб и посадка на персонаже');
    assert(/bonus:'Атака любого босса без использования ключей'[\s\S]{0,120}source:'Рулетка \(мини-игра\)'/.test(shmotSrc),
        'у связки неверные текст бонуса или требование');
    assert(!/if\(itemId === 100\)\{\s*notify\.showResult\(\{text: item\.owned/.test(shmotSrc),
        'полученная связка всё ещё заблокирована вместо стандартного надевания');
    assert(/if\(item && \(item\.owned \|\| item\.price\)\)/.test(shopSrc),
        'у связки нет кнопки «НАДЕТЬ/НАДЕТО» в ячейке');
    assert(catalog.some(it => it.id === 100 && it.cat === 6),
        'серверный каталог не признаёт связку предметом руки');
    assert(/if\(\$item_id === 100 && \$this->ops->i\(\$user, 'keyring_owner'\) > 0\)/.test(shmotPhp),
        'сервер не связывает право на связку с её экипировкой');
    assert(/foreach\(\$catalog as \$it\)[\s\S]{0,650}\$shmot\[\$iid\]\['equipped'\] = false;/.test(shmotPhp),
        'при надевании предмета руки сервер не снимает предыдущий предмет той же категории');
    assert(/Object\.entries\(saved \|\| \{\}\)/.test(shmotSrc),
        'клиент не читает разреженное JSON-состояние шмоток, в котором лежит id 100 связки');
});

test('Трата энергии в зоне сохраняет уже прошедшую часть пяти минут', () => {
    const zoneSrc = readSrc('game/zone.js');
    const attackStart = zoneSrc.indexOf('_attack(locIdx, cpIdx)');
    const attack = zoneSrc.slice(attackStart, zoneSrc.indexOf('_capture(', attackStart));
    assert(/applyPatch\(res\.patch\)/.test(attack),
        'ответ зоны не синхронизирует энергию с серверным energy_time');
    assert(!/TIMERS\.energy_base_time\s*=\s*Date\.now\(\)/.test(attack),
        'после ответа зоны клиент сбрасывает остаток КД энергии на полные пять минут');
});

// ════════════════════════════════════════════════════════════════
// ИТОГ
// ════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`Итог: ${passed} прошли, ${failed} провалились`);
if (errors.length) {
    console.log('\nПровалившиеся:');
    errors.forEach(e => console.log('  ✗ ' + e.name + ': ' + e.msg));
    process.exit(1);
} else {
    console.log('Все тесты прошли — можно деплоить!');
}

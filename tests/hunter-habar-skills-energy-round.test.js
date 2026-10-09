/**
 * Test: пакет правок по 9-скриншотному сообщению пользователя (охотник/хабар/скиллы/энергия).
 *
 * 1) Хабар — кнопки "КУПИТЬ"/"СОБРАТЬ" заменены на новые ассеты, сбор ограничен 24 часами
 *    с таймером обратного отсчёта под кнопкой (раньше собирать можно было бесконечно часто,
 *    только общий лимит 30 сборов).
 * 2) Скиллы — убрана логика "первый скилл бесплатный", теперь все скиллы платные.
 * 3) Энергия — попап покупки энергии всегда поднимается в топ layer2_mc при повторном открытии
 *    (раньше оставался под уже открытым попапом локации); сетка из 8 карточек пересчитана на
 *    единый размер и раскладку с шагом 200px по замерам через редактор позиций.
 * 4) Босс "Охотник" — таймер боя временно уменьшен до 1 минуты для теста (было 9 часов);
 *    урон добивающего удара пушится на сервер сразу (не через 60-сек. автосейв), чтобы
 *    "РЕЙТИНГ УРОНА" у друзей не терял убийцу; фото "УБИВШЕГО" теперь можно вращать в редакторе.
 * 5) Блэкджек — высота подсветки строки таблицы выплат увеличена на 10%.
 *
 * Run: node tests/hunter-habar-skills-energy-round.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');
const habar   = fs.readFileSync(path.join(root, 'habar.js'), 'utf-8');
const skills  = fs.readFileSync(path.join(root, 'skills.js'), 'utf-8');
const energy  = fs.readFileSync(path.join(root, 'shell', 'popups', 'energy_buy.js'), 'utf-8');
const bosses  = fs.readFileSync(path.join(root, 'bosses.js'), 'utf-8');
const combat  = fs.readFileSync(path.join(root, 'bosses', 'bosses-combat.js'), 'utf-8');
const select  = fs.readFileSync(path.join(root, 'shell', 'overlays', 'bosses_select.js'), 'utf-8');
const bj      = fs.readFileSync(path.join(root, 'dvor', 'dvor-blackjack.js'), 'utf-8');
const fight   = fs.readFileSync(path.join(root, 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const bossesPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

console.log('\nTest 1: хабар — новые ассеты кнопок + 24-часовой кулдаун сбора + таймер');
{
    assert(/const HABAR_COLLECT_COOLDOWN_MS = 24 \* 60 \* 60 \* 1000;/.test(habar), 'константа кулдауна — ровно 24 часа');
    // Имена файлов уникальные (с префиксом "хабар кнопка ...") — общее "купить.png" уже занято
    // магазином одежды (shmot_shop.js) под СВОЙ, визуально другой ассет; переиспользование
    // того же файла для хабара при деплое перезаписывало его на сервере и ломало магазин.
    assert(/PIXI\.Texture\.from\('\.\/images\/хабар кнопка купить\.png'\)/.test(habar), 'кнопка "не куплено" использует уникальный ассет "хабар кнопка купить.png"');
    assert(/PIXI\.Texture\.from\('\.\/images\/хабар кнопка собрать\.png'\)/.test(habar), 'кнопка "куплено" использует уникальный ассет "хабар кнопка собрать.png"');
    assert(!/хабар кнопка забрать\.png/.test(habar), 'старый ассет "хабар кнопка забрать.png" больше не используется');
    assert(/const lastTs\s*=\s*parseInt\(udata\['habar_last_collect_ts'\]/.test(habar), '_updateHabarTimer читает timestamp последнего сбора (для отображения)');
    // 24.09.2026 (перенос экономики хабара на сервер, по прямому указанию): блокировку
    // повторного сбора и запись timestamp теперь делает ТОЛЬКО сервер (habar.php.collectDay()) —
    // клиент больше не решает сам, можно собирать или нет, и не пишет habar_last_collect_ts;
    // waiting/canCollect в _updateHabarTimer() — чисто отображение, не защита от читерства.
    assert(/waiting = collected < 30 && lastTs > 0 && remainMs > 0;/.test(habar), '_updateHabarTimer вычисляет waiting только для отображения таймера (не блокирует запрос к серверу)');
    assert(!/udata\['habar_last_collect_ts'\]\s*=/.test(habar), 'habar.js больше НЕ пишет habar_last_collect_ts сам — это делает только сервер');
    assert(/_updateHabarTimer\(\)/.test(habar), 'есть метод обновления кулдауна кнопки');
    // Актуальное решение: во время кулдауна кнопка скрыта и некликабельна, на её месте
    // показывается обратный отсчёт. Поэтому ошибочный попап по раннему клику невозможен.
    assert(/btn\.visible = canCollect;/.test(habar), 'кнопка "СОБРАТЬ" скрывается, пока кулдаун не истёк');
    assert(/btn\.interactive = canCollect;/.test(habar), 'скрытая кнопка некликабельна');
    assert(/timer\.visible = !canCollect;/.test(habar), 'вместо кнопки во время ожидания показывается таймер');
    assert(/this\._habarTimerInterval = setInterval\(\(\) => this\._updateHabarTimer\(\), 1000\);/.test(habar), 'open() запускает тиканье таймера раз в секунду');
    assert(/clearInterval\(this\._habarTimerInterval\)/.test(habar), 'close() останавливает интервал таймера');
    // 24.09.2026: клиент больше не сбрасывает кулдаун сам при покупке — вместо этого _buyAndOpen()
    // зовёт _collectDay() ВНУТРИ callback'а habar.buy() сразу после покупки (день 1 автосбора),
    // а сервер (habar.php.collectDay()) сам выставляет свежий habar_last_collect_ts — тот же
    // результат (первый сбор не блокируется), но решает его сервер, а не клиентский сброс.
    assert(/this\._collectDay\(\);\s*\n\s*\}, \(err\) => \{\s*\n\s*console\.error\('\[habar\._buyAndOpen\]/.test(habar),
        '_buyAndOpen() зовёт _collectDay() сразу после успешной покупки (сервер сам выставит свежий habar_last_collect_ts)');
}

// 18.09.2026 (по прямому указанию, отдельно от переноса Скиллов на сервер): "первый скилл
// бесплатный" убран ЦЕЛИКОМ — раньше это была разовая бесплатная прокачка ровно 1-го уровня
// скилла 0, теперь ВСЕ уровни ВСЕХ скиллов, включая этот, стоят полную цену очками без
// исключений. Полная проверка — tests/skills-free-first-level.test.js. Здесь фиксируем, что
// проверка очков применяется одинаково для абсолютно всех случаев, включая skill_id=0.
console.log('\nTest 2: скиллы — платные для ВСЕХ случаев без исключений, льготы больше нет');
{
    const fs2 = require('fs');
    const skillsPhp = fs2.readFileSync(path.join(__dirname, '..', 'server/core/controllers/skills.php'), 'utf-8');
    assert(!/usedFreeFirstSkill/.test(skillsPhp), 'льгота на скилл 0 (usedFreeFirstSkill) удалена с сервера целиком');
    // 25.09.2026: доступные очки читаются из персистентного $state['points'], не пересчитываются
    // earned-spent на лету — см. tests/skills-server-authoritative.test.js Test 10.
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): проверка стала
    // многострочным блоком (добавлен rollback/close лока строки перед return), однострочный
    // regex больше не матчится — сам инвариант (нужно >=1 очко, безусловно) не менялся.
    assert(/if\(intval\(\$state\['points'\] \?\? 0\) < 1\)\{/.test(skillsPhp), 'upgrade() требует очко безусловно, для любого skill_id (сервер)');
    assert(/return \$this->ops->fail\(78\); \/\/ недостаточно очков скиллов/.test(skillsPhp), 'отказ при нехватке очков возвращает код 78');
    assert(!/idx === 0 \|\| this\.availablePoints >= 1/.test(skills), 'автоапгрейд на клиенте не пропускает проверку очков для skill 0 локально');
    assert(!/si === 0 \? '0' : ''/.test(skills), 'costTxt не показывает "0" для skill 0');
}

console.log('\nTest 3: энергия — z-order фикс + попап полностью переделан на карточки (замена HIT_BOXES-подхода)');
{
    assert(/root\.layer2_mc\.addChild\(this\._energyWin\);\s*\n\s*console\.log/.test(energy),
        'повторное открытие попапа энергии поднимает его в топ layer2_mc (addChild на существующем ребёнке)');
    // 02.10.2026 (найдено при разборе этого провала): прежний механизм (отдельная кликабельная
    // HIT_BOXES-зона 163×173 с шагом 200px поверх НЕ двигавшейся картинки slot_N.png) заменён
    // более поздним редизайном попапа целиком — см. energy-popup-assets-and-payments.test.js
    // (актуальный тест этого экрана, уже зелёный). Новый попап построен на 8 карточках
    // ('кнопка энергии N.png') из energy_packs.json, каждая САМА кликабельна (slot.interactive,
    // anchor 0.5/0.5, x/y из cards[]) — отдельная зона клика и ручной пересчёт позиции картинки
    // под неё больше не нужны, поэтому старые assert'ы по HIT_W/HIT_H/STEP_X/xs устарели.
    // Смысл проверки (клик-зона реально кликабельна, картинка не растягивается, подсветки-глоу
    // нет) сохранён — просто через актуальный API карточек.
    assert(/const cards = \[/.test(energy), 'карточки энергии заданы единым массивом cards[]');
    assert(/slot\.interactive = true; slot\.buttonMode = true;/.test(energy), 'каждая карточка сама является кликабельной зоной (не отдельный HIT_BOXES-прямоугольник)');
    assert(/slot\.anchor\.set\(0\.5, 0\.5\); slot\.x = card\.x; slot\.y = card\.y;/.test(energy), 'позиция карточки берётся из cards[] (единый источник позиции и клик-зоны)');
    assert(!/slot\.width\s*=|slot\.height\s*=/.test(energy), 'картинка НЕ ресайзится — используется естественный размер текстуры');
    assert(!/glow/.test(energy), 'подсветка-квадратик при наведении отсутствует (вместо неё hover: scale.set(1.03))');
}

// Временное значение (1 минута) было ИСКЛЮЧИТЕЛЬНО для живого теста этого батча и корректно
// возвращено обратно на 9 часов сразу после — проверяем именно постоянное значение, не сам
// факт временной правки (которая давно откачена, это ожидаемо и правильно).
console.log('\nTest 4: охотник — таймер боя постоянные 9 часов (тестовое значение 1 минута откачено), пуш урона на сервер сразу');
{
    assert(/this\.FIGHT_DURATION_MS = 9 \* 60 \* 60 \* 1000;/.test(bosses), 'FIGHT_DURATION_MS — постоянные 9 часов (временное тестовое значение 60*1000 корректно откачено после теста)');
    // 22.09.2026 (по прямому указанию — "перенеси весь бой на сервер"): урон добивающего удара
    // больше не пушится клиентом отдельным users.save — bosses.php.attack() сам синхронно
    // сохраняет всё (bosses_data/weapons/total_damage) внутри своего saveUser() ДО того, как
    // ответ вообще вернётся клиенту, так что задержки/потери, которые чинил этот пуш, больше
    // структурно невозможны.
    const attackBody = bossesPhp.slice(bossesPhp.indexOf('function attack(){'), bossesPhp.indexOf('\n        }', bossesPhp.indexOf('function attack(){')));
    assert(/if\(!\$this->ops->saveUser\(\$user\)\) return \$this->ops->fail\(99\);/.test(attackBody),
        'attack() синхронно сохраняет всё на сервере до ответа клиенту — урон/убийца никогда не теряются');
    assert(/spr\._uRotatable = true;/.test(select), 'фото "УБИВШЕГО" помечено _uRotatable для редактора позиций');
}

console.log('\nTest 5: блэкджек — координаты таблицы выплат уточнены точечным замером 22.09.2026 (было X=770,W=290,H=35.2)');
{
    // 26.09.2026: X/W/H уточнены после фикса бага сдвига подсветки вправо на ~140px, см.
    // blackjack-combo-highlight-point-data-and-error-popup-position.test.js
    // 03.10.2026: новый фон letterbox-вписан (bg.x=86, bg.width=1108) — X/W пересчитаны (878/241).
    // 04.10.2026: letterbox отменён (фон вставлен в нативном размере, по прямому указанию) —
    // X/W/H пересчитаны под новый размер/позицию (820/182/31).
    assert(/const BJ_ROW_X = 895, BJ_ROW_W = 279, BJ_ROW_H = 37;/.test(bj),
        'BJ_ROW_X/W/H — координаты пересчитаны под нативный (не letterbox) размер фона (см. blackjack-combo-highlight-point-data-and-error-popup-position.test.js)');
}

console.log('\nTest 6: скиллы — полоска опыта обнуляется при выходе из боя БЕЗУСЛОВНО (22.09.2026: было "только без левелапа", убрано по прямому указанию — см. skills-always-reset-progress-on-new-fight.test.js)');
{
    assert(/this\._sessionStartPoints = 0;/.test(skills), 'есть поле для очков на старте попытки (трекается, хоть и не используется в условии сброса)');
    assert(/beginSession\(\)\{\s*\n\s*this\._sessionDmgSpent = 0;\s*\n\s*this\._sessionStartPoints = this\.earnedPoints;/.test(skills),
        'beginSession() по-прежнему фиксирует earnedPoints на момент старта попытки');
    assert(/_endSession\(\)\{/.test(skills), 'есть общий метод завершения попытки');
    assert(!/const leveled = this\.earnedPoints > \(this\._sessionStartPoints \|\| 0\);/.test(skills),
        'условная проверка левелапа убрана из _endSession()');
    assert(/this\.skillsDmgSpent = this\._totalDmgForPoints\(this\.earnedPoints\);/.test(skills),
        'прогресс безусловно обнуляется до пола текущего уровня после КАЖДОГО боя (не только без левелапа)');
    assert(/resetSession\(\)\{\s*\n\s*this\._endSession\(\);\s*\n\s*\}/.test(skills), 'resetSession() (победа/крестик) вызывает безусловный _endSession()');
    assert(/forfeitSession\(\)\{\s*\n\s*this\._endSession\(\);\s*\n\s*\}/.test(skills), 'forfeitSession() (поражение) тоже вызывает безусловный _endSession()');

    // 22.09.2026: реальный старт новой попытки (bossStartMs 0→серверное значение) переехал
    // целиком в bosses_fight.js._openBossesFight() (bosses.startFight ещё раньше, 20.09.2026,
    // забрал сюда же и авто-форфейт, и заморозку timeBonus — см. комментарий там) — bosses-
    // combat.js._attack() теперь только шлёт удар уже идущему бою, own beginSession() там
    // больше нет и не нужен.
    assert(/if\(window\.skills\) skills\.beginSession\(\);/.test(fight), 'старт новой попытки в bosses_fight._openBossesFight() вызывает beginSession(), а не resetSession()');
    assert(/skills\.endFight\(\); skills\.resetSession\(\); \}/.test(combat), 'победа (_onDefeat) по-прежнему вызывает resetSession()');
    assert(/выход из боя без левелапа[\s\S]{0,600}if\(window\.skills\) skills\.resetSession\(\);/.test(combat),
        'таймаут боя (время вышло) тоже теперь считается выходом без левелапа');
    assert(/if\(window\.skills\) skills\.forfeitSession\(\);/.test(fight), 'форфейт (bosses_fight.js) по-прежнему вызывает forfeitSession()');
    // 23.09.2026 (репорт "опыт скиллов переносится в следующий бой с боссом"): крестик тогда
    // сделали ещё одним триггером resetSession()/bosses.endFightSession(), наравне с форфейтом/
    // таймаутом.
    // 24.09.2026 (РЕВЕРТ, повторный репорт с числами — "нанёс 200 урона, скрыл крестиком, зашёл
    // заново к тому же боссу — опыт 0 вместо 200"): крестик закрывает только экран, бой не
    // окончен — resetSession()/endFightSession() отсюда убраны совсем, см.
    // tests/boss-close-fight-finalizes-skill-session.test.js для полной проверки.
    assert(!/skills\.resetSession\(\);/.test(fight), 'ручной выход (крестик) БОЛЬШЕ не вызывает resetSession() — прогресс не обнуляется');
}

console.log('\nTest 7: боевой экран — координаты HP-текста и панели "РЕЙТИНГ УРОНА" по замеру редактором позиций');
{
    // 03.10.2026 (редактор позиций): y 156→157, scale 1.314→1.710.
    // 08.10.2026 (фикс пикселизации текста): fontSize:12×scale(1.710) заменены на итоговый
    // fontSize:21 без scale.
    assert(/hpTxt\.anchor\.set\(0\.5, 0\.5\); hpTxt\.x = 136; hpTxt\.y = 157;/.test(fight) && !/hpTxt\.scale\.set\(/.test(fight),
        'HP-текст боя с боссом получил итоговый fontSize:21 (12×1.710), без scale (позиция 136,157)');
    // 26.09.2026: +1 к X/Y (уточнено редактором позиций повторно), avSpr — scale.set(0.542)
    // вместо фиксированного 42×42 (пропорции чужого VK-фото больше не искажаются).
    // 29.09.2026: ещё одно точечное уточнение редактором — x:37,y:541,scale:0.472 для строки 0
    // (было x:33,y:536,scale:0.500), та же дельта (+4/+5) перенесена на строки 1/2.
    // 02.10.2026: AV_SCALE уточнён ещё раз редактором позиций, 0.472 → 0.324 (актуальное
    // значение — см. bosses_fight.js и tests/onboarding-permission-and-roulette-assets.test.js).
    assert(/const FRAME_X = 27, FRAME_Y = \[528, 589, 652\];/.test(fight) && /const AV_X = 32, AV_Y = \[532, 593, 656\];/.test(fight), 'рамка и фото рейтинга: актуальные координаты');
    assert(/const AV_SCALE = 0\.324;/.test(fight), 'avSpr масштабируется через AV_SCALE=0.324, не растягивается в фиксированный квадрат');
    assert(/const NAME_X = 92,\s*NAME_Y = \[535, 597, 659\];/.test(fight), 'плейсхолдер имени "---": единый X=92, Y по строкам 535/597/659');
    // 03.10.2026 (редактор позиций): LBL_X 257→256, VAL_X 281→282, VAL_Y [560,620,680]→[558,618,678],
    // плюс масштаб имени/подписи/значения (NAME_SCALE/LBL_SCALE/VAL_SCALE).
    assert(/const LBL_X = 256, LBL_Y\s*= \[535, 597, 659\];/.test(fight), 'подпись "Нанесенный урон:": единый X=256, та же Y что и у имени (одна линия)');
    assert(/const VAL_X = 282, VAL_Y\s*= \[558, 618, 678\];/.test(fight), 'значение урона "× N": единый X=282, Y по строкам 558/618/678');
    // 08.10.2026 (фикс пикселизации текста): NAME_SCALE/LBL_SCALE/VAL_SCALE как scale.set()
    // убраны — те же коэффициенты теперь свёрнуты прямо в fontSize каждого текста
    // (14×1.280≈18, 12×1.210≈15, 14×1.159≈16).
    assert(/fontFamily:'AA Bebas Neue', fontSize:18, fill:'#8a7157',/.test(fight), 'имя рейтинга — итоговый fontSize:18 (14×1.280)');
    assert(/fontFamily:'Southbank LT', fontSize:15, fill:'#8a7157',/.test(fight), 'подпись "Нанесенный урон:" — итоговый fontSize:15 (12×1.210)');
    assert(/fontFamily:'Southbank LT', fontSize:16, fill:'#8a7157',/.test(fight), 'значение урона — итоговый fontSize:16 (14×1.159)');
    assert(!/const NAME_SCALE|\.scale\.set\(NAME_SCALE\)|\.scale\.set\(LBL_SCALE\)|\.scale\.set\(VAL_SCALE\)/.test(fight),
        'константы *_SCALE как scale.set() объектов убраны (упоминание в поясняющем комментарии истории — не регрессия)');
    assert(!/const ROW0_OVERRIDE/.test(fight), 'особый случай для строки 0 (отдельная константа) полностью убран — единая формула для всех 3 строк');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

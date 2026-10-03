/**
 * Test: батч 19.09.2026 (по прямому указанию, экран "визит к другу" / чужой профиль) —
 *
 *  1) "визитка у игрока.png" вставлена в player_profile.js на позицию x=6,y=77 (снята
 *     пользователем через редактор позиций), нативный размер (без width/height override).
 *     Поля карточки (Уровень/Достижения/Сила/Банда/Скиллов/Рейтинг/В зоне с) заполняются
 *     реальными данными с сервера (users.getProfile расширен новыми полями), прочерк — только
 *     если данных действительно нет (пустой gang_id).
 *  2) Значок хабара (одна из 4 корон, соответствующая купленному тиру habar_bought 1-4) —
 *     позиция x=181,y=323, показывается ТОЛЬКО когда habar_bought>0 (хабар не куплен = нет
 *     значка вообще, второй тир одновременно не существует — habar.js хранит один активный).
 *  3) Кнопки "у друга" (качалка/заначки/зарубиться) + общий фон — 4 позиции сняты пользователем
 *     через редактор позиций, фон добавлен ПЕРВЫМ (чтобы кнопки были поверх). Функциональность
 *     кнопок НЕ запрашивалась в этом батче — только позиционирование (ПРАВИЛО №9, не изобретаем
 *     экономику/механику заранее) — клик логирует, что фича ещё не реализована.
 *
 * Run: node tests/visit-card-habar-badge-friend-buttons.test.js
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

const profileJs = readSrc('_client/src/game/shell/overlays/player_profile.js');
const usersPhp   = readSrc('server/core/controllers/users.php');

console.log('\nTest 1: users.php.getProfile — расширен новыми публичными полями визитки');
{
    const start = usersPhp.indexOf('function getProfile(){');
    const end   = usersPhp.indexOf("\n        }", usersPhp.indexOf("'create_time'", start));
    const body  = usersPhp.slice(start, end);

    // 19.09.2026: base_stats заменён на str_xp_total (накопленный опыт качалки) — уровень
    // 1-50 не подходит для дуэлей/визитки, пользователь подтвердил на примере "СИЛА 1897".
    assert(/'gang_id', 'str_xp_total', 'achievement_stars', 'skills_levels', 'habar_bought', 'create_time'/.test(body),
        'SELECT добавлены все новые поля визитки одним списком (str_xp_total вместо base_stats)');
    assert(/\$strength = intval\(\$row\['str_xp_total'\] \?\? 0\);/.test(body),
        'strength — напрямую str_xp_total, дефолт 0 (растёт без ограничения, не капается на 50 как уровень)');
    assert(/\$skillsTotal = array_sum\(array_map\('intval', \$skillsLevels\)\);/.test(body),
        'skills_total — сумма всех уровней скиллов из служебного skills_levels');
    assert(/\$skillsCatalog = \$this->registry\['json'\]->get\('skills_config', true\);/.test(body),
        'skills_max берётся из skills_config.json (total_points), не хардкод');
    // 29.09.2026 (по прямому указанию — "рейтинг привязать к уровню игрока, кто на каком месте
    // по опыту, такое и место в рейтинге"): было ранжирование по total_damage (топ по урону) —
    // теперь по exp (тот же столбец, из которого клиент считает уровень), см.
    // tests/player-rating-by-exp.test.js для полного покрытия этой правки.
    assert(/SELECT COUNT\(\*\)\+1 AS place FROM `\{\$this->registry\['utb'\]\}` WHERE `exp`-0 > \{\$myExp\}/.test(body),
        'rating_place — считает место по exp (уровню), не по total_damage');
    assert(/'strength'\s*=> \$strength,/.test(body) && /'skills_total'\s*=> \$skillsTotal,/.test(body) &&
        /'skills_max'\s*=> \$skillsMax,/.test(body) && /'rating_place'\s*=> \$ratingPlace,/.test(body) &&
        /'habar_bought'\s*=> intval\(\$row\['habar_bought'\] \?\? 0\),/.test(body) && /'create_time'\s*=> intval\(\$row\['create_time'\] \?\? 0\),/.test(body) &&
        /'gang_id'\s*=> strval\(\$row\['gang_id'\] \?\? ''\),/.test(body) && /'achievement_stars'\s*=> intval\(\$row\['achievement_stars'\] \?\? 0\),/.test(body),
        'output() возвращает все 7 новых полей клиенту');
}

console.log('\nTest 2: player_profile.js — визитка вставлена нативным размером на снятую позицию (x=6,y=77)');
{
    const start = profileJs.indexOf('proto._buildVisitCard = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    // 21.09.2026 (по прямому указанию — "подними визитку на 30 пикселей"): базовое CARD_Y=77
    // (снято пользователем через редактор позиций 19.09.2026) минус явно запрошенный сдвиг.
    assert(/const CARD_X = 6, CARD_Y = 77 - 30;/.test(profileJs), 'константы позиции карточки — базовое значение минус запрошенный подъём на 30px');
    assert(/card\.x = CARD_X; card\.y = CARD_Y;/.test(body), 'карточка (Container) размещена на CARD_X/CARD_Y');
    assert(/card\.rotation = CARD_ROTATION_DEG \* Math\.PI \/ 180;/.test(body), 'карточка повёрнута на CARD_ROTATION_DEG (запрошено -2° против часовой)');
    assert(/PIXI\.Texture\.from\('\.\/images\/визитка у игрока\.png'\)/.test(body), 'использует реальный файл визитки');
    assert(!/bg\.width\s*=/.test(body) && !/bg\.height\s*=/.test(body), 'визитка вставлена БЕЗ width/height override — нативный размер файла (421×570), как требует правило проекта');
}

console.log('\nTest 3: player_profile.js — поля визитки берутся из profile.*, прочерк только когда данных реально нет');
{
    const start = profileJs.indexOf('proto._buildVisitCard = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/String\(profile\.achievement_stars \|\| 0\)/.test(body), 'Достижения — profile.achievement_stars (накопленные очки)');
    assert(/String\(profile\.strength \|\| 0\)/.test(body), 'Сила — profile.strength (накопленный опыт качалки), дефолт 0');
    assert(/let gangName = '-';/.test(body) && /if\(!isNaN\(gangId\) && profile\.gang_id !== ''/.test(body),
        'Банда — прочерк по умолчанию, реальное имя группы только если gang_id непустой');
    assert(/gangs\.gangs\.find\(x => x\.id === gangId\)/.test(body), 'имя банды ищется в статическом каталоге window.gangs.gangs по id');
    assert(/profile\.skills_max \? \(profile\.skills_total \|\| 0\) \+ '\/' \+ profile\.skills_max : '-'/.test(body),
        'Скиллов — "сумма/максимум", прочерк если каталог скиллов не вернул максимум');
    assert(/profile\.rating_place \? \('#' \+ profile\.rating_place\) : '-'/.test(body),
        'Рейтинг — "#место", прочерк если рейтинг не посчитан');
    assert(/pad\(d\.getDate\(\)\) \+ '\.' \+ pad\(d\.getMonth\(\) \+ 1\) \+ '\.' \+ d\.getFullYear\(\);/.test(body),
        'В зоне с — точная дата дд.мм.гггг из create_time');
    assert(/let sinceStr = '-';/.test(body) && /if\(profile\.create_time\)\{/.test(body),
        'В зоне с — прочерк, если create_time отсутствует');
}

console.log('\nTest 4: player_profile.js — значок хабара показывается только для купленного тира, позиция x=197,y=313 (22.09.2026, было 181,323), рядом название тира');
{
    const start = profileJs.indexOf('proto._buildHabarBadge = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/const HABAR_BADGE_FILES = \['обычный хабар\.png', 'пацанский хабар\.png', 'авторитетный хабар\.png', 'элитный хабар\.png'\];/.test(profileJs),
        'порядок файлов совпадает с habar.js.this.containers (0 Обычный..3 Элитный)');
    assert(/const HABAR_TIER_NAMES\s*= \['Обычный', 'Пацанский', 'Авторитетный', 'Элитный'\];/.test(profileJs),
        'названия тиров — те же строки, что и id0-3.name в habar.js');
    assert(/const idx = intval\(profile\.habar_bought\) - 1;/.test(body), 'индекс = habar_bought-1 (habar.js хранит idx+1, 0 = не куплен)');
    assert(/if\(idx < 0 \|\| idx >= HABAR_BADGE_FILES\.length\) return;/.test(body), 'ничего не рисует, если хабар не куплен (habar_bought=0) или индекс вне диапазона');
    assert(/badge\.x = 197; badge\.y = 313;/.test(body), 'значок на новой позиции x=197,y=313 (снята через редактор позиций 22.09.2026)');
    assert(/badge\.rotation = TEXT_ROTATION_DEG \* Math\.PI \/ 180;/.test(body), 'значок повёрнут на TEXT_ROTATION_DEG (тот же приём, что у текстов визитки)');

    // 22.09.2026 (по прямому указанию — "справа где 0 должно быть название хабара"): "0" на
    // самом деле принадлежит ДРУГОМУ полю (strTxt/"СИЛА", не трогали) — рядом со значком
    // добавлена ОТДЕЛЬНАЯ подпись с реальным названием текущего тира хабара.
    // Повторный снимок редактора позиций тем же днём: подпись отвязана от badge.x/y (была
    // относительной), стала абсолютной координатой (252,329) со своим поворотом -2°.
    assert(/const nameTxt = new PIXI\.Text\(HABAR_TIER_NAMES\[idx\], \{/.test(body), 'добавлен отдельный текст с названием тира (HABAR_TIER_NAMES[idx])');
    assert(/nameTxt\.x = 252; nameTxt\.y = 329;/.test(body), 'подпись на абсолютной координате (252,329), снятой редактором позиций');
    assert(/nameTxt\.rotation = -2 \* Math\.PI \/ 180;/.test(body), 'подпись повёрнута на -2° (свой поворот, не общий TEXT_ROTATION_DEG)');
}

console.log('\nTest 5: player_profile.js — кнопки "у друга" + общий фон на снятых позициях, фон добавлен первым (z-order)');
{
    const start = profileJs.indexOf('proto._buildFriendActionButtons = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    const bgIdx    = body.indexOf("'./images/фон для кнопок у друга.png'");
    const arrIdx   = body.indexOf('const buttons = [');
    assert(bgIdx !== -1 && arrIdx !== -1 && bgIdx < arrIdx, 'фон создаётся и добавляется в win ДО массива кнопок (кнопки рендерятся поверх фона)');
    assert(/bg\.x = 997; bg\.y = 45;/.test(body), 'фон на позиции x=997,y=45');
    assert(!/кнопка у друга просьба заначек\.png/.test(body), 'кнопка просьбы заначек убрана: серверного действия у неё нет');
    // 25.09.2026 (по прямому указанию, редактор позиций): позиции сняты заново — было x=1039,
    // y=266 / x=1040, y=417.
    assert(/file: 'кнопка у друга позвать в качалку\.png', x: 1039, y: 176/.test(body), 'качалка — x=1039,y=176');
    assert(/file: 'кнопка у друга зарубиться \.png',\s*x: 1040, y: 357/.test(body), 'зарубиться — x=1040,y=357 (обратите внимание на пробел перед .png в реальном имени файла)');
    assert(/if\(b\.action === 'gym_invite'\)\{ this\._startGymPump\(profile\); return; \}/.test(body),
        'качалка вызывает реализованный серверный метод _startGymPump');
    // 19.09.2026: "зарубиться" реализована полностью — единственная кнопка, которая теперь
    // не падает в лог-заглушку, а реально запускает дуэль.
    assert(/if\(b\.action === 'fight_challenge'\)\{ this\._startZaruba\(win, profile\); return; \}/.test(body),
        'зарубиться — реально вызывает _startZaruba (не заглушка)');
}

console.log('\nTest 6: player_profile.js — аватарка (фото через VK) + никнейм/ID справа от неё (19.09.2026 фикс)');
{
    const start = profileJs.indexOf('proto._buildVisitCard = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/bosses\._resolveVkUsers\(\[profile\.id\], \(users\) => \{/.test(body), 'аватарка резолвится через общий bosses._resolveVkUsers (тот же механизм, что топы/рейтинги)');
    assert(/if\(u && u\.photo\) avatarSpr\.texture = PIXI\.Texture\.from\(u\.photo\);/.test(body), 'применяет photo, если VK его вернул');
    assert(/avatarSpr\.mask = avatarMask;/.test(body), 'аватарка обрезана маской по границе квадратика (не растягивает фото за рамку)');
    assert(/nickTxt\.x = 145; nickTxt\.y = 110;/.test(body), 'никнейм — в пустом месте справа от аватарки');
    // 22.09.2026 (по прямому указанию — "текст id игрока подними вверх на 12px"): 155→143.
    assert(/idTxt\.x = 145; idTxt\.y = 143;/.test(body), 'ID — под никнеймом, поднят на 12px (было y=155)');
    assert(/profile\.displayNick \|\| \('Игрок ' \+ profile\.id\)/.test(body), 'визитка использует игровой ник, а при пустой старой записи — подготовленный fallback VK-имени');
    assert(/avatarSpr\.on\('pointerdown', \(\) => \{[\s\S]*?window\.open\('https:\/\/vk\.com\/id' \+ encodeURIComponent\(String\(profile\.id\)\), '_blank', 'noopener,noreferrer'\);/.test(body),
        'клик по аватару открывает страницу VK игрока в отдельной вкладке');
    assert(/'ID ' \+ profile\.id/.test(body), 'ID — реальный id профиля, не выдуманный');
}

console.log('\nTest 8: player_profile.js — 22.09.2026, финальная сверка позиций визитки (уровень/достижения/банда/скиллов/рейтинг/в зоне) + поворот всех текстов');
{
    const start = profileJs.indexOf('proto._buildVisitCard = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/const TEXT_ROTATION_DEG = -1;/.test(profileJs), 'константа индивидуального поворота текстов — -1° (против часовой)');

    // "число уровня" вверх на 6px (228→222), "кол-во достижений" вверх на 12px (228→216).
    assert(/levelTxt\.x = 90; levelTxt\.y = 222;/.test(body), 'levelTxt поднят на 6px (было y=228)');
    assert(/achTxt\.x = 232; achTxt\.y = 216;/.test(body), 'achTxt поднят на 12px (было y=228)');

    // Банда/скиллов/рейтинг/в зоне с — 22.09.2026, повторный снимок редактора позиций тем же
    // днём: общий ROW_DX/ROW_DY убран, у каждой строки теперь своя отдельная координата.
    assert(!/const ROW_DX = 26, ROW_DY = -2;/.test(body), 'общий сдвиг ROW_DX/ROW_DY убран — координаты теперь у каждой строки свои');
    assert(/gangTxt\.x = 186; gangTxt\.y = 334;/.test(body), 'БАНДА — своя координата (186,334)');
    assert(/skillsTxt\.x = 209; skillsTxt\.y = 364;/.test(body), 'СКИЛЛОВ — своя координата (209,364)');
    assert(/ratingTxt\.x = 222; ratingTxt\.y = 392;/.test(body), 'РЕЙТИНГ — своя координата (222,392)');
    assert(/sinceTxt\.x = 194; sinceTxt\.y = 421;/.test(body), 'В ЗОНЕ С — своя координата (194,421)');

    // Индивидуальный поворот TEXT_ROTATION_DEG(-1°) на большинстве текстов визитки (поверх
    // поворота card) — strTxt ИСКЛЮЧЕНИЕ: 22.09.2026 получил свой центрирующий бокс (см. Test 9)
    // со своим отдельным поворотом -2°, больше не использует общий TEXT_ROTATION_DEG.
    for(const varName of ['nickTxt','idTxt','levelTxt','achTxt','gangTxt','skillsTxt','ratingTxt','sinceTxt']){
        const re = new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.rotation = TEXT_ROTATION_DEG \\* Math\\.PI / 180;');
        assert(re.test(body), varName + ' имеет индивидуальный rotation = TEXT_ROTATION_DEG');
    }
}

console.log('\nTest 9: player_profile.js — strTxt ("СИЛА"), 24.09.2026 уточнено редактором позиций ("Выбрано: Текст \'0\' x:117 y:301 scale:1.000 rot:-3°", было x:144.5 y:342.5 rot:-2°)');
{
    const start = profileJs.indexOf('proto._buildVisitCard = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/strTxt\.x = 117; strTxt\.y = 301;/.test(body), 'strTxt — x:117 y:301 (было 144.5/342.5)');
    assert(/strTxt\.rotation = -3 \* Math\.PI \/ 180;/.test(body), 'strTxt повёрнут на -3° (было -2°)');
    assert(/strTxt\.anchor\.set\(0\.5, 0\.5\);/.test(body), 'anchor(0.5,0.5) — координата действительно центр, не угол');
}

console.log('\nTest 9: player_profile.js — при просмотре СВОЕГО профиля кнопки "у друга" (заруба/качалка/заначки) не показываются');
{
    const start = profileJs.indexOf('proto._buildPlayerProfileScreen = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/const isOwnProfile = parseInt\(udata\['id'\]\) === parseInt\(profile\.id\);/.test(body),
        'сравнивает udata[\'id\'] (свой id) с profile.id (id открытого профиля) — то же поле, что использует сервер (zaruba.php "сам на себя")');
    assert(/if\(!isOwnProfile\) this\._buildFriendActionButtons\(win, profile\);/.test(body),
        'кнопки "у друга" вызываются только если это НЕ свой профиль — нельзя зарубиться/качнуть/попросить заначку у самого себя');
}

console.log('\nTest 10: player_profile.js — открытие профиля флашит несохранённое состояние ПЕРЕД запросом (гонка с 500мс-дебаунсом shmot)');
{
    const start = profileJs.indexOf('proto._openPlayerProfile = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);

    assert(/import \{ flushPlayerSave \} from '\.\.\/\.\.\/\.\.\/modules\/player-save\.js';/.test(profileJs),
        'flushPlayerSave импортирован из modules/player-save.js (тот же паттерн, что yashik.js)');
    assert(/flushPlayerSave\('open_player_profile', \(\) => \{/.test(body),
        '_openPlayerProfile оборачивает запрос users.getProfile в flushPlayerSave — иначе просмотр СВОЕГО профиля в течение 500мс после смены шмотки показывает устаревшее состояние из БД');
    assert(body.indexOf("flushPlayerSave('open_player_profile'") < body.indexOf("TS.php('users.getProfile'"),
        'flushPlayerSave вызывается ДО TS.php(users.getProfile) — не параллельно и не после');
}

console.log('\nTest 7: новые ассеты скопированы в _client/development/images/ под ожидаемыми именами');
{
    const imgDir = path.join(root, '_client', 'development', 'images');
    // 29.09.2026 (найдено плановой чисткой при не связанной правке): "кнопка у друга просьба
    // заначек.png" убрана из ожидаемого списка — сама кнопка удалена из кода ещё раньше (см.
    // Test 6 выше, "кнопка просьбы заначек убрана: серверного действия у неё нет"), а файл
    // на диске физически отсутствует уже давно — эта строка годами проверяла то, чего нет.
    const expected = [
        'визитка у игрока.png', 'элитный хабар.png', 'авторитетный хабар.png', 'обычный хабар.png',
        'пацанский хабар.png', 'кнопка у друга позвать в качалку.png',
        'фон для кнопок у друга.png', 'кнопка у друга зарубиться .png',
    ];
    for(const f of expected){
        assert(fs.existsSync(path.join(imgDir, f)), 'файл существует: ' + f);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: полная переделка вкладки «Сводка» (17.09.2026, по прямому указанию пользователя):
 * старое содержимое (Статистика/Достижения-дубликат-списка/Звания, FLA-экран mc.svod_win)
 * заменено на 4 новые вкладки — Новости, Топ по авторитету, Топ по урону, Топ по достижениям.
 *
 *  - server/core/controllers/top.php расширен: категории 4 (respect) и 5 (achievement_stars),
 *    плюс scope='friends' (переиспользует тот же список id, что и users.get для друзей).
 *  - _client/src/game/svod.js полностью переписан на чистый PIXI (без FLA), по паттерну
 *    habar.js — root.layer2_mc + _pixiWin, а не home.openScreen().
 *  - interface-panels.js._closeAllPanels() научен закрывать svod явно (иначе завис бы поверх
 *    экрана при переключении на другую вкладку — тот же баг класса, что и раньше был у habar
 *    до его переезда на _pixiWin).
 *  - Топ по достижениям использует РЕАЛЬНЫЙ список window.achievements.list (331 шт.,
 *    game/achievements.js), а не старый отдельный список из 33 достижений, что был в svod.js.
 *
 * Run: node tests/svod-rebuild-news-leaderboards-achievements.test.js
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

const topPhp       = readSrc('server/core/controllers/top.php');
const svodSrc       = readSrc('_client/src/game/svod.js');
const scrollSrc     = readSrc('_client/src/game/svod/svod-scroll.js');
const leaderSrc     = readSrc('_client/src/game/svod/svod-leaderboard.js');
const achSrc        = readSrc('_client/src/game/svod/svod-achievements.js');
const newsSrc       = readSrc('_client/src/game/svod/svod-news.js');
const panelsSrc     = readSrc('_client/src/game/interface/interface-panels.js');
const moduleCtrlSrc = readSrc('_client/src/modules/module_control.js');

console.log('\nTest 1: top.php — новые категории exp(было respect)/achievement_stars + фильтр по друзьям');
{
    // 23.09.2026 (по прямому указанию): cat:4 «Топ по авторитету» переведён с сортировки по
    // respect на сортировку по exp (см. коммент в top.php.get()) — метка колонки на экране не
    // менялась (часть фонового PNG), поменялось только поле сортировки.
    assert(/\$fields = \['total_damage','coins','bosses_killed','stew','exp','achievement_stars'\]/.test(topPhp),
        'массив категорий расширен до 6 (0-3 старые не тронуты, 4=exp, 5=achievement_stars)');
    assert(/if\(\$cat < 0 \|\| \$cat > 5\)/.test(topPhp), 'граница проверки cat расширена до 5 (была 3)');
    assert(/\$scope === 'friends'/.test(topPhp), 'поддерживается scope=friends');
    assert(/foreach\(explode\(',', \$raw\) as \$fid\)/.test(topPhp), 'парсит список id друзей из user_params[friends]');
    assert(/if\(!in_array\(abs\(intval\(\$uid\)\), \$ids\)\) \$ids\[\] = abs\(intval\(\$uid\)\)/.test(topPhp),
        'свой id всегда добавлен в список друзей (иначе игрок не увидит себя в своём же топе друзей)');
    assert(/WHERE \(\{\$where\}\) AND `\{\$field\}`-0 > \{\$my_value\}/.test(topPhp),
        'подсчёт своего места (my_place) тоже учитывает scope (иначе место считалось бы среди ВСЕХ, а не только друзей)');
}

console.log('\nTest 2: module_control.js — конструктор Svod по-прежнему принимает mc (совместимость)');
{
    assert(/window\.svod = new Svod\(this\.names\['svod'\]\)/.test(moduleCtrlSrc),
        'constructSvod не менялся — Svod сам игнорирует mc (как Habar)');
}

console.log('\nTest 3: svod.js — 4 новые вкладки, старое содержимое полностью убрано');
{
    assert(/key:'news'/.test(svodSrc) && /key:'respect'/.test(svodSrc) && /key:'damage'/.test(svodSrc) && /key:'ach'/.test(svodSrc),
        'все 4 новые вкладки объявлены (news/respect/damage/ach)');
    assert(!/stat_section|ach_section|rank_section|this\.ranks\s*=|this\.stats\s*=/.test(svodSrc),
        'старые вкладки Статистика/Достижения(дубликат)/Звания полностью убраны из svod.js');
    // Строка встречается только в поясняющем комментарии (что заменили) — реального кода
    // вида `this.win = mc.svod_win` в файле быть не должно.
    assert(!/this\.win\s*=\s*mc\.svod_win/.test(svodSrc), 'больше не завязан на FLA-объект mc.svod_win в коде');
    assert(/root\.layer2_mc\.addChild\(this\._pixiWin\)/.test(svodSrc),
        'открывается как оверлей поверх layer2_mc (тот же паттерн, что habar/yashik), не через home.openScreen()');
    assert(/this\._pixiWin && this\._pixiWin\.parent/.test(svodSrc), 'close() корректно проверяет parent перед removeChild');
}

console.log('\nTest 4: interface-panels.js — _closeAllPanels закрывает Сводку явно');
{
    const closeAllStart = panelsSrc.indexOf('proto._closeAllPanels = function()');
    const closeAllEnd   = panelsSrc.indexOf('};', closeAllStart);
    const block = panelsSrc.slice(closeAllStart, closeAllEnd);
    assert(/svod\._pixiWin && svod\._pixiWin\.parent\) svod\.close\(\)/.test(block),
        '_closeAllPanels вызывает svod.close(), если Сводка открыта (иначе экран завис бы при переключении вкладки)');
}

console.log('\nTest 5: svod-leaderboard.js — категории/координаты/переключение саб-табов корректны');
{
    assert(/cat: 4, bg: 'задний фон топы по авторитету\.png'/.test(svodSrc), 'Топ по авторитету → cat=4 (respect)');
    assert(/cat: 0, bg: 'задний фон топы по урону\.png'/.test(svodSrc), 'Топ по урону → cat=0 (total_damage, существующая категория)');
    // 19.09.2026: у вкладки появился собственный выделенный фон вместо временного
    // переиспользования фона «авторитету», см. svod-achievements-bg-and-weapon-tier-damage.test.js.
    assert(/cat: 5, bg: 'задний фон топы по достижения\.png'/.test(svodSrc), 'Топ по достижениям (Общий топ) → cat=5 (achievement_stars)');
    assert(/onSecondTab: \(\) => \{/.test(svodSrc),
        'у вкладки достижений второй саб-таб — не scope=friends, а отдельная панель (onSecondTab), в отличие от авторитета/урона');

    assert(/const PANEL_X = 284, PANEL_Y = 65, PANEL_W = 851, PANEL_H = 546/.test(leaderSrc),
        'координаты фона топа сняты из PSD (851×546 @ 284,65)');
    // 19.09.2026: SUBTAB_SECOND_X уточнён редактором позиций (704→789, плюс отдельный
    // SUBTAB_SECOND_Y=191 вместо вычисления из высоты конкретного ассета) — см.
    // svod-friends-btn-trim-and-unified-second-tab-position.test.js.
    // 22.09.2026: SUBTAB_SECOND_X уточнён ещё раз редактором позиций (789→801).
    assert(/SUBTAB_ALL_X\s*=\s*542/.test(leaderSrc) && /SUBTAB_SECOND_X\s*=\s*801/.test(leaderSrc),
        'координаты саб-табов «Общий топ»/«второй таб» сняты из PSD/редактора позиций (542, 801)');
    assert(/TS\.php\('top\.get', params/.test(leaderSrc), 'грузит данные через top.get');
    assert(/params\.friends = window\.my_friends/.test(leaderSrc),
        'при scope=friends передаёт window.my_friends — тот же список, что уже собран в preloader.js для рейтинга друзей');
    assert(/bosses\._resolveVkUsers/.test(leaderSrc), 'переиспользует общую утилиту резолва VK id→фото/имя, не дублирует VK API вызов');
}

console.log('\nTest 6: svod-achievements.js — реальный список достижений, а не старый дубликат из 33 шт.');
{
    assert(/window\.achievements && window\.achievements\.list/.test(achSrc),
        'читает window.achievements.list (реальный активный список из game/achievements.js)');
    assert(/window\.achievements && window\.achievements\.earned/.test(achSrc),
        'читает window.achievements.earned для статуса выполнено/не выполнено');
    assert(/звездочка фулл\.png/.test(achSrc) && /звездочка пустая\.png/.test(achSrc),
        'использует присланные ассеты звёздочек (пустая/фулл), не выдуманный прогресс-бар');
    assert(/iface\._achievementDesc\(a\)/.test(achSrc) && /iface\._achievementIconFor\(a\)/.test(achSrc),
        'переиспользует готовые описание/иконку из попапа ачивок (не дублирует их логику заново)');
}

console.log('\nTest 7: все ассеты Сводки существуют в _client/development/images/');
{
    const IMAGES_DIR = path.join(root, '_client', 'development', 'images');
    const expected = [
        'сводка фон.png', 'новости актив.png', 'новости пассив.png',
        'кнопка топ по авторитету актив.png', 'кнопка топ по авторитету пассив.png',
        'кнопка топ по урону актив.png', 'кнопка топ по урону пассив.png',
        'кнопка топ по достижениям актив.png', 'кнопка топ по достижения пассив.png',
        'задний фон топы по авторитету.png', 'задний фон топы по урону.png',
        'шкала скрола.png', 'стрелка вверх.png', 'стрелка вниз.png', 'скрол.png',
        'общий топ актив.png', 'общий топ неактив.png',
        'друзья актив.png', 'друзья неактив.png',
        'мои достижения актив.png', 'мои достижения пассив.png',
        'ячейка.png', 'кароточка достижений.png',
        'звездочка пустая.png', 'звездочка фулл.png',
    ];
    for(const f of expected){
        assert(fs.existsSync(path.join(IMAGES_DIR, f)), `файл скопирован: ${f}`);
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

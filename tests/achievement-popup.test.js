/**
 * Test: попап "Достижение выполнено" (shell/popups/achievement.js) — новые ассеты от
 * 15.09.2026 (C:\Users\HONOR\Desktop\vk_game\достижения\). Плашка позиционируется по
 * координатам из редактора (X:438 Y:455, само изображение 457×156 — совпадает 1-в-1),
 * иконка достижения/заначки — в едином слоте (X:484 Y:485 W:79 H:86 абсолютно →
 * (46,30) 79×86 локально относительно плашки). Текст: название, описание (генерируется
 * из категории+порога), "ПОЛУЧЕНО ОЧКОВ: X ИЗ Y" (X — очки в сегменте, Y — макс. в
 * сегменте), общий счёт очков достижений — отдельным числом поверх звезды на плашке.
 *
 * Run: node tests/achievement-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const popupSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'achievement.js'), 'utf-8'
);
const achSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'achievements.js'), 'utf-8'
);

console.log('\nTest 1: плашка и иконка позиционируются по координатам из редактора');
{
    assert(/const PLATE_X = 438, PLATE_Y = 455;/.test(popupSrc), 'плашка — X:438 Y:455 (координаты слоя "плашка" из PSD)');
    assert(/const ICON_X = 46, ICON_Y = 30, ICON_W = 79, ICON_H = 86;/.test(popupSrc),
        'иконка — локально (46,30) 79×86 (абсолютно 484,485 минус позиция плашки 438,455)');
    assert(/win\.x = PLATE_X; win\.y = PLATE_Y;/.test(popupSrc), 'контейнер попапа ставится ровно на позицию плашки');
    assert(/icon\.x = ICON_X; icon\.y = ICON_Y; icon\.width = ICON_W; icon\.height = ICON_H;/.test(popupSrc),
        'иконка встаёт в единый слот независимо от категории/заначки');
}

console.log('\nTest 2: файлы ассетов реально скопированы в development/images');
{
    const imgDir = path.join(__dirname, '..', '_client', 'development', 'images');
    assert(fs.existsSync(path.join(imgDir, 'попап достижения.png')), 'попап достижения.png скопирован');
    assert(fs.existsSync(path.join(imgDir, 'achievements')), 'папка achievements (иконки категорий) скопирована');
    assert(fs.existsSync(path.join(imgDir, 'stashes')), 'папка stashes (иконки заначек) скопирована');
    assert(fs.existsSync(path.join(imgDir, 'achievements', 'нанести урон.png')), 'иконка "нанести урон.png" на месте');
    assert(fs.existsSync(path.join(imgDir, 'stashes', 'по лезвию.png')), 'иконка заначки "по лезвию.png" на месте');
}

console.log('\nTest 3: текст "ПОЛУЧЕНО ОЧКОВ: X ИЗ Y" — X/Y считаются по сегменту (cat), не по всем ачивкам разом');
{
    assert(/proto\._achievementSegmentTotal = function\(cat\)\{\s*\n\s*return this\.list\.reduce\(\(s, a\) => a\.cat === cat \? s \+ a\.pts : s, 0\);/.test(popupSrc),
        '_achievementSegmentTotal суммирует pts ВСЕХ ачивок с данным cat (макс. возможное в сегменте)');
    assert(/proto\._achievementSegmentEarned = function\(cat\)\{\s*\n\s*return this\.list\.reduce\(\(s, a\) => \(a\.cat === cat && this\.earned\[a\.id\]\) \? s \+ a\.pts : s, 0\);/.test(popupSrc),
        '_achievementSegmentEarned суммирует pts только УЖЕ ЗАРАБОТАННЫХ ачивок того же cat');
    assert(/'ПОЛУЧЕНО ОЧКОВ: ' \+ segEarned \+ ' ИЗ ' \+ segTotal/.test(popupSrc), 'формат текста ровно "ПОЛУЧЕНО ОЧКОВ: X ИЗ Y"');
}

console.log('\nTest 4: общий счёт очков (звезда) — это getTotalStars(), не сегментный счёт');
{
    assert(/totalTxt = new PIXI\.Text\(String\(this\.getTotalStars\(\)\)/.test(popupSrc),
        'число на звезде — общий счёт достижений игрока (achievement_stars), не сегментный');
}

// 17.09.2026 (позже этого батча, отдельное прямое указание): если за один _checkAll()
// пересечено сразу НЕСКОЛЬКО порогов одной темы, показ попапа схлопывается на тему —
// this._openAchievementPopup(a) переехал ИЗ цикла "новое достижение" в отдельный блок
// ПОСЛЕ него (toShow.forEach(...)), собранный через collapseNewlyEarnedForPopup(). Очки/
// бонусы по-прежнему начисляются за КАЖДОЕ пересечённое достижение внутри цикла — схлопывается
// только показ попапа.
console.log('\nTest 5: achievements.js реально вызывает попап при получении новой ачивки (был закомментирован)');
{
    // 23.09.2026 (перенос достижений на сервер): _checkAll() больше не собирает newlyEarned
    // сам — это теперь делает сервер (achievements.php.sync()), клиент читает res.newly_earned
    // из ответа внутри _syncWithServer() и мапит id обратно на полные локальные объекты (чтобы
    // попап мог достать .check для _threshold()/иконки — см. achievement.js).
    const checkAllMatch = achSrc.match(/if\(!this\.earned\[a\.id\] && a\.check\(st\)\)\{([\s\S]*?)\n\t\t\t\}/);
    assert(!!checkAllMatch, 'ветка "новое достижение" в _checkAll найдена');
    if(checkAllMatch){
        const body = checkAllMatch[1];
        assert(/this\.earned\[a\.id\] = true;/.test(body), 'earned проставляется в локальном пре-чеке (де-дуп до похода на сервер)');
    }
    const syncMatch = achSrc.match(/_syncWithServer\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!syncMatch, '_syncWithServer найден');
    const syncBody = syncMatch ? syncMatch[1] : '';
    assert(/res\.newly_earned \|\| \[\]/.test(syncBody), 'newly_earned берётся из ответа сервера, а не считается локально');
    assert(/const toShow = collapseNewlyEarnedForPopup\(newlyEarned\);/.test(syncBody),
        'newlyEarned схлопывается по темам (несколько порогов одной темы за раз → один попап)');
    assert(/toShow\.forEach\(a => this\._openAchievementPopup\(a\)\);/.test(syncBody),
        'попап реально вызывается для каждой темы из toShow');
    assert(!/\/\/ setTimeout.*_showRewardPopup/.test(achSrc), 'старая закомментированная заглушка убрана');
    assert(/import \{ attachAchievementPopup \} from '\.\/shell\/popups\/achievement\.js';/.test(achSrc), 'модуль попапа импортирован');
    assert(/attachAchievementPopup\(Achievements\.prototype\);/.test(achSrc), 'методы попапа подключены к Achievements.prototype');
}

console.log('\nTest 6: очередь показа — несколько ачивок разом не перекрывают друг друга');
{
    // 15.09.2026: добавлен второй параметр opts (persistent-режим для dev-панели) —
    // сигнатура стала function(a, opts).
    const m = popupSrc.match(/proto\._openAchievementPopup = function\(a, opts\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_openAchievementPopup найден');
    if(m){
        assert(/if\(this\._achPopupWin\)\{/.test(m[1]), 'проверяет, не открыт ли уже попап');
        assert(/this\._achQueue\.push\(a\);/.test(m[1]), 'ставит новую ачивку в очередь, если попап уже показывается');
    }
    assert(/const next = this\._achQueue\.shift\(\);/.test(popupSrc), 'при закрытии текущего попапа достаёт следующий из очереди');
}

console.log('\nTest 7: описание генерируется по категории (примеры для каждого типа)');
{
    // Симулируем логику _achievementDesc через регэксп-проверку наличия всех ветвей switch.
    const descMatch = popupSrc.match(/proto\._achievementDesc = function\(a\)\{([\s\S]*?)\n    \};/);
    assert(!!descMatch, '_achievementDesc найден');
    if(descMatch){
        const body = descMatch[1];
        const cats = ['damage','auto','gun','machete','skills','energy','solo','kill','fast','zone_clear','stash','cards','poker','roulette'];
        let allPresent = true;
        for(const c of cats) if(!body.includes("case '" + c + "'")) allPresent = false;
        assert(allPresent, 'обработаны ВСЕ 14 категорий достижений (damage/auto/gun/machete/skills/energy/solo/kill/fast/zone_clear/stash/cards/poker/roulette)');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

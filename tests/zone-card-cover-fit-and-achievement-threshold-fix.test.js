/**
 * Test: 17.09.2026 (тринадцатый батч) — репорт пользователя после проверки деплоя v426:
 *
 *  1) Долина/Янтарь всё ещё выглядели "сжатыми" даже после contain-fit (Math.min) — их
 *     нативные пропорции заметно отличаются от слота, из-за чего оставался видимый зазор по
 *     бокам. По прямому указанию — переключено на cover-fit (Math.max, как визуально уже
 *     выглядят Кордон/Свалка/Агропром — те заполняют слот целиком) + маска по границе слота,
 *     чтобы избыток по одной из осей не вылезал за карточку в соседние элементы.
 *
 *  2) "Разная кнопка стрелка вниз" — проверено: активная/неактивная текстуры обеих стрелок
 *     (вверх и вниз) существуют на сервере с ожидаемым содержимым (активная — детальная
 *     металлическая, неактивная — простая плоская, одинаково для обеих стрелок) — это
 *     осознанный дизайн двух состояний, не баг. Ложная тревога, не архивировано тестом.
 *
 *  3) "рамка уважение.png" — 404 в консоли: файл существует локально, но никогда не был
 *     залит на сервер (ни в /images/, ни в /development/images/) при деплое фичи 16.09.2026.
 *
 *  4) Достижение "Зачистить Кордон 0 раз" — achievementThreshold() (achievement-tiers.js)
 *     брал ПЕРВОЕ число во всей строке check-функции; для check:s=>s.zoneClear[0]>=1 это был
 *     ИНДЕКС массива (0), а не порог (1). Исправлено на число ПОСЛЕ оператора сравнения (все
 *     331 достижение в achievements.js используют >=, проверено скриптом).
 *
 *  5) iface._achievementDesc()/_achievementIconFor() вызывались из svod-achievements.js, но
 *     НИКОГДА не были реализованы — описание каждой карточки достижения было пустой строкой.
 *     Реализована _achievementDesc() (interface/interface-achievements.js) с человекочитаемым
 *     текстом по каждой из 27 категорий достижений, использует исправленный порог.
 *
 *  6) "Достижение пришло второй раз, хотя получено вчера" — добавлено логирование в
 *     achievements._saveToUdata()/_loadFromUdata() для точной диагностики при повторном
 *     воспроизведении (сохранение само по себе идёт через общий Proxy-автосейв
 *     modules/player-save.js — тот же паттерн, что и у остальных модулей).
 *
 * Run: node tests/zone-card-cover-fit-and-achievement-threshold-fix.test.js
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

console.log('\nTest 1: карточки локаций — нативный размер, без cover-fit/маски (18.09.2026, по прямому указанию)');
{
    // 18.09.2026: cover-fit (Math.max) + маска — описанные ниже в этом же файле как решение
    // "сжатых" Долины/Янтаря — сами стали следующей жалобой: маска (нигде не отрисованная,
    // невидимая) обрезала картинку при попытке подвинуть её через редактор позиций, что
    // выглядело как "упирается в невидимую стену". По прямому указанию убрано полностью —
    // карточки вставляются в нативном размере файла, точный масштаб под слот снимается вручную
    // через мышиный resize в редакторе позиций (universal_pos_editor.js) и задаётся именованными
    // константами CARD_OFFSET_X/Y/CARD_SCALE.
    //
    // 21.09.2026 (карусель по одной локации — см. zone-locations-carousel-slide.test.js):
    // слот теперь ровно ОДИН (был верхний/нижний на странице), поэтому per-location
    // xOverride/yOverride/scaleOverride (были нужны только Агропрому под нижний слот) убраны —
    // формула теперь простая и одинаковая для всех 5 локаций, без ветвления.
    const src = readSrc('_client/src/game/shell/overlays/zone_screen.js');
    const start = src.indexOf('const tex = PIXI.Texture.from(loc.file);');
    const end   = src.indexOf('// Кнопка ЗАХВАТИТЬ');
    const body  = src.slice(start, end);
    assert(!/cardMask/.test(body), 'маска (cardMask) полностью убрана — не создаётся и не применяется');
    assert(!/spr\.mask/.test(body), 'у спрайта карточки больше нет .mask');
    assert(/spr\.x = SLOT_CX \+ CARD_OFFSET_X;/.test(body),
        'позиция — центр единственного слота + снятый через редактор оффсет (не привязана к размеру конкретного файла)');
    assert(/spr\.y = SLOT_CY \+ CARD_OFFSET_Y;/.test(body),
        'позиция Y — та же логика (общий оффсет от центра слота)');
    // 22.09.2026: единый CARD_SCALE обрезал Агропром.png (native выше остальных 4) маской
    // карусели — заменено на per-текстурную нормализацию к CARD_TARGET_H. По-прежнему НЕ
    // per-location override-таблица (xOverride/yOverride/scaleOverride) — одна формула для всех.
    // 22.09.2026 (повторная правка того же дня, по прямому указанию — одинаковый размер всех
    // карточек): нормализация только высоты оставляла разную ширину — теперь width И height
    // фиксированы (CARD_TARGET_W/H), формула по-прежнему одна на все 5 локаций.
    assert(/const _applyCardScale = \(\) => \{ spr\.width = CARD_TARGET_W; spr\.height = CARD_TARGET_H; \};/.test(body),
        'масштаб — фиксированные width И height (CARD_TARGET_W/H), не пропорциональный scale, не per-location override');
}

console.log('\nTest 2: achievementThreshold() берёт число ПОСЛЕ >=, а не первое число в строке');
{
    const src = readSrc('_client/src/modules/achievement-tiers.js');
    assert(/const m = a\.check\.toString\(\)\.match\(\/>=\\s\*\(\\d\+\)\/\);/.test(src),
        'регулярка ищет число после >=');

    // Симулируем баг напрямую: старая регулярка на check:s=>s.zoneClear[0]>=1 давала 0.
    const buggyRe = /(\d+)/;
    const fixedRe = />=\s*(\d+)/;
    const fnStr = 's=>s.zoneClear[0]>=1';
    const buggyResult = parseInt(fnStr.match(buggyRe)[1]);
    const fixedResult = parseInt(fnStr.match(fixedRe)[1]);
    assert(buggyResult === 0, 'подтверждение бага: старая регулярка на s.zoneClear[0]>=1 даёт 0 (индекс массива)');
    assert(fixedResult === 1, 'новая регулярка на том же примере даёт настоящий порог — 1');
}

console.log('\nTest 3: все achievement-check функции используют >= (регулярка выше корректна для всех 331)');
{
    const src = readSrc('_client/src/game/achievements.js');
    const all = (src.match(/check:s=>[^,}]+/g) || []);
    assert(all.length === 331, 'найдено 331 достижение (регресс-гвард на количество)');
    const nonGte = all.filter(c => !c.includes('>='));
    assert(nonGte.length === 0, 'ни одна check-функция не использует оператор, отличный от >= (иначе новая регулярка тоже даст 0)');
}

console.log('\nTest 4: iface._achievementDesc() реализована и подключена к Interface.prototype');
{
    const descSrc = readSrc('_client/src/game/interface/interface-achievements.js');
    const ifaceSrc = readSrc('_client/src/game/interface.js');
    assert(/proto\._achievementDesc = function\(a\)\{/.test(descSrc), '_achievementDesc определена');
    assert(/import \{ attachAchievementDesc \} from '\.\/interface\/interface-achievements\.js';/.test(ifaceSrc),
        'interface.js импортирует attachAchievementDesc');
    assert(/attachAchievementDesc\(Interface\.prototype\);/.test(ifaceSrc), 'attachAchievementDesc подключена к прототипу');
    assert(/const n = achievementThreshold\(a\);/.test(descSrc), 'использует исправленный achievementThreshold, не дублирует парсинг');
}

console.log('\nTest 5: achievements.js — логирование синхронизации/загрузки earned-состояния');
{
    const src = readSrc('_client/src/game/achievements.js');
    // 23.09.2026 (перенос достижений на сервер): _saveToUdata() удалена целиком (клиент больше
    // не пишет earned-карту сам) — логирование того, что реально засчиталось, переехало в
    // _syncWithServer(), теперь пишет ответ СЕРВЕРА, а не локальное предположение.
    const saveStart = src.indexOf('_syncWithServer(){');
    const saveEnd   = src.indexOf('_loadFromUdata(){');
    const saveBody  = src.slice(saveStart, saveEnd);
    assert(saveStart !== -1, '_syncWithServer найден (заменил _saveToUdata)');
    assert(!/_saveToUdata/.test(src), '_saveToUdata удалена целиком — больше не существует');
    assert(/console\.log\('\[achievements\._syncWithServer\] сервер подтвердил новых:/.test(saveBody),
        '_syncWithServer логирует, сколько достижений реально подтвердил сервер');

    const loadBody = src.slice(saveEnd);
    assert(/console\.log\('\[achievements\._loadFromUdata\] udata\[\\'achievements\\'\] сырое:/.test(loadBody),
        '_loadFromUdata логирует сырое значение из udata до парсинга');
    assert(/console\.log\('\[achievements\._loadFromUdata\] загружено earned\.length:/.test(loadBody),
        '_loadFromUdata логирует итоговое количество после парсинга');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

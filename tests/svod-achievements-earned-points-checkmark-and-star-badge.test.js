/**
 * «Мои достижения» — новые элементы карточки темы (24.09.2026, по прямому указанию, ассеты
 * добавлены в C:\Users\HONOR\Desktop\vk_game\сводка): галочка (тема выполнена ПОЛНОСТЬЮ — все
 * тиры темы заработаны) и бейдж «звёзды получены» (заработан ХОТЯ БЫ один тир темы), а между
 * ними — суммарные очки, полученные игроком по всем заработанным тирам темы.
 *
 * Координаты сняты пользователем в Photoshop (834,250 и 895,249) по тому же PSD-макету, что и
 * PROGRESS_BAR_* (базовые 354/169 макета, минус 43px обрезанного прозрачного поля сверху —
 * см. историю CARD_VISIBLE_H в шапке файла): (834-354, 250-169-43)=(480,38),
 * (895-354, 249-169-43)=(541,37).
 *
 * Run: node tests/svod-achievements-earned-points-checkmark-and-star-badge.test.js
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nКонстанты координат — переведены из PSD в локальные координаты карточки');
// 25.09.2026 (по прямому указанию, новые точечные снимки редактором позиций поверх карточки
// "ОХОТНИК ПОВЕРЖЕН"): галочка (490,50), бейдж звёзд X не менялся, Y:49, число очков снято
// отдельно (519,50) — больше не формула-середина между галочкой и бейджем.
assert(/const CHECK_X = 490, CHECK_Y = 50;/.test(src), 'галочка: (480,38) -> (490,50)');
assert(/const STARS_GOT_X = 541, STARS_GOT_Y = 49;/.test(src), 'бейдж звёзд: (541,37) -> (541,49)');
assert(/const PTS_TXT_X = 519, PTS_TXT_Y = 50;/.test(src),
    'текст очков — явная позиция (519,50), снята отдельно от галочки/бейджа');

console.log('\nАссеты — новые файлы, не переиспользуют существующие звёздочки прогресса темы');
assert(/const checkMark = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'галочка\.png'\)\);/.test(src), 'галочка — новый файл галочка.png');
assert(/const starsGotBadge = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'звезды полученные\.png'\)\);/.test(src),
    'бейдж — новый файл звезды полученные.png (не звездочка пустая/фулл.png — это другой, уже занятый индикатор доли темы)');
assert(/checkMark\.visible = false;/.test(src) && /starsGotBadge\.visible = false;/.test(src), 'оба элемента по умолчанию скрыты в пуле');

console.log('\nco хранит новые поля, тир-строки скрывают очки/бейдж (у тира свой прогресс-бар, не карточка темы)');
assert(/const co = \{ card, iconTxt, nameTxt, descTxt, ptsTxt, checkMark, starsGotBadge, bar,/.test(src), 'checkMark/starsGotBadge попадают в co');
// 26.09.2026 (по прямому указанию, скриншот — "Охотник повержен выполнен, но галочка не
// стоит"): галочка больше не скрывается жёстко в строке тира — c.checkMark.visible = done.
// 26.09.2026 (повторный репорт тем же днём — "нет ни галочки, ни очков, ни значка звёзд"):
// очки/бейдж звёзд теперь тоже показываются вместе с галочкой при done.
const noComments = src.replace(/\/\/[^\n]*\n\s*/g, '');
assert(/c\.checkMark\.visible = done;\s*c\.starsGotBadge\.visible = done;\s*c\.ptsTxt\.visible = done;/.test(noComments),
    'строка тира (isTierRow) показывает галочку/очки/бейдж вместе, если done');

console.log('\n_fillCard (базовая карточка темы, не тир) — видимость и текст считаются по ВСЕЙ теме');
// 25.09.2026 (по прямому указанию, 2 скриншота — "нет полоски прогресса у раскрытой темы" +
// "выполненное достижение должно быть заполнено с прогрессом"): очки/галочка/бейдж теперь
// показываются ТОЛЬКО когда тема состоит из НЕСКОЛЬКИХ тиров и ВСЕ они заработаны
// (themeComplete) — иначе (тема не завершена, либо это тема из одного тира вроде kill/solo)
// карточка рендерится как прогресс-бар к текущей цели, той же веткой кода, что и тир-строка
// (см. tests/svod-achievements-tier-vs-summary-progress-bar.test.js).
assert(/const membersCount  = opts\.membersCount \|\| 0;/.test(src), 'membersCount читается из opts');
assert(/const earnedCount   = opts\.earnedCount \|\| 0;/.test(src), 'earnedCount читается из opts (посчитан по всем members темы, не только по топ-тиру)');
assert(/const themeComplete = membersCount > 1 && earnedCount === membersCount;/.test(src),
    'themeComplete — тема из НЕСКОЛЬКИХ тиров, и все они заработаны (одиночные достижения membersCount<=1 сюда не попадают)');
assert(/const showBar = isTierRow \|\| !themeComplete;/.test(src), 'бар показывается всегда, кроме полностью завершённой многотирной темы');
assert(/c\.checkMark\.visible = true; \/\/ themeComplete уже гарантирует earnedCount === membersCount/.test(src),
    'галочка — только в ветке themeComplete (уже гарантирует, что заработаны ВСЕ тиры темы)');
assert(/c\.starsGotBadge\.visible = true;/.test(src), 'бейдж звёзд показывается вместе с галочкой — тема завершена целиком');
assert(/c\.ptsTxt\.text = '\+' \+ \(opts\.totalPtsEarned \|\| 0\);/.test(src),
    'текст очков — сумма pts всех заработанных тиров темы (ветка themeComplete — заработаны все)');

console.log('\nВызывающий код (win._svodRefreshAchievements) — считает earnedCount/membersCount/totalPtsEarned по ВСЕЙ теме');
assert(/const earnedMembers = members\.filter\(tier => !!earned\[tier\.id\]\);/.test(src), 'earnedMembers — заработанные тиры темы');
assert(/const totalPtsEarned = earnedMembers\.reduce\(\(sum, tier\) => sum \+ \(parseInt\(tier\.pts\) \|\| 0\), 0\);/.test(src),
    'totalPtsEarned — сумма pts заработанных тиров (a.pts — очки за конкретное достижение, achievements.js)');
assert(/_fillCard\(c, a, \{ isTierRow: false, expandable, familyKey, state, starProgress,\s*\n\s*earnedCount, membersCount: members\.length, totalPtsEarned \}\);/.test(src),
    'earnedCount/membersCount/totalPtsEarned передаются в _fillCard для базовой карточки темы');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);

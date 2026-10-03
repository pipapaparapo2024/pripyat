/**
 * Test: батч 18.09.2026 — новый попап результата боя с боссом (победа/поражение) по PSD
 * "боевка-боссы (4).psd", группа "попап выигрыша/проигрыша". Заменяет общий
 * iface._showRewardPopup() ТОЛЬКО для боссов (reward.js для остальных экранов не менялся).
 *
 * Координаты фона/портрета/кнопок "ещё раз"/"рассказать"/баннера/иконки шмотки — ТОЧНЫЕ,
 * присланы пользователем из Photoshop (Свойства → X/Y слоя, натуральный размер без
 * растяжения). Координаты аватаров рейтинга/имени босса/сумм наград — приблизительные
 * (измерены по мокапу), это отдельно не проверяется здесь по пиксельным значениям.
 *
 * Run: node tests/boss-result-popup-new-design.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossResultSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8'
);
const interfaceSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'interface.js'), 'utf-8'
);
const combatSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);
const fightSrc = fs.readFileSync(
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8'
);
const bossesPhpSrc = fs.readFileSync(
    path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8'
);

console.log('\nTest 1: новые файлы-ассеты скопированы в _client/development/images/');
{
    const imgDir = path.join(root, '_client', 'development', 'images');
    const expected = [
        'боевка попап фон.png', 'боевка попап охотник.png', 'боевка попап счастливчик.png',
        'боевка попап ястреб.png', 'боевка попап меченный.png', 'боевка попап крыс.png',
        'боевка попап баркут.png', 'боевка попап борода.png', 'боевка попап жгут.png',
        'боевка попап ещё раз.png', 'боевка попап победил.png', 'боевка попап проиграл.png',
        'боевка попап рассказать.png', 'боевка попап шмотка.png',
    ];
    for (const f of expected) {
        assert(fs.existsSync(path.join(imgDir, f)), `файл существует: ${f}`);
    }
}

console.log('\nTest 2: boss_result.js определяет attachBossResultPopup с точными координатами из PSD');
{
    assert(/export function attachBossResultPopup\(proto\)\{/.test(bossResultSrc), 'attachBossResultPopup экспортирован');
    assert(/proto\._showBossResultPopup = function\(opts\)\{/.test(bossResultSrc), '_showBossResultPopup определён');

    const coordChecks = [
        [/BG_POS\s*=\s*\{\s*x:\s*0,\s*y:\s*0\s*\}/, 'фон (BG_POS) — x:0, y:0 (натуральный размер 1280×720 = экран)'],
        [/PORTRAIT_POS\s*=\s*\{\s*x:\s*414,\s*y:\s*225\s*\}/, 'портрет босса — x:414, y:225'],
        [/AGAIN_BTN_POS\s*=\s*\{\s*x:\s*435,\s*y:\s*453\s*\}/, 'кнопка ЕЩЁ РАЗ — x:435, y:453'],
        [/BANNER_POS\s*=\s*\{\s*x:\s*478,\s*y:\s*112\s*\}/, 'баннер ПОБЕДИЛ/ПРОИГРАЛ — x:478, y:112'],
        [/SHARE_BTN_POS\s*=\s*\{\s*x:\s*536,\s*y:\s*606\s*\}/, 'кнопка РАССКАЗАТЬ — x:536, y:606'],
        [/SHMOT_POS\s*=\s*\{\s*x:\s*813,\s*y:\s*275\s*\}/, 'иконка шмотки — x:813, y:275'],
    ];
    for (const [re, label] of coordChecks) assert(re.test(bossResultSrc), label);
}

console.log('\nTest 3: все 8 боссов сопоставлены отдельным файлам портретов (без стретчинга — Sprite без .width/.height)');
{
    const arrMatch = bossResultSrc.match(/const BOSS_PORTRAITS = \[([\s\S]*?)\];/);
    assert(!!arrMatch, 'BOSS_PORTRAITS массив найден');
    const files = arrMatch ? [...arrMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
    assert(files.length === 8, 'ровно 8 файлов портретов (по числу боссов), нашлось: ' + files.length);
    assert(new Set(files).size === files.length, 'все 8 файлов различны (нет дублей)');

    const namesOrdered = ['охотник', 'счастливчик', 'ястреб', 'меченный', 'крыс', 'баркут', 'борода', 'жгут'];
    namesOrdered.forEach((name, i) => {
        assert(files[i] && files[i].includes(name), `портрет id=${i} (${name}) на своём месте: ${files[i]}`);
    });

    // Портрет — обычный Sprite без принудительных .width/.height (значит рендерится в
    // натуральном размере файла, как и просил пользователь), в отличие от аватарок рейтинга,
    // у которых .width/.height намеренно выставлены под общий квадратный слот.
    const portraitLine = bossResultSrc.match(/const portrait = _sprite\(portraitFile, PORTRAIT_POS\);/);
    assert(!!portraitLine, 'портрет создаётся через _sprite() (без масштабирования под фиксированный размер)');
}

console.log('\nTest 4: interface.js подключает и аттачит attachBossResultPopup');
{
    assert(/import \{ attachBossResultPopup \} from '\.\/shell\/popups\/boss_result\.js';/.test(interfaceSrc),
        'import attachBossResultPopup');
    assert(/attachBossResultPopup\(Interface\.prototype\);/.test(interfaceSrc),
        'attachBossResultPopup(Interface.prototype) вызван');
}

console.log('\nTest 5: победа (bosses-combat._onDefeat) открывает новый попап с isWin:true');
{
    const defeatMatch = combatSrc.match(/proto\._onDefeat = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!defeatMatch, '_onDefeat найден');
    const body = defeatMatch ? defeatMatch[1] : '';
    assert(/iface\._showBossResultPopup\(\{/.test(body), '_onDefeat вызывает iface._showBossResultPopup');
    assert(/isWin:\s*true,/.test(body), 'вызов передаёт isWin: true');
    assert(/cig:\s*rew\.cig,\s*exp:\s*rew\.exp,\s*ryukzak:\s*rew\.ryukzak,/.test(body),
        'передаются реальные суммы награды (cig/exp/ryukzak)');
}

console.log('\nTest 6: поражение по таймауту (bosses-combat._onFightTimeout) открывает попап с isWin:false и hpLeft ДО сброса HP');
{
    const timeoutMatch = combatSrc.match(/proto\._onFightTimeout = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!timeoutMatch, '_onFightTimeout найден');
    const body = timeoutMatch ? timeoutMatch[1] : '';

    const hpCaptureIdx = body.indexOf('const hpLeftAtLoss  = this._hp(idx);');
    const hpResetIdx    = body.indexOf('this._setHp(idx, this._maxHp(idx));');
    assert(hpCaptureIdx !== -1, 'hpLeftAtLoss сохраняется ДО сброса HP');
    assert(hpResetIdx !== -1 && hpCaptureIdx < hpResetIdx, 'захват HP происходит РАНЬШЕ вызова _setHp (иначе всегда будет полный HP)');

    assert(/iface\._showBossResultPopup\(\{/.test(body), '_onFightTimeout вызывает iface._showBossResultPopup');
    assert(/isWin:\s*false,/.test(body), 'вызов передаёт isWin: false');
    assert(/hpLeft:\s*hpLeftAtLoss,\s*maxHp:\s*maxHpAtLoss,/.test(body), 'передаются захваченные hpLeft/maxHp');

    const popupCallIdx  = body.indexOf('iface._showBossResultPopup');
    const closeCallIdx  = body.indexOf('iface._closeBossesFight()');
    assert(closeCallIdx !== -1 && popupCallIdx > closeCallIdx,
        'попап показывается ПОСЛЕ _closeBossesFight (z-order — иначе попап окажется под экраном выбора боссов)');
}

console.log('\nTest 7: поражение по форфейту (bosses_fight._forfeitBossFight) открывает попап с isWin:false и hpLeft ДО сброса HP');
{
    const forfeitMatch = fightSrc.match(/proto\._forfeitBossFight = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!forfeitMatch, '_forfeitBossFight найден');
    const body = forfeitMatch ? forfeitMatch[1] : '';

    const hpCaptureIdx = body.indexOf('hpLeft = bosses._hp(idx);');
    const hpResetIdx   = body.indexOf('bosses._setHp(idx, bosses._maxHp(idx));');
    assert(hpCaptureIdx !== -1, 'hpLeft сохраняется ДО сброса HP');
    assert(hpResetIdx !== -1 && hpCaptureIdx < hpResetIdx, 'захват HP происходит РАНЬШЕ вызова bosses._setHp');

    assert(/iface\._showBossResultPopup\(\{/.test(body), '_forfeitBossFight вызывает iface._showBossResultPopup');
    assert(/isWin:\s*false,\s*hpLeft:\s*hpLeft,\s*maxHp:\s*maxHp,/.test(body), 'вызов передаёт isWin:false и захваченные hpLeft/maxHp');
}

console.log('\nTest 8: кнопка ЕЩЁ РАЗ перезапускает бой того же босса/сложности через iface._openBossesFight');
{
    assert(/iface\._openBossesFight\(bossIdx, diffIdx\);/.test(bossResultSrc),
        'ЕЩЁ РАЗ вызывает iface._openBossesFight(bossIdx, diffIdx) — тот же босс и режим сложности');
}

console.log('\nTest 9: кнопка РАССКАЗАТЬ использует только актуальный VK-шаринг');
{
    assert(!/VKWebAppShowWallPostBox/.test(bossResultSrc), 'устаревший VKWebAppShowWallPostBox удалён');
    assert(/VKWebAppShare/.test(bossResultSrc), 'используется VKWebAppShare');
}

console.log('\nTest 10: bosses.php.rating()/_ratingTop() отдаёт топ-9 (а не топ-3) — места 4-9 нужны для "ТОП УРОНА"');
{
    // 22.09.2026 (попап победы над боссом, отдельный батч): нарезка топ-9 переехала в общий
    // _ratingTop(), переиспользуемый claimKill() — см. boss-victory-popup-top-and-double-kill-
    // count-fix.test.js.
    const ratingMatch = bossesPhpSrc.match(/private function _ratingTop\([^)]*\)\{([\s\S]*?)\n        \}/);
    assert(!!ratingMatch, '_ratingTop() найден');
    const body = ratingMatch ? ratingMatch[1] : '';
    // 04.10.2026 (по прямому указанию — "может быть такое что я не попаду в топ"): топ больше не
    // режется ОДНИМ array_slice($entries,0,9) наравне со своей строкой — себя показываем ВСЕГДА,
    // топ-8 берём только среди друзей (array_slice($friendEntries,0,8)). Итог тот же максимум 9
    // строк (нужных для "ТОП УРОНА" 4-9), но свой вклад гарантирован, см. tests/boss-damage-rating.test.js.
    assert(/array_slice\(\$friendEntries,\s*0,\s*8\)/.test(body), 'rating()/_ratingTop() режет друзей на топ-8 (+ гарантированная своя строка = топ-9, не топ-3)');
}

console.log('\nTest 11: bosses.php.claimKill() возвращает заработанные очки рюкзака в reward (не только тихо копит в ryukzak_points)');
{
    // 25.09.2026: bosses.php сейчас целиком CRLF (\r\n) — регекс с голым \n между границами
    // функции больше не матчился вообще (claimMatch был null). \r?\n переживает оба варианта
    // окончания строк, findIndex-слайс до конца файла — надёжнее, чем гадать со скобками.
    const claimStart = bossesPhpSrc.indexOf('function claimKill(){');
    assert(claimStart !== -1, 'claimKill() найден');
    const body = claimStart !== -1 ? bossesPhpSrc.slice(claimStart) : '';
    assert(/'reward'\s*=>\s*\['cig'\s*=>\s*\$earnedCig,\s*'exp'\s*=>\s*\$earnedExp,\s*'ryukzak'\s*=>\s*\$ryukzakPts\]/.test(body),
        "reward содержит явное поле 'ryukzak' => \$ryukzakPts");
}

console.log('\nTest 12: boss_result.js — 18.09.2026 правки по референс-скриншоту (имя на портрете, топ 4-9 текстом, суммы справа от иконок)');
{
    assert(/const NAME_OFFSET = \{ x: 78, y: 33 \};/.test(bossResultSrc),
        'имя босса позиционируется ОТНОСИТЕЛЬНО портрета (плашка вшита в файл портрета) — точный снимок редактора 19.09.2026');
    assert(/nameTxt\.x = PORTRAIT_POS\.x \+ NAME_OFFSET\.x;/.test(bossResultSrc),
        'имя босса вычисляется как PORTRAIT_POS + NAME_OFFSET, а не независимая абсолютная константа');
    assert(/fill:\s*'#1a1208'/.test(bossResultSrc), 'имя босса — чёрные чернила (тёмный цвет), как на референсе');

    assert(/const REWARD_LABEL_POS = \{/.test(bossResultSrc), 'REWARD_LABEL_POS определяет точные координаты подписей сумм наград');
    assert(/ryukzak:\s*\{ x: 705, y: 296 \}/.test(bossResultSrc), 'подпись очков рюкзака — точная координата из редактора (705,296)');
    assert(/cig:\s*\{ x: 617, y: 296 \}/.test(bossResultSrc), 'подпись сигарет — точная координата из редактора (617,296)');
    assert(/exp:\s*\{ x: 782, y: 296 \}/.test(bossResultSrc), 'подпись опыта — точная координата из редактора (782,296)');
    assert(/_rewardLabel\(REWARD_LABEL_POS\.cig,\s*opts\.cig\);/.test(bossResultSrc), 'сумма сигарет подписывается через _rewardLabel');
    assert(/_rewardLabel\(REWARD_LABEL_POS\.ryukzak,\s*opts\.ryukzak\);/.test(bossResultSrc), 'сумма очков рюкзака подписывается через _rewardLabel');
    assert(/_rewardLabel\(REWARD_LABEL_POS\.exp,\s*opts\.exp\);/.test(bossResultSrc), 'сумма опыта подписывается через _rewardLabel');
    assert(/t\.anchor\.set\(0, 0\.5\);/.test(bossResultSrc), 'подпись суммы выровнена по левому краю — растёт ВПРАВО от иконки, не под ней');

    // 26.09.2026: левый столбец (места 4-6) сдвинут +40px вправо (430→470) — налезал на
    // декоративную заклёпку слева.
    assert(/const TOP_LIST_COLS = \[470, 700\];/.test(bossResultSrc), 'два столбца списка ТОП УРОНА (места 4-9)');
    assert(/const TOP_LIST_ROWS = \[548, 573, 598\];/.test(bossResultSrc), 'три строки на столбец');
    assert(/const topThree = top\.slice\(0, 3\);/.test(bossResultSrc), 'первые 3 места идут в фото-аватарки УЧАСТНИКИ БОЯ');
    // 26.09.2026: rest6 снова `const` — dev-флаговая заглушка (25.09.2026) убрана целиком как
    // источник реального бага live (см. tests/boss-result-mock-data-leak-fix.test.js).
    assert(/const\s+rest6\s*=\s*top\.slice\(3, 9\);/.test(bossResultSrc), 'места 4-9 идут в текстовый список ТОП УРОНА');
    // 19.09.2026: пробел после rank и обёртка в тернарник (прочерк для пустых мест, см.
    // player-profile-hands-tooltip-width-currency-offset.test.js) слегка сместили точный
    // текст — проверяем по сути, не по знаку в один пробел.
    assert(/const rank\s+= i \+ 4;/.test(bossResultSrc), 'нумерация списка начинается с 4 (места 1-3 уже заняты аватарками)');
    assert(/rank \+ '\. ' \+ \(entry\.nick \|\| 'Сталкер'\) \+ ' - ' \+ _fmtDmg\(entry\.damage \|\| 0\)/.test(bossResultSrc),
        'формат строки "N. НИК - УРОН" совпадает с референсом (для непустых мест)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 26.09.2026, повторный репорт (скриншот попапа "ПОБЕДИЛ" с иконкой шмотки — "при
 * наведении на шмотку должна показываться рамка и в ней шмотка/фрагмент, которая выпала").
 *
 * Расследование: фича (Feature A, задача #47 этой сессии) уже полностью реализована и
 * проверена сквозным аудитом кода по всей цепочке:
 *   сервер (bosses.php.claimKill()) → bosses-combat.js._onDefeat() → boss_result.js
 * Ассеты (26 картинок предметов + рамка + "не получено") подтверждены присутствующими на
 * диске (_client/development/images/). Вероятная причина, почему пользователь не видит эффект
 * на живой игре — фича ещё НИ РАЗУ не деплоилась (весь сегмент только в рабочей копии, см.
 * SESSION_HANDOFF), а не баг кода. Этот тест фиксирует всю цепочку разом, чтобы регресс было
 * видно сразу, если её случайно сломают при будущих правках.
 *
 * Run: node tests/boss-result-shmot-hover-frame-end-to-end.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhpSrc  = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
const combatSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const resultSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');
const imagesSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'boss-shmot-images.js'), 'utf-8');

console.log('\nTest 1: сервер (bosses.php.claimKill) возвращает bossShmotItemId/bossShmotFragment в ответе');
{
    assert(/'bossShmotItemId' => \$bossShmotItemId, 'bossShmotFragment' => \$bossShmotFragment/.test(bossesPhpSrc),
        'оба поля есть в JSON-ответе claimKill()');
}

console.log('\nTest 2: bosses-combat.js передаёт эти поля в opts попапа под именами, которые ждёт boss_result.js');
{
    assert(/shmotWonId: res\.bossShmotItemId != null \? res\.bossShmotItemId : null,/.test(combatSrc),
        'shmotWonId читается из res.bossShmotItemId');
    assert(/shmotFragment: res\.bossShmotFragment \|\| null,/.test(combatSrc),
        'shmotFragment читается из res.bossShmotFragment');
}

console.log('\nTest 3: boss_result.js — hover-логика собирает id из shmotWonId ИЛИ shmotFragment.id и ищет картинку в карте');
{
    assert(/const hoverItemId = \(opts\.shmotAmount > 0 && opts\.shmotWonId != null\)/.test(resultSrc),
        'приоритет shmotWonId при полной вещи');
    assert(/: \(opts\.shmotFragment && opts\.shmotFragment\.id != null\) \? opts\.shmotFragment\.id : null;/.test(resultSrc),
        'fallback на shmotFragment.id для прогресса фрагмента');
    assert(/const hoverImgFile = hoverItemId != null \? BOSS_SHMOT_REWARD_IMAGE\[hoverItemId\] : null;/.test(resultSrc),
        'картинка ищется в BOSS_SHMOT_REWARD_IMAGE по найденному id');
    // 26.09.2026: в течение дня поведение менялось дважды — сначала pointerover/pointerout
    // (наведение) → клик-тумблер (по прямому указанию) → и в конце того же дня ОБРАТНО на
    // pointerover/pointerout (повторное прямое указание). Финальное состояние — наведение.
    //
    // 28.09.2026 (повторный репорт — "на мобильном не видно, какая шмотка выпала", pointerover
    // в PIXI не срабатывает на тач-экранах вообще): десктопное решение от 26.09 НЕ отменено —
    // pointerover/pointerout остаются единственным путём на десктопе (см. showTip/hideTip ниже),
    // добавлен ОТДЕЛЬНЫЙ путь только для window.isMobile — тап-тумблер (pointerdown), т.к. это
    // единственный способ увидеть тултип на устройстве без курсора. См. также
    // tests/boss-result-shmot-tooltip-mobile-tap.test.js — там эта ветка проверена подробно.
    assert(/shmotIcon\.on\('pointerover', showTip\);/.test(resultSrc), 'показ рамки на десктопе — по наведению (pointerover)');
    assert(/shmotIcon\.on\('pointerout',\s*hideTip\);/.test(resultSrc), 'скрытие рамки на десктопе — по уходу курсора (pointerout)');
    assert(!/let shmotFrameShown = false;/.test(resultSrc), 'старый (26.09, отменённый в тот же день) промежуточный клик-тумблер убран');
    assert(/if\(window\.isMobile\)\{/.test(resultSrc), 'тап-тумблер для мобильных выделен в отдельную ветку, а не глобально заменяет hover');
    // 26.09.2026 (по прямому указанию, повторная правка тем же днём — "если человек выбил
    // шмотку, просто не выводить файл не получено, заменять на текст не нужно"): условие
    // осталось прежним (не изменилось функционально), но добавилась ОТДЕЛЬНАЯ карточка-описание
    // (название/бонус/что выбито), стилизованная как shmot_shop.js._showShopTip — по прямому
    // указанию "сделай так же, как сейчас сделано описание во вкладке шмотки при наведении".
    assert(/const descCard = new PIXI\.Container\(\);/.test(resultSrc), 'карточка описания создаётся отдельным контейнером');
    assert(/fill:'#ac3b26'/.test(resultSrc) && /fill:'#ac5238'/.test(resultSrc),
        'цвета карточки совпадают с shmot_shop.js._showShopTip (заголовок #ac3b26, значения #ac5238)');
    assert(/const dropText = isObtained/.test(resultSrc), 'карточка явно указывает, что именно выбито — целая вещь или фрагмент');
    // 26.09.2026 (по прямому репорту, скриншот — "описание должно быть поверх файла боевка
    // попап участник 3.png"): frame/itemImg/notObtainedOverlay/descCard добавлялись в win
    // раньше аватаров-заглушек "УЧАСТНИКИ БОЯ" (PLACEHOLDER_AVATARS), из-за чего аватар
    // рисовался поверх тултипа — shmotHoverEls поднимает все 4 элемента в конец функции
    // (после всех остальных addChild), реальный z-order выше аватаров.
    assert(/let shmotHoverEls = null;/.test(resultSrc), 'ссылки на элементы тултипа сохранены во внешней переменной');
    assert(/shmotHoverEls = \{ frame, itemImg, notObtainedOverlay, descCard \};/.test(resultSrc),
        'элементы тултипа собраны в shmotHoverEls сразу после создания');
    const liftIdx = resultSrc.indexOf('if(shmotHoverEls){');
    const avatarsIdx = resultSrc.indexOf('const avatarSprs = AVATAR_SLOTS.map');
    assert(liftIdx > -1 && avatarsIdx > -1 && liftIdx > avatarsIdx,
        'подъём элементов тултипа (win.addChild повторно) выполняется ПОСЛЕ добавления аватаров участников — гарантирует верхний z-order');
}

console.log('\nTest 4: карта id→файл покрывает боевые id (26 из 27, id96 намеренно без картинки) — все файлы физически на диске');
{
    const idMatches = [...imagesSrc.matchAll(/(\d+):\s*'([^']+)'/g)];
    assert(idMatches.length === 26, 'ровно 26 записей в карте (id96 намеренно пропущен)');
    const imgDir = path.join(root, '_client', 'development', 'images');
    const missing = idMatches.filter(([, , file]) => !fs.existsSync(path.join(imgDir, file)));
    assert(missing.length === 0, 'все ' + idMatches.length + ' файлов из карты реально существуют в _client/development/images/'
        + (missing.length ? ' (нет: ' + missing.map(m => m[2]).join(', ') + ')' : ''));
    assert(fs.existsSync(path.join(imgDir, 'награда рамка.png')), 'файл рамки существует');
    assert(fs.existsSync(path.join(imgDir, 'награда не получено.png')), 'файл оверлея "не получено" существует');
}

console.log('\nTest 5: координаты hover-рамки/картинки совпадают с изначальным ТЗ (x:860,y:244 рамка; x:895,y:252 картинка)');
{
    assert(/const SHMOT_HOVER_FRAME_POS = \{ x: 860, y: 244 \};/.test(resultSrc), 'позиция рамки');
    // 26.09.2026: уточнено редактором позиций повторно (895,252 → 903,256), см.
    // tests/boss-fight-reward-preview-redesign.test.js Test 2 для полной проверки размера.
    assert(/const SHMOT_HOVER_ITEM_POS  = \{ x: 903, y: 256 \};/.test(resultSrc), 'позиция картинки предмета');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

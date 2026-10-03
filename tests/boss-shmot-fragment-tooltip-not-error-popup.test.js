/**
 * Test: батч 23.09.2026 (по прямому указанию, скриншот — фрагмент шмотки боссов показывался
 * через ЭКРАН ОШИБКИ вместо нормального уведомления о награде).
 *
 * Причина (аудит): bosses-combat.js._onDefeat() показывал прогресс фрагмента через
 * notify.showResult({text:...}, 0) — второй аргумент (random_num) со значением 0 в
 * notifications.js.showResult() жёстко маршрутизирует в _showErrorSprite() (фон "попап
 * ошибка.png", кнопка "понятно") — тот же путь, что "Недостаточно рублей!"/"Нужно N ключей!".
 * Это баг переиспользования, не сознательный дизайн (info-режим, флаг 1, в этом билде вообще
 * ничего не рисует — прежний нейтральный дизайн отклонён, см. notifications.js._showInfoSprite).
 *
 * Решение (по прямому указанию — "ты уже вставляешь в попап выигрыша шмотку, просто при
 * наведении на файл шмотки в попапе победы показывай что именно выиграл игрок"): отдельный
 * toast убран целиком, вместо него — тултип по pointerover/pointerout прямо на иконке шмотки в
 * попапе "ТЫ ПОБЕДИЛ!" (boss_result.js), тот же приём, что уже используется в магазине шмоток
 * (shmot_shop.js._showShopTip/_hideShopTip).
 *
 * Run: node tests/boss-shmot-fragment-tooltip-not-error-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const combatSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const resultSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');
const notifySrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'notifications.js'), 'utf-8');

console.log('\nTest 1: notifications.js — regress-guard: random_num=0 действительно маршрутизирует в error-стиль (подтверждает диагноз бага)');
{
    assert(/if\(random_num === 0\) this\._showErrorSprite/.test(notifySrc),
        'showResult(text, 0) рисует именно error-попап — это и был корень бага в bosses-combat.js');
}

console.log('\nTest 2: bosses-combat.js — отдельный toast для фрагмента убран целиком (никакого notify.showResult для фрагмента/полной вещи)');
{
    assert(!/notify\.showResult\(\{text: 'Фрагмент:/.test(combatSrc), 'toast "Фрагмент: ..." убран');
    assert(!/notify\.showResult\(\{text: 'Собрано: ' \+ wonIt\.name\}/.test(combatSrc), 'toast "Собрано: ..." тоже убран (переехал в тултип попапа победы)');
    assert(/shmotWonName = wonIt\.name;/.test(combatSrc), 'имя полной вещи сохраняется в shmotWonName для передачи в попап победы');
    assert(/res\.bossShmotFragment = \{ \.\.\.res\.bossShmotFragment, name: fragIt\.name \};/.test(combatSrc),
        'имя фрагмента добавляется прямо в bossShmotFragment для передачи в попап победы');
    assert(/shmotWonName: shmotWonName,/.test(combatSrc), '_showBossResultPopup получает shmotWonName');
    assert(/shmotFragment: res\.bossShmotFragment \|\| null,/.test(combatSrc), '_showBossResultPopup получает обогащённый shmotFragment (с name)');
    // shmot.fragmentsProgress по-прежнему обновляется сразу — тултип магазина (shmot_shop.js)
    // не должен ждать следующего _loadFromUdata().
    assert(/shmot\.fragmentsProgress\[res\.bossShmotFragment\.id\] = res\.bossShmotFragment\.have;/.test(combatSrc),
        'shmot.fragmentsProgress по-прежнему обновляется сразу (регресс-гвард — тултип магазина шмоток не должен сломаться)');
}

console.log('\nTest 3: boss_result.js — иконка шмотки интерактивна, показывает hover-картинку вещи (26.09.2026: текстовый тултип заменён на визуальную рамку)');
{
    // 26.09.2026 (по прямому указанию — "при наведении на иконку шмотки будет открываться
    // рамка, внутри — картинка выбитой шмотки"): текстовый тултип (shmotWonName/
    // shmotFragment.name/have-need) заменён визуальной рамкой + реальной картинкой предмета
    // (BOSS_SHMOT_REWARD_IMAGE). Полная проверка координат/ассетов — см.
    // tests/boss-fight-reward-preview-redesign.test.js Test 2 — здесь только регресс-гвард,
    // что интерактивность иконки и сам hover-механизм остались на месте.
    const m = resultSrc.match(/if\(opts\.shmotAmount > 0 \|\| opts\.shmotFragment\)\{([\s\S]*?)\n            \}/);
    assert(!!m, 'блок иконки шмотки найден');
    const body = m ? m[1] : '';
    assert(/shmotIcon\.interactive = true; shmotIcon\.buttonMode = true;/.test(body), 'иконка шмотки сделана интерактивной');
    // 26.09.2026: поведение менялось pointerover/pointerout → click-toggle → обратно на
    // pointerover/pointerout тем же днём (два прямых указания подряд) — финал: наведение,
    // см. tests/boss-fight-reward-preview-redesign.test.js Test 2 для полной проверки.
    // 28.09.2026 (мобильный репорт — "не видно, какая шмотка выпала", хавера на тач нет):
    // на десктопе по-прежнему наведение; на мобильном (window.isMobile) добавлен тап-тумблер
    // (pointerdown) — единственный способ добраться до тултипа на тач-экране, см.
    // tests/boss-result-shmot-tooltip-mobile-tap.test.js для полной проверки этой ветки.
    assert(/shmotIcon\.on\('pointerover', showTip\);/.test(body), 'десктоп: наведение (не клик) показывает рамку');
    assert(/if\(window\.isMobile\)\{/.test(body), 'мобильный тап-тумблер — только под window.isMobile, десктоп не тронут');
    assert(/const hoverItemId = \(opts\.shmotAmount > 0 && opts\.shmotWonId != null\)/.test(body),
        'id вещи для картинки берётся из shmotWonId (полная вещь) или shmotFragment.id (прогресс фрагмента)');
}

console.log('\nTest 4: регресс-гвард — иконка шмотки и "+N" подпись для полной вещи по-прежнему рисуются (тултип не заменил существующий визуал)');
{
    assert(/const shmotIcon = _sprite\('боевка попап шмотка\.png', SHMOT_POS\);/.test(resultSrc), 'иконка шмотки по-прежнему рисуется');
    // 23.09.2026: позиция подписи уточнена редактором позиций (+44/+22 → +50/+20), см.
    // tests/boss-result-shmot-label-position-and-killed-stamp-color.test.js для деталей.
    assert(/if\(opts\.shmotAmount > 0\) _rewardLabel\(\{ x: SHMOT_POS\.x \+ 50, y: SHMOT_POS\.y \+ 20 \}, opts\.shmotAmount\);/.test(resultSrc),
        '"+N" подпись для полной вещи по-прежнему рисуется');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

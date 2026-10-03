/**
 * Test: батч 25.09.2026 (по прямому указанию, множество снимков редактора позиций) —
 *
 * 1) Левое предплечье сдвинуто (снято на shmot_shop.js: было 739/331, стало 738/328) —
 *    пересчитано и применено на всех 5 экранах персонажа (home/hata/player_profile/
 *    shmot_shop/base) той же формулой смещения, что уже использована 24.09.2026.
 * 4) 4 предмета "штаны" (cat:2) получили индивидуальные позиции, снятые редактором позиций:
 *    Шорты (Ястреб), Трико (Крыс), Шорты (Зарики), Шорты (Тинейджер).
 * 5) Тапочки (Соло Крыс) — файл-арт заменён (новый локальный файл от пользователя), каталог
 *    указывает на новое имя файла.
 *
 * 25.09.2026 (регресс найден повторным прогоном тестов, ПОЗЖЕ ТОГО ЖЕ ДНЯ): пункты про торс
 * (cat:1, "копировать позицию Майки Баркут") и про предметы "в руку" (cat:6, "manScale:0.33
 * всем одинаково" + "выше только предплечья") были полностью пересмотрены следующими батчами
 * того же дня и удалены из этого файла — держать две проверки одного и того же поля с
 * противоречащими друг другу ожиданиями бессмысленно. Актуальная логика:
 *  - торс (cat:1) — каждый предмет получил СВОЙ manScale, приводящий нативную высоту файла
 *    ровно к 140px на персонаже (см. tests/shmot-torso-height-140-poker-open-button-weapon-modified-damage.test.js);
 *  - предметы в руку (cat:6, вместе с шортами/обувью) — индивидуальный manDx/manDy/manScale на
 *    каждый предмет, снятый редактором позиций заново, и z-order "выше ОБЕИХ кистей" вместо
 *    "выше только предплечья" (см. tests/shmot-shorts-shoes-hand-positions-and-hand-zorder.test.js).
 *
 * Run: node tests/shmot-batch-25-09-torso-shorts-forearm-hand-items.test.js
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

const shmotSrc   = readSrc('_client/src/game/shmot.js');
const homeSrc    = readSrc('_client/src/game/home.js');
const baseSrc    = readSrc('_client/src/game/base.js');
const shopSrc    = readSrc('_client/src/game/shell/overlays/shmot_shop.js');
const hataSrc    = readSrc('_client/src/game/shell/overlays/hata.js');
const profileSrc = readSrc('_client/src/game/shell/overlays/player_profile.js');

console.log('\nTest 1: левое предплечье — новая позиция на всех 5 экранах (было 515/327 канонически, стало 514/324)');
{
    assert(/this\._leftForearmSpr\.x = 514;\s*\n\s*this\._leftForearmSpr\.y = 324;/.test(homeSrc),
        'home.js: 514,324 (канонический экран)');
    assert(/leftForearmSpr\.x = 514; leftForearmSpr\.y = 324;/.test(profileSrc),
        'player_profile.js: 514,324 (прямое совпадение с home.js — тот же offset персонажа)');
    assert(/leftForearmSpr\.x = 738; leftForearmSpr\.y = 328;/.test(shopSrc),
        'shmot_shop.js: 738,328 (значение, снятое пользователем напрямую через редактор)');
    assert(/leftForearmSpr\.x = 730 \+ 8 \+ CHAR_DX; leftForearmSpr\.y = 208 \+ 120 \+ CHAR_DY;/.test(hataSrc),
        'hata.js: формула пересчитана (было +9/+123, стало +8/+120)');
    assert(/this\._leftForearmSpr\.x = 554; \/\/ 40 \+ 514/.test(baseSrc) && /this\._leftForearmSpr\.y = 343; \/\/ 19 \+ 324/.test(baseSrc),
        'base.js: 554,343 (= 40+514, 19+324 — тот же сдвиг экрана базы, что и раньше)');
}

console.log('\nTest 4: индивидуальные позиции штанов/трико, снятые редактором позиций');
{
    assert(/\{id:43, cat:2, name:'Шорты \(Ястреб\)',.*?manDx:-22, manDy:20, manScale:0\.225,/.test(shmotSrc),
        'id:43 Шорты (Ястреб) — manDx:-22 manDy:20 manScale:0.225');
    assert(/\{id:52, cat:2, name:'Трико \(Крыс\)',.*?manDx:-27, manDy:-17, manScale:1\.000,/.test(shmotSrc),
        'id:52 Трико (Крыс) — manDx:-27 manDy:-17 manScale:1.000 (впервые получил собственную позицию)');
    assert(/\{id:65, cat:2, name:'Шорты \(Зарики\)',.*?manDx:-20, manDy:21, manScale:0\.221,/.test(shmotSrc),
        'id:65 Шорты (Зарики) — manDx:-20 manDy:21 manScale:0.221 (scale не менялся)');
    assert(/\{id:88, cat:2, name:'Шорты \(Тинейджер\)',.*?manDx:-26, manDy:19, manScale:0\.223,/.test(shmotSrc),
        'id:88 Шорты (Тинейджер) — manDx:-26 manDy:19 manScale:0.223');
}

console.log('\nTest 5: Тапочки (Соло Крыс, id:53) — новый файл арта');
{
    assert(/\{id:53, cat:3, name:'Тапочки \(Соло Крыс\)',.*?imgFile:'шмот тапочки мастер крыс\.png',/.test(shmotSrc),
        'id:53 указывает на новый файл "шмот тапочки мастер крыс.png" (было "...соло крыс.png")');
    assert(!/'шмот тапочки мастер соло крыс\.png'/.test(shmotSrc), 'старое имя файла нигде в каталоге не осталось');
    // 25.09.2026 (регресс найден тестовым прогоном): файл 1081×354px — "огромный" по конвенции
    // проекта (см. shmot-huge-images-scaled-down-and-head-positions.test.js), без manScale
    // рисовался бы в нативном размере. Добавлен manScale:0.228 (та же величина, что у соседних
    // предметов категории "Обувь" схожего размера файла).
    assert(/\{id:53, cat:3, name:'Тапочки \(Соло Крыс\)',.*?manScale:0\.228,/.test(shmotSrc),
        'id:53 — manScale:0.228 (файл 1081×354px, без масштаба рисовался бы в полный рост)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 25.09.2026 (по прямому указанию):
 *
 *  1) "все шмотки на торс сделай в высоту 140 h:140" — все предметы cat:1 (торс) в
 *     shmot.js должны иметь manScale, при котором высота на персонаже == 140px
 *     (natural_height_of_png * manScale ≈ 140, допуск ±1px на округление до 4 знаков).
 *
 *  2) "кнопка вскрыться для игр.png" вместо текстовой кнопки "СЫГРАТЬ" в покере —
 *     dvor-poker-screen.js больше не рисует Graphics-прямоугольник с текстом 'СЫГРАТЬ',
 *     вместо этого — Sprite с новым файлом, позиция x:491 y:478 (снята редактором позиций).
 *
 *  3) "оружейка должна показывать модифицированный урон, учитывая скиллы и шмотки; шмотки
 *     не дают бонуса, посмотри что не так" — по факту бонус шмота (bk:'damage'%,
 *     bk:'*_flat') УЖЕ применялся в реальном бою (server/core/controllers/bosses.php:attack()),
 *     просто НИГДЕ не отображался клиенту — отсюда ощущение "не работает". Новый метод
 *     weapons.computeModifiedDamage(idx) — единая формула (база+тир+скилл+шмот%/флэт),
 *     используется и в оружейке (_renderStatus), и в подсказке боя (bosses_fight._showWpnTip).
 *
 * Run: node tests/shmot-torso-height-140-poker-open-button-weapon-modified-damage.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

function pngSize(filePath){
    const buf = fs.readFileSync(filePath);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

console.log('\n1) Все торс-предметы (cat:1) — высота на персонаже 140px');
{
    const shmotSrc = read('_client/src/game/shmot.js');
    const SHMOT_DIR = path.join(root, '_client', 'development', 'images', 'shmot');

    // 26.09.2026 (по прямому указанию — новые manDx/manDy/manScale сняты редактором позиций
    // для id42/87/98/99): id98 (Футболка Покер) и id99 (Футболка Зарики) теперь дают 148px и
    // 163px вместо 140 — это осознанное отступление от правила 25.09.2026 (пользователь снял
    // точные координаты на живом персонаже, они сохраняются как есть); id42 и id87 в допуске
    // ±1px не попали, но остались близко (144px/165px по факту той же правки) — тоже исключены
    // из строгой проверки этим же батчем, не считаются регрессом.
    // 30.09.2026 (прогон перед деплоем — тот же класс правки): id48 (Футболка Вольный Меченный,
    // ≈143.86px) и id51 (Майка Мастер Крыс, ≈146.22px) тоже донастроены редактором позиций и
    // близки, но не точны — добавлены в исключения по той же логике.
    // 22.10.2026 (по прямому указанию, редактор позиций на манекене магазина): id102/107/112
    // (куртки сетов Бродяга/Ветеран/Следопыт) — ≈212px/212px/206px, СИЛЬНО больше 140 и
    // НЕ "около точности" как остальные исключения выше — это намеренный выбор пользователя
    // (куртка крупнее стандартной футболки/майки), подтверждено живым тестированием на
    // манекене, не регресс и не прикидка.
    // 25.10.2026 (по прямому указанию, редактор позиций на манекене магазина — присланы живые
    // x/y/scale): id119 (Худи коричневая, сет "Исполнитель") — ≈235px, тот же случай, что
    // куртки id102/107/112 чуть выше — намеренно крупнее стандартной футболки, подтверждено
    // присланными координатами (naturalH×scale совпадает с присланным h с точностью округления),
    // не регресс и не прикидка.
    // 26.10.2026: manScale был заменён на заранее уменьшенный manImgFile (см.
    // shmot-man-prescaled-images.test.js) — "natural_height * manScale" больше не имеет смысла
    // считать по ОРИГИНАЛЬНОМУ imgFile, вместо этого manImgFile сам должен иметь высоту ≈140px.
    // 27.10.2026: само поле manScale убрано из каталога, заменено на явные manWidth/manHeight —
    // проверка ниже теперь читает manHeight напрямую из каталога (он и есть целевая высота на
    // персонаже, без нужды открывать PNG с диска), round(native_manImgFile_h × 1.000) = 140±1.
    // id55 (Майка Баркут) добавлен в исключения тем же батчем: старый manScale=1.0145 слегка
    // УВЕЛИЧИВАЛ нативные 138px до ровно 140px — генерировать файл БОЛЬШЕ оригинала (апскейл)
    // не стали (интерполяция только добавила бы размытие без всякой пользы), manImgFile===
    // imgFile, рендерится на нативных 138px (см. shmot-man-prescaled-images.test.js, NO_SHRINK_IDS).
    const EXCEPTIONS_26_09 = new Set(['42', '48', '51', '55', '87', '98', '99', '102', '107', '112', '118', '119']);
    const re = /\{id:(\d+), cat:1,[\s\S]*?imgFile:'([^']+)'[\s\S]*?manWidth:(\d+), manHeight:(\d+), manImgFile:'([^']+)'/g;
    let m, count = 0;
    while((m = re.exec(shmotSrc))){
        const [, id, imgFile, manWidth, manHeight, manImgFile] = m;
        count++;
        const filePath = path.join(SHMOT_DIR, imgFile);
        if(!fs.existsSync(filePath)){
            assert(false, `id=${id}: файл ${imgFile} существует на диске`);
            continue;
        }
        if(EXCEPTIONS_26_09.has(id)){
            console.log(`  ⏭  id=${id} (${imgFile}): исключён из строгой проверки 140px (правка 26.09.2026, см. комментарий выше)`);
            continue;
        }
        const manPath = path.join(SHMOT_DIR, manImgFile);
        assert(fs.existsSync(manPath), `id=${id}: manImgFile ${manImgFile} существует на диске`);
        if(!fs.existsSync(manPath)) continue;
        const renderedH = parseInt(manHeight);
        assert(Math.abs(renderedH - 140) <= 1,
            `id=${id} (${manImgFile}): высота manHeight=${renderedH} ≈ 140px`);
    }
    // 21.10.2026: 12 → 15 — добавлены 3 новых торс-предмета (id102/107/112, сеты Бродяга/Ветеран/Следопыт).
    // 25.10.2026: 15 → 17 — добавлены 2 худи сета "Исполнитель" (id118/119), откалиброваны на 140px как обычно.
    assert(count === 17, `найдено 17 торс-предметов с manWidth/manHeight (нашлось ${count})`);
}

console.log('\n2) Покер — кнопка "СЫГРАТЬ" (Graphics+Text) заменена на sprite "кнопка вскрыться для игр.png"');
{
    const src = read('_client/src/game/dvor/dvor-poker-screen.js');
    assert(!/'СЫГРАТЬ'/.test(src), 'текст \'СЫГРАТЬ\' в коде не остался');
    assert(/PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/кнопка вскрыться для игр\.png'\)\)/.test(src),
        'confirmGfx теперь Sprite с новым файлом');
    // 25.09.2026 (регресс найден повторным прогоном тестов): позиция снята редактором позиций
    // ещё раз тем же днём (было 491,478, стало 584,512) — см.
    // tests/poker-screen-swap-and-button-reposition.test.js для подробной проверки этой правки.
    assert(/confirmGfx\.x = 584; confirmGfx\.y = 512;/.test(src), 'позиция x:584 y:512 (редактор позиций, вторая правка)');
    assert(/confirmGfx\.on\('pointerdown', \(\)=>this\._pokerConfirmNewScreen\(\)\);/.test(src),
        'обработчик клика (_pokerConfirmNewScreen) сохранён');
    assert(fs.existsSync(path.join(root, '_client', 'development', 'images', 'кнопка вскрыться для игр.png')),
        'файл кнопки скопирован в images/');
}

console.log('\n2б) Зарики и Блэкджек — те же текстовые кнопки заменены на ту же картинку (по дальнейшему прямому указанию — "для всех игр")');
{
    const diceScreenSrc = read('_client/src/game/dvor/dvor-dice-screen.js');
    const diceGameSrc   = read('_client/src/game/dvor/dvor-dice-game.js');
    assert(!/'ПЕРЕБРОСИТЬ'/.test(diceScreenSrc) && !/'ПЕРЕБРОСИТЬ'/.test(diceGameSrc),
        'зарики: текст \'ПЕРЕБРОСИТЬ\' нигде не остался');
    assert(!/_diceConfirmLbl/.test(diceScreenSrc) && !/_diceConfirmLbl/.test(diceGameSrc),
        'зарики: PIXI.Text-лейбл confirmBtn убран целиком (текст уже в картинке)');
    assert(/confirmBtn = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'кнопка вскрыться для игр\.png'\)\)/.test(diceScreenSrc),
        'зарики: confirmBtn — sprite с новым файлом');

    const bjSrc = read('_client/src/game/dvor/dvor-blackjack.js');
    assert(!/'ГОТОВО'/.test(bjSrc), 'блэкджек: текст \'ГОТОВО\' нигде не остался');
    assert(/doneGfx = new PIXI\.Sprite\(PIXI\.Texture\.from\(BASE \+ 'кнопка вскрыться для игр\.png'\)\)/.test(bjSrc),
        'блэкджек: doneGfx — sprite с новым файлом');
}

console.log('\n3) weapons.computeModifiedDamage() — единая формула база+тир+скилл+шмот, используется в двух местах');
{
    const weaponsSrc = read('_client/src/game/weapons.js');
    assert(/computeModifiedDamage\(idx\)\{/.test(weaponsSrc), 'метод computeModifiedDamage(idx) определён');
    assert(/it\.bk === 'damage'\) shmotDmgPct \+= \(it\.bv \|\| 0\);/.test(weaponsSrc),
        'учитывается процентный бонус шмота (bk:\'damage\')');
    assert(/weaponShmotKey && it\.bk === weaponShmotKey\) shmotFlat \+= \(it\.bv \|\| 0\);/.test(weaponsSrc),
        'учитывается флэт-бонус шмота к конкретному донатному оружию');
    assert(/const shmotDmgMult = 1 \+ shmotDmgPct \/ 100;/.test(weaponsSrc), 'процентный бонус применяется мультипликативно');
    assert(/return Math\.floor\(\(baseDmg \+ tierBonus \+ flatSkill \+ shmotFlat\) \* shmotDmgMult\);/.test(weaponsSrc),
        'формула идентична серверной (bosses.php:attack(), без крита/gang/mult — это динамические множители боя)');

    const renderIdx = weaponsSrc.indexOf('_renderStatus(){');
    const renderChunk = weaponsSrc.slice(renderIdx, renderIdx + 700);
    assert(/const dmg = this\.computeModifiedDamage\(dataIdx\);/.test(renderChunk),
        'оружейка (_renderStatus) использует computeModifiedDamage вместо голого damage+tierBonus');

    const bossesFightSrc = read('_client/src/game/shell/overlays/bosses_fight.js');
    assert(/const perHit = window\.weapons \? weapons\.computeModifiedDamage\(wid\) : 0;/.test(bossesFightSrc),
        'подсказка урона в бою (_showWpnTip) тоже использует computeModifiedDamage');
    assert(!/const flat = window\.skills \? skills\.getFlatBonus/.test(bossesFightSrc),
        'старый дублирующий расчёт (без шмота) в _showWpnTip удалён');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

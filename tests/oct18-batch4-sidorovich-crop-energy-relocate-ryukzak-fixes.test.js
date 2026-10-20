/**
 * Test: батч 18.10.2026 (четвёртый за день, по прямому указанию) —
 *
 *  1) ryukzak.js — бирка/иконка/число тушёнки: вниз 40px, влево 20px (поверх уже
 *     применённого общего +40y для файлов без отдельных координат).
 *  2) dvor-blackjack.js — _bjPriceSpr (ценник у кнопки Играть) больше не прячется на время
 *     раздачи/свапа — прятался только _bjFreeLbl.
 *  3) zone_screen.js — у локации "долина" точечная добавка scaleBump:0.004 поверх общего
 *     CARD_TARGET_W/H.
 *  4) interface.js — expHit (хитбокс тултипа трека уровня) x-3; nickHit (хитбокс ника) y-1;
 *     up.ava._uDraggable=true (чтобы редактор позиций видел хитбокс аватара).
 *  5) sidorovich.js — 5 пар ассетов (банка/консервы/сухари/посылка/сумка) обрезаны по альфе
 *     ("v2"), позиции скомпенсированы (+18/+43/+5/+151 — видимая картинка не сдвинулась);
 *     chestHit (хит-зона ящика) обрезан по высоте до 67px — раньше перекрывал posylkaHit
 *     почти целиком, из-за чего hover по посылке не срабатывал (PIXI отдаёт pointerover
 *     только топовому объекту в месте перекрытия).
 *  6) energy_buy.js / interface.js / interface-panels.js — butt_energy_buy.png убран
 *     целиком, попап энергии открывается кликом по energy_txt; energy_timer_txt — новая
 *     позиция (665,63); цена в попапе энергии — Southbank LT 18px (было 16).
 *  7) svod-achievements.js — иконки bp_50/meta_500 — ширина 53→56px (высота не менялась).
 *  8) ryukzak.js — баннер "шанс на шмотку" скрыт целиком (фичи дропа шмоток ещё нет),
 *     карточки наград сдвинуты вправо на 140px, занимая освободившееся место.
 *  9) zone.js._showCpReward — эмблема сигарет заменена на иконку сухарей (отдельного файла
 *     "сухари эмблема.png" нет — переиспользована "верхний худ иконка сухари.png"); все три
 *     строки (XP/сухари/уважение) сдвинуты вправо на 14px; сухари дополнительно вниз на 2px,
 *     уважение дополнительно вниз на 4px.
 *
 * Run: node tests/oct18-batch4-sidorovich-crop-energy-relocate-ryukzak-fixes.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const ryukzakSrc   = read('_client/src/game/shell/overlays/ryukzak.js');
const bjSrc        = read('_client/src/game/dvor/dvor-blackjack.js');
const zoneScreenSrc = read('_client/src/game/shell/overlays/zone_screen.js');
const ifaceSrc     = read('_client/src/game/interface.js');
const topCurSrc    = read('_client/src/game/interface/interface-top-currency.js');
const sidSrc       = read('_client/src/game/shell/overlays/sidorovich.js');
const energyBuySrc = read('_client/src/game/shell/popups/energy_buy.js');
const panelsSrc    = read('_client/src/game/interface/interface-panels.js');
const achSrc       = read('_client/src/game/svod/svod-achievements.js');
const zoneSrc      = read('_client/src/game/zone.js');
const bootSrc      = read('_client/src/game/game-boot.js');

console.log('\n1) ryukzak.js — бирка/иконка/число тушёнки: вниз 40px, влево 20px');
{
    assert(/tushenkaTagSpr\.x = 774 - 20; tushenkaTagSpr\.y = 558 \+ 40;/.test(ryukzakSrc), 'tushenkaTagSpr — -20x/+40y');
    assert(/tushenkaIconSpr\.x = 831 - 20; tushenkaIconSpr\.y = 599 \+ 40;/.test(ryukzakSrc), 'tushenkaIconSpr — -20x/+40y');
    assert(/tushenkaQtyTxt\.x = 810 - 20; tushenkaQtyTxt\.y = 594 \+ 40;/.test(ryukzakSrc), 'tushenkaQtyTxt — -20x/+40y');
}

console.log('\n2) dvor-blackjack.js — ценник больше не пропадает на время раздачи/свапа');
{
    assert(!/if\(this\._bjPriceSpr\) this\._bjPriceSpr\.visible = false;/.test(bjSrc),
        '_bjPriceSpr.visible больше НИГДЕ принудительно не ставится в false');
    assert(/if\(this\._bjFreeLbl\)  this\._bjFreeLbl\.visible = false;/.test(bjSrc),
        '_bjFreeLbl по-прежнему прячется (это лейбл "БЕСПЛАТНО", не ценник)');
}

console.log('\n3) zone_screen.js — долина: точечная добавка scaleBump 0.004');
{
    assert(/locIdx: 2, scaleBump: 0\.004 \}/.test(zoneScreenSrc), 'LOCATIONS[2] (долина) содержит scaleBump:0.004');
    assert(/const _scaleBump = 1 \+ \(loc\.scaleBump \|\| 0\);/.test(zoneScreenSrc), '_scaleBump вычисляется из loc.scaleBump (по умолчанию 0 для остальных 4 локаций)');
    assert(/spr\.width = CARD_TARGET_W \* _scaleBump; spr\.height = CARD_TARGET_H \* _scaleBump;/.test(zoneScreenSrc),
        'width/height домножаются на _scaleBump');
}

console.log('\n4) interface.js — хитбоксы: expHit -3x, nickHit -1y; up.ava._uDraggable');
{
    assert(/expHit\.x = 95 - 3; expHit\.y = 55;/.test(ifaceSrc), 'expHit.x — доп. -3');
    assert(/nickHit\.x = 146; nickHit\.y = 19 - 1;/.test(ifaceSrc), 'nickHit.y — доп. -1');
    assert(/up\.ava\._uDraggable = true;/.test(topCurSrc), 'up.ava помечен _uDraggable для редактора позиций');
}

console.log('\n5) sidorovich.js — обрезка прозрачных полей (5 пар) + z-order фикс посылки');
{
    const pairs = [
        { files: ['сидорович банка v2.png', 'сидорович банка актив v2.png'] },
        { files: ['сидорович консервы неактив v2.png', 'сидорович консервы актив v2.png'] },
        { files: ['сидорович сухари v2.png', 'сидорович сухари актив v2.png'] },
        { files: ['сидорович посылка v2.png', 'сидорович посылка актив v2.png'] },
        { files: ['сидорович сумка v2.png', 'сидорович сумка актив v2.png'] },
    ];
    for (const { files } of pairs) {
        for (const f of files) {
            assert(sidSrc.includes(`'${f}'`), `sidorovich.js ссылается на обрезанный файл ${f}`);
            assert(fs.existsSync(path.join(root, '_client/development/images/layers/popups/sidorovich', f)),
                `файл реально существует на диске: ${f}`);
        }
    }
    // Компенсация позиций — видимая картинка должна остаться на прежнем месте на экране.
    assert(/konservaIdle\.y = PANEL_Y_SID \+ 251 - 32 \+ 18;/.test(sidSrc), 'консервы — компенсация +18 (обрезан верх)');
    assert(/sigShelf\.y = PANEL_Y_SID \+ 55 - 32 - 6 \+ 43;/.test(sidSrc), 'сухари — компенсация +43 (обрезан верх)');
    assert(/posylkaIdle\.x = 919 \+ 5;/.test(sidSrc), 'посылка — компенсация +5 (обрезан левый край)');
    assert(/sumkaFront\.y = PANEL_Y_SID \+ 111 \+ 151;/.test(sidSrc), 'сумка — компенсация +151 (обрезан верх)');
    // 19.10.2026 (по прямому указанию — "хитбокс ящика нужно убрать"): chestHit удалён целиком,
    // клик по ящику теперь на posylkaIdle.on('pointerdown', ...) — см. oct19-batch-....test.js.
    assert(!/const chestHit = new PIXI\.Graphics/.test(sidSrc), 'chestHit (Graphics) больше не создаётся (19.10.2026)');
}

console.log('\n6) Энергия: кнопка-плюс убрана, попап открывается по клику на текст, новая позиция таймера');
{
    assert(!/proto\._initEnergyBuyBtn = function/.test(energyBuySrc), '_initEnergyBuyBtn удалена целиком');
    assert(!/this\._initEnergyBuyBtn\(\);/.test(panelsSrc), 'interface-panels.js больше не вызывает _initEnergyBuyBtn()');
    assert(/this\.energy_txt\.interactive = true; this\.energy_txt\.buttonMode = true;/.test(ifaceSrc),
        'energy_txt интерактивен');
    assert(/this\.energy_txt\.on\('pointerdown', \(\) => this\._openEnergyPopup\(\)\);/.test(ifaceSrc),
        'клик по energy_txt открывает попап покупки энергии');
    assert(/this\.energy_timer_txt\.x = 665;\s*\n\s*this\.energy_timer_txt\.y = 63;/.test(ifaceSrc),
        'energy_timer_txt — новая позиция x:665,y:63');
    assert(/fontFamily:'Southbank LT', fontSize:18, fill:'#ffffff'/.test(energyBuySrc),
        'цена в попапе энергии — Southbank LT 18px белый (было 16px)');
}

console.log('\n7) svod-achievements.js — иконки bp_50/meta_500: ширина 54px (18.10, третье указание — было 56)');
{
    assert(/_isWideIcon \? 54 : 46;/.test(achSrc),
        'ширина — 54 для bp_50/meta_500, 46 для остальных');
    assert(/c\._iconSpr\.height = 44;/.test(achSrc), 'высота не менялась (44)');
}

console.log('\n8) ryukzak.js — баннер "шанс на шмотку" скрыт по умолчанию (кроме dev-превью), карточки сдвинуты на 140px');
{
    // 18.10.2026 (4-е указание тем же днём — dev-превью должно уметь принудительно показать
    // баннер): HAS_SHMOT_DROP больше не жёсткий false — зависит от mockReward.forceShmotBanner,
    // см. ryukzak-shmot-banner-hover-tooltip-and-dev-preview.test.js для полной проверки.
    assert(/const HAS_SHMOT_DROP = !!\(mockReward && mockReward\.forceShmotBanner\);/.test(ryukzakSrc),
        'HAS_SHMOT_DROP — false по умолчанию, true только для dev-превью с forceShmotBanner');
    assert(/shmotBanner\.visible = HAS_SHMOT_DROP;/.test(ryukzakSrc), 'shmotBanner.visible завязан на HAS_SHMOT_DROP');
    assert(/shmotNameTxt\.visible = HAS_SHMOT_DROP;/.test(ryukzakSrc), 'shmotNameTxt.visible завязан на HAS_SHMOT_DROP');
    assert(/const CARD_X_SHIFT = HAS_SHMOT_DROP \? 0 : 140;/.test(ryukzakSrc), 'CARD_X_SHIFT — 140px, когда баннер скрыт');
    assert(/x:334\+CARD_X_SHIFT,y:203/.test(ryukzakSrc) && /x:288\+CARD_X_SHIFT,y:345/.test(ryukzakSrc),
        'TOP_ROW/BOTTOM_ROW используют CARD_X_SHIFT');
}

console.log('\n9) zone.js._showCpReward — эмблема сухарей вместо сигарет, позиции строк');
{
    // 20.10.2026 (по прямому указанию — качество: "боевка награда сухари.png" лучше, чем
    // "верхний худ иконка сухари.png"): иконка заменена, размер на экране сохранён явными
    // width/height (38×42).
    assert(/cigIcon = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/боевка награда сухари\.png'\)\);/.test(zoneSrc),
        'cigIcon использует более качественный файл "боевка награда сухари.png"');
    assert(/cigIcon\.width = 38; cigIcon\.height = 42;/.test(zoneSrc), 'cigIcon сохраняет прежний размер на экране (38×42) явным width/height');
    assert(!/Texture\.from\('\.\/images\/сиги эмблема\.png'\)/.test(zoneSrc), 'сиги эмблема.png больше нигде не создаётся как текстура');
    assert(!/'сиги эмблема\.png'/.test(bootSrc), 'game-boot.js больше не грузит сиги эмблема.png в прелоаде (неиспользуемый файл)');
    // 19.10.2026 (по прямому указанию, редактор позиций — новые координаты для опыта/сухарей,
    // шаг между рядами пересчитан): ROW_X_SHIFT/cigY/respY по старой формуле заменены —
    // см. oct19-batch-....test.js за полным покрытием текущих координат.
    assert(/const ROW_TEXT_X = 15, ROW_ICON_X = 18;/.test(zoneSrc), 'общий X-столбец текста/иконок — 15/18 (19.10.2026)');
    assert(/const cigY\s*=\s*7;/.test(zoneSrc), 'сухари — cigY=7 (19.10.2026)');
    assert(/const respY = cigY \+ REWARD_ROW_STEP;/.test(zoneSrc), 'уважение — respY = cigY + шаг (19.10.2026)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

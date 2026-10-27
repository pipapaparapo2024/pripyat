/**
 * Test: батч 27.10.2026 (второй за день) — по прямому указанию:
 *  - Старый фейковый экран скиллов (skills.js.open()/_buildWin(), кнопка "АТАКОВАТЬ" наносила
 *    урон мимо реального боя) удалён целиком. Вкладка "Скиллы" в Сводке, кнопка в
 *    bosses-combat.js и _closeSkillsIfOpen() переведены на реальный экран bosses_skills.js
 *    (iface._openBossesSkillsScreen()/_closeBossesSkillsScreen()).
 *  - svod.js: полное закрытие Свода (крестик) сбрасывает currentTab — следующее открытие
 *    снова проходит через выбор дефолтной вкладки, не залипает на последней открытой.
 *  - interface-top-currency.js: тултип точного количества ресурса при наведении на иконки
 *    HUD (тушёнка/рубли/сухари) — функционал, который был и пропал, восстановлен.
 *  - svod-zanachki-wishlist.js: заголовок попапа запроса заначек — ДВЕ разные надписи в
 *    зависимости от режима (свой запрос vs запрос друга), не одна общая.
 *  - ui_kit.js: _ss() (плавная smooth-анимация scale на hover) теперь компенсирует x/y так,
 *    чтобы рост шёл от ГЕОМЕТРИЧЕСКОГО ЦЕНТРА текстуры, а не от anchor(0,0) — реальное
 *    исполнение математики через vm, не просто grep.
 *
 * Run: node tests/oct27-skills-screen-unify-resource-tooltip-ss-center.test.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const svodSrc          = readSrc('_client/src/game/svod.js');
const skillsSrc        = readSrc('_client/src/game/skills.js');
const combatSrc        = readSrc('_client/src/game/bosses/bosses-combat.js');
const devPanelSrc      = readSrc('_client/src/game/shell/overlays/dev_panel.js');
const topCurrencySrc   = readSrc('_client/src/game/interface/interface-top-currency.js');
const wishlistSrc      = readSrc('_client/src/game/svod/svod-zanachki-wishlist.js');
const uiKitSrc         = readSrc('_client/src/game/shell/ui_kit.js');

console.log('\nTest 1: svod.js — вкладка "Скиллы" открывает реальный bosses_skills.js, не фейковый skills.open()');
{
    const start = svodSrc.indexOf("if(key === 'skills'){");
    const end   = svodSrc.indexOf('\n        }', start);
    const body  = svodSrc.slice(start, end);
    assert(/iface\._openBossesSkillsScreen\(\);/.test(body), '_selectMainTab("skills") вызывает iface._openBossesSkillsScreen()');
    assert(!/skills\.open\(\)/.test(body), 'старый skills.open() больше НЕ вызывается из вкладки Сводки');
}

console.log('\nTest 2: svod.js — close() сбрасывает currentTab, следующее открытие возвращается к дефолту');
{
    const start = svodSrc.indexOf('close(){');
    const end   = svodSrc.indexOf('\n}', start);
    const body  = svodSrc.slice(start, end);
    assert(/this\.currentTab = null;/.test(body), 'close() обнуляет currentTab');
}

console.log('\nTest 3: bosses-combat.js — кнопка "Скиллы" и _closeSkillsIfOpen() тоже переведены на bosses_skills.js');
{
    assert(/iface\._openBossesSkillsScreen\(\);\s*\}\);\s*\n\s*this\.win\.addChild\(skillBtn\);/.test(combatSrc),
        'skillBtn (кнопка "⚡ СКИЛЛЫ") открывает iface._openBossesSkillsScreen()');
    assert(!/skills\.open\(\)/.test(combatSrc), 'bosses-combat.js больше нигде не вызывает skills.open()');
    assert(/if\(window\.iface && iface\._skillsWin && iface\._skillsWin\.parent\) iface\._closeBossesSkillsScreen\(\);/.test(combatSrc),
        '_closeSkillsIfOpen() закрывает реальный экран скиллов');
}

console.log('\nTest 4: dev_panel.js — сброс аккаунта обновляет реальный экран скиллов, не мёртвый skills._win');
{
    assert(!/skills\._win && typeof skills\._refresh === 'function'/.test(devPanelSrc),
        'dev_panel.js больше не ссылается на удалённые skills._win/_refresh');
    assert(/iface\._updateBossesSkillsScreen\(\);/.test(devPanelSrc),
        'dev_panel.js обновляет реальный экран (iface._updateBossesSkillsScreen) при сбросе аккаунта');
}

console.log('\nTest 5: skills.js — фейковый экран удалён целиком, реальные методы сохранены');
{
    // Проверяем отсутствие ОПРЕДЕЛЕНИЯ метода (не просто подстроки — пояснительный докблок
    // над id118 в svod.js этой же правки упоминает старые имена текстом истории, это нормально).
    for(const dead of ['open(){', '_buildWin(){', '_buildCard(cx, cy){', '_cardSkillIdx(card){', '_attack(){', '_getAttackDamage(){', '_refresh(){', '_updateCard(card, si, availPts){']){
        assert(!skillsSrc.includes(dead), `skills.js: определение ${dead} удалено`);
    }
    assert(!/this\._win\s*=\s*null/.test(skillsSrc), 'this._win больше не инициализируется в конструкторе');
    for(const alive of ['upgrade(idx, onDone)', 'getFlatBonus(weapon)', 'getCritChance(weapon)', 'getEnergyBonus()', 'getTimeBonus()',
        'beginSession()', 'resetSession()', 'forfeitSession()', 'addFightDamage(dmg)', '_showNoPointsPopup()']){
        assert(skillsSrc.includes(alive), `skills.js: реальный метод ${alive} сохранён (используется bosses_skills.js/weapons.js/bosses-combat.js)`);
    }
}

console.log('\nTest 6: interface-top-currency.js — тултип точного количества ресурса на hover (тушёнка/рубли/сухари)');
{
    assert(/const _attachResTooltip = \(sprites, getKey\) => \{/.test(topCurrencySrc), '_attachResTooltip() хелпер определён');
    assert(/_attachResTooltip\(\[plateRub, iconRub\], \(\) => 'cigarettes'\);/.test(topCurrencySrc), 'сухари (cigarettes) — тултип подключён');
    assert(/_attachResTooltip\(\[platePrimary, iconPrimary\], \(\) => this\._topCurPinned\);/.test(topCurrencySrc), 'закреплённая строка — тултип подключён (тип берётся динамически по this._topCurPinned)');
    assert(/_attachResTooltip\(\[plateSecondary, iconSecondary\], \(\) => otherKey\(this\._topCurPinned\)\);/.test(topCurrencySrc), 'раскрытая строка — тултип подключён (тип — противоположный закреплённому)');
}

console.log('\nTest 7: interface.js — тултип опыта сдвинут вправо на 50px');
{
    const ifaceSrc = readSrc('_client/src/game/interface.js');
    assert(/const _tipRawX = expHit\.x \+ \(this\.up\.x \|\| 0\) \+ 15;/.test(ifaceSrc), 'тултип опыта: -35 → +15 (сдвиг +50)');
}

console.log('\nTest 8: svod-zanachki-wishlist.js — заголовок попапа различается по режиму (свой запрос vs запрос друга)');
{
    assert(/const TITLE_OWN_IMG = 'заначки окно запроса заголовок твой запрос\.png';/.test(wishlistSrc), 'TITLE_OWN_IMG — файл "твой запрос"');
    assert(/const TITLE_FRIEND_IMG = 'заначки окно запроса заголовок запрос друга\.png';/.test(wishlistSrc), 'TITLE_FRIEND_IMG — файл "запрос друга"');
    assert(/mode === 'friend' \? TITLE_FRIEND_IMG : TITLE_OWN_IMG/.test(wishlistSrc), 'текстура заголовка выбирается по режиму попапа');
}

console.log('\nTest 9: ui_kit.js — _ss() реально компенсирует x/y, рост идёт от центра текстуры (anchor 0,0), для anchor(0.5,0.5) компенсация нулевая');
{
    // Реальное исполнение _ss() через vm с минимальным PIXI-стабом — проверяем саму математику,
    // не просто наличие кода (см. AGENTS.md "Реальное исполнение PHP/JS в тестах").
    // vm-контекст не резолвит ES-модули — убираем export (attachUiKit здесь не вызывается).
    let src = uiKitSrc.replace('export function attachUiKit', 'function attachUiKit');
    // window._ss/window._sa/эмиттер-патч — весь файл написан через window.* присваивания,
    // достаточно прогнать как есть в контексте с заглушкой window/PIXI.
    const ctx = {
        window: {},
        PIXI: { utils: { EventEmitter: { prototype: { on(){}, } } } },
        requestAnimationFrame: (fn) => { ctx._pendingRaf = fn; return 1; },
        cancelAnimationFrame: () => {},
        console,
    };
    ctx.window = ctx; // window.* === глобальный контекст для простоты (window._ss всплывёт в ctx._ss)
    vm.createContext(ctx);
    try { vm.runInContext(src, ctx); } catch(e){ assert(false, 'ui_kit.js исполнился без ошибок: ' + e.message); }

    function makeSprite(anchorX){
        const spr = { x: 100, y: 100, scale: { x: 1, set(v){ spr.scale.x = v; } }, width: 40, height: 40 };
        if(anchorX !== undefined) spr.anchor = { x: anchorX, y: anchorX };
        return spr;
    }

    // Спрайт с anchor(0,0) (дефолт PIXI.Sprite) — компенсация ДОЛЖНА сдвинуть x/y влево-вверх,
    // когда scale растёт (иначе рост идёт от верхнего левого угла, а не от центра).
    const sprDefault = makeSprite();
    ctx._ss(sprDefault, 1.2, 1); // speed=1 — сразу допрыгивает до target за 1 шаг (d=0.2, |d|<0.002 ложно? нет — цикл идёт через RAF)
    // Не дожидаться RAF — прогоняем шаги вручную, т.к. requestAnimationFrame застаблен.
    for(let i = 0; i < 50 && ctx._pendingRaf; i++){ const fn = ctx._pendingRaf; ctx._pendingRaf = null; fn(); }
    assert(Math.abs(sprDefault.scale.x - 1.2) < 0.01, '_ss() довёл scale.x до цели (anchor 0,0), получено ' + sprDefault.scale.x);
    assert(sprDefault.x < 100, '_ss() сдвинул x ВЛЕВО при росте scale у anchor(0,0)-спрайта (иначе рост не от центра), x=' + sprDefault.x);
    assert(sprDefault.y < 100, '_ss() сдвинул y ВВЕРХ при росте scale у anchor(0,0)-спрайта, y=' + sprDefault.y);

    // Спрайт с anchor(0.5,0.5) — УЖЕ центрирован, компенсация должна быть НУЛЕВОЙ (x/y не трогать).
    const sprCentered = makeSprite(0.5);
    ctx._ss(sprCentered, 1.2, 1);
    for(let i = 0; i < 50 && ctx._pendingRaf; i++){ const fn = ctx._pendingRaf; ctx._pendingRaf = null; fn(); }
    assert(Math.abs(sprCentered.scale.x - 1.2) < 0.01, '_ss() довёл scale.x до цели (anchor 0.5,0.5), получено ' + sprCentered.scale.x);
    assert(sprCentered.x === 100 && sprCentered.y === 100, '_ss() НЕ трогает x/y у уже центрированного (anchor 0.5,0.5) спрайта — нулевая компенсация, x=' + sprCentered.x + ' y=' + sprCentered.y);
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

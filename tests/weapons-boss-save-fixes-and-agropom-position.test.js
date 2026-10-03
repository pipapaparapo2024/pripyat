/**
 * Test: батч 19.09.2026 (по прямому указанию) —
 *
 *  1) Репорт "оружие/патроны не сохраняются": dev-панель выдавала weapons/ammo_* через обычный
 *     users.save() — но $monotonicFields/$jsonBlobGuards в users.php НАМЕРЕННО отклоняют РОСТ
 *     этих полей этим путём (тот же анти-чит, что закрывает дыру для игроков, аудит
 *     17.09.2026 — подтверждено живыми записями в php_errors.log именно с этого аккаунта).
 *     Новый узкий permit users.devGrantWeapons (по образцу resetSession — пишет только
 *     weapons/ammo_* и только для своего uid, в обход whitelist-санитайзеров) + клиентский
 *     _pushWeaponsGrant(), используемый кнопками +патроны/КУПИТЬ/МИЛЛИОН ВСЕГО.
 *  2) Репорт "не сохраняются данные боевки босса/скиллы": bosses-combat.js._onFightTimeout и
 *     bosses_fight.js._forfeitBossFight обновляли udata['bosses_data'] только В ПАМЯТИ,
 *     полагаясь на общий 500мс-дебаунс (player-save.js) — если игрок закрывал приложение
 *     быстрее, HP/таймер/урон терялись. Добавлен немедленный flushPlayerSave() сразу после
 *     _saveToUdata() в обоих местах (тот же приём, что уже был у skills.forfeitSession()).
 *  3) Картинка 1: карточка локации "Агропром" на экране Зоны сдвинута/уменьшена индивидуально
 *     через редактор позиций (x=673,y=488,scale=0.700) — добавлена per-card поддержка
 *     xOverride/yOverride/scaleOverride в zone_screen.js, не затрагивающая остальные 4 карточки.
 *
 * Run: node tests/weapons-boss-save-fixes-and-agropom-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersPhp    = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const devSrc       = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
const combatSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const fightSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const zoneScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'zone_screen.js'), 'utf-8');

console.log('\nTest 1: users.php — новый permit devGrantWeapons, пишет weapons/ammo_* в обход санитайзеров, только для своего uid');
{
    // 22.09.2026: 'setDevFlag' добавлен в тот же массив следом (users.setDevFlag, см.
    // yashik-lost-stash-and-dev-force-drops.test.js) — проверяем только наличие
    // devGrantWeapons в permits, не точный литерал всего массива (иначе тест ломается при
    // каждом добавлении нового permit, не относящегося к этой фиче).
    const permitsMatch = usersPhp.match(/\$this->permits = \[([^\]]*)\];/);
    assert(!!permitsMatch && /'devGrantWeapons'/.test(permitsMatch[1]),
        "'devGrantWeapons' присутствует в permits Users");
    const start = usersPhp.indexOf('function devGrantWeapons(){');
    const end   = usersPhp.indexOf('\n        }', usersPhp.indexOf("\$this->registry['tools']->output(['ok' => 1]);", start));
    assert(start !== -1, 'devGrantWeapons() найден');
    const body = usersPhp.slice(start, end);
    assert(/\$update = \['id' => \$this->registry\['uid'\]\];/.test(body), 'пишет по СВОЕМУ uid из registry (не из параметров запроса)');
    assert(/if\(\$weaponsJson !== null\) \$update\['weapons'\] = \$weaponsJson;/.test(body), 'принимает weapons_json напрямую');
    assert(/foreach\(\['ammo_auto', 'ammo_gun', 'ammo_machete'\] as \$key\)/.test(body), 'принимает все 3 поля патронов');
    assert(/\$this->registry\['udb'\]->saveData\(\$this->registry\['utb'\], \$update\);/.test(body),
        'использует прямой saveData (в обход $allowed/$monotonicFields/$jsonBlobGuards из save())');
}

console.log('\nTest 2: dev_panel.js — кнопки оружия/патронов и МИЛЛИОН ВСЕГО зовут devGrantWeapons вместо (только) обычного users.save');
{
    // 23.09.2026 (баг "оружие куплено с 1М патронов, но атака отвечает 'не куплено'", по прямому
    // указанию): _pushWeaponsGrant теперь принимает afterCb и отменяет отложенный
    // saveDevChanges() — устраняет гонку с параллельным users.save(), см.
    // dev-panel-weapons-grant-no-save-race.test.js для полного покрытия.
    assert(/proto\._pushWeaponsGrant = function\(afterCb\)\{/.test(devSrc), '_pushWeaponsGrant(afterCb) найден');
    const m = devSrc.match(/proto\._pushWeaponsGrant = function\(afterCb\)\{([\s\S]*?)\n    \};/);
    const body = m ? m[1] : '';
    assert(/clearTimeout\(saveTimer\);/.test(body), '_pushWeaponsGrant отменяет отложенный debounced saveDevChanges() перед запросом (устраняет гонку)');
    assert(/TS\.php\('users\.devGrantWeapons'/.test(body), '_pushWeaponsGrant зовёт users.devGrantWeapons');
    assert(/weapons_json:\s*JSON\.stringify\(weapons\.data\.map/.test(body), 'отправляет весь массив оружия целиком (owned/equipped/upg/qty)');
    assert(/ammo_auto:.*weapons\.data\[5\]/.test(body) && /ammo_gun:.*weapons\.data\[4\]/.test(body) && /ammo_machete:.*weapons\.data\[3\]/.test(body),
        'отправляет все 3 поля патронов из актуального weapons.data');

    assert(/this\._pushWeaponsGrant\(\);\s*\n\s*console\.log\('\[devPanel\] оружие/.test(devSrc), '_addAmmo зовёт _pushWeaponsGrant()');
    assert(/this\._pushWeaponsGrant\(\);\s*\n\s*console\.log\('\[devPanel\] куплено оружие/.test(devSrc), '_buy (оружие) зовёт _pushWeaponsGrant()');
    const millionMatch = devSrc.match(/proto\._giveMillion = function\(\)\{([\s\S]*?)\n    \};/);
    const millionBody = millionMatch ? millionMatch[1] : '';
    // Раньше users.save() и _pushWeaponsGrant() улетали ПАРАЛЛЕЛЬНО (гонка, см. комментарий у
    // _pushWeaponsGrant в dev_panel.js) — теперь users.save() физически вложен внутрь callback'а.
    assert(/this\._pushWeaponsGrant\(\(\) => \{/.test(millionBody), '_giveMillion зовёт _pushWeaponsGrant() с callback-функцией');
    const grantIdx = millionBody.indexOf('this._pushWeaponsGrant(() => {');
    const saveIdx  = millionBody.indexOf("TS.php('users.save'");
    assert(grantIdx !== -1 && saveIdx !== -1 && saveIdx > grantIdx,
        'КРИТИЧНО: users.save() находится ВНУТРИ callback\'а _pushWeaponsGrant — последовательно, не параллельно');
}

console.log('\nTest 3: bosses-combat.js._onFightTimeout — немедленный flushPlayerSave() сразу после _saveToUdata()');
{
    const start = combatSrc.indexOf('proto._onFightTimeout = function(idx){');
    const end   = combatSrc.indexOf('\n    };', start);
    const body  = combatSrc.slice(start, end);
    const saveIdx  = body.indexOf('this._saveToUdata();');
    const flushIdx = body.indexOf("flushPlayerSave('boss_fight_timeout');");
    assert(saveIdx !== -1 && flushIdx !== -1 && flushIdx > saveIdx,
        '_onFightTimeout вызывает flushPlayerSave() сразу ПОСЛЕ _saveToUdata() (немедленно, не через 500мс-дебаунс)');
}

console.log('\nTest 4: bosses_fight.js._forfeitBossFight — тот же немедленный flush');
{
    const start = fightSrc.indexOf('proto._forfeitBossFight = function(){');
    const end   = fightSrc.indexOf('\n    };', start);
    const body  = fightSrc.slice(start, end);
    const saveIdx  = body.indexOf('bosses._saveToUdata();');
    const flushIdx = body.indexOf("flushPlayerSave('boss_forfeit');");
    assert(saveIdx !== -1 && flushIdx !== -1 && flushIdx > saveIdx,
        '_forfeitBossFight вызывает flushPlayerSave() сразу ПОСЛЕ bosses._saveToUdata()');
}

console.log('\nTest 5: zone_screen.js — индивидуальный override "Агропрома" СНЯТ (21.09.2026, карусель по одной локации)');
{
    // 19.09.2026: Агропром получил xOverride=673/yOverride=488/scaleOverride=0.700, тюнингованные
    // ПОД НИЖНИЙ слот страницы (страницы по 2 локации, верх+низ). 21.09.2026 экран Зоны
    // переведён на карусель по ОДНОЙ локации (см. zone-locations-carousel-slide.test.js) —
    // единственный оставшийся слот геометрически СООТВЕТСТВУЕТ бывшему ВЕРХНЕМУ, поэтому старый
    // override (тюнингованный под другой слот) закономерно снят, а не перенесён как есть —
    // перенос привёл бы к неверной позиции. Карточка временно на общей формуле, как остальные 4;
    // если визуально «поедет» — донастраивается через редактор позиций отдельным шагом.
    // Слова xOverride/yOverride/scaleOverride упоминаются ТЕКСТОМ в объясняющем комментарии
    // (почему override снят) — это ожидаемо, проверяем только исполняемый КОД строкой ниже.
    const codeLines = zoneScreenSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert(!/xOverride/.test(codeLines) && !/yOverride/.test(codeLines) && !/scaleOverride/.test(codeLines),
        'per-location xOverride/yOverride/scaleOverride убраны из исполняемого КОДА zone_screen.js — единственный слот общий для всех 5 локаций');

    const start = zoneScreenSrc.indexOf('const tex = PIXI.Texture.from(loc.file);');
    const end   = zoneScreenSrc.indexOf('// Кнопка ЗАХВАТИТЬ');
    const body  = zoneScreenSrc.slice(start, end);
    assert(/spr\.x = SLOT_CX \+ CARD_OFFSET_X;/.test(body), 'рендер карточки использует общую формулу (без ветвления на override)');
    assert(/spr\.y = SLOT_CY \+ CARD_OFFSET_Y;/.test(body), 'то же для Y');
    // 22.09.2026: единый CARD_SCALE на все 5 локаций обрезал Агропром.png маской карусели
    // (native выше остальных 4) — заменено на per-текстурную нормализацию к CARD_TARGET_H.
    // 22.09.2026 (повторная правка того же дня, по прямому указанию — одинаковый размер всех
    // карточек): нормализация только высоты оставляла разную ширину — теперь width И height
    // фиксированы (CARD_TARGET_W/H).
    assert(/const _applyCardScale = \(\) => \{ spr\.width = CARD_TARGET_W; spr\.height = CARD_TARGET_H; \};/.test(body),
        'масштаб — фиксированные width И height (было: голая CARD_SCALE на все 5, затем только высота)');

    // Агропром по-прежнему в списке локаций — только позиционный override снят, сама локация на месте.
    assert(/file: Z \+ 'Агропром\.png', locIdx: 3/.test(zoneScreenSrc), 'запись "Агропром" по-прежнему присутствует в LOCATIONS (locIdx=3)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: батч 25.09.2026 (по прямому указанию):
 *
 *  1) Рюкзак — очки (ryukzak_points) обнуляются на сервере СРАЗУ после выдачи награды
 *     ("после забора награды должен обнулять уровень до 0, заново копить очки"). Патч
 *     возвращает ryukzak_points, клиент после закрытия попапа награды пересчитывает превью
 *     уровня заново (должен стать 1, т.к. очков 0) и поднимает окно рюкзака обратно поверх
 *     ХУДа (тот же баг z-order, что чинили раньше для другого сценария).
 *
 *  2) Бой с боссом — гонка _attack()/_syncFriendsDamage() могла запустить claimKill() ДВАЖДЫ
 *     почти одновременно ("после убийства попап 'не удалось засчитать', за ним попап
 *     'победа'") — guard-флаг _claimKillPending не даёт второму вызову _onDefeat() запустить
 *     повторный запрос, пока первый ещё не получил ответ.
 *
 *  3) Атмосфера Зоны — "звуки зона 3" (idx=2) плавно набирает громкость 0→1 за 30 секунд
 *     (запрошено явно), остальные 4 трека звучат как раньше, сразу на полной громкости.
 *
 *  4) Рулетка-джекпот "Сектор приз" — Graphics-заглушки (панель/кнопки/9 кубков) заменены на
 *     реальную графику (попап стаканчики.png, кнопки забрать/рискнуть, стаканчики
 *     суперигра/открытый), механика (roulette.claimPrize/openMinigame/pickCup) не менялась.
 *
 * Run: node tests/ryukzak-reset-boss-race-guard-sound-fadein-roulette-art.test.js
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

console.log('\n1а) ryukzak.php.open() — очки обнуляются сразу после начисления награды, попадают в patch');
{
    const src = read('server/core/controllers/ryukzak.php');
    const openStart = src.indexOf('function open(){');
    const body = src.slice(openStart);
    const zeroIdx = body.indexOf("\$user['ryukzak_points'] = 0;");
    const saveIdx = body.indexOf('saveUser($user)');
    assert(zeroIdx !== -1, 'ryukzak_points обнуляется в $user');
    assert(saveIdx !== -1 && zeroIdx < saveIdx, 'обнуление происходит ДО saveUser (та же атомарная запись, что и награда)');
    assert(/patchCurrencies\(\$user, \[[\s\S]*?'ryukzak_points',/.test(body), "'ryukzak_points' входит в список ключей patchCurrencies — клиент увидит 0 сразу");
}

console.log('\n1б) ryukzak.js — клиент пересчитывает превью уровня и поднимает окно после закрытия попапа награды');
{
    const src = read('_client/src/game/shell/overlays/ryukzak.js');
    assert(/this\._showRewardPopup\(rewards, \(\) => \{/.test(src), '_showRewardPopup вызывается с onClose-колбэком (раньше — без него)');
    const cbIdx = src.indexOf('this._showRewardPopup(rewards, () => {');
    // 04.10.2026: было фиксированное окно в 2600 символов — хрупко (сломалось от правки бага
    // "следующая награда визуально не меняется", добавившей ~700 символов кода+коммента внутрь
    // этого же колбэка). До конца callback'а ближайший устойчивый якорь — следующий addChild HUD.
    const cbEndIdx = src.indexOf('if(window.iface){ iface.updateUp(); iface.updateNick(); }', cbIdx);
    const cbChunk = src.slice(cbIdx, cbEndIdx !== -1 ? cbEndIdx : cbIdx + 4000);
    assert(/_ryukzakLevelFromPoints\(pointsAfter\)/.test(cbChunk), 'превью уровня пересчитывается по свежим очкам (0 после сброса)');
    assert(/lvlTxt\.text = 'УРОВЕНЬ РЮКЗАКА : ' \+ resetLevel;/.test(cbChunk), 'текст уровня обновляется на пересчитанный');
    assert(/_renderProgress\(resetLevel\)/.test(cbChunk), 'прогресс-бар тоже пересчитывается');
    assert(/if\(win\.parent\) root\.layer2_mc\.addChild\(win\);/.test(cbChunk),
        'окно рюкзака поднимается обратно поверх ХУДа (restoreHud() внутри _showRewardPopup кладёт ХУД выше)');
}

console.log('\n2) bosses-combat.js — guard от повторного claimKill() при гонке _attack()/_syncFriendsDamage()');
{
    const src = read('_client/src/game/bosses/bosses-combat.js');
    assert(/this\._claimKillPending = this\._claimKillPending \|\| \{\};/.test(src), 'guard-объект инициализирован');
    assert(/if\(this\._claimKillPending\[pendingKey\]\)\{/.test(src), 'повторный вызов _onDefeat при уже летящем запросе выходит рано');
    assert(/this\._claimKillPending\[pendingKey\] = true;/.test(src), 'флаг взводится перед отправкой запроса');
    const successResetCount = (src.match(/this\._claimKillPending\[pendingKey\] = false;/g) || []).length;
    assert(successResetCount === 2, `флаг сбрасывается в ОБОИХ колбэках claimKill (успех и ошибка) — найдено сбросов: ${successResetCount}`);
}

console.log('\n3) zone-ambient.js — "звуки зона 3" (idx=2) плавно набирает громкость за 30с, остальные — как раньше');
{
    const src = read('_client/src/game/shell/overlays/zone-ambient.js');
    assert(/const FADE_IN_TRACK_IDX = 2;/.test(src), 'индекс трека с нарастанием — 2 (звуки зона 3, третий в списке)');
    assert(/const FADE_IN_DURATION_MS = 30000;/.test(src), 'длительность нарастания — 30 секунд, как запрошено');
    assert(/const isFadeIn = idx === FADE_IN_TRACK_IDX;/.test(src), 'нарастание применяется только к этому конкретному треку');
    assert(/volume: isFadeIn \? 0\.001 : 1,/.test(src), 'остальные треки стартуют на полной громкости, как и раньше');
    assert(/requestAnimationFrame\(_rampStep\);/.test(src), 'громкость анимируется через rAF (тот же паттерн, что _sa/_ss в ui_kit.js)');
}

console.log('\n4) dvor-roulette-minigame.js — реальная графика вместо Graphics-заглушек, механика не изменилась');
{
    const src = read('_client/src/game/dvor/dvor-roulette-minigame.js');
    assert(!/_makeBtn/.test(src), 'неиспользуемый Graphics-хелпер _makeBtn убран целиком');
    assert(/PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/попап стаканчики\.png'\)\)/.test(src), 'попап "Сектор приз" — реальная картинка');
    assert(/panel\.x = 231; panel\.y = 83;/.test(src), 'позиция попапа снята редактором позиций');
    assert(/PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/стаканчики кнопка забрать\.png'\)\)/.test(src), 'кнопка ЗАБРАТЬ — реальная картинка');
    assert(/takeBtn\.x = 423; takeBtn\.y = 487;/.test(src), 'позиция кнопки ЗАБРАТЬ снята редактором позиций');
    assert(/PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/стаканчики кнопка рискнуть\.png'\)\)/.test(src), 'кнопка РИСКНУТЬ — реальная картинка');
    assert(/riskBtn\.x = 714; riskBtn\.y = 488;/.test(src), 'позиция кнопки РИСКНУТЬ снята редактором позиций');
    // 10.10.2026 (устаревший пин, по прямому указанию "когда стаканчик открывается, не заменяй
    // его на другой файл"): "открытый" спрайт убран из src целиком — closedSpr теперь остаётся
    // единственным файлом и на раскрытом состоянии (просто повёрнутым/поднятым gsap-анимацией,
    // см. tests/roulette-minigame-cup-flip-and-ball.test.js). Файл на диске не удалён (просто
    // не используется), поэтому секция 5 ниже (проверка существования файлов) не трогалась.
    assert(/'\.\/images\/стаканчик суперигра\.png'/.test(src) && !/Texture\.from\('\.\/images\/стаканчик открытый суперигра\.png'\)/.test(src),
        '9 кубков в мини-игре используют закрытый файл стаканчика; "открытый" больше не грузится как текстура');
    assert(/TS\.php\('roulette\.claimPrize', \{\}/.test(src), 'ЗАБРАТЬ по-прежнему зовёт roulette.claimPrize (механика не тронута)');
    assert(/TS\.php\('roulette\.openMinigame', \{\}/.test(src), 'РИСКНУТЬ по-прежнему зовёт roulette.openMinigame (механика не тронута)');
    assert(/TS\.php\('roulette\.pickCup', \{idx:i\}/.test(src), 'выбор кубка по-прежнему зовёт roulette.pickCup (механика не тронута)');
}

console.log('\n5) Все 5 новых ассетов скопированы в _client/development/images/');
{
    const files = [
        'попап стаканчики.png',
        'стаканчик открытый суперигра.png',
        'стаканчик суперигра.png',
        'стаканчики кнопка забрать.png',
        'стаканчики кнопка рискнуть.png',
    ];
    files.forEach(f => {
        assert(fs.existsSync(path.join(root, '_client', 'development', 'images', f)), `файл существует: ${f}`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

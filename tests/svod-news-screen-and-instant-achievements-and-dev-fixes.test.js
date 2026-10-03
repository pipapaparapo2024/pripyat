/**
 * Test: батч 19.09.2026 (по прямому указанию) —
 *
 *  1) Экран «Новости» получил настоящий фон (задний фон новости.png, 851×546 — ровно
 *     PANEL_W×PANEL_H) вместо серой Graphics-заглушки, плюс два тизера (ящик/Скряга),
 *     вставленных в нативном размере — позиции приблизительные, пользователь донастроит сам.
 *  2) Репорт "достижения показываются кучкой после какого-то действия, а не сразу": найден
 *     реальный пробел — login_streak считается в preloader.js ДО готовности игрового экрана и
 *     не имеет НИ ОДНОГО собственного вызывающего действия в игре (в отличие от урона/покупок/
 *     боссов и т.д., у каждого из которых есть свой achievements.onXxx() сразу после статы).
 *     Добавлена стартовая проверка achievements._checkAll() в первой безопасной точке после
 *     загрузки (module_control.js.constructShmot — та же точка, где уже подтверждено, что
 *     home/UI готовы, см. комментарий у home.updateClothes() рядом).
 *  3) Кнопка "МИЛЛИОН ВСЕГО" в dev-панели была сломана (звала window.GIVE_MILLION(), которая
 *     не определена, пока window.debug_mode!==true — намеренный барьер Аудита безопасности
 *     17.09.2026, отключающий её для всех обычных игроков). Логика продублирована как
 *     dev_panel.js.proto._giveMillion() — работает из кнопки, но НЕ открывает обратно
 *     консольный доступ (window.GIVE_MILLION по-прежнему не определён для игрока).
 *  4) Dev-панель перекрывалась верхним HUD, хотя предыдущая правка (18.09.2026) уже пыталась
 *     держать devWin верхним внутри layer2_mc — этого было недостаточно, если HUD физически
 *     оказывался ПОСЛЕ devWin в layer2_mc (многие экраны сами делают
 *     root.layer2_mc.addChild(iface.up/down) при открытии). Теперь тикер САМ каждый кадр
 *     сначала подтягивает HUD в layer2_mc, затем devWin поверх него.
 *
 * Run: node tests/svod-news-screen-and-instant-achievements-and-dev-fixes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const newsSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-news.js'), 'utf-8');
const mcSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'module_control.js'), 'utf-8');
const devSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
const IMAGES_DIR = path.join(root, '_client', 'development', 'images');

console.log('\nTest 1: экран "Новости" — настоящий фон вместо Graphics-заглушки; тизеры ящик/Скряга УБРАНЫ (21.09.2026)');
{
    assert(fs.existsSync(path.join(IMAGES_DIR, 'задний фон новости.png')), 'файл фона существует');
    const bgFile = path.join(IMAGES_DIR, 'задний фон новости.png');
    const buf = fs.readFileSync(bgFile);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert(w === 851 && h === 546, `фон новостей — ровно PANEL_W×PANEL_H (851×546), получили ${w}x${h}`);

    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'задний фон новости\.png'\)\);/.test(newsSrc),
        '_buildNewsPanel создаёт bg из настоящего файла (не Graphics-заглушку)');
    assert(!/bg\.beginFill\(0x1a1410/.test(newsSrc), 'старая серая Graphics-заглушка убрана');
    assert(!/Новостей пока нет/.test(newsSrc), 'текст-заглушка "Новостей пока нет" убран вместе со старым фоном');
    // Проверяем только исполняемый код (после закрытия doc-комментария) — в самом комментарии
    // имена файлов упоминаются текстом как объяснение, что и почему убрано, это ожидаемо.
    const codeOnly = newsSrc.slice(newsSrc.indexOf('*/') + 2);
    assert(!/новости ящик\.png/.test(codeOnly), 'тизер "ящик" убран из исполняемого кода (по прямому указанию 21.09.2026)');
    assert(!/новости скряга\.png/.test(codeOnly), 'тизер "скряга" убран из исполняемого кода — Скряга ещё BETA_LOCKED, анонсировать рано');
    assert(!/teaserBox|teaserSkryaga/.test(codeOnly), 'переменные обоих тизеров полностью удалены, не просто закомментированы');
}

console.log('\nTest 2: достижения проверяются СРАЗУ после загрузки (login_streak и подобные статы без своего триггера)');
{
    const start = mcSrc.indexOf('constructShmot(){');
    const end   = mcSrc.indexOf('\n\t}', start);
    const body  = mcSrc.slice(start, end);
    assert(/if\(window\.achievements\) achievements\._checkAll\(\);/.test(body),
        'constructShmot() (первая безопасная точка после загрузки — home/UI уже готовы) вызывает achievements._checkAll()');
}

console.log('\nTest 3: dev-панель — кнопка МИЛЛИОН ВСЕГО работает через собственный метод, не через window.GIVE_MILLION');
{
    assert(/const million = _btn\('МИЛЛИОН ВСЕГО', 0x1a3a7a, \(\) => this\._giveMillion\(\)\);/.test(devSrc),
        "кнопка вызывает this._giveMillion(), не window.GIVE_MILLION()");
    const m = devSrc.match(/proto\._giveMillion = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_giveMillion найден');
    const body = m ? m[1] : '';
    // 29.09.2026: coins/stew/cigarettes больше не client-writable (см.
    // tests/currency-whitelist-removed-devgrant-endpoint.test.js) — _giveMillion больше не
    // пишет их напрямую в udata, а считает дельту до 1000000 и шлёт через devGrantCurrency().
    // Остальные поля (exp и т.п.) по-прежнему выставляются напрямую — этот путь не менялся.
    assert(/currencyDeltas\[key\]\s*=\s*delta;/.test(body) && /udata\['exp'\]\s*=\s*M;/.test(body),
        '_giveMillion считает дельту валют и выставляет остальные поля напрямую');
    assert(/_grantCurrencyServer\(currencyDeltas,/.test(body),
        '_giveMillion применяет валютные дельты через devGrantCurrency (_grantCurrencyServer)');
    assert(/TS\.php\('users\.save', \{udata_json: JSON\.stringify\(udata\)\}/.test(body), '_giveMillion сохраняет результат на сервере');
    // window.GIVE_MILLION упоминается только в поясняющем комментарии (почему решили не трогать
    // debug_mode) — сам вызов кнопки (проверен строкой выше) на него больше не завязан.
    assert(!/window\.GIVE_MILLION\(\)/.test(devSrc), 'нигде в файле НЕТ фактического вызова window.GIVE_MILLION() (не переоткрывает консольный доступ)');
}

console.log('\nTest 4: dev-панель — тикер каждый кадр подтягивает HUD в layer2_mc ПЕРЕД собой (не только себя)');
{
    const start = devSrc.indexOf('this._devWinTickerFn = () => {');
    const end   = devSrc.indexOf('PIXI.Ticker.shared.add(this._devWinTickerFn);');
    const body  = devSrc.slice(start, end);
    assert(/if\(iface\.up\)   root\.layer2_mc\.addChild\(iface\.up\);/.test(body), 'тикер подтягивает iface.up в layer2_mc каждый кадр');
    assert(/if\(iface\.down\) root\.layer2_mc\.addChild\(iface\.down\);/.test(body), 'тикер подтягивает iface.down в layer2_mc каждый кадр');
    const hudIdx = body.indexOf('root.layer2_mc.addChild(iface.up)');
    const devIdx = body.indexOf('this._devWin.parent.addChild(this._devWin);');
    assert(hudIdx !== -1 && devIdx !== -1 && hudIdx < devIdx,
        'HUD подтягивается ПЕРЕД повторным addChild(devWin) — devWin гарантированно оказывается последним (топовым) каждый кадр');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

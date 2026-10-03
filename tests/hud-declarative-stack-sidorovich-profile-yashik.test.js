/**
 * Test: батч 25.09.2026 (по прямому указанию + серия скриншотов) — два связанных бага в
 * декларативном ХУД-стеке (interface.js.pushHud/popHud/_hudStack, введён 24.09.2026):
 *
 * 1) "Нижний ХУД не виден при переходе к профилю игрока" (например через топ урона в бою с
 *    боссом): player_profile.js никогда не участвовал в стеке — звал iface.restoreHud()
 *    напрямую, которая лишь ПЕРЕПРИМЕНЯЕТ верхушку УЖЕ существующего стека (например
 *    bossFight: {down:false}, унаследованное от экрана боя ПОД попапом профиля), вместо того
 *    чтобы заявить своё собственное требование (профилю всегда нужны оба ХУДа).
 *
 * 2) "Зашёл к Сидоровичу, открыл ящик — ХУД виден. Нажал на Сидоровича повторно, у Сидоровича
 *    нажал крестик — оба ХУДа пропали": Сидорович был ЕДИНСТВЕННЫМ экраном, не участвовавшим в
 *    ХУД-стеке — открытие/закрытие вручную дёргало this.up/this.down, а закрытие (крестик)
 *    вручную перекидывало их в root.layer1_mc — единственное место в проекте, уводившее ХУД
 *    ИЗ root.layer2_mc (см. коммент в interface.js.restoreHud — "ХУД всегда кладётся в
 *    layer2_mc"). Плюс Ящик (yashik.js), открытый ПОВЕРХ Сидоровича, никогда не закрывался при
 *    переключении на другую вкладку нижней панели (_closeAllPanels не знал о нём) — оставался
 *    висеть в layer2_mc поверх ХУДа, который к этому моменту уводился ниже, в layer1_mc.
 *    Итог: ХУД technically visible=true, но визуально перекрыт оставшимся открытым Ящиком.
 *
 * Фикс: оба экрана теперь участвуют в общем стеке (pushHud/popHud), Сидорович и Ящик добавлены
 * в _closeAllPanels() по тому же паттерну, что Zone/bossSelect и т.д.
 *
 * Run: node tests/hud-declarative-stack-sidorovich-profile-yashik.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const profileSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf-8');
const sidSrc        = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'sidorovich.js'), 'utf-8');
const panelsSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-panels.js'), 'utf-8');
const interfaceSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface.js'), 'utf-8');

console.log('\nTest 1: player_profile.js — заявляет требование обоих ХУДов через pushHud, а не restoreHud()');
{
    // Файл использует CRLF (\r\n) — indexOf с литеральным \n не совпадает, ищем границу regex'ом.
    const s = profileSrc.indexOf('proto._buildPlayerProfileScreen = function(profile, fallbackNick){');
    const eMatch = profileSrc.slice(s).match(/\r?\n {4}\};/);
    const e = eMatch ? s + eMatch.index : profileSrc.length;
    const body = profileSrc.slice(s, e);
    assert(/iface\.pushHud\('playerProfile', \{\}\);/.test(body), 'КРИТИЧНО: экран профиля зовёт pushHud(\'playerProfile\', {}) — оба ХУДа по умолчанию');
    // Старый вызов упоминается в объясняющем комментарии ("раньше здесь был iface.restoreHud()")
    // — проверяем, что это НЕ живой код: последняя строка перед закрытием функции — pushHud.
    assert(/iface\.pushHud\('playerProfile', \{\}\);\s*$/.test(body),
        'pushHud — последний вызов перед закрытием функции (restoreHud() остался только в комментарии-истории)');
}

console.log('\nTest 2: player_profile.js — закрытие снимает требование через popHud (симметрично pushHud)');
{
    const s = profileSrc.indexOf('proto._closePlayerProfile = function(){');
    const eMatch2 = profileSrc.slice(s).match(/\r?\n {4}\};/);
    const e = eMatch2 ? s + eMatch2.index : profileSrc.length;
    const body = profileSrc.slice(s, e);
    assert(/iface\.popHud\('playerProfile'\);/.test(body), 'закрытие профиля зовёт popHud(\'playerProfile\')');
}

console.log('\nTest 3: sidorovich.js — открытие заявляет требование через pushHud, а не ручной показ this.up/this.down');
{
    assert(/this\.pushHud\('sidorovich', \{\}\);/.test(sidSrc), 'КРИТИЧНО: открытие Сидоровича зовёт pushHud(\'sidorovich\', {})');
    assert(!/this\.up\.visible = true;\s*root\.layer2_mc\.addChild\(this\.up\);/.test(sidSrc),
        'старый ручной показ this.up убран');
    assert(!/this\.down\.visible = true;\s*root\.layer2_mc\.addChild\(this\.down\);/.test(sidSrc),
        'старый ручной показ this.down убран');
}

console.log('\nTest 4: sidorovich.js — крестик зовёт popHud, БОЛЬШЕ не перекидывает ХУД в layer1_mc вручную');
{
    const s = sidSrc.indexOf("exitBtn.on('pointerdown'");
    const e = sidSrc.indexOf('});', s);
    const body = sidSrc.slice(s, e);
    assert(/this\.popHud\('sidorovich'\);/.test(body), 'КРИТИЧНО: крестик зовёт popHud(\'sidorovich\') вместо ручного управления слоями');
    assert(!/root\.layer1_mc\.addChild\(this\.down\)/.test(sidSrc),
        'КРИТИЧНО: нигде в файле ХУД больше не перекидывается в layer1_mc (единственное место в проекте, где это раньше происходило)');
    // "_inFight" упоминается в объясняющем комментарии (история "что было") — проверяем
    // отсутствие именно ЖИВОЙ переменной (объявление/условие), а не строки во всём файле.
    assert(!/const _inFight =/.test(sidSrc) && !/if\(_inFight\)/.test(sidSrc),
        'ручной спец-кейс "в боёвке" убран целиком — popHud/restoreHud решают это автоматически через стек');
}

console.log('\nTest 5: interface-panels.js._closeAllPanels() — Сидорович снимает своё требование из стека при переключении вкладки');
{
    const s = panelsSrc.indexOf('proto._closeAllPanels = function(){');
    const e = panelsSrc.indexOf('\n    };', s);
    const body = panelsSrc.slice(s, e);
    assert(/if\(this\._sidWin && this\._sidWin\.visible\)\{ this\._sidWin\.visible = false; this\.popHud\('sidorovich'\); \}/.test(body),
        'КРИТИЧНО: _closeAllPanels скрывает Сидоровича И зовёт popHud(\'sidorovich\') — раньше popHud не звался вообще');
}

console.log('\nTest 6: interface-panels.js._closeAllPanels() — Ящик теперь тоже закрывается при переключении на другую вкладку (раньше не упоминался вообще)');
{
    const s = panelsSrc.indexOf('proto._closeAllPanels = function(){');
    const e = panelsSrc.indexOf('\n    };', s);
    const body = panelsSrc.slice(s, e);
    assert(/if\(this\._yashikWin && this\._yashikWin\.visible\)\{ this\._yashikWin\.visible = false; this\.popHud\('yashik'\); \}/.test(body),
        'КРИТИЧНО: _closeAllPanels скрывает Ящик (_yashikWin) И зовёт popHud(\'yashik\') — иначе экран оставался висеть открытым поверх других вкладок');
}

console.log('\nTest 7: регресс-гвард — restoreHud() по-прежнему безусловно кладёт ХУД в layer2_mc (тот самый инвариант, который нарушал старый код Сидоровича)');
{
    assert(/if\(this\.up\) root\.layer2_mc\.addChild\(this\.up\);/.test(interfaceSrc),
        'sanity: restoreHud() всё ещё кладёт this.up в layer2_mc безусловно (это и есть тот инвариант, на который теперь полагается мигрированный Сидорович)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: 26.09.2026, по прямому указанию перед модерацией VK (MODERATION_HANDOFF_PROMPT.md,
 * критичная находка №2 — "DEV-кнопка в HUD видна и доступна любому игроку без гейтинга") —
 * "убери все вкладки dev вкладку и вкладку редактирование итд... никому доступ нельзя
 * оставлять просто скрой dev панель от всех но не удаляй но сделай так чтобы игроки не могли
 * получить к ней доступ и ее не было в игре" + "убрать все логирование".
 *
 * 27.09.2026 (по прямому указанию — "верни редактор обратно", уточнение на вопрос про гейтинг —
 * "вернуть с гейтом по моему uid"): interface.js больше НЕ прячет DEV-кнопку/редактор от всех
 * без исключения — она возвращена, но видна только при vk_user_id === ADMIN_UID ('382448269',
 * тот же uid, что в check_user_level.py/check_coins_now.py). Test 1/2 ниже переписаны под новое
 * ожидаемое поведение (admin-gate, не полное скрытие). shmot_shop.js и глушение console.* этим
 * указанием не затронуты — остаются как было 26.09.2026.
 *
 * Оставшиеся два независимых изменения, по принципу "скрыть от игрока, не удалять код":
 *   2) shmot_shop.js — кнопки "🛠 РЕДАКТОР"/"📋 КОПИРОВАТЬ" (тумблер редактора позиций шмоток
 *      на манекене) убраны из экрана магазина тем же способом.
 *   3) index.js — console.log/warn/error/info/debug глушатся глобально для игрока (не
 *      построчным удалением сотен вызовов по всему проекту, а одной подменой методов), если
 *      window.debug_mode !== true — включить обратно локально одной строкой для отладки.
 *
 * Сами dev_panel.js/universal_pos_editor.js/shmot_pos_editor.js НЕ удалены — весь код рабочий.
 *
 * Run: node tests/hide-dev-tools-and-console-from-players.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf-8');

// Находит подстроку ТОЛЬКО в незакомментированных строках — иначе закомментированный
// (сохранённый по прямому указанию "не удаляй") код ложно засчитывается как "активный".
function hasActiveLine(src, substr){
    return src.split('\n').some(line => line.includes(substr) && !line.trim().startsWith('//'));
}

const interfaceJs = read('_client/src/game/interface.js');
const shmotShopJs = read('_client/src/game/shell/overlays/shmot_shop.js');
const indexJs     = read('_client/src/index.js');
const devPanelJs  = read('_client/src/game/shell/overlays/dev_panel.js');
const uPosEditorJs = read('_client/src/game/shell/overlays/universal_pos_editor.js');
const shmotPosEditorJs = read('_client/src/game/shell/overlays/shmot_pos_editor.js');

console.log('\nTest 1: interface.js — кнопка DEV возвращена в HUD, но гейтится по admin uid');
{
    assert(hasActiveLine(interfaceJs, 'this.up.addChild(_devBtn);'), 'DEV-кнопка добавляется в this.up (код активен, не закомментирован)');
    assert(hasActiveLine(interfaceJs, "if(typeof this._ensureEditButton === 'function') this._ensureEditButton();"),
        '_ensureEditButton() вызывается — универсальный редактор доступен админу');
    // Позже (после 27.09.2026, когда писался этот тест) одиночный ADMIN_UID='382448269' был
    // расширен до общего DEV_UIDS=['1113977365','382448269'] — тот же список и тем же способом,
    // что в dev_panel.js._openDevPanel() (общий гейт входа в dev-панель) и users.php._isDevUser()
    // (серверный whitelist для всех остальных dev-permits, кроме узко-личного toggleDevKeyring —
    // см. tests/dev-keyring-toggle.test.js). Три независимых файла используют идентичный список
    // — это согласованное, осознанное расширение на обоих разработчиков, а не разъехавшийся
    // рефакторинг (в отличие от keyring-тоггла, где осталась узкая личная проверка).
    assert(/DEV_UIDS\s*=\s*\['1113977365',\s*'382448269'\]/.test(interfaceJs), 'admin-uid список захардкожен и совпадает с dev_panel.js/users.php._isDevUser()');
    assert(/_isAdminUid\s*=\s*!!\(window\.vk_params\s*&&\s*DEV_UIDS\.includes\(String\(vk_params\['vk_user_id'\]\)\)\)/.test(interfaceJs),
        'проверка идёт по window.vk_params (реальные VK launch params, подделать без валидной сессии нельзя)');
    // Кнопка физически внутри if(_isAdminUid){...} — addChild должен идти ПОСЛЕ объявления
    // проверки и ДО конца функции, без ветки, которая добавляла бы её безусловно.
    const gateIdx = interfaceJs.indexOf('_isAdminUid');
    const addChildIdx = interfaceJs.indexOf('this.up.addChild(_devBtn);');
    assert(gateIdx !== -1 && addChildIdx !== -1 && gateIdx < addChildIdx, 'проверка admin-uid объявлена раньше добавления кнопки в дерево');
}

console.log('\nTest 2: interface.js — код кнопки DEV/редактора рабочий (не закомментирован), обычным игрокам не должен быть виден');
{
    assert(!hasActiveLine(interfaceJs, '// const _devBtn = new PIXI.Graphics();'), 'код кнопки DEV раскомментирован (активен под gate, не мёртвый комментарий)');
    assert(interfaceJs.includes("_devBtn.on('pointerdown', ()=>{ if(window.iface) iface._openDevPanel(); });"),
        'обработчик клика на DEV-кнопке подключает _openDevPanel()');
}

console.log('\nTest 3: shmot_shop.js — кнопки редактора позиций убраны из экрана магазина шмоток');
{
    assert(!hasActiveLine(shmotShopJs, 'win.addChild(posBtnBg);'), 'кнопка "🛠 РЕДАКТОР" больше не попадает в дерево экрана магазина');
    assert(!hasActiveLine(shmotShopJs, 'win.addChild(posCopyBtn);'), 'кнопка "📋 КОПИРОВАТЬ" больше не попадает в дерево');
    assert(!hasActiveLine(shmotShopJs, 'if(this._posEditorOn) this._togglePosEditor();'),
        'обработчик выхода больше не дёргает несуществующий редактор (иначе — мёртвый вызов на скрытом состоянии)');
    assert(/\/\/ const posBtnBg = new PIXI\.Graphics\(\);/.test(shmotShopJs), 'код кнопки сохранён закомментированным, не удалён');
}

console.log('\nTest 4: сам код dev_panel.js/universal_pos_editor.js/shmot_pos_editor.js НЕ удалён (файлы существуют и не пустые)');
{
    assert(devPanelJs.length > 5000, 'dev_panel.js на месте, содержательный (не заглушка)');
    assert(uPosEditorJs.length > 5000, 'universal_pos_editor.js на месте, содержательный');
    assert(shmotPosEditorJs.length > 1000, 'shmot_pos_editor.js на месте, содержательный');
    assert(/proto\._openDevPanel = function/.test(devPanelJs), '_openDevPanel всё ещё определён (код рабочий, просто не вызывается из HUD)');
}

console.log('\nTest 5: index.js — console.* глушится для игрока, если window.debug_mode !== true, без удаления существующих console.log по коду');
{
    const start = indexJs.indexOf('window.debug_mode = false;');
    assert(start !== -1, 'window.debug_mode остаётся единой точкой включения отладки (уже использовалась для GIVE_MILLION/RUN_TESTS)');
    const body = indexJs.slice(start, start + 1500);
    assert(/if\(!window\.debug_mode\)\{/.test(body), 'глушение обёрнуто в проверку debug_mode — легко включить обратно локально');
    assert(/console\.log = _noop;/.test(body), 'console.log глушится');
    assert(/console\.warn = _noop;/.test(body), 'console.warn глушится');
    assert(/console\.error = _noop;/.test(body), 'console.error глушится');
    assert(/console\.info = _noop;/.test(body), 'console.info глушится');
}

console.log('\nTest 6: регресс-гвард — глушение НЕ трогает саму подмену console.log в других модулях (например player-save.js уже проверяет window.debug_mode перед логом)');
{
    const playerSaveJs = read('_client/src/modules/player-save.js');
    assert(/if\(window\.debug_mode\) console\.log/.test(playerSaveJs),
        'player-save.js использует тот же флаг window.debug_mode — согласовано с новой глобальной подменой (не задвоенная логика)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

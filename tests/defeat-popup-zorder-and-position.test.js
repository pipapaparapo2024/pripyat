/**
 * Test: батч 15.09.2026 —
 *  1) bosses-combat.js._onFightTimeout — попап "Поражение! Бой окончен" теперь показывается
 *     ПОСЛЕ закрытия боёвки и открытия списка боссов, а не до. Раньше он добавлялся в
 *     root.layer2_mc ПЕРВЫМ, а следом поверх него добавлялся экран выбора боссов — попап
 *     физически лежал под ним и не был виден, пока игрок сам не закрывал оба экрана
 *     (репорт: "попап появился только когда я вышел из вкладки боевки, а потом и с выбора
 *     боссов").
 *  2) notifications.js._showErrorSprite — новые координаты плашки/кнопки/текста, снятые
 *     пользователем через редактор позиций.
 *
 * Run: node tests/defeat-popup-zorder-and-position.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);
const notifySrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'notifications.js'), 'utf-8'
);

console.log('\nTest 1: _onFightTimeout — попап показывается ПОСЛЕ переоткрытия списка боссов');
{
    const closeIdx  = combatSrc.indexOf("iface._closeBossesFight();");
    const openIdx   = combatSrc.indexOf("iface._openBossesPopup();");
    const notifyIdx = combatSrc.indexOf("notify.showResult({text:'Поражение! Бой окончен, ключи потрачены.'}, 0);");
    assert(closeIdx !== -1 && openIdx !== -1 && notifyIdx !== -1, 'все три вызова найдены в _onFightTimeout');
    assert(closeIdx < notifyIdx && openIdx < notifyIdx,
        'notify.showResult() идёт ПОСЛЕ _closeBossesFight()/_openBossesPopup() (попап добавляется в layer2_mc последним → рисуется сверху)');
}

console.log('\nTest 2: notifications.js — новые координаты попапа ошибки');
{
    assert(/bg\.y = -20;/.test(notifySrc), 'фон попапа (bg) сдвинут на y=-20');
    assert(/bodyTxt\.x = 357; bodyTxt\.y = 335;/.test(notifySrc), 'текст сообщения: x=357 y=335');
    assert(/bodyTxt\.scale\.set\(1\.084\);/.test(notifySrc), 'текст сообщения увеличен scale=1.084');
    assert(/okBtn\.x = 357; okBtn\.y = 442;/.test(notifySrc), 'кнопка "понятно": x=357 y=442');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

/**
 * Test: попап награды (reward.js) скрывает крестик/кнопку выхода экрана под собой на время
 * показа — репорт был с экрана рюкзака (крестик просвечивал сквозь полупрозрачный оверлей
 * попапа), но пользователь явно попросил починить универсально — для ЛЮБОГО экрана, где
 * вызывается попап награды, а не только для рюкзака.
 *
 * Run: node tests/reward-hides-underlying-exit.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'reward.js'), 'utf-8'
);

console.log('\nTest 1: _showRewardPopup прячет "выход.png"/"btn_exit.png" на layer1_mc/layer2_mc');
{
    assert(/_hideUnderlyingExitBtns/.test(src), '_hideUnderlyingExitBtns определена');
    assert(/\/выход\\\.png\|btn_exit\\\.png\/i\.test\(url\)/.test(src),
        'ищет оба варианта имени кнопки выхода (выход.png / btn_exit.png), без учёта регистра');
    assert(/this\._rewardHiddenExitBtns\.push\(child\);/.test(src), 'запоминает скрытые кнопки для отката');
    assert(/if\(root\.layer2_mc\) _hideUnderlyingExitBtns\(root\.layer2_mc\);/.test(src), 'сканирует layer2_mc (попапы)');
    assert(/if\(root\.layer1_mc\) _hideUnderlyingExitBtns\(root\.layer1_mc\);/.test(src), 'сканирует layer1_mc (HUD/экраны)');
}

console.log('\nTest 2: _closePopup возвращает видимость скрытых кнопок обратно');
{
    const m = src.match(/const _closePopup = \(\)=>\{([\s\S]*?)\n\s{8}\};/);
    assert(!!m, '_closePopup найден');
    if (m) {
        const body = m[1];
        assert(/this\._rewardHiddenExitBtns\.forEach\(b => \{ b\.visible = true; \}\);/.test(body),
            'при закрытии попапа кнопки выхода возвращаются в visible=true');
        assert(/this\._rewardHiddenExitBtns = null;/.test(body), 'ссылка на список очищается после отката');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

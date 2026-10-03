/**
 * Test: заначка теперь показывает плавающую иконку "+1" на карте Зоны в момент получения
 * карточки коллекции — тем же визуальным стилем (взлёт+затухание 1.6с), что и существующий
 * _showCpReward() (+XP/+сигареты/+уважение) при закрытии ячейки чекпоинта. Новая картинка:
 * ./images/заначка эмблема.png (папка C:\Users\HONOR\Desktop\vk_game\backpack_100x100.png,
 * 15.09.2026).
 *
 * Run: node tests/stash-pickup-floating-icon.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const zoneSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'zone.js'), 'utf-8');
const iconPath = path.join(__dirname, '..', '_client', 'development', 'images', 'заначка эмблема.png');

console.log('\nTest 1: картинка иконки заначки скопирована в development/images');
{
    assert(fs.existsSync(iconPath), 'файл ./images/заначка эмблема.png существует локально');
    if(fs.existsSync(iconPath)){
        assert(fs.statSync(iconPath).size > 0, 'файл не пустой');
    }
}

console.log('\nTest 2: _showStashPickup() вызывается по ответу сервера при КАЖДОМ дропе нычки');
{
    // 25.09.2026: _tryDropStash (клиентская классификация/награда по типам) удалён целиком —
    // находка нычки теперь целиком решает сервер (zone.php.fillCheckpoint(), 15%-й шанс),
    // клиент просто реагирует на res.stash.dropped флаг в ответе и показывает "+1".
    assert(/if\(res\.stash && res\.stash\.dropped\) this\._showStashPickup\(\);/.test(zoneSrc),
        '_showStashPickup() вызывается сразу при res.stash.dropped из ответа сервера');
    assert(!/_tryDropStash\(locIdx\)\{/.test(zoneSrc), '_tryDropStash (старая клиентская классификация) больше не определён');
}

console.log('\nTest 3: _showStashPickup — та же анимация, что и _showCpReward (взлёт+затухание 1.6с)');
{
    const idx = zoneSrc.indexOf('_showStashPickup(){');
    assert(idx !== -1, '_showStashPickup найден');
    const body = zoneSrc.slice(idx, idx + 1200);
    assert(/Texture\.from\('\.\/images\/заначка эмблема\.png'\)/.test(body), 'использует новую картинку заначка эмблема.png');
    assert(/win\.x = 640; win\.y = 290;/.test(body), 'та же точка появления на экране, что у _showCpReward (640,290)');
    assert(/y: win\.y - 90, alpha: 0, duration: 1\.6/.test(body), 'та же анимация: взлёт на 90px + затухание за 1.6с');
    assert(/root\.layer2_mc\.addChild\(win\);/.test(body), 'добавляется в layer2_mc, как и _showCpReward');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

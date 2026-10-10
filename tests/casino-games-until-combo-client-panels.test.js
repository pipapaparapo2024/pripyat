/**
 * Test: 25.09.2026, по прямому указанию — "хочу видеть сбоку экрана количество игр до
 * комбинации" — клиентская часть (постоянные боковые панели зариков/блэкджека/рулетки,
 * покер БЕЗ панели — уточнено через AskUserQuestion, у покера нет pity).
 *
 * 27.09.2026 (по прямому указанию — "текст шансов до сих пор светится, убери его", уточнено
 * через AskUserQuestion: речь про вкладку Двор, "не шанс, а скорее количество игр до
 * определённой комбинации" — то есть именно про эти 25.09-панели): все 3 панели (зарики/
 * блэкджек/рулетка) убраны из HUD. proto._updateDicePityTxt/_updateBjPityTxt/
 * _updateRoulettePityTxt НЕ удалены (у каждой уже был guard на отсутствие текста) и по-прежнему
 * вызываются после каждого раунда — просто без this._xxxPityTxt они безопасно ничего не делают.
 * Test 1-3 ниже переписаны под новое ожидаемое поведение (панели отсутствуют).
 *
 * Run: node tests/casino-games-until-combo-client-panels.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const diceScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-screen.js'), 'utf-8');
const diceGameSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-dice-game.js'), 'utf-8');
const bjSrc         = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-blackjack.js'), 'utf-8');
const roulScreenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');
const roulSrc       = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8');
const pokerSrcFiles = ['dvor-poker-screen.js', 'dvor-poker-game.js', 'dvor-poker.js'].map(f =>
    fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', f), 'utf-8'));

console.log('\nTest 1: Зарики — панель "До Куша" убрана из HUD; 02.10.2026 (найдено при разборе полного прогона tests/, см. dice-server-authoritative-rng.test.js): pity-гарантия 4×6 целиком убрана из dice.php (dice_session больше не хранит pity/pity_t, resolve() их не считает и не отдаёт) — сервер физически не может прислать res.pity/res.pity_t, поэтому _updateDicePityTxt()/её вызов стали не просто "безопасным no-op", а мёртвым кодом и были удалены целиком, а не оставлены как раньше (27.09.2026) планировалось');
{
    assert(!diceScreenSrc.includes("PIXI.Text('До Куша: 0/0'"), 'текст "До Куша: 0/0" больше не создаётся');
    assert(!/this\._dicePityTxt = pityTxt;/.test(diceScreenSrc), 'this._dicePityTxt больше не присваивается — панели нет в дереве');
    assert(!/proto\._updateDicePityTxt\s*=\s*function/.test(diceScreenSrc), 'proto._updateDicePityTxt() удалена целиком (не просто no-op) — сервер больше не присылает pity/pity_t вообще');

    const resolveStart = diceGameSrc.indexOf('proto._resolveDiceNewScreen = function(){');
    // 28.09.2026: окно расширено 1200→1800 — комментарий про suspendPlayerSave (см. память
    // агента incident_checkall_flush_wipes_server_credits) сдвинул искомую строку за старую
    // границу окна (тот же класс хрупкости, что уже ловили в других тестах проекта).
    const resolveBody = diceGameSrc.slice(resolveStart, resolveStart + 1800);
    assert(!/this\._updateDicePityTxt\(/.test(resolveBody), '_resolveDiceNewScreen больше НЕ вызывает _updateDicePityTxt — вызов удалён вместе с функцией, res.pity/res.pity_t сервер не присылает');
}

console.log('\nTest 2: Блэкджек — панели "До AA/KK/QQ" убраны из HUD, _updateBjPityTxt() осталась (безопасный no-op)');
{
    assert(!bjSrc.includes("PIXI.Text('До AA: 0/0'"), 'текст "До AA: 0/0" больше не создаётся');
    assert(!bjSrc.includes("PIXI.Text('До KK: 0/0'"), 'текст "До KK: 0/0" больше не создаётся');
    assert(!bjSrc.includes("PIXI.Text('До QQ: 0/0'"), 'текст "До QQ: 0/0" больше не создаётся');
    assert(!/this\._bjPityAaTxt = pityAaTxt;/.test(bjSrc), 'this._bjPityAaTxt больше не присваивается');
    assert(!/this\._bjPityKkTxt = pityKkTxt;/.test(bjSrc), 'this._bjPityKkTxt больше не присваивается');
    assert(!/this\._bjPityQqTxt = pityQqTxt;/.test(bjSrc), 'this._bjPityQqTxt больше не присваивается');
    assert(/proto\._updateBjPityTxt = function\(res\)\{/.test(bjSrc), 'proto._updateBjPityTxt() всё ещё определена');

    const resolveStart = bjSrc.indexOf('proto._resolveBlackjack = function(){');
    const resolveBody = bjSrc.slice(resolveStart, resolveStart + 1500);
    assert(/this\._updateBjPityTxt\(res\);/.test(resolveBody), '_resolveBlackjack по-прежнему вызывает _updateBjPityTxt (безвредно, панели нет)');
}

console.log('\nTest 3: Рулетка — панель "До джекпота" убрана из HUD, _updateRoulettePityTxt() осталась (безопасный no-op)');
{
    assert(!roulScreenSrc.includes("PIXI.Text('До джекпота: 0/0'"), 'текст "До джекпота: 0/0" больше не создаётся');
    assert(!/this\._roulPityTxt = pityTxt;/.test(roulScreenSrc), 'this._roulPityTxt больше не присваивается');
    assert(/proto\._updateRoulettePityTxt = function\(res\)\{/.test(roulSrc), 'proto._updateRoulettePityTxt() всё ещё определена');
    assert(/if\(!this\._roulPityTxt \|\| !res\) return;/.test(roulSrc), 'guard на отсутствие this._roulPityTxt на месте — вызовы ниже безопасны');

    const spinStart = roulSrc.indexOf("TS.php('roulette.spin'");
    // 10.10.2026: окно расширено 1100→1400 — новый explain-комментарий про удаление debug
    // (убран console.log(res.debug), см. roulette.php) отодвинул искомый вызов дальше spinStart.
    const spinBody = roulSrc.slice(spinStart, spinStart + 1400);
    assert(/this\._updateRoulettePityTxt\(res\);/.test(spinBody), 'после spin() вызов остался (безвредно, панели нет)');
}

console.log('\nTest 4: Покер — панели НЕТ ни в одном из файлов покера (осознанное решение — у покера нет pity)');
{
    pokerSrcFiles.forEach((src, i) => {
        assert(!/[Pp]ityTxt/.test(src), `dvor-poker-*.js[${i}] не содержит никакой ...PityTxt — панель сознательно не добавлена`);
    });
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

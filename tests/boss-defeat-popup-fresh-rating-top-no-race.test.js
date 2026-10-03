/**
 * Test: батч 24.09.2026 (по прямому указанию + 2 скриншота — "нанёс 200 урона, рейтинг во
 * время боя пустой", "на попапе ПОРАЖЕНИЯ висит 8.2K урона у постороннего при боссе на 1000
 * maxHP, это давно нанесённый урон, который почему-то сохранился").
 *
 * Разбор показал: _showBossResultPopup({isWin:false, ...}) НИКОГДА не получал top от
 * вызывающего кода (bosses-combat.js._onFightTimeout / bosses_fight.js._forfeitBossFight), а
 * boss_result.js применял opts.top ТОЛЬКО при opts.isWin===true — на поражении PIXI-строки
 * панели "УЧАСТНИКИ БОЯ" (переиспользуемые между открытиями попапа) молча показывали то, что
 * осталось с ПРОШЛОГО заполнения (старая победа/дев-тест), а не текущий бой. Плюс отдельная
 * гонка: клиент сбрасывал bossStartMs локально и слал это ОТДЕЛЬНЫМ users.save()
 * (flushPlayerSave) ПАРАЛЛЕЛЬНО с bosses.endFightSession() — если тот сейв долетал до БД
 * раньше, любой последующий расчёт рейтинга видел уже обнулённый bossStartMs и получал
 * пустой/неверный топ.
 *
 * Фикс: bosses.endFightSession() теперь принимает boss_id/diff_idx, считает _ratingTop() ДО
 * сброса bossStartMs и сбрасывает его САМ (единственный писатель для пути "поражение"), клиент
 * оборачивает вызов suspendPlayerSave()/resumePlayerSave() (тот же приём, что уже есть у
 * bosses.attack/claimKill) и передаёт top дальше в попап; boss_result.js применяет opts.top
 * независимо от isWin.
 *
 * Run: node tests/boss-defeat-popup-fresh-rating-top-no-race.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhp   = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
const combatSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const fightSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const resultSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

console.log('\nTest 1: bosses.php.endFightSession() принимает boss_id/diff_idx, считает top ДО сброса bossStartMs, сам его сбрасывает, возвращает top');
{
    const start = bossesPhp.indexOf('function endFightSession(){');
    assert(start !== -1, 'endFightSession найдена');
    const end = bossesPhp.indexOf('\n        }', start);
    const body = bossesPhp.slice(start, end);
    assert(/\$bossId\s*=.*user_params'\]\['boss_id'\]/.test(body), 'читает boss_id из параметров запроса');
    assert(/\$diffIdx\s*=.*user_params'\]\['diff_idx'\]/.test(body), 'читает diff_idx из параметров запроса');
    const topCallIdx = body.indexOf('$this->_ratingTop(');
    const resetIdx = body.indexOf("\$data['bossStartMs'][\$diffIdx][\$bossId] = 0;");
    assert(topCallIdx !== -1, 'вызывает _ratingTop()');
    assert(resetIdx !== -1, 'сбрасывает bossStartMs[diffIdx][bossId] в 0');
    assert(topCallIdx !== -1 && resetIdx !== -1 && topCallIdx < resetIdx,
        'КРИТИЧНО: _ratingTop() считается ДО сброса bossStartMs, не после');
    assert(/'top' => \$top/.test(body), 'ответ содержит поле top');
}

console.log('\nTest 2: bosses-combat.js._onFightTimeout — suspend/resume вокруг endFightSession, передаёт boss_id/diff_idx, прокидывает top в попап');
{
    const m = combatSrc.match(/proto\._onFightTimeout = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_onFightTimeout найдена');
    const body = m ? m[1] : '';
    assert(/suspendPlayerSave\('boss_end_fight_timeout'\);/.test(body), 'вызывает suspendPlayerSave() перед endFightSession');
    assert(/resumePlayerSave\('boss_end_fight_timeout'\);/.test(body), 'вызывает resumePlayerSave() в колбэке(ах)');
    assert(/TS\.php\('bosses\.endFightSession', \{boss_id: idx, diff_idx: diffIdxAtLoss\}/.test(body), 'передаёт boss_id/diff_idx в endFightSession');
    assert(/top: top,/.test(body) || /top: top\s*\}/.test(body), 'передаёт top в _showBossResultPopup');
    assert(/_finishTimeoutUi\(Array\.isArray\(res\.top\) \? res\.top : \[\]\);/.test(body), 'извлекает top из ответа сервера с фолбэком на пустой массив');
}

console.log('\nTest 3: bosses_fight.js._forfeitBossFight — suspend ДО раннего flushPlayerSave, resume сбалансирован во всех ветках');
{
    const m = fightSrc.match(/proto\._forfeitBossFight = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_forfeitBossFight найдена');
    const body = m ? m[1] : '';
    const suspendIdx = body.indexOf("suspendPlayerSave('boss_end_fight_forfeit')");
    // Ищем именно РЕАЛЬНЫЙ вызов (с if-гардом), а не первое текстовое упоминание — объясняющий
    // комментарий над suspendPlayerSave() сам ссылается на эту же строку по имени, и голый
    // indexOf() по подстроке ловил бы это упоминание в комментарии раньше настоящего вызова.
    const earlyFlushIdx = body.indexOf("if(window.flushPlayerSave) flushPlayerSave('boss_forfeit');");
    assert(suspendIdx !== -1, 'вызывает suspendPlayerSave()');
    assert(earlyFlushIdx !== -1, 'ранний flushPlayerSave(\'boss_forfeit\') остался');
    assert(suspendIdx !== -1 && earlyFlushIdx !== -1 && suspendIdx < earlyFlushIdx,
        'КРИТИЧНО: suspendPlayerSave() вызывается ДО раннего flushPlayerSave — иначе именно этот флаш и есть гонка');
    const resumeCount = (body.match(/resumePlayerSave\('boss_end_fight_forfeit'\)/g) || []).length;
    assert(resumeCount === 3, 'resumePlayerSave() вызывается во всех 3 ветках (успех/ошибка/нет TS) — ровно один suspend на функцию, без утечки счётчика');
    assert(/TS\.php\('bosses\.endFightSession', \{boss_id: idx, diff_idx: diffIdx\}/.test(body), 'передаёт boss_id/diff_idx в endFightSession');
    assert(/top: top,/.test(body), 'передаёт top в _showBossResultPopup');
}

console.log('\nTest 4: boss_result.js применяет opts.top независимо от isWin (регресс-гвард на старый баг)');
{
    assert(!/if\(opts\.isWin && Array\.isArray\(opts\.top\)\)/.test(resultSrc),
        'регресс-гвард: старое условие "top применяется только при победе" удалено');
    assert(/if\(Array\.isArray\(opts\.top\)\)\{\s*\n\s*_applyRatingTop\(opts\.top\);/.test(resultSrc),
        'КРИТИЧНО: _applyRatingTop(opts.top) вызывается для ЛЮБОГО исхода боя, если top передан');
    assert(/TS\.php\('bosses\.rating', \{ boss_id: bossIdx, diff_idx: diffIdx \}/.test(resultSrc),
        'фолбэк-запрос bosses.rating() остался на случай, если top вообще не передан');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

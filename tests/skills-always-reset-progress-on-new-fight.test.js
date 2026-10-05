/**
 * Test: батч 22.09.2026 (пять независимых правок одним заходом, по прямому указанию с
 * референс-скриншотами) —
 *
 *  1) index.html: оверлей компаса загрузки (#_clo) был полупрозрачным (rgba(0,0,0,0.75)) —
 *     уже отрисованная PIXI-сцена (iface.init()/home.init() запускаются раньше, чем реально
 *     догрузятся все 16 фоновых модулей, см. game-boot.js._showGame/_finishLoading) была
 *     видна сквозь него, пока прогресс-бар ещё шёл. Теперь оверлей полностью непрозрачен
 *     (background:#000) — сцена не видна вообще, пока не спрячется #_clo.
 *
 *  2) boss_result.js: позиция/размер аватаров "УЧАСТНИКИ БОЯ" (было 67×67 квадрат на x:620/
 *     722/825 y:420, стало 67×71 на x:623.5/725.5/828.5 y:425.5 — снято редактором позиций
 *     на среднем слоте, применено ко всем трём одинаковой дельтой).
 *
 *  3) boss_result.js: подпись урона под аватарами — Y теперь ОДИН общий AVATAR_DMG_Y=470 для
 *     всех трёх (раньше считался от AVATAR_SIZE/2+6, индивидуально), X по-прежнему свой у
 *     каждого слота.
 *
 *  4) boss_result.js: белый HP-текст на портрете босса теперь центрируется ПО ГОРИЗОНТАЛИ
 *     относительно самого портрета (PORTRAIT_W/2=78.5, было хардкод 88 от скана красной
 *     полоски), Y снят редактором позиций (было 181, стало 193).
 *
 *  5) skills.js + bosses.php: прогресс скиллов до следующего очка теперь обнуляется ПОСЛЕ
 *     КАЖДОГО боя БЕЗУСЛОВНО — раньше (17-18.09.2026 дизайн, подтверждённый ранее в этом же
 *     проекте) сброс пропускался, если за попытку был получен хотя бы один новый уровень
 *     скилла (leveled-check). Пользователь явно подтвердил новым запросом, что это больше не
 *     то поведение, которое нужно — теперь ВСЕГДА 0 в начале нового боя, без исключений.
 *
 * Run: node tests/skills-always-reset-progress-on-new-fight.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const indexHtml   = readSrc('_client/development/index.html');
const bossResult  = readSrc('_client/src/game/shell/popups/boss_result.js');
const skillsSrc   = readSrc('_client/src/game/skills.js');
const bossesPhp   = readSrc('server/core/controllers/bosses.php');

console.log('\nTest 1: index.html — оверлей компаса загрузки (#_clo) полностью непрозрачен');
{
    const start = indexHtml.indexOf('<div id="_clo"');
    const end   = indexHtml.indexOf('>', start);
    const tag   = indexHtml.slice(start, end);
    assert(/background:#000/.test(tag), '#_clo — сплошной чёрный фон (background:#000)');
    assert(!/background:rgba\(0,0,0,0\.75\)/.test(tag), 'старая полупрозрачная версия (rgba 0.75) убрана — сцена больше не просвечивает во время загрузки');
}

console.log('\nTest 2: boss_result.js — аватары "УЧАСТНИКИ БОЯ" — новые координаты/размер (67×71, снято редактором позиций)');
{
    assert(/const AVATAR_SLOTS = \[/.test(bossResult), 'AVATAR_SLOTS определён');
    assert(/\{ x: 623\.5, y: 425\.5 \}/.test(bossResult), 'слот 1 — новый центр (623.5, 425.5)');
    assert(/\{ x: 725\.5, y: 425\.5 \}/.test(bossResult), 'слот 2 — новый центр (725.5, 425.5), снят напрямую редактором позиций');
    assert(/\{ x: 828\.5, y: 425\.5 \}/.test(bossResult), 'слот 3 — новый центр (828.5, 425.5)');
    assert(/const AVATAR_W = 67;/.test(bossResult), 'AVATAR_W = 67 (ширина не изменилась)');
    assert(/const AVATAR_H = 71;/.test(bossResult), 'AVATAR_H = 71 (было 67 — теперь прямоугольник, не квадрат)');
    assert(/spr\.width = AVATAR_W; spr\.height = AVATAR_H;/.test(bossResult), 'спрайт аватара использует раздельные W/H');
    assert(/spr\.x = slot\.x - AVATAR_W \/ 2; spr\.y = slot\.y - AVATAR_H \/ 2;/.test(bossResult), 'позиционирование спрайта — от центра слота минус половина своей стороны (раздельно по W/H)');
    assert(!/AVATAR_SIZE/.test(bossResult), 'старая единая константа AVATAR_SIZE больше нигде не используется');
}

console.log('\nTest 3: boss_result.js — подпись урона под аватарами: единый Y для всех трёх слотов (снят редактором позиций)');
{
    assert(/const AVATAR_DMG_Y = 470;/.test(bossResult), 'AVATAR_DMG_Y = 470 — общий для всех трёх подписей');
    const dmgTxtMatch = bossResult.match(/const avatarDmgTxts = AVATAR_SLOTS\.map\(\(slot, i\) => \{([\s\S]*?)\n        \}\);/);
    assert(!!dmgTxtMatch, 'avatarDmgTxts определён');
    const body = dmgTxtMatch ? dmgTxtMatch[1] : '';
    assert(/t\.x = slot\.x; t\.y = AVATAR_DMG_Y;/.test(body), 'x берётся из своего слота (под своим аватаром), y — общий AVATAR_DMG_Y');
}

console.log('\nTest 4: boss_result.js — HP-текст на портрете центрируется по горизонтали относительно самого портрета');
{
    assert(/const PORTRAIT_W = 157;/.test(bossResult), 'PORTRAIT_W = 157 (натуральная ширина файлов BOSS_PORTRAITS)');
    assert(/const HP_BAR_OFFSET = \{ x: PORTRAIT_W \/ 2, y: 193 \};/.test(bossResult),
        'HP_BAR_OFFSET.x вычислен формулой (центр портрета), не хардкод; y снят редактором позиций (было 181, стало 193)');
}

console.log('\nTest 5: skills.js — _endSession() обнуляет прогресс БЕЗУСЛОВНО (leveled-check убран)');
{
    const m = skillsSrc.match(/_endSession\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_endSession найден');
    const body = m ? m[1] : '';
    assert(!/leveled/.test(body), 'переменная/проверка "leveled" полностью убрана из _endSession()');
    assert(/this\.skillsDmgSpent = this\._totalDmgForPoints\(this\.earnedPoints\);/.test(body),
        'skillsDmgSpent безусловно сбрасывается до пола текущего уровня — выполняется на каждый вызов, не только внутри условия');
    assert(/this\._flushSaveToUdata\(\);/.test(body), 'результат сохраняется немедленно');
}

console.log('\nTest 6: bosses.php._finalizeSkillSession() — тот же безусловный сброс на сервере (источник правды)');
{
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): сигнатура сменилась с
    // "(&$user)" на "($user)" — функция больше не мутирует $user по ссылке, сама лочит строку
    // и возвращает {json,locked} (см. tests/boss-finalize-skill-session-pass-by-reference-
    // fix.test.js). Безусловный сброс (нет "sessionStart"/условной ветки) теперь встречается
    // ДВАЖДЫ — в залоченной и в фолбэк-ветке — regex ниже должен совпасть хотя бы раз в каждой.
    const start = bossesPhp.indexOf('private function _finalizeSkillSession($user){');
    const end   = bossesPhp.indexOf('\n        }\n\n        // Фиксирует ИСТИННОЕ окончание боя', start);
    const body  = bossesPhp.slice(start, end);
    assert(!/sessionStart/.test(body), 'sessionStartPoints больше не читается и не сравнивается в этой функции');
    assert(!/if\(\$earned <= /.test(body), 'условная ветка убрана');
    const earnedCount = (body.match(/\$earned = \$this->_skillEarnedPoints\(\$sCatalog, intval\(\$state\['dmgSpent'\]\)\);/g) || []).length;
    assert(earnedCount === 2, `earned по-прежнему считается по текущему dmgSpent — в обеих ветках (лок/фолбэк), найдено ${earnedCount}`);
    const rollbackCount = (body.match(/\$state\['dmgSpent'\] = \$this->_skillTotalDmgForPoints\(\$sCatalog, \$earned\);/g) || []).length;
    assert(rollbackCount === 2,
        `dmgSpent безусловно откатывается до пола текущего уровня — в обеих ветках, ни одна строка не внутри if, найдено ${rollbackCount}`);
}

console.log('\nTest 7: sanity — _finalizeSkillSession() по-прежнему вызывается из claimKill() (победа) и endFightSession() (таймаут/форфейт), sessionStartPoints в startFight() не тронут (формат данных не менялся)');
{
    assert(/\$this->_finalizeSkillSession\(\$user\);/.test(bossesPhp.slice(bossesPhp.indexOf('function claimKill('))), 'claimKill() вызывает _finalizeSkillSession()');
    assert(/function endFightSession\(\)\{[\s\S]*?\$this->_finalizeSkillSession\(\$user\);/.test(bossesPhp), 'endFightSession() вызывает _finalizeSkillSession()');
    assert(/\$skillsState\['sessionStartPoints'\] = \$this->_skillEarnedPoints\(/.test(bossesPhp),
        'bosses.startFight() по-прежнему замораживает sessionStartPoints (поле осталось в формате данных, просто больше не читается в finalize)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

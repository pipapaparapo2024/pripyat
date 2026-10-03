/**
 * Test: 24.09.2026, по прямому указанию — "бесплатное оружие имеет свой кулдаун 6 часов, но
 * если бой каким-либо образом закончился (время вышло / игрок выиграл / игрок проиграл), КД
 * обновляется автоматически сразу — повторно можно бить бесплатным оружием".
 *
 * Корень (24.09.2026): proto._saveToUdata() (bosses-combat.js) писала freeWpnCdMs ЦЕЛИКОМ из
 * клиентского this._freeWpnLastMs — чисто in-memory JS-объекта на инстансе Bosses, который
 * НИКОГДА не синхронизируется обратно из applyPatch(res.patch) в fight-end хендлерах — это
 * могло затирать свежий серверный freeWpnCdMs устаревшим клиентским снимком (например, при
 * гонке между вкладками/устройствами). Фикс 24.09: _saveToUdata() мёрджит freeWpnCdMs
 * (максимум таймстампа на id оружия) с уже сохранённым в udata['bosses_data'] значением,
 * вместо слепой замены — та же защита, что уже стоит на сервере в bosses.php.attack() (пишет
 * $data['freeWpnCdMs'][$weaponId] В decode-нутый объект, не поверх). Этот мёрдж-механизм
 * по-прежнему нужен и НЕ убирается — см. Test 1/3 ниже.
 *
 * 25.09.2026 (РЕВЕРТ, по прямому указанию — "а теперь нужно вернуть ту механику"): собственно
 * СБРОС кулдауна на конец боя — отдельная фича, которой раньше НЕ БЫЛО в коде вообще (сервер
 * только ЗАПИСЫВАЛ freeWpnCdMs при ударе, никогда не очищал). Добавлена явно:
 *  - bosses.php.claimKill() и endFightSession() теперь обнуляют $data['freeWpnCdMs'] = []
 *    при завершении боя (победа/поражение/таймаут/форфейт) — см. Test 4.
 *  - bosses-combat.js._onFightTimeout — единственный fight-end хендлер, где _saveToUdata()
 *    (с мёрджем выше) вызывается ПОСЛЕ applyPatch(res.patch) — то есть мёрдж мог бы воскресить
 *    только что обнулённый сервером кулдаун из устаревшего this._freeWpnLastMs. Добавлена
 *    явная очистка this._freeWpnLastMs = {} между applyPatch() и _saveToUdata() — см. Test 5.
 *    (_forfeitBossFight/_onDefeat такой правки не требуют — там _saveToUdata()/её эквивалент
 *    либо вызывается ДО applyPatch(), либо не вызывается вовсе, см. коммент в самом коде.)
 *
 * 25.09.2026, ПОВТОРНЫЙ живой репорт со скриншотом ошибки ("Бесплатный удар КД: 5ч 59мин")
 * тем же днём — реверт выше (claimKill/endFightSession) на самом деле НЕ покрывал все способы,
 * которыми бой фактически завершается:
 *  - bosses.php.startFight() сам делает АВТО-ФОРФЕЙТ любой ДРУГОЙ активной пары (di,bi), если
 *    игрок стартует бой с боссом X, имея незавершённый бой с боссом Y (вышел через крестик —
 *    _leaveBossesFight, намеренно НЕ форфейт, сессия остаётся "живой" для резюме). Этот
 *    авто-форфейт — по факту ТРЕТИЙ способ, которым бой заканчивается, но freeWpnCdMs там не
 *    сбрасывался вообще — залипал до следующей явной победы/поражения/форфейта. Теперь
 *    сбрасывается — см. Test 6.
 *  - Та же дыра — если протухает (MAX_FIGHT_WINDOW_MS) сама ЭТА ЖЕ пара (di,bi) и игрок просто
 *    возвращается позже начать её заново — тоже не покрывалось авто-форфейт-циклом (explicit
 *    continue на $di===$diffIdx). Теперь сбрасывается тоже — см. Test 7.
 *  - Клиент: bosses._freeWpnLastMs — in-memory снимок (см. Test 1 выше) — не обновлялся при
 *    получении ответа bosses.startFight(), поэтому МОГ хранить УСТАРЕВШИЙ (более высокий)
 *    таймстамп заброшенного боя для оружия, которым не бьют ПРЯМО СЕЙЧАС — следующий же
 *    _saveToUdata() смёрджил бы max() и ВОСКРЕСИЛ только что обнулённый сервером кулдаун.
 *    Теперь bosses_fight.js._openBossesFight() ПОЛНОСТЬЮ заменяет (не мёрджит) bosses.
 *    _freeWpnLastMs на res.patch.bosses_data.freeWpnCdMs после каждого startFight() — см. Test 8.
 *
 * Run: node tests/free-weapon-cooldown-not-wiped-on-fight-end.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');

console.log('\nTest 1: _saveToUdata() мёрджит freeWpnCdMs (максимум таймстампа), не заменяет целиком');
{
    const m = src.match(/proto\._saveToUdata = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_saveToUdata найдена');
    const body = m ? m[1] : '';
    assert(/const exFreeWpnCdMs = \(ex\.freeWpnCdMs && typeof ex\.freeWpnCdMs === 'object'\) \? ex\.freeWpnCdMs : \{\};/.test(body),
        'читает уже сохранённый freeWpnCdMs из текущего udata[\'bosses_data\'] (ex) перед перезаписью');
    assert(/mergedFreeWpnCdMs\[k\] = Math\.max\(parseInt\(mergedFreeWpnCdMs\[k\]\) \|\| 0, parseInt\(this\._freeWpnLastMs\[k\]\) \|\| 0\);/.test(body),
        'берёт МАКСИМУМ таймстампа между уже сохранённым и клиентским in-memory значением (не слепая замена)');
    assert(/freeWpnCdMs:\s*mergedFreeWpnCdMs,/.test(body), 'итоговый JSON пишет смёрдженное значение, не голый this._freeWpnLastMs');
    assert(!/freeWpnCdMs:\s*this\._freeWpnLastMs,/.test(body), 'КРИТИЧНО: старая слепая замена (freeWpnCdMs: this._freeWpnLastMs) больше не осталась');
}

console.log('\nTest 2: регресс-гвард — все 4 fight-end хендлера по-прежнему зовут applyPatch() ПЕРЕД _saveToUdata()/_finishXxxUi (порядок важен для мёрджа — ex должен успеть подхватить свежий patch)');
{
    // _onFightTimeout: applyPatch → _finishTimeoutUi (которая внутри зовёт _saveToUdata)
    const toIdx = src.indexOf('proto._onFightTimeout = function');
    const toEnd = src.indexOf('proto._onDefeat = function', toIdx);
    const toBody = src.slice(toIdx, toEnd);
    assert(/applyPatch\(res\.patch\);[\s\S]*?_finishTimeoutUi\(/.test(toBody),
        '_onFightTimeout: applyPatch() идёт раньше _finishTimeoutUi() (которая зовёт _saveToUdata)');

    const fightFightSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
    const ffIdx = fightFightSrc.indexOf('proto._forfeitBossFight = function');
    const ffEnd = fightFightSrc.indexOf('};', fightFightSrc.indexOf('if(window.TS){', ffIdx) + 500);
    const ffBody = fightFightSrc.slice(ffIdx, ffEnd);
    assert(/applyPatch\(res\.patch\);[\s\S]*?_finishForfeitUi\(/.test(ffBody),
        '_forfeitBossFight: applyPatch() идёт раньше _finishForfeitUi() (нет прямого _saveToUdata() ПОСЛЕ patch, значит мёрдж в следующем attack/fight-end уже возьмёт актуальные данные из ex)');
}

console.log('\nTest 3: серверная сторона (bosses.php.attack) — регресс-гвард, что она по-прежнему мёрджит freeWpnCdMs в decode-нутый объект, а не заменяет ($data всегда decode-нут ИЗ текущей строки перед записью в него)');
{
    const phpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
    assert(/if\(!isset\(\$data\['freeWpnCdMs'\]\) \|\| !is_array\(\$data\['freeWpnCdMs'\]\)\) \$data\['freeWpnCdMs'\] = \[\];/.test(phpSrc),
        'attack() инициализирует freeWpnCdMs ВНУТРИ уже decode-нутого $data (не создаёт заново)');
    // 28.09.2026 (по прямому указанию — общий КД на все три бесплатных оружия): раньше эта
    // строка пиcала ТОЛЬКО $weaponId, которым реально ударили — теперь удар любым бесплатным
    // оружием ставит на откат ВСЕ три сразу (foreach по $FREE_WPN_IDS), см.
    // tests/free-weapon-cd.test.js Test 2 для поведенческой проверки.
    assert(/foreach\(\$this->FREE_WPN_IDS as \$fw\) \$data\['freeWpnCdMs'\]\[\$fw\] = \$now;/.test(phpSrc),
        'attack() пишет $now во ВСЕ три ключа бесплатного оружия разом (общий кулдаун), не только в $weaponId');
    assert(!/\$data\['freeWpnCdMs'\]\[\$weaponId\] = \$now;/.test(phpSrc),
        'КРИТИЧНО: старая точечная запись только $weaponId больше не осталась (иначе кулдаун снова стал бы независимым)');
}

console.log('\nTest 4: 25.09.2026 РЕВЕРТ — bosses.php.claimKill()/endFightSession() обнуляют freeWpnCdMs при завершении боя');
{
    const phpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

    const ckStart = phpSrc.indexOf('function claimKill(){');
    const ckEnd   = phpSrc.indexOf('\n        }', phpSrc.indexOf('$this->ops->ok([', ckStart));
    const ckBody  = phpSrc.slice(ckStart, ckEnd);
    assert(/\$data\['freeWpnCdMs'\] = \[\];/.test(ckBody), 'claimKill() (победа) обнуляет freeWpnCdMs целиком');

    const efsStart = phpSrc.indexOf('function endFightSession(){');
    const efsEnd   = phpSrc.indexOf('\n        }', phpSrc.indexOf('$this->ops->ok([', efsStart));
    const efsBody  = phpSrc.slice(efsStart, efsEnd);
    assert(/\$data\['freeWpnCdMs'\] = \[\];/.test(efsBody), 'endFightSession() (поражение/таймаут/форфейт) обнуляет freeWpnCdMs целиком');
    assert(/\$patchKeys\[\] = 'bosses_data';/.test(efsBody), 'bosses_data безусловно добавлен в patch — клиент получит очищенный freeWpnCdMs даже если bossStartMs уже был 0');
}

console.log('\nTest 5: 25.09.2026 РЕВЕРТ — _onFightTimeout очищает this._freeWpnLastMs ПОСЛЕ applyPatch, ДО _saveToUdata (иначе мёрдж из Test 1 воскресит только что сброшенный сервером кулдаун)');
{
    const toIdx = src.indexOf('proto._onFightTimeout = function');
    const toEnd = src.indexOf('proto._onDefeat = function', toIdx);
    const toBody = src.slice(toIdx, toEnd);
    assert(/applyPatch\(res\.patch\);[\s\S]*?this\._freeWpnLastMs = \{\};[\s\S]*?_finishTimeoutUi\(/.test(toBody),
        'порядок: applyPatch() → this._freeWpnLastMs = {} → _finishTimeoutUi() (которая зовёт _saveToUdata с уже пустым in-memory снимком)');
}

console.log('\nTest 6: 25.09.2026 ПОВТОРНЫЙ фикс — bosses.php.startFight() авто-форфейт ДРУГОЙ активной пары тоже обнуляет freeWpnCdMs');
{
    const phpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
    const sfStart = phpSrc.indexOf('function startFight(){');
    const sfAutoForfeitEnd = phpSrc.indexOf('$now = intval(round(microtime(true) * 1000));', sfStart);
    const autoForfeitBody = phpSrc.slice(sfStart, sfAutoForfeitEnd);
    assert(/\$autoForfeited = false;/.test(autoForfeitBody), 'флаг $autoForfeited объявлен перед циклом авто-форфейта');
    assert(/\$autoForfeited = true;/.test(autoForfeitBody), 'флаг взводится, когда реально нашли и обнулили чужую активную пару');
    assert(/if\(\$autoForfeited\) \$data\['freeWpnCdMs'\] = \[\];/.test(autoForfeitBody),
        'freeWpnCdMs обнуляется, если авто-форфейт реально что-то нашёл (не безусловно на каждый startFight)');
}

console.log('\nTest 7: 25.09.2026 ПОВТОРНЫЙ фикс — протухание ТОЙ ЖЕ пары (di===diffIdx, bi===bossId) тоже обнуляет freeWpnCdMs');
{
    const phpSrc = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
    const sfStart = phpSrc.indexOf('function startFight(){');
    const existingBlockStart = phpSrc.indexOf('$existing = intval(', sfStart);
    const existingBlockEnd = phpSrc.indexOf('$uid = abs(intval(', existingBlockStart);
    const body = phpSrc.slice(existingBlockStart, existingBlockEnd);
    assert(/if\(!\$isFresh\)\{/.test(body), 'протухшая ветка ($existing>0 но !$isFresh) стала блоком (не однострочником) — обёрнута фигурными скобками');
    assert(/\$existing = 0; \/\/ протух/.test(body), 'существующее поведение (existing=0, идти дальше как "бой не начат") сохранено');
    assert(/\$data\['freeWpnCdMs'\] = \[\];/.test(body), 'freeWpnCdMs обнуляется и при протухании ЭТОЙ ЖЕ пары (не только чужой, см. Test 6)');
}

console.log('\nTest 8: 25.09.2026 ПОВТОРНЫЙ фикс — клиент: bosses._freeWpnLastMs ПОЛНОСТЬЮ заменяется (не мёрджится) после каждого startFight()');
{
    const fightFightSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
    const sfIdx = fightFightSrc.indexOf("TS.php('bosses.startFight'");
    const sfCbEnd = fightFightSrc.indexOf("bosses._bossStartMs[di][bossIdx] = res.bossStartMs;", sfIdx);
    const body = fightFightSrc.slice(sfIdx, sfCbEnd);
    assert(/bosses\._freeWpnLastMs = \(patched\.freeWpnCdMs && typeof patched\.freeWpnCdMs === 'object'\) \? patched\.freeWpnCdMs : \{\};/.test(body),
        'bosses._freeWpnLastMs присваивается НАПРЯМУЮ из свежего patched.freeWpnCdMs (полная замена), а не Object.assign-мёрдж со старым содержимым');
    assert(!/Object\.assign\(bosses\._freeWpnLastMs, patched\.freeWpnCdMs\)/.test(body),
        'КРИТИЧНО: не используется Object.assign-мёрдж здесь — он бы НЕ стёр устаревшие ключи, оставшиеся от брошенного боя');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

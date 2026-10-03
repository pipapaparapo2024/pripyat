/**
 * Test: 17.09.2026 (шестнадцатый батч) — второй шаг проекта "перенос экономики на сервер":
 * Боссы, ОБЛЕГЧЁННЫЙ вариант по прямому указанию пользователя (после явного выбора между
 * "только награда за убийство" и "полный перенос каждого удара" — выбран первый).
 *
 * Урон за удар (оружие/скиллы/криты/патроны) ПО-ПРЕЖНЕМУ считает клиент — это осознанно
 * оставлено вне переноса (потребовало бы переносить skills.js/weapons.js, риск сломать смежные
 * системы). Но когда HP босса дошло до 0, клиент больше не начисляет награду сам — только
 * просит сервер (bosses.claimKill, boss_id/diff_idx), сервер сам проверяет ДНЕВНОЙ ЛИМИТ
 * убийств (единственная по-настоящему серверная защита в этом облегчённом варианте — сколько
 * бы раз консоль ни подделала "бой закончен", больше 7 наград в день на одного босса читер не
 * получит) и сам считает сигареты/опыт/ключи/очки рюкзака/прогресс хаты по каталогу
 * server/json/bosses_config.json (сверен построчно с bosses.js/bosses-combat.js при переносе).
 *
 * Run: node tests/bosses-server-authoritative-kill-reward.test.js
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

const bossesJs   = readSrc('_client/src/game/bosses.js');
const combatJs   = readSrc('_client/src/game/bosses/bosses-combat.js');
const bossesPhp  = readSrc('server/core/controllers/bosses.php');
const catalog    = JSON.parse(fs.readFileSync(path.join(root, 'server/json/bosses_config.json'), 'utf-8'));

console.log('\nTest 1: каталог bosses_config.json 1:1 совпадает с bosses.js (регресс-гвард)');
{
    // 25.09.2026 (по прямому указанию, аудит "Связки ключей"/общий ключ Баркута-Бороды):
    // Баркут(5) и Борода(6) получили опциональное поле key_slot:5 (оба делят один тип ключа) —
    // regex ниже обновлён, чтобы пропускать это необязательное поле между keys_needed и reward
    // (раньше паттерн требовал ", reward:" сразу после keys_needed, из-за чего эти 2 босса из 8
    // вообще переставали матчиться).
    const bossRe = /\{ id:(\d+),name:'([^']+)',\s*keys_needed:(\d+),(?:\s*key_slot:(\d+),)?\s*reward:\{cig:(\d+),\s*exp:(\d+)\s*\}, gives_keys:\[([^\]]*)\]/g;
    let m, extracted = [];
    while((m = bossRe.exec(bossesJs))){
        extracted.push({id:+m[1], name:m[2], keys_needed:+m[3], key_slot: m[4]!==undefined ? +m[4] : null, cig:+m[5], exp:+m[6], gives_keys: m[7].split(',').filter(Boolean).map(Number)});
    }
    assert(extracted.length === 8, 'bosses.js содержит 8 боссов');
    let bad = 0;
    catalog.bosses.forEach((b, i) => {
        const e = extracted[i];
        const catalogKeySlot = b.key_slot !== undefined ? b.key_slot : null;
        const ok = e && e.id===b.id && e.name===b.name && e.keys_needed===b.keys_needed && e.key_slot===catalogKeySlot && e.cig===b.cig && e.exp===b.exp
            && JSON.stringify(e.gives_keys)===JSON.stringify(b.gives_keys);
        if(!ok) bad++;
    });
    assert(bad === 0, 'все 8 боссов каталога совпадают с bosses.js (id/name/keys_needed/cig/exp/gives_keys)');

    const dmRe = /\{ exp: ([\d.]+), cig: ([\d.]+),\s*label: '[^']+',\s*color: 0x[0-9a-f]+ \}/g;
    let dm, diffMult = [];
    while((dm = dmRe.exec(bossesJs))) diffMult.push({exp:+dm[1], cig:+dm[2]});
    assert(diffMult.length === 4, 'bosses.js содержит 4 множителя сложности');
    let dmBad = 0;
    catalog.diff_mult.forEach((d,i) => { const e = diffMult[i]; if(!e || e.exp!==d.exp || e.cig!==d.cig) dmBad++; });
    assert(dmBad === 0, 'все 4 diff_mult каталога совпадают с bosses.js');

    // RYUKZAK_PTS раньше жил в bosses-combat.js._onDefeat — после переноса начисления очков
    // рюкзака на сервер убран из клиента полностью (см. Test 6), поэтому сверяем каталог с
    // жёстко зафиксированным ожидаемым значением (то же, что было в клиенте до переноса).
    assert(JSON.stringify(catalog.ryukzak_pts) === JSON.stringify([5, 10, 20, 35, 60, 90, 110, 150]),
        'ryukzak_pts каталога — [5,10,20,35,60,90,110,150], как было в bosses-combat.js до переноса');

    const limitMatch = bossesJs.match(/DAILY_KILL_LIMIT = (\d+)/);
    assert(parseInt(limitMatch[1]) === catalog.daily_kill_limit, 'daily_kill_limit каталога совпадает с bosses.js (7)');
}

console.log('\nTest 2: дневной лимит убийств проверяется и отклоняет запрос ДО начисления награды (единственная серверная защита в облегчённом варианте)');
{
    // 29.09.2026 (по прямому указанию — "лимиты атак не заканчиваются", см.
    // tests/boss-daily-attempt-spent-on-any-outcome.test.js): проверка/расход дневного лимита
    // переехали из claimKill() в startFight() — попытка теперь тратится РАВНО РАЗ, в момент
    // старта боя, независимо от исхода (победа/поражение/таймаут/сдача), а не только при
    // подтверждённой победе. Раньше этот тест проверял лимит внутри claimKill() — теперь
    // проверяет его там, где он реально живёт (startFight()), тем же способом, что и
    // специализированный тест выше.
    const start = bossesPhp.indexOf('function startFight(){');
    const end   = bossesPhp.indexOf("$this->ops->ok(['patch' => $patch, 'bossStartMs' => $activeStartMs,", start);
    const body  = bossesPhp.slice(start, end);
    assert(/if\(intval\(\$data\['dailyKills'\]\[\$bossId\]\) >= \$limit\) return \$this->ops->fail\(62\);/.test(body),
        'дневной лимит проверяется и отклоняет запрос ДО того, как бой вообще начинается (единственная серверная защита в облегчённом варианте)');
    assert(/\$today = \$this->ops->mskDailyDate\(\);/.test(body), 'дата "сегодня" берётся по серверным часам через Gameops::mskDailyDate(), не по клиенту (единый источник для всех игроков)');
    assert(/if\(!isset\(\$data\['dailyDate'\]\) \|\| \$data\['dailyDate'\] !== \$today\)\{/.test(body),
        'дневной счётчик сбрасывается при смене дня (как this.dailyDate в bosses.js)');
}

console.log('\nTest 3: bosses.php.claimKill() считает награду по каталогу (base × diff_mult × бонус банды)');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.lastIndexOf('\t}');
    const body  = bossesPhp.slice(start, end);
    assert(/\$earnedExp = intval\(floor\(\$bossCfg\['exp'\] \* \$diffCfg\['exp'\] \* \$gangExp\)\);/.test(body),
        'опыт считается: base × diff_mult.exp × бонус банды — та же формула, что bosses.js._calcReward()');
    assert(/\$earnedCig = intval\(floor\(\$bossCfg\['cig'\] \* \$diffCfg\['cig'\] \* \$gangCig\)\);/.test(body),
        'сигареты считаются: base × diff_mult.cig × бонус банды');
    assert(/if\(\$bossId <= 2\) \$user\['boss_kills_'\.\$bossId\] = /.test(body),
        'boss_kills_N обновляется ТОЛЬКО для боссов 0-2 (единственные реальные колонки БД — иначе fatal error "Unknown column")');
}

console.log('\nTest 4: bosses.php.claimKill() выдаёт ключи в обычном (0) и соло (3) режимах');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.lastIndexOf('\t}');
    const body  = bossesPhp.slice(start, end);
    // 19.09.2026 (баг найден, по прямому указанию): было "diffIdx < 2" — на практике исключало
    // ТОЛЬКО соло (единственный второй реально играбельный режим, опасный/суровый пока
    // заблокированы на клиенте) — соло никогда не давало ключей. Явный список 0/3.
    assert(/if\(\(\$diffIdx === 0 \|\| \$diffIdx === 3\) && !empty\(\$bossCfg\['gives_keys'\]\)\)\{/.test(body),
        'ключи выдаются при diffIdx 0 (обычный) или 3 (соло) — оба реально играбельных режима');
}

console.log('\nTest 5: bosses.php.claimKill() зарегистрирован в permits');
{
    // 27.09.2026: раньше здесь сравнивали $this->permits целиком с точным списком из 8 методов.
    // С тех пор (26.09.2026, по прямому указанию) в permits добавились useSedoy/rushFreeWeapon/
    // buyKey (см. tests/bosses-buy-key-server-authoritative.test.js) — точный список
    // устарел бы при каждой новой фиче. Проверяем только то, что действительно проверяет этот
    // тест-файл: claimKill() зарегистрирован как permit.
    const permitsMatch = bossesPhp.match(/\$this->permits = \[([^\]]*)\];/);
    assert(!!permitsMatch, '$this->permits найден в bosses.php');
    assert(!!permitsMatch && permitsMatch[1].includes("'claimKill'"),
        'claimKill добавлен в список разрешённых методов роутера');
}

console.log('\nTest 6: bosses-combat.js._onDefeat — клиент больше НЕ начисляет валюту/ключи/очки рюкзака напрямую');
{
    const start = combatJs.indexOf('proto._onDefeat = function(idx){');
    const end   = combatJs.indexOf('// Подтягивает суммарный урон');
    const body  = combatJs.slice(start, end);
    assert(!/udata\['cigarettes'\]\s*=\s*\(parseInt/.test(body), '_onDefeat не присваивает udata[cigarettes] напрямую');
    assert(!/udata\['exp'\]\s*=\s*\(parseInt/.test(body), '_onDefeat не присваивает udata[exp] напрямую');
    assert(!/udata\['ryukzak_points'\]/.test(body), '_onDefeat не присваивает ryukzak_points напрямую (теперь на сервере)');
    assert(!/udata\['hata_progress'\]/.test(body), '_onDefeat не присваивает hata_progress напрямую (теперь на сервере)');
    assert(/TS\.php\('bosses\.claimKill', \{boss_id: idx, diff_idx: diffIdx\}/.test(body), '_onDefeat зовёт bosses.claimKill');
    assert(/applyPatch\(res\.patch\);/.test(body), '_onDefeat применяет патч от сервера');
}

console.log('\nTest 7: bosses-combat.js — при ошибке сервера (напр. дневной лимит) игрок не застревает на экране');
{
    const start = combatJs.indexOf('// Сервер отказал');
    assert(start !== -1, 'обработчик ошибки claimKill найден (с пояснением про дневной лимит)');
    const end = combatJs.indexOf('});', start) + 3;
    const body = combatJs.slice(start, end);
    assert(/this\._setHp\(idx, this\._maxHp\(idx\)\);/.test(body), 'HP сбрасывается на максимум при отказе сервера (не остаётся 0 навсегда)');
    assert(/iface\._closeBossesFight\(\)/.test(body) && /iface\._openBossesPopup\(\)/.test(body),
        'игрок выводится из боя при отказе сервера (не застревает на экране)');
}

console.log('\nTest 8: applyPatch импортирован в bosses-combat.js');
{
    assert(/import \{ applyPatch \} from '\.\.\/\.\.\/modules\/patch\.js';/.test(combatJs), 'applyPatch импортирован');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

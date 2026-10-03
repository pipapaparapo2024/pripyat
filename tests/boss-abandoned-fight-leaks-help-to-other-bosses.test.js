/**
 * Test: баг 20.09.2026 (по прямому указанию) — "бью босса в Баркут, урон приходит всем моим
 * друзьям, даже если они дерутся не с Баркутом, а с любым другим боссом, и я буду в топе до тех
 * пор, пока [их] босс не умрёт".
 *
 * Корень бага: игрок физически ведёт только ОДИН бой одновременно, но ничто не мешало открыть
 * бой с НОВЫМ боссом, не нажав "выйти из боя" у старого — старый bossStartMs/curCycleDmg просто
 * оставался висеть ненулевым НАВСЕГДА. bosses.friendsDamage()/bosses.rating() читают именно этот
 * curCycleDmg[bossId] — поэтому брошенный (но так и не обнулённый) урон по старому боссу
 * бесконечно засчитывался как "живая помощь ПРЯМО СЕЙЧАС" любому другу, дерущемуся с ТЕМ ЖЕ
 * старым боссом, и переставал висеть в их топе только когда ОНИ САМИ убивали этого босса
 * (свой curCycleDmg[bossId] обнулялся при их собственной победе) — что и описывает жалоба
 * "вишу в топе, пока босс не умрёт".
 *
 * Фикс (зеркально на сервере и клиенте — иначе клиентский _saveToUdata() тут же перезаписал бы
 * серверный сброс брошенным in-memory значением): старт НОВОГО боя автоматически "форфейтит"
 * любую другую ещё активную пару (diffIdx, bossId) — bossStartMs=0, curCycleDmg=0. Инвариант
 * "активен только один бой" теперь не зависит от того, нажал ли игрок "выйти".
 *
 * Run: node tests/boss-abandoned-fight-leaks-help-to-other-bosses.test.js
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

const phpSrc  = readSrc('server/core/controllers/bosses.php');
const fightSrc = readSrc('_client/src/game/shell/overlays/bosses_fight.js');

console.log('\nTest 1: bosses.php.startFight() авто-форфейтит любую другую активную пару diff/boss ДО записи новой');
{
    const start = phpSrc.indexOf('function startFight()');
    const end   = phpSrc.indexOf('\n        }', phpSrc.indexOf('$this->ops->ok', start));
    const body  = phpSrc.slice(start, end);

    assert(/for\(\$di = 0; \$di < 4; \$di\+\+\)\{[\s\S]*?for\(\$bi = 0; \$bi < 8; \$bi\+\+\)\{/.test(body),
        'цикл по ВСЕМ diffIdx(0-3) × bossId(0-7) присутствует в startFight()');
    assert(/if\(\$di === \$diffIdx && \$bi === \$bossId\) continue;/.test(body),
        'пропускает именно ту пару, которая сейчас стартует (её не форфейтим саму на себя)');
    assert(/\$data\['bossStartMs'\]\[\$di\]\[\$bi\] = 0;\s*\n\s*\$data\['curCycleDmg'\]\[\$bi\] = 0;/.test(body),
        'для любой ДРУГОЙ активной (bossStartMs>0) пары обнуляет и bossStartMs, и curCycleDmg');

    // Порядок важен: авто-форфейт должен случиться ДО фактической записи bossStartMs новой попытки,
    // иначе новая попытка сама тоже немедленно попадёт под сброс.
    const forfeitPos = body.indexOf("\$data['curCycleDmg'][\$bi] = 0;");
    const newStartPos = body.indexOf("\$data['bossStartMs'][\$diffIdx][\$bossId] = \$now;");
    assert(forfeitPos > 0 && newStartPos > forfeitPos,
        'авто-форфейт старых боёв выполняется РАНЬШЕ записи bossStartMs новой попытки');
}

console.log('\nTest 2: bosses_fight.js._openBossesFight() зеркалит тот же авто-форфейт на клиенте (реальная точка старта попытки, не мёртвый блок в _attack())');
{
    // 20.09.2026 (в тот же день, отдельным фиксом): выяснилось, что _bossStartMs проставляется
    // ДО первой атаки уже в _openBossesFight() (см. skills.beginSession() рядом) — то есть
    // "if(isNewAttempt){...}" внутри bosses-combat.js._attack() по основному игровому пути
    // практически НИКОГДА не срабатывал. Реальный, реально работающий авто-форфейт живёт
    // именно здесь. 22.09.2026: _attack() полностью переписан под server-authoritative bosses.
    // attack() (см. boss-attack-server-authoritative-and-timing-friend-rule.test.js) — мёртвый
    // клиентский дубль авто-форфейта убран из _attack() целиком, этот блок остался единственным.
    const start = fightSrc.indexOf('proto._openBossesFight = function');
    const cbStart = fightSrc.indexOf("TS.php('bosses.startFight'", start);
    const cbEnd   = fightSrc.indexOf('this._reallyOpenBossesFight(bossIdx);', cbStart);
    const body = fightSrc.slice(cbStart, cbEnd);

    assert(/for\(let _di=0; _di<4; _di\+\+\)\{[\s\S]*?for\(let _bi=0; _bi<8; _bi\+\+\)\{/.test(body),
        'цикл авто-форфейта по всем diffIdx×bossId присутствует в реальной точке старта');
    assert(/if\(_di === di && _bi === bossIdx\) continue;/.test(body),
        'клиент тоже пропускает именно стартующую пару');
    assert(/bosses\._bossStartMs\[_di\]\[_bi\] = 0;/.test(body) && /bosses\._curCycleDmg\[_bi\] = 0;/.test(body),
        'клиент обнуляет чужой bossStartMs и curCycleDmg для любой другой активной пары');
    assert(/bosses\.friendDmgApplied && bosses\.friendDmgApplied\[_di\]\) bosses\.friendDmgApplied\[_di\]\[_bi\] = 0;/.test(body),
        'клиент также обнуляет friendDmgApplied заброшенной пары (не только curCycleDmg)');
    // 22.09.2026: _resetRatingPeaks()/_ratingPeaks убраны целиком (см.
    // boss-rating-log-based-no-stale-peaks-cache.test.js) — рейтинг теперь читает
    // boss_damage_log напрямую на каждый запрос, кэш пиков больше не нужен и не существует.
    assert(!/_resetRatingPeaks/.test(body), '_resetRatingPeaks не вызывается — функция убрана целиком, кэш пиков рейтинга не нужен');
}

console.log('\nTest 3: симуляция — старый баг воспроизводится БЕЗ фикса, и исчезает С фиксом (реальный прогон логики, не только regex)');
{
    // Мини-модель серверного bosses_data одного игрока + двух эндпоинтов (startFight, friendsDamage)
    // ровно с той же семантикой, что PHP выше — проверяем ПОВЕДЕНИЕ, а не только текст.
    function makeUser(){
        return { bossStartMs: [ [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0] ], curCycleDmg: [0,0,0,0,0,0,0,0] };
    }
    // withAutoForfeit=false воспроизводит СТАРОЕ (баговое) поведение — как было ДО фикса.
    function startFight(user, diffIdx, bossId, withAutoForfeit){
        if(user.bossStartMs[diffIdx][bossId] > 0) return; // уже идёт — идемпотентно, как в PHP
        if(withAutoForfeit){
            for(let di=0; di<4; di++) for(let bi=0; bi<8; bi++){
                if(di===diffIdx && bi===bossId) continue;
                if(user.bossStartMs[di][bi] > 0){ user.bossStartMs[di][bi] = 0; user.curCycleDmg[bi] = 0; }
            }
        }
        user.bossStartMs[diffIdx][bossId] = Date.now ? 1 : 1; // время не важно для теста, важен факт >0
    }
    function attack(user, diffIdx, bossId, dmg){ user.curCycleDmg[bossId] += dmg; }
    // Ровно та же выборка, что server bosses.friendsDamage()/rating(): сумма curCycleDmg[bossId]
    // среди "друзей" — здесь один игрок, поэтому просто читаем его текущее значение.
    function liveHelpFor(user, bossId){ return Math.max(0, user.curCycleDmg[bossId] || 0); }

    const BARKUT = 5, KRYS = 4, DIFF_NORMAL = 0;

    console.log('  без фикса (withAutoForfeit=false) — баг воспроизводится:');
    {
        const u = makeUser();
        startFight(u, DIFF_NORMAL, BARKUT, false);
        attack(u, DIFF_NORMAL, BARKUT, 500);           // бью Баркута, не выхожу из боя
        startFight(u, DIFF_NORMAL, KRYS, false);        // сразу иду на Крыса, не форфейтя Баркута
        const helpForBarkut = liveHelpFor(u, BARKUT);   // друг, дерущийся с Баркутом, всё ещё видит меня
        assert(helpForBarkut === 500,
            'воспроизведено: после переключения на Крыса игрок ВСЁ ЕЩЁ "помогает" другу на Баркуте (' + helpForBarkut + ' урона) — это и есть баг');
    }

    console.log('  с фиксом (withAutoForfeit=true) — баг устранён:');
    {
        const u = makeUser();
        startFight(u, DIFF_NORMAL, BARKUT, true);
        attack(u, DIFF_NORMAL, BARKUT, 500);
        startFight(u, DIFF_NORMAL, KRYS, true);         // старт Крыса авто-форфейтит брошенного Баркута
        const helpForBarkut = liveHelpFor(u, BARKUT);
        const helpForKrys   = liveHelpFor(u, KRYS);
        assert(helpForBarkut === 0,
            'исправлено: после переключения на Крыса помощь по Баркуту обнулена (' + helpForBarkut + '), друг на Баркуте больше не видит брошенный урон');
        assert(u.bossStartMs[DIFF_NORMAL][BARKUT] === 0,
            'bossStartMs брошенного Баркута тоже сброшен в 0 (не просто curCycleDmg)');
        assert(helpForKrys === 0,
            'у только что начатого боя с Крысом curCycleDmg закономерно ещё 0 (удар по нему не наносился)');
    }

    console.log('  побочный эффект не задет — обычное продолжение ОДНОГО и того же боя не форфейтится само на себя:');
    {
        const u = makeUser();
        startFight(u, DIFF_NORMAL, BARKUT, true);
        attack(u, DIFF_NORMAL, BARKUT, 300);
        startFight(u, DIFF_NORMAL, BARKUT, true); // идемпотентный повторный вызов (bossStartMs уже >0)
        assert(liveHelpFor(u, BARKUT) === 300,
            'повторный startFight по УЖЕ идущему бою — идемпотентен, накопленный урон/бой не сбрасывается');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

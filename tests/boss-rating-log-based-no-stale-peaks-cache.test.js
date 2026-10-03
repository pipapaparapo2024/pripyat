/**
 * Test: баг 22.09.2026 (по прямому указанию, скриншот вживую) — "Охотник, HP 1000/1000
 * (полное), таймер только что начался (08:59:56), а в РЕЙТИНГ УРОНА висит друг с 14.4K урона —
 * при том что у босса всего 1000 HP, он должен быть уже убит".
 *
 * Расследование напрямую в БД (SQL, тот же запрос, что делает bosses.php.rating()):
 *  - реальный bossStartMs зрителя для (diffIdx=0, boss_id=0) был выставлен буквально
 *    за 13 минут до проверки (совпадает с "только что начался" на скриншоте);
 *  - весь урон "друга" в boss_damage_log (по ЛЮБЫМ боссам, суммарно ~14.4K) был нанесён
 *    более 4 ЧАСОВ ДО этого — задолго до старта ТЕКУЩЕЙ попытки зрителя;
 *  - прямой SQL-запрос с тем же условием `time >= bossStartMs`, что использует
 *    _friendsDamagePerUserSince(), вернул 0 строк — сервер, если бы его спросили ПРЯМО СЕЙЧАС,
 *    отдал бы пустой рейтинг.
 *
 * Вывод: бага на сервере нет — bosses.php.rating()/friendsDamage() КАЖДЫЙ раз пересчитывают
 * всё заново по актуальному bossStartMs, старый урон друга физически не мог там оказаться.
 * Баг был ЦЕЛИКОМ на клиенте: bosses_fight.js._fetchBossFightRating() держал
 * bosses._ratingPeaks[diffIdx][bossIdx] — "пик" урона каждого игрока, который только РОС и
 * НИКОГДА не уменьшался (это было намеренно — фикс от 19.09.2026 против другого бага, когда
 * друг пропадал из панели после завершения СВОЕГО боя). Проблема: пик не сбрасывался, когда
 * СМОТРЯЩИЙ начинал НОВУЮ попытку против ТОГО ЖЕ босса (сброс был только при завершении
 * собственной попытки или при старте боя с ДРУГИМ боссом) — старое значение от давно
 * закрытой попытки (возможно, из совсем другой сессии в браузере) продолжало показываться
 * поверх свежего (обычно нулевого) честного ответа сервера, бесконечно.
 *
 * Фикс: _ratingPeaks/_resetRatingPeaks убраны целиком. После переезда на boss_damage_log урон
 * друга в логе никогда не "теряется" сам по себе (в отличие от старого client-writable
 * curCycleDmg, который обнулялся вместе с концом ЧУЖОГО боя) — пересчёт с нуля на каждый запрос
 * теперь ВСЕГДА корректен, кэш был не нужен и стал источником протухших данных.
 *
 * Run: node tests/boss-rating-log-based-no-stale-peaks-cache.test.js
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

const combatJs = readSrc('_client/src/game/bosses/bosses-combat.js');
const fightJs  = readSrc('_client/src/game/shell/overlays/bosses_fight.js');
const bossesJs = readSrc('_client/src/game/bosses.js');

console.log('\nTest 1: _ratingPeaks/_resetRatingPeaks убраны целиком из клиента (никаких активных вызовов/определений)');
{
    assert(!/proto\._resetRatingPeaks/.test(combatJs), '_resetRatingPeaks больше НЕ определена в bosses-combat.js');
    assert(!/this\._resetRatingPeaks\(/.test(combatJs), '_onFightTimeout/_onDefeat больше НЕ вызывают _resetRatingPeaks()');
    assert(!/bosses\._resetRatingPeaks\(/.test(fightJs), 'bosses_fight.js больше НЕ вызывает bosses._resetRatingPeaks() (ни в авто-форфейте, ни в форфейте)');
    assert(!/this\._ratingPeaks\s*=/.test(bossesJs), 'bosses.js не инициализирует _ratingPeaks в конструкторе');
}

console.log('\nTest 2: _fetchBossFightRating() отражает res.top от сервера НАПРЯМУЮ, без мёржа с локальным кэшем');
{
    const start = fightJs.indexOf('proto._fetchBossFightRating = function');
    const end   = fightJs.indexOf('    // ── ТАЙМЕР', start);
    const body  = fightJs.slice(start, end);
    assert(!/peaks/i.test(body), 'внутри _fetchBossFightRating нет никакого упоминания "peaks" — работает только с res.top');
    assert(/const top = \(res && Array\.isArray\(res\.top\)\) \? res\.top : \[\];/.test(body),
        'top берётся напрямую из ответа сервера (res.top), без Math.max с прошлым значением');
    assert(/bosses\._resolveVkUsers\(top\.map\(e=>e\.id\)/.test(body), 'резолв имён/фото по-прежнему идёт по top из ответа сервера');
}

console.log('\nTest 3: симуляция репорта — производный рейтинг всегда пересчитывается по АКТУАЛЬНОМУ bossStartMs зрителя, старый урон друга не может "застрять"');
{
    // Независимая модель СЕРВЕРНОЙ логики (SUM по логу с time >= viewerStart, как в
    // bosses.php._friendsDamagePerUserSince) — не читает исходники, реальный прогон формулы.
    const log = []; // {uid, time, damage}
    const hit = (uid, t, dmg) => log.push({ uid, time: t, damage: dmg });
    const friendDamageSince = (uid, sinceMs) => log.filter(r => r.uid === uid && r.time >= sinceMs).reduce((s, r) => s + r.damage, 0);

    const FRIEND = 'friend';
    // Друг 4 часа назад нанёс суммарно 14489 урона (по разным боссам — не важно каким).
    const fourHoursAgo = 1000;
    hit(FRIEND, fourHoursAgo, 3481);
    hit(FRIEND, fourHoursAgo + 50000, 11008);

    // Зритель СЕЙЧАС (много позже) начинает СОВЕРШЕННО НОВУЮ попытку против Охотника.
    const viewerFreshStart = fourHoursAgo + 4 * 60 * 60 * 1000; // +4ч
    const serverAnswerNow = friendDamageSince(FRIEND, viewerFreshStart);
    assert(serverAnswerNow === 0,
        'сервер, спрошенный ПРЯМО СЕЙЧАС по свежему bossStartMs зрителя, честно отдаёт 0 — старый урон друга (4ч назад, до старта этой попытки) не засчитывается (было бы 14489, если бы фильтр по времени не работал)');

    // Контрольная проверка: если бы у зрителя ВМЕСТО свежего старта была граница ДО удара друга
    // (например, старая, никогда не обновлявшаяся точка отсчёта) — урон бы засчитался, показывая,
    // что дело именно в АКТУАЛЬНОСТИ bossStartMs, а не в самой формуле SUM.
    const oldBoundaryBeforeHit = fourHoursAgo - 1;
    const serverAnswerWithStaleBoundary = friendDamageSince(FRIEND, oldBoundaryBeforeHit);
    assert(serverAnswerWithStaleBoundary === 14489,
        'при старой (неактуальной) границе те же данные честно вернули бы 14489 — подтверждает, что сама SUM-формула рабочая, разница только в АКТУАЛЬНОСТИ границы');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }

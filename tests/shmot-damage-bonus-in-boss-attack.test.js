// Server applies OWNED items' percentage and weapon-specific flat bonuses (28.09.2026:
// changed from equipped-only — see comment near the owned-check below).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../server/core/controllers/bosses.php'), 'utf8');
const start = src.indexOf('function attack(){');
const end = src.indexOf('function claimKill()', start);
assert(start >= 0 && end > start);
const body = src.slice(start, end);
assert(body.includes("$this->ops->catalog('shmot_items')"));
assert(body.includes("if(empty($shmotState[$iid]['owned'])) continue;"));
assert(body.includes("['machete' => 'machete_flat', 'gun' => 'gun_flat', 'auto' => 'auto_flat'][$weapKey] ?? null"));
assert(body.includes("if($bonusKey === 'damage') $shmotDmgPct += intval($it['bv']);"));
assert(body.includes("if($weaponShmotKey !== null && $bonusKey === $weaponShmotKey) $shmotFlat += intval($it['bv']);"));
assert(body.includes('$shmotDmgMult = 1 + $shmotDmgPct / 100;'));
assert(body.includes('$damage = intval(floor(($baseDmgWpn + $flatSkill + $shmotFlat) * ($isCrit ? 1.5 : 1) * $gangDmg * $shmotDmgMult)) * $mult;'));

// 27.09.2026: баг "шмот даёт буст независимо одет он персонажа или нет" — каталог
// shmot_items.json содержит старые ids 0-40 (базовый магазин, удалённый из клиента
// 23.09.2026, game/shmot.js.this.items больше их не хранит и не рисует на манекене),
// у которых нет поля 'cat'. Фикс — пропускать записи каталога без 'cat' (та же граница
// "мёртвого кода", что уже использует equip() для проверки "один предмет на категорию",
// см. код выше в этом файле). Актуально независимо от equipped/owned-условия ниже.
const catBonusLoopIdx = body.indexOf('foreach($shmotCatalog as $it){');
assert(catBonusLoopIdx >= 0, 'foreach($shmotCatalog...) loop must exist');
const skipCatCheckIdx = body.indexOf("if(!isset($it['cat'])) continue;", catBonusLoopIdx);
const ownedCheckIdx = body.indexOf("if(empty($shmotState[$iid]['owned'])) continue;", catBonusLoopIdx);
assert(skipCatCheckIdx >= 0, "loop must skip catalog items without 'cat' (legacy id0-40, removed from client 23.09.2026)");
assert(skipCatCheckIdx < ownedCheckIdx, "the 'cat' guard must run BEFORE the owned check, so legacy items never reach the bonus math at all");

// 28.09.2026 (по прямому указанию — новая экономика бонусов шмота): бонус теперь даёт
// сам факт владения вещью (owned), а не то, надета ли она (equipped) — "выбил — получил".
assert(!body.includes("if(empty($shmotState[$iid]['equipped'])) continue;"),
    'the OLD equipped-only gate must be gone — replaced by the owned-based check above');

// Data-level regression guard: the fix's whole premise is that legacy ids (0-40) lack
// 'cat' while the active catalog (41+) has it. If someone "fixes" the catalog by adding
// 'cat' to old ids (or removing it from new ones) without revisiting this loop, this
// assertion will catch the drift before it silently reopens the bug above.
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/json/shmot_items.json'), 'utf8'));
const legacyIds = catalog.filter(it => intOf(it.id) <= 40);
const activeIds = catalog.filter(it => intOf(it.id) >= 41);
assert(legacyIds.length > 0 && activeIds.length > 0, 'catalog must contain both legacy (<=40) and active (>=41) ids for this test to be meaningful');
assert(legacyIds.every(it => !('cat' in it)), 'legacy ids (<=40) must have NO cat field — this is exactly what the new isset guard relies on');
assert(activeIds.every(it => 'cat' in it), 'active ids (>=41) must all have a cat field — otherwise the new guard would wrongly exclude real equipped bonuses');

function intOf(v){ return parseInt(v, 10); }

console.log('Equipment damage checks passed (incl. legacy id0-40 cat-guard regression check)');

/** Регрессия состава достижений после удаления соло и старших боссов. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'server/json/achievements_config.json'), 'utf8'));
const client = fs.readFileSync(path.join(root, '_client/src/game/achievements.js'), 'utf8');
const ids = new Set(config.map(item => item.id));
let failed = 0;
function check(ok, text){ if(ok) console.log('✅', text); else { console.error('❌', text); failed++; } }

for(const id of ['dmg_10k', 'dmg_50k', 'dmg_100k', ...Array.from({length:8}, (_, i) => `solo_${i}`), 'kill_4', 'kill_5', 'kill_6', 'kill_7']){
  check(ids.has(id), `${id} сохранено в серверном каталоге`);
  check(client.includes(`id:'${id}'`), `${id} сохранено в клиентском списке`);
}
for(const id of ['kill_0', 'kill_1', 'kill_2', 'kill_3']) check(ids.has(id), `${id} сохранено`);
const migration = fs.readFileSync(path.join(root, 'server/migrate43.php'), 'utf8');
check(migration.includes("'kill_3'") === false, 'миграция не затрагивает достижение Меченого kill_3');
check(migration.includes('is_int($key) ? strval($value) : strval($key)'), 'миграция поддерживает старый и объектный форматы earned');
process.exitCode = failed ? 1 : 0;

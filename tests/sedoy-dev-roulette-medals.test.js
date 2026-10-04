/* Проверка регрессий: Седой, DEV, рулетка и сброс медалей. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const must = (source, needle, label) => {
  if(!source.includes(needle)) throw new Error(label + ': не найдено ' + needle);
};

const bosses = read('server/core/controllers/bosses.php');
must(bosses, "// 28.09.2026: total_damage здесь БОЛЬШЕ НЕ растёт", 'Седой не должен менять total_damage');
must(bosses, "$data['medalKills'][$bossId]", 'после победы должен расти отдельный прогресс медали');

const result = read('_client/src/game/shell/popups/boss_result.js');
// 04.10.2026 (РЕВЕРС по прямому указанию — "ударил 20, добил Седым 980, в попапе должно быть
// 20, не 1000"): личная цифра под аватаром больше НЕ прибавляет sedoyDamage — см.
// tests/boss-result-popup-sedoy-damage-shown-separately.test.js (Test 6) для полной проверки.
must(result, 'const shownDamage = entry ? Number(entry.damage || 0) : 0;', 'урон Седого НЕ должен прибавляться к личной цифре попапа');
if(result.includes('Number(entry.damage || 0) + (isOwnEntry')) throw new Error('старая формула сложения с sedoyDamage вернулась — Седой снова прибавляется к личному урону');
must(result, 'if(sedoyDamage > 0 && ownId && !hasOwnEntry)', 'добивший Седым игрок должен появляться в попапе даже без обычного удара');
must(result, '_sedoyDisplayOnly: true', 'строка Седого должна быть только визуальной, не записью рейтинга');
if(result.includes('Седой помог: +')) throw new Error('Седой не должен рисоваться отдельной строкой');

const roulette = read('_client/src/game/dvor/dvor-roulette.js');
const anim = roulette.indexOf('this._animRouletteWheel(idx, () => {');
const apply = roulette.indexOf('applyPatch(res.patch);');
if(anim < 0 || apply < anim) throw new Error('патч награды рулетки должен применяться после остановки колеса');

const iface = read('_client/src/game/interface.js');
must(iface, "const DEV_UIDS = ['1113977365', '382448269']", 'клиентский список DEV UID');
const panel = read('_client/src/game/shell/overlays/dev_panel.js');
must(panel, "DEV_UIDS.includes(String(vk_params['vk_user_id']))", 'защита открытия панели на клиенте');
const users = read('server/core/controllers/users.php');
must(users, "['1113977365', '382448269']", 'серверный список DEV UID');
['devGrantWeapons','devGrantShmot','devGrantCurrency','setDevFlag','setDevCombo','toggleDevKeyring','resetAllPlayers'].forEach(name => {
  const p = users.indexOf('function ' + name + '(){');
  if(p < 0 || users.indexOf('if(!$this->_requireDevUser()) return;', p) < p || users.indexOf('if(!$this->_requireDevUser()) return;', p) > p + 180) {
    throw new Error(name + ': нет серверной проверки DEV UID');
  }
});

const select = read('_client/src/game/shell/overlays/bosses_select.js');
must(select, 'const medalKilled =', 'вывод медалей должен использовать отдельный прогресс');
must(select, 'mSpr.alpha = medalKilled', 'медали не должны зависеть от общего числа убийств');
const migration = read('server/migrate42.php');
must(migration, "$data['medalKills']=array_fill(0,8,0);", 'миграция сброса медалей');

const energyPopup = read('_client/src/game/shell/popups/energy_buy.js');
['x:348, y:263', 'x:548, y:263', 'x:748, y:263', 'x:948, y:263',
 'x:348, y:463', 'x:548, y:463', 'x:748, y:463', 'x:948, y:463'].forEach(position => {
  must(energyPopup, position, 'карточки энергии должны быть сдвинуты на +80/+100');
});
console.log('OK sedoy/dev/roulette/medals');

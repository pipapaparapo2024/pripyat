/* Регрессии: доступ к боссу по зачищенной локации и последние UI-правки. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const must = (source, needle, label) => {
  if(!source.includes(needle)) throw new Error(label + ': ' + needle);
};

const serverBosses = read('server/core/controllers/bosses.php');
must(serverBosses, "if(!$this->_isLocCleared($user, intval($bossCfg['boss_loc'] ?? -1)))", 'проверка локации должна оставаться серверной');
must(serverBosses, "return intval($zoneData[$locIdx]['cleared'] ?? 0) >= 1;", 'вход к боссу требует завершённую зачистку');

const bossData = read('_client/src/game/bosses.js');
must(bossData, "gives_keys:[5],   boss_loc:4", 'Крыс выдаёт ровно один общий ключ Баркут/Борода');
const prefight = read('_client/src/game/shell/overlays/bosses_prefight.js');
must(prefight, "ki === 5 ? 'Ключ Баркут / Борода'", 'общее имя ключа выводится подсказкой при наведении');

const zoneScreen = read('_client/src/game/shell/overlays/zone_screen.js');
must(zoneScreen, "_ss(capBtn, 1.04)", 'кнопка захвата плавно увеличивается');
must(zoneScreen, "new PIXI.Text(String(l.amount)", 'уважение не сокращается');
must(zoneScreen, "fontWeight:'normal'", 'уважение выводится без жирного начертания');

const energy = read('_client/src/game/shell/popups/energy_buy.js');
['x:348, y:263', 'x:548, y:263', 'x:748, y:263', 'x:948, y:263', 'x:348, y:463', 'x:548, y:463', 'x:748, y:463', 'x:948, y:463'].forEach(p => must(energy, p, 'положение карточки энергии'));

const top = read('_client/src/game/svod/svod-leaderboard.js');
must(top, "resetTxt.x = 462; resetTxt.y = 496; resetTxt.scale.set(1.3);", 'новая позиция таймера сброса');
// 25.09.2026 (см. комментарий у nameTxt в svod-leaderboard.js): строка-пул для ника — ОДНА общая
// функция для всех вкладок Сводки (Общий топ/Друзья/Топ по урону/Топ по авторитету/Топ по
// достижениям), поэтому цвет ника везде одинаковый (белый), а не условный по tabCfg.cat.
must(top, "fontFamily:'Southbank LT', fontSize:13, fill:'#ffffff',", 'ник в топе урона (и во всех остальных вкладках) рендерится одной общей белой строкой');
console.log('OK zone/boss/UI fixes');

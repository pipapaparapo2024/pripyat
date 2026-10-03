/** Регрессии правил выдачи одежды: тайник, Зарики, карты и боссы. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
function ok(condition, message){
  if(condition) console.log('✅', message); else { console.error('❌', message); failed++; }
}

const dice = read('server/core/controllers/dice.php');
const diceCfg = JSON.parse(read('server/json/dice_config.json'));
// 02.10.2026: pity-система убрана (die_weights + _reducePremiumRoll() вместо гарантии 4×6) —
// dice.php сам больше нигде не читает/пишет pity_t как поле, но в доке-комментарии сверху файла
// объясняется ИСТОРИЯ этого удаления и упоминает старое имя поля ("pity/pity_t") — убираем
// строки-комментарии перед проверкой, иначе regex ловит прозу, а не код.
const diceCode = dice.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
ok(!('pity_min' in diceCfg) && !('pity_max' in diceCfg) && !('jackpot' in diceCfg), 'В конфиге Зариков нет pity-джекпота');
ok(!/while\(\$rolls\[0\]===6/.test(dice), 'Естественный 4×6 не перебрасывается');
ok(!/pity_t/.test(diceCode), 'dice.php не хранит и не обновляет pity');
ok(JSON.stringify(diceCfg.die_weights) === JSON.stringify([19, 19, 19, 19, 12, 12]), 'Шестёрка в Зариках имеет вес 12%');
const diceShmot = diceCfg.table.find(row => row.v === 6 && row.n === 4);
ok(diceShmot && diceShmot.type === 'shmot' && diceShmot.amt === 5, 'Только 4×6 выдают пять вещей из пула Зариков');

const blackjack = read('server/core/controllers/blackjack.php');
const blackjackCfg = JSON.parse(read('server/json/blackjack_config.json'));
const pokerCfg = JSON.parse(read('server/json/poker_config.json'));
ok(pokerCfg.roll_table.find(row => row.key === 'royal_flush').upto === 0.10, 'Роял-флеш в покере остаётся с шансом 0,1%');
ok(JSON.stringify(blackjackCfg.premium_shmot) === JSON.stringify({туз:67, король:89, дама:68}), 'AA/KK/QQ привязаны к предметам Картёжника');
ok(/grantShmotById\(\$user, \$shmotId\)/.test(blackjack), 'Карты выдают конкретный предмет на сервере');
ok(/\+ 100/.test(blackjack), 'При совпадении порогов старшие комбинации сдвигаются на 100 партий');
ok(JSON.stringify(blackjackCfg.premium_range) === JSON.stringify({qq:[8000,12000], kk:[70000,90000], aa:[90000,110000]}), 'Карты используют индивидуальные диапазоны QQ/KK/AA');

const yashik = read('server/core/controllers/yashik.php');
const stashCfg = JSON.parse(read('server/json/yashik_config.json'));
ok(stashCfg.lost_stash_sets.length === 3 && stashCfg.lost_stash_sets.every(s => s.items.length === 4 && Number.isInteger(s.hand)), 'Тайник содержит три сета: 4 обычные вещи и руку');
ok(/available\[array_rand\(\$available\)\]/.test(yashik), 'Первые четыре вещи текущего сета выбираются случайно');
ok(/: intval\(\$set\['hand'\]\)/.test(yashik), 'Вещь в руку выдаётся только когда остальные вещи сета собраны');
ok(!/shmot_chance_bp/.test(yashik), 'Обычный ящик не выдаёт случайную одежду');

const bosses = read('server/core/controllers/bosses.php');
ok(!/commonPoolDrop/.test(bosses) && !/shmot_drop_chance_pct/.test(bosses), 'У боссов нет независимого общего 5% дропа одежды');
const bossesCfg = JSON.parse(read('server/json/bosses_config.json'));
ok(bossesCfg.boss_shmot_normal_chance_pct === 50, 'Обычный цельный предмет из пула босса: 50%');
ok(JSON.stringify(bossesCfg.fragment_items) === JSON.stringify({'41':20, '42':20, '43':20}), 'Три стартовых предмета боссов собираются из 20 фрагментов');
const roulette = read('server/core/controllers/roulette.php');
ok(/KEYRING_CHANCE_DENOM\s*=\s*1000000/.test(roulette), 'Связка ключей: 1 к 1 000 000 на попытку при доступном 30-дневном окне');
ok(/\$tatuChancePct = 0;/.test(roulette), 'Тату из кейса рулетки отключено: 0%');
const shmot = read('_client/src/game/shmot.js');
const dvor = read('_client/src/game/dvor.js');
ok(!/giveRandom\(n\)\{/.test(shmot) && !/case 'shmot'/.test(dvor), 'Клиент не способен случайно выдать одежду');
process.exitCode = failed ? 1 : 0;

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const assert = (value, message) => {
    if(value) console.log('  OK', message);
    else { console.error('  FAIL', message); failed++; }
};

const blackjack = read('_client/src/game/dvor/dvor-blackjack.js');
const diceGame = read('_client/src/game/dvor/dvor-dice-game.js');
const diceBot = read('_client/src/game/dvor/dvor-dice.js');
const poker = read('_client/src/game/dvor/dvor-poker-game.js');
const rouletteClient = read('_client/src/game/dvor/dvor-roulette-minigame.js');
const rouletteServer = read('server/core/controllers/roulette.php');

const bjResolve = blackjack.slice(blackjack.indexOf("TS.php('blackjack.resolve'"));
const bjDeal = blackjack.slice(blackjack.indexOf("TS.php('blackjack.deal'"), blackjack.indexOf("proto._revealBlackjackCards"));
assert(!/shmotGranted/.test(bjDeal), 'blackjack does not look for resolve-only clothing reward during deal');
assert(/patch\.shmot[\s\S]*shmot\._loadFromUdata/.test(bjResolve), 'blackjack refreshes clothing after resolve reward');
assert(/patch\.shmot[\s\S]*shmot\._loadFromUdata/.test(diceGame), 'dice screen refreshes clothing after resolve reward');
assert(/patch\.shmot[\s\S]*shmot\._loadFromUdata/.test(diceBot), 'dice autobot refreshes clothing after resolve reward');
assert(/patch\.shmot[\s\S]*shmot\._loadFromUdata/.test(poker), 'poker refreshes clothing from the authoritative patch');

assert(/function claimPrize\(\)/.test(rouletteServer) && /add\(\$user, 'coins', 500\)/.test(rouletteServer),
    'guaranteed 500-ruble prize is granted by the server');
assert(/roulette_prize_choice|__prize_choice__/.test(rouletteServer), 'roulette prize choice is one-time server state');
assert(/function pickCup\(\)[\s\S]*patchCurrencies/.test(rouletteServer), 'risk-game rewards are granted and patched by the server');
assert(/TS\.php\('roulette\.claimPrize'/.test(rouletteClient), 'client claims guaranteed prize through the server');
assert(/TS\.php\('roulette\.pickCup'[\s\S]*applyPatch\(res\.patch\)/.test(rouletteClient), 'client applies risk-game server reward');

const choiceStart = rouletteClient.indexOf('proto._openJackpotChoice');
const riskStart = rouletteClient.indexOf('proto._buildRouletteMinigameWin');
const choiceCode = rouletteClient.slice(choiceStart, riskStart);
const riskCode = rouletteClient.slice(riskStart);
assert(!/Задний фон суперигра/.test(choiceCode), 'choice screen keeps the regular background');
assert(/Задний фон суперигра/.test(riskCode), 'new background opens only after choosing risk');
assert(fs.existsSync(path.join(root, '_client/development/images/Задний фон суперигра/Задний фон суперигра.png')),
    'supergame background asset exists in its dedicated folder');

if(failed) process.exit(1);

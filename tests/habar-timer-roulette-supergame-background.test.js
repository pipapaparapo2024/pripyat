const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const assert = (value, message) => {
    if(value) console.log('  OK', message);
    else { console.error('  FAIL', message); failed++; }
};

const habar = read('_client/src/game/habar.js');
const screen = read('_client/src/game/dvor/dvor-roulette-screen.js');
const minigame = read('_client/src/game/dvor/dvor-roulette-minigame.js');
const superBg = path.join(root, '_client/development/images/Задний фон суперигра/Задний фон суперигра.png');

assert(/btn\.visible = canCollect/.test(habar), 'habar collect button is hidden during cooldown');
assert(/btn\.interactive = canCollect/.test(habar), 'habar collect button cannot be clicked during cooldown');
assert(/timer\.text = hh \+ ':' \+ mm \+ ':' \+ ss/.test(habar), 'habar shows a live HH:MM:SS timer');
assert(!/notify\.showResult\(\{text:'Следующий сбор через/.test(habar), 'habar cooldown no longer opens an error popup');
// 03.10.2026: box y:332→320 (поднято на 12px, по прямому указанию).
assert(/_centerTextIn\(winnerAmtTxt, \{x:848, y:320, w:104, h:23\}\)/.test(screen), 'roulette winner amount uses the marked centered text box');
assert(/Задний фон суперигра\/Задний фон суперигра\.png/.test(minigame), 'super-prize opens the dedicated supergame background');
assert(fs.existsSync(superBg), 'supergame background asset exists');

if(failed) process.exit(1);

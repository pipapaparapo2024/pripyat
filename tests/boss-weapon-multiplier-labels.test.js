const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf8');
let failed = 0;
function assert(ok, msg){ if(ok) console.log('  OK', msg); else { console.error('  FAIL', msg); failed++; } }

assert(src.includes('3: {x:668, y:714}'), 'множитель мачете расположен по координатам редактора');
assert(src.includes('4: {x:751, y:714}'), 'множитель ствола расположен по координатам редактора');
assert(src.includes('5: {x:833, y:714}'), 'множитель автомата расположен по координатам редактора');
// 08.10.2026 (по прямому указанию, в этой же сессии): число доступных ударов (floor(qty/mult))
// возвращено — отдельной подписью НАД кнопкой мачете/ствола/автомата (переменная ammoLbl, 80px
// выше самого множителя), а не вместо текста множителя (тот и дальше показывает "×10" и т.п.,
// см. ассерт ниже про multLbl.text = mTxt). Старые ассерты здесь запрещали именно ВОЗВРАТ этой
// цифры в принципе (другая реализация, другое время) — пользователь подтвердил, что текущий
// возврат числа осознанный, старый guard устарел.
assert(src.includes('ammoLbl.text = String(Math.floor(qty / mult))'),
    'число доступных ударов (floor(qty/mult)) показывается в отдельной подписи ammoLbl НАД множителем');
assert(src.includes("multLbl.text = mTxt"), 'для каждого донатного оружия показывается выбранный множитель');
if(failed) process.exit(1);

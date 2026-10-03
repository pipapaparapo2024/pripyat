const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (value, message) => { if(!value) throw new Error(message); };

const popup = read('_client/src/game/shell/popups/energy_buy.js');
const expected = [
  ['кнопка энергии 50.png', 348, 263], ['кнопка энергии 110.png', 548, 263],
  ['кнопка энергии 180.png', 748, 263], ['кнопка энергии 400.png', 948, 263],
  ['кнопка энергии 850.png', 348, 463], ['кнопка энергии 1300.png.png', 548, 463],
  ['кнопка энергии 2000.png', 748, 463], ['кнопка энергии 3500.png.png', 948, 463],
];
assert(popup.includes("попап покупки энергии.png") && popup.includes('bgSpr.x = 226; bgSpr.y = 80;'), 'фон нового попапа находится на 226×80');
expected.forEach(([file, x, y]) => {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp("\\{file:'" + escaped + "',\\s*x:" + x + ', y:' + y + "\\}").test(popup), file + ' имеет позицию ' + x + '×' + y);
  assert(fs.existsSync(path.join(root, '_client/development/images/layers/popups/Энергия', file)), file + ' скопирован в клиентские ассеты');
});
assert(popup.includes("item: 'item' + (100 + i)"), 'восемь карточек вызывают item100–item107');
assert(popup.includes('window._makeModalDimmer(null, 0.55)'), 'энергетический попап использует общий dimmer');
const kit = read('_client/src/game/shell/ui_kit.js');
assert(kit.includes('window._makeModalDimmer'), 'общий helper затемнения существует');
const packs = JSON.parse(read('_client/src/data/energy_packs.json'));
assert(JSON.stringify(packs.map(x => [x.energy, x.votes])) === JSON.stringify([[50,3],[110,7],[180,10],[400,20],[850,40],[1300,60],[2000,85],[3500,120]]), 'пакеты энергии и цены совпадают с карточками');
console.log('OK energy popup assets and payments');

/**
 * Профиль игрока и итог Зарубы: игровой ник, открытие VK, состав действий и координаты.
 * Run: node tests/player-profile-nick-and-zaruba-layout.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const profile = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf8');
const preloader = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'preloader.js'), 'utf8');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

console.log('\nПрофиль и Заруба: никнеймы, действия и раскладка');
// 28.09.2026: const→let — ник теперь может переприсваиваться (сокращение длинной фамилии до
// первой буквы, если "Имя Фамилия" длиннее 15 символов, см.
// tests/vk-nick-long-surname-abbreviation.test.js), но сама логика заполнения пустого ника
// именем VK при первом входе не изменилась.
assert(/let vkNick = \[info\.first_name, info\.last_name\]\.filter\(Boolean\)\.join\(' '\)\.trim\(\);[\s\S]*?if\(!savedNick && vkNick\)/.test(preloader), 'при первом входе пустой игровой ник заполняется именем VK');
assert(/udata\['nick'\] = vkNick;[\s\S]*?TS\.php\('users\.save'/.test(preloader), 'начальный ник сохраняется в профиль игрока');
assert(/const nick = String\(profile\.nick \|\| ''\)\.trim\(\) \|\| String\(fallbackNick \|\| ''\)\.trim\(\)/.test(profile), 'игровой ник имеет приоритет над VK fallback');
assert(/profile\._setDisplayNick = \(resolvedNick\) =>/.test(profile), 'пустой старый ник заменяется именем VK после резолва профиля');
assert(/avatarSpr\.interactive = true; avatarSpr\.buttonMode = true;[\s\S]*?window\.open\('https:\/\/vk\.com\/id'/.test(profile), 'аватар визитки кликабелен и открывает VK');
assert(!/кнопка у друга просьба заначек\.png/.test(profile), 'кнопка просьбы заначек удалена');
assert(/if\(!String\(res\.target_nick \|\| ''\)\.trim\(\)\) res\.target_nick = profile\.displayNick/.test(profile), 'в Зарубе пустой серверный ник заменяется ником визитки');
assert(/const myNick = String\(udata\['nick'\] \|\| ''\)\.trim\(\)/.test(profile), 'вместо «Ты» выводится игровой ник атакующего');
// 25.09.2026 (по прямому указанию, редактор позиций — "силу проигравшего и победителя подними
// вверх на 18 пикселей"): было valueY 280/278, стало 262/260 (silaLabelY тоже -18: 240→222, 238→220).
assert(/won:  \{[^}]*silaLabelY: 222, valueY: 262 \}/.test(profile) && /lost: \{[^}]*silaLabelY: 220, valueY: 260 \}/.test(profile),
    'СИЛА (подпись+значение) поднята на 18px на обеих карточках');
// 25.09.2026 (по прямому указанию — "убери панель награды, не выдавай награду за победу"):
// панель награды Зарубы (сигареты/опыт под ней) убрана с клиента целиком — награда за победу
// больше не начисляется сервером, показывать в попапе результата нечего. Старая проверка
// координат cigTxt/expTxt заменена на проверку их ОТСУТСТВИЯ (см. подробный тест в
// zaruba-no-limit-no-reward-and-friend-damage-asymmetry.test.js).
assert(!/cigTxt\.x = 518/.test(profile) && !/expTxt\.x = 518/.test(profile), 'координаты cigTxt/expTxt панели награды убраны вместе с самой панелью');
console.log(`\n✅ All ${passed} tests passed`);

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const text = p => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (v, m) => { if(!v) throw new Error(m); };

const config = JSON.parse(text('server/json/bosses_config.json')).bosses;
const krys = config.find(x => x.id === 4), barkut = config.find(x => x.id === 5), boroda = config.find(x => x.id === 6);
assert(JSON.stringify(krys.gives_keys) === '[5]', 'Крыс выдаёт только общий ключ Баркута/Бороды');
assert(JSON.stringify(barkut.gives_keys) === '[7]', 'Баркут выдаёт ключ Жгута');
assert(JSON.stringify(boroda.gives_keys) === '[]', 'Борода не выдаёт ключ Жгута');
assert(barkut.key_slot === 5 && boroda.key_slot === 5, 'Баркут и Борода используют слот ключа Баркута');

const server = text('server/core/controllers/bosses.php');
assert(server.includes("$keySlot = intval($bossCfg['key_slot'] ?? $bossId);"), 'сервер берёт общий слот ключа');
assert(server.includes("$data['keys'][$keySlot]"), 'сервер проверяет и списывает общий слот');

const ui = text('_client/src/game/shell/overlays/bosses_prefight.js');
// 02.10.2026: текст тултипа написан с другой капитализацией ('Ключ Баркут / Борода', не
// 'КЛЮЧ БАРКУТ / БОРОДА') — сам факт общей подписи не изменился, обновлено под реальный регистр.
assert(ui.includes('Ключ Баркут / Борода'), 'возможная награда Крыса подписана общим ключом');
assert(ui.includes("const keySlot = (bData && bData.key_slot != null) ? bData.key_slot : bossIdx;"), 'клиент проверяет общий слот перед боем');
const select = text('_client/src/game/shell/overlays/bosses_select.js');
// 02.10.2026: мгновенный napA.scale.set(1.06) заменён плавной анимацией через общий
// window._ss(spr, target, speed) хелпер (ui_kit.js) — тот же итоговый scale 1.06 на hover,
// просто теперь анимированно, а не скачком.
assert(select.includes('_ss(napA, 1.06)'), 'у кнопки Напасть есть небольшой hover-scale');
console.log('OK boss shared key and hover');

const fs = require('fs');
const path = require('path');
let failed = 0;
const ok = (value, message) => { if(value) console.log('✅', message); else { console.error('❌', message); failed++; } };
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const iface = read('_client/src/game/interface.js');
const combat = read('_client/src/game/bosses/bosses-combat.js');
const popup = read('_client/src/game/onboarding/onboarding-popup.js');
const tour = read('_client/src/game/onboarding/onboarding-tour.js');
const hata = read('_client/src/game/shell/overlays/hata.js');
const bossSelect = read('_client/src/game/shell/overlays/bosses_select.js');
const bosses = JSON.parse(read('server/json/bosses_config.json'));

ok(/photo_50'\] \|\| info\['photo_100'\] \|\| info\['photo_200'\]/.test(iface), 'собственная аватарка использует photo_100/photo_200 из VK Bridge');
ok(/!rest\.length \|\| !window\.bridge \|\| !window\.VK_token/.test(combat), 'без токена не выполняется обречённый запрос чужих аватаров');
// 02.10.2026: пользователь сегодня добавил шаг 'permission' после 'final' (попап запроса
// доступа к друзьям) — на final теперь ТОЖЕ нужна кнопка «Продолжить» (ведёт на permission,
// не завершает сразу), поэтому showContinue стал безусловным true вместо `state !== 'final'`.
// MERGE_X/Y параллельно сдвинуты по месту (391,506 вместо 441,...) — координаты, не логика.
ok(/const MERGE_X = 391, MERGE_Y = 506/.test(popup) && /const showContinue = true;/.test(popup), 'в финале обучения тоже есть кнопка «Продолжить» (ведёт к попапу "permission"), «Слиться» на заданной позиции');
ok(/this\._playNarration\(tab\.sound\);/.test(tour) && !/this\._playNarration\(tab\.sound, \(\) => this\._advanceTour/.test(tour), 'озвучка сама не переключает следующий шаг тура');
ok(/!this\._getOwned\(\)\.includes\(this\._idx\)/.test(hata), 'неприобретённая активная база заменяется стартовой');
ok(JSON.stringify(bosses.bosses[4].gives_keys) === '[5]', 'Крыс выдаёт ровно один ключ Баркута');
ok(JSON.stringify(bosses.bosses[6].gives_keys) === '[]', 'Борода не выдаёт ключ Жгута');
ok(/stillInFlight/.test(bossSelect) && /<= 15/.test(bossSelect), 'локальная метка убийцы ограничена 15 секундами');
if(failed) process.exit(1);

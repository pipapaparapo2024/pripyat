const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const config = JSON.parse(read('server/json/poker_config.json'));
const expected = {
    royal_flush: ['shmot',1], straight_flush: ['stew',100], four_of_a_kind: ['stew',60],
    full_house: ['auto',40], flush: ['stew',15], straight: ['poker_spichki',300],
    three_of_a_kind: ['poker_spichki',300], two_pair: ['gun',5],
    pair: ['coins',20], high_card: ['poker_spichki',50]
};
for(const [key, reward] of Object.entries(expected)){
    assert.deepEqual([config.combos[key].type, config.combos[key].amt], reward, key);
}
const php = read('server/core/controllers/poker.php');
const resolve = php.slice(php.indexOf('function resolve(){'));
assert(resolve.indexOf('_grantWeaponReward($user') < resolve.indexOf('saveUser($user)'));
assert(resolve.includes("$session['active'] = false;"));
assert(resolve.includes('$clientReward = null;'));
assert(resolve.includes("$patchKeys[] = 'weapons';"));
assert(resolve.includes("$patchKeys[] = 'ammo_' . $c['type'];"));
const client = read('_client/src/game/dvor/dvor-poker-game.js');
assert(client.includes('weapons._loadFromUdata();'));
assert(!client.includes('weapons.grantAmmo('), 'no double or unsaved client award');
// 03.10.2026: заглушка-иконка сталкера убрана из рулетки целиком (по прямому указанию — "файл
// не нужен нигде") — проверяем единственный спрайт фото победителя (Texture.EMPTY), а не старый файл.
const roulette = read('_client/src/game/dvor/dvor-roulette-screen.js');
assert.equal((roulette.match(/const winnerPhotoSpr = new PIXI\.Sprite\(PIXI\.Texture\.EMPTY\);/g) || []).length, 1);
assert(!roulette.includes('рулетка иконка сталкера.png'));
console.log('Poker reward contracts and roulette single avatar checked');

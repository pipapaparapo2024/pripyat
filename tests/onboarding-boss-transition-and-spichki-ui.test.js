/** Regression tests for onboarding popup visibility, boss transition and live match counters.
 * Run: node tests/onboarding-boss-transition-and-spichki-ui.test.js */
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function assert(ok, message){
  if(ok){ console.log('  ✅', message); passed++; }
  else { console.error('  ❌ FAIL:', message); failed++; }
}
const root = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(root, '_client/src/game/onboarding/onboarding-popup.js'), 'utf8');
const tour = fs.readFileSync(path.join(root, '_client/src/game/onboarding/onboarding-tour.js'), 'utf8');
const fight = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/bosses_fight.js'), 'utf8');
const roulette = fs.readFileSync(path.join(root, '_client/src/game/dvor/dvor-roulette-buy.js'), 'utf8');
const poker = fs.readFileSync(path.join(root, '_client/src/game/dvor/dvor-poker-bag.js'), 'utf8');

console.log('\n1) Попап валюты вновь видим после скрытия на шаге позывного');
assert(/Onboarding\.prototype\._showPopup = function\(state\)\{[\s\S]{0,700}this\._popupWin\.visible = true;/.test(popup), 'каждый показ попапа возвращает контейнеру visible=true');
assert(/state === 'currency'[\s\S]{0,220}this\._showPopup\('final'\)/.test(popup), 'валютный шаг по окончании реплики ведёт к следующему попапу');

console.log('\n2) Запуск боя не считается выходом из раздела боссов');
assert(/const hadHud = Array\.isArray\(iface\._hudStack\)[\s\S]{0,200}originalPopHud\(id\)/.test(tour), 'хук отличает настоящее закрытие экрана от очистки отсутствующего HUD');
assert(/id === 'bossSelect' && iface\._onboardingBossScreenTransition/.test(tour), 'переход из выбора в бой помечен как технический');
assert(/this\._onboardingBossScreenTransition = true;[\s\S]{0,160}this\.popHud\('bossSelect'\);[\s\S]{0,120}this\._onboardingBossScreenTransition = false;/.test(fight), 'флаг окружает только смену выбора боссов на боёвку');
assert(/if\(hadHud && this\._activeTourKey/.test(tour), 'обучение продолжает шаг только после реального закрытия открытого экрана');

console.log('\n3) Спички обновляются сразу после открытия');
assert(/applyPatch\(res\.patch\);[\s\S]{0,500}this\._updateRouletteUI\(\);/.test(roulette), 'после открытия кейса рулетки немедленно обновляется её счётчик спичек');
assert(/applyPatch\(res\.patch\);[\s\S]{0,500}this\._updatePokerUI\(\);/.test(poker), 'после открытия сумки покера немедленно обновляется её счётчик спичек');

console.log(`\n${'─'.repeat(50)}`);
if(failed){ console.error(`❌ ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`✅ All ${passed} tests passed`);

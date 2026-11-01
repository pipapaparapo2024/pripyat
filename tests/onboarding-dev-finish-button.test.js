const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const iface = read('_client/src/game/interface.js');
const onboarding = read('_client/src/game/onboarding.js');

assert(iface.includes("const DEV_UIDS = ['1113977365', '382448269', '438953352', '184138040'];"),
    'кнопка использует существующий whitelist Dev-панели');
assert(iface.includes("String(udata['onboarding_step'] || 'intro') !== 'done'"),
    'кнопка доступна только при незавершённом onboarding_step');
assert(iface.includes("new PIXI.Text('ЗАКОНЧИТЬ ОБУЧЕНИЕ'"),
    'на главном HUD создана кнопка досрочного завершения');
assert(iface.includes("onboarding.finishEarlyForDev();"),
    'кнопка не меняет данные сама, а вызывает единый путь Onboarding');
assert(iface.includes("pripyat:onboarding-step-changed"),
    'HUD обновляет видимость сразу после смены шага');
assert(/finishEarlyForDev\(\)\{[\s\S]*?this\._currentStep\(\) === 'done'[\s\S]*?this\._finish\(\);/.test(onboarding),
    'досрочное завершение не действует повторно и использует штатный cleanup/save');
assert(onboarding.includes("new CustomEvent('pripyat:onboarding-step-changed', {detail:{step}})"),
    'смена onboarding_step уведомляет HUD');

console.log('Dev-кнопка досрочного завершения обучения: доступ, видимость и штатное завершение проверены');

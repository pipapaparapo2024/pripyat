const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const iface = read('_client/src/game/interface.js');
const onboarding = read('_client/src/game/onboarding.js');
const tour = read('_client/src/game/onboarding/onboarding-tour.js');
const guided = read('_client/src/game/onboarding/guided-tour.js');
const popup = read('_client/src/game/onboarding/onboarding-popup.js');

assert(iface.includes("const DEV_UIDS = ['1113977365', '382448269', '438953352', '184138040'];"),
    'кнопка использует существующий whitelist Dev-панели');
assert(iface.includes("String(udata['onboarding_step'] || 'intro') !== 'done'"),
    'кнопка доступна только при незавершённом onboarding_step');
assert(iface.includes("new PIXI.Text('ЗАКОНЧИТЬ ОБУЧЕНИЕ'"),
    'на главном HUD создана кнопка досрочного завершения');
assert(iface.includes('root.layer2_mc.addChild(_finishOnboardingBtn);'),
    'кнопка вынесена над HUD и обучающим blocker, а не блокируется вместе с игровыми вкладками');
assert(iface.includes('PIXI.Ticker.shared.add(this._keepDevOnboardingButtonOnTop);'),
    'кнопка возвращается выше каждого overlay обучения');
assert(iface.includes('_bringDevOnboardingFinishButtonToFront'),
    'оверлеи могут поставить Dev-кнопку выше себя после собственного ticker');
assert(tour.includes('iface._bringDevOnboardingFinishButtonToFront()'),
    'тур ставит Dev-кнопку выше своего blocker после перестановки слоя');
assert(guided.includes('iface._bringDevOnboardingFinishButtonToFront()'),
    'поясняющие попапы ставят Dev-кнопку выше своего blocker после перестановки слоя');
assert(iface.includes("onboarding.finishEarlyForDev();"),
    'кнопка не меняет данные сама, а вызывает единый путь Onboarding');
assert(iface.includes("pripyat:onboarding-step-changed"),
    'HUD обновляет видимость сразу после смены шага');
assert(/finishEarlyForDev\(\)\{[\s\S]*?this\._currentStep\(\) === 'done'[\s\S]*?this\._finish\(\);/.test(onboarding),
    'досрочное завершение не действует повторно и использует штатный cleanup/save');
assert(onboarding.includes("new CustomEvent('pripyat:onboarding-step-changed', {detail:{step}})"),
    'смена onboarding_step уведомляет HUD');
assert(onboarding.includes('_setTutorialHudBlocked(blocked)'),
    'единый барьер выключает игровые элементы HUD во время обучения');
assert(popup.includes('this._setTutorialHudBlocked(true)'),
    'обычные попапы обучения также блокируют HUD');
assert(popup.includes('this._setTutorialHudBlocked(false)'),
    'после закрытия обучения HUD разблокируется');

console.log('Dev-кнопка досрочного завершения обучения: доступ, видимость и штатное завершение проверены');

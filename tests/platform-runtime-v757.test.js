const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('_client/src/modules/platform-runtime.js', 'utf8')
    .replace("import { detectPlatform, isVk } from './platform.js';", "const detectPlatform = () => 'vk'; const isVk = () => true;")
    .replace(/export /g, '');

const calls = [];
const bridge = {
    send(method, params){ calls.push({kind:'send', method, params}); return Promise.resolve({ok:true}); },
    sendPromise(method, params){ calls.push({kind:'sendPromise', method, params}); return Promise.resolve({response: params && params.method === 'friends.getAppUsers' ? [22] : {items:[{id:22}]}}); },
    subscribe(listener){ calls.push({kind:'subscribe'}); listener({detail:{type:'VKWebAppViewHide'}}); },
};
const context = {window:{VK_token:'launch-token', VK_version:'5.132'}, Promise, Object, String, parseInt, encodeURIComponent};
vm.runInNewContext(source + ';this.createVkOkRuntime=createVkOkRuntime;this.installPlatformRuntime=installPlatformRuntime;', context);

const runtime = context.createVkOkRuntime({bridge, launchParams:{
    vk_app_id:'54574178', vk_user_id:'438953352', vk_ts:'1700000000', access_token:'launch-token', sign:'signed', reward:'ignored',
}});

assert.equal(runtime.platform, 'vk');
assert.equal(runtime.getPlayerId(), '438953352');
assert.equal(runtime.getAppId(), '54574178');
assert.deepEqual(JSON.parse(JSON.stringify(runtime.getSignedLaunchParams())), {
    vk_app_id:'54574178', vk_user_id:'438953352', vk_ts:'1700000000', sign:'signed',
});
assert.equal(context.installPlatformRuntime(runtime), runtime);
assert.throws(() => context.installPlatformRuntime({}), /Invalid platform runtime/);

(async () => {
    await runtime.initialize();
    await runtime.setSwipeHistory(false);
    await runtime.startNativePurchase('item2');
    await runtime.share('https://vk.com/app54574178_438953352');
    const friends = await runtime.getVkFriends();
    assert.equal(friends.friends.response.items[0].id, 22);
    assert.deepEqual(friends.appUsers.response, [22]);
    assert.equal(runtime.profileUrl(42), 'https://vk.com/id42');
    assert.equal(runtime.recoveryAppId(), '54574178');
    assert(calls.some(call => call.method === 'VKWebAppInit'), 'инициализация должна остаться VK-совместимой');
    assert(calls.some(call => call.method === 'VKWebAppSetSwipeSettings' && call.params.history === false), 'настройка свайпа потеряна');
    assert(calls.some(call => call.method === 'VKWebAppShowOrderBox' && call.params.item === 'item2'), 'платёж не дошёл до старого host API');
    assert(calls.some(call => call.method === 'VKWebAppShare'), 'шеринг не передан в host API');

    const index = fs.readFileSync('_client/src/index.js', 'utf8');
    const preloader = fs.readFileSync('_client/src/game/preloader.js', 'utf8');
    const server = fs.readFileSync('_client/src/modules/server.js', 'utf8');
    assert(index.includes('createVkOkRuntime') && index.includes('window.gameSession = Object.freeze'), 'bootstrap не создаёт platform runtime и нейтральную сессию');
    assert(preloader.includes("runtime().getSignedLaunchParams()"), 'авторизация всё ещё собирает launch-параметры внутри прелоадера');
    assert(preloader.includes("runtime().getServerTime()"), 'время всё ещё запрашивается прелоадером через VK напрямую');
    assert(preloader.includes("runtime().getVkFriends()"), 'список друзей не вынесен за runtime-границу');
    assert(server.includes('runtimePlatform') && server.includes("runtimePlatform || detectPlatform()"), 'запросы не используют runtime как единый источник platform metadata');
    assert(!fs.existsSync('database/migrations'), 'этот рефакторинг не должен добавлять миграции БД');
    console.log('Platform runtime: VK/OK compatibility contract, identity boundary and no database migration passed');
})().catch(error => { console.error(error); process.exitCode = 1; });

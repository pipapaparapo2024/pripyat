/**
 * Test: 05.10.2026, повторный отказ модерации ОК (п.1 — "фоновый запрос доступа к друзьям на
 * каждой сессии"). Разбор показал, что реальные вызывающие места (interface.js HUD-кнопка,
 * svod-leaderboard.js вкладка «Друзья») используют force:true (явный клик игрока — правило
 * 2.6.3 разрешает без ограничений), а автоматический путь (onboarding) гейтится отдельно,
 * server-side полем onboarding_step. Тем не менее по прямому указанию пользователя
 * friends-scope-gate.js переведён с localStorage (ненадёжен в embed-обёртках площадок, не
 * переживает чистку между запусками) на VKWebAppStorageGet/Set (хранится на сервере VK,
 * привязано к аккаунту, не к устройству) — тот же принцип, что уже применён к
 * friends_scope_granted на сервере игры.
 *
 * Этот тест РЕАЛЬНО ИСПОЛНЯЕТ извлечённый код модуля (vm), с мок-объектом window.bridge,
 * имитирующим VKWebAppStorageGet/Set через in-memory Map — не копия-переписка логики, а
 * настоящие функции из friends-scope-gate.js.
 *
 * Run: node tests/friends-scope-gate-vk-storage-04-10.test.js
 */
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = read('_client/src/modules/friends-scope-gate.js');

// Убираем ES-модульный export/import (vm.Script не умеет ES-модули без экспериментального API) —
// сами ИМЕНА функций/тело не трогаем, только синтаксис объявления.
const executable = src
    .replace(/^export (async function|function)/gm, '$1')
    .replace(/^import .*$/gm, '');

function makeFakeLocalStorage(){
    const store = {};
    return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        _dump: () => ({ ...store }),
    };
}

function makeFakeVkStorage(){
    const store = {};
    return {
        store,
        bridge: {
            sendPromise: (method, params) => {
                if (method === 'VKWebAppStorageGet') {
                    const keys = params.keys.map(key => ({ key, value: store[key] !== undefined ? store[key] : '' }));
                    return Promise.resolve({ keys });
                }
                if (method === 'VKWebAppStorageSet') {
                    store[params.key] = String(params.value);
                    return Promise.resolve({ key: params.key, value: params.value });
                }
                return Promise.reject(new Error('unexpected method ' + method));
            },
        },
    };
}

async function run(){
    console.log('\nTest 1: shouldAskFriendsScopeAsync() предпочитает значение из VK Storage, а не localStorage');
    {
        const ls = makeFakeLocalStorage();
        const vkStorage = makeFakeVkStorage();
        // VK Storage говорит "запуск №5" (давно), localStorage врёт "запуск №0" (как будто
        // только что установили — имитация сброшенного embed-хранилища ОК).
        vkStorage.store['pripyat_launch_count'] = '5';
        const ctx = { localStorage: ls, window: { bridge: vkStorage.bridge }, console };
        ctx.window.localStorage = ls;
        ctx.bridge = ctx.window.bridge;
        vm.createContext(ctx);
        vm.runInContext(executable, ctx);

        const should = await ctx.shouldAskFriendsScopeAsync();
        assert(should === true, 'доверяет значению из VK Storage (5 >= 2), игнорирует обнулённый localStorage');
    }

    console.log('\nTest 2: shouldAskFriendsScopeAsync() падает обратно на localStorage, если VK Storage недоступен');
    {
        const ls = makeFakeLocalStorage();
        ls.setItem('pripyat_launch_count', '5');
        const ctx = {
            localStorage: ls,
            window: { bridge: { sendPromise: () => Promise.reject(new Error('no bridge')) } },
            console,
        };
        ctx.window.localStorage = ls;
        ctx.bridge = ctx.window.bridge;
        vm.createContext(ctx);
        vm.runInContext(executable, ctx);

        const should = await ctx.shouldAskFriendsScopeAsync();
        assert(should === true, 'при ошибке VK Storage использует localStorage (5 >= 2) как фолбэк');
    }

    console.log('\nTest 3: shouldAskFriendsScopeAsync() уважает кулдаун 30 дней из VK Storage');
    {
        const ls = makeFakeLocalStorage();
        const vkStorage = makeFakeVkStorage();
        vkStorage.store['pripyat_launch_count'] = '10';
        vkStorage.store['pripyat_friends_last_asked_ms'] = String(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 дней назад
        const ctx = { localStorage: ls, window: { bridge: vkStorage.bridge }, console };
        ctx.window.localStorage = ls;
        ctx.bridge = ctx.window.bridge;
        vm.createContext(ctx);
        vm.runInContext(executable, ctx);

        const should = await ctx.shouldAskFriendsScopeAsync();
        assert(should === false, 'спрашивали 5 дней назад (< 30) — пропускает, даже если VK Storage (не localStorage) это подтверждает');
    }

    console.log('\nTest 4: markFriendsScopeAsked() пишет И в localStorage, И в VK Storage');
    {
        const ls = makeFakeLocalStorage();
        const vkStorage = makeFakeVkStorage();
        const ctx = { localStorage: ls, window: { bridge: vkStorage.bridge }, console };
        ctx.window.localStorage = ls;
        ctx.bridge = ctx.window.bridge;
        vm.createContext(ctx);
        vm.runInContext(executable, ctx);

        ctx.markFriendsScopeAsked();
        await new Promise(r => setTimeout(r, 10)); // дать промису VKWebAppStorageSet долететь

        assert(ls.getItem('pripyat_friends_scope_last_asked_ms') !== null, 'записано в localStorage');
        assert(vkStorage.store['pripyat_friends_last_asked_ms'] !== undefined, 'записано в VK Storage (не только локально)');
    }

    console.log('\nTest 5: registerLaunch() остаётся синхронным и localStorage-only (вызывается до VKWebAppInit)');
    {
        const ls = makeFakeLocalStorage();
        const ctx = { localStorage: ls, window: {}, console };
        ctx.window.localStorage = ls;
        ctx.bridge = ctx.window.bridge;
        vm.createContext(ctx);
        vm.runInContext(executable, ctx);

        const result = ctx.registerLaunch(); // НЕ await — должно быть синхронным числом, не Promise
        assert(typeof result === 'number', 'возвращает число синхронно (не Promise) — безопасно вызывать до готовности bridge');
        assert(ls.getItem('pripyat_launch_count') === '1', 'инкрементирует localStorage-счётчик');
    }

    console.log('\nTest 6: syncLaunchCountToServerStorage() берёт МАКСИМУМ из локального и серверного значения (не теряет прогресс ни одной из сторон)');
    {
        const ls = makeFakeLocalStorage();
        ls.setItem('pripyat_launch_count', '3');
        const vkStorage = makeFakeVkStorage();
        vkStorage.store['pripyat_launch_count'] = '7';
        const ctx = { localStorage: ls, window: { bridge: vkStorage.bridge }, console };
        ctx.window.localStorage = ls;
        ctx.bridge = ctx.window.bridge;
        vm.createContext(ctx);
        vm.runInContext(executable, ctx);

        await ctx.syncLaunchCountToServerStorage();
        assert(ls.getItem('pripyat_launch_count') === '7', 'локальный счётчик подтянут до большего серверного значения');
        assert(vkStorage.store['pripyat_launch_count'] === '7', 'серверное значение не уменьшилось');
    }

    console.log('\nTest 7: hasFriendsScopeGrantedLocal()/markFriendsScopeGranted() остаются синхронными (локальный кэш, не блокирующий UI)');
    {
        const ls = makeFakeLocalStorage();
        const ctx = { localStorage: ls, window: {}, console };
        ctx.window.localStorage = ls;
        ctx.bridge = ctx.window.bridge;
        vm.createContext(ctx);
        vm.runInContext(executable, ctx);

        assert(ctx.hasFriendsScopeGrantedLocal() === false, 'изначально не согласился');
        ctx.markFriendsScopeGranted();
        assert(ctx.hasFriendsScopeGrantedLocal() === true, 'после markFriendsScopeGranted() — true, синхронно');
    }

    console.log(`\n${'─'.repeat(50)}`);
    if (failed === 0) console.log(`✅ All ${passed} tests passed`);
    else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
}

run().catch(e => { console.error('❌ Необработанная ошибка теста:', e); process.exit(1); });

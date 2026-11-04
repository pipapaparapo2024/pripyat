import { detectPlatform, isVk } from './platform.js';

// Runtime boundary for host-specific APIs. Game code must depend on this
// contract instead of the shape of a particular launch URL or SDK.
//
// This first implementation deliberately preserves VK/OK byte-for-byte
// behaviour. Telegram is not enabled here: it will receive a separate
// authenticated runtime after server-side initData verification exists.
export const PLATFORM_CAPABILITIES = Object.freeze({
    vk: Object.freeze({ friendsPermission: true, vkStorage: true, nativeShare: true }),
    ok: Object.freeze({ friendsPermission: true, vkStorage: true, nativeShare: true }),
    telegram: Object.freeze({ friendsPermission: false, vkStorage: false, nativeShare: false }),
});

function requiredBridge(bridge){
    if(!bridge || typeof bridge.send !== 'function') throw new Error('Platform bridge is unavailable');
    return bridge;
}

export function createVkOkRuntime({bridge, launchParams}){
    const params = launchParams || {};
    const platform = detectPlatform();
    const sdk = () => requiredBridge(bridge);
    const sendPromise = (method, params = {}) => {
        const active = sdk();
        if(typeof active.sendPromise === 'function') return active.sendPromise(method, params);
        return Promise.resolve(active.send(method, params));
    };

    return Object.freeze({
        platform,
        capabilities: PLATFORM_CAPABILITIES[platform] || PLATFORM_CAPABILITIES.vk,
        getLaunchParams: () => params,
        getPlayerId: () => String(params.vk_user_id || ''),
        getAppId: () => String(params.vk_app_id || ''),
        getAccessToken: () => params.access_token,
        getSignedLaunchParams: () => {
            const signed = {};
            Object.keys(params).forEach(key => { if(key.indexOf('vk') !== -1) signed[key] = params[key]; });
            signed.sign = params.sign;
            return signed;
        },
        initialize: () => sdk().send('VKWebAppInit'),
        setSwipeHistory: (history) => sdk().send('VKWebAppSetSwipeSettings', {history}),
        startNativePurchase: (item) => sdk().send('VKWebAppShowOrderBox', {type:'item',item}),
        callApi: (method, apiParams) => sendPromise('VKWebAppCallAPIMethod', {method, params: apiParams}),
        getServerTime: () => sendPromise('VKWebAppCallAPIMethod', {
            method: 'utils.getServerTime', params: {access_token: window.VK_token, v: window.VK_version},
        }),
        getCurrentUser: () => sendPromise('VKWebAppGetUserInfo'),
        requestFriendsToken: () => sendPromise('VKWebAppGetAuthToken', {
            app_id: parseInt(params.vk_app_id), scope: 'friends',
        }),
        getVkFriends: () => sendPromise('VKWebAppCallAPIMethod', {
            method: 'friends.get', params: {fields:'photo_50', access_token: window.VK_token, v: window.VK_version},
        }).then(friends => sendPromise('VKWebAppCallAPIMethod', {
            method:'friends.getAppUsers', params:{access_token:window.VK_token, v:window.VK_version},
        }).then(appUsers => ({friends, appUsers}))),
        storageGet: (keys) => sendPromise('VKWebAppStorageGet', {keys}),
        storageSet: (key, value) => sendPromise('VKWebAppStorageSet', {key, value: String(value)}),
        subscribe: (listener) => {
            if(bridge && typeof bridge.subscribe === 'function') bridge.subscribe(listener);
        },
        share: (link) => sdk().send('VKWebAppShare', {link}),
        profileUrl: (playerId) => 'https://vk.com/id' + encodeURIComponent(String(playerId)),
        recoveryAppId: () => isVk() ? String(params.vk_app_id || '') : null,
    });
}

export function installPlatformRuntime(runtime){
    if(!runtime || typeof runtime.getPlayerId !== 'function' || typeof runtime.getSignedLaunchParams !== 'function'){
        throw new Error('Invalid platform runtime');
    }
    return runtime;
}

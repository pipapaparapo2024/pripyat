// Explicit entry point for a dedicated Telegram TEST page. Never auto-detect by URL.
export async function loginTelegramTest({webApp, endpoint, inviteCode = '', rewardCode = '', fetchImpl = fetch}){
    if(!webApp || typeof webApp.initData !== 'string' || !webApp.initData){
        throw new Error('Откройте игру через Telegram-бота.');
    }
    const url = new URL(endpoint, window.location.href);
    if(url.origin !== window.location.origin || url.protocol !== 'https:'){
        throw new Error('Некорректный адрес входа Telegram.');
    }
    const response = await fetchImpl(url.href, {
        method:'POST', credentials:'omit', cache:'no-store', redirect:'error',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({init_data:webApp.initData,...(inviteCode?{invite_code:inviteCode}:{}),...(rewardCode?{reward_code:rewardCode}:{})}).toString(),
    });
    if(!response.ok){
        if(response.status===403){const denied=await response.json();if(denied.code==='telegram_access_denied')throw new Error(denied.text);}
        throw new Error('Не удалось войти через Telegram. Откройте игру заново.');
    }
    const session = await response.json();
    if(session.platform !== 'telegram' || !['test','prod'].includes(session.environment)
        || !/^[1-9][0-9]*$/.test(session.player_id) || Number(session.player_id)>2147483647
        || !/^[a-f0-9]{64}$/.test(session.token) || !/^[a-f0-9]{32}$/.test(session.req_key) || !Number.isInteger(session.expires_at)){
        throw new Error('Некорректный ответ входа Telegram.');
    }
    // Session stays in memory. initDataUnsafe is never used as an identity.
    return Object.freeze(session);
}

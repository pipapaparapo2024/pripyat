export function createTelegramRuntime(session, webApp){
    const avatars=new Map();
    const getAvatar=id=>{
        const key=String(id==null||id===''?session.player_id:id);
        if(!/^[1-9][0-9]{0,9}$/.test(key)||Number(key)>2147483647)return Promise.resolve(null);
        if(typeof window==='undefined'||!window.TS)return Promise.resolve(null);
        if(avatars.has(key))return avatars.get(key);
        const promise=new Promise(resolve=>{
            window.TS.php('telegramavatars.get',{player_id:key},data=>{
                const url=data.photo_url;
                resolve(typeof url==='string'&&/^https:\/\/tg-test-pripyat-game\.ru\/images\/telegram-avatars\/[a-f0-9]{64}\.jpg\?v=[0-9]+$/.test(url)?url:null);
            },()=>resolve(null));
        });avatars.set(key,promise);return promise;
    };
    const noApi=()=>Promise.reject(new Error('Эта функция ещё не подключена в Telegram TEST.'));
    return Object.freeze({
        platform:'telegram',capabilities:Object.freeze({friendsPermission:false,vkStorage:false,nativeShare:false,purchases:true}),
        getRoles:()=>Object.freeze([...(session.roles||[])]),
        getRewardCode:()=>typeof session.reward_code==='string'?session.reward_code:null,
        getPlayerId:()=>session.player_id,getAppId:()=>'telegram-test',getLaunchParams:()=>({}),getSignedLaunchParams:()=>({}),getAccessToken:()=>null,
        initialize:()=>{webApp.ready();webApp.expand();return Promise.resolve();},
        setSwipeHistory:()=>Promise.resolve(),
        getServerTime:()=>Promise.resolve({response:session.expires_at-3600}),
        getAvatar,
        getCurrentUser:()=>getAvatar(session.player_id).then(url=>({...session.profile,photo_50:url})),
        requestFriendsToken:noApi,getVkFriends:()=>Promise.resolve({friends:{response:{items:[]}},appUsers:{response:[]}}),callApi:noApi,
        storageGet:keys=>Promise.resolve({keys:keys.map(key=>({key,value:''}))}),storageSet:()=>Promise.resolve(),
        startNativePurchase:noApi,share:noApi,profileUrl:()=>null,recoveryAppId:()=>null,
        subscribe:listener=>{
            if(typeof webApp.onEvent!=='function')return;
            webApp.onEvent('deactivated',()=>listener({detail:{type:'VKWebAppViewHide'}}));
            webApp.onEvent('activated',()=>listener({detail:{type:'VKWebAppViewRestore'}}));
        },
    });
}

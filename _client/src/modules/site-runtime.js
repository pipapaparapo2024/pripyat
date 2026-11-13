export function createSiteRuntime(session){
 const getAvatar=id=>new Promise(resolve=>{
  if(session.platform!=='telegram'&&String(id||session.player_id)===String(session.player_id)){resolve(session.avatar_url||null);return;}
  if(!window.TS){resolve(null);return;}
  const method=session.platform==='telegram'?'telegramavatars.get':'siteavatars.get';
  window.TS.php(method,{player_id:String(id||session.player_id)},data=>{
   const url=data.photo_url;
   const allowed=typeof url==='string'&&(session.platform==='telegram'
    ?/^https:\/\/(?:tg-test-pripyat-game\.ru\/images|pripyat-game-site\.ru\/telegram\/images)\/telegram-avatars\/[a-f0-9]{64}\.jpg\?v=[0-9]+$/.test(url)
    :url.startsWith('/assets/avatars/')||(session.platform!=='site'&&/^https:\/\//.test(url)));
   resolve(allowed?url:null);
  },()=>resolve(null));
 });
 const unavailable=()=>Promise.reject(new Error('Эта функция пока недоступна на сайте.'));
 return Object.freeze({
  platform:'site',capabilities:Object.freeze({friendsPermission:false,vkStorage:false,nativeShare:false,purchases:false}),
  getRoles:()=>Object.freeze([...(session.roles||[])]),getRewardCode:()=>session.reward_code||null,getPlayerId:()=>session.player_id,getAppId:()=>'site-test',
  getLaunchParams:()=>({}),getSignedLaunchParams:()=>({}),getAccessToken:()=>null,
  initialize:()=>Promise.resolve(),setSwipeHistory:()=>Promise.resolve(),
  getServerTime:()=>Promise.resolve({response:Math.floor(Date.now()/1000)}),
  getAvatar,getCurrentUser:()=>getAvatar(session.player_id).then(url=>({id:session.player_id,first_name:session.profile?.first_name||'Сталкер',last_name:session.profile?.last_name||'',photo_50:url})),
  requestFriendsToken:unavailable,getVkFriends:()=>Promise.resolve({friends:{response:{items:[]}},appUsers:{response:[]}}),
  callApi:(method,params={})=>method==='users.get'?new Promise((resolve,reject)=>window.TS.php('siteprofiles.get',{ids:String(params.user_ids||session.player_id)},data=>resolve({response:data.players}),reject)):unavailable(),
  storageGet:keys=>Promise.resolve({keys:keys.map(key=>({key,value:''}))}),storageSet:()=>Promise.resolve(),
  startNativePurchase:unavailable,share:unavailable,profileUrl:()=>null,recoveryAppId:()=>null,subscribe(){},
 });
}

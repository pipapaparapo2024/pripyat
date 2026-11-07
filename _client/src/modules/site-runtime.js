export function createSiteRuntime(session){
 const getAvatar=id=>new Promise(resolve=>{
  if(String(id||session.player_id)===String(session.player_id)){resolve(session.avatar_url||null);return;}
  if(!window.TS){resolve(null);return;}
  window.TS.php('siteavatars.get',{player_id:String(id)},data=>resolve(typeof data.photo_url==='string'&&(data.photo_url.startsWith('/assets/avatars/')||(session.platform!=='site'&&/^https:\/\//.test(data.photo_url)))?data.photo_url:null),()=>resolve(null));
 });
 const unavailable=()=>Promise.reject(new Error('Эта функция пока недоступна на сайте.'));
 return Object.freeze({
  platform:'site',capabilities:Object.freeze({friendsPermission:false,vkStorage:false,nativeShare:false,purchases:false}),
  getRoles:()=>Object.freeze([...(session.roles||[])]),getRewardCode:()=>session.reward_code||null,getPlayerId:()=>session.player_id,getAppId:()=>'site-test',
  getLaunchParams:()=>({}),getSignedLaunchParams:()=>({}),getAccessToken:()=>null,
  initialize:()=>Promise.resolve(),setSwipeHistory:()=>Promise.resolve(),
  getServerTime:()=>Promise.resolve({response:Math.floor(Date.now()/1000)}),
  getAvatar,getCurrentUser:()=>Promise.resolve({id:session.player_id,first_name:'Сталкер',last_name:'',photo_50:session.avatar_url||null}),
  requestFriendsToken:unavailable,getVkFriends:()=>Promise.resolve({friends:{response:{items:[]}},appUsers:{response:[]}}),
  callApi:(method,params={})=>method==='users.get'?new Promise((resolve,reject)=>window.TS.php('siteprofiles.get',{ids:String(params.user_ids||session.player_id)},data=>resolve({response:data.players}),reject)):unavailable(),
  storageGet:keys=>Promise.resolve({keys:keys.map(key=>({key,value:''}))}),storageSet:()=>Promise.resolve(),
  startNativePurchase:unavailable,share:unavailable,profileUrl:()=>null,recoveryAppId:()=>null,subscribe(){},
 });
}

/* Authenticated native Bridge profile -> own game-ID cache. No credentials are stored here. */
(()=>{
 let attempts=0;
 const timer=setInterval(()=>{
  if(++attempts>90){clearInterval(timer);return;}
  const runtime=window.platformRuntime,info=window.vk_user_info;
  if(!runtime||!['vk','ok'].includes(runtime.platform)||!window.TS?.token||!info)return;
  const photo=info.photo_200||info.photo_100||info.photo_50;
  if(typeof photo!=='string'||!photo.startsWith('https://'))return;
  clearInterval(timer);window.TS.php('users.cacheAvatar',{url:photo},()=>{},()=>{});
 },1000);
})();

(async()=>{
 const buttons=[...document.querySelectorAll('.providers button')];
 try{
  const response=await fetch('/auth/status',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;
  const status=await response.json();
  try{
   const tgResponse=await fetch('/auth/telegram-prod/status',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(2500)});
   if(tgResponse.ok){const telegram=await tgResponse.json();status.providers={...status.providers,telegram:telegram.providers?.telegram===true};if(telegram.authenticated){status.authenticated=true;status.platform='telegram';status.telegram_authenticated=true;}}
  }catch(_){/* Keep Telegram login unavailable while other login methods remain usable. */}
  const beginLogin=(platform,retry=false)=>{
    const params=new URL(location.href).searchParams,code=params.get('reward')||'',target=params.get('platform')||'';
    if(code&&target!==platform){document.querySelector('.entry p').textContent='Для этой награды выберите площадку, указанную в ссылке.';return;}
    const query=new URLSearchParams();
    if(code){query.set('reward',code);if(platform==='site')query.set('platform',platform);}
    if(retry)query.set('retry','1');
    const path=platform==='site'?'/account/':(platform==='telegram'?'/auth/telegram-prod/start':'/auth/'+platform+'/start');
    location.href=path+(query.size?'?'+query:'');
  };
  for(const button of buttons){
   const platform=button.dataset.provider;
   if(!status.providers?.[platform])continue;
   button.disabled=false;
   button.addEventListener('click',()=>beginLogin(platform));
  }
  const retry=document.getElementById('vk-login-retry');
  if(retry&&status.providers?.vk){
   retry.hidden=false;
   retry.addEventListener('click',()=>beginLogin('vk',true));
  }
  if(status.authenticated){const link=document.createElement('a');link.href=status.telegram_authenticated?'/game/telegram.html?auth=telegram-prod':status.needs_character_link?'/auth/social/link':'/game/'+(new URL(location.href).searchParams.has('reward')?'?'+new URL(location.href).searchParams:'');link.textContent=status.needs_character_link?'Подключить персонажа':'Продолжить игру';document.querySelector('.entry').append(link);}

 }catch(_){/* Keep login buttons disabled when auth is unavailable. */}
})();

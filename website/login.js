(async()=>{
 const buttons=[...document.querySelectorAll('.providers button')];
 const keys=['vk','ok','telegram','site'];
 try{
  const response=await fetch('/auth/status',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;
  const status=await response.json();
  for(let i=0;i<buttons.length;i++){
   const platform=keys[i];if(!status.providers?.[platform])continue;
   buttons[i].disabled=false;
   buttons[i].addEventListener('click',()=>{
    const params=new URL(location.href).searchParams,code=params.get('reward')||'',target=params.get('platform')||'';
    if(code&&target!==platform){document.querySelector('.entry p').textContent='Для этой награды выберите площадку, указанную в ссылке.';return;}
    location.href='/auth/'+platform+'/start'+(code?'?'+new URLSearchParams({reward:code}):'');
   });
  }
  if(status.authenticated){const link=document.createElement('a');link.href='/game/';link.textContent='Продолжить игру';document.querySelector('.entry').append(link);}
  if(status.providers?.telegram)document.querySelector('.entry p').textContent='Для допущенных участников доступен вход через Telegram.';
 }catch(_){/* Keep the preparation page when auth is unavailable. */}
})();

(async()=>{
 const buttons=[...document.querySelectorAll('.providers button')];
 try{
  const response=await fetch('/auth/status',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;
  const status=await response.json();
  for(let i=0;i<buttons.length;i++){
   const platform=buttons[i].dataset.provider;if(!status.providers?.[platform])continue;
   buttons[i].disabled=false;
   buttons[i].addEventListener('click',()=>{
    const params=new URL(location.href).searchParams,code=params.get('reward')||'',target=params.get('platform')||'';
    if(code&&target!==platform){document.querySelector('.entry p').textContent='Для этой награды выберите площадку, указанную в ссылке.';return;}
    location.href=platform==='site'?'/account/'+(code?'?'+new URLSearchParams({reward:code,platform}):''):'/auth/'+platform+'/start'+(code?'?'+new URLSearchParams({reward:code}):'');
   });
  }
  if(status.authenticated){const link=document.createElement('a');link.href=status.needs_character_link?'/auth/social/link':'/game/'+(new URL(location.href).searchParams.has('reward')?'?'+new URL(location.href).searchParams:'');link.textContent=status.needs_character_link?'Подключить персонажа':'Продолжить игру';document.querySelector('.entry').append(link);}

 }catch(_){/* Keep login buttons disabled when auth is unavailable. */}
})();

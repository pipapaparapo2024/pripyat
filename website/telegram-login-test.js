(async()=>{
 const button=document.getElementById('telegram-test-login');
 const status=document.getElementById('telegram-test-status');
 try{
  const ticket=new URLSearchParams(location.hash.slice(1)).get('tg_test');
  history.replaceState(null,'',location.pathname+location.search);
  if(!ticket){status.textContent='Доступ закрыт. Откройте персональную ссылку тестирования.';return;}
  const response=await fetch('/auth/telegram/status',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('status');
  const session=await response.json();
  const grant=await fetch('/auth/telegram/test-access',{
   method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({csrf:session.csrf||'',ticket})
  });
  if(!grant.ok)throw new Error('grant');
  status.textContent='Тестовый доступ подтверждён. Можно продолжить вход.';
  button.disabled=false;
  button.addEventListener('click',()=>{location.href='/auth/telegram/start';},{once:true});
 }catch(_){
  status.textContent='Не удалось открыть тестовый вход. Ссылка могла истечь — запросите новую.';
 }
})();

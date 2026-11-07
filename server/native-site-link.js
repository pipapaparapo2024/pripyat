/* Dual consent: code from website, signed native launch, explicit native confirmation. */
(()=>{
 if(window.__siteRuntime)return;
 const timer=setInterval(()=>{
  if(!window.vk_params?.sign||!window.TS?.token)return;clearInterval(timer);
  if(window.vk_params.vk_client!=='ok')return;
  const button=document.createElement('button');button.textContent='Подключить сайт';button.style.cssText='position:fixed;right:12px;bottom:12px;z-index:999999;background:#202c26;color:#eee8d5;border:1px solid #b69a55;border-radius:8px;padding:10px 14px;cursor:pointer';
  button.onclick=async()=>{
   const code=prompt('Введите одноразовый код со страницы подключения на pripyat-game-site.ru:');if(!code)return;
   if(!/^[a-f0-9]{32}$/.test(code.trim())){alert('Проверьте код: нужно скопировать его целиком с сайта.');return;}
   button.disabled=true;
   try{
    const launch=Object.fromEntries([...new URLSearchParams(window.location.search)].filter(([k])=>k.startsWith('vk_')||k==='sign'));
    const send=async approve=>{const response=await fetch('https://pripyat-game-site.ru/auth/social/native',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.trim(),launch,approve})});if(!response.ok)throw Error('rejected');return response.json();};
    const p=await send(false);
    if(!confirm('Подключить ЭТОГО персонажа к входу на сайте «Припять»?\nАккаунт сайта: '+(p.name||'без имени')+'\n\nПродолжайте только если вы сами получили этот код на сайте и это ваш аккаунт. Не вводите чужие коды.'))return;
    await send(true);alert('Персонаж подтверждён. Вернитесь на сайт и нажмите «Я подтвердил подключение — продолжить».');
   }catch{alert('Подключение не завершено. Проверьте код и площадку. Дождитесь полной загрузки игры; если код истёк, получите новый на сайте.');}finally{button.disabled=false;}
  };document.body.append(button);
 },1000);
 setTimeout(()=>clearInterval(timer),120000);
})();

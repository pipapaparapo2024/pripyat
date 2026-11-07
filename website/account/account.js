(async()=>{
 document.querySelectorAll('input[type="password"]').forEach(input=>{
  const wrapper=document.createElement('span');wrapper.className='password-field';input.parentNode.insertBefore(wrapper,input);wrapper.append(input);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='password-toggle';toggle.setAttribute('aria-label','Показать пароль');toggle.setAttribute('aria-pressed','false');
  toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  toggle.addEventListener('click',()=>{const visible=input.type==='password';input.type=visible?'text':'password';toggle.setAttribute('aria-label',visible?'Скрыть пароль':'Показать пароль');toggle.setAttribute('aria-pressed',String(visible));});wrapper.append(toggle);
 });
 const result=document.getElementById('result');let csrf='',busy=false,checkId='';
 let passwordAction='reset';
 const tabs=document.getElementById('auth-tabs'),registration=document.getElementById('registration');
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Вход или регистрация');
 const loginTab=document.getElementById('show-login'),registerTab=document.getElementById('show-register');
 function selectTab(register){for(const [button,selected,panel] of [[loginTab,!register,'account'],[registerTab,register,'registration']]){button.setAttribute('role','tab');button.setAttribute('aria-selected',String(selected));button.setAttribute('aria-controls',panel);button.tabIndex=selected?0:-1;document.getElementById(panel).setAttribute('role','tabpanel');}}
 selectTab(false);tabs.addEventListener('click',e=>{if(e.target===loginTab||e.target===registerTab)selectTab(e.target===registerTab);});
 tabs.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?loginTab:e.key==='End'?registerTab:document.activeElement===loginTab?registerTab:loginTab;target.click();target.focus();}});
 document.getElementById('show-login').onclick=()=>{registration.hidden=true;document.getElementById('account').hidden=false;document.querySelector('h1').textContent='Вход в игру';result.textContent='';};
 document.getElementById('show-register').onclick=()=>{registration.hidden=false;document.getElementById('account').hidden=true;document.querySelector('h1').textContent='Регистрация';result.textContent='';};
 const recovery=document.getElementById('recovery');
 document.getElementById('show-recovery').onclick=()=>{document.getElementById('account').hidden=true;tabs.hidden=true;recovery.hidden=false;document.querySelector('h1').textContent='Восстановление пароля';document.querySelector('section > p').textContent='Укажите почту аккаунта. Мы отправим ссылку для смены пароля.';result.textContent='';recovery.elements.email.focus();};
 document.getElementById('back-login').onclick=()=>{recovery.hidden=true;tabs.hidden=false;loginTab.click();document.querySelector('section > p').textContent='Войдите в свой аккаунт или начните регистрацию.';};
 recovery.addEventListener('submit',e=>{e.preventDefault();run(async()=>{const data=await request('forgot',Object.fromEntries(new FormData(recovery)));result.textContent=data.text;});});
 const avatarFile=document.getElementById('avatar-file');let previewUrl='';
 avatarFile.addEventListener('change',()=>{const preview=document.getElementById('avatar-preview');if(previewUrl)URL.revokeObjectURL(previewUrl);const file=avatarFile.files[0];preview.hidden=!file;if(file){previewUrl=URL.createObjectURL(file);preview.src=previewUrl;}});
 const status=await fetch('/auth/status',{cache:'no-store'}).then(r=>r.json());csrf=status.csrf;
 async function request(action,values={}){
  const friend=new URLSearchParams(location.search).get('friend')||'';
  const r=await fetch('/auth/site/'+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...values,csrf,friend,...Object.fromEntries([...new URLSearchParams(location.search)].filter(([k])=>['reward','platform'].includes(k)))})});
  const data=await r.json();if(!r.ok){const error=new Error(data.text||'Не удалось выполнить действие.');error.code=data.error;throw error;}
  if(['register','login'].includes(action)&&avatarFile.files[0]){
   const form=new FormData();form.append('csrf',csrf);form.append('avatar',avatarFile.files[0]);
   const upload=await fetch('/auth/site/avatar',{method:'POST',credentials:'same-origin',body:form});if(!upload.ok)throw new Error('Аккаунт обработан, но аватар не сохранён. Выберите JPG, PNG или WebP до 2 МБ и повторите вход.');
  }
  return data;
 }
 async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){result.textContent=e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 function phoneStep(){tabs.hidden=true;registration.hidden=true;document.getElementById('account').hidden=true;document.getElementById('reset').hidden=true;document.getElementById('phone').hidden=false;document.querySelector('h1').textContent='Продолжение регистрации';document.querySelector('section > p').textContent='Почта подтверждена. Осталось подтвердить номер телефона.';}
 registration.addEventListener('submit',e=>{e.preventDefault();run(async()=>{const data=await request('register',Object.fromEntries(new FormData(registration)));registration.hidden=true;tabs.hidden=true;document.querySelector('h1').textContent='Проверьте почту';document.querySelector('section > p').textContent='Откройте письмо от «Припять» и перейдите по ссылке для продолжения регистрации.';result.textContent=data.text;});});
 document.getElementById('reset').addEventListener('submit',e=>{e.preventDefault();if(passwordAction!=='set-password')return;run(async()=>{const data=await request('set-password',{password:new FormData(e.target).get('password')});result.textContent=data.text;if(data.phone_step)phoneStep();});});
 document.getElementById('account').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const data=await request(e.submitter.value,Object.fromEntries(new FormData(e.target)));result.textContent=data.text||'';if(data.phone_step)phoneStep();if(data.redirect)location.assign(data.redirect);});});
 document.getElementById('phone').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const data=await request('phone-start',Object.fromEntries(new FormData(e.target)));checkId=data.check_id;const a=document.getElementById('call-number');a.textContent=data.call_phone;a.href='tel:'+data.call_phone;document.getElementById('call').hidden=false;result.textContent=data.text||'';});});
 document.getElementById('check').addEventListener('click',()=>run(async()=>{const data=await request('phone-check',{check_id:checkId});result.textContent=data.text||'';if(data.redirect)location.assign(data.redirect);}));
 const params=new URLSearchParams(location.search);
 if(['verify','reset'].includes(params.get('action'))&&params.has('token')){
  const token=params.get('token');history.replaceState(null,'','/account/');
  document.getElementById('account').hidden=true;
  registration.hidden=true;tabs.hidden=true;
  if(params.get('action')==='verify'){
   document.querySelector('h1').textContent='Подтверждение почты';document.querySelector('section > p').textContent='Проверяем ссылку…';
   await run(async()=>{try{const data=await request('verify',{token});result.textContent=data.text;if(data.password_step){passwordAction='set-password';document.getElementById('reset').hidden=false;document.querySelector('h1').textContent='Создайте пароль';document.querySelector('section > p').textContent='Почта подтверждена. Задайте пароль для входа в игру.';}if(data.phone_step)phoneStep();if(data.login_required){tabs.hidden=false;loginTab.click();result.textContent=data.text;}if(data.redirect)location.assign(data.redirect);}catch(e){document.querySelector('h1').textContent=e.code==='invalid_email_token'?'Ссылка недействительна':'Подтверждение недоступно';document.querySelector('section > p').textContent=e.code==='invalid_email_token'?'Ссылка уже использована или срок её действия истёк.':e.message;result.textContent='';document.getElementById('phone').hidden=true;document.getElementById('call').hidden=true;}});
  }
  else {
   document.getElementById('account').hidden=true;const form=document.getElementById('reset');form.hidden=false;
   form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{const data=await request('reset',{token,password:new FormData(form).get('password')});result.textContent=data.text;form.hidden=true;document.getElementById('account').hidden=false;});});
  }
 }
})().catch(()=>{document.getElementById('result').textContent='Не удалось подключиться. Обновите страницу.';});

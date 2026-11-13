export function installSitePayments(enabled,scope='',request=(...args)=>window.TS.php(...args)){
 const orderKey='pripyat-site-payment'+(scope?':'+scope:''),urlKey=orderKey+'-url',itemKey=orderKey+'-item';
 let creating=false,checking=false,paymentWindow=null;
 const message=text=>{
  if(typeof window.iface?._openSidorovichError==='function'){window.iface._openSidorovichError('Оплата на сайте',text);return;}
  window.alert?.(text);
 };
 const check=()=>{
  const id=sessionStorage.getItem(orderKey);if(!enabled||!id||checking)return;
  checking=true;request('sitepayments.status',{order_id:id},data=>{
   checking=false;
   if(['credited','already_credited','canceled'].includes(data.status)){
    // An older status request must not erase a newer selected order.
    if(sessionStorage.getItem(orderKey)===id){sessionStorage.removeItem(orderKey);sessionStorage.removeItem(urlKey);sessionStorage.removeItem(itemKey);}
    if(data.status!=='canceled')window.TS.php('users.get',{},snapshot=>{
     // Server.parseUD has installed the authoritative snapshot before this callback.
     if(!snapshot?.udata)return;
     window.markPlayerDataFresh?.('site_purchase_refresh');
     if(snapshot.udata.energy!==undefined)window.TIMERS?.syncFromPatch?.(snapshot.udata.energy,snapshot.udata.energy_time);
     window.iface?.updateUp?.();
     window.iface?.updateEnergy?.();
    });
   }
  },()=>{checking=false;});
 };
 window.__sitePurchase=item=>{
  if(!enabled){message('Приём платежей ещё не включён.');return Promise.resolve(false);}
  if(creating)return Promise.resolve(false);
  const match=/^item([0-9]{1,3})$/.exec(String(item));if(!match)return Promise.reject(new Error('Неизвестный товар.'));
  // Reserve synchronously during the user's click, before the asynchronous API call.
  paymentWindow=window.open('about:blank','_blank');
  if(!paymentWindow){message('Разрешите открытие новой вкладки для оплаты и нажмите на товар ещё раз. Игра останется открытой.');return Promise.resolve(false);}
  paymentWindow.opener=null;const checkoutWindow=paymentWindow;
  const existing=sessionStorage.getItem(urlKey);
  if(sessionStorage.getItem(orderKey)&&existing&&sessionStorage.getItem(itemKey)===item){checkoutWindow.location.replace(existing);check();return Promise.resolve(true);}
  const bytes=crypto.getRandomValues(new Uint8Array(32)),intent=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');creating=true;
  return new Promise(resolve=>request('sitepayments.create',{product_id:Number(match[1]),intent},data=>{
   creating=false;
   if(typeof data.confirmation_url!=='string'||!/^https:\/\/(yoomoney\.ru|yookassa\.ru|checkout\.yookassa\.ru)\//.test(data.confirmation_url)){
    checkoutWindow.close();message('Не удалось открыть оплату. Попробуйте ещё раз.');resolve(false);return;
   }
   sessionStorage.setItem(orderKey,data.order_id);sessionStorage.setItem(urlKey,data.confirmation_url);sessionStorage.setItem(itemKey,item);
   if(!checkoutWindow.closed)checkoutWindow.location.replace(data.confirmation_url);
   check();resolve(true);
  },()=>{creating=false;checkoutWindow.close();message('Не удалось создать платёж. Игра остаётся открытой.');resolve(false);}));
 };
 window.__siteCheckPayment=check;
 window.addEventListener('focus',check);
 const timer=setInterval(()=>{if(!document.hidden)check();},5000);
 window.addEventListener('pagehide',()=>{clearInterval(timer);window.removeEventListener('focus',check);},{once:true});
}

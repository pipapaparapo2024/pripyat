function call(method,params={}){return new Promise((resolve,reject)=>window.TS.php(method,params,resolve,reject));}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function installTelegramPayments(app,catalog){
    window.telegramStarsCatalog=catalog;
    let busy=false;
    window.__telegramPurchase=async item=>{
        if(busy)return false;
        const match=/^item(\d+)$/.exec(String(item));if(!match)return false;
        busy=true;let suspended=false;
        const notify=text=>{if(window.notify)window.notify.showResult({text},0);};
        try{
            if(typeof app.openInvoice!=='function')throw new Error('Обновите Telegram для оплаты Stars.');
            if(window.flushPlayerSave)await new Promise((resolve,reject)=>window.flushPlayerSave('tg_before_payment',e=>e?reject(e):resolve()));
            if(window.suspendPlayerSave){window.suspendPlayerSave('telegram_payment');suspended=true;}
            const order=await call('telegramstars.create',{product_id:Number(match[1])});
            const state=await new Promise((resolve,reject)=>{try{app.openInvoice(order.invoice_url,resolve);}catch(e){reject(e);}});
            let confirmed=false;
            if(state==='paid'||state==='pending'){
                for(let i=0;i<20;i++){
                    const status=await call('telegramstars.status',{order_id:order.order_id});
                    if(status.payment_status==='paid'){confirmed=true;break;}
                    await delay(500);
                }
                if(!confirmed)notify('Подтверждение платежа ещё обрабатывается. Перезайдите в игру через несколько секунд или используйте /paysupport.');
            }else if(state==='failed')notify('Платёж не завершён. Попробуйте ещё раз.');
            await call('users.get');
            if(window.markPlayerDataFresh)window.markPlayerDataFresh('telegram_payment');
            if(window.TIMERS)window.TIMERS.updateFromUdata();
            if(window.iface){window.iface.updateUp();window.iface.updateNick();window.iface.updateEnergy();}
            if(confirmed&&window.notify)window.notify.showResult({text:'Покупка зачислена.'},1);
            return confirmed;
        }catch(e){notify(e instanceof Error?e.message:'Не удалось открыть оплату Stars. Попробуйте ещё раз.');return false;}
        finally{if(suspended&&window.resumePlayerSave)window.resumePlayerSave('telegram_payment');busy=false;}
    };
}

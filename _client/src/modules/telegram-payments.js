function call(method,params={}){return new Promise((resolve,reject)=>window.TS.php(method,params,resolve,reject));}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function installTelegramPayments(app,catalog,isOwner=true){
    window.telegramStarsCatalog=catalog;
    let busy=false;
    const termsVersion='2026-11-10-1';
    const productInfo=id=>{
        const labels=[['stew','тушёнки'],['coins','игровых рублей'],['cigarettes','сухарей'],['energy','энергии']];
        for(const [key,label] of labels){const group=catalog&&catalog[key];if(!group||!Array.isArray(group.ids))continue;const i=group.ids.indexOf(id);if(i>=0)return {title:`${group.amounts[i]} ${label}`,stars:group.stars[i]};}
        return null;
    };
    const confirmTerms=info=>new Promise(resolve=>{
        if(!app||typeof app.showPopup!=='function'){resolve(false);return;}
        try{app.showPopup({title:'Покупка цифрового ресурса',message:`Пакет: ${info.title}. Цена: ${info.stars} ⭐. Получатель: текущий персонаж. Начисление после подтверждения Telegram. Поддержка Telegram не рассматривает покупки бота: /paysupport. Нажатие «Согласен» подтверждает, что вы прочитали и принимаете условия.`,buttons:[{id:'terms',text:'Условия'},{id:'accept',text:'Согласен'},{id:'cancel',text:'Отмена',type:'cancel'}]},id=>{
            if(id==='terms'){try{app.openLink('https://pripyat-game-site.ru/telegram-terms/');}catch(e){}resolve(false);return;}
            resolve(id==='accept');
        });}catch(e){resolve(false);}
    });
    window.__telegramPurchase=async item=>{
        if(!isOwner){if(window.notify)window.notify.showResult({text:'Покупка за Stars пока доступна только владельцу теста.'},0);return false;}
        if(busy)return false;
        const match=/^item(\d+)$/.exec(String(item));if(!match)return false;
        const info=productInfo(Number(match[1]));if(!info)return false;
        busy=true;let suspended=false;
        const notify=text=>{if(window.notify)window.notify.showResult({text},0);};
        try{
            if(typeof app.openInvoice!=='function')throw new Error('Обновите Telegram для оплаты Stars.');
            if(window.flushPlayerSave)await new Promise((resolve,reject)=>window.flushPlayerSave('tg_before_payment',e=>e?reject(e):resolve()));
            if(window.suspendPlayerSave){window.suspendPlayerSave('telegram_payment');suspended=true;}
            if(!await confirmTerms(info)){notify('Покупка отменена. Откройте условия и подтвердите согласие перед оплатой.');return false;}
            await call('telegramstars.acceptTerms',{version:termsVersion});
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

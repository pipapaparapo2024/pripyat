function request(method,params={}){
    return new Promise((resolve,reject)=>window.TS.php('telegramfriends.'+method,params,resolve,reject));
}
export function openTelegramFriends(){
    if(document.getElementById('telegram-friends'))return;
    const overlay=document.createElement('div');overlay.id='telegram-friends';
    overlay.style.cssText='position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px;font:16px Arial;color:#eee8dc';
    const panel=document.createElement('section');panel.style.cssText='width:560px;max-width:100%;max-height:85vh;overflow:auto;background:#24221b;border:1px solid #8b734b;border-radius:10px;padding:22px';
    const heading=document.createElement('h2');heading.textContent='Сталкеры Telegram';
    const tabs=document.createElement('div');tabs.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px';
    const body=document.createElement('div');body.style.minHeight='100px';
    const button=(text,fn)=>{
        const b=document.createElement('button');b.textContent=text;b.style.cssText='padding:10px 13px;border:1px solid #8b734b;background:#393328;color:#fff;border-radius:5px;cursor:pointer';b.onclick=fn;return b;
    };
    let generation=0,closed=false;
    const status=(message)=>{body.textContent=message;};
    const list=async(scope,page=0)=>{
        const own=++generation;status('Загрузка…');
        try{
            const data=await request('list',{scope,page});if(closed||own!==generation)return;
            body.replaceChildren();
            const count=document.createElement('p');count.textContent=(scope==='friends'?'Друзья: ':'Другие игроки: ')+data.total;body.append(count);
            if(!data.players.length){const empty=document.createElement('p');empty.textContent=scope==='friends'?'Пока никого. Отправьте другу свою ссылку приглашения.':'Других игроков пока нет.';body.append(empty);}
            for(const player of data.players){
                const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid #514832;padding:12px 0';
                const label=document.createElement('span');label.textContent=player.nick+' · уровень '+player.level;row.append(label);
                if(scope==='friends')row.append(button('Удалить',async()=>{
                    if(!window.confirm('Удалить дружбу с '+player.nick+' у обоих игроков?'))return;
                    try{await request('remove',{id:player.id});window.TS.php('users.get',{},()=>{});list('friends',page);}catch(_){status('Не удалось удалить друга. Попробуйте ещё раз.');}
                }));
                body.append(row);
            }
            if(scope==='others'){const note=document.createElement('p');note.textContent='Для взаимного добавления отправьте игроку свою ссылку приглашения.';body.append(note);}
            const nav=document.createElement('div');nav.style.cssText='display:flex;gap:10px;margin-top:14px';
            if(page>0)nav.append(button('← Назад',()=>list(scope,page-1)));
            if(data.has_next)nav.append(button('Далее →',()=>list(scope,page+1)));body.append(nav);
        }catch(_){if(!closed&&own===generation)status('Не удалось загрузить список. Попробуйте ещё раз.');}
    };
    const invite=async()=>{
        const own=++generation;status('Подготавливаем ссылку…');
        try{
            const data=await request('invite');if(closed||own!==generation)return;
            body.replaceChildren();const tip=document.createElement('p');tip.textContent='Отправьте ссылку другу. После перехода и входа вы появитесь друг у друга в списке друзей.';
            const link=document.createElement('input');link.readOnly=true;link.value=data.link;link.style.cssText='width:100%;box-sizing:border-box;padding:12px;margin-bottom:12px';link.onclick=()=>link.select();
            body.append(tip,link,button('Копировать',async()=>{try{await navigator.clipboard.writeText(data.link);}catch(_){link.select();}}));
        }catch(_){if(!closed&&own===generation)status('Не удалось создать приглашение. Попробуйте ещё раз.');}
    };
    tabs.append(button('Друзья',()=>list('friends')),button('Не друзья',()=>list('others')),button('Пригласить',invite));
    panel.append(heading,tabs,body,button('Закрыть',()=>{closed=true;overlay.remove();}));overlay.append(panel);document.body.append(overlay);list('friends');
}

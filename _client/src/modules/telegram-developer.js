export async function installTelegramDeveloper(roles){
    if(!roles.includes('developer'))return;
    const mod=await import('eruda');const eruda=mod.default||mod;
    eruda.init({tool:['console','info']});
    window.telegramEruda=eruda;
    // No network inspector: do not collect authorization payloads or tokens.
    const button=document.createElement('button');button.textContent='TG ЛОГИ';button.id='telegram-developer-logs';
    button.style.cssText='position:fixed;left:8px;bottom:8px;z-index:100050;background:#24392e;color:#bfffd7;border:1px solid #6b9;padding:8px;border-radius:5px;font:12px Arial';
    button.onclick=()=>{
        eruda.show();window.TS.php('users.devGetLogs',{},result=>console.info('[telegram-server]',result),()=>console.warn('Нет доступа к серверным логам.'));
    };
    document.body.append(button);
}

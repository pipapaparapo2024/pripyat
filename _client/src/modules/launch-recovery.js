export function showLaunchRecovery(scope, appId){
    const doc = scope.document;
    const existing = doc.getElementById('launch-recovery');
    if(existing) return existing;
    const overlay = doc.createElement('div');
    overlay.id = 'launch-recovery';
    overlay.setAttribute('role', 'alert');
    Object.assign(overlay.style, {position:'fixed',inset:'0',zIndex:'2147483647',display:'grid',placeItems:'center',background:'rgba(0,0,0,0.94)',color:'#f4e9d5',font:'18px/1.5 sans-serif',padding:'20px',boxSizing:'border-box'});
    const box = doc.createElement('div');
    Object.assign(box.style, {maxWidth:'440px',textAlign:'center'});
    const title = doc.createElement('h2');
    title.textContent = 'Нужно заново открыть игру';
    const message = doc.createElement('p');
    message.textContent = 'Параметры входа устарели. Закрой старую вкладку и открой игру заново из социальной сети. Простое обновление страницы может не помочь.';
    box.appendChild(title); box.appendChild(message);
    if(/^\d{1,12}$/.test(String(appId || ''))){
        const link = doc.createElement('a');
        link.href = 'https://vk.com/app' + appId;
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = 'Открыть игру заново во ВКонтакте';
        Object.assign(link.style, {display:'inline-block',background:'#3d642b',color:'#fff',padding:'12px 18px',borderRadius:'6px',textDecoration:'none'});
        box.appendChild(link);
    }
    overlay.appendChild(box); doc.body.appendChild(overlay);
    return overlay;
}

// This controls console visibility only. Server authentication grants actual access.
export function canViewClientDiagnostics(win){
    if(win.__telegramRuntime) return win.__telegramRuntime.getRoles().includes('developer');
    const params = new URLSearchParams(win.location.search);
    if(params.get('vk_client') === 'ok') return false;
    return params.get('vk_user_id') === '382448269';
}

export function installClientConsolePrivacy(win, target){
    // Keep wrappers dynamic: Telegram roles can arrive after bootstrap.
    for(const key of ['log','warn','error','info','debug','table','trace','dir','group','groupCollapsed','groupEnd']){
        if(typeof target[key] !== 'function') continue;
        const original = target[key].bind(target);
        target[key] = (...args) => {
            if(canViewClientDiagnostics(win)) original(...args);
        };
    }
}

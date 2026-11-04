import Server from './server.js';

export default class TelegramServer extends Server {
    constructor(session, base){
        super(['telegram-test',session.player_id,base]);
        this.scriptURL=base+'/telegram-api.php';
        this.token=session.token;this.req_key=session.req_key;
    }
    php(method, params, onComplete, onError){
        // Login already happened before boot. Never call legacy security.getToken.
        if(method==='security.getToken'){
            queueMicrotask(()=>onComplete({token:this.token,req_key:this.req_key}));return;
        }
        super.php(method,params,onComplete,onError);
    }
    completeRequest(event){
        if(this.MSS.readyState===4&&this.MSS.status===403){
            let denied;try{denied=JSON.parse(this.MSS.response.toString());}catch(_){}
            if(denied&&denied.status==='error'&&denied.code===403){
                if(denied.access_denied&&typeof document!=='undefined'&&!document.getElementById('telegram-access-denied')){
                    const overlay=document.createElement('div');overlay.id='telegram-access-denied';
                    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#171713;color:#eee;font:18px Arial;text-align:center;padding:24px';
                    overlay.textContent='Доступ к закрытому тестированию отозван. Обратитесь к разработчику. После восстановления доступа откройте игру заново.';
                    document.body.appendChild(overlay);
                }
                this.json=denied;if(denied.req_key)this.req_key=denied.req_key;
                this.onError();if(this.mc)this.mc.visible=false;this.wait=false;this.nextReq();return;
            }
        }
        super.completeRequest(event);
    }
    loadReq(method,params){
        try{
            this.MSS=new XMLHttpRequest();
            this.MSS.open('POST',this.scriptURL,true);
            this.MSS.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
            this.MSS.addEventListener('loadend',()=>this.completeRequest(this.MSS));
            this.MSS.send(new URLSearchParams({method,payload:JSON.stringify(params||{}),token:this.token,req_key:this.req_key}).toString());
        }catch(e){
            this.wait=false;
            if(this.thisReq && typeof this.thisReq.e==='function')this.thisReq.e({status:'error',code:35,text:'Не удалось отправить запрос.'});
            this.nextReq();
        }
    }
}

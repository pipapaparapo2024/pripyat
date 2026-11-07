import Server from './server.js';
export default class SiteServer extends Server {
 constructor(session,base){super(['site-test',session.player_id,base]);this.scriptURL=base+'/site-api.php';this.token=session.token;this.req_key=session.req_key;}
 php(method,params,done,fail){if(method==='security.getToken'){queueMicrotask(()=>done({token:this.token,req_key:this.req_key}));return;}super.php(method,params,done,fail);}
 loadReq(method,params){
  this.MSS=new XMLHttpRequest();this.MSS.open('POST',this.scriptURL,true);
  this.MSS.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
  this.MSS.addEventListener('loadend',()=>this.completeRequest(this.MSS));
  this.MSS.send(new URLSearchParams({method,payload:JSON.stringify(params||{}),token:this.token,req_key:this.req_key}).toString());
 }
}

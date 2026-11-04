const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const requests=[];
class XHR{
    constructor(){this.events={};requests.push(this);}
    open(method,url){this.method=method;this.url=url;}
    setRequestHeader(){}
    addEventListener(event,fn){this.events[event]=fn;}
    send(body){this.body=body;}
    finish(data,status=200){this.status=status;this.readyState=4;this.response=JSON.stringify(data);this.events.loadend();}
}
const context={window:{debug_mode:false},XMLHttpRequest:XHR,URLSearchParams,queueMicrotask,console,errors:[{},{status:'error',code:35},{status:'error',code:36}]};
vm.createContext(context);
for(const name of ['server','telegram-server']){
    const src=fs.readFileSync('_client/src/modules/'+name+'.js','utf8').replace(/^\uFEFF/,'').replace(/^import .*;\r?\n/gm,'').replace('export default class','class');
    vm.runInContext(src,context);
}
vm.runInContext("this.server=new TelegramServer({player_id:'42',token:'"+'a'.repeat(64)+"',req_key:'"+'b'.repeat(32)+"'},'https://tg-test.example/server');",context);
(async()=>{
    let login=false;context.server.php('security.getToken',{},()=>login=true);await Promise.resolve();assert(login);assert.equal(requests.length,0);
    const completed=[];
    context.server.php('users.save',{udata_json:JSON.stringify({nick:'Сергей'})},()=>completed.push('save'));
    context.server.php('users.get',{},()=>completed.push('get'));
    assert.equal(requests.length,1);
    const params=new URLSearchParams(requests[0].body);
    assert.equal(requests[0].url,'https://tg-test.example/server/telegram-api.php');
    assert.equal(JSON.parse(params.get('payload')).udata_json,JSON.stringify({nick:'Сергей'}));
    for(const key of ['uid','platform','api_id','init_data'])assert.equal(params.has(key),false);
    requests[0].finish({req_key:'c'.repeat(32),saved:true});
    assert.equal(requests.length,2);assert.equal(new URLSearchParams(requests[1].body).get('req_key'),'c'.repeat(32));
    requests[1].finish({req_key:'d'.repeat(32),udata:{id:42,nick:'Сергей'}});
    assert.deepEqual(completed,['save','get']);assert.equal(context.window.udata.nick,'Сергей');assert.equal(context.server.wait,false);
    let failed=false;context.server.php('users.get',{},()=>{},()=>failed=true);requests[2].finish({},503);
    assert(failed);assert.equal(context.server.wait,false);assert.equal(context.server.req_key,'d'.repeat(32));
    const overlays=[];context.document={getElementById:()=>overlays[0],createElement:()=>({style:{}}),body:{appendChild:node=>overlays.push(node)}};
    let revoked=false;context.server.php('users.get',{},()=>{},data=>revoked=data.access_denied);
    requests[3].finish({status:'error',code:403,access_denied:true,req_key:'e'.repeat(32)},403);
    assert.equal(revoked,true);assert.equal(context.server.req_key,'e'.repeat(32));assert.equal(overlays.length,1);assert.equal(overlays[0].id,'telegram-access-denied');
    context.server.php('users.get',{},()=>{},()=>{});requests[4].finish({status:'error',code:403,access_denied:true},403);assert.equal(overlays.length,1);
    console.log('Telegram transport: локальный login, очередь, UTF-8, ротация ключа, отсутствие posted UID и восстановление после HTTP-ошибки проверены');
})().catch(e=>{console.error(e);process.exitCode=1;});

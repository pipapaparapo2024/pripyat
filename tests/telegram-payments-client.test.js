const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('_client/src/modules/telegram-payments.js','utf8').replace('export function','function');
async function scenario(state,confirmed){
    const calls=[],notices=[];let resume=0,suspend=0,open=0,release;
    const gate=new Promise(resolve=>release=resolve);
    const window={TS:{php(method,params,ok){calls.push(method);if(method==='telegramstars.create')ok({invoice_url:'https://t.me/$fixture',order_id:'abc'});else if(method==='telegramstars.status')ok({payment_status:confirmed?'paid':'created'});else ok({udata:{coins:10}});}},
        flushPlayerSave(reason,done){done();},suspendPlayerSave(){suspend++;},resumePlayerSave(){resume++;},notify:{showResult(x){notices.push(x.text);}}};
    const context={window,setTimeout:fn=>fn(),Error,Promise};vm.createContext(context);vm.runInContext(source,context);
    context.installTelegramPayments({openInvoice(url,done){open++;assert.equal(url,'https://t.me/$fixture');gate.then(()=>done(state));}},{});
    const first=window.__telegramPurchase('item0');
    assert.equal(await window.__telegramPurchase('item0'),false,'second invoice must be blocked');
    release();const result=await first;
    assert.equal(open,1);assert.equal(suspend,1);assert.equal(resume,1);
    assert.equal(result,state==='paid'&&confirmed);
    assert.equal(calls.filter(x=>x==='users.get').length,1,'always reload authoritative inventory');
    assert.ok(!calls.some(x=>/successDonat|grant|save/i.test(x)),'client must never grant goods');
    if(state==='cancelled')assert.ok(!calls.includes('telegramstars.status'));
    if(state==='paid'&&!confirmed)assert.ok(notices.some(x=>x.includes('/paysupport')),'unconfirmed client result is not a receipt');
}
(async()=>{await scenario('cancelled',false);await scenario('paid',true);await scenario('paid',false);console.log('Telegram: отмена, серверное подтверждение, блокировка повторного клика и отсутствие клиентского начисления проверены');})().catch(e=>{console.error(e);process.exitCode=1;});

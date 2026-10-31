const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const ctx={setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync('_client/src/modules/startup-request.js','utf8').replace('export function','function')+';this.call=startupRequest;',ctx);
(async()=>{
 assert.equal(await ctx.call(()=>Promise.resolve(42),100),42);
 await assert.rejects(ctx.call(()=>Promise.reject(new Error('denied')),100),/denied/);
 await assert.rejects(ctx.call(()=>{throw new Error('sync');},100),/sync/);
 let done;const pending=new Promise(resolve=>done=resolve);let successes=0,failures=0;
 await ctx.call(()=>pending,10).then(()=>successes++,()=>failures++);done(1);await new Promise(r=>setTimeout(r,5));assert.equal(successes,0);assert.equal(failures,1);
 const source=fs.readFileSync('_client/src/game/preloader.js','utf8');assert(source.includes('startupRequest(() => bridge.sendPromise("VKWebAppGetUserInfo"))'));assert(source.includes('startupRequest(() => bridge.sendPromise("VKWebAppCallAPIMethod"'));
 assert(source.includes("TS.php('security.getToken', params"),'Signed authentication must remain mandatory');
 const index=fs.readFileSync('_client/src/index.js','utf8');assert(index.includes('startupRequest(() => bridge.send("VKWebAppInit"))'));
 console.log('Startup metadata: success, refusal, sync error, timeout, late response and mandatory authentication passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

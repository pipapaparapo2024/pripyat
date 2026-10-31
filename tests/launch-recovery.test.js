const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const nodes=[];function node(tag){return {tag,style:{},children:[],setAttribute(k,v){this[k]=v;},appendChild(n){this.children.push(n);nodes.push(n);}};}
const body=node('body'),document={body,createElement:node,getElementById:id=>nodes.find(n=>n.id===id)};
const c={};vm.runInNewContext(fs.readFileSync('_client/src/modules/launch-recovery.js','utf8').replace('export function','function')+';this.show=showLaunchRecovery;',c);
const view=c.show({document},54574178);assert.equal(view.role,'alert');assert.equal(view.style.zIndex,'2147483647');const link=nodes.find(n=>n.tag==='a');assert.equal(link.href,'https://vk.com/app54574178');assert.equal(link.target,'_blank');assert(link.rel.includes('noopener'));assert.equal(c.show({document},54574178),view);assert.equal(body.children.length,1);
const otherNodes=[];const other={body:node('body'),createElement:node,getElementById:()=>null};c.show({document:other},'https://attacker.invalid');assert(!other.body.children[0].children[0].children.some(n=>n.tag==='a'));
const errors=JSON.parse(fs.readFileSync('server/json/errors.json','utf8'));assert.equal(errors.filter(e=>e.code===8).length,1);assert(errors.find(e=>e.code===8).text.includes('заново'));assert(errors.find(e=>e.code===7).text.includes('подделки'));
const pre=fs.readFileSync('_client/src/game/preloader.js','utf8');assert(pre.includes('Number(e.code) === 8'));assert(pre.includes("isVk() ? vk_params['vk_app_id'] : null"));
console.log('Expired launch: visible/idempotent recovery, valid VK link, no untrusted URL, separate security code passed');

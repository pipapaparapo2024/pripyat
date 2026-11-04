const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let source=fs.readFileSync('_client/src/game/onboarding.js','utf8');source=source.slice(source.indexOf('export default class Onboarding'),source.indexOf('attachOnboardingPopup(Onboarding)')).replace('export default class','class');
const errors=[],shown=[],saved=[];const context={window:{},console:{log(){},error(...a){errors.push(a)}},TOUR_TABS:[]};vm.createContext(context);vm.runInContext(source+';this.Onboarding=Onboarding;',context);
for(const step of [undefined,null,'','  ',[],{},0,false]){
 const data={onboarding_step:step};context.window.udata=data;context.udata=data;const o=new context.Onboarding();o._hookScreenClose=()=>{};o._isEligible=()=>true;o._showPopup=s=>shown.push(s);o._setStep=s=>saved.push(s);o.start();assert.equal(shown.pop(),'intro');
}
assert.equal(errors.length,0);assert.equal(saved.length,0,'Нет принудительного сброса сохранений при первом запуске');
for(const step of ['done','intro','permission','dvor']){context.window.udata=context.udata={onboarding_step:step};assert.equal(new context.Onboarding()._currentStep(),step);}
context.window.udata=context.udata={onboarding_step:'done'};const o=new context.Onboarding();o._hookScreenClose=()=>{};o._isEligible=()=>true;o._showPopup=()=>{throw new Error('Completed tutorial restarted')};o.start();
console.log('Обучение: пустое поле/массив первого входа без ошибок, пройденный шаг сохранён');

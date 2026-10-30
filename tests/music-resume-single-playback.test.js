const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../_client/src');
for(const kind of ['background','dvor']){
    function harness(delayed=false){
        const sounds={},timers=new Map;let timerId=0;
        const sound={exists:a=>!!sounds[a],find:a=>sounds[a],
            add(a,options){sounds[a]={instances:[],duration:1,isPlaying:false,loaded:options.loaded};if(!delayed)options.loaded(null);},
            stop(a){sounds[a].instances=[];sounds[a].isPlaying=false;},
            play(a,options){const instance={on(){},stop(){sounds[a].instances=sounds[a].instances.filter(x=>x!==instance);},complete:options.complete};sounds[a].instances.push(instance);sounds[a].isPlaying=true;return instance;}};
        const context=vm.createContext({window:{PIXI:{sound}},PIXI:{sound},applyAudioVolumes(){},console:{log(){},error(){}},
            setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}});
        const file=kind==='background'?'modules/background-music.js':'game/dvor/dvor-music.js';
        const code=fs.readFileSync(path.join(root,file),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
        vm.runInContext(code,context);
        let start,pause,resume,stop;
        if(kind==='background')({startBackgroundMusic:start,pauseBackgroundMusicWatchdog:pause,resumeBackgroundMusicWatchdog:resume,stopBackgroundMusic:stop}=context);
        else{const proto={};context.attachDvorMusic(proto);start=proto._startDvorMusic.bind(proto);pause=proto._pauseDvorMusicWatchdog.bind(proto);resume=proto._resumeDvorMusicWatchdog.bind(proto);stop=proto._stopDvorMusic.bind(proto);}
        return {sounds,timers,start,pause,resume,stop,count:()=>Object.values(sounds).reduce((n,s)=>n+s.instances.length,0),
            fire(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
    }
    const h=harness();h.start();assert.strictEqual(h.count(),1);
    const old=Object.values(h.sounds)[0].instances[0];
    h.fire();assert.strictEqual(h.count(),1,kind+': watchdog left the old track playing');
    old.complete();assert.strictEqual(h.count(),1,kind+': stale completion doubled playback');
    h.pause();assert.strictEqual(h.timers.size,0);
    Object.values(h.sounds).forEach(s=>{s.isPlaying=false;});
    Object.values(h.sounds).find(s=>s.instances.length).instances[0].complete();
    assert.strictEqual(h.count(),1,kind+': background completion started another track');
    h.resume();assert.strictEqual(h.count(),1,kind+': resume revived two tracks');
    h.stop();assert.strictEqual(h.count(),0);
    const delayed=harness(true);delayed.start();delayed.pause();
    Object.values(delayed.sounds)[0].loaded(null);
    assert.strictEqual(delayed.count(),0,kind+': delayed load started music while hidden');
    delayed.resume();assert.strictEqual(delayed.count(),1);
    delayed.resume();assert.strictEqual(delayed.count(),1);
    delayed.stop();
    console.log(kind+': watchdog, stale completion, hidden completion, late loading and repeated resume passed');
}

import texts from './narration-texts.json';
const HAND_LAYOUTS = {dvor:[[1194,126,-16]],zone:[[409,394,-91],[1128,584,-150],[1176,109,0],[1187,108,0]],baza:[[896,555,-150],[1188,101,0]],habar:[[1145,113,0]],bosses:[[1149,117,0]],svod:[[1183,105,0]],raznaryadka:[[1187,104,0]],shmot:[[1187,104,0]],sidorovich:[[1186,114,0]]};
HAND_LAYOUTS.raznaryadka = [[1143,147,0]];
export function attachGuidedTour(Onboarding){
    Onboarding.prototype._highlightGuidedDvor = function(tab){
        if(tab.key !== 'dvor' || !window.dvor || !dvor._lobbyWin || !dvor._lobbyWin.parent || this._highlightedDvorLobby === dvor._lobbyWin) return;
        this._highlightedDvorLobby = dvor._lobbyWin;
        dvor._setTutorialCloudHighlight(true);
    };
    Onboarding.prototype._beginGuidedExplanation = function(tab){
        if(!this._popupWin) this._buildPopup();
        this._popupWin.visible = true;
        this._popupState = 'guided';
        this._highlightedDvorLobby = null;
        const highlights = new Map();
        let highlightPhase = 0;
        const highlight = sprite => {
            if(!sprite || sprite.destroyed || sprite.visible === false || (sprite.texture && !sprite.texture.valid)) return;
            if(!highlights.has(sprite)) highlights.set(sprite,{alpha:sprite.alpha});
            const saved=highlights.get(sprite), wave=(Math.sin(highlightPhase)+1)/2;
            sprite.alpha=saved.alpha*(0.58+0.42*wave);
            // Alpha does not interfere with Pixi's deferred texture-size update.
        };
        const restoreHighlights = () => {
            for(const [sprite,saved] of highlights) if(!sprite.destroyed){sprite.alpha=saved.alpha;}
            if(tab.key === 'dvor' && window.dvor) dvor._setTutorialCloudHighlight(false);
        };
        const name = tab.sound.split('/').pop().replace(/\.mp3$/, '');
        this._onboardingText.text = texts[name] || tab.label;
        this._onboardingText.y = 232;
        this._onboardingText.style.wordWrapWidth = 337;
        this._onboardingText.style.fontSize = 18;
        this._onboardingText.style.lineHeight = 24;
        if(PIXI.TextMetrics){
            while(PIXI.TextMetrics.measureText(this._onboardingText.text, this._onboardingText.style).height > 260 && this._onboardingText.style.fontSize > 13){
                this._onboardingText.style.fontSize--;
                this._onboardingText.style.lineHeight = this._onboardingText.style.fontSize + 5;
            }
        }
        this._mergeBtn.passive.visible = this._mergeBtn.active.visible = this._mergeBtn.hit.visible = false;
        const setContinue = visible => {
            this._continueBtn.passive.visible = this._continueBtn.hit.visible = visible;
            this._continueBtn.active.visible = false;
            this._continueBtn.hit.interactive = visible;
        };
        let finished = false;
        const proceed = () => {
            if(finished) return; finished = true;
            clearTimeout(this._guidedAudioTimeout);
            this._guidedContinue = null;
            restoreHighlights();
            this._hidePopup();
            this._guideActions(tab);
        };
        this._guidedContinue = proceed;
        root.layer2_mc.addChild(this._popupWin);
        this._guidedPopupTick = () => {
            highlightPhase+=0.06;
            this._highlightGuidedDvor(tab);
            if(tab.key==='svod' && window.svod) Object.values(svod._svodTabSprites || {}).forEach(highlight);
            if(tab.key==='sidorovich'){
                const walk=node=>{if(!node || node===this._popupWin)return;if(node._tutorialExplanationHighlight)highlight(node);for(const child of node.children || [])walk(child);};walk(root);
            }
            if(this._popupWin.parent) root.layer2_mc.addChild(this._popupWin);
        };
        PIXI.Ticker.shared.add(this._guidedPopupTick);
        const mute = Number(window._sndVol) === 0 || !PIXI.sound;
        setContinue(true);
        if(!mute){
            this._playNarration(tab.sound, proceed, () => setContinue(true));
            this._guidedAudioTimeout = setTimeout(() => {
                if(!finished && (!this._narrationInstance || (PIXI.sound.context && PIXI.sound.context.audioContext && PIXI.sound.context.audioContext.state === 'suspended'))) setContinue(true);
            }, 15000);
        }
    };
    Onboarding.prototype._showGoodbye = function(){
        if(!this._popupWin) this._buildPopup();
        this._popupWin.visible = true;
        this._onboardingText.text = texts['когда чел решился слиться'];
        this._onboardingText.y = 312;
        this._mergeBtn.passive.visible = this._mergeBtn.active.visible = this._mergeBtn.hit.visible = false;
        const close = () => { clearTimeout(this._guidedAudioTimeout); this._guidedContinue = null; this._hidePopup(); };
        this._guidedContinue = close;
        const fallback = () => {this._continueBtn.hit.visible = this._continueBtn.passive.visible = true;this._continueBtn.hit.interactive = true;};
        this._continueBtn.hit.visible = this._continueBtn.passive.visible = true;
        this._continueBtn.hit.interactive = true;
        this._continueBtn.active.visible = false;
        root.layer2_mc.addChild(this._popupWin);
        if(Number(window._sndVol) === 0 || !PIXI.sound) fallback();
        else {this._guidedAudioTimeout = setTimeout(fallback,15000);this._playNarration('./sounds/обучение/когда чел решился слиться.mp3', close, fallback);}
    };
    Onboarding.prototype._guideActions = function(tab){
        if(tab.key === 'baza' && window.hata){ hata._idx = 0; hata._render(); }
        if(this._guidedPopupTick){ PIXI.Ticker.shared.remove(this._guidedPopupTick); this._guidedPopupTick = null; }
        const steps = tab.key === 'zone' ? ['cordon','zone-action','exit','exit'] : tab.key === 'baza' ? ['base-next','exit'] : ['exit'];
        let index = 0, waiting = false, disposed = false;
        const win = new PIXI.Container();
        const blocker = new PIXI.Graphics(); blocker.beginFill(0,0.45);blocker.drawRect(0,0,1280,720);blocker.endFill();blocker.interactive=true;win.addChild(blocker);
        const pulse = new PIXI.Graphics(); win.addChild(pulse);
        const hand = new PIXI.Sprite(PIXI.Texture.from('./images/рука указатель.png'));hand.anchor.set(0.5,0);win.addChild(hand);
        const hit = new PIXI.Graphics();hit.interactive=true;hit.buttonMode=true;win.addChild(hit);
        const find = node => {
            if(!node || node === win || node.visible === false || node.renderable === false) return null;
            const children = node.children || [];
            for(let i=children.length-1;i>=0;i--){const match=find(children[i]);if(match)return match;}
            return node._tutorialTarget === steps[index] ? node : null;
        };
        let target, phase=0, flashing=null, originalAlpha=1, handKey=null;
        const restoreFlash = () => { if(flashing && !flashing.destroyed) flashing.alpha=originalAlpha; flashing=null; };
        const offsets = this._guidedHandOffsets || (this._guidedHandOffsets = {});
        let point={x:0,y:0};
        hand._uDraggable = true;
        hand._uOnTransform = () => {
            if(handKey) offsets[handKey]={x:hand.x-point.x,y:hand.y-point.y,scale:hand.scale.x || 1,rotation:hand.rotation || 0};
        };
        const cleanup = () => { disposed = true; restoreFlash(); PIXI.Ticker.shared.remove(tick); if(win.parent) win.parent.removeChild(win);this._guidedCleanup=null; };
        const tick = () => {
            if(waiting || disposed) return;
            root.layer2_mc.addChild(win);
            target = find(root);
            hit.visible = hand.visible = pulse.visible = !!target;
            if(flashing !== target){ restoreFlash(); flashing=target; if(target) originalAlpha=target.alpha == null ? 1 : target.alpha; }
            if(!target) return;
            const bounds=target.getBounds();point=root.layer2_mc.toLocal(new PIXI.Point(bounds.x+bounds.width/2,bounds.y+bounds.height/2));
            phase+=0.03;target.alpha=originalAlpha*(0.58+0.42*(Math.sin(phase*3)+1)/2);
            pulse.clear();pulse.lineStyle(3,0xffffff,1-(phase%1));pulse.drawCircle(point.x,point.y,14+(phase%1)*25);
            const key=tab.key+':'+index;
            if(!offsets[key]){
                const layout=HAND_LAYOUTS[tab.key]?.[index];
                if(layout) offsets[key]={x:layout[0]-point.x,y:layout[1]-point.y,scale:1,rotation:layout[2]*Math.PI/180};
            }
            if(handKey !== key){handKey=key;hand.scale.set(offsets[key]?.scale || 1);hand.rotation=offsets[key]?.rotation || 0;}
            hand.x=point.x+(offsets[key]?.x || 0);hand.y=point.y+(offsets[key]?.y ?? 10);
            hit.clear();hit.beginFill(0,0.001);hit.drawRect(point.x-bounds.width/2,point.y-bounds.height/2,Math.max(32,bounds.width),Math.max(32,bounds.height));hit.endFill();
        };
        hit.on('pointerdown', event => {
            event.stopPropagation();if(waiting || !target || (window.iface && iface._uEditOn))return;
            const current=target;
            if(steps[index] === 'zone-action'){
                const loc = window.zone && zone.locations && zone.locations[0];
                const checkpoint = loc && loc.checkpoints.find(cp => cp.filled < cp.cells);
                const energy = window.TIMERS ? TIMERS.getEnergy() : Number(udata.energy || 0);
                if(!checkpoint || energy < checkpoint.cell_cost){
                    index++; tick();
                    if(window.notify) notify.showResult({text:!checkpoint ? 'Кордон уже зачищен — повторная трата энергии не требуется.' : 'Для действия нужна энергия. Она восстанавливается со временем.'},0);
                    return;
                }
            }
            waiting=true;
            const fights=Number(udata.zone_fights || 0);
            this._openingTourKey=tab.key;
            try{current.emit('pointerdown',event);}finally{this._openingTourKey=null;}
            const next=()=>{ index++;waiting=false;if(index>=steps.length){cleanup();this._advanceTour(tab.key);} };
            if(steps[index] === 'zone-action'){
                const wait=()=>{
                    if(disposed) return;
                    if(Number(udata.zone_fights || 0)>fights){next();return;}
                    if(window.zone && zone._fillInFlight){setTimeout(wait,100);return;}
                    waiting=false;
                };setTimeout(wait,100);
            }else next();
        });
        this._guidedCleanup=cleanup;PIXI.Ticker.shared.add(tick);tick();
    };
}

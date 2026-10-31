export function textTextureResolution(rendererResolution, transform){
    const t = transform || {};
    const sx = Math.hypot(t.a === undefined ? 1 : t.a, t.b || 0);
    const sy = Math.hypot(t.c || 0, t.d === undefined ? 1 : t.d);
    const scale = Math.max(sx, sy, 0.01);
    const physical = Math.max(0.01, Number(rendererResolution) || 1) * scale;
    return Math.min(4, Math.max(2, Math.ceil(physical * 1.25 * 4) / 4));
}

export function installTextQuality(PIXI, scope = window){
    const proto = PIXI && PIXI.Text && PIXI.Text.prototype;
    if(!proto || proto._pripyatTextQualityInstalled) return;
    Object.defineProperty(proto, '_pripyatTextQualityInstalled', {value:true});
    let fontEpoch = 0;
    const fonts = scope.document && scope.document.fonts;
    const refreshFonts = () => {
        fontEpoch++;
        if(PIXI.TextMetrics && typeof PIXI.TextMetrics.clearMetrics === 'function') PIXI.TextMetrics.clearMetrics();
    };
    if(fonts){
        if(fonts.ready && typeof fonts.ready.then === 'function') fonts.ready.then(refreshFonts);
        if(typeof fonts.addEventListener === 'function') fonts.addEventListener('loadingdone', refreshFonts);
    }
    for(const method of ['_render', '_renderCanvas']){
        const render = proto[method];
        if(typeof render !== 'function') continue;
        proto[method] = function(renderer){
            const desired = textTextureResolution(renderer._textPixelDensity || renderer.resolution, this.worldTransform);
            // The public setter also disables Pixi 6's automatic downgrade to renderer.resolution.
            if(this._autoResolution || this.resolution !== desired) this.resolution = desired;
            if(this._pripyatFontEpoch !== fontEpoch){
                this._pripyatFontEpoch = fontEpoch;
                this.dirty = true;
            }
            return render.call(this, renderer);
        };
    }
}

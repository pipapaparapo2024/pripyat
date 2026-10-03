// Use the bundle release for local images, including PIXI and Spine image loads.
export function installAssetVersion(version, scope = window){
    if(!version || version === '?') return;
    const base = new URL('./images/', scope.document.baseURI);
    const versionUrl = (source) => {
        if(typeof source !== 'string') return source;
        try {
            const url = new URL(source, scope.document.baseURI);
            if(url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return source;
            url.searchParams.set('asset_v', version);
            return url.href;
        } catch(e){ return source; }
    };
    const proto = scope.HTMLImageElement.prototype;
    const src = Object.getOwnPropertyDescriptor(proto, 'src');
    Object.defineProperty(proto, 'src', {
        ...src,
        set(value){ src.set.call(this, versionUrl(value)); }
    });
    const setAttribute = proto.setAttribute;
    proto.setAttribute = function(name, value){
        return setAttribute.call(this, name, String(name).toLowerCase() === 'src' ? versionUrl(value) : value);
    };
}

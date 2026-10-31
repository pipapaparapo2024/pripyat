// В iframe visualViewport может не сообщать масштаб внешней страницы.
// Жест меняет только плотность буфера, не координаты/размеры интерфейса.
export function installPinchDensity(win, onChange){
    let inferred = 1, start = 1, distance = 0;
    let dpr = win.devicePixelRatio || 1;
    const nativeScale = () => Number(win.visualViewport && win.visualViewport.scale) || 1;
    const clamp = n => Math.min(3, Math.max(1, n));
    const changed = () => onChange();
    const set = value => { inferred = clamp(value); changed(); };
    const touchDistance = e => e.touches && e.touches.length === 2
        ? Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY) : 0;
    win.addEventListener('wheel', e => { if(e.ctrlKey) set(inferred * Math.exp(-e.deltaY / 100)); }, {passive:true});
    win.addEventListener('gesturestart', () => { start = inferred; }, {passive:true});
    win.addEventListener('gesturechange', e => set(start * e.scale), {passive:true});
    win.addEventListener('touchstart', e => { distance = touchDistance(e); start = inferred; }, {passive:true});
    win.addEventListener('touchmove', e => { const current=touchDistance(e); if(distance && current) set(start * current / distance); }, {passive:true});
    return () => {
        const currentDpr = win.devicePixelRatio || 1;
        if(currentDpr !== dpr){ dpr=currentDpr; inferred=1; }
        const native = nativeScale();
        return native > 1 ? native : inferred;
    };
}

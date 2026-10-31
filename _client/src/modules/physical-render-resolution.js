// Match canvas backing pixels to the actual display, including pinch zoom.
export function physicalRendererResolution(cssWidth, devicePixelRatio = 1, zoomScale = 1){
    const width = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 1280;
    const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const zoom = Number.isFinite(zoomScale) && zoomScale > 0 ? zoomScale : 1;
    return Math.max(1, Math.round(width * dpr * zoom)) / 1280;
}

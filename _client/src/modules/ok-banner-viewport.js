// OK auto banners belong to the parent launcher, outside our DOM. In auto mode
// FAPI cannot hide/reposition them, so reserve their screen-space before fitting
// the complete 1280x720 scene (including popups and close buttons).
// Dimensions: https://new.apiok.ru/en/dev/sdk/js/ui.getBannerFormats
// Keep this policy separate from VK and from the logical orientation of the game.
export function okBannerViewport(viewport, { enabled = false, mobile = false } = {}){
    if(!enabled) return viewport;
    const portrait = viewport.portrait;
    // Reserve both supported positions: auto settings and banner availability can
    // change without delivering geometry to the embedded game. Keep the space even
    // after an ad is hidden (OK's "ad hidden" placeholder still intercepts clicks).
    const bar = Math.min(106 + 8, Math.max(0, (viewport.h - 1) / 2));
    const side = Math.min(mobile ? (portrait ? 0 : 120 + 8) : 320 + 8,
        Math.max(0, (viewport.w - 1) / 2));
    const left = viewport.left + side;
    const top = viewport.top + bar;
    const w = Math.max(1, viewport.w - 2 * side);
    const h = Math.max(1, viewport.h - 2 * bar);
    return { ...viewport, left, top, w, h,
        // Orientation follows the physical viewport, not the remaining rectangle.
        portrait,
        bannerInsets: { top: bar, bottom: bar, left: side, right: side }
    };
}

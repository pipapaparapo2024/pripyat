// Move the top/bottom edges inward without cutting any pixels from the texture.
export function applyShopIconCompression(sprite, item){
    const left = Number(item.cellCompressLeft) || 0;
    const width = Number(item.cellWidth);
    if(left > 0 && width > left){
        sprite.width = width - left;
        // Center anchor: preserve the right edge while moving the left edge inward.
        sprite.x += left / 2;
    }
    const top = Number(item.cellCompressTop) || 0;
    const bottom = Number(item.cellCompressBottom) || 0;
    const height = Number(item.cellHeight);
    if(top < 0 || bottom < 0 || !height || top + bottom <= 0 || top + bottom >= height) return;
    const originalY = sprite.y;
    if(!left) sprite.width = item.cellWidth;
    sprite.height = height - top - bottom;
    sprite.y = originalY + (top - bottom) / 2;
}

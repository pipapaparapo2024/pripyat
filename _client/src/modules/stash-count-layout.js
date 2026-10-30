// Position counts only after every image used by the formula has its real size.
export function placeStashCount(text, card, actionButton = null, friend = false){
    const images = actionButton ? [card, actionButton] : [card];
    const ready = sprite => sprite.texture.width > 1 && sprite.texture.height > 1;
    const update = () => {
        if(text.destroyed || images.some(image => image.destroyed)) return;
        if(!images.every(ready)){ text.visible = false; return; }
        text.x = card.x + card.width / 2 + (actionButton ? 1 : 0);
        text.y = actionButton
            ? actionButton.y + actionButton.height + 1 - 47 - 3 - (friend ? 3 : 0)
            : card.y + card.height - 20;
        text.visible = true;
    };
    images.forEach(image => { if(!ready(image)) image.texture.once('update', update); });
    update();
}

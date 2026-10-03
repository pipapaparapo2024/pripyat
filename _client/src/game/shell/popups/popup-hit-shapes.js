/** Invisible, editor-friendly hit zones for popup buttons with slanted sides. */
export function makeParallelogramHit(parent, x, y, width, height, slant = 14){
    const g = new PIXI.Graphics();
    const points = [slant, 0, width, 0, width - slant, height, 0, height];
    g.beginFill(0xffffff, 0.001);
    g.drawPolygon(points);
    g.endFill();
    g.x = x;
    g.y = y;
    g.interactive = true;
    g.buttonMode = true;
    g._uDraggable = true;
    g._uHitShape = 'parallelogram';
    g._uHitPolygon = points;
    if(parent) parent.addChild(g);
    return g;
}

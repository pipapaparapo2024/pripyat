import re

# ──────────────────────────────────────────────────────
# dvor-poker.js
# ──────────────────────────────────────────────────────
poker_path = '_client/src/game/dvor/dvor-poker.js'
with open(poker_path, 'r', encoding='utf-8') as f:
    src = f.read()

changes = [
    # 1. Poker card constants
    (
        'const CSCALE = 0.55;\n        const CW = Math.round(152 * CSCALE);\n        const CH = Math.round(250 * CSCALE);\n        const CGAP = 14;\n        const CX0  = 340;\n        const CY   = 235;',
        'const CW = 73;\n        const CH = 123;\n        const CGAP = 11;\n        const CX0  = 385;\n        const CY   = 292;'
    ),
    # 2. Poker card sprite: scale → width/height
    (
        'const cardSpr = new PIXI.Sprite(PIXI.Texture.from(\'./images/семерка.png?v=221\'));\n            cardSpr.scale.set(CSCALE);\n            cardSpr.x = cx; cardSpr.y = CY;',
        'const cardSpr = new PIXI.Sprite(PIXI.Texture.from(\'./images/семерка.png?v=221\'));\n            cardSpr.width = CW; cardSpr.height = CH;\n            cardSpr.x = cx; cardSpr.y = CY;'
    ),
    # 3. _updatePokerCardVisual: reset size after texture change
    (
        '            this._pokerCardSprites[idx].texture = PIXI.Texture.from(this._getCardImgPath(card.rank));\n            this._pokerSuitTexts[idx].text = card.suit;',
        '            this._pokerCardSprites[idx].texture = PIXI.Texture.from(this._getCardImgPath(card.rank));\n            this._pokerCardSprites[idx].width = 73; this._pokerCardSprites[idx].height = 123;\n            this._pokerSuitTexts[idx].text = card.suit;'
    ),
    # 4. Bag: AMT_STYLE → black
    (
        "const AMT_STYLE = {\n            fontFamily:'Southbank LT', fontSize:20, fill:'#ffdd44',\n            fontWeight:'bold', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1\n        };",
        "const AMT_STYLE = {\n            fontFamily:'Southbank LT', fontSize:20, fill:'#000000',\n            fontWeight:'bold', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1\n        };"
    ),
    # 5. Bag: exp position (down 32, right 12) → 612+12=624, 155+32=187
    (
        '_addAmt(\'+\' + exp,                        612, 155);',
        '_addAmt(\'+\' + exp,                        624, 187);'
    ),
    # 6. Bag: cig position (up 32, right 28) → 350+28=378, 420-32=388
    (
        '_addAmt(\'+\' + cig,                        350, 420);',
        '_addAmt(\'+\' + cig,                        378, 388);'
    ),
    # 7. Bag: stash position (up 36, right 20) → 560+20=580, 500-36=464
    (
        '_addAmt(\'+\' + stash,                      560, 500);',
        '_addAmt(\'+\' + stash,                      580, 464);'
    ),
    # 8. Bag: coins position (up 20, left 4) → 840-4=836, 360-20=340
    (
        '_addAmt(\'+\' + coins,                      840, 360);',
        '_addAmt(\'+\' + coins,                      836, 340);'
    ),
    # 9. Bag: tattoo element → left 24, up 10, rotate -6deg
    (
        '_addAmt(hasTatu ? \'1\' : \'нету\', 840, 460);',
        '''{ const tatu = new PIXI.Text(hasTatu ? '1' : 'нету', AMT_STYLE);
            tatu.anchor.set(0.5, 0.5);
            tatu.x = 816; tatu.y = 450;
            tatu.rotation = -6 * Math.PI / 180;
            win.addChild(tatu); }'''
    ),
    # 10. Bag: takeBtn position (up 12, left 16) → 640-16=624, 562-12=550
    (
        'takeBtn.x = 640; takeBtn.y = 562;',
        'takeBtn.x = 624; takeBtn.y = 550;'
    ),
]

failed = []
for old, new in changes:
    if old not in src:
        failed.append(old[:60])
    else:
        src = src.replace(old, new)

with open(poker_path, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'poker.js: {len(changes) - len(failed)} ok, {len(failed)} failed')
if failed:
    for f in failed: print('  FAIL:', f)

# ──────────────────────────────────────────────────────
# dvor-blackjack.js
# ──────────────────────────────────────────────────────
bj_path = '_client/src/game/dvor/dvor-blackjack.js'
with open(bj_path, 'r', encoding='utf-8') as f:
    src = f.read()

changes_bj = [
    # 1. BJ card constants: size and positions
    (
        'const CSCALE = 0.55;\n        const CW = Math.round(152 * CSCALE);\n        const CH = Math.round(250 * CSCALE);\n        const POSITIONS = [\n            {x: 200, y: 190}, {x: 380, y: 190},\n            {x: 200, y: 350}, {x: 380, y: 350},\n        ];',
        'const CW = 101;\n        const CH = 152;\n        const POSITIONS = [\n            {x: 325, y: 179}, {x: 445, y: 179},\n            {x: 325, y: 337}, {x: 445, y: 337},\n        ];'
    ),
    # 2. BJ card sprite: scale → width/height
    (
        "const cardSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'туз.png?v=221'));\n            cardSpr.scale.set(CSCALE);\n            cardSpr.x = pos.x; cardSpr.y = pos.y;",
        "const cardSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'туз.png?v=221'));\n            cardSpr.width = CW; cardSpr.height = CH;\n            cardSpr.x = pos.x; cardSpr.y = pos.y;"
    ),
    # 3. Reset size after animation texture change (line 237)
    (
        "                    this._bjCardSprites[i].texture = PIXI.Texture.from('./images/' + RANKS[Math.floor(Math.random()*8)] + '.png?v=221');\n                    this._bjCardSprites[i].visible = true;",
        "                    this._bjCardSprites[i].texture = PIXI.Texture.from('./images/' + RANKS[Math.floor(Math.random()*8)] + '.png?v=221');\n                    this._bjCardSprites[i].width = 101; this._bjCardSprites[i].height = 152;\n                    this._bjCardSprites[i].visible = true;"
    ),
    # 4. Reset size after hand display (line 256)
    (
        "                spr.texture = PIXI.Texture.from('./images/' + card.rank + '.png?v=221');\n                spr.visible = true;",
        "                spr.texture = PIXI.Texture.from('./images/' + card.rank + '.png?v=221');\n                spr.width = 101; spr.height = 152;\n                spr.visible = true;"
    ),
    # 5. Reset size after swap (line 309)
    (
        "        if(spr) spr.texture = PIXI.Texture.from('./images/' + newCard.rank + '.png?v=221');",
        "        if(spr){ spr.texture = PIXI.Texture.from('./images/' + newCard.rank + '.png?v=221'); spr.width = 101; spr.height = 152; }"
    ),
]

failed_bj = []
for old, new in changes_bj:
    if old not in src:
        failed_bj.append(old[:60])
    else:
        src = src.replace(old, new)

with open(bj_path, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'blackjack.js: {len(changes_bj) - len(failed_bj)} ok, {len(failed_bj)} failed')
if failed_bj:
    for f in failed_bj: print('  FAIL:', f)

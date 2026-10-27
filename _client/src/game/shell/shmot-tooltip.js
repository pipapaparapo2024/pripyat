/** Общая "богатая" подсказка по выпавшей шмотке (имя/бонус/сет/требования) — 24.10.2026, по
 * прямому указанию: попап награды сумки покера/кейса рулетки показывал только голое название
 * предмета (простой прямоугольник с текстом), а должен — тот же вид карточки, что уже есть в
 * магазине шмоток (shmot_shop.js._showShopTip). Вынесено в отдельный модуль, чтобы не дублировать
 * вёрстку карточки в каждом месте, где может выпасть шмотка (сейчас: popups/reward.js для кейса
 * рулетки, dvor-poker-bag.js для сумки покера; дальше — где угодно ещё).
 *
 * item — запись каталога шмоток (shmot.js): нужны name/bonus/set/source/fragments/id/owned.
 * Прогресс сета считается через window.shmot._setProgress() (тот же метод, что в магазине).
 *
 * 26.10.2026 (по прямому указанию, переиспользование для баннера "шанс на шмотку" в рюкзаке
 * Сидоровича — ryukzak.js): у баннера рюкзака строки "Требования:" быть НЕ должно (в отличие
 * от попапа награды сумки/кейса, где она нужна) — opts.showRequirements=false отключает блок
 * целиком, остальная карточка (имя/бонус/сет) не меняется.
 */
export function buildShmotTooltipCard(item, opts){
    const showRequirements = !opts || opts.showRequirements !== false;
    const card = new PIXI.Container();
    if(!item) return { card, width: 0, height: 0 };

    const PAD = 12;
    const CONTENT_W = 250;
    const titleStyle = { fontFamily:'Southbank LT', fontSize:17, fontWeight:'bold', fill:'#ac3b26',
        wordWrap:true, wordWrapWidth:CONTENT_W };
    const lblStyle   = { fontFamily:'Southbank LT', fontSize:14, fontWeight:'bold', fill:'#2a2118' };
    const valStyle   = { fontFamily:'Southbank LT', fontSize:14, fill:'#ac5238' };

    let y = PAD;
    const title = new PIXI.Text(item.name || '', titleStyle);
    title.x = PAD; title.y = y;
    card.addChild(title);
    y += title.height + 8;

    const bonusLbl = new PIXI.Text('Бонус: ', lblStyle);
    bonusLbl.x = PAD; bonusLbl.y = y;
    card.addChild(bonusLbl);
    const bonusVal = new PIXI.Text(item.bonus || 'нет бонуса',
        Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - bonusLbl.width }));
    bonusVal.x = PAD + bonusLbl.width; bonusVal.y = y;
    card.addChild(bonusVal);
    y += Math.max(bonusLbl.height, bonusVal.height) + 6;

    if(item.set){
        const setLbl = new PIXI.Text('Сет: ', lblStyle);
        setLbl.x = PAD; setLbl.y = y;
        card.addChild(setLbl);
        const prog = (window.shmot && typeof shmot._setProgress === 'function') ? shmot._setProgress(item.set) : null;
        const setTxt = prog ? (item.set + ' (' + prog.have + '/' + prog.total + ')') : item.set;
        const setVal = new PIXI.Text(setTxt,
            Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - setLbl.width }));
        setVal.x = PAD + setLbl.width; setVal.y = y;
        card.addChild(setVal);
        y += Math.max(setLbl.height, setVal.height) + 10;
    }

    if(showRequirements){
        // Пунктирная линия-разделитель (PIXI не умеет dashed lineStyle нативно — рисуем сами),
        // тот же приём, что в shmot_shop.js._showShopTip.
        const sep = new PIXI.Graphics();
        sep.lineStyle(1, 0x9c8770, 0.9);
        const DASH = 5, GAP = 4, sepY = y;
        for(let dx = 0; dx < CONTENT_W; dx += DASH + GAP){
            sep.moveTo(PAD + dx, sepY);
            sep.lineTo(Math.min(PAD + dx + DASH, PAD + CONTENT_W), sepY);
        }
        card.addChild(sep);
        y += 10;

        const reqLbl = new PIXI.Text('Требования:', lblStyle);
        reqLbl.x = PAD; reqLbl.y = y;
        card.addChild(reqLbl);
        y += reqLbl.height + 4;

        let reqText = item.source || '?';
        if(item.fragments && !item.owned){
            const have = (window.shmot && shmot.fragmentsProgress && shmot.fragmentsProgress[item.id]) || 0;
            reqText += '\nСобрано частей: ' + have + '/' + item.fragments;
        }
        const INDENT = 14;
        const reqVal = new PIXI.Text(reqText,
            Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - INDENT }));
        reqVal.x = PAD + INDENT; reqVal.y = y;
        card.addChild(reqVal);
        y += reqVal.height;
    }

    const totalW = CONTENT_W + PAD * 2;
    const totalH = y + PAD;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfbeee0, 0.97);
    bg.lineStyle(2, 0xc79a72, 1);
    bg.drawRoundedRect(0, 0, totalW, totalH, 8);
    bg.endFill();
    card.addChildAt(bg, 0);

    return { card, width: totalW, height: totalH };
}

/**
 * Автообрезка полей у картинок карт покера по фактическому содержимому.
 *
 * Проблема: исходники карт по мастям/рангам экспортированы неодинаково — у одних
 * рисунок залит от края до края канваса, у других есть небольшая полупрозрачная
 * кайма/тень (несколько пикселей альфы 1-200 по краям). Раньше карта масштабировалась
 * под фиксированный бокс (80×127) от ВСЕГО канваса — у карт с каймой видимая часть
 * рисунка оказывалась чуть меньше бокса, у карт без каймы рисунок заполнял бокс
 * полностью. Внешне это выглядело как "разные размеры карт", хотя bounding box
 * (spr.width/height) был идентичным у всех.
 *
 * Решение: один раз на файл сканируем реальные пиксели через offscreen-канвас, ищем
 * тесную рамку по строгому порогу альфы (граница между "фон/кайма" и "рисунок"),
 * и создаём PIXI.Texture с frame = этой рамке — сам PixiJS дальше масштабирует именно
 * обрезанную область, без каймы. Результат кэшируется по URL, повторный запрос той же
 * карты не пересчитывает пиксели заново.
 */

const ALPHA_THRESHOLD = 200; // всё что бледнее — считаем каймой/тенью, не рисунком
const _trimCache = new Map(); // url -> PIXI.Rectangle | null (null = обрезать не нужно/не вышло)

function _scanContentBBox(source, w, h){
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for(let y = 0; y < h; y++){
        const row = y * w;
        for(let x = 0; x < w; x++){
            if(data[(row + x) * 4 + 3] >= ALPHA_THRESHOLD){
                if(x < minX) minX = x;
                if(x > maxX) maxX = x;
                if(y < minY) minY = y;
                if(y > maxY) maxY = y;
            }
        }
    }
    if(maxX < 0) return null; // картинка полностью прозрачна — не должно случаться, но не падаем
    return new PIXI.Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
}

/**
 * Возвращает через callback текстуру, обрезанную по содержимому (или исходную tex,
 * если обрезка не требуется/не удалась — например, canvas недоступен из-за CORS).
 */
export function getTrimmedCardTexture(tex, onReady){
    const resource = tex.baseTexture.resource;
    const url = resource && resource.url;
    if(!url){ onReady(tex); return; }

    if(_trimCache.has(url)){
        const bbox = _trimCache.get(url);
        onReady(bbox ? new PIXI.Texture(tex.baseTexture, bbox) : tex);
        return;
    }

    const _finish = () => {
        const w = tex.baseTexture.realWidth, h = tex.baseTexture.realHeight;
        const source = resource.source;
        if(!source || !w || !h){
            console.error('[dvor-poker-card-trim.getTrimmedCardTexture] нет source/размеров у', url, '— обрезка пропущена');
            _trimCache.set(url, null); onReady(tex); return;
        }
        try {
            const bbox = _scanContentBBox(source, w, h);
            const marginX = bbox ? Math.min(bbox.x, w - bbox.x - bbox.width) : 0;
            const marginY = bbox ? Math.min(bbox.y, h - bbox.y - bbox.height) : 0;
            console.log('[dvor-poker-card-trim.getTrimmedCardTexture]', url,
                '| канвас='+w+'x'+h, '| содержимое='+(bbox ? bbox.width+'x'+bbox.height+' offset('+bbox.x+','+bbox.y+')' : 'не найдено'),
                '| поля(мин.сторона)='+marginX+'x'+marginY+'px');
            _trimCache.set(url, bbox);
            onReady(bbox ? new PIXI.Texture(tex.baseTexture, bbox) : tex);
        } catch(e){
            console.error('[dvor-poker-card-trim.getTrimmedCardTexture] ошибка чтения пикселей (CORS?) для', url, ':', e.message);
            _trimCache.set(url, null); onReady(tex);
        }
    };

    if(tex.baseTexture.valid) _finish();
    else {
        tex.baseTexture.once('loaded', _finish);
        tex.baseTexture.once('error', () => { _trimCache.set(url, null); onReady(tex); });
    }
}

const _ALL_RANKS = ['двойка','тройка','четверка','пятерка','шестерка','семерка','восьмерка','девятка','десятка','валет','дама','король','туз'];
const _ALL_SUITS = ['♠','♥','♦','♣'];

/**
 * Прогревает кэш обрезки для ВСЕХ 32 карт колоды заранее (вызывается один раз при
 * открытии экрана покера, до первой раздачи/тасования). Без этого первая анимация
 * тасования показывала карты «сырого» (необрезанного) размера, пока обрезка каждой
 * карты считалась асинхронно в реальном времени — из-за чего был заметен скачок
 * размера между анимацией тасования и финальной раздачей. После прогрева
 * getTrimmedCardTexture() для уже отсканированной карты отвечает синхронно (из кэша),
 * поэтому и тасование, и раздача с первого кадра используют одинаковый обрезанный размер.
 */
export function preloadAllCardTrims(getCardImgPath){
    let done = 0;
    const total = _ALL_RANKS.length * _ALL_SUITS.length;
    _ALL_RANKS.forEach(rank => {
        _ALL_SUITS.forEach(suit => {
            const tex = PIXI.Texture.from(getCardImgPath(rank, suit));
            getTrimmedCardTexture(tex, () => {
                done++;
                if(done === total){
                    console.log('[dvor-poker-card-trim.preloadAllCardTrims] прогрев завершён, карт:', total);
                }
            });
        });
    });
}

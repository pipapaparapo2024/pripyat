/** 28.10.2026 (баг найден по прямому указанию — "Собрано коллекций пишется не теми шрифтами"
 * в svod-zanachki.js, подтверждено тем же классом гонки, что уже чинился в
 * interface-currency-purchase.js/game2048-top-popup.js) — PIXI печёт canvas текста СРАЗУ по
 * запросу, не дожидаясь реальной загрузки @font-face (подключается только hidden-span трюком в
 * index.html, см. ПРАВИЛО №11 в AGENTS.md). Если экран строится раньше, чем нужный шрифт готов,
 * canvas молча подставляет системный fallback с другими пропорциями глифов — и остаётся таким
 * НАВСЕГДА, даже когда шрифт потом догружается, пока что-то явно не пометит текст "грязным".
 *
 * Прежние фиксы (game2048-top-popup.js/interface-currency-purchase.js) откладывали СБОРКУ ВСЕГО
 * экрана целиком до document.fonts.ready — подходит, когда открытие асинхронно переносимо на
 * момент позже (попап/экран без синхронного возврата значения вызывающему коду). Для экранов,
 * где сборка обязана вернуть готовую панель СРАЗУ (например svod.js._ensurePanel(), которая
 * синхронно кладёт результат на сцену) — этот модуль вместо отсрочки всей сборки просто строит
 * текст сразу с тем шрифтом, что есть, и, если настоящий шрифт на тот момент ещё не готов,
 * перерисовывает ПЕРЕДАННЫЕ текстовые объекты после document.fonts.ready (dirty=true форсирует
 * PIXI.Text перерисовать canvas на следующем кадре актуальным style.fontFamily, без изменения
 * самой строки текста — .text = .text не подошёл бы, PIXI пропускает редрав при неизменной
 * строке).
 */
export function scheduleFontRedraw(checkFontCss, texts){
    if(typeof document === 'undefined' || !document.fonts || typeof document.fonts.check !== 'function') return;
    if(document.fonts.check(checkFontCss)) return;
    console.log('[font-ready.scheduleFontRedraw] шрифт ещё не готов (' + checkFontCss + ') — перерисую ' + texts.length + ' текстовых объектов после document.fonts.ready');
    document.fonts.ready.then(() => {
        texts.forEach(t => { if(t && !t.destroyed) t.dirty = true; });
        console.log('[font-ready.scheduleFontRedraw] шрифт готов, перерисовано ' + texts.length + ' объектов');
    });
}

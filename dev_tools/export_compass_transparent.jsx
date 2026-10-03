// Экспортирует компас из Компас.psd без фона
// Запуск: Файл → Сценарии → Обзор → этот файл

var psdFile = new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/Компас.psd");
var outFile = new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/_client/development/images/hud/compass_loader.png");

if (!psdFile.exists) { alert("Файл не найден: Компас.psd"); }
else {
    var doc = app.open(psdFile);

    // Скрыть ВСЕ слои кроме Группа 1
    for (var i = 0; i < doc.layers.length; i++) {
        var l = doc.layers[i];
        if (l.name === "Группа 1") {
            l.visible = true;
        } else {
            l.visible = false;
        }
    }

    // Экспорт БЕЗ flatten — сохраняет прозрачность
    var opts = new ExportOptionsSaveForWeb();
    opts.format = SaveDocumentType.PNG;
    opts.PNG8 = false;
    opts.transparency = true;

    doc.exportDocument(outFile, ExportType.SAVEFORWEB, opts);
    doc.close(SaveOptions.DONOTSAVECHANGES);

    alert("Готово! Компас экспортирован в:\n" + outFile.fsName);
}

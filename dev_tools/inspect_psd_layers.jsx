// Запуск: Файл → Сценарии → Обзор → выбрать этот файл
// Выводит список ВСЕХ слоёв и их размеры для диагностики

function inspectLayers(layers, depth) {
    var result = "";
    var indent = "";
    for (var i = 0; i < depth; i++) indent += "  ";
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        var b = layer.bounds;
        var w = Math.round(b[2] - b[0]);
        var h = Math.round(b[3] - b[1]);
        var x = Math.round(b[0]);
        var y = Math.round(b[1]);
        result += indent + "[" + layer.typename + "] \"" + layer.name + "\" x=" + x + " y=" + y + " w=" + w + " h=" + h + "\n";
        if (layer.typename === "LayerSet" && layer.layers) {
            result += inspectLayers(layer.layers, depth + 1);
        }
    }
    return result;
}

var files = [
    "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/ящик.psd",
    "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/худ3,0.psd",
    "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/Компас.psd"
];

var outPath = "C:/Users/HONOR/Desktop/psd_layers_report.txt";
var report = "";

for (var f = 0; f < files.length; f++) {
    var file = new File(files[f]);
    if (!file.exists) {
        report += "=== НЕ НАЙДЕН: " + files[f] + " ===\n\n";
        continue;
    }
    var doc = app.open(file);
    report += "=== " + doc.name + " (" + doc.width + "x" + doc.height + ") ===\n";
    report += inspectLayers(doc.layers, 0);
    report += "\n";
    doc.close(SaveOptions.DONOTSAVECHANGES);
}

var outFile = new File(outPath);
outFile.open("w");
outFile.write(report);
outFile.close();

alert("Готово!\nОтчёт сохранён:\n" + outPath);

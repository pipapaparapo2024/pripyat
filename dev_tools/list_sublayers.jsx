// Файл → Сценарии → Обзор → выбрать этот файл
var doc = app.open(new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/ящик.psd"));

function listGroup(layers, indent) {
    var out = "";
    for (var i = 0; i < layers.length; i++) {
        var l = layers[i];
        out += indent + i + ": [" + (l.visible ? "V" : " ") + "] " + l.name + " (" + l.typename + ")\n";
        if (l.typename === "LayerSet") {
            out += listGroup(l.layers, indent + "  ");
        }
    }
    return out;
}

// Найти "нижняя панель"
var targetGroup = null;
for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name.indexOf("нижн") !== -1) {
        targetGroup = doc.layers[i];
        break;
    }
}

var result = "";
if (targetGroup && targetGroup.typename === "LayerSet") {
    result = "Группа: " + targetGroup.name + "\n\n";
    result += listGroup(targetGroup.layers, "  ");
} else {
    result = "Группа 'нижняя панель' не найдена или не является группой";
}

doc.close(SaveOptions.DONOTSAVECHANGES);
alert(result);

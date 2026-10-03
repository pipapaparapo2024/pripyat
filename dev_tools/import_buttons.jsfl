// Animate: Команды → Запустить команду
var flaPath  = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/content/animate/interface_elements/interface_elements.fla";
var btnDir   = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/buttons/";

var buttons = [
    "butt_bosses",
    "butt_gangs",
    "butt_shmot",
    "butt_vassilich",
    "butt_weapons",
    "butt_zone",
    "down_bg"
];

var doc = fl.openDocument(flaPath);
fl.setActiveWindow(doc);

for (var i = 0; i < buttons.length; i++) {
    var url = btnDir + buttons[i] + ".png";
    doc.importFile(url, true);
    fl.trace("Импортирован: " + buttons[i] + ".png");
}

doc.save(false);
fl.trace("=== ГОТОВО === Все кнопки импортированы в библиотеку.");

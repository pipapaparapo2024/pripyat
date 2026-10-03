// Animate: Команды → Запустить команду
var flaPath = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/content/animate/interface_elements/interface_elements.fla";

var buttons = [
    "butt_bosses.png",
    "butt_gangs.png",
    "butt_shmot.png",
    "butt_vassilich.png",
    "butt_weapons.png",
    "butt_zone.png",
    "down_bg.png"
];

var doc = fl.openDocument(flaPath);
fl.setActiveWindow(doc);

var tl = doc.getTimeline();

// Создаём скрытый слой для кнопок
tl.addNewLayer("_buttons_export");
var btnLayerIdx = tl.findLayerIndex("_buttons_export")[0];
tl.currentLayer = btnLayerIdx;

// Размещаем все кнопки далеко за пределами видимой области (x=5000)
var xPos = 5000;
for (var i = 0; i < buttons.length; i++) {
    doc.library.addItemToDocument({x: xPos, y: 0}, buttons[i]);
    xPos += 50;
    fl.trace("Размещён: " + buttons[i]);
}

// Скрываем слой
tl.layers[btnLayerIdx].visible = false;

doc.save(false);
fl.trace("=== ГОТОВО === Теперь публикуй через PixiAnimate.");

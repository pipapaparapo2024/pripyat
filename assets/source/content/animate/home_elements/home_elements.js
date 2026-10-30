window.home_elements = {
    version: 2,
    stage: null,
    background: 0xffffff,
    width: 1280,
    height: 720,
    framerate: 30,
    totalFrames: 1,
    assets: {
        "home_elements_atlas_1": "images/home_elements_atlas_1.json"
    },
    lib: {},
    shapes: {},
    textures: {},
    spritesheets: [],
    getTexture: function (id) {
        if (home_elements.textures[id]) {
            return home_elements.textures[id];
        }
        const atlas = home_elements.spritesheets.find(atlas => !!atlas.textures[id]);
        return atlas ? atlas.textures[id] : null;
    },
    setup: function (animate) {
        const MovieClip = animate.MovieClip;
        const Container = animate.Container;
        const Sprite = animate.Sprite;


        home_elements.lib.home_bg0 = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(home_elements.getTexture("home_bg0"))
                    .setTransform(-351, -111);
                this.addChild(instance1);
            }
        };

        home_elements.lib.Home_backgrounds = class extends Container {
            constructor() {
                super();
                const instance1 = new home_elements.lib.home_bg0();
                this.addChild(instance1);
            }
        };

        home_elements.lib.z_NoMovie = class extends Container {
            constructor() {
                super();

            }
        };

        home_elements.lib.Home_Room = class extends Container {
            constructor() {
                super();
                const instance1 = new home_elements.lib.z_NoMovie();
                this[instance1.name = "back_mc"] = instance1;
                this.addChild(instance1);
            }
        };

        home_elements.lib.home_elements = class extends MovieClip {
            constructor() {
                super({
                    duration: 1,
                    framerate: 30
                });
                const instance2 = new home_elements.lib.Home_Room()
                    .setTransform(-1.55, -1.55);
                this[instance2.name = "home_full"] = instance2;
                const instance1 = new home_elements.lib.Home_backgrounds()
                    .setTransform(-2000);
                this[instance1.name = "home_bgs"] = instance1;
                this.addChild(instance2, instance1);
            }
        };
        home_elements.stage = home_elements.lib.home_elements;
    }
};



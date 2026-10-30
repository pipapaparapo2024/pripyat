window.preloader = {
    version: 2,
    stage: null,
    background: 0xffffff,
    width: 1280,
    height: 720,
    framerate: 30,
    totalFrames: 1,
    assets: {
        "preloader_atlas_1": "images/preloader_atlas_1.json"
    },
    lib: {},
    shapes: {},
    textures: {},
    spritesheets: [],
    getTexture: function (id) {
        if (preloader.textures[id]) {
            return preloader.textures[id];
        }
        const atlas = preloader.spritesheets.find(atlas => !!atlas.textures[id]);
        return atlas ? atlas.textures[id] : null;
    },
    setup: function (animate) {
        const MovieClip = animate.MovieClip;
        const Container = animate.Container;
        const Sprite = animate.Sprite;


        preloader.lib.z_NoMovie = class extends Container {
            constructor() {
                super();

            }
        };

        preloader.lib.preloader_light = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(preloader.getTexture("preloader_light"));
                this.addChild(instance1);
            }
        };

        preloader.lib.preloader_monster0 = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(preloader.getTexture("preloader_monster0"));
                this.addChild(instance1);
            }
        };

        preloader.lib.preloader_monster1 = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(preloader.getTexture("preloader_monster1"));
                this.addChild(instance1);
            }
        };

        preloader.lib.preloader_monster2 = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(preloader.getTexture("preloader_monster2"));
                this.addChild(instance1);
            }
        };

        preloader.lib.preloader_monster = class extends MovieClip {
            constructor() {
                super({
                    duration: 391
                });
                const instance1 = new preloader.lib.preloader_monster0();
                this[instance1.name = "monster0"] = instance1;
                const instance2 = new preloader.lib.preloader_light();
                this[instance2.name = "light"] = instance2;
                const instance3 = new preloader.lib.preloader_light();
                this[instance3.name = "light"] = instance3;
                const instance4 = new preloader.lib.preloader_light();
                this[instance4.name = "light"] = instance4;
                const instance5 = new preloader.lib.preloader_monster1();
                this[instance5.name = "monster1"] = instance5;
                const instance6 = new preloader.lib.preloader_light();
                this[instance6.name = "light"] = instance6;
                const instance7 = new preloader.lib.preloader_light();
                this[instance7.name = "light"] = instance7;
                const instance8 = new preloader.lib.preloader_light();
                this[instance8.name = "light"] = instance8;
                const instance10 = new preloader.lib.preloader_monster2()
                    .setTransform(25);
                this[instance10.name = "monster2"] = instance10;
                const instance9 = new preloader.lib.preloader_light()
                    .setTransform(-126, -228);
                this[instance9.name = "light"] = instance9;
                this.addTimedChild(instance1, 0, 30, {
                        "0": {
                            x: 209.5,
                            y: 188.45
                        }
                    })
                    .addTimedChild(instance2, 30, 30, {
                        "30": {
                            x: -126,
                            y: -228
                        }
                    })
                    .addTimedChild(instance3, 90, 30, {
                        "90": {
                            x: -126,
                            y: -228
                        }
                    })
                    .addTimedChild(instance4, 151, 29, {
                        "151": {
                            x: -126,
                            y: -228
                        }
                    })
                    .addTimedChild(instance5, 180, 31, {
                        "180": {
                            x: 304.5,
                            y: 146.5
                        }
                    })
                    .addTimedChild(instance6, 211, 29, {
                        "211": {
                            x: -126,
                            y: -228
                        }
                    })
                    .addTimedChild(instance7, 270, 30, {
                        "270": {
                            x: -126,
                            y: -228
                        }
                    })
                    .addTimedChild(instance8, 329, 31, {
                        "329": {
                            x: -126,
                            y: -228
                        }
                    })
                    .addTimedChild(instance10, 390, 1)
                    .addTimedChild(instance9, 390, 1)
                    .addAction(function () {
                        this.monster0.visible = false;
                    }, 29)
                    .addAction(function () {
                        this.monster1.visible = false;
                    }, 210)
                    .addAction(function () {
                        this.stop();
                    }, 390);
            }
        };

        preloader.lib.preloader_1 = class extends Container {
            constructor() {
                super();
                const instance3 = new Sprite(preloader.getTexture("preloader_bg"));
                const instance2 = new preloader.lib.preloader_monster()
                    .setTransform(210, 68);
                this[instance2.name = "anim"] = instance2;
                const instance1 = new preloader.lib.z_NoMovie();
                this[instance1.name = "error_mc"] = instance1;
                this.addChild(instance3, instance2, instance1);
            }
        };

        preloader.lib.preloader = class extends MovieClip {
            constructor() {
                super({
                    duration: 1,
                    framerate: 30
                });
                const instance1 = new preloader.lib.preloader_1();
                this[instance1.name = "preloader_mc"] = instance1;
                this.addChild(instance1);
            }
        };
        preloader.stage = preloader.lib.preloader;
    }
};



window.notify = {
    version: 2,
    stage: null,
    background: 0xffffff,
    width: 1280,
    height: 720,
    framerate: 30,
    totalFrames: 1,
    assets: {
        "notify": "images/notify.shapes.txt",
        "notify_atlas_1": "images/notify_atlas_1.json"
    },
    lib: {},
    shapes: {},
    textures: {},
    spritesheets: [],
    getTexture: function (id) {
        if (notify.textures[id]) {
            return notify.textures[id];
        }
        const atlas = notify.spritesheets.find(atlas => !!atlas.textures[id]);
        return atlas ? atlas.textures[id] : null;
    },
    setup: function (animate) {
        const MovieClip = animate.MovieClip;
        const Container = animate.Container;
        const Sprite = animate.Sprite;
        const Text = animate.Text;
        const Graphics = animate.Graphics;


        notify.lib.notify_result_win = class extends Container {
            constructor() {
                super();
                const instance3 = new Sprite(notify.getTexture("notify_result_win"));
                const instance2 = new Text("")
                    .setStyle({
                        fontFamily: "Southbank LT",
                        fontSize: 56,
                        fill: "#333",
                        leading: 2
                    })
                    .setAlign("center")
                    .setTransform(361.925, 39.15);
                this[instance2.name = "title_txt"] = instance2;
                const instance1 = new Text("")
                    .setStyle({
                        fontFamily: "Southbank LT",
                        fontSize: 56,
                        fill: "#333",
                        leading: 2,
                        wordWrap: true,
                        wordWrapWidth: 553.4
                    })
                    .setAlign("center")
                    .setTransform(368.95, 218.5);
                this[instance1.name = "info_txt"] = instance1;
                this.addChild(instance3, instance2, instance1);
            }
        };

        notify.lib.z_shadow = class extends Container {
            constructor() {
                super();
                const instance1 = new Graphics()
                    .drawCommands(notify.shapes.notify[0]);
                this.addChild(instance1);
            }
        };

        notify.lib.notify_result = class extends Container {
            constructor() {
                super();
                const instance2 = new notify.lib.z_shadow()
                    .setAlpha(0);
                this[instance2.name = "shadow_mc"] = instance2;
                const instance1 = new notify.lib.notify_result_win()
                    .setTransform(279.75, 131.55);
                this[instance1.name = "win"] = instance1;
                this.addChild(instance2, instance1);
            }
        };

        notify.lib.notify = class extends MovieClip {
            constructor() {
                super({
                    duration: 1,
                    framerate: 30
                });
                const instance1 = new notify.lib.notify_result()
                    .setTransform(-1.6, -1.55);
                this[instance1.name = "result"] = instance1;
                this.addChild(instance1);
            }
        };
        notify.stage = notify.lib.notify;
    }
};



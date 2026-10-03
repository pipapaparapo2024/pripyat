window.interface_elements = {
    version: 2,
    stage: null,
    background: 0xffffff,
    width: 1280,
    height: 720,
    framerate: 30,
    totalFrames: 1,
    assets: {
        "interface_elements": "images/interface_elements.shapes.txt",
        "interface_elements_atlas_1": "images/interface_elements_atlas_1.json"
    },
    lib: {},
    shapes: {},
    textures: {},
    spritesheets: [],
    getTexture: function (id) {
        if (interface_elements.textures[id]) {
            return interface_elements.textures[id];
        }
        const atlas = interface_elements.spritesheets.find(atlas => !!atlas.textures[id]);
        return atlas ? atlas.textures[id] : null;
    },
    setup: function (animate) {
        const MovieClip = animate.MovieClip;
        const Container = animate.Container;
        const Sprite = animate.Sprite;
        const Text = animate.Text;
        const Graphics = animate.Graphics;


        interface_elements.lib.iface_bank_win_slots_image = class extends MovieClip {
            constructor() {
                super({
                    duration: 24,
                    labels: {
                        "stew0": 0,
                        "stew1": 1,
                        "stew2": 2,
                        "stew3": 3,
                        "stew4": 4,
                        "stew5": 5,
                        "stew6": 6,
                        "stew7": 7,
                        "coins0": 8,
                        "coins1": 9,
                        "coins2": 10,
                        "coins3": 11,
                        "coins4": 12,
                        "coins5": 13,
                        "coins6": 14,
                        "coins7": 15,
                        "cigarettes0": 16,
                        "cigarettes1": 17,
                        "cigarettes2": 18,
                        "cigarettes3": 19,
                        "cigarettes4": 20,
                        "cigarettes5": 21,
                        "cigarettes6": 22,
                        "cigarettes7": 23
                    }
                });
                const instance1 = new Sprite(interface_elements.getTexture("bank_stew_slot0"));
                const instance2 = new Sprite(interface_elements.getTexture("bank_stew_slot1"));
                const instance3 = new Sprite(interface_elements.getTexture("bank_stew_slot2"));
                const instance4 = new Sprite(interface_elements.getTexture("bank_stew_slot3"));
                const instance5 = new Sprite(interface_elements.getTexture("bank_stew_slot4"));
                const instance6 = new Sprite(interface_elements.getTexture("bank_stew_slot5"));
                const instance7 = new Sprite(interface_elements.getTexture("bank_stew_slot6"));
                const instance8 = new Sprite(interface_elements.getTexture("bank_stew_slot7"));
                const instance9 = new Sprite(interface_elements.getTexture("bank_coins_slot0"));
                const instance10 = new Sprite(interface_elements.getTexture("bank_coins_slot1"));
                const instance11 = new Sprite(interface_elements.getTexture("bank_coins_slot2"));
                const instance12 = new Sprite(interface_elements.getTexture("bank_coins_slot3"));
                const instance13 = new Sprite(interface_elements.getTexture("bank_coins_slot4"));
                const instance14 = new Sprite(interface_elements.getTexture("bank_coins_slot5"));
                const instance15 = new Sprite(interface_elements.getTexture("bank_coins_slot6"));
                const instance16 = new Sprite(interface_elements.getTexture("bank_coins_slot7"));
                const instance17 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot0"));
                const instance18 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot1"));
                const instance19 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot2"));
                const instance20 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot3"));
                const instance21 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot4"));
                const instance22 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot5"));
                const instance23 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot6"));
                const instance24 = new Sprite(interface_elements.getTexture("bank_cigarettes_slot7"))
                    .setTransform(-27, -28);
                this.addTimedChild(instance1, 0, 1)
                    .addTimedChild(instance2, 1, 1, {
                        "1": {
                            x: -17,
                            y: -11
                        }
                    })
                    .addTimedChild(instance3, 2, 1, {
                        "2": {
                            x: -25,
                            y: -13
                        }
                    })
                    .addTimedChild(instance4, 3, 1, {
                        "3": {
                            x: -29,
                            y: -5
                        }
                    })
                    .addTimedChild(instance5, 4, 1, {
                        "4": {
                            x: -26,
                            y: -3
                        }
                    })
                    .addTimedChild(instance6, 5, 1, {
                        "5": {
                            x: -32,
                            y: -16
                        }
                    })
                    .addTimedChild(instance7, 6, 1, {
                        "6": {
                            x: -23,
                            y: -16
                        }
                    })
                    .addTimedChild(instance8, 7, 1, {
                        "7": {
                            x: -32,
                            y: -31
                        }
                    })
                    .addTimedChild(instance9, 8, 1, {
                        "8": {
                            x: -16
                        }
                    })
                    .addTimedChild(instance10, 9, 1, {
                        "9": {
                            x: -13,
                            y: -2
                        }
                    })
                    .addTimedChild(instance11, 10, 1, {
                        "10": {
                            x: -35,
                            y: -4
                        }
                    })
                    .addTimedChild(instance12, 11, 1, {
                        "11": {
                            x: -26,
                            y: -35
                        }
                    })
                    .addTimedChild(instance13, 12, 1, {
                        "12": {
                            x: -24,
                            y: -10
                        }
                    })
                    .addTimedChild(instance14, 13, 1, {
                        "13": {
                            x: -27,
                            y: -24
                        }
                    })
                    .addTimedChild(instance15, 14, 1, {
                        "14": {
                            x: -25,
                            y: -18
                        }
                    })
                    .addTimedChild(instance16, 15, 1, {
                        "15": {
                            x: -23,
                            y: -19
                        }
                    })
                    .addTimedChild(instance17, 16, 1, {
                        "16": {
                            x: 1,
                            y: -12
                        }
                    })
                    .addTimedChild(instance18, 17, 1, {
                        "17": {
                            x: -16,
                            y: -12
                        }
                    })
                    .addTimedChild(instance19, 18, 1, {
                        "18": {
                            x: -24,
                            y: -13
                        }
                    })
                    .addTimedChild(instance20, 19, 1, {
                        "19": {
                            x: -27,
                            y: -10
                        }
                    })
                    .addTimedChild(instance21, 20, 1, {
                        "20": {
                            x: -22,
                            y: -11
                        }
                    })
                    .addTimedChild(instance22, 21, 1, {
                        "21": {
                            x: -24,
                            y: -17
                        }
                    })
                    .addTimedChild(instance23, 22, 1, {
                        "22": {
                            x: -20,
                            y: -16
                        }
                    })
                    .addTimedChild(instance24, 23, 1);
            }
        };

        interface_elements.lib.iface_bank_win_slots_icon = class extends MovieClip {
            constructor() {
                super({
                    duration: 3,
                    labels: {
                        stew: 0,
                        coins: 1,
                        cigarettes: 2
                    }
                });
                const instance1 = new Sprite(interface_elements.getTexture("bank_slot_stew"));
                const instance2 = new Sprite(interface_elements.getTexture("bank_slot_coins"));
                const instance3 = new Sprite(interface_elements.getTexture("bank_slot_cigarettes"));
                this.addTimedChild(instance1, 0, 1)
                    .addTimedChild(instance2, 1, 1)
                    .addTimedChild(instance3, 2, 1);
            }
        };

        interface_elements.lib.iface_bank_win_slots = class extends Container {
            constructor() {
                super();
                const instance6 = new interface_elements.lib.iface_bank_win_slots_icon();
                this[instance6.name = "icon"] = instance6;
                const instance5 = new interface_elements.lib.iface_bank_win_slots_image()
                    .setTransform(34, 65);
                this[instance5.name = "img"] = instance5;
                const instance4 = new Sprite(interface_elements.getTexture("bank_slot_panel"))
                    .setTransform(-4, 143);
                const instance3 = new Sprite(interface_elements.getTexture("bank_slot_panel"))
                    .setTransform(-4, 21);
                const instance2 = new Text("")
                    .setStyle({
                        fontFamily: "Southbank LT",
                        fontSize: 21,
                        fill: "#fff",
                        leading: 2
                    })
                    .setAlign("center")
                    .setTransform(63.5, 26);
                this[instance2.name = "count_txt"] = instance2;
                const instance1 = new Text("")
                    .setStyle({
                        fontFamily: "Southbank LT",
                        fontSize: 21,
                        fill: "#fff",
                        leading: 2
                    })
                    .setAlign("center")
                    .setTransform(63.5, 148.6);
                this[instance1.name = "price_txt"] = instance1;
                this.addChild(instance6, instance5, instance4, instance3, instance2, instance1);
            }
        };

        interface_elements.lib.z_NoButton = class extends Container {
            constructor() {
                super();
                const instance1 = new Graphics()
                    .drawCommands(interface_elements.shapes.interface_elements[0]);
                this.addChild(instance1);
            }
        };

        interface_elements.lib.bank_win_active_slot_cigarettes = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(interface_elements.getTexture("bank_active_slot_cigarettes"));
                this.addChild(instance1);
            }
        };

        interface_elements.lib.bank_win_active_slot_coins = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(interface_elements.getTexture("bank_active_slot_coins"));
                this.addChild(instance1);
            }
        };

        interface_elements.lib.bank_win_active_slot_stew = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(interface_elements.getTexture("bank_active_slot_stew"));
                this.addChild(instance1);
            }
        };

        interface_elements.lib.iface_bank_win_close = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(interface_elements.getTexture("bank_close_icon"));
                this.addChild(instance1);
            }
        };

        interface_elements.lib.iface_bank_win = class extends Container {
            constructor() {
                super();
                const instance17 = new Sprite(interface_elements.getTexture("bank_bg"));
                const instance16 = new interface_elements.lib.iface_bank_win_close()
                    .setTransform(901.15, -34.15);
                this[instance16.name = "close_mc"] = instance16;
                const instance15 = new interface_elements.lib.bank_win_active_slot_stew()
                    .setTransform(4, 88);
                this[instance15.name = "active_slot_stew"] = instance15;
                const instance14 = new interface_elements.lib.bank_win_active_slot_coins()
                    .setTransform(4, 184);
                this[instance14.name = "active_slot_coins"] = instance14;
                const instance13 = new interface_elements.lib.bank_win_active_slot_cigarettes()
                    .setTransform(4, 284);
                this[instance13.name = "active_slot_cigarettes"] = instance13;
                const instance12 = new interface_elements.lib.z_NoButton()
                    .setTransform(37.75, 88.95, 0.387, 1.626)
                    .setAlpha(0);
                this[instance12.name = "butt_slot_stew"] = instance12;
                const instance11 = new interface_elements.lib.z_NoButton()
                    .setTransform(37.75, 188.45, 0.387, 1.626)
                    .setAlpha(0);
                this[instance11.name = "butt_slot_coins"] = instance11;
                const instance10 = new interface_elements.lib.z_NoButton()
                    .setTransform(37.75, 287.35, 0.387, 1.626)
                    .setAlpha(0);
                this[instance10.name = "butt_slot_cigarettes"] = instance10;
                const instance9 = new Text("")
                    .setStyle({
                        fontFamily: "Southbank LT",
                        fontSize: 26,
                        fill: "#ccc",
                        leading: 2
                    })
                    .setAlign("center")
                    .setTransform(437.47499999999997, 11.25);
                this[instance9.name = "name_slot_txt"] = instance9;
                const instance8 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(178, 50.25);
                this[instance8.name = "slot0"] = instance8;
                const instance7 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(331.75, 50.25);
                this[instance7.name = "slot1"] = instance7;
                const instance6 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(491.75, 50.25);
                this[instance6.name = "slot2"] = instance6;
                const instance5 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(651.75, 50.25);
                this[instance5.name = "slot3"] = instance5;
                const instance4 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(178, 256.5);
                this[instance4.name = "slot4"] = instance4;
                const instance3 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(331.75, 256.5);
                this[instance3.name = "slot5"] = instance3;
                const instance2 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(491.75, 256.5);
                this[instance2.name = "slot6"] = instance2;
                const instance1 = new interface_elements.lib.iface_bank_win_slots()
                    .setTransform(651.75, 256.5);
                this[instance1.name = "slot7"] = instance1;
                this.addChild(instance17, instance16, instance15, instance14, instance13, instance12, instance11, instance10, instance9, instance8, instance7, instance6, instance5, instance4, instance3, instance2, instance1);
            }
        };

        interface_elements.lib.z_shadow = class extends Container {
            constructor() {
                super();
                const instance1 = new Graphics()
                    .drawCommands(interface_elements.shapes.interface_elements[1]);
                this.addChild(instance1);
            }
        };

        interface_elements.lib.iface_bank = class extends Container {
            constructor() {
                super();
                const instance2 = new interface_elements.lib.z_shadow();
                const instance1 = new interface_elements.lib.iface_bank_win()
                    .setTransform(197.7, 114);
                this[instance1.name = "win"] = instance1;
                this.addChild(instance2, instance1);
            }
        };

        interface_elements.lib.Up_panel_bank_butt = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(interface_elements.getTexture("interface_up_panel_bank_butt"));
                this.addChild(instance1);
            }
        };

        interface_elements.lib.Up_panel_val_icon = class extends MovieClip {
            constructor() {
                super({
                    duration: 3,
                    labels: {
                        stew: 0,
                        coins: 1,
                        cigarettes: 2
                    }
                });
                const instance1 = new Sprite(interface_elements.getTexture("interface_up_panel_stew_icon"));
                const instance2 = new Sprite(interface_elements.getTexture("interface_up_panel_coins_icon"));
                const instance3 = new Sprite(interface_elements.getTexture("interface_up_panel_cigarettes_icon"))
                    .setTransform(-3, -14);
                this.addTimedChild(instance1, 0, 1)
                    .addTimedChild(instance2, 1, 1, {
                        "1": {
                            x: -4
                        }
                    })
                    .addTimedChild(instance3, 2, 1);
            }
        };

        interface_elements.lib.Up_panel_val = class extends Container {
            constructor() {
                super();
                const instance3 = new Sprite(interface_elements.getTexture("interface_up_panel_val"));
                const instance2 = new interface_elements.lib.Up_panel_val_icon()
                    .setTransform(7, 8);
                this[instance2.name = "icon"] = instance2;
                const instance1 = new Text("")
                    .setStyle({
                        fontFamily: "Trebuchet MS",
                        fontSize: 18,
                        fontWeight: "bold",
                        fill: "#cec1b8",
                        leading: 2
                    })
                    .setTransform(37, 8);
                this[instance1.name = "tf_txt"] = instance1;
                this.addChild(instance3, instance2, instance1);
            }
        };

        interface_elements.lib.z_NoMovie = class extends Container {
            constructor() {
                super();

            }
        };

        interface_elements.lib.Up_panel_ava = class extends Container {
            constructor() {
                super();
                const instance1 = new Graphics()
                    .drawCommands(interface_elements.shapes.interface_elements[2])
                    .setRenderable(false);
                const instance2 = new interface_elements.lib.z_NoMovie()
                    .setMask(instance1);
                this[instance2.name = "icon_mc"] = instance2;
                this.addChild(instance1, instance2);
            }
        };

        interface_elements.lib.Up_panel = class extends Container {
            constructor() {
                super();
                const instance8 = new Sprite(interface_elements.getTexture("interface_up_panel_bg"));
                const instance7 = new Sprite(interface_elements.getTexture("interface_up_panel_line"))
                    .setTransform(66, 46);
                const instance6 = new interface_elements.lib.Up_panel_ava()
                    .setTransform(20, 7);
                this[instance6.name = "ava"] = instance6;
                const instance5 = new Sprite(interface_elements.getTexture("interface_up_panel_ava_elipse"))
                    .setTransform(16, 2);
                const instance4 = new interface_elements.lib.Up_panel_val()
                    .setTransform(779, 23);
                this[instance4.name = "val_stew"] = instance4;
                const instance3 = new interface_elements.lib.Up_panel_val()
                    .setTransform(915.5, 23);
                this[instance3.name = "val_coins"] = instance3;
                const instance2 = new interface_elements.lib.Up_panel_val()
                    .setTransform(1052.5, 23);
                this[instance2.name = "val_cigarettes"] = instance2;
                const instance1 = new interface_elements.lib.Up_panel_bank_butt()
                    .setTransform(1183, 23);
                this[instance1.name = "butt_bank"] = instance1;
                this.addChild(instance8, instance7, instance6, instance5, instance4, instance3, instance2, instance1);
            }
        };

        interface_elements.lib.Down_panel = class extends Container {
            constructor() {
                super();
                const instance1 = new Sprite(interface_elements.getTexture("interface_down_panel_bg"));
                this.addChild(instance1);
            }
        };

        interface_elements.lib.interface_elements = class extends MovieClip {
            constructor() {
                super({
                    duration: 1,
                    framerate: 30
                });
                const instance3 = new interface_elements.lib.Down_panel()
                    .setTransform(0, 562);
                this[instance3.name = "iface_down"] = instance3;
                const instance2 = new interface_elements.lib.Up_panel()
                    .setTransform(-13);
                this[instance2.name = "iface_up"] = instance2;
                const instance1 = new interface_elements.lib.iface_bank()
                    .setTransform(-2000);
                this[instance1.name = "bank_mov"] = instance1;
                this.addChild(instance3, instance2, instance1);
            }
        };
        interface_elements.stage = interface_elements.lib.interface_elements;
    }
};



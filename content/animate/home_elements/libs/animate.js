/*!
 * @pixi/animate - v2.0.1
 * Compiled Sun, 05 Jun 2022 13:07:52 UTC
 *
 * @pixi/animate is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */
this.PIXI = this.PIXI || {};
(function (exports, loaders, utils, filterColorMatrix, display, graphics, sprite, ticker, settings, app, text) {
    'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    // standard tweening
    function lerpValue(start, end, t) {
        return start + ((end - start) * t);
    }
    var PI = Math.PI;
    var TWO_PI = PI * 2;
    // handle 355 -> 5 degrees only going through a 10 degree change instead of
    // the long way around
    // Math from http://stackoverflow.com/a/2708740
    function lerpRotation(start, end, t) {
        var difference = Math.abs(end - start);
        if (difference > PI) {
            // We need to add on to one of the values.
            if (end > start) {
                // We'll add it on to start...
                start += TWO_PI;
            }
            else {
                // Add it on to end.
                end += TWO_PI;
            }
        }
        // Interpolate it.
        var value = (start + ((end - start) * t));
        // wrap to 0-2PI
        /* if (value >= 0 && value <= TWO_PI)
            return value;
        return value % TWO_PI;*/
        // just return, as it's faster
        return value;
    }
    // split r, g, b into separate values for tweening
    function lerpTint(start, end, t) {
        // split start color into components
        var sR = (start >> 16) & 0xFF;
        var sG = (start >> 8) & 0xFF;
        var sB = start & 0xFF;
        // split end color into components
        var eR = (end >> 16) & 0xFF;
        var eG = (end >> 8) & 0xFF;
        var eB = end & 0xFF;
        // lerp red
        var r = sR + ((eR - sR) * t);
        // clamp red to valid values
        if (r < 0)
            r = 0;
        else if (r > 255)
            r = 255;
        // lerp green
        var g = sG + ((eG - sG) * t);
        // clamp green to valid values
        if (g < 0)
            g = 0;
        else if (g > 255)
            g = 255;
        // lerp blue
        var b = sB + ((eB - sB) * t);
        // clamp blue to valid values
        if (b < 0)
            b = 0;
        else if (b > 255)
            b = 255;
        var combined = (r << 16) | (g << 8) | b;
        return combined;
    }
    var COLOR_HELPER = [];
    function lerpColor(start, end, t) {
        COLOR_HELPER[0] = start[0] + ((end[0] - start[0]) * t);
        COLOR_HELPER[1] = start[1] + ((end[1] - start[1]) * t);
        COLOR_HELPER[2] = start[2] + ((end[2] - start[2]) * t);
        COLOR_HELPER[3] = start[3] + ((end[3] - start[3]) * t);
        COLOR_HELPER[4] = start[4] + ((end[4] - start[4]) * t);
        COLOR_HELPER[5] = start[5] + ((end[5] - start[5]) * t);
        return COLOR_HELPER;
    }
    var PROP_LERPS = {
        // position
        x: lerpValue,
        y: lerpValue,
        // scale
        sx: lerpValue,
        sy: lerpValue,
        // skew
        kx: lerpValue,
        ky: lerpValue,
        // rotation
        r: lerpRotation,
        // alpha
        a: lerpValue,
        // tinting
        t: lerpTint,
        // values to be set
        v: null,
        c: lerpColor,
        m: null,
        g: null,
    };
    function setPropFromShorthand(target, prop, value) {
        switch (prop) {
            case 'x':
                target.transform.position.x = value;
                break;
            case 'y':
                target.transform.position.y = value;
                break;
            case 'sx':
                target.transform.scale.x = value;
                break;
            case 'sy':
                target.transform.scale.y = value;
                break;
            case 'kx':
                target.transform.skew.x = value;
                break;
            case 'ky':
                target.transform.skew.y = value;
                break;
            case 'r':
                target.transform.rotation = value;
                break;
            case 'a':
                target.alpha = value;
                break;
            case 't':
                target.i(value); // i = setTint
                break;
            case 'c':
                target.setColorTransform.apply(target, value); // c = setColorTransform
                break;
            case 'v':
                target.visible = value;
                break;
            case 'm':
                target.ma(value); // ma = setMask
                break;
        }
    }
    // builds an ease in function for a specific exponential power, i.e. quadratic easing is power 2 and cubic is 3
    function buildPowIn(power) {
        return function (t) { return Math.pow(t, power); };
    }
    // builds an ease out function for a specific exponential power, i.e. quadratic easing is power 2 and cubic is 3
    function buildPowOut(power) {
        return function (t) { return 1 - Math.pow(1 - t, power); };
    }
    // builds an ease in & out function for a specific exponential power, i.e. quadratic easing is power 2 and cubic is 3
    function buildPowInOut(power) {
        return function (t) {
            if ((t *= 2) < 1)
                return 0.5 * Math.pow(t, power);
            return 1 - (0.5 * Math.abs(Math.pow(2 - t, power)));
        };
    }
    var ELASTIC_AMPLITUDE = 1;
    var ELASTIC_PERIOD = 0.3;
    var ELASTIC_INOUT_PERIOD = 0.3 * 1.5;
    var EASE_DICT = {
        quadIn: buildPowIn(2),
        quadOut: buildPowOut(2),
        quadInOut: buildPowInOut(2),
        cubicIn: buildPowIn(3),
        cubicOut: buildPowOut(3),
        cubicInOut: buildPowInOut(3),
        quartIn: buildPowIn(4),
        quartOut: buildPowOut(4),
        quartInOut: buildPowInOut(4),
        quintIn: buildPowIn(5),
        quintOut: buildPowOut(5),
        quintInOut: buildPowInOut(5),
        sineIn: function (t) { return 1 - Math.cos(t * PI / 2); },
        sineOut: function (t) { return Math.sin(t * PI / 2); },
        sineInOut: function (t) { return -0.5 * (Math.cos(PI * t) - 1); },
        backIn: function (t) { return t * t * (((1.7 + 1) * t) - 1.7); },
        backOut: function (t) { return (--t * t * (((1.7 + 1) * t) + 1.7)) + 1; },
        backInOut: function (t) {
            var constVal = 1.7 * 1.525;
            if ((t *= 2) < 1)
                return 0.5 * (t * t * (((constVal + 1) * t) - constVal));
            return 0.5 * (((t -= 2) * t * (((constVal + 1) * t) + constVal)) + 2);
        },
        circIn: function (t) { return -(Math.sqrt(1 - (t * t)) - 1); },
        circOut: function (t) { return Math.sqrt(1 - ((--t) * t)); },
        circInOut: function (t) {
            if ((t *= 2) < 1)
                return -0.5 * (Math.sqrt(1 - (t * t)) - 1);
            return 0.5 * (Math.sqrt(1 - ((t -= 2) * t)) + 1);
        },
        bounceIn: function (t) { return 1 - EASE_DICT.bounceOut(1 - t); },
        bounceOut: function (t) {
            if (t < 1 / 2.75) {
                return 7.5625 * t * t;
            }
            else if (t < 2 / 2.75) {
                return (7.5625 * (t -= 1.5 / 2.75) * t) + 0.75;
            }
            else if (t < 2.5 / 2.75) {
                return (7.5625 * (t -= 2.25 / 2.75) * t) + 0.9375;
            }
            return (7.5625 * (t -= 2.625 / 2.75) * t) + 0.984375;
        },
        // eslint-disable-next-line no-confusing-arrow
        bounceInOut: function (t) { return t < 0.5 ? EASE_DICT.bounceIn(t * 2) * 0.5 : (EASE_DICT.bounceOut((t * 2) - 1) * 0.5) + 0.5; },
        elasticIn: function (t) {
            if (t === 0 || t === 1)
                return t;
            var s = ELASTIC_PERIOD / TWO_PI * Math.asin(1 / ELASTIC_AMPLITUDE);
            return -(ELASTIC_AMPLITUDE * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * TWO_PI / ELASTIC_PERIOD));
        },
        elasticOut: function (t) {
            if (t === 0 || t === 1)
                return t;
            var s = ELASTIC_PERIOD / TWO_PI * Math.asin(1 / ELASTIC_AMPLITUDE);
            return (ELASTIC_AMPLITUDE * Math.pow(2, -10 * t) * Math.sin((t - s) * TWO_PI / ELASTIC_PERIOD)) + 1;
        },
        elasticInOut: function (t) {
            var s = ELASTIC_INOUT_PERIOD / TWO_PI * Math.asin(1 / ELASTIC_AMPLITUDE);
            if ((t *= 2) < 1) {
                return -0.5 * (ELASTIC_AMPLITUDE * Math.pow(2, 10 * (t -= 1))
                    * Math.sin((t - s) * TWO_PI / ELASTIC_INOUT_PERIOD));
            }
            return (ELASTIC_AMPLITUDE * Math.pow(2, -10 * (t -= 1))
                * Math.sin((t - s) * TWO_PI / ELASTIC_INOUT_PERIOD) * 0.5) + 1;
        },
    };
    function getEaseFromConfig(config) {
        if (!config)
            return null;
        if (typeof config === 'function')
            return config;
        // TODO: use config (name, strength) to determine an ease method
        // In order to figure that out, we need to test out Animate's actual output values so we know what to use.
        if (config.n === 'classic') {
            var s_1 = config.s / 100;
            // (s + 1)t + (-s)(t^2)
            return function (t) { return ((s_1 + 1) * t) + ((-s_1) * t * t); };
        }
        return EASE_DICT[config.n];
    }
    /**
     * Provides timeline playback of movieclip
     */
    var Tween = /** @class */ (function () {
        /**
         * @param target The target to play
         * @param startProps The starting properties
         * @param endProps The ending properties
         * @param startFrame frame number on which to begin tweening
         * @param duration Number of frames to tween
         * @param ease Ease function to use
         */
        function Tween(target, startProps, endProps, startFrame, duration, ease) {
            var _a;
            this.target = target;
            this.startProps = startProps;
            this.endProps = {};
            this.duration = duration;
            this.startFrame = startFrame;
            this.endFrame = startFrame + duration;
            this.ease = {};
            this.isTweenlessFrame = !endProps;
            if (endProps) {
                // make a copy to safely include any unchanged values from the start of the tween
                for (var prop in endProps) {
                    if (prop === 'e')
                        continue;
                    // read the end value
                    this.endProps[prop] = endProps[prop];
                    // if there is an ease for that property, use that
                    if ((_a = endProps.e) === null || _a === void 0 ? void 0 : _a[prop]) {
                        this.ease[prop] = getEaseFromConfig(endProps.e[prop]);
                    }
                    // otherwise use the global ease for this tween (if any)
                    else {
                        this.ease[prop] = ease;
                    }
                }
            }
            // copy in any starting properties don't change
            for (var prop in startProps) {
                // eslint-disable-next-line no-prototype-builtins
                if (!this.endProps.hasOwnProperty(prop)) {
                    this.endProps[prop] = startProps[prop];
                }
            }
        }
        /**
         * Set the current frame.
         */
        Tween.prototype.setPosition = function (currentFrame) {
            // if this is a single frame with no tweening, or at the end of the tween, then
            // just speed up the process by setting values
            if (currentFrame >= this.endFrame) {
                this.setToEnd();
                return;
            }
            if (this.isTweenlessFrame) {
                this.setToEnd();
                return;
            }
            var time = (currentFrame - this.startFrame) / this.duration;
            var target = this.target;
            var startProps = this.startProps;
            var endProps = this.endProps;
            for (var prop in endProps) {
                var p = prop;
                var lerp = PROP_LERPS[p];
                var lerpedTime = time;
                if (this.ease[prop]) {
                    lerpedTime = this.ease[prop](time);
                }
                if (lerp) {
                    setPropFromShorthand(target, p, lerp(startProps[p], endProps[p], lerpedTime));
                }
                else {
                    setPropFromShorthand(target, p, startProps[p]);
                }
            }
        };
        /**
         * Set to the end position
         */
        Tween.prototype.setToEnd = function () {
            var endProps = this.endProps;
            var target = this.target;
            for (var prop in endProps) {
                setPropFromShorthand(target, prop, endProps[prop]);
            }
        };
        return Tween;
    }());

    /**
     * The Timeline class represents a series of tweens, tied to keyframes.
     */
    var Timeline = /** @class */ (function (_super) {
        __extends(Timeline, _super);
        // exists to be private to prevent usage
        function Timeline() {
            return _super.call(this) || this;
        }
        /**
         * Creates a new Timeline. Must be used instead of a constructor because extending the Array
         * class is a pain: https://blog.simontest.net/extend-array-with-typescript-965cc1134b3
         * @param target The target for this string of tweens.
         * @returns A new Timeline instance.
         */
        Timeline.create = function (target) {
            var out = Object.create(Timeline.prototype);
            out.target = target;
            out._currentProps = {};
            return out;
        };
        /**
         * Adds one or more tweens (or timelines) to this timeline. The tweens will be paused (to
         * remove them from the normal ticking system and managed by this timeline. Adding a tween to
         * multiple timelines will result in unexpected behaviour.
         * @method PIXI.animate.Timeline#addTween
         * @param tween The tween(s) to add. Accepts multiple arguments.
         * @return Tween The first tween that was passed in.
         */
        Timeline.prototype.addTween = function (properties, startFrame, duration, ease) {
            this.extendLastFrame(startFrame - 1);
            // figure out what the starting values for this tween should be
            // ownership of startProps is passed to the new Tween - this object should not be reused
            var startProps = Object.assign({}, this._currentProps);
            for (var prop in properties) {
                var p = prop;
                // if we have not already set that property in an earlier tween, handle that property
                if (!Object.hasOwnProperty.call(this._currentProps, prop)) {
                    var startValue = startProps[p] = this.getPropFromShorthand(p);
                    // go through previous tweens to set the value so that when the timeline loops
                    // around, the values are set properly - having each tween know what came before
                    // allows us to set to a specific frame without running through the entire timeline
                    for (var i = this.length - 1; i >= 0; --i) {
                        this[i].startProps[p] = startValue;
                        this[i].endProps[p] = startValue;
                    }
                }
            }
            // create the new Tween and add it to the list
            var tween = new Tween(this.target, startProps, properties, startFrame, duration, ease);
            // if we have this frame already, replace it
            if (startFrame === this[this.length - 1].startFrame) {
                this[this.length - 1] = tween;
            }
            // otherwise add it to the list
            else {
                this.push(tween);
            }
            // update starting values for the next tween - if tweened values included 'p', then Tween
            // parsed that to add additional data that is required
            Object.assign(this._currentProps, tween.endProps);
        };
        /**
         * Add a single keyframe that doesn't tween.
         * Note that this has some capability to insert keyframes into the middle of a timeline, in order to
         * handle how masks are published, it should only be relied upon to add keyframes to the end of a timeline.
         * @method PIXI.animate.Timeline#addKeyframe
         * @param {Object} properties The properties to set.
         * @param {int} startFrame The starting frame index.
         */
        Timeline.prototype.addKeyframe = function (properties, startFrame) {
            // see if we need to go back in and insert properties
            if (this.length && this[this.length - 1].startFrame >= startFrame) {
                for (var i = this.length - 1; i >= 0; --i) {
                    var prev = this[i];
                    // insert into an existing frame that shares the same keyframe
                    if (prev.startFrame === startFrame) {
                        // update the start props
                        Object.assign(prev.startProps, properties);
                        // carry the new props over unless they're already overridden by end props
                        prev.endProps = Object.assign({}, prev.startProps, prev.endProps);
                        // go through any later keyframes to update them the same way
                        for (var k = i + 1; k < this.length; ++k) {
                            var next = this[k];
                            next.startProps = Object.assign({}, properties, next.startProps);
                            next.endProps = Object.assign({}, next.startProps, next.endProps);
                        }
                        break;
                    }
                    // insert into the middle of an extended keyframe (but *not* one that tweens)
                    else if (prev.startFrame < startFrame && prev.endFrame > startFrame && prev.isTweenlessFrame) {
                        prev.endFrame = startFrame - 1;
                        var startProps = Object.assign({}, prev.endProps, properties);
                        // create the new Tween and add it to the list
                        var tween = new Tween(this.target, startProps, null, startFrame, 0);
                        this.splice(i, 0, tween);
                        // go through any later keyframes to update them with our inserted props
                        for (var k = i + 1; k < this.length; ++k) {
                            var next = this[k];
                            next.startProps = Object.assign({}, properties, next.startProps);
                            next.endProps = Object.assign({}, next.startProps, next.endProps);
                        }
                        break;
                    }
                    // insert in a gap between frames (which shouldn't really happen, but just in case)
                    else if (prev.endFrame < startFrame) {
                        var startProps = Object.assign({}, prev.endProps, properties);
                        // create the new Tween and add it to the list
                        var tween = new Tween(this.target, startProps, null, startFrame, 0);
                        this.splice(i, 0, tween);
                        // go through any later keyframes to update them with our inserted props
                        for (var k = i + 1; k < this.length; ++k) {
                            var next = this[k];
                            next.startProps = Object.assign({}, properties, next.startProps);
                            next.endProps = Object.assign({}, next.startProps, next.endProps);
                        }
                        break;
                    }
                }
                // save in current props, but don't take priority over existing values since we went back in time
                Object.assign(this._currentProps, properties, this._currentProps);
            }
            else {
                this.extendLastFrame(startFrame - 1);
                var startProps = Object.assign({}, this._currentProps, properties);
                // create the new Tween and add it to the list
                var tween = new Tween(this.target, startProps, null, startFrame, 0);
                this.push(tween);
                Object.assign(this._currentProps, tween.endProps);
            }
        };
        /**
         * Extend the last frame of the tween.
         * @method PIXI.animate.Timeline#extendLastFrame
         * @param {int} endFrame The ending frame index.
         */
        Timeline.prototype.extendLastFrame = function (endFrame) {
            if (this.length) {
                var prevTween = this[this.length - 1];
                if (prevTween.endFrame < endFrame) {
                    if (prevTween.isTweenlessFrame) {
                        prevTween.endFrame = endFrame;
                    }
                    else {
                        this.addKeyframe(this._currentProps, prevTween.endFrame + 1);
                    }
                }
            }
        };
        /**
         * Get the value for a property
         * @method PIXI.animate.Timeline#getPropFromShorthand
         * @param {string} prop
         */
        Timeline.prototype.getPropFromShorthand = function (prop) {
            var target = this.target;
            switch (prop) {
                case 'x':
                    return target.position.x;
                case 'y':
                    return target.position.y;
                case 'sx':
                    return target.scale.x;
                case 'sy':
                    return target.scale.y;
                case 'kx':
                    return target.skew.x;
                case 'ky':
                    return target.skew.y;
                case 'r':
                    return target.rotation;
                case 'a':
                    return target.alpha;
                case 'v':
                    return target.visible;
                case 'm':
                    return target.mask;
                // case 't':
                //   return target.tint;
                // not sure if we'll actually handle graphics this way?
                // g: return null;
            }
            return null;
        };
        Timeline.prototype.destroy = function () {
            this._currentProps = null;
            this.length = 0;
        };
        return Timeline;
    }(Array));

    /**
     * @description Event emitter for all sound events. This emits a single
     * `play` event which contains the alias, loop and MovieClip which is playing
     * the sound.
     * @example
     *
     * PIXI.animate.sound.on('play', (alias, loop, context) => {
     *    // custom handle sounds being played
     *    // where 'alias' is the ID in stage assets
     * });
     */
    var sound = new utils.EventEmitter();

    /**
     * Utility subclass of PIXI.Container
     */
    var AnimateContainer = /** @class */ (function (_super) {
        __extends(AnimateContainer, _super);
        function AnimateContainer() {
            // **************************
            //     Container methods
            // **************************
            var _this = _super !== null && _super.apply(this, arguments) || this;
            /**
             * Shortcut for `addChild`.
             */
            _this.ac = _super.prototype.addChild;
            /**
             * Shortcut for `setRenderable`.
             */
            _this.re = _this.setRenderable;
            /**
             * Shortcut for `setTransform`.
             */
            _this.t = _super.prototype.setTransform;
            /**
             * Shortcut for `setMask`.
             */
            _this.ma = _this.setMask;
            /**
             * Shortcut for `setAlpha`.
             */
            _this.a = _this.setAlpha;
            /**
             * Shortcut for `setTint`.
             */
            _this.i = _this.setTint;
            /**
             * Shortcut for `setColor`.
             */
            _this.c = _this.setColorTransform;
            return _this;
        }
        // **************************
        //     DisplayObject methods
        // **************************
        /**
         * Function to set if this is renderable or not. Useful for setting masks.
         * @param renderable Make renderable. Defaults to false.
         * @return This instance, for chaining.
         */
        AnimateContainer.prototype.setRenderable = function (renderable) {
            this.renderable = !!renderable;
            return this;
        };
        /**
         * Setter for mask to be able to chain.
         * @param mask The mask shape to use
         * @return Instance for chaining
         */
        AnimateContainer.prototype.setMask = function (mask) {
            // According to PIXI, only Graphics and Sprites can
            // be used as mask, let's ignore everything else, like other
            // movieclips and displayobjects/containers
            if (mask) {
                if (!(mask instanceof graphics.Graphics) && !(mask instanceof sprite.Sprite)) {
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('Warning: Masks can only be PIXI.Graphics or PIXI.Sprite objects.');
                    }
                    return this;
                }
            }
            this.mask = mask;
            return this;
        };
        /**
         * Chainable setter for alpha
         * @param alpha The alpha amount to use, from 0 to 1
         * @return Instance for chaining
         */
        AnimateContainer.prototype.setAlpha = function (alpha) {
            this.alpha = alpha;
            return this;
        };
        /**
         * Set the tint values by color.
         * @param tint The color value to tint
         * @return Object for chaining
         */
        AnimateContainer.prototype.setTint = function (tint) {
            if (typeof tint === 'string') {
                tint = exports.utils.hexToUint(tint);
            }
            // this.tint = tint
            // return this;
            // TODO: Replace with DisplayObject.tint setter
            // once the functionality is added to Pixi.js, for
            // now we'll use the slower ColorMatrixFilter to handle
            // the color transformation
            var r = (tint >> 16) & 0xFF;
            var g = (tint >> 8) & 0xFF;
            var b = tint & 0xFF;
            return this.setColorTransform(r / 255, 0, g / 255, 0, b / 255, 0);
        };
        /**
         * Set additive and multiply color, tinting
         * @param r The multiply red value
         * @param rA The additive red value
         * @param g The multiply green value
         * @param gA The additive green value
         * @param b The multiply blue value
         * @param bA The additive blue value
         * @return Object for chaining
         */
        AnimateContainer.prototype.setColorTransform = function (r, rA, g, gA, b, bA) {
            var filter = this.colorTransformFilter;
            filter.matrix[0] = r;
            filter.matrix[4] = rA;
            filter.matrix[6] = g;
            filter.matrix[9] = gA;
            filter.matrix[12] = b;
            filter.matrix[14] = bA;
            this.filters = [filter];
            return this;
        };
        Object.defineProperty(AnimateContainer.prototype, "colorTransformFilter", {
            get: function () {
                return this._colorTransformFilter || new filterColorMatrix.ColorMatrixFilter();
            },
            /**
             * The current default color transforming filters
             */
            set: function (filter) {
                this._colorTransformFilter = filter;
            },
            enumerable: false,
            configurable: true
        });
        return AnimateContainer;
    }(display.Container));

    var SharedTicker = ticker.Ticker.shared;
    /**
     * Provide timeline playback of movieclip
     */
    var MovieClip = /** @class */ (function (_super) {
        __extends(MovieClip, _super);
        function MovieClip(options, duration, loop, framerate, labels) {
            var _this = _super.call(this) || this;
            /**
             * Shortcut alias for `addTimedMask`
             */
            _this.am = _this.addTimedMask;
            /**
             * Shortcut alias for `addTween`
             */
            _this.tw = _this.addTween;
            /**
             * Alias for method `addTimedChild`
             */
            _this.at = _this.addTimedChild;
            /**
             * Short cut for `addAction`
             */
            _this.aa = _this.addAction;
            /**
             * Short cut for `playSound`
             */
            _this.ps = _this.playSound;
            // Default options
            options = options === undefined ? {} : options;
            // Options can also be the mode
            if (typeof options === 'number') {
                options = {
                    mode: options || MovieClip.INDEPENDENT,
                    duration: duration || 0,
                    loop: loop === undefined ? true : loop,
                    labels: labels || {},
                    framerate: framerate || 0,
                    startPosition: 0,
                };
            }
            else {
                // Apply defaults to options
                options = Object.assign({
                    mode: MovieClip.INDEPENDENT,
                    startPosition: 0,
                    loop: true,
                    labels: {},
                    duration: 0,
                    framerate: 0,
                }, options);
            }
            _this.mode = options.mode;
            _this.startPosition = options.startPosition;
            _this.loop = !!options.loop;
            _this.currentFrame = 0;
            _this._labels = [];
            _this._labelDict = options.labels;
            if (options.labels) {
                for (var name_1 in options.labels) {
                    var label = {
                        label: name_1,
                        position: options.labels[name_1],
                    };
                    _this._labels.push(label);
                }
                _this._labels.sort(function (a, b) { return a.position - b.position; });
            }
            _this.selfAdvance = true;
            _this.paused = false;
            _this.actionsEnabled = true;
            _this.autoReset = true;
            _this._synchOffset = 0;
            _this._prevPos = -1; // TODO: evaluate using a ._reset Boolean prop instead of -1.
            _this._t = 0;
            _this._framerate = options.framerate;
            _this._duration = 0;
            _this._totalFrames = options.duration;
            _this._timelines = [];
            _this._timedChildTimelines = [];
            _this._depthSorted = [];
            _this._actions = [];
            _this._beforeUpdate = null;
            _this.parentStartPosition = 0;
            if (_this.mode === MovieClip.INDEPENDENT) {
                _this._tickListener = _this._tickListener.bind(_this);
                _this._onAdded = _this._onAdded.bind(_this);
                _this._onRemoved = _this._onRemoved.bind(_this);
                _this.on('added', _this._onAdded);
                _this.on('removed', _this._onRemoved);
            }
            if (options.framerate) {
                _this.framerate = options.framerate;
            }
            // save often used methods on the instance so that they can be fetched slightly faster
            // than if they had to be fetched from the prototype
            /* eslint-disable no-self-assign */
            _this.advance = _this.advance;
            _this._updateTimeline = _this._updateTimeline;
            _this._setTimelinePosition = _this._setTimelinePosition;
            _this._goto = _this._goto;
            return _this;
            /* eslint-enable no-self-assign */
        }
        MovieClip.prototype._onAdded = function () {
            if (!this._framerate) {
                this.framerate = this.parentFramerate;
            }
            SharedTicker.add(this._tickListener, null);
        };
        MovieClip.prototype._tickListener = function (tickerDeltaTime) {
            if (this.paused || !this.selfAdvance) {
                // see if the movieclip needs to be updated even though it isn't animating
                if (this._prevPos < 0) {
                    this._goto(this.currentFrame);
                }
                return;
            }
            var seconds = tickerDeltaTime / settings.settings.TARGET_FPMS / 1000;
            this.advance(seconds);
        };
        MovieClip.prototype._onRemoved = function () {
            SharedTicker.remove(this._tickListener, null);
        };
        Object.defineProperty(MovieClip.prototype, "labels", {
            /**
             * Returns an array of objects with label and position (aka frame) properties, sorted by position.
             */
            get: function () {
                return this._labels;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MovieClip.prototype, "labelsMap", {
            /**
             * Returns a dictionary of labels where key is the label and value is the frame.
             */
            get: function () {
                return this._labelDict;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MovieClip.prototype, "currentLabel", {
            /**
             * Returns the name of the label on or immediately before the current frame.
             */
            get: function () {
                var labels = this._labels;
                var current = null;
                for (var i = 0, len = labels.length; i < len; ++i) {
                    if (labels[i].position <= this.currentFrame) {
                        current = labels[i].label;
                    }
                    else {
                        break;
                    }
                }
                return current;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MovieClip.prototype, "elapsedTime", {
            /**
             * When the MovieClip is framerate independent, this is the time elapsed from frame 0 in seconds.
             */
            get: function () {
                return this._t;
            },
            set: function (value) {
                this._t = value;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MovieClip.prototype, "framerate", {
            /**
             * By default MovieClip instances advance one frame per tick. Specifying a framerate for the
             * MovieClip will cause it to advance based on elapsed time between ticks as appropriate to
             * maintain the target framerate.
             *
             * For example, if a MovieClip with a framerate of 10 is placed on a Stage being updated at
             * 40fps, then the MovieClip advance roughly one frame every 4 ticks. This will not be exact,
             * because the time between each tick vary slightly between frames.
             *
             * This feature is dependent on the tick event object (or an object with an appropriate 'delta' property) being
             * passed into {{#crossLink 'Stage/update'}}{{/crossLink}}.
             */
            get: function () {
                return this._framerate;
            },
            set: function (value) {
                if (value > 0) {
                    if (this._framerate) {
                        // recalculate time based on difference between new and old framerate:
                        this._t *= this._framerate / value;
                    }
                    else {
                        this._t = this.currentFrame / value;
                    }
                    this._framerate = value;
                    this._duration = value ? this._totalFrames / value : 0;
                }
                else {
                    this._t = this._framerate = this._duration = 0;
                }
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MovieClip.prototype, "totalFrames", {
            /**
             * Get the total number of frames (duration) of this MovieClip
             */
            get: function () {
                return this._totalFrames;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Extend the timeline to the last frame.
         */
        MovieClip.prototype._autoExtend = function (endFrame) {
            if (this._totalFrames < endFrame) {
                this._totalFrames = endFrame;
            }
        };
        /**
         * Convert values of properties
         */
        MovieClip.prototype._parseProperties = function (properties) {
            // Convert any string colors to uints
            if (typeof properties.t === 'string') {
                properties.t = exports.utils.hexToUint(properties.t);
            }
            else if (typeof properties.v === 'number') {
                properties.v = !!properties.v;
            }
        };
        /**
         * Get a timeline for a child, synced timeline.
         */
        MovieClip.prototype._getChildTimeline = function (instance) {
            for (var i = this._timelines.length - 1; i >= 0; --i) {
                if (this._timelines[i].target === instance) {
                    return this._timelines[i];
                }
            }
            var timeline = Timeline.create(instance);
            this._timelines.push(timeline);
            return timeline;
        };
        /**
         * Add mask or masks
         */
        MovieClip.prototype.addTimedMask = function (instance, keyframes) {
            for (var i in keyframes) {
                this.addKeyframe(instance, {
                    m: keyframes[i],
                }, parseInt(i, 10));
            }
            // Set the initial position/add
            this._setTimelinePosition(this.currentFrame, this.currentFrame, true);
            return this;
        };
        /**
         * Add a tween to the clip
         * @param instance The clip to tween
         * @param properties The property or property to tween
         * @param startFrame The frame to start tweening
         * @param duration Number of frames to tween. If 0, then the properties are set with no tweening.
         * @param ease An optional easing function that takes the tween time from 0-1.
         */
        MovieClip.prototype.addTween = function (instance, properties, startFrame, duration, ease) {
            var timeline = this._getChildTimeline(instance);
            this._parseProperties(properties);
            timeline.addTween(properties, startFrame, duration, ease);
            this._autoExtend(startFrame + duration);
            return this;
        };
        /**
         * Add a tween to the clip
         * @param instance The clip to tween
         * @param properties The property or property to tween
         * @param startFrame The frame to start tweening
         */
        MovieClip.prototype.addKeyframe = function (instance, properties, startFrame) {
            var timeline = this._getChildTimeline(instance);
            var tw = properties.tw;
            // remove tw property just so that it doesn't mess anything up or confuse anyone doing debugging
            delete properties.tw;
            this._parseProperties(properties);
            // add keyframe - note that even if we add a tween immediately afterwards, we want to
            // add this keyframe in order to make sure the starting properties are set
            timeline.addKeyframe(properties, startFrame);
            this._autoExtend(startFrame);
            // Add a tween if present in the keyframe data
            if (tw) {
                this.addTween(instance, tw.p, startFrame, tw.d, getEaseFromConfig(tw.e));
            }
            return this;
        };
        /**
         * Add a child to show for a certain number of frames before automatic removal.
         * @param instance The clip to show
         * @param startFrame The starting frame
         * @param duration The number of frames to display the child before removing it.
         * @param keyframes The collection of static keyframes to add
         */
        MovieClip.prototype.addTimedChild = function (instance, startFrame, duration, keyframes) {
            if (startFrame === undefined) // jshint ignore:line
             {
                startFrame = 0;
            }
            if (duration === undefined || duration < 1) // jshint ignore:line
             {
                duration = this._totalFrames || 1;
            }
            // Add the starting offset for synced movie clips
            if (instance instanceof MovieClip && instance.mode === MovieClip.SYNCHED) {
                instance.parentStartPosition = startFrame;
            }
            // add tweening info about this child's presence on stage
            // when the child is (re)added, if it has 'autoReset' set to true, then it
            // should be set back to frame 0
            var timeline;
            // get existing timeline
            for (var i = this._timedChildTimelines.length - 1; i >= 0; --i) {
                if (this._timedChildTimelines[i].target === instance) {
                    timeline = this._timedChildTimelines[i];
                    break;
                }
            }
            // if there wasn't one, make a new one
            if (!timeline) {
                timeline = [];
                timeline.target = instance;
                this._timedChildTimelines.push(timeline);
            }
            // Fill the timeline with keyframe booleans
            exports.utils.fillFrames(timeline, startFrame, duration);
            // Update the total frames if the instance extends our current
            // total frames for this movieclip
            if (this._totalFrames < startFrame + duration) {
                this._totalFrames = startFrame + duration;
            }
            // Add the collection of keyframes
            if (keyframes) {
                if (typeof keyframes === 'string') {
                    keyframes = exports.utils.deserializeKeyframes(keyframes);
                }
                for (var i in keyframes) {
                    this.addKeyframe(instance, keyframes[i], parseInt(i, 10));
                }
                this._getChildTimeline(instance)
                    // subtract 1 from duration because we are using 0 based frame indices
                    // and duration is calculated as total frames
                    .extendLastFrame(startFrame + duration - 1);
            }
            // Set the initial position/add
            this._setTimelinePosition(startFrame, this.currentFrame, true);
            return this;
        };
        /**
         * Handle frame actions, callback is bound to the instance of the MovieClip.
         * @param callback The clip call on a certain frame
         * @param startFrame The starting frame index or label
         */
        MovieClip.prototype.addAction = function (callback, startFrame) {
            if (typeof startFrame === 'string') {
                var index = this._labelDict[startFrame];
                if (index === undefined) {
                    throw new Error("The label '" + startFrame + "' does not exist on this timeline");
                }
                startFrame = index;
            }
            var actions = this._actions;
            // ensure that the movieclip timeline is long enough to support the target frame
            if (actions.length <= startFrame) {
                actions.length = startFrame + 1;
            }
            if (this._totalFrames < startFrame) {
                this._totalFrames = startFrame;
            }
            // add the action
            if (actions[startFrame]) {
                actions[startFrame].push(callback);
            }
            else {
                actions[startFrame] = [callback];
            }
            return this;
        };
        /**
         * Handle sounds.
         * @method PIXI.animate.MovieClip#playSound
         * @param {String} alias The name of the Sound
         * @param {Boolean} [loop=false] The loop property of the sound
         */
        MovieClip.prototype.playSound = function (alias, loop) {
            sound.emit('play', alias, !!loop, this);
            return this;
        };
        /**
         * Sets paused to false.
         */
        MovieClip.prototype.play = function () {
            this.paused = false;
        };
        /**
         * Sets paused to true.
         */
        MovieClip.prototype.stop = function () {
            this.paused = true;
        };
        /**
         * Advances this movie clip to the specified position or label and sets paused to false.
         * @param positionOrLabel The animation name or frame number to go to.
         */
        MovieClip.prototype.gotoAndPlay = function (positionOrLabel) {
            this.paused = false;
            this._goto(positionOrLabel);
        };
        /**
         * Advances this movie clip to the specified position or label and sets paused to true.
         * @param positionOrLabel The animation or frame name to go to.
         */
        MovieClip.prototype.gotoAndStop = function (positionOrLabel) {
            this.paused = true;
            this._goto(positionOrLabel);
        };
        Object.defineProperty(MovieClip.prototype, "parentFramerate", {
            /**
             * Get the close parent with a valid framerate. If no parent, returns the default framerate.
             */
            get: function () {
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                var o = this;
                var fps = o._framerate;
                while ((o = o.parent) && !fps) {
                    if (o.mode === MovieClip.INDEPENDENT) {
                        fps = o._framerate;
                    }
                }
                return fps || MovieClip.DEFAULT_FRAMERATE;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Advances the playhead. This occurs automatically each tick by default.
         * @param time The amount of time in seconds to advance by. Only applicable if framerate is set.
         */
        MovieClip.prototype.advance = function (time) {
            // Handle any other cases where starting to play
            // and no framerate has been set yet
            if (!this._framerate) {
                this.framerate = this.parentFramerate;
            }
            if (time) {
                this._t += time;
            }
            if (this._t > this._duration) {
                this._t = this.loop ? this._t % this._duration : this._duration;
            }
            // add a tiny amount to account for potential floating point errors
            this.currentFrame = Math.floor((this._t * this._framerate) + 0.00000001);
            // final error checking
            if (this.currentFrame >= this._totalFrames) {
                this.currentFrame = this._totalFrames - 1;
            }
            var afterUpdateOnce;
            if (this._beforeUpdate) {
                afterUpdateOnce = this._beforeUpdate(this);
            }
            // update all tweens & actions in the timeline
            this._updateTimeline();
            // Do the animator callback here
            if (afterUpdateOnce) {
                afterUpdateOnce();
            }
        };
        /**
         * @param positionOrLabel The animation name or frame number to go to.
         */
        MovieClip.prototype._goto = function (positionOrLabel) {
            var pos = typeof positionOrLabel === 'string' ? this._labelDict[positionOrLabel] : positionOrLabel;
            if (pos === undefined) // jshint ignore:line
             {
                return;
            }
            // prevent _updateTimeline from overwriting the new position because of a reset:
            this._prevPos = NaN;
            this.currentFrame = pos;
            // Handle the case where trying to play but haven't
            // added to the stage yet
            if (!this._framerate) {
                this.framerate = this.parentFramerate;
            }
            // update the elapsed time if a time based movieclip
            if (this._framerate > 0) {
                this._t = pos / this._framerate;
            }
            else {
                this._t = 0;
            }
            this._updateTimeline();
        };
        /**
         * Reset the movieclip to the first frame (without advancing the timeline).
         */
        MovieClip.prototype._reset = function () {
            this._prevPos = -1;
            this._t = 0;
            this.currentFrame = 0;
        };
        /**
         * Update timeline position according to playback, performing actions and updating children.
         * @private
         */
        MovieClip.prototype._updateTimeline = function () {
            var synched = this.mode !== MovieClip.INDEPENDENT;
            if (synched) {
                this.currentFrame = this.startPosition + (this.mode === MovieClip.SINGLE_FRAME ? 0 : this._synchOffset);
                if (this.currentFrame >= this._totalFrames) {
                    this.currentFrame %= this._totalFrames;
                }
            }
            if (this._prevPos === this.currentFrame) {
                return;
            }
            // update timeline position, ignoring actions if this is a graphic.
            this._setTimelinePosition(this._prevPos, this.currentFrame, synched ? false : this.actionsEnabled);
            this._prevPos = this.currentFrame;
        };
        /**
         * Set the timeline position
         */
        MovieClip.prototype._setTimelinePosition = function (startFrame, currentFrame, doActions) {
            if (startFrame !== currentFrame && doActions) {
                var startPos = void 0;
                if (isNaN(startFrame)) {
                    startPos = currentFrame;
                }
                else {
                    startPos = (startFrame >= this._totalFrames - 1 ? 0 : startFrame + 1);
                }
                // generate actionFrames on the way
                var actionFrames = [];
                // loop
                if (currentFrame < startPos) {
                    for (var i = startPos; i < this._actions.length; ++i) {
                        if (this._actions[i]) {
                            actionFrames.push(i);
                        }
                    }
                    for (var i = 0; i <= currentFrame; ++i) {
                        if (this._actions[i]) {
                            actionFrames.push(i);
                        }
                    }
                }
                // no loop
                else {
                    for (var i = startPos; i <= currentFrame; ++i) {
                        if (this._actions[i]) {
                            actionFrames.push(i);
                        }
                    }
                }
                if (actionFrames.length) {
                    var oldCurrentFrame = this.currentFrame;
                    for (var i = 0; i < actionFrames.length; ++i) {
                        var frame = actionFrames[i];
                        this._setTimelinePosition(frame, frame, true);
                        // _goto is called OR last frame reached
                        if (this.currentFrame !== oldCurrentFrame || frame === currentFrame) {
                            return;
                        }
                        // stop is called
                        else if (this.paused) {
                            this.currentFrame = frame;
                            return;
                        }
                    }
                }
            }
            // handle all tweens
            var _timelines = this._timelines;
            for (var i = _timelines.length - 1; i >= 0; --i) {
                var timeline = _timelines[i];
                for (var j = 0, length_1 = timeline.length; j < length_1; ++j) {
                    var tween = timeline[j];
                    // if the tween contains part of the timeline that we are travelling through
                    if (currentFrame >= tween.startFrame && currentFrame <= tween.endFrame) {
                        // set the position within that tween
                        // and break the loop to move onto the next timeline
                        tween.setPosition(currentFrame);
                        break;
                    }
                }
            }
            var timedChildTimelines = this._timedChildTimelines;
            var depthSorted = this._depthSorted;
            for (var i = 0, length_2 = timedChildTimelines.length; i < length_2; ++i) {
                var target = timedChildTimelines[i].target;
                var shouldBeChild = timedChildTimelines[i][currentFrame];
                // if child should be on stage and is not:
                if (shouldBeChild) {
                    // Add to the depthSorted object so we can
                    // check that items are property drawn later
                    depthSorted.push(target);
                    if (target.parent !== this) {
                        // add the target if it's not there already
                        this.addChild(target);
                        if (target instanceof MovieClip && target.mode === MovieClip.INDEPENDENT && target.autoReset) {
                            target._reset();
                        }
                    }
                }
                else if (!shouldBeChild && target.parent === this) {
                    this.removeChild(target);
                }
            }
            // Properly depth sort the children
            for (var i = 0, length_3 = depthSorted.length; i < length_3; i++) {
                var target = depthSorted[i];
                var currentIndex = this.children.indexOf(target);
                if (currentIndex !== i) {
                    this.addChildAt(target, i);
                }
            }
            // Clear the temporary depth sorting array
            depthSorted.length = 0;
            // go through all children and update synched movieclips that are not single frames
            var children = this.children;
            for (var i = 0, length_4 = children.length; i < length_4; ++i) {
                var child = children[i];
                if (child instanceof MovieClip && child.mode === MovieClip.SYNCHED) {
                    child._synchOffset = currentFrame - child.parentStartPosition;
                    child._updateTimeline();
                }
            }
            // handle actions
            if (doActions && this._actions && this._actions[currentFrame]) {
                var frameActions = this._actions[currentFrame];
                for (var j = 0; j < frameActions.length; ++j) {
                    frameActions[j].call(this);
                }
            }
        };
        MovieClip.prototype.destroy = function (options) {
            if (this._tickListener) {
                SharedTicker.remove(this._tickListener, null);
                this._tickListener = null;
            }
            var hiddenChildren = [];
            var timelines = this._timelines;
            if (timelines) {
                for (var i = 0; i < timelines.length; i++) {
                    var timeline = timelines[i];
                    hiddenChildren.push(timeline.target);
                    timeline.destroy();
                }
            }
            var childTimelines = this._timedChildTimelines;
            if (childTimelines) {
                for (var i = 0; i < childTimelines.length; i++) {
                    var timeline = childTimelines[i];
                    if (hiddenChildren.indexOf(timeline.target) < 0) {
                        hiddenChildren.push(timeline.target);
                    }
                    timeline.length = 0;
                }
            }
            // Destroy all the children
            for (var i = 0; i < hiddenChildren.length; i++) {
                // Don't destroy children in the display list
                if (this.children.indexOf(hiddenChildren[i]) < 0) {
                    hiddenChildren[i].destroy(options);
                }
            }
            hiddenChildren.length = 0;
            this._actions = null;
            this._timelines = null;
            this._depthSorted = null;
            this._timedChildTimelines = null;
            this._beforeUpdate = null;
            this._labels = null;
            this._labelDict = null;
            _super.prototype.destroy.call(this, options);
        };
        /**
         * The MovieClip will advance independently of its parent, even if its parent is paused.
         * This is the default mode.
         */
        MovieClip.INDEPENDENT = 0;
        /**
         * The MovieClip will only display a single frame (as determined by the startPosition property).
         */
        MovieClip.SINGLE_FRAME = 1;
        /**
         * The MovieClip will be advanced only when its parent advances and will be synched to the position of
         * the parent MovieClip.
         */
        MovieClip.SYNCHED = 2;
        /**
         * The default framerate if none is specified or there's not parent clip with a framerate.
         */
        MovieClip.DEFAULT_FRAMERATE = 24;
        return MovieClip;
    }(AnimateContainer));

    // If the movieclip plugin is installed
    var _prepare = null;
    (function (utils) {
        /**
         * Convert the Hexidecimal string (e.g., "#fff") to uint
         */
        function hexToUint(hex) {
            // Remove the hash
            hex = hex.substr(1);
            // Convert shortcolors fc9 to ffcc99
            if (hex.length === 3) {
                hex = hex.replace(/([a-f0-9])/g, '$1$1');
            }
            return parseInt(hex, 16);
        }
        utils.hexToUint = hexToUint;
        /**
         * Fill frames with booleans of true (showing) and false (hidden).
         * @param timeline
         * @param startFrame The start frame when the timeline shows up
         * @param duration The length of showing
         */
        function fillFrames(timeline, startFrame, duration) {
            // ensure that the timeline is long enough
            var oldLength = timeline.length;
            if (oldLength < startFrame + duration) {
                timeline.length = startFrame + duration;
                // fill any gaps with false to denote that the child should be removed for a bit
                if (oldLength < startFrame) {
                    // if the browser has implemented the ES6 fill() function, use that
                    if (timeline.fill) {
                        timeline.fill(false, oldLength, startFrame);
                    }
                    else {
                        // if we can't use fill, then do a for loop to fill it
                        for (var i = oldLength; i < startFrame; ++i) {
                            timeline[i] = false;
                        }
                    }
                }
            }
            // if the browser has implemented the ES6 fill() function, use that
            if (timeline.fill) {
                timeline.fill(true, startFrame, startFrame + duration);
            }
            else {
                var length_1 = timeline.length;
                // if we can't use fill, then do a for loop to fill it
                for (var i = startFrame; i < length_1; ++i) {
                    timeline[i] = true;
                }
            }
        }
        utils.fillFrames = fillFrames;
        var keysMap = {
            X: 'x',
            Y: 'y',
            A: 'sx',
            B: 'sy',
            C: 'kx',
            D: 'ky',
            R: 'r',
            L: 'a',
            T: 't',
            F: 'c',
            V: 'v',
        };
        /**
         * Parse the value of the compressed keyframe.
         * @param prop The property key
         * @param buffer The contents
         * @return The parsed value
         */
        function parseValue(prop, buffer) {
            switch (prop) {
                // Color transforms are parsed as an array
                case 'c':
                    {
                        var buff = buffer.split(',');
                        buff.forEach(function (val, i, buffer) {
                            buffer[i] = parseFloat(val);
                        });
                        return buff;
                    }
                // Tint value should not be converted
                // can be color uint or string
                case 't':
                    {
                        return buffer;
                    }
                // The visiblity parse as boolean
                case 'v':
                    {
                        return !!parseInt(buffer, 10);
                    }
                // Everything else parse a floats
                default:
                    {
                        return parseFloat(buffer);
                    }
            }
        }
        var tweenKeysMap = {
            D: 'd',
            // E: 'e', // easing - disabled for manual handling
            P: 'p',
        };
        /**
         * Regex to test for a basic ease desccriptor
         */
        var basicEase = /(\-?\d*\.?\d*)([a-zA-Z]+)/;
        /**
         * Convert serialized tween from a serialized keyframe into TweenData
         * `"D20E25EaseIn;PX3Y5A1.2"` to: `{ d: 20, e: { s: 25, n: "EaseIn" }, p: { x:3, y: 5, sx: 1.2 } }`
         * @param tweenBuffer
         * @return Resulting TweenData
         */
        function parseTween(tweenBuffer) {
            var result = { d: 0, p: {} };
            var i = 0;
            var buffer = '';
            var handlingProps = false;
            var prop;
            // tween format:
            // D20E25EaseIn;PX3Y5A1.2
            while (i <= tweenBuffer.length) {
                var c = tweenBuffer[i];
                if (!handlingProps && (tweenKeysMap[prop] || tweenKeysMap[c])) {
                    // handle potential active duration property, which is the only normal one
                    if (prop === 'd') {
                        result.d = parseValue(prop, buffer);
                        prop = null;
                    }
                    // seeing the p property kicks us immediately into props mode
                    if (c === 'P') {
                        handlingProps = true;
                        ++i;
                    }
                    else {
                        // only handles D, really
                        prop = tweenKeysMap[c];
                        ++i;
                    }
                    buffer = '';
                }
                // seeing easing means we need to read ahead to the end of the easing section
                else if (c === 'E') {
                    // search for the next space or end of the string to see where the tween ends
                    var index = tweenBuffer.indexOf(';', i);
                    // should never end early, but just in case we are somehow tweening 0 properties
                    if (index < 0) {
                        index = tweenBuffer.length;
                    }
                    var easeBuffer = tweenBuffer.substring(i + 1, index);
                    if (basicEase.test(easeBuffer)) {
                        var _a = basicEase.exec(easeBuffer), strength = _a[1], name_1 = _a[2];
                        // if not yet handling props, apply ease to whole tween
                        if (!handlingProps) {
                            result.e = {
                                s: parseFloat(strength),
                                n: name_1,
                            };
                        }
                        // apply ease to last property read
                        else if (prop) {
                            result.p[prop] = parseValue(prop, buffer);
                            if (!result.p.e) {
                                result.p.e = {};
                            }
                            result.p.e[prop] = {
                                s: parseFloat(strength),
                                n: name_1,
                            };
                            prop = null;
                            buffer = '';
                        }
                    }
                    i = index + 1;
                }
                // normal prop/buffer handling, like in the main deserializeKeyframes function
                else if (keysMap[c]) {
                    if (prop) {
                        result.p[prop] = parseValue(prop, buffer);
                    }
                    prop = keysMap[c];
                    buffer = '';
                    i++;
                }
                else if (!c) {
                    if (prop) {
                        result.p[prop] = parseValue(prop, buffer);
                    }
                    buffer = '';
                    prop = null;
                    i++;
                }
                else {
                    buffer += c;
                    i++;
                }
            }
            return result;
        }
        /**
         * Convert serialized array into keyframes
         * `"0x100y100 1x150"` to: `{ "0": {"x":100, "y": 100}, "1": {"x": 150} }`
         * @param keyframes
         * @return Resulting keyframes
         */
        function deserializeKeyframes(keyframes) {
            var result = {};
            var i = 0;
            var buffer = '';
            var isFrameStarted = false;
            var prop;
            var frame = {};
            while (i <= keyframes.length) {
                var c = keyframes[i];
                // if we found the name of a property
                if (keysMap[c]) {
                    // start a new frame if we need to
                    if (!isFrameStarted) {
                        isFrameStarted = true;
                        result[buffer] = frame;
                    }
                    // finish a previous prop if one is running
                    if (prop) {
                        frame[prop] = parseValue(prop, buffer);
                    }
                    // save the new prop that we are now handling
                    prop = keysMap[c];
                    // reset buffer (because we did the previous prop if we had to)
                    buffer = '';
                    i++;
                }
                // contains a tween
                else if (c === 'W') {
                    // start a new frame if we need to
                    if (!isFrameStarted) {
                        isFrameStarted = true;
                        result[buffer] = frame;
                    }
                    // finish previous prop
                    if (prop) {
                        frame[prop] = parseValue(prop, buffer);
                        buffer = '';
                        prop = null;
                    }
                    // search for the next space or end of the string to see where the tween ends
                    var index = keyframes.indexOf(' ', i);
                    if (index < 0) {
                        index = keyframes.length;
                    }
                    // parse the tween section
                    frame.tw = parseTween(keyframes.substring(i + 1, index));
                    // skip past the tween section
                    i = index;
                }
                // finish existing prop & frame on end of string or space
                else if (!c || c === ' ') {
                    i++;
                    if (prop) {
                        frame[prop] = parseValue(prop, buffer);
                    }
                    buffer = '';
                    prop = null;
                    frame = {};
                    isFrameStarted = false;
                }
                // add to the buffer for the next parse
                else {
                    buffer += c;
                    i++;
                }
            }
            return result;
        }
        utils.deserializeKeyframes = deserializeKeyframes;
        /**
         * Convert serialized shapes into draw commands for PIXI.Graphics.
         * @param str
         * @param Resulting shapes map
         */
        function deserializeShapes(str) {
            var result = [];
            // each shape is a new line
            var shapes = str.split('\n');
            var isCommand = /^[a-z]{1,2}$/;
            for (var i = 0; i < shapes.length; i++) {
                var shape = shapes[i].split(' '); // arguments are space separated
                for (var j = 0; j < shape.length; j++) {
                    // Convert all numbers to floats, ignore colors
                    var arg = shape[j];
                    if (arg[0] !== '#' && !isCommand.test(arg)) {
                        shape[j] = parseFloat(arg);
                    }
                }
                result.push(shape);
            }
            return result;
        }
        utils.deserializeShapes = deserializeShapes;
        /**
         * Add movie clips to the upload prepare.
         * @param {*} item To add to the queue
         */
        function addMovieClips(item) {
            if (item instanceof MovieClip) {
                item._timedChildTimelines.forEach(function (timeline) {
                    var index = item.children.indexOf(timeline.target);
                    if (index === -1) {
                        // eslint-disable-next-line no-unused-expressions
                        _prepare === null || _prepare === void 0 ? void 0 : _prepare.add(timeline.target);
                    }
                });
                return true;
            }
            return false;
        }
        utils.addMovieClips = addMovieClips;
        /**
         * Upload all the textures and graphics to the GPU.
         * @param renderer Render to upload to
         * @param clip MovieClip to upload
         * @param done When complete
         */
        function upload(renderer, displayObject, done) {
            if (!_prepare) {
                _prepare = renderer.plugins.prepare;
                _prepare.registerFindHook(addMovieClips);
            }
            // eslint-disable-next-line no-unused-expressions
            _prepare === null || _prepare === void 0 ? void 0 : _prepare.upload(displayObject, done);
        }
        utils.upload = upload;
    })(exports.utils || (exports.utils = {}));

    var EXPECTED_ASSET_VERSION = 2;
    function load(scene, optionsOrComplete) {
        var complete = typeof optionsOrComplete === 'function' ? optionsOrComplete : optionsOrComplete === null || optionsOrComplete === void 0 ? void 0 : optionsOrComplete.complete;
        var basePath = '';
        var parent = null;
        var metadata;
        var createInstance = false;
        var loader;
        // check scene and warn about it
        var version = scene.version;
        if (typeof version === 'number') {
            /* eslint-disable max-len */
            if (Math.floor(version) !== Math.floor(EXPECTED_ASSET_VERSION)) {
                console.warn("Asset version is not the major version expected of " + Math.floor(EXPECTED_ASSET_VERSION) + " - it may not load properly", scene);
            }
            else if (version > EXPECTED_ASSET_VERSION) {
                console.warn('Asset has been published with a newer version than PixiAnimate expects. It may not load properly.', scene);
            }
            /* eslint-enable max-len */
        }
        if (optionsOrComplete && typeof optionsOrComplete !== 'function') {
            basePath = optionsOrComplete.basePath || '';
            parent = optionsOrComplete.parent;
            metadata = optionsOrComplete.metadata;
            createInstance = !!optionsOrComplete.createInstance;
            loader = optionsOrComplete.loader;
        }
        loader = loader || new loaders.Loader();
        function done() {
            var instance = (createInstance && typeof scene.stage === 'function') ? new scene.stage() : null;
            if (parent && instance) {
                parent.addChild(instance);
            }
            if (complete) {
                complete(instance, loader);
            }
        }
        // Check for assets to preload
        var assets = scene.assets || {};
        if (assets && Object.keys(assets).length) {
            // assetBaseDir can accept either with trailing slash or not
            if (basePath) {
                basePath += '/';
            }
            for (var id in assets) {
                var data = null;
                if (metadata) {
                    // if the metadata was supplied for this particular asset, use these options
                    if (metadata[id]) {
                        data = metadata[id];
                    }
                    // if the metadata supplied a default option
                    else if (metadata.default) {
                        data = metadata.default;
                    }
                }
                loader.add(id, basePath + assets[id], data, function (resource) {
                    if (!resource.data) {
                        return;
                    }
                    if (resource.spritesheet) {
                        // handle spritesheets
                        scene.spritesheets.push(resource.spritesheet);
                    }
                    else if (resource.data.nodeName === 'IMG') {
                        // handle individual textures
                        scene.textures[resource.name] = resource.texture;
                    }
                    else if (resource.url.search(/\.shapes\.(json|txt)$/i) > -1) {
                        // save shape data
                        var items = resource.data;
                        // Decode string to map of files
                        if (typeof items === 'string') {
                            items = exports.utils.deserializeShapes(items);
                        }
                        // Convert all hex string colors (animate) to int (pixi.js)
                        for (var i = 0; i < items.length; i++) {
                            var item = items[i];
                            for (var j = 0; j < item.length; j++) {
                                var arg = item[j];
                                if (typeof arg === 'string' && arg[0] === '#') {
                                    item[j] = exports.utils.hexToUint(arg);
                                }
                            }
                        }
                        scene.shapes[resource.name] = items;
                    }
                });
            }
            loader.onComplete.once(done);
            loader.load();
        }
        else {
            // tiny case where there's only text and no shapes/animations
            done();
        }
        return loader;
    }

    /**
     * Extends the PIXI.Application class to provide easy loading.
     * ```
     * const scene = new PIXI.animate.Scene();
     * scene.load(lib.StageName);
     * ```
     */
    var Scene = /** @class */ (function (_super) {
        __extends(Scene, _super);
        function Scene() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            /**
             * Reference to the global sound object
             * @readOnly
             */
            _this.sound = sound;
            /**
             * The stage object created.
             */
            _this.instance = null;
            return _this;
        }
        /**
         * Load a stage scene and add it to the stage.
         * @param asset Reference to the scene to load.
         * @param complete Callback when finished loading.
         * @param basePath Optional base directory to prepend to assets.
         * @return instance of PIXI resource loader
         */
        Scene.prototype.load = function (asset, complete, basePath) {
            var _this = this;
            return load(asset, {
                parent: this.stage,
                createInstance: true,
                complete: function (instance) {
                    _this.instance = instance;
                    if (complete) {
                        complete(_this.instance);
                    }
                },
                basePath: basePath,
            });
        };
        /**
         * Destroy and don't use after calling.
         * @param removeView Automatically remove canvas from DOM.
         * @param stageOptions Options parameter. A boolean will act as if all options
         *  have been set to that value
         */
        Scene.prototype.destroy = function (removeView, stageOptions) {
            if (this.instance) {
                this.instance.destroy(true);
                this.instance = null;
            }
            _super.prototype.destroy.call(this, removeView, stageOptions);
        };
        return Scene;
    }(app.Application));

    var pool = [];
    /**
     * Represents a single animation play.
     */
    var AnimatorTimeline = /** @class */ (function () {
        function AnimatorTimeline() {
            this._update = this.update.bind(this);
            this.init(null, 0, 0, false, null);
        }
        /**
         * The pool of timelines to use
         * @param instance
         * @param start
         * @param end
         * @param loop
         * @param callback
         */
        AnimatorTimeline.prototype.init = function (instance, start, end, loop, callback) {
            this.instance = instance;
            this.loop = loop;
            this.start = start;
            this.end = end;
            this.callback = callback;
            if (instance) {
                // Prevent overshooting the end frame and looping back around:
                instance.loop = false;
                instance.gotoAndStop(start);
                instance._beforeUpdate = this._update;
            }
        };
        /**
         * Don't use after this
         * @private
         */
        AnimatorTimeline.prototype.destroy = function () {
            this.instance._beforeUpdate = null;
            this.init(null, 0, 0, false, null);
            AnimatorTimeline._pool.push(this);
        };
        /**
         * Is the animation complete
         * @method PIXI.animate.AnimatorTimeline#update
         * @param instance
         * @return Callback to do after updateTimeline
         * @private
         */
        AnimatorTimeline.prototype.update = function (instance) {
            var completed;
            if (instance.currentFrame >= this.end) {
                // In case we over-shoot the current frame becuase of low FPS
                instance.currentFrame = this.end;
                if (this.loop) {
                    // Update timeline so we get actions at the end frame
                    instance._updateTimeline();
                    instance.gotoAndPlay(this.start);
                }
                else {
                    instance.stop();
                    if (this.callback) {
                        completed = this.callback;
                    }
                    this.stop(); // cleanup timeline
                }
            }
            return completed;
        };
        /**
         * Stop the animation, cannot be reused.
         */
        AnimatorTimeline.prototype.stop = function () {
            Animator._internalStop(this);
        };
        Object.defineProperty(AnimatorTimeline.prototype, "progress", {
            /**
             * The progress from 0 to 1 of the playback.
             */
            get: function () {
                var progress = (this.instance.currentFrame - this.start) / (this.end - this.start);
                return Math.max(0, Math.min(1, progress)); // clamp
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AnimatorTimeline, "_pool", {
            /**
             * The pool of timelines to use
             * @private
             */
            get: function () {
                return pool;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Create a new timeline
         */
        AnimatorTimeline.create = function (instance, start, end, loop, callback) {
            var timeline;
            if (this._pool.length) {
                timeline = this._pool.pop();
            }
            else {
                timeline = new AnimatorTimeline();
            }
            timeline.init(instance, start, end, loop, callback);
            return timeline;
        };
        return AnimatorTimeline;
    }());

    // Static collection of timelines
    var timelines = [];
    /**
     * Play animation via start/stop frame labels
     * @class Animator
     */
    var Animator = /** @class */ (function () {
        function Animator() {
        }
        Object.defineProperty(Animator, "_timelines", {
            /**
             * The collection of timelines
             */
            get: function () {
                return timelines;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Animator, "STOP_LABEL", {
            /**
             * Suffix added to label for a stop.
             */
            get: function () {
                return '_stop';
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Animator, "LOOP_LABEL", {
            /**
             * Suffix added to label for a loop.
             */
            get: function () {
                return '_loop';
            },
            enumerable: false,
            configurable: true
        });
        Animator.play = function (instance, label, callback) {
            var loop = false;
            var start;
            var end;
            if (!label || typeof label === 'function') {
                start = 0;
                end = instance.totalFrames - 1;
                if (label && typeof label === 'function') {
                    callback = label;
                    label = null;
                }
            }
            else {
                start = instance.labelsMap[label];
                end = instance.labelsMap[label + this.STOP_LABEL];
                if (end === undefined) {
                    end = instance.labelsMap[label + this.LOOP_LABEL];
                    loop = true;
                }
                if (start === undefined) {
                    throw new Error("No start label matching \"" + label + "\"");
                }
                else if (end === undefined) {
                    throw new Error("No end label matching \"" + label + "\"");
                }
            }
            return this.fromTo(instance, start, end, loop, callback);
        };
        /**
         * Play an animation from the current frame to an end frame or label.
         * @param instance Movie clip to play.
         * @param end The end frame or label.
         * @param callback Optional callback when complete
         * @return Timeline object for stopping or getting progress.
         */
        Animator.to = function (instance, end, callback) {
            return this.fromTo(instance, instance.currentFrame, end, false, callback);
        };
        /**
         * Play a MovieClip from a start to end frame.
         * @param instance Movie clip to play.
         * @param start The starting frame index or label.
         * @param end The ending frame index or label.
         * @param loop If the animation should loop.
         * @param callback Optional callback when complete
         * @return Timeline object for stopping or getting progress.
         */
        Animator.fromTo = function (instance, start, end, loop, callback) {
            if (typeof start === 'string') {
                var startLabel = start;
                start = instance.labelsMap[startLabel];
                if (start === undefined) {
                    throw new Error("No start label matching \"" + startLabel + "\"");
                }
            }
            if (typeof end === 'string') {
                var endLabel = end;
                end = instance.labelsMap[endLabel];
                if (end === undefined) {
                    throw new Error("No end label matching \"" + endLabel + "\"");
                }
            }
            if (start < 0) {
                throw new Error('Start frame is out of bounds');
            }
            if (end >= instance.totalFrames) {
                throw new Error('End frame is out of bounds');
            }
            if (start >= end) {
                throw new Error('End frame is before start frame');
            }
            // Stop any animation that's playing
            this.stop(instance);
            loop = !!loop;
            // Add a new timeline
            var timeline = AnimatorTimeline.create(instance, start, end, loop, callback);
            this._timelines.push(timeline);
            // Set the current frame
            if (instance.currentFrame !== start) {
                instance.gotoAndPlay(start);
            }
            else {
                instance.play();
            }
            return timeline;
        };
        /**
         * Stop the animation by instance.
         * @param instance Movie clip to play.
         */
        Animator.stop = function (instance) {
            for (var i = 0, len = this._timelines.length; i < len; i++) {
                var timeline = this._timelines[i];
                if (timeline.instance === instance) {
                    this._internalStop(timeline);
                    break;
                }
            }
        };
        /**
         * Stop all the currently playing animations.
         */
        Animator.stopAll = function () {
            for (var i = this._timelines.length - 1; i >= 0; i--) {
                this._internalStop(this._timelines[i]);
            }
        };
        /**
         * Stop the animation
         * @private
         * @param timeline Timeline to stop.
         */
        Animator._internalStop = function (timeline) {
            this._timelines.splice(this._timelines.indexOf(timeline), 1);
            timeline.instance.stop();
            timeline.destroy();
        };
        return Animator;
    }());

    /**
     * Utility subclass of PIXI.Sprite
     */
    var AnimateSprite = /** @class */ (function (_super) {
        __extends(AnimateSprite, _super);
        function AnimateSprite() {
            // **************************
            //     DisplayObject methods
            // **************************
            var _this = _super !== null && _super.apply(this, arguments) || this;
            /**
             * Shortcut for `setRenderable`.
             */
            _this.re = _this.setRenderable;
            /**
             * Shortcut for `setTransform`.
             */
            _this.t = _super.prototype.setTransform;
            /**
             * Shortcut for `setMask`.
             */
            _this.ma = _this.setMask;
            /**
             * Shortcut for `setAlpha`.
             */
            _this.a = _this.setAlpha;
            /**
             * Shortcut for `setTint`.
             */
            _this.i = _this.setTint;
            /**
             * Shortcut for `setColor`.
             */
            _this.c = _this.setColorTransform;
            return _this;
        }
        /**
         * Function to set if this is renderable or not. Useful for setting masks.
         * @param renderable Make renderable. Defaults to false.
         * @return This instance, for chaining.
         */
        AnimateSprite.prototype.setRenderable = function (renderable) {
            this.renderable = !!renderable;
            return this;
        };
        /**
         * Setter for mask to be able to chain.
         * @param mask The mask shape to use
         * @return Instance for chaining
         */
        AnimateSprite.prototype.setMask = function (mask) {
            // According to PIXI, only Graphics and Sprites can
            // be used as mask, let's ignore everything else, like other
            // movieclips and displayobjects/containers
            if (mask) {
                if (!(mask instanceof graphics.Graphics) && !(mask instanceof sprite.Sprite)) {
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('Warning: Masks can only be PIXI.Graphics or PIXI.Sprite objects.');
                    }
                    return this;
                }
            }
            this.mask = mask;
            return this;
        };
        /**
         * Chainable setter for alpha
         * @param alpha The alpha amount to use, from 0 to 1
         * @return Instance for chaining
         */
        AnimateSprite.prototype.setAlpha = function (alpha) {
            this.alpha = alpha;
            return this;
        };
        /**
         * Set the tint values by color.
         * @param tint The color value to tint
         * @return Object for chaining
         */
        AnimateSprite.prototype.setTint = function (tint) {
            if (typeof tint === 'string') {
                tint = exports.utils.hexToUint(tint);
            }
            this.tint = tint;
            return this;
        };
        /**
         * Set additive and multiply color, tinting
         * @param r The multiply red value
         * @param rA The additive red value
         * @param g The multiply green value
         * @param gA The additive green value
         * @param b The multiply blue value
         * @param bA The additive blue value
         * @return Object for chaining
         */
        AnimateSprite.prototype.setColorTransform = function (r, rA, g, gA, b, bA) {
            var filter = this.colorTransformFilter;
            filter.matrix[0] = r;
            filter.matrix[4] = rA;
            filter.matrix[6] = g;
            filter.matrix[9] = gA;
            filter.matrix[12] = b;
            filter.matrix[14] = bA;
            this.filters = [filter];
            return this;
        };
        Object.defineProperty(AnimateSprite.prototype, "colorTransformFilter", {
            get: function () {
                return this._colorTransformFilter || new filterColorMatrix.ColorMatrixFilter();
            },
            /**
             * The current default color transforming filter
             */
            set: function (filter) {
                this._colorTransformFilter = filter;
            },
            enumerable: false,
            configurable: true
        });
        return AnimateSprite;
    }(sprite.Sprite));

    var AnimateGraphics = /** @class */ (function (_super) {
        __extends(AnimateGraphics, _super);
        function AnimateGraphics(geometry) {
            var _this = _super.call(this, geometry) || this;
            /**
             * Shortcut for `drawCommands`.
             */
            _this.d = _this.drawCommands;
            /**
             * Shortcut for `closePath`.
             **/
            _this.cp = _super.prototype.closePath;
            /**
             * Shortcut for `beginHole`
             **/
            _this.bh = _super.prototype.beginHole;
            /**
             * Shortcut for `endHole`
             **/
            _this.eh = _super.prototype.endHole;
            /**
             * Shortcut for `moveTo`.
             **/
            _this.m = _super.prototype.moveTo;
            /**
             * Shortcut for `lineTo`.
             **/
            _this.l = _super.prototype.lineTo;
            /**
             * Shortcut for `quadraticCurveTo`.
             **/
            _this.q = _super.prototype.quadraticCurveTo;
            /**
             * Shortcut for `bezierCurveTo`.
             **/
            _this.b = _super.prototype.bezierCurveTo;
            /**
             * Shortcut for `beginFill`.
             **/
            _this.f = _super.prototype.beginFill;
            /**
             * Shortcut for `drawRect`.
             **/
            _this.dr = _super.prototype.drawRect;
            /**
             * Shortcut for `drawRoundedRect`.
             **/
            _this.rr = _super.prototype.drawRoundedRect;
            /**
             * Shortcut for `drawRoundedRect`.
             **/
            _this.rc = _super.prototype.drawRoundedRect;
            /**
             * Shortcut for `drawCircle`.
             **/
            _this.dc = _super.prototype.drawCircle;
            /**
             * Shortcut for `arc`.
             **/
            _this.ar = _super.prototype.arc;
            /**
             * Shortcut for `arcTo`.
             **/
            _this.at = _super.prototype.arcTo;
            /**
             * Shortcut for `drawEllipse`.
             */
            _this.de = _super.prototype.drawEllipse;
            /**
             * Shortcut for `setRenderable`.
             */
            _this.re = _this.setRenderable;
            /**
             * Shortcut for `setTransform`.
             */
            _this.t = _super.prototype.setTransform;
            /**
             * Shortcut for `setMask`.
             */
            _this.ma = _this.setMask;
            /**
             * Shortcut for `setAlpha`.
             */
            _this.a = _this.setAlpha;
            /**
             * Shortcut for `setTint`.
             */
            _this.i = _this.setTint;
            // overwrite with a cleaner version, so fewer function calls are involved
            _this.s = _super.prototype.lineStyle;
            return _this;
        }
        // **************************
        //     Graphics methods
        // **************************
        /**
         * Execute a series of commands, this is the name of the short function
         * followed by the parameters, e.g., `["f", "#ff0000", "r", 0, 0, 100, 200]`
         * @param commands The commands and parameters to draw
         * @return This instance for chaining.
         */
        AnimateGraphics.prototype.drawCommands = function (commands) {
            var currentCommand;
            var params = [];
            var i = 0;
            while (i <= commands.length) {
                var item = commands[i++];
                if (item === undefined || this[item]) {
                    if (currentCommand) {
                        this[currentCommand].apply(this, params);
                        params.length = 0;
                    }
                    currentCommand = item;
                }
                else {
                    params.push(item);
                }
            }
            return this;
        };
        AnimateGraphics.prototype.s = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return _super.prototype.lineStyle.apply(this, args);
        };
        /**
         * Placeholder method for a linear gradient fill. Pixi does not support linear gradient fills,
         * so we just pick the first color in colorArray
         * @param colorArray An array of CSS compatible color values @see `f`
         * @return The Graphics instance the method is called on (useful for chaining calls.)
         **/
        AnimateGraphics.prototype.lf = function (colorArray) {
            // @if DEBUG
            console.warn('Linear gradient fills are not supported');
            // @endif
            return this.f(colorArray[0]);
        };
        /**
         * Placeholder method for a radial gradient fill. Pixi does not support radial gradient fills,
         * so we just pick the first color in colorArray
         * @param colorArray An array of CSS compatible color values @see `f`
         * @return The Graphics instance the method is called on (useful for chaining calls.)
         **/
        AnimateGraphics.prototype.rf = function (colorArray) {
            // @if DEBUG
            console.warn('Radial gradient fills are not supported');
            // @endif
            return this.f(colorArray[0]);
        };
        /**
         * Placeholder method for a `beginBitmapFill`. Pixi does not support bitmap fills.
         * @return The Graphics instance the method is called on (useful for chaining calls.)
         **/
        AnimateGraphics.prototype.bf = function () {
            // @if DEBUG
            console.warn('Bitmap fills are not supported');
            // @endif
            return this.f(0x0);
        };
        /**
         * Placeholder method for a `setStrokeDash`. Pixi does not support dashed strokes.
         * @return The Graphics instance the method is called on (useful for chaining calls.)
         **/
        AnimateGraphics.prototype.sd = function () {
            // @if DEBUG
            console.warn('Dashed strokes are not supported');
            // @endif
            return this;
        };
        /**
         * Placeholder method for a `beginBitmapStroke`. Pixi does not support bitmap strokes.
         * @return The Graphics instance the method is called on (useful for chaining calls.)
         **/
        AnimateGraphics.prototype.bs = function () {
            // @if DEBUG
            console.warn('Bitmap strokes are not supported');
            // @endif
            return this;
        };
        /**
         * Placeholder method for a `beginLinearGradientStroke`. Pixi does not support gradient strokes.
         * @return The Graphics instance the method is called on (useful for chaining calls.)
         **/
        AnimateGraphics.prototype.ls = function () {
            // @if DEBUG
            console.warn('Linear gradient strokes are not supported');
            // @endif
            return this;
        };
        /**
         * Placeholder method for a `beginRadialGradientStroke`. Pixi does not support gradient strokes.
         * @return The Graphics instance the method is called on (useful for chaining calls.)
         **/
        AnimateGraphics.prototype.rs = function () {
            // @if DEBUG
            console.warn('Radial gradient strokes are not supported');
            // @endif
            return this;
        };
        // **************************
        //     DisplayObject methods
        // **************************
        /**
         * Function to set if this is renderable or not. Useful for setting masks.
         * @param renderable Make renderable. Defaults to false.
         * @return This instance, for chaining.
         */
        AnimateGraphics.prototype.setRenderable = function (renderable) {
            this.renderable = !!renderable;
            return this;
        };
        /**
         * Setter for mask to be able to chain.
         * @param mask The mask shape to use
         * @return Instance for chaining
         */
        AnimateGraphics.prototype.setMask = function (mask) {
            // According to PIXI, only Graphics and Sprites can
            // be used as mask, let's ignore everything else, like other
            // movieclips and displayobjects/containers
            if (mask) {
                if (!(mask instanceof graphics.Graphics) && !(mask instanceof sprite.Sprite)) {
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('Warning: Masks can only be PIXI.Graphics or PIXI.Sprite objects.');
                    }
                    return this;
                }
            }
            this.mask = mask;
            return this;
        };
        /**
         * Chainable setter for alpha
         * @param alpha The alpha amount to use, from 0 to 1
         * @return Instance for chaining
         */
        AnimateGraphics.prototype.setAlpha = function (alpha) {
            this.alpha = alpha;
            return this;
        };
        /**
         * Set the tint values by color.
         * @param tint The color value to tint
         * @return Object for chaining
         */
        AnimateGraphics.prototype.setTint = function (tint) {
            if (typeof tint === 'string') {
                tint = exports.utils.hexToUint(tint);
            }
            // this.tint = tint
            // return this;
            // TODO: Replace with DisplayObject.tint setter
            // once the functionality is added to Pixi.js, for
            // now we'll use the slower ColorMatrixFilter to handle
            // the color transformation
            var r = (tint >> 16) & 0xFF;
            var g = (tint >> 8) & 0xFF;
            var b = tint & 0xFF;
            return this.setColorTransform(r / 255, 0, g / 255, 0, b / 255, 0);
        };
        /**
         * Set additive and multiply color, tinting
         * @param r The multiply red value
         * @param rA The additive red value
         * @param g The multiply green value
         * @param gA The additive green value
         * @param b The multiply blue value
         * @param bA The additive blue value
         * @return Object for chaining
         */
        AnimateGraphics.prototype.setColorTransform = function (r, rA, g, gA, b, bA) {
            var filter = this.colorTransformFilter;
            filter.matrix[0] = r;
            filter.matrix[4] = rA;
            filter.matrix[6] = g;
            filter.matrix[9] = gA;
            filter.matrix[12] = b;
            filter.matrix[14] = bA;
            this.filters = [filter];
            return this;
        };
        /**
         * Shortcut for `setColor`.
         */
        // method instead of direct reference to allow override in v1 shim
        AnimateGraphics.prototype.c = function (r, rA, g, gA, b, bA) {
            return this.setColorTransform(r, rA, g, gA, b, bA);
        };
        Object.defineProperty(AnimateGraphics.prototype, "colorTransformFilter", {
            get: function () {
                return this._colorTransformFilter || new filterColorMatrix.ColorMatrixFilter();
            },
            /**
             * The current default color transforming filter
             */
            set: function (filter) {
                this._colorTransformFilter = filter;
            },
            enumerable: false,
            configurable: true
        });
        return AnimateGraphics;
    }(graphics.Graphics));

    // Possible align values
    var ALIGN_VALUES;
    (function (ALIGN_VALUES) {
        ALIGN_VALUES[ALIGN_VALUES["center"] = 0] = "center";
        ALIGN_VALUES[ALIGN_VALUES["right"] = 1] = "right";
        ALIGN_VALUES[ALIGN_VALUES["left"] = -1] = "left";
    })(ALIGN_VALUES || (ALIGN_VALUES = {}));
    // Map of short names to long names
    var STYLE_PROPS = {
        o: 'font',
        z: 'fontSize',
        f: 'fontFamily',
        y: 'fontStyle',
        g: 'fontWeight',
        i: 'fill',
        a: 'align',
        s: 'stroke',
        t: 'strokeThickness',
        w: 'wordWrap',
        d: 'wordWrapWidth',
        l: 'lineHeight',
        h: 'dropShadow',
        c: 'dropShadowColor',
        n: 'dropShadowAngle',
        b: 'dropShadowBlur',
        p: 'padding',
        x: 'textBaseline',
        j: 'lineJoin',
        m: 'miterLimit',
        e: 'letterSpacing',
    };
    /**
     * Check if a value is undefined, fallback to default value
     * @param value The value to check
     * @param defaultValue The default value if value is undefined
     * @return Either the value or the default value
     */
    function isUndefinedOr(value, defaultValue) {
        return value === undefined ? defaultValue : value;
    }
    var AnimateText = /** @class */ (function (_super) {
        __extends(AnimateText, _super);
        function AnimateText() {
            // **************************
            //     Text methods
            // **************************
            var _this = _super !== null && _super.apply(this, arguments) || this;
            /**
             * Shortcut for `setAlign`.
             */
            _this.g = _this.setAlign;
            /**
             * Shortcut for `setStyle`.
             */
            _this.ss = _this.setStyle;
            /**
             * Shortcut for `setShadow`.
             */
            _this.sh = _this.setShadow;
            /**
             * Shortcut for `setRenderable`.
             */
            _this.re = _this.setRenderable;
            /**
             * Shortcut for `setTransform`.
             */
            _this.t = _super.prototype.setTransform;
            /**
             * Shortcut for `setMask`.
             */
            _this.ma = _this.setMask;
            /**
             * Shortcut for `setAlpha`.
             */
            _this.a = _this.setAlpha;
            /**
             * Shortcut for `setTint`.
             */
            _this.i = _this.setTint;
            /**
             * Shortcut for `setColor`.
             */
            _this.c = _this.setColorTransform;
            return _this;
        }
        /**
         * Setter for the alignment, also sets the anchor point
         * to make sure the positioning is correct.
         * @param align Either center (0), right (1), left (-1)
         * @return This instance for chaining
         */
        AnimateText.prototype.setAlign = function (align) {
            if (typeof align === 'string') {
                align = ALIGN_VALUES[align];
            }
            this.style.align = ALIGN_VALUES[align] || 'left';
            this.anchor.x = (align + 1) / 2;
            return this;
        };
        /**
         * Set the style, a chainable version of style setter
         * @param style
         * @return This instance for chaining.
         */
        // TODO: improve typing of style parameter (needs ITextStyle interface to exist)
        AnimateText.prototype.setStyle = function (style) {
            // Replace short STYLE_PROPS with long names
            for (var k in STYLE_PROPS) {
                if (style[k] !== undefined) {
                    style[STYLE_PROPS[k]] = style[k];
                    delete style[k];
                }
            }
            this.style = style;
            return this;
        };
        /**
         * Initial setting of the drop shadow.
         * @param color The color to set
         * @param angle The angle of offset, in radians
         * @param distance The offset distance
         * @return This instance for chaining
         */
        AnimateText.prototype.setShadow = function (color, angle, distance) {
            var style = this.style;
            style.dropShadow = true;
            // Convert color to hex string
            if (color && typeof color === 'number') {
                color = "#" + color.toString(16);
            }
            style.dropShadowColor = isUndefinedOr(color, style.dropShadowColor);
            style.dropShadowAngle = isUndefinedOr(angle, style.dropShadowAngle);
            style.dropShadowDistance = isUndefinedOr(distance, style.dropShadowDistance);
            return this;
        };
        // **************************
        //     DisplayObject methods
        // **************************
        /**
         * Function to set if this is renderable or not. Useful for setting masks.
         * @param renderable Make renderable. Defaults to false.
         * @return This instance, for chaining.
         */
        AnimateText.prototype.setRenderable = function (renderable) {
            this.renderable = !!renderable;
            return this;
        };
        /**
         * Setter for mask to be able to chain.
         * @param mask The mask shape to use
         * @return Instance for chaining
         */
        AnimateText.prototype.setMask = function (mask) {
            // According to PIXI, only Graphics and Sprites can
            // be used as mask, let's ignore everything else, like other
            // movieclips and displayobjects/containers
            if (mask) {
                if (!(mask instanceof graphics.Graphics) && !(mask instanceof sprite.Sprite)) {
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('Warning: Masks can only be PIXI.Graphics or PIXI.Sprite objects.');
                    }
                    return this;
                }
            }
            this.mask = mask;
            return this;
        };
        /**
         * Chainable setter for alpha
         * @param alpha The alpha amount to use, from 0 to 1
         * @return Instance for chaining
         */
        AnimateText.prototype.setAlpha = function (alpha) {
            this.alpha = alpha;
            return this;
        };
        /**
         * Set the tint values by color.
         * @param tint The color value to tint
         * @return Object for chaining
         */
        AnimateText.prototype.setTint = function (tint) {
            if (typeof tint === 'string') {
                tint = exports.utils.hexToUint(tint);
            }
            // this.tint = tint
            // return this;
            // TODO: Replace with DisplayObject.tint setter
            // once the functionality is added to Pixi.js, for
            // now we'll use the slower ColorMatrixFilter to handle
            // the color transformation
            var r = (tint >> 16) & 0xFF;
            var g = (tint >> 8) & 0xFF;
            var b = tint & 0xFF;
            return this.setColorTransform(r / 255, 0, g / 255, 0, b / 255, 0);
        };
        /**
         * Set additive and multiply color, tinting
         * @param r The multiply red value
         * @param rA The additive red value
         * @param g The multiply green value
         * @param gA The additive green value
         * @param b The multiply blue value
         * @param bA The additive blue value
         * @return Object for chaining
         */
        AnimateText.prototype.setColorTransform = function (r, rA, g, gA, b, bA) {
            var filter = this.colorTransformFilter;
            filter.matrix[0] = r;
            filter.matrix[4] = rA;
            filter.matrix[6] = g;
            filter.matrix[9] = gA;
            filter.matrix[12] = b;
            filter.matrix[14] = bA;
            this.filters = [filter];
            return this;
        };
        Object.defineProperty(AnimateText.prototype, "colorTransformFilter", {
            get: function () {
                return this._colorTransformFilter || new filterColorMatrix.ColorMatrixFilter();
            },
            /**
             * The current default color transforming filter
             */
            set: function (filter) {
                this._colorTransformFilter = filter;
            },
            enumerable: false,
            configurable: true
        });
        return AnimateText;
    }(text.Text));

    var VERSION = '2.0.1';

    exports.Animator = Animator;
    exports.AnimatorTimeline = AnimatorTimeline;
    exports.Container = AnimateContainer;
    exports.Graphics = AnimateGraphics;
    exports.MovieClip = MovieClip;
    exports.Scene = Scene;
    exports.Sprite = AnimateSprite;
    exports.Text = AnimateText;
    exports.Timeline = Timeline;
    exports.Tween = Tween;
    exports.VERSION = VERSION;
    exports.load = load;
    exports.sound = sound;

}(this.PIXI.animate = this.PIXI.animate || {}, PIXI, PIXI.utils, PIXI.filters, PIXI, PIXI, PIXI, PIXI, PIXI, PIXI, PIXI));
//# sourceMappingURL=animate.js.map

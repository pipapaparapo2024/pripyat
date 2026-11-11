const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../_client/src/game/onboarding.js'), 'utf8');
const methods = src.slice(src.indexOf('    _playNarration('), src.indexOf('    _flushQueuedIdleNarration('));
const tracks = new Map();
const played = [];
let resumed = 0;
const context = {paused: true, audioContext: {state: 'suspended', resume() { resumed++; }}};
const sound = {
    context,
    exists: alias => tracks.has(alias),
    find: alias => tracks.get(alias),
    add(alias, options) {
        assert.equal(options.singleInstance, true);
        tracks.set(alias, {...options, stop() {}});
    },
    play(alias, options) {
        played.push({alias, options});
        return {};
    },
};
const PIXI = {sound};
const Tutorial = vm.runInNewContext('(class {' + methods + '})', {
    window: {PIXI}, PIXI, console: {error() {}, log() {}}, ONBOARDING_EXTRA_SOUNDS: {idle: 'idle.mp3'},
});
const lesson = new Tutorial();
lesson._flushQueuedIdleNarration = () => {};
let completed = 0;
lesson._playNarration('intro.mp3', () => completed++);
lesson._playNarration('intro.mp3');
lesson._queueIdleNarration();
assert.equal(resumed, 0, 'Hidden tab must not wake the audio context');
assert.equal(played.length, 0);
assert.equal(lesson._pendingIdleNarration, true);
const intro = tracks.get('onboarding_intro.mp3');
context.paused = false;
context.audioContext.state = 'running';
intro.loaded();
intro.loaded();
lesson._playNarration('intro.mp3');
assert.equal(played.length, 1);
played[0].options.complete();
assert.equal(completed, 1);

let errors = 0;
lesson._playNarration('previous.mp3', null, () => errors++);
lesson._playNarration('next.mp3', null, () => errors++);
tracks.get('onboarding_previous.mp3').loaded();
tracks.get('onboarding_previous.mp3').loaded(new Error('cancelled'));
assert.equal(played.length, 1);
assert.equal(errors, 0);
tracks.get('onboarding_next.mp3').loaded(new Error('load failed'));
assert.equal(errors, 1);
assert.equal(lesson._narrationUrl, null);
lesson._playNarration('next.mp3');
assert.equal(played.length, 2, 'A failed line remains retryable');
console.log('Повторный вызов, возврат во вкладку и устаревшая загрузка проверены.');

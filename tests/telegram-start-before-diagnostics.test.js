const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const entry = fs.readFileSync(path.join(__dirname, '../_client/src/telegram-entry.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '')
    .replace("import('./index.js')", 'loadGame()');

(async () => {
    const calls = [];
    const window = {
        Telegram: {WebApp: {}},
        location: new URL('https://tg-test-pripyat-game.ru/'),
        onPreloaderHidden(callback) { this.hidden = callback; },
    };
    await vm.runInNewContext(entry, {
        window, URL, starsCatalog: {}, console: {warn: () => calls.push('warning')},
        installTelegramBackdrop() {},
        loginTelegramTest: async () => ({roles: ['developer'], owner_diagnostics: true}),
        createTelegramRuntime() {},
        TelegramServer: class {},
        openTelegramFriends() {},
        installTelegramPayments() {},
        async showTelegramWelcome() { calls.push('welcome'); },
        async loadGame() { calls.push('game'); },
        async installTelegramDeveloper(roles, owner) {
            calls.push('diagnostics');
            assert.equal(roles[0], 'developer');
            assert.equal(owner, true);
            throw new Error('diagnostics offline');
        },
    });
    assert.deepEqual(calls, ['welcome', 'game']);
    window.hidden();
    await Promise.resolve();
    assert.deepEqual(calls, ['welcome', 'game', 'diagnostics', 'warning']);
    console.log('Telegram starts before diagnostics, and a diagnostic failure does not stop the game.');
})().catch(error => { console.error(error); process.exitCode = 1; });

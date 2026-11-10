const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = name => fs.readFileSync('website/' + name, 'utf8');
const providers = [...read('index.html').matchAll(/<button data-provider="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(providers, ['vk', 'telegram', 'ok', 'site']);
assert.match(read('telegram-login-test.html'), /id="telegram-test-login"[^>]*data-provider="telegram"[^>]*disabled/);

async function checkProduction(available) {
    const location = {href: 'https://pripyat-game-site.ru/'};
    const buttons = providers.map(provider => ({
        dataset: {provider}, disabled: true,
        addEventListener(event, action) { this.click = action; },
    }));
    await vm.runInNewContext(read('login.js'), {
        URL, URLSearchParams, AbortSignal, location,
        document: {querySelectorAll: () => buttons, getElementById: () => null},
        fetch: async path => path === '/auth/status'
            ? {ok: true, json: async () => ({providers: {vk: true, ok: true, site: true}})}
            : {ok: available, json: async () => ({providers: {telegram: true}})},
    });
    for (const [index, route] of [[0, '/auth/vk/start'], [2, '/auth/ok/start'], [3, '/account/']]) {
        assert.equal(buttons[index].disabled, false);
        buttons[index].click();
        assert.equal(location.href, route);
        location.href = 'https://pripyat-game-site.ru/';
    }
    assert.equal(buttons[1].disabled, !available);
    if (available) {
        buttons[1].click();
        assert.equal(location.href, '/auth/telegram-prod/start');
    }
}

async function checkTest(allowed) {
    const button = {disabled: true, addEventListener(event, action) { this.click = action; }};
    const location = {hash: '#tg_test=fixture', pathname: '/telegram-login-test.html', search: ''};
    await vm.runInNewContext(read('telegram-login-test.js'), {
        URLSearchParams, location, history: {replaceState() {}},
        document: {getElementById: id => id === 'telegram-test-login' ? button : {}},
        fetch: async path => path === '/auth/telegram/status'
            ? {ok: true, json: async () => ({csrf: 'fixture'})} : {ok: allowed},
    });
    assert.equal(button.disabled, !allowed);
    if (allowed) {
        button.click();
        assert.equal(location.href, '/auth/telegram/start');
    }
}

Promise.all([checkProduction(true), checkProduction(false), checkTest(true), checkTest(false)])
    .catch(error => { console.error(error); process.exitCode = 1; });

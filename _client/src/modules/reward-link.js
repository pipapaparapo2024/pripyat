import { applyPatch } from './patch.js';

// 25.09.2026 (по прямому указанию) — сайт-генератор наградных ссылок (vk_game/сайт/,
// отдельный проект, деплоится на тот же сервер как /rewards-admin/) создаёт ссылки вида
// vk.com/app<id>?reward=CODE. index.js уже парсит ВСЕ query-параметры лаунч-ссылки в
// window.vk_params (не только vk_*, см. index.js:43-48) — значит vk_params['reward']
// содержит код, если игрок пришёл именно по такой ссылке.
//
// 25.09.2026, тем же днём (баг найден по прямому указанию — "перешёл по ссылке, награды
// нет"): проверено по логам живого сервера (nginx access.log — НИ ОДНОГО запроса за всё
// время с "reward=" в query; php_errors.log — ни одной записи Rewardlinks.claim) — запрос
// на index.html с этим query-параметром НИКОГДА не долетает до нашего сервера вообще.
// Причина — платформенное ограничение VK Mini Apps: VK сам строит iframe-адрес приложения,
// используя только свои стандартные vk_*/sign параметры, и не пробрасывает произвольные
// query-параметры из публичной ссылки vk.com/app<id>?... — они отбрасываются ДО того, как
// дойти до нашего index.html. Сайт-генератор (сайт/index.php) теперь строит ссылку как
// hash-фрагмент (#reward=CODE) — фрагмент после # никогда не уходит на сервер (чисто
// клиентская часть URL), поэтому VK его не режет. Старый query-параметр читаем ТОЖЕ (на
// случай если поведение VK когда-нибудь изменится, или у кого-то осталась ссылка в старом
// формате из уже отправленных приглашений) — hash проверяется первым, как основной путь.
//
// Вызывается из game-boot.js._finishLoading() — "как только загружается главное меню".
function _getRewardCode(){
    const hash = window.location.hash || '';
    const m = hash.match(/reward=([^&]+)/);
    if(m) return decodeURIComponent(m[1]);
    return (window.vk_params && vk_params['reward']) || null;
}

export function checkRewardLink(){
    const code = _getRewardCode();
    if(!code) return;

    console.log('[reward-link.checkRewardLink] найден код в лаунч-ссылке:', code);
    if(!window.TS){
        console.error('[reward-link.checkRewardLink] window.TS недоступен, запрос не отправлен');
        return;
    }

    TS.php('rewardlinks.claim', { code: code }, (res) => {
        console.log('[reward-link.checkRewardLink] ← ответ сервера:', JSON.stringify(res));
        if(!res) return;

        if(res.claimed === 1){
            if(res.patch) applyPatch(res.patch);
            const items = (res.summary || []).map(s => {
                if(s.kind === 'currency') return { type: s.field, amount: s.amount };
                if(s.kind === 'shmot')    return { type: 'shmot', amount: 1 };
                if(s.kind === 'key')      return { type: 'boss_keys', amount: s.amount };
                if(s.kind === 'habar')    return { type: 'habar', amount: 1 };
                return null;
            }).filter(Boolean);
            if(items.length && window.iface && typeof iface._showRewardPopup === 'function'){
                iface._showRewardPopup(items);
            }
        } else if(res.reason === 'expired'){
            console.log('[reward-link.checkRewardLink] ссылка истекла');
            if(window.iface && typeof iface._showRewardPopup === 'function'){
                iface._showRewardPopup(['Ты опоздал, братиш!', 'Приходи в следующий раз.']);
            }
        } else {
            // notfound/already — не по этой ссылке или уже получено раньше, молча ничего не
            // показываем, чтобы не путать игрока (например, при обычном обновлении страницы
            // с тем же query-параметром в истории браузера).
            console.log('[reward-link.checkRewardLink] награда не выдана, reason:', res.reason);
        }
    }, (err) => {
        console.error('[reward-link.checkRewardLink] ← ошибка сервера:', JSON.stringify(err));
    });
}

export function openDevLogs() {
    if (document.getElementById('dev-log-viewer')) return;
    const box = document.createElement('div'); box.id = 'dev-log-viewer';
    box.style.cssText = 'position:fixed;inset:5%;z-index:2147483647;background:#171717;color:#eee;padding:20px;overflow:auto;font:16px sans-serif;';
    const title = document.createElement('h3'); title.textContent = 'Серверные события (без исходных запросов и секретов)'; box.appendChild(title);
    const close = document.createElement('button'); close.textContent = 'Закрыть'; close.onclick = () => box.remove(); box.appendChild(close);
    const refresh = document.createElement('button'); refresh.textContent = 'Обновить'; box.appendChild(refresh);
    const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; box.appendChild(pre);
    const copy = document.createElement('button'); copy.textContent = 'Скопировать последние логи и ошибки'; box.appendChild(copy);
    const status = document.createElement('span'); box.appendChild(status);
    const clientLogs = () => (window.ok_payment_safe_history || []).map(row => JSON.stringify(row)).join('\n');
    copy.onclick = async () => {
        const text = pre.textContent + '\n\nДиагностика оплаты ОК:\n' + (clientLogs() || 'Нет событий в этой сессии');
        try { await navigator.clipboard.writeText(text); status.textContent = ' Скопировано'; }
        catch(e) {
            const field = document.createElement('textarea'); field.value = text; box.appendChild(field); field.select();
            try { status.textContent = document.execCommand('copy') ? ' Скопировано' : 'Выделите текст и скопируйте вручную'; }
            catch(e) { status.textContent = 'Выделите текст и скопируйте вручную'; }
        }
    };
    const load = () => {
        refresh.disabled = true; pre.textContent = 'Загрузка…';
        TS.php('users.devGetLogs', {}, (data) => {
            refresh.disabled = false;
            const names = {fatal:'Критическая ошибка PHP', warning:'Предупреждение PHP', parse:'Ошибка разбора PHP', notice:'Замечание PHP', 'ok-payment':'Платёж ОК', payment:'Платёж', request:'Запрос', authorization:'Авторизация'};
            const reasons = {database_error:'Ошибка базы данных',database_connections:'Лимит подключений к БД',connection_refused:'Соединение отклонено',database_column:'Неизвестная колонка БД',array_key:'Отсутствует ключ массива',undefined_function:'Не определена функция',undefined_object:'Вызов метода у отсутствующего объекта',type_error:'Несовместимый тип данных',missing_file:'Не найден PHP-файл',permission_denied:'Недостаточно прав',syntax_error:'Ошибка синтаксиса',signature_rejected:'Подпись отклонена'};
            pre.textContent = data && data.available ? (data.entries || []).map(row => `${row.time || '—'}  ${names[row.event] || 'Событие'}${Number.isInteger(row.code) ? ' — код ' + row.code : ''}${row.reason ? ' — ' + (reasons[row.reason] || 'Ошибка') : ''}${row.file ? ' (' + row.file + ':' + row.line + ')' : ''}`).join('\n') || 'Нет распознанных ошибок' : 'Лог пока недоступен';
        }, () => { refresh.disabled = false; pre.textContent = 'Доступ запрещён или соединение недоступно'; });
    };
    refresh.onclick = load; document.body.appendChild(box); load();
}

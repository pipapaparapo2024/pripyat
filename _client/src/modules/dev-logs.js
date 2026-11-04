export function openDevLogs() {
    if (document.getElementById('dev-log-viewer')) return;
    const box = document.createElement('div'); box.id = 'dev-log-viewer';
    box.style.cssText = 'position:fixed;inset:5%;z-index:2147483647;background:#171717;color:#eee;padding:20px;overflow:auto;font:16px sans-serif;';
    const title = document.createElement('h3'); title.textContent = 'Серверные события — новые сверху (без запросов и секретов)'; box.appendChild(title);
    const close = document.createElement('button'); close.textContent = 'Закрыть'; close.onclick = () => box.remove(); box.appendChild(close);
    const refresh = document.createElement('button'); refresh.textContent = 'Обновить'; box.appendChild(refresh);
    const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; box.appendChild(pre);
    const copy = document.createElement('button'); copy.textContent = 'Скопировать последние логи и ошибки'; box.appendChild(copy);
    const status = document.createElement('span'); box.appendChild(status);
    const clientLogs = () => (window.ok_payment_safe_history || []).map(row => {
        const stages={'buy-click':'Нажата покупка','launcher-payment':'Запрос в Launcher','launcher-result':'Launcher сообщил успех','callback':'Ответ SDK','sdk-check':'Проверка SDK','sdk-ready':'Готовность SDK','payment-call-failed':'Ошибка вызова'};
        const reasons={unsupported:'Метод недоступен в текущем Launcher',sdk_not_initialized:'SDK не инициализирован',cancelled:'Покупка отменена',invalid_params:'Отклонены параметры товара'};
        return `${row.time||'—'} ${stages[row.stage]||row.stage}${row.method?' | '+row.method:''}${Number.isInteger(row.item)?' | товар '+row.item:''}${Number.isFinite(row.price)?' | цена '+row.price+' ОК':''}${Number.isInteger(row.errorCode)?' | код '+row.errorCode:''}${row.reason?' | '+(reasons[row.reason]||row.reason)+' ('+row.reason+')':''}${row.category?' | '+row.category:''}`;
    }).join('\n');
    copy.onclick = async () => {
        const text = pre.textContent + '\n\nДиагностика оплаты ОК:\n' + (clientLogs() || 'Нет событий в этой сессии');
        try { await navigator.clipboard.writeText(text); status.textContent = ' Скопировано'; }
        catch(e) {
            const field = document.createElement('textarea'); field.value = text; box.appendChild(field); field.select();
            try { status.textContent = document.execCommand('copy') ? ' Скопировано' : 'Выделите текст и скопируйте вручную'; }
            catch(e) { status.textContent = 'Выделите текст и скопируйте вручную'; }
        }
    };
    const clientPanel=document.createElement('pre');clientPanel.style.whiteSpace='pre-wrap';box.appendChild(clientPanel);
    const renderClient=()=>{clientPanel.textContent='Диагностика оплаты ОК:\n'+(clientLogs()||'Нет событий. Откройте магазин и нажмите покупку.');};
    const load = () => {
        renderClient();
        refresh.disabled = true; pre.textContent = 'Загрузка…';
        TS.php('users.devGetLogs', {}, (data) => {
            refresh.disabled = false;
            const names = {fatal:'Критическая ошибка PHP', warning:'Предупреждение PHP', parse:'Ошибка разбора PHP', notice:'Замечание PHP', 'ok-payment':'Платёж ОК', payment:'Платёж', request:'Запрос', authorization:'Авторизация'};
            const reasons = {wrong_app:'Не совпал ID приложения',invalid_signature:'Неверная подпись уведомления',production_notifications_only:'Отклонён тестовый режим уведомления',developer_required:'Аккаунт не разрешён в закрытом запуске',price_mismatch:'Цена не совпала с каталогом',product_or_price_mismatch:'Товар или цена не совпали с каталогом',unknown_player:'Получатель не найден',transaction_conflict:'Конфликт повторной транзакции',temporarily_unavailable:'Уведомление не обработано сервером',account_mapping_missing:'Не найдена подтверждённая связь аккаунта ОК',database_error:'Ошибка базы данных',database_connections:'Лимит подключений к БД',connection_refused:'Соединение отклонено',database_column:'Неизвестная колонка БД',array_key:'Отсутствует ключ массива',undefined_function:'Не определена функция',undefined_object:'Вызов метода у отсутствующего объекта',type_error:'Несовместимый тип данных',missing_file:'Не найден PHP-файл',permission_denied:'Недостаточно прав',syntax_error:'Ошибка синтаксиса',signature_rejected:'Подпись отклонена'};
            pre.textContent = data && data.available ? (data.entries || []).slice().reverse().map(row => `${row.time || '—'}  ${names[row.event] || 'Событие'}${Number.isInteger(row.code) ? ' — код ' + row.code : ''}${row.reason ? ' — ' + (reasons[row.reason] || row.reason) : ''}${row.platform ? ' — ' + row.platform.toUpperCase() : ''}${row.stage ? ' — этап: '+({catalog:'товар получен',rejected:'отказ',credited:'награда выдана',duplicate:'повтор без начисления'}[row.stage]||row.stage) : ''}${row.mode ? ' — режим: '+row.mode : ''}${Number.isInteger(row.product) ? ' — товар: '+row.product : ''}${row.file ? ' (' + row.file + ':' + row.line + ')' : ''}`).join('\n') || 'Нет распознанных ошибок' : 'Лог пока недоступен';
        }, () => { refresh.disabled = false; pre.textContent = 'Доступ запрещён или соединение недоступно'; });
    };
    refresh.onclick = load; document.body.appendChild(box); load();
}

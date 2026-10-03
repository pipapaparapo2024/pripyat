<?php
	Class Security {

        private $registry;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->permits = ['getToken'];
        }

        function getToken(){
            $params_sign = $this->registry['user_params'];

            if(!isset($params_sign['sign']))return $this->registry['tools']->error(1);

            $sign = $params_sign['sign'];

            unset($params_sign['sign']);

            ksort($params_sign);

            $params_query = http_build_query($params_sign);

            $generate_sign = rtrim(strtr(base64_encode(hash_hmac('sha256', $params_query, $this->registry['api_secret'], true)), '+/', '-_'), '=');

            // Включено 17.09.2026 по прямому указанию, после проверки: preloader.js.initGame()
            // уже сейчас собирает ИМЕННО те vk_*-параметры + sign, которые реально приходят от
            // VK при открытии игры через vk.com/app54574178_438953352 (это стандартная схема
            // VK Mini Apps — подпись есть у ЛЮБОГО приложения с валидным app_id при открытии
            // через VK, независимо от статуса "опубликовано в каталоге"). api_id/api_secret в
            // registry.php — реальные, не заглушки. Без этой проверки любой мог прислать сюда
            // произвольный vk_user_id и получить настоящий токен на ЧУЖОЙ аккаунт — им же потом
            // читать/перезаписывать чужие данные через users.save (см. аудит безопасности).
            if($sign !== $generate_sign)return $this->registry['tools']->error(0);

            // 26.09.2026 (по прямому указанию — аудит перед модерацией VK, пункт "захват чужого
            // аккаунта"): проверка выше подтверждает только подлинность $params_sign (внутри
            // которого настоящий vk_user_id, подписанный VK) — но $registry['uid'] (тот, что
            // ниже пишется как id в таблицу secure и с этого момента управляет ЧЬИМ токеном это
            // будет) берётся из СОВЕРШЕННО ОТДЕЛЬНОГО поля $_POST['uid'] (universal.php:29),
            // которое подпись НИКАК не защищает. Игрок мог открыть игру честно (получить
            // подлинную подпись на СВОЙ vk_user_id), но отправить getToken с ЧУЖИМ значением
            // uid в отдельном POST-поле — сервер записал бы токен, который атакующий знает, на
            // чужой id, открывая полный доступ к чужому аккаунту. Сверяем оба значения — они
            // ВСЕГДА совпадают у честного клиента (TS.php шлёт uid=vk_params['vk_user_id'], см.
            // modules/server.js), несовпадение возможно только при ручной подделке запроса.
            $signedVkUserId = intval($this->registry['user_params']['vk_user_id'] ?? 0);
            $postedUid = intval($this->registry['uid']);
            if($signedVkUserId <= 0 || $signedVkUserId !== $postedUid){
                error_log('[security.getToken] код 7 (uid не совпадает с подписанным vk_user_id — попытка подмены/захвата чужого аккаунта) | postedUid=' . $postedUid . ' | signedVkUserId=' . $signedVkUserId);
                return $this->registry['tools']->error(7);
            }

            $my_token = md5($generate_sign.uniqid(rand(), true));

            // 26.09.2026 (по прямому репорту — "истекло время жизни токена" сразу после входа
            // в игру): раньше output() (отправка token клиенту) стояла ПЕРЕД saveData() —
            // клиент мог получить токен, который ещё физически не записан в таблицу secure
            // (узкое окно гонки с любым другим конкурентным запросом того же uid, включая
            // повторный/дублирующий getToken при быстрой перезагрузке — второй воркер PHP-FPM
            // мог обработать следующий запрос ДО того, как этот воркер успел дописать
            // time/lifetime/token в БД, и checkToken() на секунду видел ЛИБО старую строку
            // secure с уже истёкшим/чужим lifetime, ЛИБО ещё не до конца обновлённую). Теперь
            // сначала пишем в БД, потом отдаём токен клиенту — клиент не может использовать
            // токен раньше, чем сервер гарантированно готов его принять.
            $sec_array = array('time'=>time(),
                               'lifetime'=>2592000,
                               'vk_params'=>$this->registry['user_params'],
                               'token'=>$my_token,
                               'req_key'=>$this->registry['req_key'],
                               'id'=>$this->registry['uid']);

            $this->registry['udb']->saveData('secure', $sec_array);

            $this->registry['tools']->output(array('token'=>$my_token));
        }
	}

?>
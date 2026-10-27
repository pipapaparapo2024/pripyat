<?php
    // ── КОЛБЭК ПЛАТЕЖЕЙ ОК (FAPI.UI.showPayment) ── 05.10.2026, по прямому указанию:
    // "давай сделаем через FAPI UI Show Payment... посмотрим что скажет модерация".
    //
    // Поток (см. apiok.ru/dev/sdk/js/ui.showPayment, apiok.ru/dev/methods/rest/callbacks/
    // callbacks.payment): игрок жмёт "Купить" → клиент (modules/iap.js._startOkPurchase())
    // зовёт FAPI.UI.showPayment() → ОК сама показывает СВОЁ окно оплаты → игрок подтверждает →
    // ОК шлёт GET-запрос СЮДА (не POST, в отличие от VK webhook) → сервер проверяет подпись и
    // начисляет товар → отвечает ОК, что платёж принят.
    //
    // ⚠️ ОБЯЗАТЕЛЬНОЕ СЕРВЕРНОЕ ПОДТВЕРЖДЕНИЕ: без ответа ЭТОГО файла в формате, который ждёт
    // ОК, платёж у игрока НЕ завершится успешно — это прямо написано в документации ОК, тот же
    // принцип, что у webhook VK (server/universal_pay.php).
    //
    // Параметры запроса ОК (apiok.ru/dev/methods/rest/callbacks/callbacks.payment):
    //   uid, transaction_id, transaction_time, product_code, product_option, amount, currency,
    //   payment_system, extra_attributes, trial_days, card_promo, sig.
    // Подпись — ТОТ ЖЕ алгоритм, что у VK (universal_pay.php.checkSig()): отсортировать
    // параметры (кроме sig), склеить "key=value", дописать секрет приложения, md5.
    // Формат ответа — НЕ как у VK ({"response":...}/{"error":...}), а голое true при успехе и
    // {"error_code":N,"error_msg":"...","error_data":null} при отказе.
    //
    // 05.10.2026 (уточнение по прямому вопросу пользователя — "а можно найти application_secret_
    // key, если приложение запускается только через VK Mini Apps, отдельного кабинета ОК нет?"):
    // проверил apiok.ru/apps/vk дословно — "При запуске в Одноклассниках такие приложения
    // получат свой уникальный и отличный от ВКонтакте идентификатор [app_id другой]. Секретный
    // ключ остаётся идентичным приложению в ВКонтакте." То есть отдельного OK-секрета для
    // кросспостинг-приложений НЕ существует в принципе — используется ТОТ ЖЕ $registry['api_secret'],
    // что уже есть для VK-webhook (universal_pay.php). Отдельного кабинета ОК действительно нет —
    // и не нужен, это не "ключ ещё не получен", а "ключ уже есть, просто общий с VK".
    //
    // 05.10.2026: логика вынесена в класс OkPayCallback с чистыми методами (не читающими
    // $_GET/registry напрямую) — тот же приём, что уже применяется к Gameops-методам,
    // позволяет реально исполнять и проверять signature-check/item-каталог в тестах через
    // ReflectionMethod (см. tests/_php_fixtures/ok-pay-callback-core.php), а не только
    // проверять текст файла регуляркой.
    Class OkPayCallback {
        // Тот же каталог item→[поле,количество], что у VK (server/universal_pay.php.
        // loadResponses()) — платформо-независимый: что начислить не зависит от того, в какой
        // валюте заплатили. $prices — уже раскодированный donuts.json ($registry['json']->
        // get('donuts', true)).
        static function itemCatalog($prices){
            $types = [];

            for($i = 0; $i < count($prices['stew']['default']); $i++){
                $types[$i] = ['stew', intval($prices['stew']['default'][$i])];
            }
            $coinsOff = count($prices['stew']['default']);
            for($i = 0; $i < count($prices['coins']['default']); $i++){
                $types[$coinsOff + $i] = ['coins', intval($prices['coins']['default'][$i])];
            }
            $cigOff = $coinsOff + count($prices['coins']['default']);
            for($i = 0; $i < count($prices['cigarettes']['default']); $i++){
                $types[$cigOff + $i] = ['cigarettes', intval($prices['cigarettes']['default'][$i])];
            }

            $energyAmounts = [50, 110, 180, 400, 850, 1300, 2000, 3500];
            foreach($energyAmounts as $idx => $amount){
                $types[100 + $idx] = ['energy', $amount];
            }

            return $types;
        }

        // 26.10.2026 (ответ модерации ОК — "разработчик обязан проверять соответствие товара и
        // его цены, передаваемых в параметрах product_code и amount", apiok.ru/dev/methods/rest/
        // callbacks/callbacks.payment): та же индексация productCode, что у itemCatalog() выше
        // (ОБЯЗАНА совпадать с ней один-в-один — тот же порядок offset-ов), но вместо [поле,
        // количество] отдаёт ожидаемую цену в ОКах — тем же расчётом (price/7), что уже использует
        // universal_pay.php.loadResponses() для голосов ВК (см. докблок файла — тот же числовой
        // 'price', который get_item отдаёт площадке, одинаково трактуется и как голоса, и как ОКи).
        // Без этой проверки злоумышленник мог бы прислать поддельный amount на любой productCode.
        static function priceCatalog($prices){
            $donats = [];

            for($i = 0; $i < count($prices['stew']['default']); $i++){
                $donats[$i] = $prices['stew']['price'][$i] / 7;
            }
            $coinsOff = count($prices['stew']['default']);
            for($i = 0; $i < count($prices['coins']['default']); $i++){
                $donats[$coinsOff + $i] = $prices['coins']['price'][$i] / 7;
            }
            $cigOff = $coinsOff + count($prices['coins']['default']);
            for($i = 0; $i < count($prices['cigarettes']['default']); $i++){
                $donats[$cigOff + $i] = $prices['cigarettes']['price'][$i] / 7;
            }

            // Тот же порядок/значения голосов за энергию, что в universal_pay.php.loadResponses()
            // ($energy_items[*]['votes']) — держать синхронно при правке одного из двух файлов.
            $energyVotes = [3, 7, 10, 20, 40, 60, 85, 120];
            foreach($energyVotes as $idx => $votes){
                $donats[100 + $idx] = $votes;
            }

            return $donats;
        }

        // Допуск на расхождение между нашим расчётом ожидаемой цены (price/7, может быть дробным)
        // и целым amount, которое реально прислала площадка ОК — не точное сравнение float, но и
        // не "принять любую меньшую сумму". 1 ОК — минимальный допуск на округление в любую сторону.
        static function amountMatches($expected, $actualRaw){
            if(!is_numeric($actualRaw)) return false;
            return abs(floatval($expected) - floatval($actualRaw)) <= 1.0;
        }

        // Подпись ОК — отсортировать параметры (кроме sig), склеить "key=value", дописать
        // секрет, md5. $params — уже БЕЗ 'sig' (вызывающий код убирает его перед вызовом, тот
        // же порядок, что checkSig() в universal_pay.php).
        static function computeSig($paramsWithoutSig, $secret){
            $params = $paramsWithoutSig;
            ksort($params);
            $str = '';
            foreach($params as $k => $v) $str .= $k . '=' . $v;
            return md5($str . $secret);
        }

        static function checkSig($get, $secret){
            $params = $get;
            unset($params['sig']);
            $expected = self::computeSig($params, $secret);
            $got = $get['sig'] ?? '';
            if(!is_string($got) || $got === '' || $got !== $expected) return false;
            return true;
        }

        // Whitelist допустимых символов transaction_id — ОК отдаёт строку (не гарантированно
        // числовую), сырую конкатенацию в SQL не доверяем даже после проверки подписи (defense
        // in depth), тот же принцип, что safeParseJSON на клиенте.
        static function sanitizeTransactionId($raw){
            return preg_replace('/[^a-zA-Z0-9_\-]/', '', strval($raw));
        }

        // Префикс 'ok_' — та же таблица `trans`, что у VK-покупок (tid хранит VK order_id как
        // число), префикс исключает коллизию между числовыми VK order_id и ОК transaction_id.
        static function transKey($transactionId){
            return 'ok_' . $transactionId;
        }
    }

    // ── Исполняемая часть — только при прямом HTTP-запросе, не при include() из теста ──
    if(!defined('OK_PAY_CALLBACK_TEST_MODE')){
        ini_set('error_reporting', E_ALL);
        ini_set('display_errors', 0);
        ini_set('display_startup_errors', 0);
        ini_set('log_errors', 1);

        spl_autoload_register(function($class_name) {
            $file = 'core/models/'.strtolower($class_name).'.php';
            if(!file_exists($file)) return false;
            include($file);
        });

        // 09.10.2026 (отказ модерации ОК, п.5 — "платежи не работают"): Registry::__construct()
        // выбирает БД (stalker/stalker_ok) ТОЛЬКО по $_POST['platform'] (см. registry.php) —
        // этот параметр шлёт клиент (modules/server.js) с КАЖДЫМ обычным игровым запросом. Но
        // ЭТОТ файл дёргает не клиент, а сервер ОК напрямую голым GET-запросом (см. докблок
        // выше — "ОК шлёт GET-запрос СЮДА, не POST") — $_POST здесь всегда пуст, поэтому
        // Registry молча брала дефолтную 'stalker' (прод VK) для ЛЮБОГО игрока, в т.ч.
        // реального ОК-игрока, чей прогресс физически лежит в 'stalker_ok'. Итог: getData()
        // ниже не находил юзера в чужой БД → respondError('user not found') → ОК видел
        // неуспешный колбэк → платёж у игрока не завершался, хотя деньги списаны. Этот файл
        // ВСЕГДА обслуживает ТОЛЬКО платежи ОК (у VK свой отдельный webhook —
        // server/universal_pay.php) — поэтому платформа здесь не "угадывается", а жёстко
        // известна заранее.
        $_POST['platform'] = 'ok';
        $registry = new Registry;
        $registry['tools'] = new Tools($registry);
        $registry['udb']   = new Database($registry);
        $registry['json']  = new Jsonloader;

        header('Content-Type: application/json');

        error_log('[ok_pay_callback] ЗАПРОС | raw_get=' . json_encode($_GET));

        function respondOk(){
            // Голое true (не JSON-объект) — именно так требует документация ОК, в отличие от VK.
            echo 'true';
            exit;
        }
        function respondError($code, $msg){
            // 26.10.2026 (ответ модерации ОК — "В случае ошибки HTTP-заголовок 'Invocation-error'
            // должен содержать код ошибки", apiok.ru/dev/methods/rest/callbacks/callbacks.payment):
            // раньше код ошибки уходил ТОЛЬКО в JSON-тело, без этого заголовка — документация ОК
            // требует оба способа одновременно, не один вместо другого.
            header('Invocation-error: ' . $code);
            echo json_encode(['error_code' => $code, 'error_msg' => $msg, 'error_data' => null]);
            exit;
        }

        // Секрет кросспостинг-приложения ОК = секрет VK-приложения (см. докблок выше, дословная
        // цитата apiok.ru) — отдельного ok_api_secret не заводим, используем существующий.
        $secret = $registry['api_secret'];

        if(!OkPayCallback::checkSig($_GET, $secret)){
            error_log('[ok_pay_callback.checkSig] НЕ СОВПАЛО | getKeys=' . implode(',', array_keys($_GET)));
            respondError(1001, 'CALLBACK_INVALID_PAYMENT : invalid signature');
        }

        $uid = intval($_GET['uid'] ?? 0);
        $transactionIdRaw = strval($_GET['transaction_id'] ?? '');
        $transactionId = OkPayCallback::sanitizeTransactionId($transactionIdRaw);
        $productCode = intval($_GET['product_code'] ?? -1);

        if($uid <= 0 || $transactionId === ''){
            error_log('[ok_pay_callback] ОТКАЗ — некорректные uid/transaction_id | uid=' . $uid . ' | raw_tid=' . $transactionIdRaw);
            respondError(1001, 'CALLBACK_INVALID_PAYMENT : missing uid/transaction_id');
        }

        $prices = $registry['json']->get('donuts', true);
        $catalog = OkPayCallback::itemCatalog($prices);
        if(!isset($catalog[$productCode])){
            error_log('[ok_pay_callback] ОШИБКА — товар не найден | uid=' . $uid . ' | productCode=' . $productCode);
            respondError(1002, 'CALLBACK_INVALID_PAYMENT : unknown product ' . $productCode);
        }

        // 26.10.2026 (ответ модерации ОК, см. докблок OkPayCallback::priceCatalog() выше): без
        // этой проверки amount из запроса вообще не читался — начисление зависело ТОЛЬКО от
        // productCode, то есть кто угодно мог прислать настоящий подписанный колбэк с заниженным
        // amount за дорогой товар (сервер всё равно начислил бы полный товар).
        $priceCatalog = OkPayCallback::priceCatalog($prices);
        $expectedAmount = $priceCatalog[$productCode] ?? null;
        $actualAmount = $_GET['amount'] ?? null;
        if($expectedAmount === null || !OkPayCallback::amountMatches($expectedAmount, $actualAmount)){
            error_log('[ok_pay_callback] ОТКАЗ — amount не совпадает с ценой товара | uid=' . $uid
                . ' | productCode=' . $productCode . ' | expected=' . json_encode($expectedAmount) . ' | got=' . json_encode($actualAmount));
            respondError(1003, 'CALLBACK_INVALID_PAYMENT : amount mismatch for product ' . $productCode);
        }

        $tid = OkPayCallback::transKey($transactionId);
        $transaction = $registry['udb']->getData('trans', ['*'], "tid='" . $tid . "'");
        if(!isset($transaction['error'])){
            error_log('[ok_pay_callback] transaction_id уже обработан ранее (идемпотентность) | uid=' . $uid . ' | tid=' . $tid);
            respondOk();
        }

        $user = $registry['udb']->getData($registry['utb'], ['*'], 'id=' . $uid);
        if(isset($user['error']) && $user['error']){
            error_log('[ok_pay_callback] ОТКАЗ — игрока нет в БД, начислять некуда | uid=' . $uid . ' | tid=' . $tid);
            respondError(2, 'CALLBACK_INVALID_PAYMENT : user not found');
        }

        [$field, $count] = $catalog[$productCode];
        $before = $user[$field] ?? null;
        $user[$field] = $registry['tools']->summ($user[$field], $count);

        error_log('[ok_pay_callback] НАЧИСЛЯЮ | uid=' . $uid . ' | tid=' . $tid . ' | productCode=' . $productCode
            . ' | field=' . $field . ' | count=' . $count . ' | before=' . json_encode($before) . ' | after=' . json_encode($user[$field]));
        $saveRes  = $registry['udb']->saveData($registry['utb'], $user);
        $transRes = $registry['udb']->saveData('trans', ['uid' => $uid, 'time' => time(), 'tid' => $tid, 'count' => $count]);
        error_log('[ok_pay_callback] СОХРАНЕНО | uid=' . $uid . ' | tid=' . $tid . ' | saveUserResult=' . json_encode($saveRes) . ' | saveTransResult=' . json_encode($transRes));

        respondOk();
    }
?>

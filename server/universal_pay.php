<?php
    ini_set('error_reporting', E_ALL);
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    ini_set('log_errors', 1);
    
    spl_autoload_register(function($class_name) {
        $file = 'core/models/'.strtolower($class_name).'.php';
        if(!file_exists($file))return false;

        include ($file);
    });

    $registry = new Registry;

    $registry['tools'] = new Tools($registry);
    $registry['udb'] = new Database($registry);
    $registry['json'] = new Jsonloader;
    $registry['db_sampler'] = new SampleLoader;

    $registry['prices'] = $registry['json']->get('donuts', true);

    // xuliki.top — старый (сменившийся 14.09.2026) хостинг, домен полностью недоступен
    // (curl -> HTTP 000). VK не мог загрузить photo_url для карточки товара при оплате —
    // отсюда пустая "заглушка" вместо иконки в попапе покупки. Актуальный домен — pripyat-game.ru.
    //
    // 27.09.2026 (репорт — "иконка в попапе покупки тушёнки не та"): tcoin.jpg/rubles.jpg/
    // semki.jpg — старые generic-заглушки (банка с закрытой крышкой, пачка денег, семечка),
    // никак не связанные с актуальным артом игры и не обновлявшиеся при смене стиля HUD.
    // Заменены на donate_*_icon.png — те же изображения, что используются в ачивках
    // (achievements/тушенка.png, рубли.png, сиги.png), визуально совпадают с
    // interface_up_panel_*_icon.png в HUD.
    $registry['links'] = array('stew'=>'https://pripyat-game.ru/server/images/donate_stew_icon.png',
                               'coins'=>'https://pripyat-game.ru/server/images/donate_coins_icon.png',
                               'cigarettes'=>'https://pripyat-game.ru/server/images/donate_cigarettes_icon.png',
                               'energy'=>'https://pripyat-game.ru/server/images/donate_energy_icon.png');

    $registry['uid'] = intval($_POST['user_id'] ?? 0);

    // 26.09.2026 (по прямому указанию — "залогируй весь платёжный процесс", репорт "платежи не
    // работают"): у этого файла раньше не было НИ ОДНОГО error_log() — при сбое реальной оплаты
    // расследовать было буквально не по чему. Первая строка лога — весь входящий POST от VK
    // (кроме sig, он и так сверяется отдельно ниже) на КАЖДЫЙ запрос, независимо от исхода.
    error_log('[universal_pay] ЗАПРОС | uid=' . $registry['uid'] . ' | notification_type=' . strval($_POST['notification_type'] ?? '?')
        . ' | item=' . strval($_POST['item'] ?? '?') . ' | order_id=' . strval($_POST['order_id'] ?? '?')
        . ' | item_id=' . strval($_POST['item_id'] ?? '?') . ' | status=' . strval($_POST['status'] ?? '?')
        . ' | raw_post=' . json_encode($_POST));

    start();

    function start(){
        global $registry;

        if(!checkSig()){
            error_log('[universal_pay.start] ОТКАЗ — несовпадение подписи (invalid sig) | uid=' . $registry['uid']);
            return echoResult(array('error_code' => 10, 'error_msg' => 'Несовпадение вычисленной и переданной подписи запроса.', 'critical' => true), 'error'); //invalid sig
        }

        $user = $registry['udb']->getData($registry['utb'], array('*'), 'id='.$registry['uid']); //это нужно на всех операциях, лишним не будет!
        if(isset($user['error']) && $user['error']){
            error_log('[universal_pay.start] игрок не найден в БД | uid=' . $registry['uid'] . ' | user=' . json_encode($user));
        }

        $item = $_POST['item'];

        loadResponses();

        error_log('[universal_pay.start] подпись верна, обрабатываю | uid=' . $registry['uid'] . ' | notification_type=' . strval($_POST['notification_type'] ?? '?'));

        switch($_POST['notification_type']){
            // Тестовые кейсы (для режима разработки в VK)
            case 'get_item_test':
                $item = intval(explode('item', $item)[1]);
                if(!isset($registry['resps'][$item])){
                    error_log('[universal_pay.get_item_test] ОШИБКА — товар не найден | uid=' . $registry['uid'] . ' | item=' . $item);
                    return echoResult(array('error_code'=>5,'error_msg'=>'Item '.$item.' not found','critical'=>false), 'error');
                }
                error_log('[universal_pay.get_item_test] OK | uid=' . $registry['uid'] . ' | item=' . $item . ' | resp=' . json_encode($registry['resps'][$item]));
                return echoResult($registry['resps'][$item], 'response');
            break;

            case 'order_status_change_test':
                if($_POST['status'] !== 'chargeable'){
                    error_log('[universal_pay.order_status_change_test] ОШИБКА — status не chargeable | uid=' . $registry['uid'] . ' | status=' . strval($_POST['status'] ?? '?'));
                    return echoResult(array('error_code' => 100, 'error_msg' => 'Передано непонятно что вместо chargeable.', 'critical' => true), 'error');
                }

                $order_id = intval($_POST['order_id']);
                // 26.09.2026 (КРИТИЧЕСКИЙ репорт — "платёж проходит, награда не начисляется"):
                // item_id приходит от VK как "item107", не "107" — intval() на такой строке
                // всегда даёт 0 (PHP останавливается на первом нечисловом символе), а item_id=0
                // это первая пачка тушёнки. Из-за этого ЛЮБАЯ покупка тихо превращалась в
                // "начислить 4 тушёнки", независимо от реально купленного товара — подтверждено
                // живыми логами (item107/item15/item7/item106 — везде item=0). Тот же приём,
                // что уже использует get_item выше (explode('item', ...)), но устойчивый и к
                // формату БЕЗ префикса (на случай, если prod и test отличаются форматом).
                $itemIdParts = explode('item', strval($_POST['item_id'] ?? ''));
                $item = intval(end($itemIdParts));

                if(!isset($registry['types'][$item])){
                    error_log('[universal_pay.order_status_change_test] ОШИБКА — товар не найден | uid=' . $registry['uid'] . ' | item=' . $item . ' | order_id=' . $order_id);
                    return echoResult(array('error_code'=>5,'error_msg'=>'Item '.$item.' not found','critical'=>false), 'error');
                }

                $transaction = $registry['udb']->getData('trans', array('*'), 'tid='.$order_id);
                if(!isset($transaction['error'])){
                    error_log('[universal_pay.order_status_change_test] order_id уже обработан ранее (идемпотентность) | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | existing=' . json_encode($transaction));
                    return echoResult(array('order_id' => $order_id), 'response');
                }

                // 27.09.2026: игрока может не быть в БД (первый запуск/битый uid) — тогда
                // getData() вернул array('error'=>true), а не строку. Раньше код всё равно шёл
                // дальше и пытался сохранить эту заглушку как строку users, вписывая в БД
                // несуществующую колонку `error` — запрос падал, начисление терялось молча.
                if(isset($user['error']) && $user['error']){
                    error_log('[universal_pay.order_status_change_test] ОТКАЗ — игрока нет в БД, начислять некуда | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | item=' . $item);
                    return echoResult(array('error_code'=>2,'error_msg'=>'User not found','critical'=>false), 'error');
                }

                $count = $registry['types'][$item][1];
                $val = $registry['types'][$item][0];

                $before = $user[$val] ?? null;
                $user[$val] = $registry['tools']->summ($user[$val], $count);

                // 27.09.2026 (КРИТИЧЕСКИЙ репорт — "покупка валюты не начисляет валюту: ачивка по
                // трате голосов считается, а рубли не добавляются"): votes_spent (счётчик для
                // достижения «Потратить голосов») раньше считал КЛИЕНТ в bank.js.successDonat() и
                // тут же дёргал achievements._checkAll() → flushPlayerSave() → users.save с полным
                // снимком udata, в котором coins/stew/cigarettes были ещё СТАРЫЕ. Этот сейв
                // прилетал на сервер практически одновременно с этим вебхуком и затирал только что
                // начисленную валюту обратно. Теперь оба счётчика — и валюта, и потраченные голоса —
                // пишутся ЗДЕСЬ, одной и той же записью в БД: клиенту на покупке вообще нечего
                // сохранять, гонки не существует. Цена товара в голосах уже посчитана в
                // loadResponses() ($registry['donats']) — тот же массив, что уходит в таблицу trans.
                $votes = intval($registry['donats'][$item] ?? 0);
                $votesBefore = $user['votes_spent'] ?? null;
                if($votes > 0) $user['votes_spent'] = $registry['tools']->summ($user['votes_spent'] ?? 0, $votes);

                error_log('[universal_pay.order_status_change_test] НАЧИСЛЯЮ | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | item=' . $item . ' | field=' . $val . ' | count=' . $count . ' | before=' . json_encode($before) . ' | after=' . json_encode($user[$val]) . ' | votes=' . $votes . ' | votes_spent before=' . json_encode($votesBefore) . ' after=' . json_encode($user['votes_spent'] ?? null));
                $saveRes = $registry['udb']->saveData($registry['utb'], $user);
                $transRes = $registry['udb']->saveData('trans', array('uid'=>$registry['uid'], 'time'=>time(), 'tid'=>$order_id, 'count'=>$registry['donats'][$item]));
                error_log('[universal_pay.order_status_change_test] СОХРАНЕНО | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | saveUserResult=' . json_encode($saveRes) . ' | saveTransResult=' . json_encode($transRes));

                return echoResult(array('order_id' => $order_id), 'response');
            break;

            // Продакшн-кейсы (реальные покупки пользователей)
            case 'get_item':
                $item = intval(explode('item', $item)[1]);
                if(!isset($registry['resps'][$item])){
                    error_log('[universal_pay.get_item] ОШИБКА — товар не найден | uid=' . $registry['uid'] . ' | item=' . $item);
                    return echoResult(array('error_code'=>5,'error_msg'=>'Item '.$item.' not found','critical'=>false), 'error');
                }
                error_log('[universal_pay.get_item] OK | uid=' . $registry['uid'] . ' | item=' . $item . ' | resp=' . json_encode($registry['resps'][$item]));
                return echoResult($registry['resps'][$item], 'response');
            break;

            case 'order_status_change':
                if($_POST['status'] !== 'chargeable'){
                    error_log('[universal_pay.order_status_change] ОШИБКА — status не chargeable | uid=' . $registry['uid'] . ' | status=' . strval($_POST['status'] ?? '?'));
                    return echoResult(array('error_code' => 100, 'error_msg' => 'Передано непонятно что вместо chargeable.', 'critical' => true), 'error');
                }

                $order_id = intval($_POST['order_id']);
                // 26.09.2026 (КРИТИЧЕСКИЙ репорт — "платёж проходит, награда не начисляется"):
                // item_id приходит от VK как "item107", не "107" — intval() на такой строке
                // всегда даёт 0 (PHP останавливается на первом нечисловом символе), а item_id=0
                // это первая пачка тушёнки. Из-за этого ЛЮБАЯ покупка тихо превращалась в
                // "начислить 4 тушёнки", независимо от реально купленного товара — подтверждено
                // живыми логами (item107/item15/item7/item106 — везде item=0). Тот же приём,
                // что уже использует get_item выше (explode('item', ...)), но устойчивый и к
                // формату БЕЗ префикса (на случай, если prod и test отличаются форматом).
                $itemIdParts = explode('item', strval($_POST['item_id'] ?? ''));
                $item = intval(end($itemIdParts));

                if(!isset($registry['types'][$item])){
                    error_log('[universal_pay.order_status_change] ОШИБКА — товар не найден | uid=' . $registry['uid'] . ' | item=' . $item . ' | order_id=' . $order_id);
                    return echoResult(array('error_code'=>5,'error_msg'=>'Item '.$item.' not found','critical'=>false), 'error');
                }

                $transaction = $registry['udb']->getData('trans', array('*'), 'tid='.$order_id);
                if(!isset($transaction['error'])){
                    error_log('[universal_pay.order_status_change] order_id уже обработан ранее (идемпотентность) | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | existing=' . json_encode($transaction));
                    return echoResult(array('order_id' => $order_id), 'response');
                }

                // 27.09.2026: игрока может не быть в БД (первый запуск/битый uid) — тогда
                // getData() вернул array('error'=>true), а не строку. Раньше код всё равно шёл
                // дальше и пытался сохранить эту заглушку как строку users, вписывая в БД
                // несуществующую колонку `error` — запрос падал, начисление терялось молча.
                if(isset($user['error']) && $user['error']){
                    error_log('[universal_pay.order_status_change] ОТКАЗ — игрока нет в БД, начислять некуда | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | item=' . $item);
                    return echoResult(array('error_code'=>2,'error_msg'=>'User not found','critical'=>false), 'error');
                }

                $count = $registry['types'][$item][1];
                $val = $registry['types'][$item][0];

                $before = $user[$val] ?? null;
                $user[$val] = $registry['tools']->summ($user[$val], $count);

                // 27.09.2026 (КРИТИЧЕСКИЙ репорт — "покупка валюты не начисляет валюту: ачивка по
                // трате голосов считается, а рубли не добавляются"): votes_spent (счётчик для
                // достижения «Потратить голосов») раньше считал КЛИЕНТ в bank.js.successDonat() и
                // тут же дёргал achievements._checkAll() → flushPlayerSave() → users.save с полным
                // снимком udata, в котором coins/stew/cigarettes были ещё СТАРЫЕ. Этот сейв
                // прилетал на сервер практически одновременно с этим вебхуком и затирал только что
                // начисленную валюту обратно. Теперь оба счётчика — и валюта, и потраченные голоса —
                // пишутся ЗДЕСЬ, одной и той же записью в БД: клиенту на покупке вообще нечего
                // сохранять, гонки не существует. Цена товара в голосах уже посчитана в
                // loadResponses() ($registry['donats']) — тот же массив, что уходит в таблицу trans.
                $votes = intval($registry['donats'][$item] ?? 0);
                $votesBefore = $user['votes_spent'] ?? null;
                if($votes > 0) $user['votes_spent'] = $registry['tools']->summ($user['votes_spent'] ?? 0, $votes);

                error_log('[universal_pay.order_status_change] НАЧИСЛЯЮ (реальная покупка) | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | item=' . $item . ' | field=' . $val . ' | count=' . $count . ' | before=' . json_encode($before) . ' | after=' . json_encode($user[$val]) . ' | votes=' . $votes . ' | votes_spent before=' . json_encode($votesBefore) . ' after=' . json_encode($user['votes_spent'] ?? null));
                $saveRes = $registry['udb']->saveData($registry['utb'], $user);
                $transRes = $registry['udb']->saveData('trans', array('uid'=>$registry['uid'], 'time'=>time(), 'tid'=>$order_id, 'count'=>$registry['donats'][$item]));
                error_log('[universal_pay.order_status_change] СОХРАНЕНО | uid=' . $registry['uid'] . ' | order_id=' . $order_id . ' | saveUserResult=' . json_encode($saveRes) . ' | saveTransResult=' . json_encode($transRes));

                return echoResult(array('order_id' => $order_id), 'response');
            break;

            default:
                error_log('[universal_pay.start] неизвестный notification_type | uid=' . $registry['uid'] . ' | notification_type=' . strval($_POST['notification_type'] ?? '?'));
            break;
        }
    }

    function checkSig(){
        global $registry;

        // Проверка подписи 
        $sig = $_POST['sig'] ?? ''; 
        unset($_POST['sig']); 
        ksort($_POST); 
        $str = ''; 
        foreach($_POST as $k => $v)$str .= $k.'='.$v;

        $expected = md5($str.$registry['api_secret']);
        if($sig != $expected){
            // Не логируем api_secret и сам $str целиком (содержит все параметры запроса) —
            // только длины и первые символы обеих подписей, этого достаточно, чтобы отличить
            // "подпись вообще не пришла" от "пришла, но не совпала" (например из-за смены
            // порядка полей на стороне VK), не раскрывая секрет в логе.
            error_log('[universal_pay.checkSig] НЕ СОВПАЛО | uid=' . $registry['uid']
                . ' | got=' . substr(strval($sig ?? ''), 0, 8) . '… (len=' . strlen(strval($sig ?? '')) . ')'
                . ' | expected=' . substr($expected, 0, 8) . '… | postKeys=' . implode(',', array_keys($_POST)));
            return false;
        }

        return true;
    }

    function loadResponses(){
        global $registry;

        $resps = [];
        $types = [];
        $donats = [];

        for($i = 0; $i < count($registry['prices']['stew']['price']); $i++){
            $count = $registry['prices']['stew']['default'][$i];

            $resps[$i] = array('item_id' => $i, 'title' => $count.' '.numberEnd($count, 'stew'), 'photo_url' => $registry['links']['stew'], 'price' => $registry['prices']['stew']['price'][$i]/7);

            $types[$i] = array('stew', $count);

            $donats[$i] = $registry['prices']['stew']['price'][$i]/7;
        }

        $coins_dif = count($registry['prices']['stew']['price']);

        for($i = $coins_dif; $i < count($registry['prices']['coins']['price'])+$coins_dif; $i++){
            $count = $registry['prices']['coins']['default'][$i-$coins_dif];

            $resps[$i] = array('item_id' => $i, 'title' => $count.' '.numberEnd($count, 'coins'), 'photo_url' => $registry['links']['coins'], 'price' => $registry['prices']['coins']['price'][$i-$coins_dif]/7);

            $types[$i] = array('coins', $count);

            $donats[$i] = $registry['prices']['coins']['price'][$i-$coins_dif]/7;
        }

        $cigarettes_dif = count($registry['prices']['coins']['price'])+$coins_dif;

        for($i = $cigarettes_dif; $i < count($registry['prices']['cigarettes']['price'])+$cigarettes_dif; $i++){
            $count = $registry['prices']['cigarettes']['default'][$i-$cigarettes_dif];

            $resps[$i] = array('item_id' => $i, 'title' => $count.' '.numberEnd($count, 'cigarettes'), 'photo_url' => $registry['links']['cigarettes'], 'price' => $registry['prices']['cigarettes']['price'][$i-$cigarettes_dif]/7);

            $types[$i] = array('cigarettes', $count);

            $donats[$i] = $registry['prices']['cigarettes']['price'][$i-$cigarettes_dif]/7;
        }

        // Энергия — item100..item107 (встроенный магазин из FLA)
        $energy_items = [
            // 30.09.2026 (модерация VK, п.5 — "цены не совпадают"): было 7, картинка slot_1.png
            // (нарисованная художником, не текст) показывает "3" — расхождение с реально
            // списываемой суммой было именно тут, остальные 7 пакетов уже совпадали 1-в-1.
            ['votes'=>3,  'energy'=>50  ],
            ['votes'=>7,  'energy'=>110 ],
            ['votes'=>10, 'energy'=>180 ],
            ['votes'=>20, 'energy'=>400 ],
            ['votes'=>40, 'energy'=>850 ],
            ['votes'=>60, 'energy'=>1300],
            ['votes'=>85, 'energy'=>2000],
            ['votes'=>120,'energy'=>3500],
        ];
        foreach($energy_items as $idx => $ep){
            $id = 100 + $idx;
            $resps[$id] = array(
                'item_id'   => $id,
                'title'     => $ep['energy'].' энергии',
                // 27.09.2026: энергия оставалась на старой generic-заглушке rubles.jpg (пачка
                // денег) — в попапе оплаты энергии VK показывал иконку рублей. Тот же источник
                // арта, что и у остальных трёх (иконки ачивок), файл — server/images/.
                'photo_url' => $registry['links']['energy'],
                'price'     => $ep['votes'],
            );
            $types[$id]  = array('energy', $ep['energy']);
            $donats[$id] = $ep['votes'];
        }

        $registry['resps'] = $resps;
        $registry['types'] = $types;
        $registry['donats'] = $donats;
    }

    function echoResult($data, $type){
        echo json_encode(array($type=>$data));
    }

    function numberEnd($n, $mode){
        $_names = array("stew" => ['тушенка', 'тушенки', 'тушенок'],
                        "coins" => ['монета', 'монету', 'монет'],
                        "cigarettes" => ['сига', 'сигу', 'сиг']);
        $s = '';
        $s0 = strval($n);
        $arr = str_split($s0);//бъем число на массив
        if((($arr[count($arr)-1] == 2)||($arr[count($arr)-1] == 3)||($arr[count($arr)-1] == 4))&&($n!==0)&&($n!==12)&&($n!==13)&&($n!==14)){
            $s = $_names[$mode][1];//задаем значение строке
        }else if($arr[count($arr)-1] == 1 && $n!==11){
            $s = $_names[$mode][0];
        }else{
            $s = $_names[$mode][2];
        }
        return $s;//выводим строку
    }
?> 
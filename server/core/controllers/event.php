<?php
Class Event {
    private $registry;
    // Администрирование события разрешено только известным тестовым/админским аккаунтам.
    // Статический пароль в запросе нельзя использовать: он неизбежно попадает в исходники.
    const ADMIN_UIDS = [1113977365, 382448269];
    const EVENT_DURATION = 10800; // 3 часа в секундах

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->permits = ['get', 'save', 'activate', 'deactivate'];
    }

    private function _requireAdmin(){
        if(in_array(intval($this->registry['uid']), self::ADMIN_UIDS, true)) return true;
        $this->registry['tools']->error(403);
        return false;
    }

    // Получить статус события (вызывается клиентом при входе)
    function get(){
        $link = new mysqli(
            $this->registry['server'], $this->registry['user'],
            $this->registry['pass'], $this->registry['db'], 3306
        );
        if($link->connect_error) return $this->registry['tools']->error(99);
        $link->set_charset('utf8mb4');

        $settings = $this->_getSettings($link);
        $active = $settings['event_active'] === '1';
        $ends_at = intval($settings['event_ends_at']);

        // Автозавершение если время вышло
        if($active && $ends_at > 0 && time() > $ends_at){
            $link->query("UPDATE `event_settings` SET `value`='0' WHERE `key`='event_active'");
            $active = false;
        }

        $result = [
            'active'   => $active,
            'event_id' => $settings['event_id'],
            'ends_at'  => $ends_at,
        ];

        // Если событие активно — добавляем данные игрока по попыткам
        if($active){
            $uid = $this->registry['uid'];
            $user = $this->registry['udb']->getData($this->registry['utb'], ['natisk_event_id','natisk_free_attempts','natisk_paid_attempts','natisk_kills'], 'id='.$uid);
            if(!isset($user['error'])){
                // Если новое событие — сбросить попытки
                if($user['natisk_event_id'] !== $settings['event_id']){
                    $link->query("UPDATE `{$this->registry['utb']}` SET
                        `natisk_event_id`='".mysqli_real_escape_string($link,$settings['event_id'])."',
                        `natisk_free_attempts`=3,
                        `natisk_paid_attempts`=3,
                        `natisk_kills`=0
                        WHERE `id`=$uid");
                    $result['free_attempts']  = 3;
                    $result['paid_attempts']  = 3;
                    $result['kills']          = 0;
                } else {
                    $result['free_attempts']  = intval($user['natisk_free_attempts']);
                    $result['paid_attempts']  = intval($user['natisk_paid_attempts']);
                    $result['kills']          = intval($user['natisk_kills']);
                }
            }
        }

        $link->close();
        $this->registry['tools']->output($result);
    }

    // Потратить попытку + сохранить килы
    function save(){
        $params = $this->registry['user_params'];
        $uid = $this->registry['uid'];
        $kills = intval($params['kills'] ?? 0);
        $use_paid = isset($params['use_paid']) && $params['use_paid'];

        $link = new mysqli(
            $this->registry['server'], $this->registry['user'],
            $this->registry['pass'], $this->registry['db'], 3306
        );
        if($link->connect_error) return $this->registry['tools']->error(99);
        $link->set_charset('utf8mb4');

        $settings = $this->_getSettings($link);
        $user = $this->registry['udb']->getData($this->registry['utb'],
            ['natisk_event_id','natisk_free_attempts','natisk_paid_attempts','natisk_kills','stew'],
            'id='.$uid);

        if(isset($user['error'])) { $link->close(); return $this->registry['tools']->error(99); }

        // Проверка что событие активно и event_id совпадает
        if($settings['event_active'] !== '1' || $user['natisk_event_id'] !== $settings['event_id']){
            $link->close();
            return $this->registry['tools']->error(44);
        }

        $free = intval($user['natisk_free_attempts']);
        $paid = intval($user['natisk_paid_attempts']);

        if($use_paid){
            if($paid <= 0){ $link->close(); return $this->registry['tools']->error(45); }
            // Цена: 3я попытка=3, 2я=5, 1я=7 тушёнки
            $price = [7,5,3][$paid - 1] ?? 3;
            $stew = intval($user['stew']);
            if($stew < $price){ $link->close(); return $this->registry['tools']->error(46); }
            $link->query("UPDATE `{$this->registry['utb']}` SET
                `natisk_paid_attempts`=$paid-1,
                `natisk_kills`=$kills,
                `stew`=$stew-$price
                WHERE `id`=$uid");
        } else {
            if($free <= 0){ $link->close(); return $this->registry['tools']->error(45); }
            $link->query("UPDATE `{$this->registry['utb']}` SET
                `natisk_free_attempts`=$free-1,
                `natisk_kills`=$kills
                WHERE `id`=$uid");
        }

        $link->close();
        $this->registry['tools']->output(['ok'=>true]);
    }

    // Активировать событие (только admin)
    function activate(){
        if(!$this->_requireAdmin()) return;

        $link = new mysqli(
            $this->registry['server'], $this->registry['user'],
            $this->registry['pass'], $this->registry['db'], 3306
        );
        if($link->connect_error) return $this->registry['tools']->error(99);
        $link->set_charset('utf8mb4');

        $event_id = 'ev_' . time();
        $ends_at  = time() + self::EVENT_DURATION;

        $link->query("UPDATE `event_settings` SET `value`='1'        WHERE `key`='event_active'");
        $link->query("UPDATE `event_settings` SET `value`='$event_id' WHERE `key`='event_id'");
        $link->query("UPDATE `event_settings` SET `value`='$ends_at'  WHERE `key`='event_ends_at'");

        $link->close();
        $this->registry['tools']->output(['ok'=>true,'event_id'=>$event_id,'ends_at'=>$ends_at]);
    }

    // Деактивировать событие (только admin)
    function deactivate(){
        if(!$this->_requireAdmin()) return;

        $link = new mysqli(
            $this->registry['server'], $this->registry['user'],
            $this->registry['pass'], $this->registry['db'], 3306
        );
        if($link->connect_error) return $this->registry['tools']->error(99);
        $link->set_charset('utf8mb4');

        $link->query("UPDATE `event_settings` SET `value`='0' WHERE `key`='event_active'");
        $link->close();
        $this->registry['tools']->output(['ok'=>true]);
    }

    private function _getSettings($link){
        $res = $link->query("SELECT `key`,`value` FROM `event_settings`");
        $out = ['event_active'=>'0','event_id'=>'','event_ends_at'=>'0'];
        if($res) while($row = $res->fetch_assoc()) $out[$row['key']] = $row['value'];
        return $out;
    }
}

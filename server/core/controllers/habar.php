<?php
Class Habar {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['buy', 'collectDay'];
    }

    function buy(){
        $idx = intval($this->registry['user_params']['container_id'] ?? -1);
        $cats = $this->ops->catalog('habar_containers');
        if(!isset($cats[$idx])) return $this->ops->fail(51);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        // Один хабар в одни руки
        if($this->ops->i($user, 'habar_bought') > 0) return $this->ops->fail(56);

        $con = $cats[$idx];
        $type = $con['price']['type'];
        $cur = $type === 'cig' ? 'cigarettes' : $type;
        $price = intval($con['price']['amount']);
        if(!$this->ops->deduct($user, $cur, $price)) return $this->ops->fail(50);
        // 24.09.2026 (перенос экономики хабара на сервер, по прямому указанию): раньше клиент
        // сам инкрементировал stew_spent (habar.js._buyAndOpen()) — статистика трат нужна
        // достижениям 'spend_stew' (см. achievements.js). Сервер теперь считает её сам, той же
        // формулой, для той же валюты, что реально списана.
        if($cur === 'stew') $user['stew_spent'] = $this->ops->i($user, 'stew_spent') + $price;

        $counts = $this->ops->j($user, 'habar_counts', [0,0,0,0]);
        while(count($counts) < 4) $counts[] = 0;
        $counts[$idx] = intval($counts[$idx]) + 1;
        $user['habar_counts'] = json_encode($counts);
        $user['habar_bought'] = $idx + 1;

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $patch = $this->ops->patchCurrencies($user, ['stew', 'stew_spent', 'habar_counts', 'habar_bought']);
        $this->ops->ok(['patch' => $patch]);
    }

    // 28.09.2026 (аудит по прямому указанию, найдено при проверке жалобы "хабар не выдаёт
    // поинты"): server-only метод open() + _roll() ниже УДАЛЕНЫ — client-side habar.js никогда
    // не вызывает permit 'open' (только 'buy' и 'collectDay', см. habar.js._buyAndOpen()/
    // _collectDay()), это был полностью недостижимый код с собственной, ни с чем не
    // синхронизированной таблицей наград (habar_containers.json.loot_pool — тушёнка/аптечка/
    // рубли, без единого поинта), что и вызывало путаницу при разборе жалобы. Реальная и
    // единственная выдача награды хабара — collectDay() ниже, по habar_daily_config.json.
    // habar_containers.json оставлен (используется buy() для цены каждого тира), но поле
    // loot_pool в нём удалено вместе с этой функцией — оно было нужно только ей.

    // 24.09.2026 (перенос экономики хабара на сервер, по прямому указанию — раньше ЭТА функция
    // целиком жила в клиенте, habar.js._collectDay(): начисление наград/список наград/счётчик
    // дней/таймер кулдауна — всё было client-writable через общий users.save, читер мог обнулить
    // habar_days_collected/habar_last_collect_ts из консоли браузера и собирать хабар бесконечно,
    // либо вообще напрямую выставить себе валюту. Теперь сервер сам проверяет покупку/кулдаун/
    // лимит 30 дней и сам решает, что выдать — ровно тот же фиксированный список наград на тир,
    // что раньше был захардкожен в habar.js.containers, теперь в habar_daily_config.json.
    function collectDay(){
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $boughtIdx = $this->ops->i($user, 'habar_bought') - 1;
        if($boughtIdx < 0) return $this->ops->fail(57); // хабар не куплен

        $cfg = $this->ops->catalog('habar_daily_config');
        $con = $cfg['containers'][$boughtIdx] ?? null;
        if(!$con) return $this->ops->fail(51);

        $collected = $this->ops->i($user, 'habar_days_collected');
        $totalDays = intval($cfg['total_days']);
        if($collected >= $totalDays) return $this->ops->fail(58); // хабар этого месяца собран полностью

        $lastTs = $this->ops->i($user, 'habar_last_collect_ts');
        $now = intval(round(microtime(true) * 1000));
        $cooldownMs = intval($cfg['cooldown_ms']);
        if($lastTs > 0 && ($now - $lastTs) < $cooldownMs) return $this->ops->fail(59); // кулдаун ещё не прошёл

        $patchKeys = [];
        foreach($con['rewards'] as $r){
            $type = $r['type']; $amount = intval($r['amount']);
            if(in_array($type, ['coins','cigarettes','dice_points','blue_points','poker_chips'], true)){
                $this->ops->add($user, $type, $amount);
                $patchKeys[] = $type;
            } else if($type === 'damage'){
                // Пул "урон Седого" — та же семантика, что была в клиенте: не накапливается
                // между сборами хабара (полностью перезаполняется до максимума из уже
                // полученного/нового), а не складывается бесконечно.
                $sedoyMax = max($this->ops->i($user, 'sedoy_dmg_total'), $amount);
                $user['sedoy_dmg_total'] = $sedoyMax;
                $user['sedoy_dmg_left']  = $sedoyMax;
                $patchKeys[] = 'sedoy_dmg_total'; $patchKeys[] = 'sedoy_dmg_left';
            } else if(in_array($type, ['ammo_machete','ammo_gun','ammo_auto'], true)){
                $this->_grantWeaponReward($user, substr($type, 5), $amount);
                $patchKeys[] = $type; $patchKeys[] = 'weapons';
            }
        }

        $user['habar_days_collected']  = $collected + 1;
        $user['habar_last_collect_ts'] = $now;

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $patch = $this->ops->patchCurrencies($user, array_unique(array_merge($patchKeys, ['habar_days_collected', 'habar_last_collect_ts'])));
        $this->ops->ok(['patch' => $patch, 'rewards' => $con['rewards'], 'daysCollected' => $collected + 1]);
    }

    // Портировано из poker.php._grantWeaponReward() — тот же приём, начисляет и qty в
    // weapons-блобе, и зеркальное ammo_* поле (легаси-фолбэк, которое всё ещё читают некоторые
    // экраны напрямую).
    private function _grantWeaponReward(&$user, $type, $amount){
        $wid = ['machete' => 3, 'gun' => 4, 'auto' => 5][$type] ?? null;
        $amount = max(0, intval($amount));
        if($wid === null || $amount === 0) return;
        $data = $this->ops->j($user, 'weapons', []);
        if(!is_array($data)) $data = [];
        for($i = 0; $i < 6; $i++){
            $data[$i] = array_merge(
                ['owned' => $i < 3, 'equipped' => false, 'upg' => 0, 'qty' => 0],
                isset($data[$i]) && is_array($data[$i]) ? $data[$i] : []
            );
        }
        $ammoKey = 'ammo_' . $type;
        $data[$wid]['qty'] = max(0, intval($data[$wid]['qty']), intval($user[$ammoKey] ?? 0)) + $amount;
        $data[$wid]['owned'] = true;
        ksort($data);
        $user['weapons'] = json_encode(array_values($data));
        $user[$ammoKey] = strval($data[$wid]['qty']);
    }

}
?>

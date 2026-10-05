<?php
Class Habar {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['buy', 'collectDay'];
    }

    // Отдельное прямое подключение к БД — тот же паттерн, что zone.php/bosses.php._rawLink()
    // (04.10.2026, аудит гонок состояний).
    private function _rawLink(){
        $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
        if($link->connect_error) return null;
        $link->set_charset('utf8mb4');
        return $link;
    }

    function buy(){
        $idx = intval($this->registry['user_params']['container_id'] ?? -1);
        $cats = $this->ops->catalog('habar_containers');
        if(!isset($cats[$idx])) return $this->ops->fail(51);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $con = $cats[$idx];
        $type = $con['price']['type'];
        $cur = $type === 'cig' ? 'cigarettes' : $type;
        if(!in_array($cur, ['coins', 'cigarettes', 'stew'], true)) return $this->ops->fail(51); // некорректная валюта в каталоге
        $price = intval($con['price']['amount']);
        $uid = intval($this->registry['uid']);

        // 04.10.2026 (аудит гонок состояний — тот же класс бага, что уже чинили в bosses.php/
        // weapons.php/skills.php/ryukzak.php): без лока два параллельных клика buy() могли оба
        // прочитать habar_bought=0 устаревшим, оба пройти проверку "хабар не куплен" и оба
        // списать валюту со своего локального устаревшего баланса — итог: хабар куплен дважды, а
        // по факту списан только один раз (lost update). Ведём всю бизнес-логику на отдельной
        // копии $lockedUser с АКТУАЛЬНЫМИ значениями под SELECT...FOR UPDATE (та же физическая
        // блокировка строки, что и у остальных уже защищённых полей) — $user[поле] для
        // залоченных колонок остаётся НЕТРОНУТЫМ до конца функции (см. комментарий ниже).
        $lockCols = ['habar_bought', 'habar_counts', $cur];
        if($cur === 'stew') $lockCols[] = 'stew_spent';
        $link = $this->_rawLink();
        $lockedUser = $user;
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
            $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
            $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            if($row !== null) $lockedUser = array_merge($lockedUser, $row);
        }

        // Один хабар в одни руки
        if($this->ops->i($lockedUser, 'habar_bought') > 0){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(56);
        }

        if(!$this->ops->deduct($lockedUser, $cur, $price)){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(50);
        }
        // 24.09.2026 (перенос экономики хабара на сервер, по прямому указанию): раньше клиент
        // сам инкрементировал stew_spent (habar.js._buyAndOpen()) — статистика трат нужна
        // достижениям 'spend_stew' (см. achievements.js). Сервер теперь считает её сам, той же
        // формулой, для той же валюты, что реально списана (deduct() уже сам инкрементит
        // stew_spent для 'stew', см. gameops.php).

        $counts = $this->ops->j($lockedUser, 'habar_counts', [0,0,0,0]);
        while(count($counts) < 4) $counts[] = 0;
        $counts[$idx] = intval($counts[$idx]) + 1;
        $lockedUser['habar_counts'] = json_encode($counts);
        $lockedUser['habar_bought'] = $idx + 1;

        if($link){
            $sets = [];
            foreach($lockCols as $c) $sets[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
            $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $sets)." WHERE `id`=$uid");
            $link->commit();
            $link->close();
            // Залоченные поля уже записаны отдельным UPDATE под локом — НЕ присваиваем их в
            // $user здесь, иначе общий saveUser() ниже перезаписал бы их устаревшим снимком,
            // загруженным в начале buy() (тот же принцип, что в weapons.php.buy()); присвоение
            // переносится ПОСЛЕ saveUser(), см. ниже.
        } else {
            // 04.10.2026 (тот же баг, что уже находили при фиксе bosses/weapons/ryukzak — если
            // _rawLink() не смог открыть отдельное соединение, лока не было вообще, и
            // ОТЛОЖЕННОЕ присвоение после saveUser() было бы слишком поздним для этого же
            // запроса). Без лока — сохраняем как раньше, обычным $user ДО saveUser().
            foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
        }

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

        $patchKeys = array_merge([$cur, 'habar_counts', 'habar_bought'], $cur === 'stew' ? ['stew_spent'] : []);
        $patch = $this->ops->patchCurrencies($user, $patchKeys);
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

        $uid = intval($this->registry['uid']);
        // 04.10.2026 (аудит гонок состояний): без лока два параллельных клика collectDay() могли
        // оба прочитать habar_days_collected/habar_last_collect_ts устаревшими, оба пройти
        // проверки лимита/кулдауна и оба начислить награду — а в БД закрепился бы только
        // ПОСЛЕДНИЙ habar_days_collected (lost update), то есть игрок получил бы 2 награды за
        // "1 день". Та же техника $lockedUser, что в buy() выше — ведём всю бизнес-логику (и
        // проверки, и сам цикл наград, включая weapons — то же поле, что уже под локом в
        // weapons.php/ryukzak.php/bosses.php) на копии с АКТУАЛЬНЫМИ значениями под
        // SELECT...FOR UPDATE; $user[поле] для залоченных колонок остаётся НЕТРОНУТЫМ до конца
        // функции, чтобы общий saveUser() ниже не перезаписал уже закоммиченное устаревшим
        // снимком (тот же принцип, что в weapons.php.buy()).
        $lockCols = ['habar_days_collected', 'habar_last_collect_ts', 'coins', 'cigarettes',
            'dice_points', 'blue_points', 'poker_chips', 'sedoy_dmg_total', 'sedoy_dmg_left',
            'weapons', 'ammo_machete', 'ammo_gun', 'ammo_auto'];
        $link = $this->_rawLink();
        $lockedUser = $user;
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
            $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
            $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            if($row !== null) $lockedUser = array_merge($lockedUser, $row);
        }

        $collected = $this->ops->i($lockedUser, 'habar_days_collected');
        $totalDays = intval($cfg['total_days']);
        if($collected >= $totalDays){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(58); // хабар этого месяца собран полностью
        }

        $lastTs = $this->ops->i($lockedUser, 'habar_last_collect_ts');
        $now = intval(round(microtime(true) * 1000));
        $cooldownMs = intval($cfg['cooldown_ms']);
        if($lastTs > 0 && ($now - $lastTs) < $cooldownMs){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(59); // кулдаун ещё не прошёл
        }

        $patchKeys = [];
        foreach($con['rewards'] as $r){
            $type = $r['type']; $amount = intval($r['amount']);
            if(in_array($type, ['coins','cigarettes','dice_points','blue_points','poker_chips'], true)){
                $this->ops->add($lockedUser, $type, $amount);
                $patchKeys[] = $type;
            } else if($type === 'damage'){
                // Пул "урон Седого" — та же семантика, что была в клиенте: не накапливается
                // между сборами хабара (полностью перезаполняется до максимума из уже
                // полученного/нового), а не складывается бесконечно.
                $sedoyMax = max($this->ops->i($lockedUser, 'sedoy_dmg_total'), $amount);
                $lockedUser['sedoy_dmg_total'] = $sedoyMax;
                $lockedUser['sedoy_dmg_left']  = $sedoyMax;
                $patchKeys[] = 'sedoy_dmg_total'; $patchKeys[] = 'sedoy_dmg_left';
            } else if(in_array($type, ['ammo_machete','ammo_gun','ammo_auto'], true)){
                $this->_grantWeaponReward($lockedUser, substr($type, 5), $amount);
                $patchKeys[] = $type; $patchKeys[] = 'weapons';
            }
        }

        $lockedUser['habar_days_collected']  = $collected + 1;
        $lockedUser['habar_last_collect_ts'] = $now;

        if($link){
            $sets = [];
            foreach($lockCols as $c) $sets[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
            $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $sets)." WHERE `id`=$uid");
            $link->commit();
            $link->close();
        } else {
            // 04.10.2026 (тот же баг, что уже находили в bosses/weapons/ryukzak — без лока
            // отложенное присвоение после saveUser() было бы слишком поздним). Без лока —
            // переносим ВСЕ посчитанные поля в $user ДО saveUser(), как было до этого фикса.
            foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
        }

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

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

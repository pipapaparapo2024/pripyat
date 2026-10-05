<?php
Class Base {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['upgrade', 'train', 'relocate'];
    }

    // Отдельное прямое подключение к БД — тот же паттерн, что zone.php/bosses.php._rawLink()
    // (04.10.2026, аудит гонок состояний).
    private function _rawLink(){
        $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
        if($link->connect_error) return null;
        $link->set_charset('utf8mb4');
        return $link;
    }

    function upgrade(){
        $idx = intval($this->registry['user_params']['building_id'] ?? -1);
        if($idx < 0 || $idx > 3) return $this->ops->fail(54);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        $uid = intval($this->registry['uid']);

        $defaults = [
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['coins'=>500]],
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['stew'=>20]],
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['coins'=>800]],
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['coins'=>1200]],
        ];
        $upgrade_xp = [100,80,120,150];

        // 04.10.2026 (аудит гонок состояний — эталонный пример из отчёта: "два клика upgrade()
        // могут оба прочитать coins=1000, оба пройти проверку '500<=1000' и списать ЛОКАЛЬНО,
        // оба сохранить $user с coins=500 — здание улучшилось дважды по цене одного"). Ведём
        // всю бизнес-логику на копии $lockedUser с АКТУАЛЬНЫМИ значениями под
        // SELECT...FOR UPDATE (та же техника, что в habar.php.buy()) — $user[поле] для
        // залоченных колонок остаётся НЕТРОНУТЫМ до конца функции.
        $lockCols = ['base_buildings', 'coins', 'stew', 'coins_spent'];
        $link = $this->_rawLink();
        $lockedUser = $user;
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
            $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
            $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            if($row !== null) $lockedUser = array_merge($lockedUser, $row);
        }

        $buildings = $this->ops->j($lockedUser, 'base_buildings', $defaults);
        while(count($buildings) < 4) $buildings[] = $defaults[count($buildings)];
        $b = $buildings[$idx];
        if(intval($b['level']) >= 10){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(52);
        }

        $cost = $b['upgrade_cost'] ?? [];
        if(isset($cost['coins']) && !$this->ops->deduct($lockedUser, 'coins', intval($cost['coins']))){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(50);
        }
        if(isset($cost['stew']) && !$this->ops->deduct($lockedUser, 'stew', intval($cost['stew']))){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(50);
        }
        // 27.09.2026 (регрессия найдена полным прогоном тестов, tests/achievements-v2-and-
        // battlepass-off.test.js): раньше coins_spent (ачивки категории spend_coins) считал
        // КЛИЕНТ локально в base.js._upgradeBuilding(), рядом со старым локальным списанием.
        // При переводе на честный запрос-ответ (см. base.js) локальный подсчёт убран вместе со
        // списанием — сервер её никогда не вёл, из-за чего улучшения зданий перестали бы
        // двигать эту ачивку вовсе. Тот же приём, что уже применён в habar.php.buy()/
        // vassilich.php.buy(). stew_spent — НЕ дублируем: Gameops::deduct() уже сам инкрементит
        // её при $currency==='stew' (см. gameops.php) — отдельная строка здесь удвоила бы счёт.
        if(isset($cost['coins'])) $lockedUser['coins_spent'] = $this->ops->i($lockedUser, 'coins_spent') + intval($cost['coins']);

        $b['xp'] = intval($b['xp']) + $upgrade_xp[$idx];
        if($b['xp'] >= intval($b['xp_next']) && intval($b['level']) < 10){
            $b['xp'] -= intval($b['xp_next']);
            $b['level'] = intval($b['level']) + 1;
            $b['xp_next'] = intval(floor(intval($b['xp_next']) * 1.4));
            if(isset($b['upgrade_cost']['coins'])) $b['upgrade_cost']['coins'] = intval(floor($b['upgrade_cost']['coins'] * 1.5));
            if(isset($b['upgrade_cost']['stew'])) $b['upgrade_cost']['stew'] = intval(floor($b['upgrade_cost']['stew'] * 1.5));
        }
        $buildings[$idx] = $b;
        $lockedUser['base_buildings'] = json_encode($buildings);

        if($link){
            $sets = [];
            foreach($lockCols as $c) $sets[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
            $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $sets)." WHERE `id`=$uid");
            $link->commit();
            $link->close();
            // Залоченные поля уже записаны отдельным UPDATE под локом — присвоение в $user
            // переносится ПОСЛЕ saveUser() (тот же принцип, что в weapons.php.buy()).
        } else {
            // Без лока — сохраняем как раньше, обычным $user ДО saveUser() (тот же баг-класс,
            // что уже находили в bosses/weapons/ryukzak/habar).
            foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
        }

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
    }

    function train(){
        $idx = intval($this->registry['user_params']['stat_id'] ?? -1);
        if($idx < 0 || $idx > 2) return $this->ops->fail(54);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        $uid = intval($this->registry['uid']);

        $defaults = [
            ['level'=>1,'xp'=>0,'xp_next'=>200],
            ['level'=>1,'xp'=>0,'xp_next'=>200],
            ['level'=>1,'xp'=>0,'xp_next'=>200],
        ];

        // 04.10.2026 (аудит гонок состояний — тот же приём, что upgrade() выше): два
        // параллельных клика train() могли оба прочитать energy устаревшей, оба пройти
        // spendEnergy() и списать энергию ЛОКАЛЬНО — лишняя тренировка проходит бесплатно
        // (lost update на energy/base_stats[idx].xp).
        $lockCols = ['base_stats', 'energy', 'energy_time', 'energy_spent', 'train_count'];
        $link = $this->_rawLink();
        $lockedUser = $user;
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
            $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
            $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            if($row !== null) $lockedUser = array_merge($lockedUser, $row);
        }

        $stats = $this->ops->j($lockedUser, 'base_stats', $defaults);
        while(count($stats) < 3) $stats[] = $defaults[count($stats)];
        $s = $stats[$idx];
        if(intval($s['level']) >= 50){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(52);
        }
        $energyCost = 3;
        // 28.09.2026: раньше тут был обычный Gameops::deduct('energy') — он сравнивает с
        // СЫРЫМ значением energy из БД, не учитывая регенерацию, накопленную с последнего
        // сохранения (игрок мог визуально иметь полную энергию, но сервер отказал бы, если
        // давно не тратил её через Зону — единственное место, которое раньше "коммитило"
        // регенерацию в БД). spendEnergy() — та же формула с регенерацией и сохранением
        // остатка прогресса, что использует zone.php.fillCheckpoint() (см. gameops.php).
        if(!$this->ops->spendEnergy($lockedUser, $energyCost)){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(50);
        }

        // 23.09.2026 (баг по репорту — "достижения по энергии появляются не сразу, а только
        // при следующем заходе"): energy_spent (статистика для ачивок en_500/en_5k/.../en_1kk
        // и ежедневных заданий zadaniya.js "Потратить N энергии") раньше нигде НЕ учитывал
        // энергию, потраченную на тренировки в Качалке — только zone.php.fillCheckpoint()
        // инкрементировал это поле. Игрок мог тренироваться сколько угодно, но прогресс к
        // этим ачивкам/заданиям не двигался вовсе, пока он отдельно не тратил энергию в Зоне.
        $lockedUser['energy_spent'] = $this->ops->i($lockedUser, 'energy_spent') + $energyCost;

        $lockedUser['train_count'] = $this->ops->i($lockedUser, 'train_count') + 1;
        $s['xp'] = intval($s['xp']) + 40 + mt_rand(0,19);
        if($s['xp'] >= intval($s['xp_next']) && intval($s['level']) < 50){
            $s['xp'] -= intval($s['xp_next']);
            $s['level'] = intval($s['level']) + 1;
            $s['xp_next'] = intval(floor(intval($s['xp_next']) * 1.3));
        }
        $stats[$idx] = $s;
        $lockedUser['base_stats'] = json_encode($stats);

        if($link){
            $sets = [];
            foreach($lockCols as $c) $sets[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
            $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $sets)." WHERE `id`=$uid");
            $link->commit();
            $link->close();
        } else {
            foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
        }

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
    }

    function relocate(){
        $idx = intval($this->registry['user_params']['location_id'] ?? -1);
        if($idx < 0 || $idx > 4) return $this->ops->fail(54);
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        $user['base_location'] = strval($idx);
        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => ['base_location' => $user['base_location']]]);
    }
}
?>

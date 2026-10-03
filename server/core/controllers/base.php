<?php
Class Base {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['upgrade', 'train', 'relocate'];
    }

    function upgrade(){
        $idx = intval($this->registry['user_params']['building_id'] ?? -1);
        if($idx < 0 || $idx > 3) return $this->ops->fail(54);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $defaults = [
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['coins'=>500]],
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['stew'=>20]],
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['coins'=>800]],
            ['level'=>1,'xp'=>0,'xp_next'=>100,'upgrade_cost'=>['coins'=>1200]],
        ];
        $upgrade_xp = [100,80,120,150];
        $buildings = $this->ops->j($user, 'base_buildings', $defaults);
        while(count($buildings) < 4) $buildings[] = $defaults[count($buildings)];
        $b = $buildings[$idx];
        if(intval($b['level']) >= 10) return $this->ops->fail(52);

        $cost = $b['upgrade_cost'] ?? [];
        if(isset($cost['coins']) && !$this->ops->deduct($user, 'coins', intval($cost['coins']))) return $this->ops->fail(50);
        if(isset($cost['stew']) && !$this->ops->deduct($user, 'stew', intval($cost['stew']))) return $this->ops->fail(50);
        // 27.09.2026 (регрессия найдена полным прогоном тестов, tests/achievements-v2-and-
        // battlepass-off.test.js): раньше coins_spent (ачивки категории spend_coins) считал
        // КЛИЕНТ локально в base.js._upgradeBuilding(), рядом со старым локальным списанием.
        // При переводе на честный запрос-ответ (см. base.js) локальный подсчёт убран вместе со
        // списанием — сервер её никогда не вёл, из-за чего улучшения зданий перестали бы
        // двигать эту ачивку вовсе. Тот же приём, что уже применён в habar.php.buy()/
        // vassilich.php.buy(). stew_spent — НЕ дублируем: Gameops::deduct() уже сам инкрементит
        // её при $currency==='stew' (см. gameops.php) — отдельная строка здесь удвоила бы счёт.
        if(isset($cost['coins'])) $user['coins_spent'] = $this->ops->i($user, 'coins_spent') + intval($cost['coins']);

        $b['xp'] = intval($b['xp']) + $upgrade_xp[$idx];
        if($b['xp'] >= intval($b['xp_next']) && intval($b['level']) < 10){
            $b['xp'] -= intval($b['xp_next']);
            $b['level'] = intval($b['level']) + 1;
            $b['xp_next'] = intval(floor(intval($b['xp_next']) * 1.4));
            if(isset($b['upgrade_cost']['coins'])) $b['upgrade_cost']['coins'] = intval(floor($b['upgrade_cost']['coins'] * 1.5));
            if(isset($b['upgrade_cost']['stew'])) $b['upgrade_cost']['stew'] = intval(floor($b['upgrade_cost']['stew'] * 1.5));
        }
        $buildings[$idx] = $b;
        $user['base_buildings'] = json_encode($buildings);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
    }

    function train(){
        $idx = intval($this->registry['user_params']['stat_id'] ?? -1);
        if($idx < 0 || $idx > 2) return $this->ops->fail(54);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $defaults = [
            ['level'=>1,'xp'=>0,'xp_next'=>200],
            ['level'=>1,'xp'=>0,'xp_next'=>200],
            ['level'=>1,'xp'=>0,'xp_next'=>200],
        ];
        $stats = $this->ops->j($user, 'base_stats', $defaults);
        while(count($stats) < 3) $stats[] = $defaults[count($stats)];
        $s = $stats[$idx];
        if(intval($s['level']) >= 50) return $this->ops->fail(52);
        $energyCost = 3;
        // 28.09.2026: раньше тут был обычный Gameops::deduct('energy') — он сравнивает с
        // СЫРЫМ значением energy из БД, не учитывая регенерацию, накопленную с последнего
        // сохранения (игрок мог визуально иметь полную энергию, но сервер отказал бы, если
        // давно не тратил её через Зону — единственное место, которое раньше "коммитило"
        // регенерацию в БД). spendEnergy() — та же формула с регенерацией и сохранением
        // остатка прогресса, что использует zone.php.fillCheckpoint() (см. gameops.php).
        if(!$this->ops->spendEnergy($user, $energyCost)) return $this->ops->fail(50);

        // 23.09.2026 (баг по репорту — "достижения по энергии появляются не сразу, а только
        // при следующем заходе"): energy_spent (статистика для ачивок en_500/en_5k/.../en_1kk
        // и ежедневных заданий zadaniya.js "Потратить N энергии") раньше нигде НЕ учитывал
        // энергию, потраченную на тренировки в Качалке — только zone.php.fillCheckpoint()
        // инкрементировал это поле. Игрок мог тренироваться сколько угодно, но прогресс к
        // этим ачивкам/заданиям не двигался вовсе, пока он отдельно не тратил энергию в Зоне.
        $user['energy_spent'] = $this->ops->i($user, 'energy_spent') + $energyCost;

        $user['train_count'] = $this->ops->i($user, 'train_count') + 1;
        $s['xp'] = intval($s['xp']) + 40 + mt_rand(0,19);
        if($s['xp'] >= intval($s['xp_next']) && intval($s['level']) < 50){
            $s['xp'] -= intval($s['xp_next']);
            $s['level'] = intval($s['level']) + 1;
            $s['xp_next'] = intval(floor(intval($s['xp_next']) * 1.3));
        }
        $stats[$idx] = $s;
        $user['base_stats'] = json_encode($stats);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
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

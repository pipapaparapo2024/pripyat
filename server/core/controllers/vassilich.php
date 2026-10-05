<?php
Class Vassilich {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['buy', 'open_loot'];
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
        $params = $this->registry['user_params'];
        $item_id = intval($params['item_id'] ?? -1);
        $shop = $this->ops->catalog('vassilich_shop');
        $item = null;
        foreach($shop as $it){ if(intval($it['id']) === $item_id){ $item = $it; break; } }
        if(!$item) return $this->ops->fail(51);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $type = $item['price']['type'];
        $amount = intval($item['price']['amount']);
        $uid = intval($this->registry['uid']);

        // 04.10.2026 (аудит гонок состояний — эталонный пример из отчёта, "два клика buy() могут
        // оба прочитать баланс устаревшим, оба пройти проверку и списать ЛОКАЛЬНО"): без лока
        // второй платёж терялся бы бесследно (lost update) при однократно применённом эффекте,
        // либо эффект применялся бы дважды при фактически однократном списании — зависит от
        // порядка записи. Ведём всю бизнес-логику на копии $lockedUser с АКТУАЛЬНЫМИ значениями
        // под SELECT...FOR UPDATE (та же техника, что в habar.php.buy()) — $user[поле] для
        // залоченных колонок остаётся НЕТРОНУТЫМ до конца функции.
        $lockCols = ['coins', 'cigarettes', 'stew', 'energy', 'boss_keys', 'max_energy', 'bp_level', 'vassilich_buys', 'coins_spent'];
        $link = $this->_rawLink();
        $lockedUser = $user;
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
            $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
            $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            if($row !== null) $lockedUser = array_merge($lockedUser, $row);
        }

        if(!$this->ops->deduct($lockedUser, $type, $amount)){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(50);
        }
        // 27.09.2026 (регрессия найдена полным прогоном тестов, tests/achievements-v2-and-
        // battlepass-off.test.js): раньше coins_spent (ачивка spend_coins) считал КЛИЕНТ
        // локально в vassilich.js._buy(), рядом со старым локальным списанием валюты. При
        // переводе _buy() на честный запрос-ответ (см. vassilich.js) локальный подсчёт убран
        // вместе со списанием — сервер её никогда не вёл, из-за чего покупки у Василича
        // перестали бы двигать эту ачивку вовсе. stew_spent — НЕ дублируем отдельной строкой:
        // Gameops::deduct() уже сам инкрементит её при $currency==='stew' (см. gameops.php).
        if($type === 'coins') $lockedUser['coins_spent'] = $this->ops->i($lockedUser, 'coins_spent') + $amount;

        $lockedUser['vassilich_buys'] = $this->ops->i($lockedUser, 'vassilich_buys') + 1;
        $this->_applyEffect($lockedUser, $item['effect'] ?? []);

        if($link){
            $sets = [];
            foreach($lockCols as $c) $sets[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
            $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $sets)." WHERE `id`=$uid");
            $link->commit();
            $link->close();
            // Залоченные поля уже записаны отдельным UPDATE под локом — присвоение в $user
            // переносится ПОСЛЕ saveUser() (тот же принцип, что в weapons.php.buy()).
        } else {
            // Без лока (не удалось открыть отдельное соединение) — сохраняем как раньше,
            // обычным $user ДО saveUser() (тот же баг-класс, что уже находили в bosses/weapons/
            // ryukzak/habar — отложенное присвоение после saveUser() было бы слишком поздним).
            foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
        }

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'item_id' => $item_id]);
    }

    function open_loot(){
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        $uid = intval($this->registry['uid']);

        // 04.10.2026 (аудит гонок состояний): тот же приём, что buy() выше — лочим строку под
        // поля, которые реально мутирует open_loot() (цена + возможные эффекты лута), чтобы два
        // параллельных открытия не прошли списание оба разом с устаревшего баланса.
        $lockCols = ['coins', 'cigarettes', 'stew', 'energy', 'boss_keys', 'max_energy', 'bp_level'];
        $link = $this->_rawLink();
        $lockedUser = $user;
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
            $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
            $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            if($row !== null) $lockedUser = array_merge($lockedUser, $row);
        }

        if(!$this->ops->deduct($lockedUser, 'cigarettes', 5)){
            if($link){ $link->rollback(); $link->close(); }
            return $this->ops->fail(50);
        }

        $loot = $this->ops->catalog('vassilich_loot');
        $pool = [];
        foreach($loot as $it){
            $w = intval($it['weight'] ?? 1);
            for($i=0;$i<$w;$i++) $pool[] = $it;
        }
        $pick = $pool[array_rand($pool)];
        $this->_applyEffect($lockedUser, $pick['effect'] ?? []);

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

        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'loot' => ['name'=>$pick['name'], 'rarity'=>intval($pick['rarity']??0)]]);
    }

    private function _applyEffect(&$user, $effect){
        if(isset($effect['stew'])) $this->ops->add($user, 'stew', $effect['stew']);
        if(isset($effect['coins'])) $this->ops->add($user, 'coins', $effect['coins']);
        if(isset($effect['cigarettes'])) $this->ops->add($user, 'cigarettes', $effect['cigarettes']);
        if(isset($effect['energy'])) $this->ops->add($user, 'energy', $effect['energy']);
        if(isset($effect['boss_keys'])) $this->ops->add($user, 'boss_keys', $effect['boss_keys']);
        if(isset($effect['max_energy'])){
            $user['max_energy'] = max(50, $this->ops->i($user, 'max_energy', 50) + intval($effect['max_energy']));
        }
        if(isset($effect['bp_levels'])){
            $lv = $this->ops->i($user, 'bp_level', 1) + intval($effect['bp_levels']);
            $user['bp_level'] = min(500, $lv);
        }
    }
}
?>

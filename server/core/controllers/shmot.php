<?php
Class Shmot {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['buy', 'equip'];
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
        $item_id = intval($this->registry['user_params']['item_id'] ?? -1);
        $catalog = $this->ops->catalog('shmot_items');
        $item = null;
        foreach($catalog as $it){ if(intval($it['id']) === $item_id){ $item = $it; break; } }
        // 22.09.2026 (баг найден по прямому указанию — "недостаточно тушёнки, хотя её в разы
        // больше, чем нужно"): buy() раньше никак не логировал причину отказа — при живом
        // репорте пришлось лезть в БД и общий php_errors.log напрямую, ничего конкретного не
        // нашлось. Логируем uid/item_id/причину на КАЖДОЙ отказной ветке, чтобы следующий
        // репорт сразу показывал точную причину, а не требовал повторного расследования.
        $uid = intval($this->registry['uid']);
        if(!$item){
            error_log('[shmot.buy] fail(51) предмет не найден в каталоге | uid='.$uid.' item_id='.$item_id);
            return $this->ops->fail(51);
        }

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $map = ['coins'=>'coins','stew'=>'stew','cig'=>'cigarettes'];
        $cur = $map[$item['price']['type']] ?? null;
        if(!$cur){
            error_log('[shmot.buy] fail(54) некорректный price.type | uid='.$uid.' item_id='.$item_id.' type='.json_encode($item['price']['type'] ?? null));
            return $this->ops->fail(54);
        }
        $cost = intval($item['price']['a']);

        // 04.10.2026 (аудит гонок состояний): без лока два параллельных клика buy() могли оба
        // прочитать "не куплено" устаревшим и оба списать валюту со своего локального
        // устаревшего баланса (lost update) — та же техника $lockedUser, что в habar.php.buy().
        $lockCols = [$cur, 'shmot', 'max_energy'];
        if($cur === 'stew')  $lockCols[] = 'stew_spent';
        if($cur === 'coins') $lockCols[] = 'coins_spent';
        $link = $this->_rawLink();
        $lockedUser = $user;
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
            $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
            $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            if($row !== null) $lockedUser = array_merge($lockedUser, $row);
        }

        $shmot = $this->ops->j($lockedUser, 'shmot', []);
        while(count($shmot) <= $item_id) $shmot[] = ['owned'=>false,'equipped'=>false];
        if(!empty($shmot[$item_id]['owned'])){
            if($link){ $link->rollback(); $link->close(); }
            error_log('[shmot.buy] fail(52) уже куплено | uid='.$uid.' item_id='.$item_id);
            return $this->ops->fail(52);
        }

        if($cost > 0 && !$this->ops->deduct($lockedUser, $cur, $cost)){
            if($link){ $link->rollback(); $link->close(); }
            error_log('[shmot.buy] fail(50) недостаточно средств | uid='.$uid.' item_id='.$item_id.' cur='.$cur.' cost='.$cost.' have='.$this->ops->i($lockedUser, $cur));
            return $this->ops->fail(50);
        }

        // 19.09.2026 (баг найден: ачивки категории "потратил монет" не росли от покупок шмоток) —
        // Gameops::deduct() сам увеличивает stew_spent для тушёнки, но НЕ coins_spent для монет
        // (этим занимается каждый вызывающий контроллер отдельно, см. weapons.php/blackjack.php).
        // shmot.php был единственным местом трат монет, которое этого не делало вообще.
        if($cost > 0 && $item['price']['type'] === 'coins'){
            $this->ops->add($lockedUser, 'coins_spent', $cost);
        }

        $shmot[$item_id]['owned'] = true;
        $lockedUser['shmot'] = json_encode($shmot);
        $this->ops->applyShmotOwnBonus($lockedUser, $item_id);

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

        // patchCurrencies() без аргументов уже отдаёт coins/stew/cigarettes/stew_spent/shmot по
        // умолчанию — coins_spent в этот дефолтный список не входит (его не трогал никто, кроме
        // weapons.php/blackjack.php), поэтому дописываем его отдельно, не переопределяя весь список.
        $patch = $this->ops->patchCurrencies($user);
        $patch['coins_spent'] = $this->ops->i($user, 'coins_spent');
        $this->ops->ok(['patch' => $patch]);
    }

    // 25.09.2026 (по прямому указанию, живой репорт — "шмотки не сохраняются, эта логика
    // должна быть на сервере, записываться в БД"): раньше equipped ПОЛНОСТЬЮ считал и писал
    // клиент (game/shmot.js._onWear() → generic udata['shmot'] → users.save, whitelist поле
    // 'shmot') — тот же класс архитектурной дыры, что уже чинили для skills/weapons/achievements
    // (Правило №9 CLAUDE.md): любая гонка debounce-автосейва (например суспенд/резюм вокруг
    // bosses.attack(), см. большие комментарии там же) могла оставить сервер со СТАРЫМ снимком
    // equipped ровно в момент, когда клиент уже считал бонус (computeModifiedDamage) от НОВОГО
    // надетого предмета — отсюда и репорт "урон без шмоток" (мачете 60 на бейдже, 50 реально).
    // Плюс сама запись через users.save никак не гарантировала "один предмет на категорию" —
    // отдельный вектор для стака бонусов. Теперь единственный легитимный писатель — этот
    // эндпоинт (через Gameops::saveUser(), в обход users.save/whitelist — 'shmot' убран оттуда
    // users.php, см. комментарий рядом с $allowed там же).
    function equip(){
        $item_id = intval($this->registry['user_params']['item_id'] ?? -1);
        $catalog = $this->ops->catalog('shmot_items');
        $item = null;
        foreach($catalog as $it){ if(intval($it['id']) === $item_id){ $item = $it; break; } }
        $uid = intval($this->registry['uid']);
        if(!$item){
            error_log('[shmot.equip] fail(51) предмет не найден в каталоге | uid='.$uid.' item_id='.$item_id);
            return $this->ops->fail(51);
        }

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $shmot = $this->ops->j($user, 'shmot', []);
        while(count($shmot) <= $item_id) $shmot[] = ['owned'=>false,'equipped'=>false];
        // Связка выдаётся рулеткой отдельным server-only правом, а не через buy().
        // При первом нажатии «НАДЕТЬ» создаём её обычную запись экипировки, но только
        // когда это право действительно есть; подделанный item_id=100 не пройдёт.
        if($item_id === 100 && $this->ops->i($user, 'keyring_owner') > 0){
            $shmot[$item_id]['owned'] = true;
        }
        if(empty($shmot[$item_id]['owned'])){
            error_log('[shmot.equip] fail(52) предмет не выбит/не куплен | uid='.$uid.' item_id='.$item_id);
            return $this->ops->fail(52);
        }

        $wasEquipped = !empty($shmot[$item_id]['equipped']);

        // Сервер сам гарантирует "один надетый предмет на категорию" (слот экипировки — cat:
        // 0=голова,1=тело,2=штаны,3=обувь,4=аксессуар,5=татуировка,6=рука, см. комментарий в
        // game/shmot.js) — снимаем ВСЕ предметы той же категории, не доверяя клиентскому toggle.
        // 26.09.2026, повторный репорт живьём ("надел новопришедшую футболку — три футболки
        // разных сетов остались надеты одновременно"): предыдущая версия этой проверки сравнивала
        // 'bk' (тип бонуса — 'auto_flat'/'gun_flat'/'machete_flat'/...) вместо 'cat' (слот) —
        // случайно "работало" только для предметов с ОДИНАКОВЫМ типом бонуса в одной категории,
        // а разные футболки с разными бонусами (id42 gun_flat/id48 auto_flat/id95 machete_flat —
        // все cat:1 "тело") друг друга не снимали, поэтому можно было надеть их все разом.
        // 'cat' теперь есть в server/json/shmot_items.json (добавлено 1-в-1 из клиентского
        // каталога game/shmot.js для всех 58 актуальных предметов; старые id0-40, убранные из
        // клиента 23.09.2026, 'cat' не имеют и в этой проверке не участвуют — мёртвый код).
        foreach($catalog as $it){
            $iid = intval($it['id']);
            if(!isset($it['cat']) || !isset($item['cat']) || intval($it['cat']) !== intval($item['cat'])) continue;
            if(!isset($shmot[$iid]) || !is_array($shmot[$iid])) continue;
            $shmot[$iid]['equipped'] = false;
        }
        // Toggle: уже был надет — клик снимает (уже false строкой выше); не был — надеваем
        // именно его (остальные той же категории только что сняты).
        if(!$wasEquipped) $shmot[$item_id]['equipped'] = true;

        $user['shmot'] = json_encode($shmot);
        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

        $patch = $this->ops->patchCurrencies($user, ['shmot']);
        $this->ops->ok(['patch' => $patch, 'equipped' => !$wasEquipped]);
    }
}
?>

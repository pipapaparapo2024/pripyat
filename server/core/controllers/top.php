<?php
Class Top {
    private $registry, $ops;

    public $permits;

    // 26.09.2026 (по прямому указанию) — этот аккаунт никогда не должен появляться в строках
    // ЛЮБОГО топа (обычного и по недельному урону ниже), сколько бы он ни набрал. Собственные
    // my_value/my_place НЕ затронуты — если зайдёт именно он, свою позицию видит как обычно,
    // просто в общем списке (rows) для всех остальных его нет.
    const HIDDEN_FROM_TOP_UID = 1113977365;

    // 27.09.2026 (по прямому указанию — «топ по авторитету показывает только 10 человек,
    // листаться должен до 100; с достягами та же херня»): «Топ по авторитету» (cat:4) и
    // «Топ по достижениям» (cat:5) отдают до 100 строк — клиент держит под них пул из 100
    // ячеек и скроллит список (ROWS_POOL в _client/src/game/svod/svod-leaderboard.js).
    // Остальные категории оставлены на 10 — про них речи не было, а лишние 90 строк им негде
    // отрисовать: cat:1-3 читает старый FLA-экран top.js (ровно 10 готовых строк row_0..row_9
    // + slice(0,10) в коде), cat:0 (недельный урон) — также скроллящийся экран Сводки и, как
    // остальные рейтинги Сводки, отдаёт до 100 строк.
    const ROWS_LIMIT_DEFAULT    = 10;
    const ROWS_LIMIT_SCROLLABLE = 100;

    private function _rowsLimit($cat){
        return ($cat === 0 || $cat === 4 || $cat === 5) ? self::ROWS_LIMIT_SCROLLABLE : self::ROWS_LIMIT_DEFAULT;
    }

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['get'];
    }

    private function _rawLink(){
        $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
        if($link->connect_error) return null;
        $link->set_charset('utf8mb4');
        return $link;
    }

    function get(){
        $cat = intval($this->registry['user_params']['cat'] ?? 0);
        // cat 4/5 добавлены 17.09.2026 для вкладки «Сводка» (топ по авторитету/достижениям) —
        // 0-3 не трогали, чтобы не задеть существующих потребителей этого метода.
        // 23.09.2026 (по прямому указанию): cat:4 («Топ по авторитету») раньше сортировал по
        // respect (уважение/авторитет, добываемое прохождением локаций Зоны) — теперь сортирует
        // по exp (тот же счётчик, из которого клиент считает УРОВЕНЬ везде в игре, см.
        // interface.js.updateNick), respect в этой вкладке больше не участвует вообще. Метка
        // колонки "АВТОРИТЕТ" на экране — часть фонового PNG (задний фон топы по авторитету.png,
        // см. svod.js/svod-leaderboard.js), кодом не перерисовывается — останется прежней, пока
        // не будет новый арт.
        //
        // 25.09.2026 (по прямому указанию — "топ урона обновляется каждую неделю; топ по
        // уважению/авторитету — за всю историю игры, камон, прикинь какие там цифры будут через
        // год"): подтверждено намеренное асимметричное поведение. cat:4 (авторитет/уровень, exp)
        // остаётся lifetime-полем без изменений — уровень естественно ограничен прогрессией,
        // накопительная метрика там осмысленна. cat:0 (урон) — РАНЬШЕ тоже читал lifetime-поле
        // total_damage (растёт бесконечно, через год цифры теряют смысл для соревнования) —
        // теперь считается ИЗ boss_damage_log (уже существующий пер-хитовый лог, источник
        // правды для истории урона, см. bosses.php:attack()) с фильтром по времени ≥ начало
        // текущей календарной недели (понедельник 00:00 серверных часов — тот же принцип "серверные
        // часы, единый источник правды для всех", что у дневных лимитов, см. bosses.php:1009).
        // Никакого отдельного счётчика/сброса не нужно — лог и так пишется на каждый удар,
        // "обнуление" происходит само по себе тем, что прошлые недели просто не попадают в фильтр.
        if($cat === 0) return $this->_getWeeklyDamageTop();

        $fields = ['total_damage','coins','bosses_killed','stew','exp','achievement_stars'];
        if($cat < 0 || $cat > 5) return $this->ops->fail(54);
        $field = $fields[$cat];

        $uid = $this->registry['uid'];

        // scope='friends' — тот же список window.my_friends (VK id, включая свой), что клиент
        // уже шлёт в users.get (preloader.js.onGetToken) для рейтинга друзей по опыту — здесь
        // просто переиспользуем его для тех же id, отдельного запроса к VK не нужно.
        $scope = isset($this->registry['user_params']['scope']) ? $this->registry['user_params']['scope'] : 'all';
        $where = '1';
        if($scope === 'friends'){
            $raw = isset($this->registry['user_params']['friends']) ? $this->registry['user_params']['friends'] : '';
            $ids = [];
            foreach(explode(',', $raw) as $fid){ $fid = abs(intval($fid)); if($fid > 0) $ids[] = $fid; }
            if(!in_array(abs(intval($uid)), $ids)) $ids[] = abs(intval($uid));
            $where = 'id IN(' . implode(',', $ids) . ')';
        }

        $limit = $this->_rowsLimit($cat);
        $rows = $this->registry['udb']->getData(
            $this->registry['utb'],
            ['id', $field, 'exp', 'nick'],
            $where . ' AND id != ' . self::HIDDEN_FROM_TOP_UID . ' ORDER BY `'.$field.'`-0 DESC LIMIT '.$limit,
            true
        );
        if(isset($rows['error'])) $rows = [];

        // 17.09.2026 — «уровень» раньше вообще не отдавался топом (репорт: колонка УРОВЕНЬ
        // на Сводке всегда пустая). Отдаём сырой exp, уровень клиент считает сам той же
        // формулой, что и everywhere else (interface.js.updateNick) — не дублируем формулу в PHP.
        // nick — игровой ник игрока (не настоящее имя VK), по прямому указанию 17.09.2026
        // рейтинги должны показывать именно его, а не имя из VK-профиля.
        $out = [];
        foreach($rows as $r){
            $out[] = ['id'=>intval($r['id']), 'value'=>intval($r[$field]), 'exp'=>intval($r['exp'] ?? 0), 'nick'=>strval($r['nick'] ?? '')];
        }

        $me = $this->ops->loadUser(['id', $field]);
        $my_value = $me ? $this->ops->i($me, $field) : 0;

        // 29.09.2026 (тот же класс бага, что в users.php.get() рейтинг визитки — см. память
        // агента incident_rating_place_hidden_uid_offset): эта COUNT-формула не исключала
        // HIDDEN_FROM_TOP_UID, хотя список rows выше — исключает. Скрытый аккаунт с большим
        // exp молча попадал в COUNT и завышал место КАЖДОГО реального игрока на 1 относительно
        // видимого списка. Добавлена та же exclusion, что уже применена к rows-запросу.
        $placeRow = $this->registry['udb']->trueSQL(
            "SELECT COUNT(*)+1 AS place FROM `{$this->registry['utb']}` WHERE ({$where}) AND `{$field}`-0 > {$my_value} AND `id` != " . self::HIDDEN_FROM_TOP_UID
        );
        $my_place = isset($placeRow['place']) ? intval($placeRow['place']) : 0;

        $this->ops->ok(['rows'=>$out, 'my_value'=>$my_value, 'my_place'=>$my_place, 'cat'=>$cat, 'scope'=>$scope, 'limit'=>$limit]);
    }

    // 25.09.2026: топ урона за ТЕКУЩУЮ календарную неделю (понедельник 00:00 серверных часов —
    // 'monday this week' в PHP корректно возвращает СЕГОДНЯ, если сегодня и есть понедельник,
    // а не перескакивает на следующий). Считает СУММУ реального урона по логу ударов, не
    // lifetime-поле total_damage.
    private function _getWeeklyDamageTop(){
        $link = $this->_rawLink();
        if(!$link) return $this->ops->fail(99);

        $weekStartTs = strtotime('monday this week 00:00:00');
        $uid = abs(intval($this->registry['uid']));
        $utb = $this->registry['utb'];

        $scope = isset($this->registry['user_params']['scope']) ? $this->registry['user_params']['scope'] : 'all';
        $userWhere = '1';
        if($scope === 'friends'){
            $raw = isset($this->registry['user_params']['friends']) ? $this->registry['user_params']['friends'] : '';
            $ids = [];
            foreach(explode(',', $raw) as $fid){ $fid = abs(intval($fid)); if($fid > 0) $ids[] = $fid; }
            if(!in_array($uid, $ids)) $ids[] = $uid;
            $userWhere = 'u.`id` IN(' . implode(',', $ids) . ')';
        }

        // 29.09.2026 (по прямому указанию — "проверь, урон от седого проходит в топ по урону?
        // если да, то не должен"): boss_damage_log пишет и удары Седого (is_sedoy=1, миграция
        // 35, см. bosses.php.useSedoy()/_ratingTop()) — этот топ считает СУММУ ЛЮБОГО урона по
        // логу без фильтра, значит купленная помощь Седого раньше засчитывалась в общий топ по
        // урону наравне с честными ударами. Все три запроса ниже (список топа/мой урон/моё
        // место) получили `is_sedoy`=0 — та же логика, что уже применена к внутрибоевому
        // рейтингу "УЧАСТНИКИ БОЯ" в bosses.php._ratingTop().
        $out = [];
        $res = $link->query(
            "SELECT u.`id` AS id, COALESCE(d.dmg, 0) AS dmg, u.`exp` AS exp, u.`nick` AS nick
             FROM `{$utb}` u
             LEFT JOIN (
                SELECT `uid`, SUM(`damage`) AS dmg
                FROM `boss_damage_log`
                WHERE `time` >= {$weekStartTs} AND `is_sedoy`=0
                GROUP BY `uid`
             ) d ON d.`uid` = u.`id`
             WHERE ({$userWhere}) AND u.`id` != " . self::HIDDEN_FROM_TOP_UID . "
             ORDER BY dmg DESC, u.`id` ASC
             LIMIT " . $this->_rowsLimit(0)
        );
        if($res) while($row = $res->fetch_assoc()){
            $out[] = ['id'=>intval($row['id']), 'value'=>intval($row['dmg']), 'exp'=>intval($row['exp'] ?? 0), 'nick'=>strval($row['nick'] ?? '')];
        }

        $myRes = $link->query("SELECT SUM(`damage`) AS s FROM `boss_damage_log` WHERE `uid` = {$uid} AND `time` >= {$weekStartTs} AND `is_sedoy`=0");
        $myRow = $myRes ? $myRes->fetch_assoc() : null;
        $my_value = $myRow ? intval($myRow['s']) : 0;

        // 29.09.2026 (тот же класс бага, что в get() выше): подзапрос по boss_damage_log тоже
        // не исключал HIDDEN_FROM_TOP_UID — если скрытый аккаунт бьёт боссов, его недельный урон
        // молча попадал в COUNT и завышал место каждого реального игрока на 1.
        $placeRes = $link->query(
            "SELECT COUNT(*)+1 AS place FROM (
                SELECT bl.`uid`, SUM(bl.`damage`) AS dmg FROM `boss_damage_log` bl
                WHERE bl.`time` >= {$weekStartTs} AND bl.`is_sedoy`=0 AND bl.`uid` != " . self::HIDDEN_FROM_TOP_UID . ($scope === 'friends' ? " AND bl.`uid` IN(" . implode(',', $ids) . ")" : '') . "
                GROUP BY bl.`uid` HAVING dmg > {$my_value}
             ) t"
        );
        $placeRow = $placeRes ? $placeRes->fetch_assoc() : null;
        $my_place = $placeRow ? intval($placeRow['place']) : 0;

        $link->close();

        $this->ops->ok(['rows'=>$out, 'my_value'=>$my_value, 'my_place'=>$my_place, 'cat'=>0, 'scope'=>$scope, 'week_start'=>$weekStartTs]);
    }
}
?>

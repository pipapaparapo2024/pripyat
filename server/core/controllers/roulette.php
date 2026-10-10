<?php
Class Roulette {
    private $registry, $ops;

    // Пул обычных (не эксклюзивных) наград мини-игры "9 стаканчиков" — раздаются как
    // обычная валюта через _give() на клиенте, никакой эксклюзивности не требуют.
    // amt для Куша — плейсхолдер (в ТЗ сумма Куша не указана), правится тут одной строкой.
    private $CUP_POOL = [
        ['type'=>'auto',    'amt'=>50],
        ['type'=>'gun',     'amt'=>200],
        ['type'=>'machete', 'amt'=>300],
        ['type'=>'cig',     'amt'=>50000],
        ['type'=>'roulette_spichki', 'amt'=>3000],
        ['type'=>'exp',     'amt'=>100000],
        ['type'=>'blue_points', 'amt'=>10],
    ];
    private $KUSH_AMOUNT = 50000; // плейсхолдер — сумма Куша не указана в ТЗ

    // 29.09.2026 (СРОЧНО, по прямому указанию — репорт "игрок выбил связку ключей, такого не
    // может быть" + полное ТЗ на механику "Куш/Связка ключей", прислано целиком тем же днём):
    //
    // РЕАЛЬНАЯ проверка в БД (uid 71454096/382448269/438953352 — все трое имеют
    // keyring_owner=1) подтвердила: $keyringAvailable БЫЛ жёстко захардкожен в true И в
    // spin() (обычное колесо), И в openMinigame() (мини-игра "9 стаканчиков") — переменная
    // keyring_cycle_ends_at из roulette_state читалась из БД, но НИГДЕ не проверялась. Итог —
    // связку можно было выбить с шансом 1/14 (≈7.1%) на КАЖДОМ обычном спине колеса И
    // безусловно (1/9, ≈11%) в каждой мини-игре, БЕЗ какого-либо кулдауна вообще.
    //
    // 29.09.2026, ФИНАЛЬНОЕ уточнение тем же днём (по прямому указанию — "шанс выпадения связки
    // в рулетке равен 1/1000000, буквально на миллион игроков будет всего один выигравший, и
    // потом КД 30 дней"): предыдущая версия этого комментария/кода реализовывала БИНАРНУЮ
    // доступность (окно открыто → обычные равновероятные шансы колеса/безусловный стаканчик) —
    // отклонено, заменено на буквальный фиксированный ролл. Итоговая механика — ДВА независимых
    // условия одновременно:
    //   1) Кулдаун (KEYRING_COOLDOWN_DAYS дней с момента последней выдачи, keyring_cycle_ends_at
    //      в roulette_state) — пока он не истёк, шанс строго 0%, сектор №1/'keyring' в cups
    //      физически исключены из розыгрыша, независимо от второго условия ниже.
    //   2) Когда КД истёк — на КАЖДОМ отдельном спине/открытии мини-игры даётся независимый
    //      редкий ролл 1 к KEYRING_CHANCE_DENOM (1 000 000) — НЕ гарантированное "раз окно
    //      открыто, обязательно кто-то выиграет в ближайших спинах", а именно 1/1000000 на
    //      КАЖДУЮ попытку, сколько бы их ни было.
    // Как только Связка реально выдана (через любой из двух способов) — keyring_cycle_ends_at
    // сразу переставляется на +30 дней вперёд, оба способа немедленно возвращаются к пункту 1
    // (строгий 0%) на весь новый цикл.
    //
    // Первый игрок (неважно, через колесо или через мини-игру), который получает Связку в
    // открытом окне, становится владельцем — сразу после выдачи keyring_cycle_ends_at
    // переставляется на +30 дней вперёд (_lockKeyringFor30Days()), оба способа немедленно
    // снова становятся недоступны. ИСКЛЮЧЕНИЕ по ТЗ: мини-игра, чья раскладка стаканчиков УЖЕ
    // была зафиксирована (openMinigame()) в момент, когда окно было открыто, сохраняет
    // 'keyring' среди стаканчиков даже если окно к моменту pickCup() уже закрылось другим
    // выигрышем — это не баг, поведение уже "бесплатно" получается из архитектуры (raffle
    // фиксируется в user['roulette_cups'] один раз при открытии, pickCup() просто читает уже
    // сохранённое, не перепроверяя текущую доступность).
    //
    // 29.09.2026, СРОЧНО (та же партия правок, отдельный найденный по ходу дела эксплойт):
    // claimKeyring() был ОТДЕЛЬНЫМ permit-эндпоинтом, который клиент вызывал ПОСЛЕ того, как
    // увидел slotIdx===0 в ответе spin() — но сервер при этом вызове НИКАК не проверял, что
    // игрок ДЕЙСТВИТЕЛЬНО выбил этот сектор: читер мог вызвать
    // TS.php('roulette.claimKeyring', {}) прямо из консоли браузера в любой момент и
    // безусловно получить keyring_owner=1, без единого спина. Эта же лишняя отдельная сетевая
    // проходка (spin() → отдельный claimKeyring()) была и первопричиной "выбил, а она не
    // появилась" — claimKeyring() исторически проваливался в 13 из 14 живых попыток
    // (ok:false в error_log), фактическая причина SQL-отказа нигде не логировалась. Фикс —
    // выдача Связки перенесена ПРЯМО в spin()/pickCup() (та же атомарная запись, что уже
    // сохраняет остальные поля), отдельный claimKeyring()-эндпоинт и permit удалены целиком —
    // нечего больше дёргать из консоли, и нечему больше проваливаться отдельным запросом.
    private $KEYRING_COOLDOWN_DAYS = 30;
    private $KEYRING_CHANCE_DENOM  = 1000000; // 1 к миллиону — независимый ролл на каждую попытку, когда КД истёк

    // 26.09.2026 (по прямому указанию — аудит "покупка поинтов зариков/рулетки за рубли
    // напрямую вызывает users.save", см. buyPoints() ниже): таблица пакетов для синих поинтов
    // рулетки по ТЗ — ТА ЖЕ самая (10/25/55/115/250/550 → 100/250/550/1150/2500/5500), что уже
    // использует dice_config.json.buy_points для зариков.
    //
    // 04.10.2026 (аудит проекта — найден дубль в 4 местах: этот массив, dice_config.json.
    // buy_points, и клиентские ROUL_PKGS[]/PKGS[] в dvor-roulette-buy.js/dvor-dice-screen.js):
    // раньше здесь была СОБСТВЕННАЯ копия той же таблицы (аргумент был — "у рулетки нет
    // roulette_config.json") — вместо того, чтобы заводить новый одноключевой JSON-файл ради
    // 6 строк ИЛИ плодить третью копию, читаем её прямо из dice_config.json (единственный
    // источник правды для ЭТОЙ конкретной таблицы — обе игры используют один и тот же прайс).
    // Если когда-нибудь цены разъедутся — тогда и завести отдельный roulette_config.json, не раньше.
    private function _buyPointsTable(){
        return $this->ops->catalog('dice_config')['buy_points'];
    }

    // Обычные (не эксклюзивные) слоты обычного спина рулетки — 1-в-1 порт SLOTS[] из
    // dvor-roulette-screen.js._resolveRouletteNewScreen() (23.09.2026, перенос награды спина
    // на сервер). Индексы 0 (Связка ключей) и 12 (СУПЕРПРИЗ/джекпот) сюда не входят — null,
    // обрабатываются отдельными уже существующими ветками (claimKeyring/_openJackpotChoice),
    // не в фокусе этого шага.
    private $SPIN_SLOTS = [
        null,                                                              // 0: key_bundle
        ['type'=>'blue_points',      'amt'=>2,     'sp'=>0],               // 1
        ['type'=>'roulette_spichki', 'amt'=>40,    'sp'=>40],              // 2
        ['type'=>'auto',             'amt'=>1,     'sp'=>0],               // 3
        ['type'=>'roulette_spichki', 'amt'=>10,    'sp'=>10],              // 4
        ['type'=>'exp',              'amt'=>10000, 'sp'=>0],               // 5
        ['type'=>'roulette_spichki', 'amt'=>20,    'sp'=>20],              // 6
        ['type'=>'gun',              'amt'=>1,     'sp'=>0],               // 7
        ['type'=>'cig',              'amt'=>1000,  'sp'=>0],               // 8
        ['type'=>'roulette_spichki', 'amt'=>50,    'sp'=>50],              // 9
        ['type'=>'coins',            'amt'=>20,    'sp'=>0],               // 10
        ['type'=>'coins',            'amt'=>10,    'sp'=>0],               // 11
        null,                                                              // 12: super/jackpot
        ['type'=>'roulette_spichki', 'amt'=>30,    'sp'=>30],              // 13
        ['type'=>'exp',              'amt'=>10000, 'sp'=>0],               // 14
    ];

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        // 29.09.2026: 'claimKeyring' удалён — был вызываемым напрямую из консоли эксплойтом
        // (см. большой коммент у _tryClaimKeyring() ниже), выдача Связки колеса перенесена
        // внутрь spin(), отдельный permit ей больше не нужен.
        $this->permits = ['status', 'spin', 'claimPrize', 'openMinigame', 'pickCup', 'openCase', 'buyPoints'];
    }

    // 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у блэкджека
    // после репорта "выпала AA хотя pity ещё далеко"): error_log (Правило №8) + поле debug в
    // каждом ответе. jackpot_pool/spin_counter/spin_threshold/kush_counter/kush_threshold живут
    // в ГЛОБАЛЬНОЙ таблице roulette_state (одна строка id=1, общая на всех игроков) — debug
    // включает и её состояние, не только per-user roulette_cups.

    // openCase — 150 roulette_spichki за открытие "кейса" рулетки (dvor-roulette-buy.js,
    // _reallyOpen внутри _openRouletteCaseScreen). 22.09.2026: списание раньше шло целиком
    // client-side (udata['roulette_spichki'] = have - cost, без единого запроса к серверу)
    // — тот же класс дыры, что уже закрыт для оружия/шмоток/хаты (см. hata.php.buy()) и для
    // покерной сумки (poker.php.openBag(), тот же кейс, та же цена). Сервер сам проверяет
    // баланс и списывает; сами награды (exp/сигареты/заначка/монеты) по-прежнему выдаёт
    // клиент через _give() — не в фокусе этого шага.
    // 23.09.2026 (по прямому указанию, аудит "что ещё не на сервере" — тот же перенос, что и
    // у покерной сумки, poker.php.openBag()): списание стоимости уже было на сервере
    // (22.09.2026), но сама НАГРАДА (exp/сигареты/заначка/монеты) до сих пор каталась на
    // клиенте (dvor-roulette-buy.js._openRouletteCaseOpenedScreen, this._rand()). Диапазоны
    // 1-в-1 порт клиентских this._rand(min,max) — тату по-прежнему решает клиент отдельно
    // (hasTatu, не завязан на сумму/валюту), не в фокусе этого шага.
    function openCase(){
        $cost = 150;
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        if(!$this->ops->deduct($user, 'roulette_spichki', $cost)) return $this->ops->fail(50); // не хватает спичек

        // 09.10.2026 (аудит гонок состояний по всему проекту): openCase() не брал НИКАКОГО
        // лока, хотя пишет stash_count/shmot/max_energy — все три уже защищены в ДРУГИХ файлах
        // (stash_count — yashik.php.collect(); shmot/max_energy — shmot.php.buy(), yashik.php)
        // через SELECT...FOR UPDATE. Конкурентный запрос к любому из них между чтением выше и
        // общим сохранением ниже мог затереть начисленную здесь награду устаревшим снимком (тот
        // же класс гонки, что чинили в rewardlinks.php/poker.php — см. комментарий там же, это
        // зеркальная пара poker.php::openBag(), один и тот же баг в обоих копипастах).
        $lockFields = ['stash_count', 'shmot', 'max_energy'];
        $link = $this->_rawLink();
        if($link){
            $link->begin_transaction();
            $colList = implode(',', array_map(function($col){ return "`$col`"; }, $lockFields));
            $lockRes = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=" . intval($this->registry['uid']) . " FOR UPDATE");
            $lockRow = ($lockRes && $lockRes->num_rows > 0) ? $lockRes->fetch_assoc() : null;
            if($lockRow !== null){
                foreach($lockFields as $f) if($lockRow[$f] !== null) $user[$f] = $lockRow[$f];
            }
        }
        $lockBefore = [];
        foreach($lockFields as $f) $lockBefore[$f] = $user[$f] ?? null;

        $reward = [
            'exp'   => mt_rand(1000, 2000),
            'cig'   => mt_rand(500, 1000),
            'stash' => mt_rand(5, 15),
            'coins' => mt_rand(1, 5),
        ];
        $this->ops->add($user, 'exp', $reward['exp']);
        $this->ops->add($user, 'cigarettes', $reward['cig']);
        $this->ops->add($user, 'stash_count', $reward['stash']);
        $this->ops->add($user, 'coins', $reward['coins']);
        $user['coins_earned'] = $this->ops->i($user, 'coins_earned') + $reward['coins'];

        // Тату (шмотка) из кейса — раньше решалось и СОХРАНЯЛОСЬ на клиенте
        // (dvor._give('shmot',1) → shmot.giveRandom() → users.save), которое
        // users.php._sanitizeShmot() молча отклоняет (users.save не может сам выставить
        // owned=true) — приз никогда реально не доходил до игрока. Теперь решение и запись —
        // на сервере, тем же grantShmotFromSource(), что и у боссов (bosses.php.claimKill()).
        // Шанс = 0 — дроп тату по-прежнему выключен в бете (см. dvor-roulette-buy.js, "Бета:
        // выпадение тату отключено") — поднять шанс достаточно поменять эту константу,
        // выдача уже безопасна. Источник 'roulette' в shmot_items.json пока не заполнен ни
        // одним предметом (см. poker/dice/blackjack для сравнения) — добавить записи в
        // каталог перед реальным включением шанса, иначе grantShmotFromSource будет находить
        // пустой пул и возвращать null даже при выигрышном ролле.
        $tatuChancePct = 0;
        $tatuItemId = (mt_rand(1, 100) <= $tatuChancePct) ? $this->ops->grantShmotFromSource($user, 'roulette') : null;
        $hasTatu = $tatuItemId !== null;

        $lockedUpdates = [];
        foreach($lockFields as $f){
            if(isset($user[$f]) && $user[$f] !== $lockBefore[$f]) $lockedUpdates[$f] = strval($user[$f]);
        }
        if($link){
            if(!empty($lockedUpdates)){
                $setParts = [];
                foreach($lockedUpdates as $col => $val) $setParts[] = "`$col`='" . $link->real_escape_string($val) . "'";
                $link->query("UPDATE `{$this->registry['utb']}` SET " . implode(',', $setParts) . " WHERE `id`=" . intval($this->registry['uid']));
            }
            $link->commit();
            $link->close();
            foreach(array_keys($lockedUpdates) as $col) unset($user[$col]);
        }

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        foreach($lockedUpdates as $col => $val) $user[$col] = $val;

        $debug = ['fn' => 'openCase', 'uid' => abs(intval($this->registry['uid'])),
            'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true), 'cost' => $cost, 'reward' => $reward,
            'hasTatu' => $hasTatu, 'tatuItemId' => $tatuItemId];
        error_log('[roulette.openCase] ' . json_encode($debug));

        $patch = $this->ops->patchCurrencies($user, ['roulette_spichki', 'exp', 'cigarettes', 'stash_count', 'coins', 'coins_earned', 'shmot', 'max_energy']);
        $clientRewards = [['type' => 'battlepass_xp', 'amt' => max(1, intval(floor($reward['exp'] / 100)))]];
        $this->ops->ok(['patch' => $patch, 'reward' => $reward, 'hasTatu' => $hasTatu, 'clientRewards' => $clientRewards, 'debug' => $debug]);
    }

    // 26.09.2026 (по прямому указанию — аудит "покупка поинтов зариков/рулетки за рубли
    // напрямую вызывает users.save"): dvor-roulette-buy.js.buyBluePoints() зеркально dice.php.
    // buyPoints() — раньше писала coins/blue_points оптимистично на клиенте (с откатом при
    // сетевой ошибке), но реальное сохранение шло через общий whitelist users.save, сервер
    // верил присланным числам целиком. Таблица цены/количества — _buyPointsTable() выше
    // (04.10.2026: читает dice_config.json.buy_points — единый источник для обеих игр).
    function buyPoints(){
        $table = $this->_buyPointsTable();
        $idx = intval($this->registry['user_params']['pkg_idx'] ?? -1);
        if($idx < 0 || $idx >= count($table)) return $this->ops->fail(54); // некорректный индекс пакета

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $pkg = $table[$idx];
        $price = intval($pkg['price']);
        $pts = intval($pkg['pts']);

        if(!$this->ops->deduct($user, 'coins', $price)) return $this->ops->fail(50); // недостаточно рублей
        $this->ops->add($user, 'blue_points', $pts);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

        $debug = ['fn' => 'buyPoints', 'uid' => abs(intval($this->registry['uid'])),
            'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
            'pkg_idx' => $idx, 'price' => $price, 'pts' => $pts];
        error_log('[roulette.buyPoints] ' . json_encode($debug));

        $patch = $this->ops->patchCurrencies($user, ['coins', 'blue_points']);
        $this->ops->ok(['patch' => $patch, 'pts' => $pts, 'price' => $price, 'debug' => $debug]);
    }

    // Отдельное прямое подключение к БД — по тому же паттерну, что bosses.php (_rawLink):
    // roulette_state — ГЛОБАЛЬНАЯ таблица (одна строка id=1, общая на всех игроков),
    // обычный getData/saveData (всегда per-user через utb) для неё не подходит.
    private function _rawLink(){
        $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
        if($link->connect_error) return null;
        $link->set_charset('utf8mb4');
        return $link;
    }

    // status — доступность Связки ключей (для отображения сектора №1 рулетки и пула
    // наград мини-игры на клиенте) + текущая сумма джек-пота (jackpot_pool) для отображения
    // при открытии экрана рулетки, ДО первого спина в этой сессии. Счётчик спинов/порог
    // (spin_counter/spin_threshold) по-прежнему не отдаём игроку — это скрывает, сколько
    // спинов осталось до срабатывания, а не саму накопленную денежную сумму.
    function status(){
        $link = $this->_rawLink();
        if(!$link) return $this->registry['tools']->output(['keyring_available' => false, 'jackpot_pool' => 3000, 'spin_counter' => 0, 'spin_threshold' => 0]);
        $res = $link->query("SELECT `keyring_cycle_ends_at`, `jackpot_pool`, `spin_counter`, `spin_threshold` FROM `roulette_state` WHERE `id`=1");
        $row = $res ? $res->fetch_assoc() : null;
        $link->close();
        // Связка — личный редкий приз: её могут получить несколько игроков, а не только
        // один владелец на весь сервер. Глобальный 30-дневный цикл больше не блокирует выдачу.
        $available = true;
        $jackpotPool = $row ? intval($row['jackpot_pool']) : 3000;
        // 25.09.2026 (по прямому указанию — "показывай сбоку количество игр до комбинации"):
        // spin_counter/spin_threshold — ЕДИНЫЙ ГЛОБАЛЬНЫЙ счётчик до джекпота, общий на ВСЕХ
        // игроков (не персональный, в отличие от pity зариков/блэкджека) — та же таблица
        // roulette_state, что уже читает spin() ниже для честного розыгрыша.
        $spinCounter   = $row ? intval($row['spin_counter'])   : 0;
        $spinThreshold = $row ? intval($row['spin_threshold']) : 0;
        $this->registry['tools']->output(['keyring_available' => $available, 'jackpot_pool' => $jackpotPool,
            'spin_counter' => $spinCounter, 'spin_threshold' => $spinThreshold]);
    }

    // Вызывается клиентом на КАЖДОЙ прокрутке рулетки (независимо от локально выбранного
    // приза из 15-слотового пула) — глобальный серверный счётчик, общий на всех игроков.
    // Атомарный инкремент+чтение через LAST_INSERT_ID(), чтобы не ловить гонки при
    // одновременных прокрутках разных игроков.
    //
    // jackpot_pool — по ТЗ ("1 поинт стоит 10р. В рулетке копится джекпот из трат на
    // поинты") реальная сумма супер-приза, растущая на 10р (цена поинта) за каждый спин —
    // раньше этого не было вообще: отображаемая сумма была захардкожена на 3000 и никогда
    // не менялась, а выигрыш джек-пота всегда выдавал фиксированные 500р независимо от
    // того, сколько реально накопилось (репорт: "джекпот должен расти на 10р за поинт").
    // 23.09.2026 (по прямому указанию, продолжение переноса экономики — дыра, найденная при
    // аудите): стоимость спина (1 blue_point) списывалась целиком client-side (udata[...] =
    // pts - 1, без единого запроса к серверу), а сама НАГРАДА за обычные 13 слотов каталась
    // и применялась на клиенте через this._give() — читер мог вызвать dvor._give('coins',
    // 999999999) напрямую или просто пропустить списание. Теперь: сервер сам проверяет и
    // списывает 1 blue_point, сам выбирает slotIdx (та же логика выбора, что раньше была на
    // клиенте — jackpot⇒12, иначе случайный обычный сектор) и
    // для обычных слотов (не 0/не 12 — Связка/Джекпот по-прежнему отдельные честные ветки,
    // claimKeyring/_openJackpotChoice, не в фокусе этого шага) сразу начисляет валюту. auto/gun
    // — гардероб/оружие ещё не перенесены на сервер (как и у Зариков/Покера) — возвращаются
    // клиенту как clientReward, применяются существующей weapons.grantAmmo().
    function spin(){
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        if(!$this->ops->deduct($user, 'blue_points', 1)) return $this->ops->fail(50); // не хватает синих поинтов

        // 25.09.2026 (dev-панель, кнопка "100% НА СЛЕД. СПИН" — по прямому указанию, чисто для
        // теста): одноразовый ЛИЧНЫЙ флаг (server-only поле, users.setDevFlag), НЕ трогает
        // общий счётчик/порог/пул джекпота в roulette_state — это реальный прогресс всех
        // игроков, форсировать его ради теста одного аккаунта нельзя. Флаг форсирует исход
        // ИМЕННО этого спина этого игрока и сразу гасится, независимо от реального счётчика.
        $devForceJackpot = $this->ops->i($user, 'dev_force_jackpot') > 0;
        if($devForceJackpot) $user['dev_force_jackpot'] = 0;

        // 25.09.2026 (по прямому указанию — "хочу тестировать все сектора рулетки"):
        // dev_force_roulette — личный одноразовый флаг (dev-панель, users.setDevCombo), хранит
        // КОНКРЕТНЫЙ slotIdx (0-14, тот же индекс, что SPIN_SLOTS выше) — форсирует именно его,
        // в обход честного mt_rand. НЕ читаем через Gameops::i() — intval('') совпал бы с
        // валидным idx=0 (см. тот же класс бага, разобранный в dice.php).
        $devForceRouletteRaw = strval($user['dev_force_roulette'] ?? '');
        $devForceIdx = null;
        if($devForceRouletteRaw !== ''){
            // 26.09.2026 (по прямому репорту + живым логам — та же порча, что уже поймана в
            // blackjack.php._dealRealPair(): источник закрыт в Database::trueJSON(), но здесь —
            // защита по факту, на случай ЛЮБОГО другого пути порчи). Если сырое значение —
            // буквально "Array" (strval() от PHP-массива) ИЛИ intval() дал индекс вне диапазона
            // реальных слотов (0-14, см. SPIN_SLOTS) — форс игнорируется, спин идёт честным
            // mt_rand, а не падает в несуществующий слот молча.
            if($devForceRouletteRaw === 'Array'){
                error_log('[roulette.spin] !!! dev_force_roulette пришёл МАССИВОМ (strval="Array") !!! uid=' . abs(intval($this->registry['uid'])));
            } else {
                $idx = intval($devForceRouletteRaw);
                if($idx >= 0 && $idx < count($this->SPIN_SLOTS)) $devForceIdx = $idx;
                else error_log('[roulette.spin] !!! dev_force_roulette вне диапазона слотов !!! raw=' . json_encode($devForceRouletteRaw) . ' | uid=' . abs(intval($this->registry['uid'])));
            }
            $user['dev_force_roulette'] = '';
        }

        $link = $this->_rawLink();
        if(!$link){
            // Глобальный джекпот недоступен (нет соединения к общей таблице) — всё равно
            // списываем поинт и крутим локально без джекпота/ключей, как и раньше (dev-форс
            // тоже уважаем — незачем терять личный тестовый флаг из-за временной недоступности
            // общей таблицы, но выбор приза без неё всё равно не отрисовать полноценно).
            $slotTrace = [];
            $slotResult = $this->_rollSlot($devForceJackpot, false, $user, $slotTrace, $devForceIdx);
            if($devForceJackpot || $slotResult['slotIdx'] === 12) $user['roulette_cups'] = json_encode(['__prize_choice__']);
            $this->ops->saveUser($user);
            $debug = ['fn' => 'spin', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'rawLinkFailed' => true, 'slotTrace' => $slotTrace, 'slotResult' => $slotResult];
            error_log('[roulette.spin] ' . json_encode($debug) . ' !!! _rawLink() НЕ ПОДКЛЮЧИЛСЯ — крутили без джекпота/связки !!!');
            $patch = $this->ops->patchCurrencies($user, ['blue_points', 'coins', 'coins_earned', 'exp', 'cigarettes', 'roulette_spichki', 'dvor_games']);
            // 10.10.2026 (по прямому указанию — ТЗ "Игроки не должны видеть... под каким
            // стаканчиком он находится" + репорт "debug сливается в консоль браузера"): $debug
            // (slotTrace/slotResult — честность розыгрыша) больше НЕ уходит в ответ клиенту,
            // остаётся ТОЛЬКО в error_log() строкой выше (серверная диагностика, игроку не видна).
            return $this->registry['tools']->output(['patch' => $patch, 'jackpot' => ($devForceJackpot || $slotResult['slotIdx'] === 12), 'keyring_available' => false, 'jackpot_pool' => 3000, 'spin_counter' => 0, 'spin_threshold' => 0] + $slotResult);
        }

        $link->query("UPDATE `roulette_state` SET `spin_counter` = LAST_INSERT_ID(`spin_counter` + 1), `jackpot_pool` = `jackpot_pool` + 10 WHERE `id`=1");
        $res = $link->query("SELECT LAST_INSERT_ID() AS c");
        $counter = $res ? intval($res->fetch_assoc()['c']) : 0;

        $res2 = $link->query("SELECT `spin_threshold`, `keyring_cycle_ends_at`, `jackpot_pool` FROM `roulette_state` WHERE `id`=1");
        $row = $res2 ? $res2->fetch_assoc() : ['spin_threshold' => 999999999, 'keyring_cycle_ends_at' => 0, 'jackpot_pool' => 3000];
        $threshold = intval($row['spin_threshold']);
        // 29.09.2026 (СРОЧНО, по прямому указанию — см. большой коммент у KEYRING_COOLDOWN_DAYS
        // выше): было жёстко захардкожено true — теперь честно читает 30-дневное окно ожидания
        // из БД. Пока time() < keyring_cycle_ends_at, сектор №1 физически исключается из выбора
        // ниже (_rollSlot) — 0% шанс, не "редкий шанс".
        $keyringAvailable = time() >= intval($row['keyring_cycle_ends_at']);
        $jackpotPool = intval($row['jackpot_pool']);

        $realJackpot = $counter >= $threshold;
        $jackpot = $realJackpot || $devForceJackpot || ($devForceIdx === 12);
        $jackpotResetInfo = null;
        if($realJackpot){
            $newThreshold = rand(3000, 3500);
            // Выплаченный пул сбрасывается на стартовую сумму (3000₽), из которой копится заново.
            $link->query("UPDATE `roulette_state` SET `spin_counter`=0, `spin_threshold`=$newThreshold, `jackpot_pool`=3000 WHERE `id`=1");
            $jackpotResetInfo = ['oldThreshold' => $threshold, 'newThreshold' => $newThreshold];
        }
        // dev-форс НЕ трогает общий счётчик/порог/пул выше — это тестовый исход для одного
        // игрока, реальный прогресс к джекпоту у всех остальных не двигается и не сбрасывается.

        $slotTrace = [];
        $slotResult = $this->_rollSlot($jackpot, $keyringAvailable, $user, $slotTrace, $devForceIdx);
        if($jackpot){
            // Одноразовое серверное право выбрать гарантированные 500р или риск-игру.
            // Используем уже существующее server-only поле roulette_cups: клиент не может
            // подделать его через users.save.
            $user['roulette_cups'] = json_encode(['__prize_choice__']);
        }

        // 29.09.2026 (СРОЧНО, по прямому указанию — см. большой коммент у KEYRING_COOLDOWN_DAYS
        // выше): Связка теперь выдаётся ПРЯМО здесь, в той же атомарной записи, что и остальные
        // поля этого спина — никакого отдельного claimKeyring()-запроса больше нет (ни лишней
        // точки отказа, ни эксплойта "вызови из консоли без реального выигрыша"). Как только
        // сектор №1 реально выпал (включая dev-форс, см. комментарий у _rollSlot) — сразу же
        // запираем ОБА способа (колесо и мини-игру) на 30 дней вперёд.
        if($slotResult['slotIdx'] === 0){
            $user['keyring_owner'] = 1;
            $link->query("UPDATE `roulette_state` SET `keyring_cycle_ends_at`=" . (time() + $this->KEYRING_COOLDOWN_DAYS * 86400) . " WHERE `id`=1");
        }
        $link->close();

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $patch = $this->ops->patchCurrencies($user, ['blue_points', 'coins', 'coins_earned', 'exp', 'cigarettes', 'roulette_spichki', 'dvor_games', 'keyring_owner']);

        $debug = [
            'fn' => 'spin', 'uid' => abs(intval($this->registry['uid'])),
            'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
            'globalCounterAfterIncrement' => $counter, 'globalThreshold' => $threshold,
            'jackpot' => $jackpot, 'devForceJackpot' => $devForceJackpot, 'jackpotResetInfo' => $jackpotResetInfo,
            'keyringAvailable' => $keyringAvailable, 'jackpotPool' => $jackpotPool,
            'slotTrace' => $slotTrace, 'slotResult' => $slotResult,
        ];
        error_log('[roulette.spin] ' . json_encode($debug));

        // 25.09.2026 (по прямому указанию — "показывай сбоку количество игр до комбинации"):
        // если джекпот только что реально выбит — счётчик/порог уже сброшены на новый цикл
        // (см. $jackpotResetInfo выше), отдаём АКТУАЛЬНЫЕ (новые) значения, а не устаревшие
        // $counter/$threshold от ДО сброса — иначе панель на миг показала бы "2999/3000" сразу
        // после победы вместо честного "0/<новый порог>".
        $spinCounterOut   = $realJackpot ? 0 : $counter;
        $spinThresholdOut = $realJackpot ? $jackpotResetInfo['newThreshold'] : $threshold;

        // 10.10.2026 (по прямому указанию — ТЗ "Игроки не должны видеть... под каким
        // стаканчиком он находится" + репорт "debug сливается в консоль браузера"): $debug
        // (globalCounterAfterIncrement/globalThreshold/slotTrace — честность розыгрыша) больше
        // НЕ уходит в ответ клиенту, остаётся ТОЛЬКО в error_log() выше (серверная диагностика).
        $this->registry['tools']->output(['patch' => $patch, 'jackpot' => $jackpot,
            'keyring_available' => $keyringAvailable, 'jackpot_pool' => $jackpotPool,
            'spin_counter' => $spinCounterOut, 'spin_threshold' => $spinThresholdOut] + $slotResult);
    }

    // Выбирает slotIdx (та же логика, что раньше была в dvor-roulette.js._spinRoulette()) и,
    // если это обычный слот (не 0/не 12), сразу начисляет валюту в $user по ссылке — включая
    // те же побочные эффекты, что раньше делал клиентский _give() для этих типов (coins_earned
    // за монеты, battlepass_xp как clientReward за опыт — battlepass ещё не мигрирован, тот же
    // приём, что dice.php.resolve()), и инкрементирует dvor_games (как dice.php/poker.php
    // resolve() уже делают за клиента). Возвращает ['slotIdx'=>.., 'reward'=>.., 'clientRewards'
    // =>[...]] — clientRewards непустой для auto/gun (оружие, клиент применяет сам через
    // weapons.grantAmmo(), как и у остальных ещё не мигрировавших наград) и/или battlepass_xp.
    private function _rollSlot($jackpot, $keyringAvailable, &$user, &$trace = null, $forceIdx = null){
        if($forceIdx !== null){
            $idx = $forceIdx;
            if($trace !== null) $trace[] = "DEV FORCE idx=$forceIdx без броска";
        } else if($jackpot){
            $idx = 12;
            if($trace !== null) $trace[] = 'jackpot=true → idx=12 без броска';
        } else if($keyringAvailable && mt_rand(1, $this->KEYRING_CHANCE_DENOM) === 1){
            // 29.09.2026 (по прямому указанию — "шанс 1/1000000, буквально на миллион игроков
            // один выигравший"): независимый редкий ролл НА КАЖДУЮ попытку, когда КД истёк — не
            // "раз окно открыто, обязательно кто-то выиграет в ближайших спинах".
            $idx = 0;
            if($trace !== null) $trace[] = "keyring доступен (КД истёк), редкий ролл 1/{$this->KEYRING_CHANCE_DENOM} СРАБОТАЛ → idx=0";
        } else {
            $attempt = 0;
            do{ $attempt++; $idx = mt_rand(0, 14); if($trace !== null) $trace[] = "попытка#$attempt idx=$idx (keyring недоступен ИЛИ редкий ролл не сработал — избегаем 12 и 0)"; } while($idx === 12 || $idx === 0);
        }

        $slot = $this->SPIN_SLOTS[$idx] ?? null;
        if($slot === null) return ['slotIdx' => $idx, 'reward' => null, 'clientRewards' => []]; // 0 или 12 — честные отдельные ветки

        $clientRewards = [];
        switch($slot['type']){
            case 'coins':
                $this->ops->add($user, 'coins', $slot['amt']);
                $user['coins_earned'] = $this->ops->i($user, 'coins_earned') + $slot['amt'];
                break;
            case 'exp':
                $this->ops->add($user, 'exp', $slot['amt']);
                $clientRewards[] = ['type' => 'battlepass_xp', 'amt' => max(1, intval(floor($slot['amt'] / 100)))];
                break;
            case 'cig':
                $this->ops->add($user, 'cigarettes', $slot['amt']);
                break;
            case 'roulette_spichki':
                $this->ops->add($user, 'roulette_spichki', $slot['amt']);
                break;
            case 'blue_points':
                $this->ops->add($user, 'blue_points', $slot['amt']);
                break;
            default: // auto/gun — гардероб/оружие ещё не перенесены на сервер, клиент применяет сам.
                $clientRewards[] = $slot;
        }
        $user['dvor_games'] = $this->ops->i($user, 'dvor_games') + 1;

        return ['slotIdx' => $idx, 'reward' => $slot, 'clientRewards' => $clientRewards];
    }

    // 29.09.2026 (СРОЧНО, по прямому указанию — см. большой коммент у KEYRING_COOLDOWN_DAYS в
    // шапке класса): публичный permit-эндпоинт claimKeyring() УДАЛЁН целиком — раньше клиент
    // вызывал его ОТДЕЛЬНЫМ запросом после спина, но сервер там НИКАК не проверял, что игрок
    // реально выбил сектор №1 — TS.php('roulette.claimKeyring', {}) из консоли браузера давал
    // keyring_owner=1 бесплатно и безусловно, в любой момент. Связка ключей колеса теперь
    // выдаётся ПРЯМО внутри spin() (см. slotResult['slotIdx']===0 там) — той же атомарной
    // записью, что и остальные поля спина, без отдельной сетевой точки отказа/эксплойта.
    // _tryClaimKeyring() ниже остался ТОЛЬКО как внутренний хелпер для pickCup() (мини-игра) —
    // туда попадают лишь reward-значения, которые сервер САМ заранее разложил по стаканчикам
    // (user['roulette_cups'], server-authoritative), клиент не может подделать этот путь.
    private function _tryClaimKeyring(){
        $user = $this->ops->loadUser();
        if(!$user) return false;
        $user['keyring_owner'] = 1;
        return $this->ops->saveUser($user);
    }

    // Гарантированная ветка сектора «Приз»: ровно 500 рублей, один раз.
    function claimPrize(){
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        $state = $this->ops->j($user, 'roulette_cups', null);
        if($state !== ['__prize_choice__']) return $this->ops->fail(85);

        $user['roulette_cups'] = null;
        $this->ops->add($user, 'coins', 500);
        $user['coins_earned'] = $this->ops->i($user, 'coins_earned') + 500;

        // 25.09.2026 (по прямому указанию — "ник победителя показывается повреждённым/
        // СТАЛКЕР"): запись победителя перенесена сюда с клиента (была client-writable
        // JSON.stringify() в dvor-roulette-screen.js, срабатывала ещё ДО выбора забрать/
        // рискнуть — "победитель" фиксировался, даже если игрок в итоге ничего не забрал).
        // Теперь пишет сам сервер, только в момент реального ЗАБРАТЬ 500р, читая настоящий
        // сохранённый ник игрока (не сиюминутный udata['nickname'] клиента), с явным
        // JSON_UNESCAPED_UNICODE (см. тот же класс фикса кириллицы в poker.php/blackjack.php,
        // а также исключение 'roulette_winner' из JSON-автопарсинга в database.php).
        $nick = trim(strval($user['nick'] ?? ''));
        $winner = ['name' => ($nick !== '' ? $nick : 'Сталкер'), 'amount' => 500, 'id' => abs(intval($this->registry['uid']))];
        $user['roulette_winner'] = json_encode($winner, JSON_UNESCAPED_UNICODE);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $patch = $this->ops->patchCurrencies($user, ['coins', 'coins_earned', 'roulette_winner']);
        $debug = ['fn'=>'claimPrize', 'uid'=>abs(intval($this->registry['uid'])), 'amount'=>500,
            'time'=>date('Y-m-d H:i:s'), 'microtime'=>microtime(true)];
        error_log('[roulette.claimPrize] ' . json_encode($debug));
        $this->ops->ok(['patch'=>$patch, 'amount'=>500, 'debug'=>$debug]);
    }

    // Открытие мини-игры "9 стаканчиков" после выигрыша джек-пота. Награды формируются
    // сервером и сохраняются В СТРОКЕ ИГРОКА (roulette_cups) — раскрываются только по
    // pickCup(), чтобы клиент не видел все 9 призов заранее.
    function openMinigame(){
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        $choice = $this->ops->j($user, 'roulette_cups', null);
        if($choice !== ['__prize_choice__']) return $this->ops->fail(85);

        $link = $this->_rawLink();
        if(!$link) return $this->registry['tools']->output(['ok' => false]);

        // Куш: счётчик ОТКРЫТЫХ мини-игр, общий на всех игроков (мини-игра сама по себе
        // редкая — привязана к глобальному джек-поту, поэтому per-player счётчик почти
        // никогда бы не набирался).
        // 26.09.2026 (по прямому указанию — исправление логики Куша): счётчик/порог сбрасываются
        // ТОЛЬКО при реальном выигрыше Куша (см. pickCup() ниже, ветка reward==='kush'), не в
        // момент, когда Куш просто появляется в раскладке 9 стаканчиков. Раньше сброс происходил
        // прямо здесь, как только kushCounter достигал порога — если игрок в ЭТОЙ мини-игре не
        // угадывал нужный стаканчик, Куш "сгорал" без выигрыша, а следующая мини-игра стартовала
        // со свежим счётчиком от 0, как будто Куш никогда не появлялся. По ТЗ Куш должен
        // оставаться "на кону" и появляться в раскладке КАЖДОЙ следующей мини-игры, пока игрок
        // его не заберёт.
        $link->query("UPDATE `roulette_state` SET `kush_counter` = kush_counter + 1 WHERE `id`=1");
        $res2 = $link->query("SELECT `kush_counter`, `kush_threshold`, `keyring_cycle_ends_at` FROM `roulette_state` WHERE `id`=1");
        $row = $res2 ? $res2->fetch_assoc() : ['kush_counter' => 0, 'kush_threshold' => 999, 'keyring_cycle_ends_at' => 0];
        $kushCounter = intval($row['kush_counter']);
        $kushThreshold = intval($row['kush_threshold']);
        // 29.09.2026 (СРОЧНО, по прямому указанию — см. большой коммент у KEYRING_COOLDOWN_DAYS
        // в шапке класса): было жёстко захардкожено true — теперь честно читает то же
        // 30-дневное окно, что и spin(). Пока КД не истёк — 'keyring' в cups не попадает вообще,
        // шанс строго 0%. Когда истёк — тот же независимый редкий ролл 1/KEYRING_CHANCE_DENOM,
        // что и на колесе (ФИНАЛЬНОЕ уточнение 29.09.2026 — "шанс 1/1000000, буквально на
        // миллион игроков один выигравший", не "раз окно открыто — обязательно попадёт в cups").
        $keyringOnCooldown = time() < intval($row['keyring_cycle_ends_at']);
        $keyringAvailable = !$keyringOnCooldown && mt_rand(1, $this->KEYRING_CHANCE_DENOM) === 1;

        $hasKush = $kushCounter >= $kushThreshold;
        $link->close();

        // остальное — случайно из обычного пула (с повторами, пул небольшой).
        // Раскладываем 9 стаканчиков: Куш (если выпал порог) + личная Связка +
        // остальное — случайно из обычного пула (с повторами, пул небольшой).
        // остальное — случайно из обычного пула (с повторами, пул небольшой).
        $cups = [];
        if($hasKush) $cups[] = 'kush';
        if($keyringAvailable) $cups[] = 'keyring';
        while(count($cups) < 9){
            $r = $this->CUP_POOL[array_rand($this->CUP_POOL)];
            $cups[] = $r['type'] . ':' . $r['amt'];
        }
        shuffle($cups);

        $user['roulette_cups'] = json_encode($cups);
        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

        $debug = [
            'fn' => 'openMinigame', 'uid' => abs(intval($this->registry['uid'])),
            'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
            'kushCounter' => $kushCounter, 'kushThreshold' => $kushThreshold, 'hasKush' => $hasKush,
            'keyringAvailable' => $keyringAvailable, 'cups' => $cups,
        ];
        error_log('[roulette.openMinigame] ' . json_encode($debug));

        // 10.10.2026 (по прямому указанию — ТЗ "Игроки не должны видеть... под каким
        // стаканчиком [куш/связка] находится" + репорт "debug сливается в консоль браузера"):
        // $debug содержит ПОЛНЫЙ массив 'cups' (что лежит под КАЖДЫМ из 9 стаканчиков, включая
        // позицию куша/связки) — это и есть прямая утечка честности раздачи, если бы ушло в
        // ответ. Больше НЕ уходит клиенту, остаётся ТОЛЬКО в error_log() выше.
        $this->registry['tools']->output(['ok' => true]);
    }

    // Игрок выбрал стаканчик idx (0-8) — сервер смотрит, что сам же туда положил
    // в openMinigame(), и выдаёт именно это. Куш проверяется на выдаче; Связка — личная
    // награда и может быть сохранена у любого количества игроков.
    function pickCup(){
        $idx = intval($this->registry['user_params']['idx'] ?? -1);
        if($idx < 0 || $idx > 8) return $this->ops->fail(3);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $cups = $this->ops->j($user, 'roulette_cups', null);
        if(!is_array($cups) || !isset($cups[$idx])) return $this->ops->fail(3);

        $reward = $cups[$idx];
        $user['roulette_cups'] = null; // одноразово — повторно pickCup ничего не даст

        $debugBase = ['fn' => 'pickCup', 'uid' => abs(intval($this->registry['uid'])),
            'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
            'idx' => $idx, 'allCups' => $cups, 'reward' => $reward];

        if($reward === 'kush'){
            $this->ops->add($user, 'coins', $this->KUSH_AMOUNT);
            $user['coins_earned'] = $this->ops->i($user, 'coins_earned') + $this->KUSH_AMOUNT;
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            // Реальный выигрыш Куша — вот теперь счётчик/порог сбрасываются (см. комментарий в
            // openMinigame()), новый случайный порог 6-8 для следующего цикла.
            $link = $this->_rawLink();
            if($link){
                $newT = rand(6, 8);
                $link->query("UPDATE `roulette_state` SET `kush_counter`=0, `kush_threshold`=$newT WHERE `id`=1");
                $link->close();
            }
            error_log('[roulette.pickCup] ' . json_encode($debugBase + ['result' => 'kush']));
            // 10.10.2026 (по прямому указанию — ТЗ "не должны видеть под каким стаканчиком" +
            // репорт "debug сливается в консоль"): $debugBase содержит 'allCups' — ПОЛНУЮ
            // раскладку всех 9 стаканчиков. Больше НЕ уходит клиенту (все 4 исхода pickCup()
            // ниже), остаётся ТОЛЬКО в error_log() строкой выше.
            $this->ops->ok(['type' => 'coins', 'amt' => $this->KUSH_AMOUNT, 'kush' => true,
                'patch' => $this->ops->patchCurrencies($user, ['coins','coins_earned'])]);
            return;
        }
        if($reward === 'keyring'){
            // 29.09.2026 (СРОЧНО, по прямому указанию — см. большой коммент у
            // KEYRING_COOLDOWN_DAYS в шапке класса): раньше здесь звался _tryClaimKeyring()
            // (отдельный loadUser()+saveUser() поверх УЖЕ загруженного $user этой функции) —
            // двойная запись в БД вместо одной (тот же $user уже несёт roulette_cups=null,
            // выставленный строкой выше). Теперь keyring_owner ставится прямо на уже
            // загруженный $user и уходит ОДНИМ атомарным saveUser() — как и в spin(). Сразу же
            // запираем ОБА способа получения (колесо и мини-игру) на 30 дней вперёд.
            $user['keyring_owner'] = 1;
            $got = $this->ops->saveUser($user);
            if($got){
                $link = $this->_rawLink();
                if($link){
                    $link->query("UPDATE `roulette_state` SET `keyring_cycle_ends_at`=" . (time() + $this->KEYRING_COOLDOWN_DAYS * 86400) . " WHERE `id`=1");
                    $link->close();
                }
            }
            error_log('[roulette.pickCup] ' . json_encode($debugBase + ['result' => 'keyring', 'gotKeyring' => $got]));
            if($got){
                $this->ops->ok(['type' => 'keyring', 'amt' => 1,
                    'patch' => $this->ops->patchCurrencies($user, ['keyring_owner'])]);
            } else {
            // Сохранение не удалось — не оставляем игрока совсем без награды.
                $user['keyring_owner'] = null; // не даём частично записанному значению уйти в следующий saveUser()
                $this->ops->add($user, 'exp', 1000);
                if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
                $this->ops->ok(['type' => 'exp', 'amt' => 1000, 'missed_keyring' => true,
                    'patch' => $this->ops->patchCurrencies($user, ['exp']),
                    'clientRewards' => [['type'=>'battlepass_xp','amt'=>10]]]);
            }
            return;
        }
        // 26.09.2026 (по прямому указанию — откат правки 25.09.2026): обычный (не Куш, не Связка)
        // исход стаканчика снова выдаёт РЕАЛЬНУЮ награду, которую сервер заранее разложил в
        // openMinigame() (CUP_POOL: автомат/пистолет/мачете/сигареты/спички/опыт/синие поинты),
        // а не фиксированные 50 рублей одного вида под всеми 7 стаканчиками. Попап "Утешительный
        // приз" на клиенте остаётся (см. res.consolation ниже), просто теперь показывает
        // конкретный тип+сумму вместо захардкоженного "+50".
        list($type, $amt) = explode(':', $reward);
        $amt = intval($amt);
        $patchKeys = [];
        $clientRewards = [];
        if($type === 'cig'){ $this->ops->add($user, 'cigarettes', $amt); $patchKeys[] = 'cigarettes'; }
        else if($type === 'roulette_spichki'){ $this->ops->add($user, 'roulette_spichki', $amt); $patchKeys[] = 'roulette_spichki'; }
        else if($type === 'exp'){
            $this->ops->add($user, 'exp', $amt); $patchKeys[] = 'exp';
            $clientRewards[] = ['type'=>'battlepass_xp', 'amt'=>max(1, intval(floor($amt / 100)))];
        }
        else if($type === 'blue_points'){ $this->ops->add($user, 'blue_points', $amt); $patchKeys[] = 'blue_points'; }
        else { $clientRewards[] = ['type'=>$type, 'amt'=>$amt]; } // auto/gun/machete — клиент выдаёт сам (weapons.grantAmmo)
        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        error_log('[roulette.pickCup] ' . json_encode($debugBase + ['result' => 'consolation', 'type' => $type, 'amt' => $amt]));
        $this->ops->ok(['type' => $type, 'amt' => $amt, 'consolation' => true,
            'patch' => $this->ops->patchCurrencies($user, $patchKeys),
            'clientRewards' => $clientRewards]);
    }
}
?>

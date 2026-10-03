<?php
Class Gameops {
    private $registry;

    function __construct($registry){
        $this->registry = $registry;
    }

    function loadUser($fields = ['*']){
        $user = $this->registry['udb']->getData($this->registry['utb'], $fields, 'id='.$this->registry['uid']);
        if(isset($user['error']) && $user['error']) return null;
        return $user;
    }

    // 26.09.2026 (по прямому живому репорту, скриншот — "поздравляют с уровнем 22 уже 40
    // раз"): колонка users.level в БД писалась ТОЛЬКО дефолтом '1' при создании/сбросе
    // аккаунта (users.php._defaultResetUdata()) и больше НИКОГДА не обновлялась сервером —
    // реальный уровень считает только клиент (interface.js.updateNick(), из exp) и держит его
    // ТОЛЬКО в памяти (udata['level'] = String(level), без users.save). Любой полный рефреш
    // строки игрока с сервера (users.get — например modules/bank.js._refreshBalanceAfterPurchase
    // после каждой покупки, но не только) отдаёт СТАРОЕ '1' из БД, updateNick() на следующий
    // тик снова видит level(22) > prevLevel(1) из "свежих" данных и открывает попап повторно —
    // при частых рефрешах (несколько покупок подряd) попап всплывает раз за разом. Фикс —
    // здесь, а не в конкретном контроллере: saveUser() — центральная точка почти ВСЕХ
    // server-authoritative записей (loadUser() грузит полную строку, вызывающий код мутирует
    // нужные поля и передаёт её же обратно), поэтому 'exp' почти всегда присутствует в $update.
    // Пересчитываем level той же формулой, что и клиент (interface.js.updateNick()), и молча
    // добавляем в $update — держит DB level в согласии с exp при любом сохранении, без
    // отдельного вызова в каждом контроллере.
    function saveUser($update){
        if(isset($update['exp'])){
            $exp = intval($update['exp']);
            $level = max(0, (int)floor((-1 + sqrt(1 + $exp / 5)) / 2));
            $update['level'] = (string)$level;
        }
        $update['id'] = $this->registry['uid'];
        $result = $this->registry['udb']->saveData($this->registry['utb'], $update);
        if(isset($result['error']) && $result['error']) return false;
        return true;
    }

    function i($user, $key, $default = 0){
        return intval(isset($user[$key]) ? $user[$key] : $default);
    }

    function j($user, $key, $default = []){
        if(!isset($user[$key]) || $user[$key] === '' || $user[$key] === null) return $default;
        // Баг найден 18.09.2026 (при проектировании dice.php): Database::trueJSON() (нет
        // core/samples/tables/*.php → $this->sample всегда false → работает единственная
        // "no sample" ветка) для ЛЮБОГО непустого JSON-поля САМА подменяет сырую строку на
        // уже распарсенный PHP-массив ПРЯМО В $user (см. её же комментарий в zone.js:
        // "Database::trueJSON может вернуть JSON-поле уже декодированным объектом"). Эта
        // функция передавала $user[$key] в json_decode() БЕЗ проверки — если поле уже было
        // декодировано в массив (что бывает для КАЖДОГО непустого JSON-поля, читаемого через
        // Gameops::loadUser()), json_decode(array, ...) кидает TypeError (PHP 8: массив
        // нельзя привести к string) → 500 без единой строки в error_log про саму причину.
        // Уже был живой пример — bosses.php._isLocCleared() читает 'zone' этой функцией;
        // у ЛЮБОГО игрока с непустым прогрессом зоны startFight() падал бы фатально.
        if(is_array($user[$key])) return $user[$key];
        $decoded = json_decode($user[$key], true);
        return is_array($decoded) ? $decoded : $default;
    }

    // Database::trueJSON() возвращает JSON-поля уже PHP-массивами, тогда как значение,
    // подготовленное непосредственно перед saveUser(), обычно остаётся JSON-строкой.
    // Сравнение этих представлений через !== всегда даёт ложное расхождение. Приводим
    // обе стороны к JSON-структурам и сравниваем данные, а не их представление в памяти.
    function sameJsonState($saved, $loaded){
        if(is_string($saved)) $saved = json_decode($saved, true);
        if(is_string($loaded)) $loaded = json_decode($loaded, true);
        return is_array($saved) && is_array($loaded) && $saved == $loaded;
    }

    function deduct(&$user, $currency, $amount){
        $amount = intval($amount);
        if($amount <= 0) return true;
        $have = $this->i($user, $currency);
        if($have < $amount) return false;
        $user[$currency] = $have - $amount;
        if($currency === 'stew'){
            $user['stew_spent'] = $this->i($user, 'stew_spent') + $amount;
        }
        return true;
    }

    function add(&$user, $currency, $amount){
        $amount = intval($amount);
        if($amount === 0) return;
        $user[$currency] = $this->i($user, $currency) + $amount;
    }

    // Энергия: 1 единица каждые ENERGY_REGEN_SEC секунд — та же формула, что
    // Timers.ENERGY_REGEN_SEC в _client/src/modules/timers.js (см. её зеркальный клиентский
    // хелпер Timers._regenSnapshot()).
    const ENERGY_REGEN_SEC = 300;

    // 28.09.2026 (репорт игрока — "энергия не восстанавливается или не сохраняется",
    // скриншот: 5 энергии спустя ~2 часа простоя) + повторный вопрос про старый баг
    // "потратил энергию — 5-минутный кулдаун сбросился заново, хотя до этого прошло уже
    // 3 из 5 минут": считает энергию ПРЯМО СЕЙЧАС по серверным часам и одновременно
    // возвращает "схлопнутую" базовую метку времени — она хранит уже накопленный остаток
    // (remainder) до следующей единицы, а не отбрасывает его. Раньше
    // zone.php.fillCheckpoint() тратил энергию и жёстко писал energy_time=time() —
    // ЛЮБАЯ трата (даже частичный прогресс 4 из 5 минут) обнуляла отсчёт следующей
    // единицы целиком до полных 5 минут. Тот же класс бага, что раньше был в клиентском
    // Timers.spendEnergy() (energy_base_time=Date.now() без учёта остатка) — тот метод
    // сейчас не вызывается (энергия тратится через сервер), но формула ниже — общий
    // источник истины для energy_time и на клиенте (Timers._regenSnapshot()), и здесь.
    function energySnapshot($user){
        $saved     = $this->i($user, 'energy', 0);
        $savedTime = $this->i($user, 'energy_time', 0);
        $maxEnergy = $this->i($user, 'max_energy', 50) ?: 50;
        $now       = time();
        if($savedTime <= 0){
            // Нет валидной базовой метки (новый аккаунт / сброс dev-панелью) — начинаем
            // отсчёт с нуля, остатка тратить нечего.
            return [$saved, $now];
        }
        $elapsed   = max(0, $now - $savedTime);
        $ticks     = intdiv($elapsed, self::ENERGY_REGEN_SEC);
        $remainder = $elapsed - $ticks * self::ENERGY_REGEN_SEC;
        $energy    = max($saved, min($maxEnergy, $saved + $ticks));
        // Если энергия уже упёрлась в потолок — остатка до "следующей единицы" нет,
        // держать его незачем (он всё равно обнулится при следующей трате ниже потолка).
        $baseTime  = ($energy >= $maxEnergy) ? $now : ($now - $remainder);
        return [$energy, $baseTime];
    }

    // Единая точка списания энергии с сохранением остатка прогресса (см. energySnapshot()
    // выше). Используется и zone.php.fillCheckpoint(), и base.php.train() — раньше
    // train() тратил энергию через обычный deduct() (сырое значение из БД, без учёта
    // регенерации, накопленной с последнего сохранения) и не трогал energy_time вовсе,
    // а zone.php считал сам и жёстко сбрасывал время — два разных, рассинхронизированных
    // поведения для одной и той же механики.
    function spendEnergy(&$user, $amount){
        $amount = intval($amount);
        if($amount <= 0) return true;
        list($current, $baseTime) = $this->energySnapshot($user);
        if($current < $amount) return false;
        $user['energy']      = $current - $amount;
        $user['energy_time'] = $baseTime;
        return true;
    }

    // Выдаёт ещё не полученный предмет только из указанного серверного источника. Состояние
    // остаётся в $user и сохраняется вызывающим контроллером одной транзакционной записью.
    function grantShmotFromSource(&$user, $source){
        $state = $this->j($user, 'shmot', []);
        $pool = [];
        foreach($this->catalog('shmot_items') as $item){
            if(($item['source'] ?? null) !== $source) continue;
            $id = intval($item['id']);
            if(empty($state[$id]['owned'])) $pool[] = $id;
        }
        if(empty($pool)) return null;
        $id = $pool[array_rand($pool)];
        while(count($state) <= $id) $state[] = ['owned' => false, 'equipped' => false];
        $state[$id]['owned'] = true;
        $user['shmot'] = json_encode($state);
        $this->applyShmotOwnBonus($user, $id);
        return $id;
    }

    // Выдаёт конкретный серверный предмет. Нужен там, где награда привязана к
    // комбинации (AA/KK/QQ), а не должна выбираться случайно из пула источника.
    function grantShmotById(&$user, $id){
        $id = intval($id);
        $found = false;
        foreach($this->catalog('shmot_items') as $item){
            if(intval($item['id']) === $id){ $found = true; break; }
        }
        if(!$found) return null;
        $state = $this->j($user, 'shmot', []);
        while(count($state) <= $id) $state[] = ['owned' => false, 'equipped' => false];
        if(!empty($state[$id]['owned'])) return null;
        $state[$id]['owned'] = true;
        $user['shmot'] = json_encode($state);
        $this->applyShmotOwnBonus($user, $id);
        return $id;
    }

    // 28.09.2026 (по прямому указанию — новая экономика бонусов шмота, "выбил — получил"):
    // раньше бонус max_energy от предмета (bk:'max_e') считал КЛИЕНТ по надетым вещам и сам же
    // перезаписывал udata['max_energy'] целиком — client-writable поле, плюс перезапись стирала
    // серверные начисления max_energy от Василича/Хапуги/банды/зданий базы при каждой смене
    // экипировки. Теперь бонус начисляется РАЗ, в момент получения вещи (owned=true) — той же
    // аддитивной дельтой, что уже используют vassilich.php/hapuga.php для своих max_energy-
    // наград, поэтому со старыми начислениями не конфликтует. Вызывать сразу после ЛЮБОГО
    // owned=true для shmot — единой точки внедрения на все места выдачи нет (см. 7 мест:
    // grantShmotFromSource() выше, bosses.php×3, rewardlinks.php, yashik.php×2, shmot.php.buy()).
    function applyShmotOwnBonus(&$user, $itemId){
        foreach($this->catalog('shmot_items') as $it){
            if(intval($it['id']) !== intval($itemId)) continue;
            if(($it['bk'] ?? '') === 'max_e'){
                // Бонус выдаётся за владение, не за экипировку, и строго один раз на
                // конкретный предмет. Повторный ответ, ретрай или миграция не удвоят лимит.
                $state = $this->j($user, 'shmot', []);
                while(count($state) <= $itemId) $state[] = ['owned'=>false,'equipped'=>false];
                if(empty($state[$itemId]['energy_bonus_applied'])){
                    $this->add($user, 'max_energy', intval($it['bv']));
                    $state[$itemId]['energy_bonus_applied'] = true;
                    $user['shmot'] = json_encode($state);
                }
            }
            break;
        }
    }

    // 28.09.2026 (по прямому указанию — "вся игра должна ориентироваться на московское время"):
    // единая точка для ЛЮБОГО дневного лимита/сброса в игре — раньше date('Y-m-d')/
    // gmdate('Y-m-d') были разбросаны по bosses.php/poker.php/blackjack.php/tasks.php, каждый
    // со своей полночью по локальным часам PHP-процесса (нигде явно не выставлены
    // date_default_timezone_set() — де-факто UTC, см. таймстампы в php_errors.log). МСК = UTC+3
    // фиксированно (Россия отменила переход на летнее время в 2014 — DST не бывает).
    //
    // 29.09.2026 (по прямому указанию — уточнение формулировки от 28.09.2026): разворот СНОВА
    // на 00:00 МСК ("полночь"), а не 12:00 — при первой формулировке "сбрасывать в 12" имелась
    // в виду именно полночь ("12 ночи"), а не полдень; игроки ложились спать ожидая, что лимиты
    // обновятся к утру, но реальный разворот происходил только в полдень. МСК-полночь (00:00
    // МСК) = 21:00 UTC ПРЕДЫДУЩЕГО календарного дня. gmdate() всегда считает от UTC независимо
    // от timezone-настроек сервера — сдвиг эпохи на +3 часа (МСК = UTC+3) и есть сама МСК-дата:
    // gmdate('Y-m-d', $now+3ч) даёт КАЛЕНДАРНУЮ ДАТУ по московским часам напрямую, потому что
    // прибавка ровно компенсирует разницу поясов, а gmdate() форматирует получившийся момент как
    // если бы он был в UTC (что эквивалентно чтению его же в МСК без прибавки).
    function mskDailyDate($now = null){
        if($now === null) $now = time();
        return gmdate('Y-m-d', $now + 3 * 3600);
    }

    // Момент (мс, UTC epoch) СЛЕДУЮЩЕГО разворота дня — 00:00 МСК ближайшей будущей полуночи,
    // относительно $now. Нужен местам, которые показывают игроку обратный отсчёт до сброса
    // (blackjack.php._dailyState().nextFreeAt). 00:00 МСК календарного дня, СЛЕДУЮЩЕГО за
    // $today (mskDailyDate), в UTC — это ровно "$today 21:00:00 UTC" (00:00 МСК завтрашнего дня
    // = 21:00 UTC СЕГОДНЯШНЕГО $today, т.к. МСК = UTC+3) — без +86400: та граница, что открыла
    // текущий $today, была ($today минус 1 день) 21:00 UTC, а закрывает его (следующая граница)
    // — ровно $today 21:00 UTC, уже в будущем относительно $now по построению mskDailyDate().
    function mskNextResetMs($now = null){
        if($now === null) $now = time();
        $today = $this->mskDailyDate($now);
        return strtotime($today . ' 21:00:00 UTC') * 1000;
    }

    function catalog($name){
        return $this->registry['json']->get($name, true);
    }

    function ok($extra = []){
        $this->registry['tools']->output(array_merge(['ok' => 1], $extra));
    }

    function fail($code){
        return $this->registry['tools']->error($code);
    }

    function patchCurrencies($user, $keys = null){
        if($keys === null){
            // 23.09.2026 (баг по репорту — "достижения по энергии появляются с опозданием"):
            // energy_spent добавлен в ДЕФОЛТНЫЙ набор — раньше его не было здесь, только в
            // явном списке ключей zone.php.fillCheckpoint(). Любой другой эндпоинт, который
            // тратит энергию и зовёт patchCurrencies() без явного списка (например
            // base.php.train() — см. коммент там же), раньше МОЛЧА не присылал обновлённое
            // значение клиенту в patch, из-за чего achievements.js._checkAll() (читает его
            // синхронно из udata на клиенте) видел устаревшее значение до следующей полной
            // загрузки udata (users.get / перезаход) — отсюда и "ачивки появляются пачкой при
            // следующем заходе".
            // 27.09.2026: coins_spent добавлен той же причине, что и energy_spent выше —
            // base.php.upgrade()/vassilich.php.buy() теперь тоже считают её сами (см. коммент
            // там же), без явного ключа клиент узнавал бы новое значение только при следующей
            // полной загрузке udata, а не сразу после покупки.
            // 28.09.2026: energy_time добавлен той же причине, что energy_spent выше —
            // без него клиент (patch.js.applyPatch()) не узнаёт свежую базовую метку
            // регенерации и живёт с устаревшей до следующей полной перезагрузки udata,
            // из-за чего HUD-таймер "+1 через N:NN" и сама регенерация рассинхронизируются
            // с сервером сразу после любой траты энергии в текущей сессии.
            $keys = ['coins','stew','cigarettes','energy','energy_time','health','exp','max_energy',
                     'vassilich_buys','stew_spent','coins_spent','habar_counts','habar_opened',
                     'bp_level','bp_xp','bp_xp_next','bp_claimed',
                     'shmot','gang_id','gang_data','base_buildings','base_stats','base_location',
                     'train_count','svod_claimed','zadaniya','weapon_machete','weapon_pistol','weapon_ak','boss_keys',
                     'energy_spent'];
        }
        $patch = [];
        foreach($keys as $k){
            if(array_key_exists($k, $user)) $patch[$k] = $user[$k];
        }
        return $patch;
    }
}
?>

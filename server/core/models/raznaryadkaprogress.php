<?php
/** 23.10.2026 (по прямому указанию — новая фича "Разнарядка", месячный календарь ежедневных
 * заданий): центральный хук автозачёта прогресса, вызываемый ИЗ ДРУГИХ контроллеров после
 * успешного игрового действия (bosses.claimKill, zone.fillCheckpoint, dvor.collectCig,
 * zaruba.fight/pump, dice/blackjack/poker/roulette resolve) — см. "ПРАВИЛО №9" в AGENTS.md,
 * ту же модель server-authoritative награды, что у остальных игр.
 *
 * ⚠️ ДИЗАЙН: RaznaryadkaProgress::report() делает СОБСТВЕННЫЙ независимый loadUser()->saveUser()
 * цикл — не переиспользует $user вызывающего контроллера (тот мог быть загружен ДО текущих
 * изменений, использование его снимка создало бы риск затереть чужие поля устаревшим
 * значением, см. AGENTS.md "Критичные общие функции" — тот же инвариант, что уже ловил баги в
 * _commitFightSession()). Вызывать ОБЯЗАТЕЛЬНО ПОСЛЕ собственного saveUser() вызывающего
 * контроллера — тогда наш независимый loadUser() увидит уже закоммиченные изменения, и
 * итоговый saveUser($user) здесь перезапишет их теми же значениями (no-op diff для чужих
 * полей, Database::saveData() пишет только то, что реально изменилось от снимка loadUser()).
 * loadUser() — ПОЛНАЯ строка (не узкий список полей): _rollover()→_grantTier() может через
 * Gameops::add() начислить монеты/оружие по непройденным порогам прошлого месяца, а add()
 * читает ТЕКУЩЕЕ значение поля из $user — при узкой выборке оно читалось бы как 0 и
 * ЗАТЁРЛО бы реальный баланс игрока при итоговом saveUser(). Единственный остаточный риск —
 * редкая гонка ДВУХ report() подряд за доли секунды (параллельные вкладки/запросы) теряет
 * один инкремент прогресса — приемлемо для счётчика задания (не экономическая дыра,
 * самоисправляется следующим действием), поэтому не берём SELECT...FOR UPDATE лок ради этого
 * (сознательный компромисс, не упущение).
 *
 * report() НИКОГДА не бросает исключение наружу — обёрнут в try/catch, чтобы сбой в
 * второстепенном учёте задания не уронил основное действие (убийство босса и т.п.).
 */
class RaznaryadkaProgress {

    // МСК = UTC+3, сервер физически в UTC (см. Gameops::mskDailyDate() — тот же сдвиг,
    // уже принятый по всему проекту для дневных лимитов/кулдаунов).
    static function mskNow(){
        $t = new DateTime('now', new DateTimeZone('UTC'));
        $t->modify('+3 hours');
        return $t;
    }

    static function mskMonthKey(){
        return self::mskNow()->format('Y-m');
    }

    static function mskDay(){
        return intval(self::mskNow()->format('j'));
    }

    static function daysInMskMonth(){
        return intval(self::mskNow()->format('t'));
    }

    // 27.10.2026 (баг найден по прямому указанию — "форснул на ноябрь, показывается 27 ноября,
    // а должно быть 1 ноября"): дни-в-месяце для ЛЮБОГО конкретного "YYYY-MM" ключа (не только
    // реального текущего) — ноябрь (30 дней) короче октября (31), использовать daysInMskMonth()
    // (дни РЕАЛЬНОГО текущего месяца) для форснутого вперёд месяца было в принципе неверно.
    static function daysInMonthFor($monthKey){
        $dt = DateTime::createFromFormat('Y-m-d', $monthKey . '-01', new DateTimeZone('UTC'));
        return $dt ? intval($dt->format('t')) : self::daysInMskMonth();
    }

    // 27.10.2026 (баг найден по прямому указанию, тот же репорт): "база" дня ДО прибавления
    // dev_day_offset — реальный mskDay(), ПОКА $data['month'] совпадает с реальным текущим
    // месяцем. Но devForceLaunchMonth() (ниже) переключает $data['month'] на month ВПЕРЕДИ
    // реального (например "2026-11" при реальном "2026-10") — raw mskDay() в этом случае
    // возвращал число дня из РЕАЛЬНОГО (октябрьского) "сегодня" (например 27), которое для
    // форснутого месяца не имеет смысла: эффективный день становился "27 ноября" вместо
    // ожидаемого "1 ноября" (старт форснутого месяца). Форснутый вперёд месяц всегда стартует
    // с дня 1, dev_day_offset (ПОЭТОМУ devSkipDay() тоже использует baseDay()) двигает его дальше.
    static function baseDay($data){
        $month = $data['month'] ?? self::mskMonthKey();
        return ($month > self::mskMonthKey()) ? 1 : self::mskDay();
    }

    // 24.10.2026 (по прямому указанию — "кнопка, при нажатии на которую следующий день
    // становится автоматически", дев-панель): "сегодня" внутри Разнарядки жёстко завязано на
    // реальные МСК-часы сервера (mskDay()) — настоящего "пропуска дня" без подмены ВСЕГО
    // системного времени не сделать, а трогать часы сервера ради теста одной фичи нельзя (задело
    // бы вообще все остальные server-authoritative таймеры/кулдауны проекта). Вместо этого —
    // локальный для Разнарядки сдвиг, хранится в raznaryadka_data.dev_day_offset (НЕ whitelist,
    // server-only поле, тот же паттерн, что и остальное состояние фичи): effectiveDay() = база
    // (см. baseDay() выше) + offset, использует его ВСЯ логика фичи вместо голого mskDay() — и
    // report() (чтобы реальное игровое действие после "пропуска" засчиталось именно в пропущенный
    // день), и getState()/payDay()/devCompleteToday()/devFailDay()/devSeedMonth(). Капается на
    // последний день ЦЕЛЕВОГО месяца ($data['month'], не обязательно реального текущего) —
    // переход за его пределы привёл бы к пустому $dayCfg везде, где monthCfg['days'][...] не
    // найден. Offset живёт внутри raznaryadka_data — при смене месяца (_rollover() ниже создаёт
    // новый пустой $data) сам обнуляется, отдельно сбрасывать не нужно.
    static function effectiveDay($data){
        $offset = max(0, intval($data['dev_day_offset'] ?? 0));
        $month = $data['month'] ?? self::mskMonthKey();
        return min(self::baseDay($data) + $offset, self::daysInMonthFor($month));
    }

    static function loadConfig($ops){
        return $ops->catalog('raznaryadka_config');
    }

    // ── ГЕНЕРАЦИЯ МЕСЯЧНОГО СПИСКА ЗАДАНИЙ (23.10.2026, по прямому указанию пользователя
    // после разговора с заказчиком: "рандом полный, но количество заданий должно равняться
    // количеству дней в месяце") ──
    //
    // Раньше список на месяц писался вручную (конкретный тип+need на каждый день) — теперь
    // список полностью случайный, но ГЕНЕРИРУЕТСЯ ЗАРАНЕЕ инструментом (см.
    // tools/gen_raznaryadka_month.php) и сохраняется в raznaryadka_config.json — заказчику
    // нужен готовый список НАПЕРЁД, чтобы опубликовать его постом в группе ВК до начала месяца.
    // generateMonth() — не "угадывание на лету": тот же метод используется и CLI-инструментом
    // (чтобы напечатать список для публикации), и как подстраховка в monthConfig() ниже (на
    // случай, если для месяца забыли подготовить список заранее) — важно, чтобы при
    // одинаковом $seed результат был воспроизводим (mt_srand), а после генерации сид сбрасывался
    // (mt_srand() без аргумента), чтобы не детерминировать остальной рандом текущего PHP-запроса.
    // 23.10.2026 (уточнение по прямому указанию, продиктован точный список "Список ежедневных
    // заданий" — заказчик зафиксировал РОВНО эти 30 вариантов, не произвольный набор): раньше
    // пул был собран по собственному усмотрению (включал Крыса/Баркута/Бороду/Жгута, 1000
    // сухарей, зарубиться×5 — ничего из этого в присланном списке НЕТ) — заменён на точное
    // соответствие. Босс — 4 отдельные строки (Охотник/Счастливчик/Ястреб/Меченный, boss_id
    // 0..3), а не 1 строка со случайным boss_id 0..7, как было — так пул копирует список
    // буквально (каждая строка списка = одна строка пула), и generateMonth() ниже не нуждается
    // в пост-обработке boss_id отдельным mt_rand().
    static function taskPool(){
        return [
            ['type' => 'boss',      'need' => 1, 'boss_id' => 0], // Победить Охотника
            ['type' => 'boss',      'need' => 1, 'boss_id' => 1], // Победить Счастливчика
            ['type' => 'boss',      'need' => 1, 'boss_id' => 2], // Победить Ястреба
            ['type' => 'boss',      'need' => 1, 'boss_id' => 3], // Победить Меченного
            ['type' => 'energy',    'need' => 15],
            ['type' => 'energy',    'need' => 25],
            ['type' => 'energy',    'need' => 50],
            ['type' => 'energy',    'need' => 100],
            ['type' => 'blackjack', 'need' => 1],
            ['type' => 'blackjack', 'need' => 5],
            ['type' => 'blackjack', 'need' => 10],
            ['type' => 'dice',      'need' => 1],
            ['type' => 'dice',      'need' => 5],
            ['type' => 'dice',      'need' => 10],
            ['type' => 'roulette',  'need' => 1],
            ['type' => 'roulette',  'need' => 5],
            ['type' => 'sukhari',   'need' => 30],
            ['type' => 'sukhari',   'need' => 60],
            ['type' => 'sukhari',   'need' => 90],
            ['type' => 'sukhari',   'need' => 200],
            ['type' => 'sukhari',   'need' => 500],
            ['type' => 'respect',   'need' => 100],
            ['type' => 'respect',   'need' => 500],
            ['type' => 'respect',   'need' => 1000],
            ['type' => 'zaruba',    'need' => 10],
            ['type' => 'zaruba',    'need' => 20],
            ['type' => 'zaruba',    'need' => 40],
            ['type' => 'kachalka',  'need' => 10],
            ['type' => 'kachalka',  'need' => 20],
            ['type' => 'kachalka',  'need' => 40],
        ];
    }

    static function generateMonth($daysInMonth, $seed){
        mt_srand($seed);
        $pool = self::taskPool();
        $days = [];
        for($d = 1; $d <= $daysInMonth; $d++){
            $days[strval($d)] = $pool[mt_rand(0, count($pool) - 1)];
        }
        mt_srand(); // сбрасываем сид — не влиять на остальной рандом текущего запроса
        return ['days' => $days];
    }

    // Единая точка резолва конфига месяца — сперва заранее подготовленный список из JSON,
    // и только если его там нет (месяц забыли сгенерировать заранее) — безопасный фоллбэк на
    // ту же генерацию "по требованию" (детерминированную по $monthKey, чтобы повторный вызов
    // в течение того же месяца не "переехал" на другой список).
    static function monthConfig($config, $monthKey, $daysInMonth){
        if(isset($config['months'][$monthKey])) return $config['months'][$monthKey];
        error_log('[RaznaryadkaProgress.monthConfig] месяц ' . $monthKey . ' не подготовлен заранее — генерирую на лету (см. tools/gen_raznaryadka_month.php)');
        return self::generateMonth($daysInMonth, crc32($monthKey));
    }

    // Человекочитаемое название задания — из task_labels + подстановка need/boss_name.
    // ⚠️ config['boss_names'] хранит ВИНИТЕЛЬНЫЙ падеж ("Охотника", не "Охотник") — найдено
    // тестом tests/_php_fixtures/raznaryadka-core.php (Test 3): шаблон "Победить {boss_name}"
    // грамматически требует "кого?" (винительный), подставлять именительное имя сюда нельзя.
    // Перенесено сюда из контроллера Raznaryadka (23.10.2026) — нужно также CLI-инструменту
    // tools/gen_raznaryadka_month.php для печати списка, а он не создаёт контроллер.
    static function taskLabel($config, $dayCfg){
        if(!$dayCfg) return '';
        $tpl = $config['task_labels'][$dayCfg['type']] ?? $dayCfg['type'];
        $need = intval($dayCfg['need'] ?? 0);
        $bossName = isset($dayCfg['boss_id']) ? ($config['boss_names'][intval($dayCfg['boss_id'])] ?? '') : '';
        return str_replace(['{need}', '{boss_name}'], [strval($need), $bossName], $tpl);
    }

    // Закрывает текущий сохранённый месяц (автосбор невыбранных наград — см. doc, "Все
    // заработанные, но не забранные награды автоматически начисляются игроку при месячном
    // сбросе") и стартует $newMonth с пустого состояния. Вынесено из _rollover() ниже
    // 25.10.2026 (по прямому указанию, dev-кнопка "переключить на ноябрь" в dev_panel.js) —
    // та же логика закрытия месяца нужна И на реальной границе календарного месяца
    // (_rollover(), $newMonth = mskMonthKey()), И для dev-инструмента, который симулирует
    // переход на launch_month, не трогая реальные системные часы (это сломало бы все
    // остальные таймеры/кулдауны игры, см. ПРАВИЛО №3 AGENTS.md).
    static function _closeMonthAndStartNew($ops, &$user, $data, $config, $newMonth){
        if(!empty($data['month']) && !empty($data['days']) && (!isset($config['launch_month']) || $data['month'] >= $config['launch_month'])){
            // Автосбор невыбранных наград прошлого месяца — считаем done-дни и выдаём ВСЕ
            // пороги, до которых прошлый месячный прогресс дотянул, но игрок не забрал.
            $doneCount = 0;
            foreach($data['days'] as $d){ if(($d['status'] ?? '') === 'done') $doneCount++; }
            $claimed = $data['claimed'] ?? [];
            $monthCfg = $config['months'][$data['month']] ?? null;
            $daysInThatMonth = $monthCfg ? count($monthCfg['days']) : 0;
            foreach($config['reward_tiers'] as $tier){
                $need = $tier['need'] == -1 ? $daysInThatMonth : $tier['need'];
                if($doneCount >= $need && !in_array($need, $claimed, true)){
                    self::grantTier($ops, $user, $tier);
                    error_log('[RaznaryadkaProgress._closeMonthAndStartNew] автосбор невыбранной награды прошлого месяца | tier_need=' . $need . ' | newMonth=' . $newMonth);
                }
            }
        }

        return ['month' => $newMonth, 'days' => [], 'claimed' => []];
    }

    // Текущий месяц игрока в raznaryadka_data мог не совпадать с реальным МСК-месяцем
    // (первый заход в этом месяце, либо просто давно не заходил) — приводим к актуальному.
    //
    // 26.10.2026 (баг найден по прямому указанию — "нажимаю на НА НОЯБРЬ, ничего не меняется"):
    // раньше ЛЮБОЕ несовпадение (не только "реальное время обогнало сохранённый месяц", но и
    // "сохранённый месяц обогнал реальное время") откатывало данные к mskMonthKey(). Это молча
    // СХЛОПЫВАЛО dev-форснутый вперёд месяц (devForceLaunchMonth(), например '2026-11' при
    // реальном '2026-10') обратно к реальному на самом первом же getState()/claim()/payDay()/
    // report() ПОСЛЕ форса — кнопка выглядела так, будто вообще ничего не делает. Откат нужен
    // ТОЛЬКО когда сохранённый месяц СТРОГО МЕНЬШЕ реального (обычный помесячный переход) —
    // сравнение строк "YYYY-MM" лексикографически корректно работает как числовое (тот же приём,
    // что уже используется для isPreLaunch/featureLive в raznaryadka.php).
    static function _rollover($ops, &$user, $data, $config){
        $curMonth = self::mskMonthKey();
        $storedMonth = $data['month'] ?? null;
        if($storedMonth === $curMonth) return $data;
        if($storedMonth !== null && $storedMonth > $curMonth) return $data; // dev-форснут вперёд — не трогаем
        return self::_closeMonthAndStartNew($ops, $user, $data, $config, $curMonth);
    }

    // 25.10.2026 (по прямому указанию — "кнопка, при нажатии на которую ежедневные задания
    // станут такими, как будто на 1 ноября", dev-панель): переключает месяц Разнарядки сразу
    // на config['launch_month'] (сейчас "2026-11") — закрывает текущий месяц ТОЙ ЖЕ логикой,
    // что обычная граница календарного месяца (_rollover() выше), только целевой месяц не из
    // mskMonthKey(), а из конфига. dev_day_offset НЕ переносится в новый $data (свежий объект
    // без этого ключа) — effectiveDay() трактует отсутствующий ключ как 0, так что "сегодня"
    // внутри нового месяца автоматически возвращается к реальному дню, старый offset не тянется
    // за сменой месяца. Возвращает null, если launch_month не задан в конфиге (ничего не делает).
    static function devForceLaunchMonth($ops, &$user){
        $config = self::loadConfig($ops);
        $data = $ops->j($user, 'raznaryadka_data', []);
        if(!is_array($data)) $data = [];
        $targetMonth = $config['launch_month'] ?? null;
        if(!$targetMonth) return null;
        return self::_closeMonthAndStartNew($ops, $user, $data, $config, $targetMonth);
    }

    // 27.10.2026 (по прямому указанию — "добавь кнопку вернуть как должно быть... мне нужно
    // чтобы было два таких состояния, я мог их проверять": pre-launch и live): обратная операция
    // к devForceLaunchMonth() выше — закрывает текущий (возможно форснутый вперёд) месяц той же
    // логикой автосбора наград и стартует РЕАЛЬНЫЙ текущий МСК-месяц с чистого состояния, чтобы
    // можно было снова увидеть pre-launch картину ("Скоро", без крестиков) без ожидания реального
    // календарного отката. Не трогает системные часы сервера — тот же принцип, что у
    // devForceLaunchMonth().
    static function devRevertToRealMonth($ops, &$user){
        $config = self::loadConfig($ops);
        $data = $ops->j($user, 'raznaryadka_data', []);
        if(!is_array($data)) $data = [];
        return self::_closeMonthAndStartNew($ops, $user, $data, $config, self::mskMonthKey());
    }

    // 24.10.2026 (по прямому указанию — "награда пистолет/автомат должна давать стволы,
    // которые используются при битве с боссом, не абстрактный счётчик"): 1-в-1 порт
    // dice.php._grantWeaponReward() (которая сама — порт poker.php._grantWeaponReward(),
    // см. комментарий там) — пишет напрямую в weapons-блоб (id3=мачете/4=ствол/5=автомат) +
    // зеркалит в legacy-колонку ammo_<type>, тот же путь, что и честная покупка
    // (weapons.php.buy()). 'gun_count'/'auto_count' (прежние поля reward_tiers) оказались
    // абстрактными счётчиками для ачивок (achievementengine.php), НЕ реальным инвентарём
    // оружия — вдобавок багрепорт "нельзя собрать награду пистолет/автомат" объясняется тем
    // же: похоже, эти колонки вообще не существуют в реальной схеме БД (нет ни одной
    // ALTER TABLE/миграции на них), поэтому saveUser() ронял весь UPDATE целиком.
    static function _grantWeaponReward($ops, &$user, $type, $amount){
        $wid = ['machete' => 3, 'gun' => 4, 'auto' => 5][$type] ?? null;
        $amount = max(0, intval($amount));
        if($wid === null || $amount === 0) return;
        $data = $ops->j($user, 'weapons', []);
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

    static function grantTier($ops, &$user, $tier){
        if(!empty($tier['field']))        $ops->add($user, $tier['field'], intval($tier['amt']));
        if(!empty($tier['weapon_type']))  self::_grantWeaponReward($ops, $user, $tier['weapon_type'], intval($tier['amt']));
        if(!empty($tier['bonus_field']))       $ops->add($user, $tier['bonus_field'], intval($tier['bonus_amt']));
        if(!empty($tier['bonus_weapon_type'])) self::_grantWeaponReward($ops, $user, $tier['bonus_weapon_type'], intval($tier['bonus_amt']));
        // 25.10.2026 (по прямому указанию): сет "Исполнитель" (Бита/Худи белая/Худи
        // коричневая, ids 117-119 в server/json/shmot_items.json + _client/src/game/shmot.js) —
        // приз за полный месяц ежедневных заданий (need:-1 tier). Один случайный ещё НЕ
        // полученный предмет из 3 — та же логика пула "не повторяется, пока не выбиты все", что
        // у остальных source-сетов (см. Gameops::grantShmotFromSource()). Когда все 3 уже
        // получены, пул пуст — grantShmotFromSource() тихо возвращает null, игрок просто не
        // получает шмотку в этом месяце (coins/bonus_weapon_type тира продолжают начисляться
        // как обычно, это не зависит от шмот-пула).
        // 26.10.2026 (по прямому указанию — "маска должна выпадать не из ежедневных заданий, а
        // из игры 2048"): 4-й предмет сета, Маска (id116), ИСКЛЮЧЁН из этого пула — его source
        // в shmot_items.json переключён на "game2048", выдаётся отдельно через
        // game2048.php.craft() (90 фрагментов), не через этот tier.
        if(!empty($tier['shmot_source'])) $ops->grantShmotFromSource($user, $tier['shmot_source']);
    }

    // Общая точка входа для контроллера (getState/claim/payDay) и для report() ниже — грузит
    // $user, применяет rollover прошлого месяца (если нужно) и возвращает {data, config}.
    // $user передаётся по ссылке и выходит из функции УЖЕ смутированным (возможные начисления
    // _grantTier() внутри rollover) — вызывающий код обязан сам сохранить его (saveUser()) по
    // завершении своей операции, эта функция НЕ сохраняет сама (контроллер может захотеть
    // домутировать $user ещё чем-то перед единственным saveUser() в конце своего метода).
    static function loadAndRollover($ops, &$user){
        $config = self::loadConfig($ops);
        $data = $ops->j($user, 'raznaryadka_data', []);
        if(!is_array($data)) $data = [];
        $data = self::_rollover($ops, $user, $data, $config);
        return [$data, $config];
    }

    // Центральный хук — звать ПОСЛЕ успешного завершения (и, желательно, ПОСЛЕ собственного
    // saveUser()) действия в вызывающем контроллере — см. докблок файла про независимый цикл.
    // ⚠️ loadUser() здесь БЕЗ сужения полей (полная строка) — не узкий ['id','raznaryadka_data']:
    // _rollover()→_grantTier() может через Gameops::add() начислить монеты/оружие по
    // непройденным порогам прошлого месяца, а add() читает ТЕКУЩЕЕ значение поля из $user —
    // при узкой выборке это читалось бы как 0 и ЗАТЁРЛО бы реальный баланс игрока при saveUser().
    static function report($ops, $kind, $amount = 1, $meta = []){
        try {
            $user = $ops->loadUser();
            if(!$user) return;

            list($data, $config) = self::loadAndRollover($ops, $user);
            if(isset($config['launch_month']) && $data['month'] < $config['launch_month']) return;
            // 27.10.2026: дни-в-месяце СЧИТАЕМ ПО ЦЕЛЕВОМУ $data['month'] (daysInMonthFor), не по
            // реальному текущему — см. баг в докблоке daysInMonthFor()/baseDay() выше.
            $monthCfg = self::monthConfig($config, $data['month'], self::daysInMonthFor($data['month']));
            $dayKey = strval(self::effectiveDay($data));
            $dayCfg = $monthCfg['days'][$dayKey] ?? null;
            $matches = $dayCfg && $dayCfg['type'] === $kind
                // Задание с привязкой к конкретному боссу ('boss', meta.boss_id) — сверяем id,
                // иначе "Победить Охотника" засчиталось бы убийством ЛЮБОГО босса.
                && !($kind === 'boss' && isset($dayCfg['boss_id']) && intval($dayCfg['boss_id']) !== intval($meta['boss_id'] ?? -1));

            if($matches){
                if(!isset($data['days'][$dayKey])) $data['days'][$dayKey] = ['prog' => 0, 'status' => 'pending'];
                if(($data['days'][$dayKey]['status'] ?? '') !== 'done'){
                    $data['days'][$dayKey]['prog'] = intval($data['days'][$dayKey]['prog']) + intval($amount);
                    if($data['days'][$dayKey]['prog'] >= intval($dayCfg['need'])) $data['days'][$dayKey]['status'] = 'done';
                }
            }

            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            $ops->saveUser($user);
        } catch (Throwable $e) {
            error_log('[RaznaryadkaProgress.report] НЕ КРИТИЧНО (основное действие уже применено) — ошибка учёта задания: ' . $e->getMessage() . ' | kind=' . $kind);
        }
    }
}
?>

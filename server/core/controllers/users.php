<?php
	Class Users {
        private $registry, $friends_top, $ops;

        // Разрешённые тестовые аккаунты dev-панели. Проверка серверная:
        // скрытие кнопки в клиенте не защищает от ручного TS.php-вызова.
        private function _isDevUser(){
            return in_array(strval($this->registry['uid']), ['1113977365', '382448269'], true);
        }

        private function _requireDevUser(){
            if($this->_isDevUser()) return true;
            $this->registry['tools']->error(403);
            return false;
        }

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            // 28.09.2026 (см. energy-бутстрап в get() ниже + фикс devGrantShmot()): раньше
            // отсутствовал вовсе — devGrantShmot() уже вызывал $this->ops->loadUser() без
            // единой инициализации, что падало фатальной ошибкой "Call to a member function
            // loadUser() on null" при каждом вызове. Тот же паттерн, что во всех остальных
            // Gameops-контроллерах (см. CLAUDE.md, правило №9).
            $this->ops = new Gameops($registry);

            $this->permits = ['get', 'save', 'getProfile', 'resetSession', 'setFriendsScopeGranted', 'setFriendsCache', 'devGrantWeapons', 'devGrantShmot', 'devGrantCurrency', 'devSetRyukzakLevel', 'setDevFlag', 'setDevCombo', 'toggleDevKeyring', 'resetAllPlayers'];
        }

        function get(){
            $time = time();

            isset($this->registry['user_params']['hash']) ? $this->registry['hash'] = $this->registry['user_params']['hash'] : $this->registry['hash'] = false;
            
            //if(isset($this->registry['user_params']['id']))return $this->customUser(); для захода в друзья

            $user = $this->registry['udb']->getData($this->registry['utb'], array('*'), 'id='.$this->registry['uid']);

            if(isset($user['error']) && $user['error']){
                // 26.09.2026 (РЕВЕРТ по прямому указанию — "изначально у каждого игрока нет
                // сета новопришедшего, но его можно купить в магазине за сигареты"): 25.09.2026
                // здесь стояла специальная генерация стартового набора при создании аккаунта —
                // отменена полностью, тот приватный метод удалён из класса. Предметы
                // новопришедшего (id94/95/97) теперь ОБЫЧНЫЕ покупные вещи с ценой в сигаретах
                // (см. price в game/shmot.js и server/json/shmot_items.json), ничем не
                // отличаются от любого другого товара магазина — специальной выдачи при
                // создании аккаунта больше нет.
                //
                // 27.09.2026 (по прямому репорту — "новый игрок не получает дефолтные 10 рублей
                // и 1000 сигарет"): причина — этот $user_arr (единственное место, где реально
                // создаётся строка НОВОГО игрока, см. INSERT..ON DUPLICATE KEY UPDATE в
                // Database::saveData()) никогда не выставлял coins/cigarettes явно, значения
                // молча брались из DEFAULT колонки в БД (там '0', не '10'/'1000' по ТЗ) — в
                // отличие от _defaultResetUdata() ниже в этом же файле, где coins=>'10',
                // cigarettes=>'1000' были верны, но resetSession/resetAllPlayers на путь
                // создания нового аккаунта не влияют. Добавлены явные стартовые значения по ТЗ
                // ("Старт: 1к сигарет, 10 рублей, 0 тушёнки, 0 опыта, уровень 1") — только для
                // ВНОВЬ создаваемой строки, существующих игроков эта ветка не затрагивает.
                $user_arr = array(
                                    'id'=>$this->registry['uid'],
                                    'exp'=>0,
                                    'coins'=>10,
                                    'cigarettes'=>1000,
                                    'create_time'=>time(),
                                    'visit'=>time(),
                                    'shmot'=>'[]'
                                );

                $save_result = $this->registry['udb']->saveData($this->registry['utb'], $user_arr);

                if(isset($save_result['error']) && $save_result['error']){
                    return $this->registry['tools']->error(99);
                }

                $user = $this->registry['udb']->getData($this->registry['utb'], array('*'), 'id='.$this->registry['uid']);

                if(isset($user['error']) && $user['error']){
                    return $this->registry['tools']->error(99);
                }
            }

            $user = $this->setFriends($user);

            // 28.09.2026 (массовый репорт игроков в VK-чате — "энергия обнуляется после
            // перезагрузки", "сколько ни зайду — одно и то же число", "данные устарели,
            // энергии 0 стало, лока не пройдена"): корень — energy_time никогда не
            // инициализируется для аккаунта, который ЕЩЁ НИ РАЗУ не тратил энергию через
            // Gameops::spendEnergy() (zone.fillCheckpoint/base.train — единственные два места,
            // которые его пишут, см. energySnapshot() в gameops.php). Пока energy_time<=0,
            // energySnapshot() честно возвращает "анкер = сейчас" КАЖДЫЙ раз, но НИКУДА его не
            // сохраняет — тот же приём использует и клиентский Timers.updateFromUdata()
            // (эфемерно, только для дисплея). Итог: в рамках одной сессии энергия визуально
            // тикает вверх от локального "анкер = момент открытия игры" — но эта база каждый
            // раз считается заново и никогда не долетает до БД. Следующая перезагрузка находит
            // тот же исходный (нерегенерированный) energy в БД и энергия "внезапно" падает —
            // именно это игроки видят как обнуление. users.get() — единственная точка, которую
            // проходит КАЖДЫЙ логин/перезаход, поэтому бутстрап здесь закрывает баг для всех
            // аккаунтов разом: один раз на аккаунт (после этого energy_time>0 навсегда, пока
            // явно не тратится/не сбрасывается), дальше обычная формула (клиент + spendEnergy())
            // работает как задумано.
            if($this->ops && intval($user['energy_time'] ?? 0) <= 0){
                list($liveEnergy, $liveBaseTime) = $this->ops->energySnapshot($user);
                $user['energy'] = $liveEnergy;
                $user['energy_time'] = $liveBaseTime;
                $this->ops->saveUser(['id' => $this->registry['uid'], 'energy' => $liveEnergy, 'energy_time' => $liveBaseTime]);
            }

            $user = $this->registry['tools']->refresh($user, [], true);

            $this->registry['tools']->output(array('udata'=>$user, 'friends_top'=>$this->friends_top));
        }

        // ── ПУБЛИЧНЫЙ ПРОФИЛЬ ИГРОКА (18.09.2026, по прямому указанию) ──
        //
        // Клик по фото/нику ЛЮБОГО игрока (рамка "УБИВШИЙ" у боссов, рейтинг урона, рамка
        // уважения в Зоне, топ по авторитету/урону/достижениям) открывает страницу с его
        // персонажем и надетыми шмотками — тот же визуал, что на главном экране, но чужой.
        // Отдаёт ТОЛЬКО безопасный публичный срез полей — специально НЕ включает
        // coins/stew/inventory/weapons и прочую личную экономику, только то, что нужно для
        // отрисовки персонажа и подписи (ник/уровень). id — любой валидный игрок, не только
        // друг (та же открытость, что уже есть у bosses.rating()/killers() — nick там тоже
        // виден не только друзьям).
        function getProfile(){
            $id = intval($this->registry['user_params']['id'] ?? -1);
            if($id <= 0) return $this->registry['tools']->error(54);

            $row = $this->registry['udb']->getData(
                $this->registry['utb'],
                ['id', 'nick', 'exp', 'respect', 'shmot', 'bosses_killed', 'total_damage',
                 'gang_id', 'str_xp_total', 'achievement_stars', 'skills_levels', 'habar_bought', 'create_time'],
                'id=' . $id
            );
            if(isset($row['error']) && $row['error']) return $this->registry['tools']->error(51);

            $shmotRaw = isset($row['shmot']) ? $row['shmot'] : null;
            $shmot = is_array($shmotRaw) ? $shmotRaw : (is_string($shmotRaw) && $shmotRaw !== '' ? json_decode($shmotRaw, true) : []);
            if(!is_array($shmot)) $shmot = [];

            // Визитка игрока / заруба (19.09.2026, по прямому указанию) — «Сила» это
            // НАКОПЛЕННЫЙ опыт качалки str_xp_total (растёт без ограничения тренировками в
            // base.js._trainStat, тот же счётчик, что и достижения категории "сила"), а НЕ
            // уровень 1-50 (base_stats[0].level) — уровень отдельная механика с потолком,
            // а в дуэлях/на визитке нужно именно растущее число (подтверждено пользователем
            // на примере "СИЛА 1897" — такое значение уровень 1-50 дать не может).
            $strength = intval($row['str_xp_total'] ?? 0);

            // «Скиллов» — сумма уровней всех прокачанных скиллов из служебного skills_levels
            // (пишет только сервер, см. skills.php) из максимума total_points в skills_config.json.
            $skillsRaw = isset($row['skills_levels']) ? $row['skills_levels'] : null;
            $skillsData = is_array($skillsRaw) ? $skillsRaw : (is_string($skillsRaw) && $skillsRaw !== '' ? json_decode($skillsRaw, true) : []);
            $skillsLevels = (is_array($skillsData) && isset($skillsData['levels']) && is_array($skillsData['levels'])) ? $skillsData['levels'] : [];
            $skillsTotal = array_sum(array_map('intval', $skillsLevels));
            $skillsCatalog = $this->registry['json']->get('skills_config', true);
            $skillsMax = intval($skillsCatalog['total_points'] ?? 0);

            // «Рейтинг» — 29.09.2026 (по прямому указанию + скриншот визитки — "сделай привязку
            // к уровню игрока, кто на каком месте по опыту, такое и место в рейтинге"): раньше
            // здесь считалось место в топе по УРОНУ (та же метрика, что top.php cat=0 «ТОП ПО
            // УРОНУ» на Сводке) — по факту это была не связанная с уровнем/опытом визитки метрика
            // (визитка показывает УРОВЕНЬ игрока над рейтингом, но сам рейтинг ранжировал по
            // total_damage). Теперь ранжируем по `exp` — тот же столбец, из которого клиент
            // считает уровень (см. CLAUDE.md "Уровни: 0→1 = 40 опыта..."), поэтому место в
            // рейтинге напрямую совпадает с местом по уровню/опыту, ничьи внутри одного уровня
            // разрешаются по большему опыту (более гранулярно, чем ранжирование по самому
            // уровню, но эквивалентно для игроков на разных уровнях).
            // 29.09.2026 (баг найден по прямому репорту + скриншоту визитки — "топ-1 по уровню,
            // а в визитке рейтинг #2", "я #2 в топе, в визитке #3"): счётчик места не исключал
            // служебный HIDDEN_FROM_TOP_UID (см. top.php, аккаунт с заведомо большим exp,
            // скрытый из ВИДИМЫХ списков топа). Место здесь считалось COUNT(*)+1 по ВСЕМ
            // игрокам с exp больше моего — этот скрытый аккаунт молча попадал в COUNT, поэтому
            // КАЖДОМУ реальному игроку место было завышено на 1 относительно того, что он видит
            // в самом списке топа (откуда скрытый аккаунт уже вырезан). Фикс — та же exclusion,
            // что top.php уже применяет к спискам (id != HIDDEN_FROM_TOP_UID), добавлена и сюда.
            $myExp = intval($row['exp'] ?? 0);
            $placeRow = $this->registry['udb']->trueSQL(
                "SELECT COUNT(*)+1 AS place FROM `{$this->registry['utb']}` WHERE `exp`-0 > {$myExp} AND `id` != 1113977365"
            );
            $ratingPlace = isset($placeRow['place']) ? intval($placeRow['place']) : 0;

            $this->registry['tools']->output([
                'id'                => intval($row['id']),
                'nick'              => strval($row['nick'] ?? ''),
                'exp'               => intval($row['exp'] ?? 0),
                'respect'           => intval($row['respect'] ?? 0),
                'shmot'             => $shmot,
                'bosses_killed'     => intval($row['bosses_killed'] ?? 0),
                'total_damage'      => intval($row['total_damage'] ?? 0),
                'gang_id'           => strval($row['gang_id'] ?? ''),
                'strength'          => $strength,
                'achievement_stars' => intval($row['achievement_stars'] ?? 0),
                'skills_total'      => $skillsTotal,
                'skills_max'        => $skillsMax,
                'rating_place'      => $ratingPlace,
                'habar_bought'      => intval($row['habar_bought'] ?? 0),
                'create_time'       => intval($row['create_time'] ?? 0),
            ]);
        }

        function save(){
            $raw = isset($this->registry['user_params']['udata_json'])
                ? $this->registry['user_params']['udata_json']
                : '';

            if(!$raw){
                return $this->registry['tools']->error(98);
            }

            $incoming = json_decode($raw, true);
            if(!is_array($incoming)){
                return $this->registry['tools']->error(97);
            }

            // Белый список разрешённых к сохранению полей
            $allowed = [
                'exp','energy','energy_time','health',
                // 29.09.2026 (закрытие класса бага, см. память агента
                // incident_checkall_flush_wipes_server_credits — уже третий репорт того же
                // класса, "покупка/награда не начисляет валюту"): 'coins'/'stew'/'cigarettes'
                // УБРАНЫ из этого whitelist (были здесь с самого начала). Причина всегда одна и
                // та же — ЛЮБАЯ клиентская мутация udata (достижения при пересечении порога,
                // оптимистичный UI казино, дев-инструменты) триггерит общий дебаунс-автосейв
                // (player-save.js), который может улететь на сервер СО СТАРЫМ локальным снимком
                // валюты и затереть свежее серверное начисление (вебхук VK, Gameops::add()/
                // deduct() в контроллерах) — точечно чинили уже 3 раза для разных симптомов
                // одной причины (votes_spent, coins_spent/stew_spent, roulette_spichki — см.
                // соседние комментарии в этом файле). Реальные начисления/списания уже полностью
                // server-authoritative — все контроллеры пишут через Gameops::add()/deduct()+
                // saveUser(), в обход этого whitelist. Единственный легитимный клиентский путь,
                // писавший эти поля напрямую — dev-кнопки (dev_panel.js._addU()/_giveMillion(),
                // debug-tools.js GIVE_MILLION) — переведён на новый узкий permit
                // devGrantCurrency() ниже (тот же паттерн, что devGrantWeapons()/devGrantShmot()).
                // users.get()/patch по-прежнему отдают клиенту актуальное значение на чтение —
                // whitelist влияет только на save().
                //
                // 04.10.2026 (аудит по прямому указанию — "найди дыры"): 'zone','base_buildings',
                // 'base_stats','gang_id' УБРАНЫ отсюда (были здесь раньше, БЕЗ какого-либо guard —
                // в отличие от weapons/inventory чуть ниже). Все четыре давно полностью
                // server-authoritative через выделенные permit-ы: zone.fillCheckpoint/
                // captureLocation/upgradeBusiness/collectIncome, base.upgrade/train,
                // gangs.join (все пишут через Gameops::saveUser(), в обход этого whitelist).
                // Пока поля оставались здесь БЕЗ guard, читер мог одним users.save подложить
                // zone:{biz:[10,10,10],cleared:999} (макс. бизнес/разблокировка боссов без
                // реальной зачистки), base_buildings/base_stats с level:10 (бесплатная мгновенная
                // прокачка базы/качалки) или gang_id:'5' (постоянный +20% урона — ЕДИНСТВЕННОЕ
                // реальное применение gang_id, bosses.php._gangBonus()/zone.php._gangBonus(),
                // БЕЗ проверки, что gangs.join() вообще разрешил вступление — сам join()
                // сейчас заблокирован $BETA_LOCKED, но это не защищало от прямой записи сюда).
                // Побочный эффект: gangs.js._toggleJoin()/base.js._upgradeBuilding()/
                // zone.js._saveToUdata() всё ещё ОПТИМИСТИЧНО пишут эти поля в udata локально
                // (эхо уже подтверждённого сервером значения, не новый вектор) — теперь это
                // безвредный no-op при автосейве, сервер молча игнорирует ключ, как и для
                // остальных полей в этом списке. users.get()/patch по-прежнему отдают клиенту
                // актуальное значение на чтение.
                'base_location',
                'gang_data','weapons','inventory',
                'hapuga_items','hapuga_sold','hapuga_refreshes','hapuga_avail','hapuga_next_ts',
                'svod_claimed',
                'habar_counts','bot_settings','bot_running',
                'days_played',
                // 28.09.2026 (по прямому указанию — перенос источников max_energy на сервер):
                // 'max_energy' УБРАНО отсюда — писать его теперь может только сам сервер
                // (Gameops::applyShmotOwnBonus() при выдаче шмота, skills.php.upgrade() для
                // Адреналина, + уже существовавшие vassilich.php/hapuga.php/zone.php). Раньше
                // клиент сам считал сумму max_e-бонусов НАДЕТЫХ вещей и полностью перезаписывал
                // это поле (shmot.js._applyMaxEnergyBonus(), теперь удалён) — при каждой смене
                // экипировки стирались все серверные начисления от банды/скиллов/Василича/Хапуги.
                'total_damage','zone_fights','dvor_wins','bosses_killed','habar_opened',
                'train_count','vassilich_buys','coins_earned',
                // 27.09.2026 (аудит по прямому указанию, тот же класс проблемы, что уже чинили
                // 26.09.2026 для sedoy_dmg_total/sedoy_dmg_left — см. коммент ниже про
                // coins_spent): 'stew_spent' УБРАНО отсюда — полностью server-authoritative,
                // пишут ТОЛЬКО habar.php.buy()/vassilich.php.buy()/base.php.upgrade()/
                // hapuga.php.buy()/gangs.php.donate() (Gameops::deduct() для валюты 'stew' +
                // явное +=amount там, где deduct() сам это не ведёт) и blackjack.php/bosses.php/
                // weapons.php/shmot.php/poker.php — все через Gameops::saveUser(), в обход этого
                // whitelist. Пока поле оставалось здесь, обычный дебаунс-автосейв клиента
                // (queuePlayerSave) мог долететь до users.save() со СТАРЫМ локальным stew_spent
                // (снятым ДО applyPatch() от одного из перечисленных эндпоинтов) и, придя позже,
                // тихо затереть свежий счётчик обратно — внешне выглядело как "ачивки трат
                // (spend_stew) иногда откатываются назад". users.get()/patch по-прежнему отдают
                // клиенту актуальное значение — whitelist влияет только на save().
                'bosses_data','zone_income_time','respect','dvor_games','dvor_daily',
                'zone_fights_0','zone_fights_1','zone_fights_2','zone_fights_3','zone_fights_4',
                'natisk_event_id','natisk_free_attempts','natisk_paid_attempts','natisk_kills',
                'natisk_seen_event_id',
                'skills_data','skill_points',
                // 26.09.2026 (перенос сбора сигарет во дворе на сервер, см. dvor.php.collectCig()
                // и tests/dead-code-audit-dvor-fla-roulette-removed-cig-cloud-risk.test.js
                // «Находка 1»): 'dvor_daily_sigs' УБРАНО из этого списка — читер мог обнулить
                // его прямо через users.save() и собирать 4×30 сигарет неограниченное число раз
                // за день. Теперь это server-only session-поле (тот же класс, что dice_session/
                // roulette_cups) — пишет только dvor.php через Gameops::loadUser()/saveUser(),
                // в обход этого whitelist. users.get() по-прежнему отдаёт его клиенту НА ЧТЕНИЕ
                // (SELECT '*') — клиент видит, какие облачка уже собраны сегодня, просто больше
                // не может это подделать через users.save.
                'dvor_games_data',
                'dice_points','blue_points','poker_chips',
                // poker_spichki is awarded only by poker.resolve(). Achievement
                // thresholds consume it, so users.save must not accept it.
                // 28.09.2026 (репорт "спички рулетки выдаются вдвойне"): 'roulette_spichki'
                // УБРАНО отсюда же по той же причине — awarded only by roulette.php._rollSlot()
                // (spin()). Пока поле оставалось здесь client-writable, achievements.js.
                // onDvorGame('roulette', {spichki}) прибавляло к нему reward.sp ВТОРОЙ раз поверх
                // уже актуального серверного значения (получаемого через applyPatch() ДО этого
                // вызова) — обычный дебаунс-автосейв (queuePlayerSave, триггерится любой мутацией
                // udata) отправлял этот удвоенный локальный снимок как есть. users.get()/patch
                // по-прежнему отдают клиенту актуальное серверное значение на чтение — whitelist
                // влияет только на save(). Клиентское удвоение убрано отдельно (achievements.js).
                'ammo_auto','ammo_gun','ammo_machete',
                'hata_progress','base_bg_owned','base_bg_active',
                'stash_data','stash_count',
                // 25.09.2026 (по прямому указанию, живой репорт — "шмотки не сохраняются" +
                // "урон без шмоток"): 'shmot' УБРАН из whitelist (было здесь раньше). Owned уже
                // писался только сервером (shmot.php.buy()/боссовые дропы, через
                // Gameops::saveUser(), в обход whitelist) — но equipped писал ЦЕЛИКОМ клиент
                // (game/shmot.js._onWear() → generic users.save), в т.ч. без гарантии "один
                // предмет на категорию". Debounce-автосейв мог не долететь до сервера к моменту
                // bosses.attack() — сервер читал СТАРОЕ equipped, бонус шмотки не применялся к
                // уроне, хотя клиент уже визуально считал его надетым. Теперь пишет только
                // shmot.php.equip() (см. там же) — тот же паттерн, что уже применён к
                // skills_levels/achievements/ryukzak_points/keyring_owner выше.
                // 25.09.2026 (по прямому указанию — фикс повреждённого ника победителя):
                // 'roulette_winner' убран из whitelist — теперь его пишет ТОЛЬКО сервер
                // (roulette.php.claimPrize(), полная строка через Gameops::saveUser()), клиент
                // раньше мог сам вписать сюда произвольное имя/сумму через users.save.
                'boss_kills_0','boss_kills_1','boss_kills_2',
                'bj_games','dice_games','energy_spent',
                // 26.09.2026 (баг найден по прямому указанию — "после повторного сбора хабара
                // урон седого откатывается на старый остаток вместо свежей выдачи"): 'sedoy_dmg_total'
                // и 'sedoy_dmg_left' УБРАНЫ из whitelist — оба поля уже полностью server-authoritative
                // (выдача — habar.php.collectDay(), трата — bosses.php.useSedoy(), обе пишут ТОЛЬКО
                // через Gameops::saveUser(), в обход этого whitelist). Пока поля оставались здесь,
                // любой обычный дебаунс-автосейв (queuePlayerSave — триггерится ЛЮБОЙ мутацией udata,
                // не только седого) мог долететь до users.save() СО СТАРЫМ локальным sedoy_dmg_left
                // (снятым ДО applyPatch() от collectDay()/useSedoy()) и, если его ответ приходил
                // ПОСЛЕ прямой записи сервера, тихо затирал свежую выдачу обратно на прежний остаток
                // — тот же класс гонки, что уже чинили для shmot/roulette_winner/ryukzak_points (см.
                // соседние комментарии) и для bosses_data (suspendPlayerSave/resumePlayerSave в
                // bosses-combat.js). Здесь источник тот же самый, но лечится проще: полям вообще
                // незачем быть client-writable — убрав их из whitelist, users.save() просто
                // игнорирует эти два ключа, даже если клиент их пришлёт, а applyPatch()/users.get()
                // по-прежнему нормально показывают клиенту актуальное серверное значение (whitelist
                // влияет только на save(), не на get()/patch — читать эти поля клиент как читал).
                // Заодно закрывает и анти-чит дыру: без этого читер мог одним users.save() из
                // консоли выставить себе произвольный sedoy_dmg_left и одним "ударом" убивать любого
                // босса без единого реального удара оружием.
                // Новые поля для достижений 15.09.2026 (Экономические/Сила/Стрик/Траты).
                // 27.09.2026 (та же гонка, что описана выше про stew_spent): 'coins_spent'
                // УБРАНО отсюда — тем же набором server-authoritative эндпоинтов (см. коммент у
                // stew_spent) поддерживается и coins_spent, включая hapuga.php.buy()/
                // gangs.php.donate(), которые раньше считали её локально на клиенте
                // (hapuga.js/gangs.js) без переноса на сервер — перенесено этим же аудитом.
                // 27.09.2026 (КРИТИЧЕСКИЙ репорт — "покупка валюты не начисляет валюту: ачивка
                // по трате голосов считается, а рубли не добавляются"): 'votes_spent' УБРАНО из
                // whitelist. Это поле было единственной причиной, по которой клиент вообще
                // что-то сохранял в момент подтверждённой покупки: bank.js.successDonat()
                // писал его локально и сразу зазывал achievements._checkAll() →
                // _syncWithServer() → flushPlayerSave(), а тот немедленно отправлял users.save
                // с ПОЛНЫМ снимком udata, где coins/stew/cigarettes ещё старые. Этот запрос
                // прилетал практически одновременно с вебхуком VK (universal_pay.php), который
                // валюту уже начислил, и затирал её обратно — при этом votes_spent сохранялся
                // успешно, отсюда и наблюдаемая картина "ачивка считается, валюта нет". Теперь
                // счётчик потраченных голосов начисляет сам вебхук, ОДНОЙ записью вместе с
                // валютой (см. server/universal_pay.php) — клиенту на покупке сохранять нечего.
                // Заодно закрыта анти-чит дыра: раньше любой игрок мог одним users.save
                // выставить себе votes_spent и забрать все достижения категории "донат" без
                // единого реально потраченного голоса.
                'str_xp_total','login_streak','last_login_day',
                // 25.09.2026 (аудит по прямому указанию — "проверь, сохраняются ли очки/уровень
                // рюкзака, прописана ли логика на сервере"): ryukzak_points УБРАН отсюда — с
                // 21.09.2026 (см. bosses.php.claimKill()/ryukzak.php.open()) он единственный
                // источник правды для того, КАКОЙ из 20 уровней наград рюкзака достанется игроку
                // (ryukzak.php._levelFromPoints()) — оставаясь в этом whitelist, поле позволяло
                // читеру одним users.save выставить произвольное значение и открывать рюкзак
                // сразу на 20 уровне без единого убитого босса. Пишет теперь ТОЛЬКО сервер
                // (claimKill()), клиент — только читает (ryukzak.js, превью уровня до открытия).
                // ryukzak_claimed_level оставлен — не читается больше нигде (гейт "один раз за
                // уровень" убран 21.09.2026 тем же указанием), инертное поле, риска нет.
                'ryukzak_claimed_level',
                // Аудит 16.09.2026: эти поля клиент пишет в udata (ryukzak.js, yashik.js,
                // achievements.js, nick.js, dvor-roulette-minigame.js, habar.js), но их не
                // было в whitelist — сервер молча отбрасывал ключ, значит колонка в БД никогда
                // не обновлялась и при следующей загрузке значение откатывалось. Ключи боссов,
                // патроны ящика, татуировки и ник терялись каждую перезагрузку; статистика
                // карт/покера/рулетки/соло-килов/спид-килов для ачивок никогда не накапливалась.
                // Колонки — см. migrate12.php.
                // 24.09.2026 (перенос экономики хабара на сервер, по прямому указанию): habar_bought/
                // habar_days_collected/habar_last_collect_ts УБРАНЫ из этого списка обратно —
                // 16.09.2026 их добавили сюда именно чтобы кулдаун сбора хабара хотя бы
                // ПЕРЕЖИВАЛ перезагрузку страницы, но это оставляло клиента полностью
                // authoritative: игрок мог обнулить счётчик/таймер прямо из консоли браузера и
                // собирать хабар бесконечно. Теперь всю эту логику (покупка/кулдаун/лимит 30
                // дней/начисление) считает сервер (habar.php.collectDay()), эти 3 поля читает и
                // пишет только он через Gameops::loadUser()/saveUser() — см. habar.js._collectDay().
                'boss_keys','tatu','nick',
                'cards_games','cards_combos','poker_games','poker_combos','roulette_games',
                'solo_kills','speed_kills',
                // 25.09.2026 (дыра найдена по прямому указанию — аудит "Связки ключей"):
                // keyring_owner УБРАН из whitelist. Это постоянный предмет "нападай на любого
                // босса без ключей, сколько угодно раз" — пока оно было здесь, любой игрок мог
                // выставить себе keyring_owner=1 напрямую через users.save из консоли браузера,
                // без единой реальной победы в рулетке/мини-игре. Выдают его только
                // roulette.php (claimKeyring()/pickCup()) через Gameops::saveUser(), в обход
                // whitelist — то же самое разделение, что уже применено для habar_bought и
                // остальных server-only полей выше.
                // «Рамка уважения» на карточках локаций (16.09.2026) — личный накопленный счётчик
                // уважения по каждой из 5 локаций (сверяется с глобальным рекордом в отдельной
                // таблице zone_respect_leader, см. server/core/controllers/zone.php).
                'loc_respect_0','loc_respect_1','loc_respect_2','loc_respect_3','loc_respect_4',
                // Бесплатный ежедневный бросок в зариках (16.09.2026, возвращён по прямому
                // указанию) — таймштамп последнего использования, см. dvor-dice-game.js.
                'dice_free_ts',
                // 24.09.2026 (по прямому указанию — "настройки звука/музыки не сохраняются после
                // перезагрузки"): раньше window._sndVol/_musVol жили только в памяти вкладки
                // (sound.js), нигде не персистились. Обычная косметическая настройка, не
                // экономика — client-writable, без server-only session-поля. Миграция —
                // server/migrate31.php.
                'snd_vol', 'mus_vol',
                // Аудит 17.09.2026 — счётчик заначек из ящика (yashik.js/dvor.js) раньше писался
                // в habar_counts, которое server/core/controllers/habar.php использует как JSON-
                // массив контейнеров Хабара — два разных смысла тихо перезаписывали друг друга
                // через один и тот же столбец. Разведены по отдельным полям.
                'stash_count',
                // Аудит 17.09.2026 (перенос Зоны на сервер) — обнаружено, что zone_collect_0..4
                // (кулдаун 8ч сбора дохода бизнеса, zone.js.collectLocIncome) вообще НЕ были в
                // whitelist и не существовали как колонки БД — сервер молча отбрасывал ключ при
                // каждом users.save, поэтому кулдаун никогда не переживал перезагрузку страницы
                // (можно было собирать доход бизнеса без ожидания, просто обновив вкладку).
                // Колонки — см. migrate16.php.
                //
                // 04.10.2026 (аудит по прямому указанию — "найди дыры", см. парный коммент у
                // 'zone'/'base_buildings'/'gang_id' выше): УБРАНЫ отсюда обратно — тот самый
                // кулдаун, который добавили сюда 17.09.2026, сам стал дырой без guard: читер мог
                // одним users.save({zone_collect_0:'0', ...}) сбросить все 5 таймеров и собирать
                // доход бизнеса бесконечно, без ожидания 8ч. zone.php.collectIncome()/
                // collectAllIncome() уже пишут эти поля сами через Gameops::saveUser() (в обход
                // этого whitelist) — client-writable путь был не нужен ни для чего легитимного,
                // клиент эти ключи никогда не записывает напрямую (только читает на экране).
                // 30.09.2026 (обучение, по прямому указанию): onboarding_step — текущий шаг
                // пошагового тура (intro/dvor/zone/baza/habar/bosses/svod/shmot/sidorovich/
                // currency/final/done). Не экономика/RNG — читерство здесь означало бы разве
                // что "сам себе пропустить обучение", безвредно — обычный whitelist-путь
                // достаточен, server-only поле не требуется (в отличие от boss/casino-сессий).
                'onboarding_step',
            ];

            // Аудит безопасности 18.09.2026: 'bp_level','bp_xp','bp_xp_next','bp_claimed',
            // 'zadaniya','zadaniya_day' сознательно УБРАНЫ из whitelist (были здесь раньше).
            // bp.php.claim() и tasks.php.claim() проверяют условие получения награды (уровень
            // БП / прогресс задания), ЧИТАЯ ЭТИ ЖЕ ПОЛЯ ИЗ БД — но поля были client-writable,
            // значит читер мог одним users.save выставить себе bp_level:500 или zadaniya с
            // любым prog/need/reward_val и забрать любую награду в обход всей проверки. Обе
            // фичи ("задания" и Боевой пропуск) сейчас отключены в интерфейсе (interface-
            // panels.js: disabled:true у "задания"; battlepass.js.addXp() — ранний return),
            // легитимного пути записи этих полей сейчас не существует вовсе — удаление из
            // whitelist полностью закрывает дыру без потери функциональности. Если/когда эти
            // фичи будут включены обратно — прогресс должен считаться и подтверждаться только
            // сервером (по образцу skills_levels/dice_session), не восстанавливаться в whitelist.
            //
            // 23.09.2026: 'zadaniya'/'zadaniya_day' выше теперь и не нужны были бы даже без
            // этого запрета — прогресс заданий полностью переехал в zadaniya_session (см.
            // tasks.php), server-only поле по тому же принципу, что dice_session/poker_session.
            // НЕ добавлять zadaniya_session сюда — тот же класс дыры, что и был у zadaniya.

            // Аудит безопасности 23.09.2026 (репорт "достижения вылетают как попало"):
            // 'achievements','achievement_stars','ach_score','bullets' сознательно УБРАНЫ из
            // whitelist (были здесь раньше, весь прогресс достижений и патроны ящика считал и
            // писал achievements.js целиком на клиенте) — читер мог одним users.save выставить
            // себе achievement_stars/bullets любым числом напрямую. Теперь их читает и пишет
            // ТОЛЬКО сервер через Gameops::loadUser()/saveUser() — см.
            // achievements.php.sync()/achievement_engine.php — тот же паттерн, что
            // skills_levels/dice_session. users.get() по-прежнему отдаёт эти поля клиенту на
            // чтение (там SELECT '*', whitelist здесь касается только записи) — они не
            // секретные, просто больше не client-writable.

            // Аудит безопасности 17.09.2026: сервер раньше писал ЛЮБОЕ значение клиента для
            // ЛЮБОГО поля из $allowed без проверки — игрок мог открыть консоль браузера и
            // одним вызовом TS.php('users.save', {udata_json: JSON.stringify({coins:'999999999', exp:'999999999', ...})})
            // выставить себе любую валюту/уровень/скилл-поинты напрямую в БД. Ниже — жёсткий
            // потолок и неотрицательность для основных «денежных»/прогрессовых полей (именно
            // то, чем реально можно накрутить себе преимущество за один запрос). Остальные
            // поля (JSON-блобы вроде zadaniya/bosses_data/skills_data/shmot и т.п.) сюда
            // намеренно не включены — они требуют отдельной, более глубокой валидации схемы
            // (см. вопрос в конце анализа безопасности), это не пытается закрыть ВСЮ
            // поверхность атаки, только самый грубый и очевидный вектор ("миллион всего").
            $MAX_NUMERIC = 100000000; // 100 млн — с большим запасом выше любых реалистичных игровых значений
            $strictNumericFields = [
                // 29.09.2026: 'coins'/'stew'/'cigarettes' убраны отсюда вместе с удалением из
                // $allowed выше — раз поля больше не client-writable, числовой потолок для них
                // здесь не нужен (тот же паттерн, что 'roulette_spichki'/'max_energy' выше).
                'exp', 'respect', 'health',
                'skill_points', 'dice_points', 'blue_points', 'poker_chips',
                // 28.09.2026: 'roulette_spichki' тоже убрано отсюда вместе с удалением из
                // $allowed выше (см. коммент там) — раз поле больше не client-writable,
                // числовой потолок для него здесь не нужен.
                // 28.09.2026: 'max_energy' убрано отсюда вместе с удалением из $allowed выше
                // (та же причина, что у bp_level/bp_xp/bp_xp_next ниже) — раз поле больше не
                // client-writable, потолок для него здесь не нужен.
                'boss_keys', 'energy',
                'stash_count',
            ];
            // 18.09.2026: 'bp_level'/'bp_xp'/'bp_xp_next' убраны отсюда вместе с удалением из
            // $allowed выше (bp.claim() читает их из БД для проверки права на награду — эти
            // поля больше не client-writable вовсе, числовой потолок для них не нужен).
            // 'ammo_auto'/'ammo_gun'/'ammo_machete' переехали ниже в $monotonicFields — этим
            // полям мало простого потолка, легитимно они могут только УМЕНЬШАТЬСЯ (расход
            // патронов в бою), а не расти (это и есть отдельная валидация схемы, упомянутая
            // в абзаце выше — see _sanitizeWeapons()/$monotonicFields).
            $monotonicFields = ['ammo_auto', 'ammo_gun', 'ammo_machete'];
            // 25.09.2026: 'shmot' => '_sanitizeShmot' убран отсюда вместе с 'shmot' из $allowed
            // выше — _sanitizeShmot() удалена как мёртвый код (единственный вызывающий её был
            // именно этот guard).
            // 26.09.2026 (аудит перед модерацией VK — 'inventory' было в whitelist БЕЗ вообще
            // какой-либо проверки содержимого, в отличие от weapons): рюкзак Василича сейчас не
            // имеет ни одной клиентской ветки, которая ДОБАВЛЯЕТ в него предметы — единственный
            // писатель, vassilich.js._renderBackpack(), только УДАЛЯЕТ использованный предмет
            // (inv.splice()) и пересохраняет остаток. Читер мог одним users.save({inventory:
            // JSON.stringify([{effect:{coins:99999999}}, ...])}) вписать себе произвольные
            // предметы с любым effect и тут же "использовать" их тем же UI, полностью в обход
            // цен и лут-таблиц Василича. См. _sanitizeInventory() ниже — разрешает только сужение
            // уже сохранённого набора (ровно то, что делает единственная легитимная операция).
            $jsonBlobGuards  = ['weapons' => '_sanitizeWeapons', 'inventory' => '_sanitizeInventory'];

            // Текущие значения оружия/патронов/инвентаря нужны ТОЛЬКО если клиент вообще
            // пытается их записать в этом запросе — не гонять лишний SELECT на каждый обычный autosave.
            $current = null;
            if(isset($incoming['weapons']) || isset($incoming['inventory'])
                || isset($incoming['ammo_auto']) || isset($incoming['ammo_gun']) || isset($incoming['ammo_machete'])){
                $current = $this->registry['udb']->getData(
                    $this->registry['utb'],
                    ['weapons', 'inventory', 'ammo_auto', 'ammo_gun', 'ammo_machete'],
                    'id=' . $this->registry['uid']
                );
                if(isset($current['error']) && $current['error']) $current = [];
            }

            $update = ['id' => $this->registry['uid'], 'visit' => time()];
            foreach($allowed as $key){
                if(!isset($incoming[$key])) continue;

                $val = $incoming[$key];
                if(in_array($key, $strictNumericFields, true)){
                    // Разрешаем только валидную неотрицательную целую строку/число в пределах
                    // потолка — иначе отбрасываем ключ целиком (старое значение в БД остаётся
                    // без изменений, запрос при этом не падает целиком).
                    if(!is_numeric($val)){
                        error_log('[users.save] отклонено поле '.$key.' — не число, значение: '.json_encode($val).' | uid='.$this->registry['uid']);
                        continue;
                    }
                    $num = intval($val);
                    if($num < 0 || $num > $MAX_NUMERIC || strval($num) !== strval(intval($val))){
                        error_log('[users.save] отклонено поле '.$key.' — вне допустимого диапазона [0..'.$MAX_NUMERIC.'], значение: '.$val.' | uid='.$this->registry['uid']);
                        continue;
                    }
                    $val = $num;
                } else if(in_array($key, $monotonicFields, true)){
                    // 18.09.2026: weapons.js._loadFromUdata() читает ammo_auto/ammo_gun/
                    // ammo_machete как "легаси"-фолбэк и, если это значение БОЛЬШЕ текущего qty
                    // в блобе weapons, ПОДНИМАЕТ qty до него и ставит owned=true — читер мог
                    // одним users.save({ammo_auto:'999999'}) получить бесконечные патроны
                    // автомата в обход всей ценовой проверки weapons.php. Патроны легитимно
                    // могут только РАСХОДОВАТЬСЯ в бою (weapons.consumeQty) — растущее значение
                    // всегда подделка, отклоняем целиком.
                    if(!is_numeric($val)){
                        error_log('[users.save] отклонено поле '.$key.' — не число, значение: '.json_encode($val).' | uid='.$this->registry['uid']);
                        continue;
                    }
                    $num = intval($val);
                    $curNum = intval($current[$key] ?? 0);
                    if($num < 0 || $num > $curNum){
                        error_log('[users.save] отклонено поле '.$key.' — попытка увеличить патроны напрямую (текущее='.$curNum.', запрошено='.$num.') | uid='.$this->registry['uid']);
                        continue;
                    }
                    $val = $num;
                } else if(isset($jsonBlobGuards[$key])){
                    // 18.09.2026: weapons/shmot — те самые "JSON-блобы", про которые предупреждал
                    // комментарий выше ("требуют отдельной, более глубокой валидации схемы").
                    // У обоих полей УЖЕ есть выделенные, провалидированные по цене эндпоинты
                    // (weapons.buy/upgrade, shmot.buy) — но сами блобы оставались в whitelist
                    // для легитимной необходимости (расход патронов, переключение экипировки),
                    // и читер мог одним users.save подставить owned:true/upg:20/qty:999999 всем
                    // слотам сразу, полностью в обход цены. Ниже — сравнение с уже сохранённым в
                    // БД: разрешаем СНИЖЕНИЕ qty и любые equipped-переключения, но не рост
                    // owned/upg/qty (см. _sanitizeWeapons()/_sanitizeShmot() ниже).
                    $method = $jsonBlobGuards[$key];
                    $sanitized = $this->$method($current[$key] ?? null, $val);
                    if($sanitized === null){
                        error_log('[users.save] отклонено поле '.$key.' — попытка эскалации owned/upg/qty через users.save | uid='.$this->registry['uid']);
                        continue;
                    }
                    $val = json_encode($sanitized);
                }

                $update[$key] = $val;
            }

            // 26.09.2026 (по прямому живому репорту — "поздравляют с уровнем 22 уже 40 раз"):
            // эта функция пишет напрямую через $registry['udb'], в обход Gameops::saveUser()
            // (см. там же полный разбор причины) — тот же пересчёт level из exp нужен и здесь,
            // это основной, самый частый путь автосейва exp с клиента.
            if(isset($update['exp'])){
                $exp = intval($update['exp']);
                $level = max(0, (int)floor((-1 + sqrt(1 + $exp / 5)) / 2));
                $update['level'] = (string)$level;
            }

            $result = $this->registry['udb']->saveData($this->registry['utb'], $update);

            if(isset($result['error']) && $result['error']){
                return $this->registry['tools']->error(99);
            }

            $this->registry['tools']->output(['ok' => 1]);
        }

        // ── СБРОС SERVER-ONLY SESSION-ПОЛЕЙ (18.09.2026) ──
        //
        // dev_panel.js._resetAccount() пишет дефолты через users.save() — но save() трогает
        // ТОЛЬКО поля из $allowed выше. skills_levels/dice_session/poker_session/
        // blackjack_session/yashik_session/roulette_cups НАМЕРЕННО не в этом списке (это и
        // есть суть переноса экономики на сервер — клиент не может их подделать через
        // users.save), поэтому обычный "сброс аккаунта" их не трогал: игрок обнулял валюту
        // и прогресс, но прокачанные скиллы и зависшие игровые сессии покера/зариков/
        // блэкджека/ящика/рулетки-кубков переживали "полный сброс" (баг найден при аудите
        // после изучения проекта — тот же класс проблемы, что уже чинили для bosses_data/
        // zone в dev_panel.js, но для полей, которые вообще не видны через users.save).
        // Тот же уровень доступа, что и у users.save (сбросить можно только СВОЙ аккаунт,
        // id берётся из registry, не из параметров запроса) — просто дотягивается до полей,
        // намеренно скрытых от общего whitelist.
        function resetSession(){
            $update = [
                'id'                  => $this->registry['uid'],
                'skills_levels'       => null,
                'dice_session'        => null,
                'poker_session'       => null,
                'blackjack_session'   => null,
                'yashik_session'      => null,
                'roulette_cups'       => null,
                // 22.09.2026: gym_pump_cooldowns (кулдаун "качнуть", см. zaruba.php.pump()) —
                // тот же класс server-only поля, добавлено сразу по правилу выше.
                'gym_pump_cooldowns'  => null,
                // 22.09.2026: zaruba_last_ts (дневной лимит зарубы, см. zaruba.php.fight()) —
                // тот же класс server-only поля: сброс аккаунта не должен оставлять "чужой"
                // кулдаун на свежем тестовом аккаунте.
                'zaruba_last_ts'      => null,
                // 22.09.2026: shmot_fragments (прогресс сборки "20 частей" сета "ссср" с боссов,
                // см. bosses.php.claimKill()) — тот же класс server-only поля: только сервер
                // пишет прирост фрагментов, клиент не может подделать через users.save. Полный
                // сброс аккаунта обязан обнулять и накопленный прогресс сборки, иначе игрок
                // после "сброса" всё ещё стоит в 1 фрагменте от готовой вещи бесплатно.
                'shmot_fragments'     => null,
                // 22.09.2026: lost_stash_pity (прогресс "Потерянного тайника" — pity-счётчик
                // открытий ящика, см. yashik.php.openBox()) — тот же класс поля, обнуляется при
                // сбросе (иначе сброшенный аккаунт "помнит" сотни накопленных открытий бесплатно).
                'lost_stash_pity'     => null,
                // 22.09.2026: dev_force_drops (личный флаг "100% дропа шмота отовсюду", дев-
                // панель) — сброс аккаунта выключает и его тоже, чтобы "чистый" тестовый аккаунт
                // не оставался с забытым включённым чит-режимом.
                'dev_force_drops'     => 0,
                // 25.09.2026: dev_force_jackpot (личный одноразовый флаг "100% джекпот на
                // следующий спин рулетки", дев-панель) — тот же класс, сброс тоже гасит его.
                'dev_force_jackpot'   => 0,
                // 25.09.2026: dev_force_dice/poker/blackjack/roulette (личные одноразовые флаги
                // "100% на конкретную комбинацию", новые вкладки казино в dev-панели, см.
                // dev_panel_casino_force.js/users.setDevCombo()) — тот же класс полей, что
                // dev_force_drops/dev_force_jackpot выше, только хранят строковый ключ
                // комбинации вместо bool. Сброс аккаунта гасит их тоже.
                'dev_force_dice'      => '',
                'dev_force_poker'     => '',
                'dev_force_blackjack' => '',
                'dev_force_roulette'  => '',
                // 23.09.2026: zadaniya_session (перенос "Ежедневных заданий" на сервер, см.
                // tasks.php) — тот же класс server-only поля: сброс аккаунта не должен оставлять
                // "чужой" набор уже выбранных/частично выполненных заданий на свежем аккаунте.
                'zadaniya_session'    => null,
                // 23.09.2026: achievements/achievement_stars/ach_score/bullets (перенос
                // достижений и патронов ящика на сервер, см. achievements.php) — тот же класс
                // server-only полей, убраны из $allowed в save() выше, поэтому обычный сброс их
                // больше не коснётся без явного перечисления здесь.
                'achievements'        => null,
                'achievement_stars'   => 0,
                'ach_score'           => 0,
                'bullets'             => 0,
                // 24.09.2026: boss_fight_session (кэш личного HP + курсор урона друзей боя с
                // боссом, см. bosses.php._syncFightSession()) — тот же класс server-only поля:
                // сброс аккаунта не должен оставлять "чужой" кэшированный HP от боя, которого
                // для "нового" аккаунта уже как бы не было (bossStartMs обнуляется обычным
                // сбросом bosses_data, но это поле — отдельная колонка, whitelist его не трогает).
                'boss_fight_session'  => null,
                // 26.09.2026: dvor_daily_sigs (сбор сигарет во дворе, см. dvor.php.collectCig())
                // — убрано из $allowed в save() выше тем же батчем, поэтому обычный сброс
                // аккаунта (users.save) больше его не коснётся без явного перечисления здесь,
                // как и остальные server-only поля в этом списке — иначе "сброшенный" аккаунт
                // молча помнил бы уже собранные сегодня облачка сигарет.
                'dvor_daily_sigs'     => null,
                // 24.09.2026: habar_bought/habar_days_collected/habar_last_collect_ts (перенос
                // экономики хабара на сервер, см. habar.php.collectDay()) — убраны из $allowed
                // выше, поэтому обычный сброс аккаунта (users.save с пустыми/нулевыми значениями)
                // их больше не коснётся без явного перечисления здесь, как и остальные server-only
                // поля в этом списке.
                'habar_bought'           => 0,
                'habar_days_collected'   => 0,
                // 25.09.2026: ryukzak_points убран из $allowed в save() выше (см. коммент там) —
                // обычный сброс аккаунта (users.save) больше его не коснётся без явного
                // перечисления здесь, как и остальные server-only поля в этом списке.
                'ryukzak_points'         => 0,
                'habar_last_collect_ts'  => 0,
                // 26.09.2026: sedoy_dmg_total/sedoy_dmg_left убраны из $allowed в save() выше
                // (см. коммент там, тот же класс проблемы — гонка автосейва тихо откатывала
                // свежую выдачу урона седого обратно на старый остаток) — обычный сброс аккаунта
                // (users.save) больше их не коснётся без явного перечисления здесь, как и
                // остальные server-only поля в этом списке (habar_bought чуть выше — тот же
                // случай, урон седого выдаётся тем же habar.php.collectDay()).
                'sedoy_dmg_total'        => 0,
                'sedoy_dmg_left'         => 0,
                // 04.10.2026 (баг найден по живому репорту — "сбросил аккаунт, а энергии 370
                // вместо 50"): 'max_energy' убрано из client-writable $allowed в save() 28.09.2026
                // (теперь пишут только shmot/skills/vassilich/hapuga/zone-бонусы) — но сюда,
                // в единственный server-only путь личного сброса, его тогда не добавили.
                // _resetAccount() (dev_panel.js) и resetAllPlayers() оба шлют max_energy:'50' в
                // ОБЫЧНОМ users.save()/UPDATE — resetAllPlayers() пишет прямым UPDATE в обход
                // whitelist и поэтому срабатывает, а личный сброс идёт через этот же users.save(),
                // где whitelist теперь молча отбрасывает max_energy — старое накопленное значение
                // (бонусы шмота/скиллов/банды до сброса) оставалось висеть нетронутым навсегда.
                'max_energy'             => '50',
            ];
            $result = $this->registry['udb']->saveData($this->registry['utb'], $update);
            if(isset($result['error']) && $result['error']){
                return $this->registry['tools']->error(99);
            }

            // 23.09.2026 (тот же разбор, что дал фикс resetAllPlayers() ниже — "у босса в разы
            // меньше хп" — при разборе всплыла и смежная дыра в ОДИНОЧНОМ сбросе): свою личную
            // историю урона (boss_damage_log) и свои клеймы наград (boss_instance_claims,
            // миграция 29) игрок после "сброса аккаунта" тоже не должен тащить за собой —
            // это server-only состояние того же класса, что skills_levels/dice_session выше,
            // просто хранится не в колонке users, а в отдельных таблицах по uid. Без этой чистки
            // "сброшенный" аккаунт мог прийти на ЕЩЁ ЖИВОЙ общий инстанс, который бил ДО сброса,
            // и claimKill() посчитал бы его уже поучаствовавшим (_instanceDamageSum>0 из старых
            // записей) либо, если этот инстанс уже был им заклеймлен до сброса, сразу отдал бы
            // fail 71 "награда уже получена" за бой, которого для "нового" аккаунта как бы и не
            // было. Не трогаем сам boss_instances — это общая для всех игроков сущность, её
            // чистит только resetAllPlayers() (полный сброс сервера), не сброс одного игрока.
            $link = $this->_rawLink();
            if($link){
                $uid = intval($this->registry['uid']);
                $link->query("DELETE FROM `boss_damage_log` WHERE `uid`=".$uid);
                $link->query("DELETE FROM `boss_instance_claims` WHERE `uid`=".$uid);
                $link->close();
            }

            $this->registry['tools']->output(['ok' => 1]);
        }

        // 19.09.2026 (репорт "оружие/патроны не сохраняются" — разбор показал: dev-панель
        // выдаёт оружие/патроны через обычный users.save(), а $monotonicFields/$jsonBlobGuards
        // ниже НАМЕРЕННО отклоняют именно РОСТ ammo_*/weapons через этот путь — это тот же
        // самый анти-чит, что закрывает дыру для обычных игроков (Аудит безопасности
        // 17.09.2026), просто он с тем же успехом блокирует и легитимные dev-инструменты,
        // использующие тот же путь). Отдельный узкий permit — по образцу resetSession() выше:
        // пишет ТОЛЬКО weapons/ammo_* и ТОЛЬКО для своего uid, в обход whitelist-санитайзеров,
        // ровно как resetSession() в обход whitelist обнуляет server-only поля. Как и
        // debug_mode/GIVE_MILLION — временный доступ по прямому указанию, до отдельной задачи.
        function devGrantWeapons(){
            if(!$this->_requireDevUser()) return;
            $update = ['id' => $this->registry['uid']];
            $weaponsJson = $this->registry['user_params']['weapons_json'] ?? null;
            if($weaponsJson !== null) $update['weapons'] = $weaponsJson;
            foreach(['ammo_auto', 'ammo_gun', 'ammo_machete'] as $key){
                if(isset($this->registry['user_params'][$key])) $update[$key] = intval($this->registry['user_params'][$key]);
            }
            if(count($update) <= 1) return $this->registry['tools']->error(54); // нечего сохранять

            $result = $this->registry['udb']->saveData($this->registry['utb'], $update);
            if(isset($result['error']) && $result['error']){
                return $this->registry['tools']->error(99);
            }
            $this->registry['tools']->output(['ok' => 1]);
        }

        // 25.09.2026 (по прямому указанию, тот же батч, что перенос shmot.equip() на сервер —
        // см. большой комментарий у $allowed выше): 'shmot' убран из client-writable whitelist,
        // поэтому dev-кнопка "ОТКРЫТЬ ВСЁ" (_unlockAllShmot(), dev_panel.js) больше не может
        // писать owned=true через обычный users.save. Тот же приём, что devGrantWeapons() выше
        // (dev-only прямой SQL update в обход whitelist) — единственный легитимный путь для этой
        // конкретной dev-функции теперь.
        function devGrantShmot(){
            if(!$this->_requireDevUser()) return;
            $shmotJson = $this->registry['user_params']['shmot_json'] ?? null;
            if($shmotJson === null) return $this->registry['tools']->error(54); // нечего сохранять
            $incoming = json_decode($shmotJson, true);
            if(!is_array($incoming)) return $this->registry['tools']->error(54);
            $user = $this->ops->loadUser();
            if(!$user) return $this->registry['tools']->error(99);
            $current = $this->ops->j($user, 'shmot', []);
            // Dev-выдача раньше обходила applyShmotOwnBonus(), поэтому вещи с +энергией
            // появлялись в гардеробе, но их max_energy не начислялся. Добавляем бонус ровно
            // при переходе конкретной вещи из not-owned в owned — без повторной выдачи.
            foreach($incoming as $id => $state){
                if(empty($state['owned']) || !empty($current[$id]['owned'])) continue;
                $this->ops->applyShmotOwnBonus($user, intval($id));
            }
            $user['shmot'] = json_encode($incoming);
            if(!$this->ops->saveUser($user)) return $this->registry['tools']->error(99);
            $this->registry['tools']->output(['ok' => 1,
                'patch' => $this->ops->patchCurrencies($user, ['shmot', 'max_energy'])]);
        }

        // 29.09.2026 (см. коммент у $allowed выше — закрытие класса бага "автосейв затирает
        // серверные начисления"): coins/stew/cigarettes убраны из client-writable whitelist,
        // поэтому dev-кнопки (dev_panel.js._addU()/_giveMillion(), debug-tools.js GIVE_MILLION),
        // которые раньше просто прибавляли к udata[...] и звали обычный users.save(), больше не
        // могут так писать валюту. Тот же узкий permit-паттерн, что devGrantWeapons()/
        // devGrantShmot() выше — принимает ЛЮБОЕ подмножество из {coins, stew, cigarettes} и
        // применяет все дельты за ОДИН load+save (не по одной валюте отдельным запросом) —
        // иначе несколько параллельных вызовов devGrantCurrency() читали бы одну и ту же полную
        // строку через loadUser() и последний ответивший запрос затёр бы изменения остальных
        // (ровно тот же класс гонки, от которого лечит вся эта миграция). amount может быть
        // отрицательным — тогда валюта не прибавляется, а списывается (нужно для _giveMillion(),
        // который выставляет АБСОЛЮТНОЕ значение, а не прибавляет — клиент сам считает дельту от
        // текущего значения). Как и остальные dev-permits, доступен без отдельной проверки "это
        // правда дев" — тот же принятый уровень защиты, что у devGrantWeapons/devGrantShmot/
        // setDevFlag (дев-панель скрыта от игроков на уровне интерфейса, не сервера).
        function devGrantCurrency(){
            if(!$this->_requireDevUser()) return;
            $allowedTypes = ['coins', 'stew', 'cigarettes'];
            $deltas = [];
            foreach($allowedTypes as $type){
                if(!isset($this->registry['user_params'][$type])) continue;
                $amt = intval($this->registry['user_params'][$type]);
                if($amt !== 0) $deltas[$type] = $amt;
            }
            if(!$deltas) return $this->registry['tools']->error(54); // нечего сохранять

            $user = $this->ops->loadUser();
            if(!$user) return $this->registry['tools']->error(99);
            foreach($deltas as $type => $amt) $this->ops->add($user, $type, $amt);
            if(!$this->ops->saveUser($user)) return $this->registry['tools']->error(99);
            $this->registry['tools']->output(['ok' => 1,
                'patch' => $this->ops->patchCurrencies($user, array_keys($deltas))]);
        }

        // DEV: выставляет максимум шкалы рюкзака (1200 очков = уровень 20). Обычный
        // users.save не имеет права писать ryukzak_points, поэтому отдельный серверный
        // permit обязателен; доступ ограничен _requireDevUser().
        function devSetRyukzakLevel(){
            if(!$this->_requireDevUser()) return;
            $user = $this->ops->loadUser();
            if(!$user) return $this->registry['tools']->error(99);
            $user['ryukzak_points'] = 1200;
            if(!$this->ops->saveUser($user)) return $this->registry['tools']->error(99);
            $this->registry['tools']->output(['ok' => 1, 'level' => 20,
                'patch' => $this->ops->patchCurrencies($user, ['ryukzak_points'])]);
        }

        // Согласие на список друзей: флаг ставится только текущему подписанному VK-пользователю
        // и только после успешного VKWebAppGetAuthToken на клиенте. Храним на сервере, чтобы
        // кнопка доступа не возвращалась после очистки localStorage или новой сессии.
        function setFriendsScopeGranted(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->registry['tools']->error(99);
            $user['friends_scope_granted'] = 1;
            if(!$this->ops->saveUser($user)) return $this->registry['tools']->error(99);
            $this->registry['tools']->output(['ok' => 1,
                'patch' => $this->ops->patchCurrencies($user, ['friends_scope_granted'])]);
        }

        // Сохраняет последний список друзей, подтверждённый VK API. Благодаря этому после
        // перезапуска вкладка «Друзья» работает из БД и не требует повторного OAuth-окна.
        // Метод доступен только после уже сохранённого согласия и пишет лишь текущего игрока.
        function setFriendsCache(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->registry['tools']->error(99);
            if(intval($user['friends_scope_granted'] ?? 0) !== 1) return $this->registry['tools']->error(403);

            $raw = strval($this->registry['user_params']['friends'] ?? '');
            $ids = [abs(intval($this->registry['uid']))];
            foreach(explode(',', $raw) as $id){
                $id = abs(intval($id));
                if($id > 0 && !in_array($id, $ids, true)) $ids[] = $id;
                if(count($ids) >= 5000) break;
            }
            $user['friends'] = implode(',', $ids);
            if(!$this->ops->saveUser($user)) return $this->registry['tools']->error(99);
            $this->registry['tools']->output(['ok'=>1,
                'patch'=>$this->ops->patchCurrencies($user, ['friends'])]);
        }

        // 22.09.2026 (по прямому указанию — "добавь в dev кнопку которая делает 100% шанс
        // дропа шмоток отовсюду") — dev_force_drops, личный server-only флаг ЭТОГО аккаунта
        // (НЕ в whitelist $allowed выше — обычный users.save его не тронет), читается
        // bosses.php.claimKill() и yashik.php.openBox() перед каждым броском шанса дропа
        // шмота/тайника. Тот же узкий обходной permit-паттерн, что devGrantWeapons() выше —
        // пишет ровно одно поле, только для своего uid. Затрагивает ТОЛЬКО аккаунт, включивший
        // флаг — не общий переключатель в конфиге, остальные игроки играют с обычными шансами.
        // Список $allowedFlags — на случай будущих похожих дев-тумблеров, сейчас один элемент.
        function setDevFlag(){
            if(!$this->_requireDevUser()) return;
            $flag = strval($this->registry['user_params']['flag'] ?? '');
            // 25.09.2026: dev_force_jackpot добавлен по тому же паттерну, что dev_force_drops —
            // roulette.php.spin() сам гасит флаг в 0 сразу после использования (одноразовый),
            // здесь только включение через dev-панель.
            $allowedFlags = ['dev_force_drops', 'dev_force_jackpot'];
            if(!in_array($flag, $allowedFlags, true)) return $this->registry['tools']->error(54);

            $value = intval($this->registry['user_params']['value'] ?? 0) ? 1 : 0;
            $update = ['id' => $this->registry['uid'], $flag => $value];

            $result = $this->registry['udb']->saveData($this->registry['utb'], $update);
            if(isset($result['error']) && $result['error']){
                return $this->registry['tools']->error(99);
            }
            $this->registry['tools']->output(['ok' => 1, $flag => $value]);
        }

        // 25.09.2026 (по прямому указанию — "хочу тестировать все азартные игры, добавь во
        // вкладки покер/рулетка/блэкджек/зарики кнопку 100% около каждой комбинации"): тот же
        // принцип, что setDevFlag() выше (личный server-only флаг ТОЛЬКО этого аккаунта, в
        // обход whitelist), но здесь значение — строковый КЛЮЧ конкретной комбинации, а не
        // bool. Один эндпоинт на все 4 игры — game выбирает конкретное поле dev_force_<game>,
        // combo пишется как есть (сама игра — dice.php/poker.php/blackjack.php/roulette.php —
        // валидирует и гасит флаг сама при следующей раздаче/броске/спине, см. их комментарии
        // "форсирует ИМЕННО следующую попытку и сразу гасится").
        function setDevCombo(){
            if(!$this->_requireDevUser()) return;
            $game = strval($this->registry['user_params']['game'] ?? '');
            $allowedGames = ['dice', 'poker', 'blackjack', 'roulette'];
            if(!in_array($game, $allowedGames, true)) return $this->registry['tools']->error(54);

            // 26.09.2026 (баг найден по прямому репорту + логам — dev_force_blackjack иногда
            // получал буквально строку "Array" вместо ранга карты, из-за чего у игрока
            // раздавались две карты с несуществующим рангом "Array" — .png не грузился,
            // карты вообще не отображались. strval() на PHP-массиве молча даёт именно "Array"
            // без единого предупреждения — раньше это тихо улетало в БД. Источник массива на
            // клиенте найти не удалось (dev_panel_casino_force.js по коду шлёт валидную
            // строку), поэтому здесь — защита по факту: если combo пришёл НЕ строкой/числом
            // (массив/объект), запрос отклоняется явной ошибкой вместо порчи данных, и сырое
            // значение логируется для диагностики, если это повторится.
            $comboRaw = $this->registry['user_params']['combo'] ?? '';
            if(is_array($comboRaw)){
                error_log('[users.setDevCombo] !!! combo пришёл МАССИВОМ, а не строкой !!! game=' . $game
                    . ' | uid=' . abs(intval($this->registry['uid'])) . ' | combo=' . json_encode($comboRaw)
                    . ' | rawParams=' . json_encode($this->registry['user_params']));
                return $this->registry['tools']->error(54);
            }
            $combo = strval($comboRaw);
            $field = 'dev_force_' . $game;
            $update = ['id' => $this->registry['uid'], $field => $combo];

            $result = $this->registry['udb']->saveData($this->registry['utb'], $update);
            if(isset($result['error']) && $result['error']){
                return $this->registry['tools']->error(99);
            }
            $this->registry['tools']->output(['ok' => 1, $field => $combo]);
        }

        // Формат — тот же, что weapons.js._saveToUdata()/_loadFromUdata(): массив слотов
        // [{owned,equipped,upg,qty}, ...] по индексу id оружия. Возвращает провалидированный
        // массив (безопасно готовый к json_encode) или null, если запрос пытается поднять
        // owned/upg/qty выше уже сохранённого в БД значения хоть для одного слота — в этом
        // случае поле отклоняется целиком (см. вызов выше), старое значение в БД остаётся.
        function _sanitizeWeapons($currentRaw, $incomingRaw){
            $current = is_array($currentRaw) ? $currentRaw : (is_string($currentRaw) && $currentRaw !== '' ? json_decode($currentRaw, true) : []);
            if(!is_array($current)) $current = [];
            $incoming = is_array($incomingRaw) ? $incomingRaw : json_decode($incomingRaw, true);
            if(!is_array($incoming)) return null;

            foreach($incoming as $i => $slot){
                if(!is_array($slot)) return null;
                $cur     = isset($current[$i]) && is_array($current[$i]) ? $current[$i] : ['owned'=>false,'upg'=>0,'qty'=>0];
                $curOwned = !empty($cur['owned']);
                // 28.09.2026: слоты 0-2 (нож/цепь/бита) — бесплатное оружие, всегда owned=true
                // и на клиенте (weapons.js._loadFromUdata()), и на сервере (weapons.php.
                // _loadWeapons()) — но в БД это никогда явно не сохраняется, пока игрок не
                // купит/прокачает хоть что-нибудь через weapons.buy/upgrade (единственные
                // писатели, которым разрешено поднимать owned). Игрок, который только
                // переключает экипировку между бесплатным оружием или тратит патроны в бою
                // (weapons.consumeQty → _saveToUdata() пишет ВЕСЬ массив), никогда не проходит
                // через buy/upgrade — тогда $current[0..2]['owned'] в БД так и остаётся false
                // навсегда, а клиент каждый раз шлёт owned:true для этих слотов и получает
                // "эскалация" на КАЖДЫЙ users.save с полем weapons (найдено 28.09.2026 по
                // логам uid=470613218 — десятки подряд отклонённых сохранений weapons без
                // единой попытки купить/прокачать оружие). Раз бесплатное оружие owned=true —
                // инвариант, а не читерство, сверяем его здесь так же, как и оба других места.
                if($i < 3) $curOwned = true;
                $curUpg   = intval($cur['upg'] ?? 0);
                $curQty   = intval($cur['qty'] ?? 0);

                $newOwned = !empty($slot['owned']);
                $newUpg   = intval($slot['upg'] ?? 0);
                $newQty   = intval($slot['qty'] ?? 0);

                if(($newOwned && !$curOwned) || $newUpg > $curUpg || $newQty > $curQty) return null;
            }
            return $incoming;
        }

        // 25.09.2026: _sanitizeShmot() удалена — 'shmot' убран из client-writable whitelist
        // (см. комментарий у $allowed выше), единственный писатель equipped/owned теперь
        // shmot.php.buy()/equip() через Gameops::saveUser(), этот guard больше не вызывается.

        // 26.09.2026 (аудит перед модерацией VK) — см. комментарий у $jsonBlobGuards выше.
        // Легитимная операция над рюкзаком Василича — ТОЛЬКО удаление уже сохранённого предмета
        // (нет ни одной ветки, которая добавляет новый), поэтому incoming обязан быть
        // сужением (под-мультимножеством) current: каждый элемент incoming должен буквально
        // присутствовать в current, элемент "использует" ровно одно совпадение (учитывает
        // повторяющиеся одинаковые предметы, а не просто optional-совпадение по значению).
        function _sanitizeInventory($currentRaw, $incomingRaw){
            $current = is_array($currentRaw) ? $currentRaw : (is_string($currentRaw) && $currentRaw !== '' ? json_decode($currentRaw, true) : []);
            if(!is_array($current)) $current = [];
            $incoming = is_array($incomingRaw) ? $incomingRaw : json_decode($incomingRaw, true);
            if(!is_array($incoming)) return null;

            $pool = array_map('json_encode', $current);
            foreach($incoming as $item){
                if(!is_array($item)) return null;
                $key = array_search(json_encode($item), $pool, true);
                if($key === false) return null; // предмет, которого не было в сохранённом наборе — отклоняем весь блоб
                unset($pool[$key]);
            }
            return $incoming;
        }

        function setFriends($user){
            isset($this->registry['user_params']['users'])?$this->registry['friends'] = $this->registry['user_params']['users']:$this->registry['friends'] = 'skip';

            switch($this->registry['friends']){
                case 'skip':
                    if(!is_array($user['friends']) && is_string($user['friends'])){
                        $rating = $this->registry['udb']->getData($this->registry['utb'], array('id', 'exp', 'visit'), 'id IN('.$user['friends'].') ORDER BY exp-0 DESC', true); //Сразу же топ по опыту. он 100% будет
                    } else $rating = [];
                    
                    break;
                
                default:
                    //Проверка на валидность
                    $friendiends = explode(',', $this->registry['friends']);
                    $valid_friends = [];

                    for($i = 0; $i < count($friendiends); $i++)if(abs(intval($friendiends[$i])) > 0)array_push($valid_friends, abs(intval($friendiends[$i])));

                    if(!isset($valid_friends[0]))array_push($valid_friends, abs(intval($this->registry['uid'])));

                    $this->registry['friends'] = implode(',', $valid_friends);
                    //Закончили проверку

                    $rating = $this->registry['udb']->getData($this->registry['utb'], array('id', 'exp', 'visit'), 'id IN('.$this->registry['friends'].') ORDER BY exp-0 DESC', true); //Сразу же топ по опыту. он 100% будет
                    break;
            }

            //Заполняем валидных друзей, которые есть в базе
            $real_friends = [];

            for($i = 0; $i < count($rating); $i++)array_push($real_friends, $rating[$i]['id']);
            //Заполнили. Все иды валидные, т.к. уже прошли через БД

            $user['friends'] = implode(',', $real_friends);

            $this->friends_top = $rating;

            return $user;
        }

        // Личный тестовый переключатель «Связка ключей». Проверка UID на сервере обязательна:
        // Dev-панель видна в клиенте, поэтому её нельзя считать защитой от вызова из консоли.
        //
        // 02.10.2026 (разбор упавших тестов — tests/dev-keyring-toggle.test.js ожидал персональную
        // $devUid=382448269 здесь, но tests/sedoy-dev-roulette-medals.test.js — независимый,
        // ранее уже ПРОХОДИВШИЙ регресс-гвард — явно перечисляет toggleDevKeyring среди 7
        // dev-функций, обязанных использовать именно общий _requireDevUser(): тестировалось и
        // подтверждалось позже, чем личная версия. Клиент (dev_panel.js) по-прежнему рендерит
        // саму кнопку только при vk_user_id==='382448269' (декоративное сужение UI для одного
        // конкретного разработчика, не граница доверия — оба uid из общего dev-whitelist
        // одинаково доверенные), но СЕРВЕРНАЯ проверка намеренно обобщена вместе со всеми
        // остальными dev-эндпоинтами. Попытка сузить именно эту функцию (сделана и отменена в
        // этой же сессии) ломала sedoy-dev-roulette-medals.test.js — оставлено как есть.
        function toggleDevKeyring(){
            if(!$this->_requireDevUser()) return;
            $user = $this->ops->loadUser();
            if(!$user) return $this->registry['tools']->error(99);
            $enabled = $this->ops->i($user, 'keyring_owner') <= 0;
            $user['keyring_owner'] = $enabled ? 1 : 0;
            if(!$this->ops->saveUser($user)) return $this->registry['tools']->error(99);
            $this->registry['tools']->output(['ok'=>1, 'enabled'=>$enabled ? 1 : 0,
                'patch'=>$this->ops->patchCurrencies($user, ['keyring_owner'])]);
        }

        // 23.09.2026 (по прямому указанию — сначала одноразовый server/reset_all_players_23092026.php
        // выполнен вручную и удалён с сервера, теперь постоянная кнопка "СБРОС У ВСЕХ" в dev-
        // панели на будущее, т.к. понадобится ещё не раз за время тестирования). Полный сброс
        // ВСЕХ существующих игроков до состояния нового аккаунта — ТЕ ЖЕ дефолты, что и у
        // resetAccount() в dev_panel.js на клиенте (см. _defaultResetUdata() ниже, скопировано
        // 1:1 оттуда), просто применённые ко всем id разом одним проходом, а не через
        // users.save() текущего игрока.
        //
        // Пароль — единственная защита: DEV-кнопка в HUD видна и кликабельна ЛЮБОМУ игроку
        // (interface.js, ничем не ограничена), поэтому проверка обязана быть здесь, на сервере,
        // а не только в клиентском prompt() (тот тривиально обходится вызовом TS.php напрямую
        // из консоли, минуя проверку). Простое сравнение строки — тот же уровень защиты, что и
        // у key= в одноразовых migrate*.php/reset_all_players*.php скриптах этого проекта,
        // осознанно не усложняем (тестовая стадия, 5-6 игроков).
        function resetAllPlayers(){
            if(!$this->_requireDevUser()) return;
            $pass = isset($this->registry['user_params']['password']) ? strval($this->registry['user_params']['password']) : '';
            if($pass !== '5110') return $this->registry['tools']->error(403);

            $link = $this->_rawLink();
            if(!$link) return $this->registry['tools']->error(99);

            $utb = $this->registry['utb'];

            // Бэкап поверх ФИКСИРОВАННОГО имени (не создаём новую таблицу на каждый клик) —
            // защищает от "отменить последний по счёту сброс", не копит десятки backup-таблиц
            // при повторном использовании кнопки в ходе тестирования.
            //
            // 23.09.2026 (репорт "у босса в разы меньше хп, чем должно быть" — разбор показал:
            // boss_instances (миграция 29, общий HP боевой сессии) сюда добавлена не была, хотя
            // boss_damage_log/boss_instance_claims уже чистились. Итог — после "СБРОС У ВСЕХ"
            // ЖИВОЙ инстанс оставался с уже подсевшим current_hp (урон, нанесённый до сброса),
            // а вся история урона (boss_damage_log) стиралась в ноль. Дальше игроки били заново
            // с чистого current_hp… нет, с УЖЕ ПОДСЕВШЕГО — рейтинг/личный урон в ответах
            // attack()/instanceStatus() после сброса считался только по НОВЫМ, честным записям,
            // но реальный current_hp был занижен на весь "стёртый" урон из прошлого — сумма урона
            // в рейтинге переставала сходиться с фактическим падением HP. Полный сброс обязан
            // приводить общие бои в такое же "чистое" состояние, как и всё остальное — поэтому
            // обе таблицы новой архитектуры добавлены в тот же цикл бэкапа+очистки.
            foreach([$utb, 'boss_last_kill', 'boss_damage_log', 'boss_instances', 'boss_instance_claims', 'zone_respect_leader'] as $t){
                $bk = $t . '_backup_last_reset';
                $link->query("DROP TABLE IF EXISTS `$bk`");
                $link->query("CREATE TABLE `$bk` AS SELECT * FROM `$t`");
            }

            // Сверяемся с реальной схемой — пропускаем (не роняем весь UPDATE) любое поле из
            // дефолтного набора, которого в текущей таблице нет.
            $existingCols = [];
            $colRes = $link->query("SHOW COLUMNS FROM `$utb`");
            while($r = $colRes->fetch_assoc()) $existingCols[$r['Field']] = true;

            $uids = [];
            $res = $link->query("SELECT id FROM `$utb`");
            while($row = $res->fetch_assoc()) $uids[] = intval($row['id']);

            $applied = array_intersect_key($this->_defaultResetUdata(), $existingCols);

            $okCount = 0;
            foreach($uids as $uid){
                $parts = [];
                foreach($applied as $k => $v){
                    $parts[] = ($v === null) ? "`$k`=NULL" : "`$k`='" . $link->real_escape_string($v) . "'";
                }
                if($link->query("UPDATE `$utb` SET " . implode(', ', $parts) . " WHERE id=$uid")) $okCount++;
            }

            foreach(['boss_last_kill', 'boss_damage_log', 'boss_instances', 'boss_instance_claims', 'zone_respect_leader'] as $t){
                $link->query("DELETE FROM `$t`");
            }

            $link->close();

            $this->registry['tools']->output(['ok' => 1, 'players_reset' => $okCount, 'total_players' => count($uids)]);
        }

        // Тот же паттерн, что bosses.php._rawLink() — свой mysqli-коннект в обход Database-
        // обёртки (у неё нет DDL/SHOW COLUMNS/произвольного WHERE по всем строкам), с теми же
        // registry-credentials.
        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        // 1:1 копия дефолтного набора _client/src/game/shell/overlays/dev_panel.js._resetAccount()
        // (+ server-only session-поля users.resetSession() — см. соответствующий комментарий
        // там же). Единственный источник истины для "что значит сброшенный аккаунт" в проекте —
        // сознательно НЕ переизобретается заново здесь, чтобы не наступить повторно на грабли,
        // которые уже чинили 22.09.2026 (gang_id:'0' не '' — INT-колонка; weapons/shmot:'[]' не
        // '' — иначе json_decode('')→null молча отклоняет поле целиком).
        private function _defaultResetUdata(){
            return [
                'coins'=>'10','cigarettes'=>'1000','stew'=>'0','exp'=>'0','energy'=>'50','max_energy'=>'50',
                'respect'=>'0','ammo_auto'=>'0','ammo_gun'=>'0','ammo_machete'=>'0','health'=>'100','energy_time'=>'0',
                'poker_chips'=>'0','poker_spichki'=>'0','roulette_spichki'=>'0',
                'blue_points'=>'0','dice_points'=>'0','habar_counts'=>'0','stash_count'=>'0',
                'dvor_games'=>'0','dvor_games_data'=>'{}','dvor_daily'=>'{}',
                'dvor_daily_sigs'=>'{}','nickname'=>'','level'=>'1','stew_spent'=>'0',
                'roulette_winner'=>'{}',
                'zone'=>'{}','base_buildings'=>'','base_stats'=>'','base_location'=>'',
                'gang_id'=>'0','gang_data'=>'[]','weapons'=>'[]','shmot'=>'[]','inventory'=>'',
                'hapuga_items'=>'','hapuga_sold'=>'0','hapuga_refreshes'=>'0','hapuga_avail'=>'1','hapuga_next_ts'=>'0',
                'bp_level'=>'0','bp_xp'=>'0','bp_xp_next'=>'0','bp_claimed'=>'','svod_claimed'=>'',
                'zadaniya'=>'','zadaniya_day'=>'','bot_settings'=>'','bot_running'=>'0',
                'days_played'=>'1','total_damage'=>'0','zone_fights'=>'0','dvor_wins'=>'0',
                'bosses_killed'=>'0','habar_opened'=>'0',
                'train_count'=>'0','vassilich_buys'=>'0','coins_earned'=>'0',
                'bosses_data'=>'','zone_income_time'=>'0',
                'zone_fights_0'=>'0','zone_fights_1'=>'0','zone_fights_2'=>'0','zone_fights_3'=>'0','zone_fights_4'=>'0',
                'natisk_event_id'=>'','natisk_free_attempts'=>'0','natisk_paid_attempts'=>'0','natisk_kills'=>'0',
                'natisk_seen_event_id'=>'',
                'skills_data'=>'','skill_points'=>'0',
                'hata_progress'=>'-1','base_bg_owned'=>'','base_bg_active'=>'',
                'stash_data'=>'',
                // 25.09.2026 (баг найден по живому крашу — "Cannot create property 'cards' on
                // string '[object Object]1'"): stash_data РАНЬШЕ использовался ОДНОВРЕМЕННО двумя
                // независимыми фичами с несовместимыми форматами — achievements.js.onStashCollect()
                // писал плоский счётчик {key: number} (это ждёт achievement_engine.php,
                // achievements_config.json), а zone.php/zone.js писали туда же богатый объект
                // {key: {cards, completed}}. Коллизия форматов роняла клиент TypeError'ом.
                // 25.09.2026, тем же днём (по прямому указанию — "нычки визуально не готовы,
                // находка сейчас не должна иметь функционала — просто счётчик в БД, без
                // классификации по типу, нычка есть нычка"): per-key объект в zone.php убран
                // целиком (заодно и устранил саму возможность коллизии) — stash_count вместо
                // него — плоский счётчик "сколько нычек всего найдено", без темы/типа. См.
                // migrate32.php (ALTER TABLE). achievements.js стал единственным писателем
                // stash_data (per-key достижения по нычкам сейчас отключены/закомментированы —
                // см. achievements.js, но поле оставлено на случай будущего оживления).
                'stash_count'=>'0',
                'boss_kills_0'=>'0','boss_kills_1'=>'0','boss_kills_2'=>'0',
                'bj_games'=>'0','dice_games'=>'0','energy_spent'=>'0',
                'habar_bought'=>'0','habar_days_collected'=>'',
                'sedoy_dmg_total'=>'0','sedoy_dmg_left'=>'0',
                'achievements'=>'', 'achievement_stars'=>'0', 'ach_score'=>'0',
                'coins_spent'=>'0','votes_spent'=>'0','str_xp_total'=>'0','login_streak'=>'0','last_login_day'=>'',
                'ryukzak_points'=>'0','ryukzak_claimed_level'=>'0',
                'boss_keys'=>'0','bullets'=>'0','tatu'=>'0','nick'=>'',
                'cards_games'=>'0','cards_combos'=>'{}','poker_games'=>'0','poker_combos'=>'{}',
                'roulette_games'=>'0','solo_kills'=>'[]','speed_kills'=>'[]',
                'habar_last_collect_ts'=>'0','keyring_owner'=>'0',
                'loc_respect_0'=>'0','loc_respect_1'=>'0','loc_respect_2'=>'0','loc_respect_3'=>'0','loc_respect_4'=>'0',
                'dice_free_ts'=>'0',
                'zone_collect_0'=>'0','zone_collect_1'=>'0','zone_collect_2'=>'0','zone_collect_3'=>'0','zone_collect_4'=>'0',
                'skills_levels'=>null,'dice_session'=>null,'poker_session'=>null,'blackjack_session'=>null,
                'yashik_session'=>null,'roulette_cups'=>null,'gym_pump_cooldowns'=>null,'zaruba_last_ts'=>null,
                'shmot_fragments'=>null,'lost_stash_pity'=>null,'dev_force_drops'=>'0','dev_force_jackpot'=>'0',
                'dev_force_dice'=>'','dev_force_poker'=>'','dev_force_blackjack'=>'','dev_force_roulette'=>'',
                'zadaniya_session'=>null,
                'boss_fight_session'=>null,
            ];
        }

	}
?>
